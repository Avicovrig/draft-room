-- Manager-defined custom field schemas at the league level
CREATE TABLE IF NOT EXISTS league_field_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  field_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, field_name)
);

-- Link player_custom_fields to schema (nullable = freeform field)
ALTER TABLE player_custom_fields
  ADD COLUMN IF NOT EXISTS schema_id uuid REFERENCES league_field_schemas(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_league_field_schemas_league_id
  ON league_field_schemas(league_id);

CREATE INDEX IF NOT EXISTS idx_player_custom_fields_schema_id
  ON player_custom_fields(schema_id);

-- RLS
ALTER TABLE league_field_schemas ENABLE ROW LEVEL SECURITY;

-- Anyone can view field schemas (needed for profile forms, draft views)
CREATE POLICY "Anyone can view field schemas"
  ON league_field_schemas FOR SELECT
  USING (true);

-- Only the league manager can manage field schemas
CREATE POLICY "Managers can manage field schemas"
  ON league_field_schemas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = league_field_schemas.league_id
      AND leagues.manager_id = auth.uid()
    )
  );
