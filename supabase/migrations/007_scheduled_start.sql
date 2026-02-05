-- Add scheduled start time for drafts
-- This is informational - displayed to captains/spectators with countdown

ALTER TABLE leagues
ADD COLUMN scheduled_start_at timestamptz;
