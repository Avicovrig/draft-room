-- Migration 019: Server-side auto-pick fallback via pg_cron
--
-- Adds a cron job that runs every minute to detect leagues with expired
-- pick timers and automatically makes picks. This ensures drafts continue
-- even when all browser clients have disconnected.
--
-- The cron job is a FALLBACK — connected clients normally trigger auto-pick
-- when the timer expires. This catches the edge case where no clients are
-- connected (e.g., manager closes tab, all captains/spectators leave).
--
-- Draft order logic (snake/round_robin) mirrors src/lib/draft.ts and
-- the auto-pick edge function. Changes to draft order must be updated here too.

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage so the cron job can call our function
GRANT USAGE ON SCHEMA cron TO postgres;

-- Main function: find expired timers and make auto-picks directly in SQL.
-- Uses advisory lock to prevent concurrent execution.
-- Uses optimistic locking (current_pick_index) to prevent race conditions
-- with client-triggered picks.
CREATE OR REPLACE FUNCTION process_expired_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  league_rec RECORD;
  captain_count INT;
  pick_position INT;
  captain_index INT;
  current_cap RECORD;
  selected_player RECORD;
  from_queue BOOLEAN;
  is_complete BOOLEAN;
  new_pick_num INT;
  elapsed_seconds NUMERIC;
  had_auto_pick BOOLEAN;
  rows_updated INT;
