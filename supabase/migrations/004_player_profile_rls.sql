-- Update RLS policies for players table to allow managers to update profile fields

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Managers can update players" ON players;

-- Create a comprehensive update policy for managers
CREATE POLICY "Managers can update players"
  ON players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = players.league_id
      AND leagues.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = players.league_id
      AND leagues.manager_id = auth.uid()
    )
  );
