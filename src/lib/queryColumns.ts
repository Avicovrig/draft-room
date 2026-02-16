// Explicit column lists for Supabase queries.
// Token columns (access_token, edit_token, spectator_token) are excluded
// because they are revoked from anon/authenticated roles via column-level grants.

export const LEAGUE_COLUMNS =
  'id, manager_id, name, draft_type, time_limit_seconds, status, current_pick_index, current_pick_started_at, scheduled_start_at, allow_player_custom_fields, created_at, updated_at'

export const CAPTAIN_COLUMNS =
  'id, league_id, name, is_participant, draft_position, player_id, auto_pick_enabled, consecutive_timeout_picks, team_color, team_name, team_photo_url, created_at'

export const PLAYER_COLUMNS =
  'id, league_id, name, drafted_by_captain_id, draft_pick_number, bio, profile_picture_url, created_at'
