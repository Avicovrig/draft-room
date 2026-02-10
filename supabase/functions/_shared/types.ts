// Shared type definitions for edge functions.
// These mirror database entities used across multiple functions.

export interface Captain {
  id: string
  league_id: string
  name: string
  draft_position: number
  player_id: string | null
  access_token: string
  auto_pick_enabled: boolean
  team_color: string | null
  team_name: string | null
  team_photo_url: string | null
  is_participant: boolean
  created_at: string
}

export interface Player {
  id: string
  league_id: string
  name: string
  drafted_by_captain_id: string | null
  draft_pick_number: number | null
  bio: string | null
  profile_picture_url: string | null
  edit_token: string
  created_at: string
}

export interface DraftPick {
  id: string
  league_id: string
  captain_id: string
  player_id: string
  pick_number: number
  is_auto_pick: boolean
  picked_at: string
}

export interface League {
  id: string
  name: string
  manager_id: string
  status: string
  draft_type: string
  current_pick_index: number
  current_pick_started_at: string | null
  time_limit_seconds: number
  spectator_token: string
  captains: Captain[]
  players: Player[]
  draft_picks: DraftPick[]
}

export interface MakePickRequest {
  leagueId: string
  captainId: string
  playerId: string
  captainToken?: string
}

export interface AutoPickRequest {
  leagueId: string
  expectedPickIndex?: number
  captainToken?: string
}

export interface ToggleAutoPickRequest {
  captainId: string
  enabled: boolean
  captainToken?: string
  leagueId: string
}

export interface UpdateCaptainColorRequest {
  captainId: string
  captainToken?: string
  leagueId: string
  color?: string | null
  teamName?: string | null
  teamPhotoUrl?: string | null
  teamPhotoBlob?: string // base64-encoded JPEG for captain-side uploads
}

export interface UpdatePlayerProfileRequest {
  playerId: string
  editToken: string
  bio?: string | null
  profile_picture_url?: string | null
  profilePictureBlob?: string // base64-encoded JPEG for token-based uploads
  customFields?: Array<{
    id?: string
    field_name: string
    field_value: string | null
    field_order: number
    schema_id?: string | null
  }>
  deletedCustomFieldIds?: string[]
}
