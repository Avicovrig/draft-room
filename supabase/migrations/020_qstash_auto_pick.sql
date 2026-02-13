-- Migration 020: QStash scheduled auto-pick callbacks
--
-- When a pick timer starts (current_pick_started_at changes), a database trigger
-- schedules a QStash HTTP callback for time_limit_seconds + 2 seconds later.
-- QStash calls the auto-pick edge function with expectedPickIndex for idempotency.
-- If a captain/manager already picked, the callback harmlessly returns "Pick already made".
--
-- This provides precise server-side timer enforcement with ~2s delay, independent
-- of whether any browser clients are connected.
--
-- The pg_cron fallback from migration 019 remains as a backup for:
-- - QStash delivery failures
-- - Auto-pick captains (handled with 10s threshold in pg_cron)
--
-- SETUP REQUIRED after applying this migration:
-- 1. Create an Upstash account at https://upstash.com (free tier: 500 messages/day)
-- 2. Get your QStash token and URL from the Upstash console
-- 3. Insert vault secrets (use vault.create_secret if INSERT fails due to permissions):
--      SELECT vault.create_secret('<your-qstash-token>', 'qstash_token');
--      SELECT vault.create_secret('<your-qstash-url>', 'qstash_url');
--      SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/auto-pick', 'auto_pick_function_url');
--    The auto_pick_cron_secret from migration 019 is reused as the callback secret.
-- 4. Set the edge function secret (must match auto_pick_cron_secret in vault):
--      supabase secrets set AUTO_PICK_CRON_SECRET=<same-value-as-vault>
-- 5. Deploy auto-pick edge function

-- Enable pg_net for outbound HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: schedule a QStash callback when a pick timer starts.
-- Fires on UPDATE of current_pick_started_at when draft is in_progress.
-- Uses pg_net (async HTTP) so it doesn't block the transaction.
CREATE OR REPLACE FUNCTION schedule_auto_pick_timer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qstash_token TEXT;
  qstash_url TEXT;
  auto_pick_url TEXT;
  callback_secret TEXT;
  delay_seconds INT;
  publish_url TEXT;
BEGIN
  -- Only schedule when draft is in progress and timer actually started
  IF NEW.status != 'in_progress' THEN RETURN NEW; END IF;
  IF NEW.current_pick_started_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.time_limit_seconds <= 0 THEN RETURN NEW; END IF;

  -- Skip if current_pick_started_at didn't actually change (NULL-safe)
  IF NEW.current_pick_started_at IS NOT DISTINCT FROM OLD.current_pick_started_at THEN
    RETURN NEW;
  END IF;

  -- Get config from vault
  SELECT decrypted_secret INTO qstash_token
  FROM vault.decrypted_secrets WHERE name = 'qstash_token';

  SELECT decrypted_secret INTO qstash_url
  FROM vault.decrypted_secrets WHERE name = 'qstash_url';

  SELECT decrypted_secret INTO auto_pick_url
  FROM vault.decrypted_secrets WHERE name = 'auto_pick_function_url';

  SELECT decrypted_secret INTO callback_secret
  FROM vault.decrypted_secrets WHERE name = 'auto_pick_cron_secret';

  -- If vault secrets aren't configured yet, skip silently
  IF qstash_token IS NULL OR qstash_url IS NULL OR auto_pick_url IS NULL OR callback_secret IS NULL THEN
    RETURN NEW;
  END IF;

  delay_seconds := NEW.time_limit_seconds + 2;
  publish_url := qstash_url || '/v2/publish/' || auto_pick_url;

  -- Schedule the QStash callback.
  -- QStash will POST to auto_pick_url after delay_seconds with the JSON body.
  -- Headers: Authorization is consumed by QStash (not forwarded).
  -- Content-Type and x-cron-secret are forwarded to the destination.
  PERFORM net.http_post(
    url := publish_url,
    body := jsonb_build_object(
      'leagueId', NEW.id::text,
      'expectedPickIndex', NEW.current_pick_index
    ),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || qstash_token,
      'Content-Type', 'application/json',
      'Upstash-Delay', delay_seconds || 's',
      'x-cron-secret', callback_secret
    )
  );

  RETURN NEW;
END;
$$;

-- Fire on any UPDATE that changes current_pick_started_at while draft is active.
-- The function body has additional guards (NULL checks, IS NOT DISTINCT FROM).
CREATE TRIGGER schedule_auto_pick_on_timer_start
  AFTER UPDATE ON leagues
  FOR EACH ROW
  WHEN (NEW.status = 'in_progress' AND NEW.current_pick_started_at IS NOT NULL)
  EXECUTE FUNCTION schedule_auto_pick_timer();
