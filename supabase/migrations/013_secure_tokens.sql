-- ============================================
-- SECURE TOKEN COLUMNS
-- ============================================
-- Revoke direct SELECT on token columns from client-facing roles.
-- Edge functions use the service_role which bypasses these restrictions.

REVOKE SELECT (access_token) ON captains FROM anon, authenticated;
REVOKE SELECT (edit_token) ON players FROM anon, authenticated;
REVOKE SELECT (spectator_token) ON leagues FROM anon, authenticated;

-- ============================================
-- TOKEN VALIDATION RPCs (SECURITY DEFINER)
-- ============================================
-- These functions run as the owner (postgres) and can access revoked columns.

-- Validate a captain access token and return the captain row (without token).
-- Also returns linked player's edit_token for cross-navigation to profile edit.
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
      SELECT p.edit_token FROM players p WHERE p.id = c.player_id
    )
  ) INTO result
  FROM captains c
  WHERE c.league_id = p_league_id AND c.access_token = p_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Validate a spectator token.
CREATE OR REPLACE FUNCTION validate_spectator_token(p_league_id uuid, p_token uuid)
RETURNS boolean AS $$
  SELECT EXISTS(
    SELECT 1 FROM leagues WHERE id = p_league_id AND spectator_token = p_token
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Validate a player edit token and return the player row (without token) plus custom fields.
-- Also returns navigation tokens for "Go to Draft" functionality.
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
      ) FROM player_custom_fields cf WHERE cf.player_id = p.id),
      '[]'::json
    ),
    'linked_captain_access_token', (
      SELECT c.access_token FROM captains c WHERE c.player_id = p.id AND c.league_id = p.league_id
    ),
    'league_spectator_token', (
      SELECT l.spectator_token FROM leagues l WHERE l.id = p.league_id
    )
  ) INTO result
  FROM players p
  WHERE p.id = p_player_id AND p.edit_token = p_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all tokens for a league (manager only).
CREATE OR REPLACE FUNCTION get_league_tokens(p_league_id uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Verify the caller is the league manager
  IF NOT EXISTS(
    SELECT 1 FROM leagues WHERE id = p_league_id AND manager_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: not the league manager';
  END IF;

  SELECT json_build_object(
    'spectator_token', l.spectator_token,
    'captains', COALESCE(
      (SELECT json_agg(
        json_build_object('id', c.id, 'name', c.name, 'access_token', c.access_token)
        ORDER BY c.draft_position
      ) FROM captains c WHERE c.league_id = p_league_id),
      '[]'::json
    ),
    'players', COALESCE(
      (SELECT json_agg(
        json_build_object('id', p.id, 'name', p.name, 'edit_token', p.edit_token)
        ORDER BY p.name
      ) FROM players p WHERE p.league_id = p_league_id),
      '[]'::json
    )
  ) INTO result
  FROM leagues l
  WHERE l.id = p_league_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute on RPCs to client-facing roles
GRANT EXECUTE ON FUNCTION validate_captain_token(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_spectator_token(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_player_edit_token(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_league_tokens(uuid) TO authenticated;

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  league_id uuid REFERENCES leagues(id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  actor_id text,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_logs_league_id ON audit_logs(league_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view audit logs for their leagues"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      WHERE leagues.id = audit_logs.league_id
      AND leagues.manager_id = auth.uid()
    )
  );
