-- Remove height, weight, birthday, hometown columns from players table.
-- These are now managed as league field schemas instead of hardcoded columns.
ALTER TABLE players DROP COLUMN IF EXISTS height;
ALTER TABLE players DROP COLUMN IF EXISTS weight;
ALTER TABLE players DROP COLUMN IF EXISTS birthday;
ALTER TABLE players DROP COLUMN IF EXISTS hometown;

-- Add toggle for whether players can add their own freeform custom fields
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS allow_player_custom_fields boolean NOT NULL DEFAULT true;