BEGIN
  -- Advisory lock prevents concurrent cron runs from overlapping
  IF NOT pg_try_advisory_lock(hashtext('process_expired_timers')) THEN
    RETURN;
  END IF;

  FOR league_rec IN
    SELECT id, current_pick_index, draft_type, time_limit_seconds,
           current_pick_started_at
    FROM leagues
    WHERE status = 'in_progress'
      AND current_pick_started_at IS NOT NULL
  LOOP
    elapsed_seconds := EXTRACT(EPOCH FROM (now() - league_rec.current_pick_started_at));

    -- Get captain count for this league
    SELECT count(*) INTO captain_count
    FROM captains WHERE league_id = league_rec.id;

    IF captain_count = 0 THEN CONTINUE; END IF;

    -- Calculate current captain's draft position using same logic as
    -- getCurrentCaptainId() in src/lib/draft.ts
    IF league_rec.draft_type = 'snake' THEN
      pick_position := league_rec.current_pick_index % (2 * captain_count);
      IF pick_position < captain_count THEN
        captain_index := pick_position;
      ELSE
        captain_index := 2 * captain_count - 1 - pick_position;
      END IF;
    ELSE -- round_robin
      captain_index := league_rec.current_pick_index % captain_count;
    END IF;

    -- Find the captain at this draft position
    SELECT * INTO current_cap
    FROM captains
    WHERE league_id = league_rec.id
      AND draft_position = captain_index
    LIMIT 1;

    IF current_cap IS NULL THEN CONTINUE; END IF;

    -- Determine if we should trigger auto-pick:
    -- - Auto-pick captains: trigger after 10s (gives clients time to handle it)
    -- - Normal captains: trigger after timer expires + 5s grace period
    IF current_cap.auto_pick_enabled THEN
      IF elapsed_seconds < 10 THEN CONTINUE; END IF;
    ELSE
      IF league_rec.time_limit_seconds <= 0 THEN CONTINUE; END IF;
      IF elapsed_seconds < (league_rec.time_limit_seconds + 5) THEN CONTINUE; END IF;
    END IF;

    had_auto_pick := current_cap.auto_pick_enabled;
    from_queue := false;

    -- Try captain's draft queue first (same as selectPlayer() in auto-pick edge fn)
    SELECT p.* INTO selected_player
    FROM captain_draft_queues q
    JOIN players p ON p.id = q.player_id
    WHERE q.captain_id = current_cap.id
      AND p.league_id = league_rec.id
      AND p.drafted_by_captain_id IS NULL
      AND p.id NOT IN (
        SELECT c.player_id FROM captains c
        WHERE c.league_id = league_rec.id
          AND c.player_id IS NOT NULL
      )
    ORDER BY q.position ASC
    LIMIT 1;

    IF selected_player IS NOT NULL THEN
      from_queue := true;
    ELSE
      -- Random pick from available players (same as edge function fallback)
      SELECT p.* INTO selected_player
      FROM players p
      WHERE p.league_id = league_rec.id
        AND p.drafted_by_captain_id IS NULL
        AND p.id NOT IN (
          SELECT c.player_id FROM captains c
          WHERE c.league_id = league_rec.id
            AND c.player_id IS NOT NULL
        )
      ORDER BY random()
      LIMIT 1;
    END IF;

    IF selected_player IS NULL THEN CONTINUE; END IF;

    new_pick_num := league_rec.current_pick_index + 1;

    -- Insert draft pick. Unique constraint on (league_id, pick_number)
    -- prevents duplicate picks if a client also triggers simultaneously.
    BEGIN
      INSERT INTO draft_picks (league_id, captain_id, player_id, pick_number, is_auto_pick)
      VALUES (league_rec.id, current_cap.id, selected_player.id, new_pick_num, true);
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    -- Update player
    UPDATE players
    SET drafted_by_captain_id = current_cap.id,
        draft_pick_number = new_pick_num
    WHERE id = selected_player.id;

    -- Remove picked player from ALL captain queues
    DELETE FROM captain_draft_queues
    WHERE player_id = selected_player.id;

    -- Check if draft is complete (no more available players)
    SELECT NOT EXISTS (
      SELECT 1 FROM players p
      WHERE p.league_id = league_rec.id
        AND p.drafted_by_captain_id IS NULL
        AND p.id NOT IN (
          SELECT c.player_id FROM captains c
          WHERE c.league_id = league_rec.id
            AND c.player_id IS NOT NULL
        )
    ) INTO is_complete;

    -- Advance league with optimistic locking on current_pick_index.
    -- If another client already advanced, this UPDATE matches 0 rows
    -- and we skip (the pick insert already succeeded, which is fine).
    IF is_complete THEN
      UPDATE leagues
      SET status = 'completed',
          current_pick_index = league_rec.current_pick_index + 1,
          current_pick_started_at = NULL
      WHERE id = league_rec.id
        AND current_pick_index = league_rec.current_pick_index;
    ELSE
      UPDATE leagues
      SET current_pick_index = league_rec.current_pick_index + 1,
          current_pick_started_at = now()
      WHERE id = league_rec.id
        AND current_pick_index = league_rec.current_pick_index;
    END IF;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;

    -- If optimistic lock failed (another client advanced), roll back the pick
    IF rows_updated = 0 THEN
      DELETE FROM draft_picks
      WHERE league_id = league_rec.id AND pick_number = new_pick_num;
      UPDATE players
      SET drafted_by_captain_id = NULL, draft_pick_number = NULL
      WHERE id = selected_player.id;
      CONTINUE;
    END IF;

    -- Track consecutive timeouts for non-auto-pick captains
    IF NOT had_auto_pick THEN
      UPDATE captains
      SET consecutive_timeout_picks = consecutive_timeout_picks + 1,
          auto_pick_enabled = CASE
            WHEN consecutive_timeout_picks + 1 >= 2 THEN true
            ELSE auto_pick_enabled
          END
      WHERE id = current_cap.id;
    END IF;

    -- Audit log
    INSERT INTO audit_logs (action, league_id, actor_type, metadata)
    VALUES (
      'auto_pick_made',
      league_rec.id,
      'system',
      jsonb_build_object(
        'pickNumber', new_pick_num,
        'playerId', selected_player.id,
        'playerName', selected_player.name,
        'captainId', current_cap.id,
        'captainName', current_cap.name,
        'isComplete', is_complete,
        'fromQueue', from_queue,
        'timerExpiry', NOT had_auto_pick,
        'source', 'pg_cron'
      )
    );

    RAISE LOG 'process_expired_timers: auto-picked % for % in league % (pick %)',
      selected_player.name, current_cap.name, league_rec.id, new_pick_num;
  END LOOP;

  PERFORM pg_advisory_unlock(hashtext('process_expired_timers'));
END;
$$;

-- Run every minute. pg_cron's minimum interval is 1 minute.
-- This means worst-case latency is ~65 seconds (timer expires just after
-- a cron run, next run at 60s + 5s grace period).
SELECT cron.schedule(
  'process-expired-timers',
  '* * * * *',
  $$SELECT process_expired_timers()$$
);
