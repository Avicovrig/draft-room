-- Add team color to captains for visual customization
ALTER TABLE captains ADD COLUMN team_color TEXT DEFAULT NULL;
