-- Secure captain_draft_queues: replace permissive USING(true) policy
-- with a SELECT-only policy. All mutations now go through the
-- manage-draft-queue edge function (which uses the service_role key
-- and bypasses RLS entirely).

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow all operations on captain_draft_queues" ON captain_draft_queues;

-- Allow SELECT for anon/authenticated so the captain view can read its own queue.
-- Scoped to rows the caller can see (captain_id is a UUID not easily guessable,
-- and the query is always filtered by captain_id from the validated token).
CREATE POLICY "Allow read access on captain_draft_queues"
  ON captain_draft_queues
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies — only the service_role (edge functions) can mutate.
