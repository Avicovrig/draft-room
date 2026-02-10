-- Prevent the same player from being drafted twice in the same league.
-- The existing unique constraint on (league_id, pick_number) prevents duplicate
-- pick slots, but a race condition between concurrent requests could allow the
-- same player to be drafted at different pick numbers.
ALTER TABLE draft_picks
ADD CONSTRAINT draft_picks_league_player_unique UNIQUE (league_id, player_id);
