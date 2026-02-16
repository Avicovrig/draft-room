-- ============================================
-- FIX RLS LINTER WARNINGS
-- ============================================
-- 1. auth_rls_initplan: Wrap auth.uid() in (select auth.uid()) so it evaluates
--    once per query instead of per row.
-- 2. multiple_permissive_policies: Replace FOR ALL manager policies with separate
--    per-action policies (INSERT/UPDATE/DELETE) scoped to authenticated role,
--    eliminating SELECT overlap with public "Anyone can view" policies.

BEGIN;

-- ============================================
-- LEAGUES
-- ============================================

DROP POLICY "Managers can manage their own leagues" ON leagues;

CREATE POLICY "Managers can insert leagues"
  ON leagues FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = manager_id);

CREATE POLICY "Managers can update their leagues"
  ON leagues FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = manager_id)
  WITH CHECK ((select auth.uid()) = manager_id);

CREATE POLICY "Managers can delete their leagues"
  ON leagues FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = manager_id);

-- ============================================
-- CAPTAINS
-- ============================================

DROP POLICY "Managers can manage captains in their leagues" ON captains;

CREATE POLICY "Managers can insert captains"
  ON captains FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = captains.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can update captains"
  ON captains FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = captains.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = captains.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can delete captains"
  ON captains FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = captains.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

-- ============================================
-- PLAYERS
-- ============================================

-- Drop the FOR ALL policy and the redundant UPDATE-specific policy (migration 004)
DROP POLICY "Managers can manage players in their leagues" ON players;
DROP POLICY "Managers can update players" ON players;

CREATE POLICY "Managers can insert players"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = players.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can update players"
  ON players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = players.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = players.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can delete players"
  ON players FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = players.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

-- ============================================
-- DRAFT_PICKS
-- ============================================

DROP POLICY "Managers can manage draft picks in their leagues" ON draft_picks;

-- Scope captain INSERT to anon only (captains aren't authenticated; all picks
-- go through edge functions anyway, but keep as defense-in-depth)
DROP POLICY "Captains can insert picks with valid token" ON draft_picks;
CREATE POLICY "Captains can insert picks with valid token"
  ON draft_picks FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM captains
      WHERE captains.id = draft_picks.captain_id
      AND captains.league_id = draft_picks.league_id
    )
  );

CREATE POLICY "Managers can insert draft picks"
  ON draft_picks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = draft_picks.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can update draft picks"
  ON draft_picks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = draft_picks.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = draft_picks.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can delete draft picks"
  ON draft_picks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = draft_picks.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

-- ============================================
-- PLAYER_CUSTOM_FIELDS
-- ============================================

DROP POLICY "Managers can manage custom fields" ON player_custom_fields;

CREATE POLICY "Managers can insert custom fields"
  ON player_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      JOIN leagues l ON l.id = p.league_id
      WHERE p.id = player_custom_fields.player_id
      AND l.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can update custom fields"
  ON player_custom_fields FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN leagues l ON l.id = p.league_id
      WHERE p.id = player_custom_fields.player_id
      AND l.manager_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      JOIN leagues l ON l.id = p.league_id
      WHERE p.id = player_custom_fields.player_id
      AND l.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can delete custom fields"
  ON player_custom_fields FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN leagues l ON l.id = p.league_id
      WHERE p.id = player_custom_fields.player_id
      AND l.manager_id = (select auth.uid())
    )
  );

-- ============================================
-- LEAGUE_FIELD_SCHEMAS
-- ============================================

DROP POLICY "Managers can manage field schemas" ON league_field_schemas;

CREATE POLICY "Managers can insert field schemas"
  ON league_field_schemas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = league_field_schemas.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can update field schemas"
  ON league_field_schemas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = league_field_schemas.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = league_field_schemas.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

CREATE POLICY "Managers can delete field schemas"
  ON league_field_schemas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = league_field_schemas.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

-- ============================================
-- AUDIT_LOGS
-- ============================================

-- Only fix the initplan issue (no overlapping policies on this table)
DROP POLICY "Managers can view audit logs for their leagues" ON audit_logs;

CREATE POLICY "Managers can view audit logs for their leagues"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = audit_logs.league_id
      AND leagues.manager_id = (select auth.uid())
    )
  );

COMMIT;
