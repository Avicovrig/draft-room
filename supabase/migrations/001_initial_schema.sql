-- Draft Room Initial Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- TABLES
-- ============================================

-- Leagues table
CREATE TABLE leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  spectator_token uuid DEFAULT gen_random_uuid() NOT NULL,
  draft_type text CHECK (draft_type IN ('snake', 'round_robin')) DEFAULT 'snake' NOT NULL,
  time_limit_seconds integer CHECK (time_limit_seconds BETWEEN 15 AND 1800) DEFAULT 60 NOT NULL,
  status text CHECK (status IN ('not_started', 'in_progress', 'paused', 'completed')) DEFAULT 'not_started' NOT NULL,
  current_pick_index integer DEFAULT 0 NOT NULL,
  current_pick_started_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(manager_id, name)
);

-- Captains table
CREATE TABLE captains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  is_participant boolean DEFAULT true NOT NULL,
  access_token uuid DEFAULT gen_random_uuid() NOT NULL,
  draft_position integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(league_id, draft_position)
);

-- Players table
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  drafted_by_captain_id uuid REFERENCES captains(id) ON DELETE SET NULL,
  draft_pick_number integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Draft picks table (audit log)
CREATE TABLE draft_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  captain_id uuid REFERENCES captains(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  pick_number integer NOT NULL,
  is_auto_pick boolean DEFAULT false NOT NULL,
  picked_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_leagues_manager_id ON leagues(manager_id);
CREATE INDEX idx_leagues_status ON leagues(status);
CREATE INDEX idx_captains_league_id ON captains(league_id);
CREATE INDEX idx_captains_access_token ON captains(access_token);
CREATE INDEX idx_players_league_id ON players(league_id);
CREATE INDEX idx_players_drafted_by ON players(drafted_by_captain_id);
CREATE INDEX idx_draft_picks_league_id ON draft_picks(league_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON leagues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;

-- Leagues policies
CREATE POLICY "Managers can manage their own leagues"
  ON leagues FOR ALL
  USING (auth.uid() = manager_id);

CREATE POLICY "Anyone can view leagues by spectator token"
  ON leagues FOR SELECT
  USING (true);

-- Captains policies
CREATE POLICY "Managers can manage captains in their leagues"
  ON captains FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = captains.league_id
      AND leagues.manager_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view captains"
  ON captains FOR SELECT
  USING (true);

-- Players policies
CREATE POLICY "Managers can manage players in their leagues"
  ON players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = players.league_id
      AND leagues.manager_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view players"
  ON players FOR SELECT
  USING (true);

-- Draft picks policies
CREATE POLICY "Managers can manage draft picks in their leagues"
  ON draft_picks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = draft_picks.league_id
      AND leagues.manager_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view draft picks"
  ON draft_picks FOR SELECT
  USING (true);

CREATE POLICY "Captains can insert picks with valid token"
  ON draft_picks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM captains
      WHERE captains.id = draft_picks.captain_id
      AND captains.league_id = draft_picks.league_id
    )
  );

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime for draft updates
ALTER PUBLICATION supabase_realtime ADD TABLE leagues;
ALTER PUBLICATION supabase_realtime ADD TABLE captains;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE draft_picks;
