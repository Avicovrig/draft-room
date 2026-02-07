-- Add team name and team photo to captains
ALTER TABLE captains ADD COLUMN IF NOT EXISTS team_name TEXT DEFAULT NULL;
ALTER TABLE captains ADD COLUMN IF NOT EXISTS team_photo_url TEXT DEFAULT NULL;
