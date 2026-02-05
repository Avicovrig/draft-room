-- Add player_id to captains table to link captains to players
-- When a captain is linked to a player, that player won't appear in the available players list during draft

ALTER TABLE captains ADD COLUMN player_id uuid REFERENCES players(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX idx_captains_player_id ON captains(player_id);

-- Optional: Add unique constraint to prevent same player being captain twice
CREATE UNIQUE INDEX idx_captains_player_id_unique ON captains(player_id) WHERE player_id IS NOT NULL;
