-- Add league_spectator_token to validate_captain_token RPC response
-- Allows captains to share the spectator link from the draft view
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
    ),
    'league_spectator_token', (
      SELECT l.spectator_token FROM leagues l WHERE l.id = c.league_id
    )
  ) INTO result
  FROM captains c
  WHERE c.league_id = p_league_id AND c.access_token = p_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
