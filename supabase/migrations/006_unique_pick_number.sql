-- Add unique constraint to prevent duplicate pick numbers within a league
-- This prevents race conditions where multiple auto-picks could happen for the same turn

-- First, clean up any existing duplicates by keeping only the first pick for each pick_number
-- Use a CTE to identify duplicates and delete all but one
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY league_id, pick_number ORDER BY picked_at ASC) as rn
  FROM draft_picks
)
DELETE FROM draft_picks
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Also clean up players that were drafted by deleted picks
-- Reset drafted_by_captain_id for players whose draft_pick_number doesn't match any existing pick
UPDATE players p
SET drafted_by_captain_id = NULL, draft_pick_number = NULL
WHERE drafted_by_captain_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM draft_picks dp
  WHERE dp.league_id = p.league_id
  AND dp.player_id = p.id
);

-- Now add the unique constraint
ALTER TABLE draft_picks
ADD CONSTRAINT draft_picks_league_pick_number_unique
UNIQUE (league_id, pick_number);
