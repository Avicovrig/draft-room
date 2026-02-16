-- Add missing indexes on draft_picks foreign keys.
-- Without these, JOINs on captain_id/player_id and ON DELETE CASCADE
-- from captains/players require full table scans on draft_picks.

CREATE INDEX IF NOT EXISTS idx_draft_picks_captain_id
  ON draft_picks(captain_id);

CREATE INDEX IF NOT EXISTS idx_draft_picks_player_id
  ON draft_picks(player_id);
