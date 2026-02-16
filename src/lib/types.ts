export type LeagueStatus = 'not_started' | 'in_progress' | 'paused' | 'completed'
export type DraftType = 'snake' | 'round_robin'

export interface Database {
  public: {
    Tables: {
      leagues: {
        Row: {
          id: string
          manager_id: string
          name: string
          spectator_token: string
          draft_type: DraftType
          time_limit_seconds: number
          status: LeagueStatus
          current_pick_index: number
          current_pick_started_at: string | null
          scheduled_start_at: string | null
          allow_player_custom_fields: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          name: string
          spectator_token?: string
          draft_type?: DraftType
          time_limit_seconds?: number
          status?: LeagueStatus
          current_pick_index?: number
          current_pick_started_at?: string | null
          scheduled_start_at?: string | null
          allow_player_custom_fields?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          manager_id?: string
          name?: string
          spectator_token?: string
          draft_type?: DraftType
          time_limit_seconds?: number
          status?: LeagueStatus
          current_pick_index?: number
          current_pick_started_at?: string | null
          scheduled_start_at?: string | null
          allow_player_custom_fields?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      captains: {
        Row: {
          id: string
          league_id: string
          name: string
          is_participant: boolean
          access_token: string
          draft_position: number
          player_id: string | null
          auto_pick_enabled: boolean
          consecutive_timeout_picks: number
          team_color: string | null
          team_name: string | null
          team_photo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          league_id: string
          name: string
          is_participant?: boolean
          access_token?: string
          draft_position: number
          player_id?: string | null
          auto_pick_enabled?: boolean
          consecutive_timeout_picks?: number
          team_color?: string | null
          team_name?: string | null
          team_photo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          name?: string
          is_participant?: boolean
          access_token?: string
          draft_position?: number
          player_id?: string | null
          auto_pick_enabled?: boolean
          consecutive_timeout_picks?: number
          team_color?: string | null
          team_name?: string | null
          team_photo_url?: string | null
          created_at?: string
        }
      }
      players: {
        Row: {
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
        Insert: {
          id?: string
          league_id: string
          name: string
          drafted_by_captain_id?: string | null
          draft_pick_number?: number | null
          bio?: string | null
          profile_picture_url?: string | null
          edit_token?: string
          created_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          name?: string
          drafted_by_captain_id?: string | null
          draft_pick_number?: number | null
          bio?: string | null
          profile_picture_url?: string | null
          edit_token?: string
          created_at?: string
        }
      }
      player_custom_fields: {
        Row: {
          id: string
          player_id: string
          field_name: string
          field_value: string | null
          field_order: number
          schema_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          field_name: string
          field_value?: string | null
          field_order?: number
          schema_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          field_name?: string
          field_value?: string | null
          field_order?: number
          schema_id?: string | null
          created_at?: string
        }
      }
      draft_picks: {
        Row: {
          id: string
          league_id: string
          captain_id: string
          player_id: string
          pick_number: number
          is_auto_pick: boolean
          picked_at: string
        }
        Insert: {
          id?: string
          league_id: string
          captain_id: string
          player_id: string
          pick_number: number
          is_auto_pick?: boolean
          picked_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          captain_id?: string
          player_id?: string
          pick_number?: number
          is_auto_pick?: boolean
          picked_at?: string
        }
      }
      captain_draft_queues: {
        Row: {
          id: string
          captain_id: string
          player_id: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          captain_id: string
          player_id: string
          position: number
          created_at?: string
        }
        Update: {
          id?: string
          captain_id?: string
          player_id?: string
          position?: number
          created_at?: string
        }
      }
      league_field_schemas: {
        Row: {
          id: string
          league_id: string
          field_name: string
          field_type: string
          is_required: boolean
          field_order: number
          field_options: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          league_id: string
          field_name: string
          field_type?: string
          is_required?: boolean
          field_order?: number
          field_options?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          field_name?: string
          field_type?: string
          is_required?: boolean
          field_order?: number
          field_options?: Record<string, unknown> | null
          created_at?: string
        }
      }
    }
  }
}

// Convenience type aliases (Row types used throughout the app)
export type League = Database['public']['Tables']['leagues']['Row']
export type Captain = Database['public']['Tables']['captains']['Row']
export type Player = Database['public']['Tables']['players']['Row']
export type DraftPick = Database['public']['Tables']['draft_picks']['Row']
export type PlayerCustomField = Database['public']['Tables']['player_custom_fields']['Row']
export type CaptainDraftQueue = Database['public']['Tables']['captain_draft_queues']['Row']
export type LeagueFieldSchema = Database['public']['Tables']['league_field_schemas']['Row']

// Public types without sensitive token columns (used by frontend queries)
export type CaptainPublic = Omit<Captain, 'access_token'>
export type PlayerPublic = Omit<Player, 'edit_token'>
export type LeaguePublic = Omit<League, 'spectator_token'>

export interface LeagueWithCounts extends LeaguePublic {
  captains: { id: string }[]
  players: { id: string }[]
}

export interface LeagueFullPublic extends LeaguePublic {
  captains: CaptainPublic[]
  players: PlayerPublic[]
  draft_picks: DraftPick[]
}

export interface PlayerPublicWithCustomFields extends PlayerPublic {
  custom_fields: PlayerCustomField[]
}

// RPC response types
export interface LeagueTokens {
  spectator_token: string
  captains: { id: string; name: string; access_token: string }[]
  players: { id: string; name: string; edit_token: string }[]
}

export interface ValidatedCaptain extends CaptainPublic {
  linked_player_edit_token: string | null
  league_spectator_token: string | null
}

export interface ValidatedPlayerProfile extends PlayerPublicWithCustomFields {
  linked_captain_access_token: string | null
  league_spectator_token: string | null
}
