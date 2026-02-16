-- Migration 025: Security hardening
--
-- 1. Add SET search_path = public to all SECURITY DEFINER RPCs (013, 024)
--    Prevents search_path manipulation attacks on privileged functions.
--    Functions from 019/020 already have this set.
--
-- 2. Add missing index on player_custom_fields(player_id)
--    Foreign key lookups and RLS policy subqueries use this column.
--
-- 3. Revoke DML on audit_logs from client roles
--    Audit logs should only be written by edge functions via service_role.

-- ============================================
-- 1. SET search_path on SECURITY DEFINER RPCs
-- ============================================

-- validate_captain_token (latest version from migration 024)
CREATE OR REPLACE FUNCTION validate_captain_token(p_league_id uuid, p_token uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', c.id,
    'league_id', c.league_id,
    'name', c.name,
    'is_participant', c.is_participant,
    'draft_position', c.draft_position,
    'player_id', c.player_id,
    'auto_pick_enabled', c.auto_pick_enabled,
    'team_color', c.team_color,
    'team_name', c.team_name,
    'team_photo_url', c.team_photo_url,
    'created_at', c.created_at,
    'linked_player_edit_token', (
      SELECT p.edit_token FROM public.players p WHERE p.id = c.player_id
    ),
    'league_spectator_token', (
      SELECT l.spectator_token FROM public.leagues l WHERE l.id = c.league_id
    )
  ) INTO result
  FROM public.captains c
  WHERE c.league_id = p_league_id AND c.access_token = p_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- validate_spectator_token
CREATE OR REPLACE FUNCTION validate_spectator_token(p_league_id uuid, p_token uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.leagues WHERE id = p_league_id AND spectator_token = p_token
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- validate_player_edit_token
CREATE OR REPLACE FUNCTION validate_player_edit_token(p_player_id uuid, p_token uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'league_id', p.league_id,
    'name', p.name,
    'drafted_by_captain_id', p.drafted_by_captain_id,
    'draft_pick_number', p.draft_pick_number,
    'bio', p.bio,
    'profile_picture_url', p.profile_picture_url,
    'created_at', p.created_at,
    'custom_fields', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', cf.id,
          'player_id', cf.player_id,
          'field_name', cf.field_name,
          'field_value', cf.field_value,
          'field_order', cf.field_order,
          'schema_id', cf.schema_id,
          'created_at', cf.created_at
        ) ORDER BY cf.field_order
      ) FROM public.player_custom_fields cf WHERE cf.player_id = p.id),
      '[]'::json
    ),
    'linked_captain_access_token', (
      SELECT c.access_token FROM public.captains c WHERE c.player_id = p.id AND c.league_id = p.league_id
    ),
    'league_spectator_token', (
      SELECT l.spectator_token FROM public.leagues l WHERE l.id = p.league_id
    )
  ) INTO result
  FROM public.players p
  WHERE p.id = p_player_id AND p.edit_token = p_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- get_league_tokens
CREATE OR REPLACE FUNCTION get_league_tokens(p_league_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Verify the caller is the league manager
  IF NOT EXISTS(
    SELECT 1 FROM public.leagues WHERE id = p_league_id AND manager_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not the league manager';
  END IF;

  SELECT json_build_object(
    'spectator_token', l.spectator_token,
    'captains', COALESCE(
      (SELECT json_agg(
        json_build_object('id', c.id, 'name', c.name, 'access_token', c.access_token)
        ORDER BY c.draft_position
      ) FROM public.captains c WHERE c.league_id = p_league_id),
      '[]'::json
    ),
    'players', COALESCE(
      (SELECT json_agg(
        json_build_object('id', p.id, 'name', p.name, 'edit_token', p.edit_token)
        ORDER BY p.name
      ) FROM public.players p WHERE p.league_id = p_league_id),
      '[]'::json
    )
  ) INTO result
  FROM public.leagues l
  WHERE l.id = p_league_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- ============================================
-- 2. Index on player_custom_fields(player_id)
-- ============================================
-- Used by RLS policies, validate_player_edit_token RPC, and cascade deletes.
CREATE INDEX IF NOT EXISTS idx_player_custom_fields_player_id
  ON player_custom_fields(player_id);

-- ============================================
-- 3. Revoke DML on audit_logs from client roles
-- ============================================
-- Audit logs are written by edge functions via service_role.
-- Client roles should only have SELECT (already granted by RLS policy).
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon, authenticated;
