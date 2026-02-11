-- Add column to track consecutive timer-expiry auto-picks per captain.
-- After 2 consecutive timeouts, auto-pick is automatically enabled.
-- A manual pick resets the counter to 0.

ALTER TABLE captains
  ADD COLUMN consecutive_timeout_picks integer NOT NULL DEFAULT 0;
