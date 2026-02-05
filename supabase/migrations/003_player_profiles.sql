-- Add profile columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS height text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS weight text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS birthday date;
ALTER TABLE players ADD COLUMN IF NOT EXISTS hometown text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS edit_token uuid DEFAULT gen_random_uuid();

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_players_edit_token ON players(edit_token);

-- Create player_custom_fields table
CREATE TABLE IF NOT EXISTS player_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  field_value text,
  field_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(player_id, field_name)
);

-- Enable RLS
ALTER TABLE player_custom_fields ENABLE ROW LEVEL SECURITY;

-- RLS policies for player_custom_fields
CREATE POLICY "Anyone can view custom fields"
  ON player_custom_fields FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage custom fields"
  ON player_custom_fields FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN leagues l ON l.id = p.league_id
      WHERE p.id = player_custom_fields.player_id
      AND l.manager_id = auth.uid()
    )
  );

-- Grant insert/update to anon for edge function usage (service role bypasses RLS anyway)
GRANT SELECT, INSERT, UPDATE, DELETE ON player_custom_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON player_custom_fields TO authenticated;
