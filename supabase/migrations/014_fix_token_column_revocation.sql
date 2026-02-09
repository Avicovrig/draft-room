-- ============================================
-- FIX TOKEN COLUMN REVOCATION
-- ============================================
-- Column-level REVOKE doesn't work when table-level SELECT is granted.
-- Must revoke table-level SELECT first, then re-grant on specific columns.

-- === LEAGUES: hide spectator_token ===
REVOKE SELECT ON leagues FROM anon, authenticated;
GRANT SELECT (id, manager_id, name, draft_type, time_limit_seconds, status, current_pick_index, current_pick_started_at, scheduled_start_at, allow_player_custom_fields, created_at, updated_at) ON leagues TO anon, authenticated;

-- === CAPTAINS: hide access_token ===
REVOKE SELECT ON captains FROM anon, authenticated;
GRANT SELECT (id, league_id, name, is_participant, draft_position, player_id, auto_pick_enabled, team_color, team_name, team_photo_url, created_at) ON captains TO anon, authenticated;

-- === PLAYERS: hide edit_token ===
REVOKE SELECT ON players FROM anon, authenticated;
GRANT SELECT (id, league_id, name, drafted_by_captain_id, draft_pick_number, bio, profile_picture_url, created_at) ON players TO anon, authenticated;

-- Ensure INSERT/UPDATE/DELETE still work (these don't expose token columns to reads)
-- The existing RLS policies control row-level access; column grants control column-level access.
-- INSERT needs column-level grants too for the columns being inserted.
GRANT INSERT ON leagues TO authenticated;
GRANT UPDATE ON leagues TO authenticated;
GRANT DELETE ON leagues TO authenticated;

GRANT INSERT ON captains TO authenticated;
GRANT UPDATE ON captains TO authenticated;
GRANT DELETE ON captains TO authenticated;

GRANT INSERT ON players TO authenticated;
GRANT UPDATE ON players TO authenticated;
GRANT DELETE ON players TO authenticated;

-- anon role needs INSERT/UPDATE/DELETE for RLS-controlled operations
GRANT INSERT ON captains TO anon;
GRANT UPDATE ON captains TO anon;
GRANT DELETE ON captains TO anon;

GRANT INSERT ON players TO anon;
GRANT UPDATE ON players TO anon;
GRANT DELETE ON players TO anon;
