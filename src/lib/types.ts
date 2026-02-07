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
          team_color: string | null
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
          team_color?: string | null
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
          team_color?: string | null
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

// Convenience type aliases
export type League = Database['public']['Tables']['leagues']['Row']
export type LeagueInsert = Database['public']['Tables']['leagues']['Insert']
export type LeagueUpdate = Database['public']['Tables']['leagues']['Update']

export type Captain = Database['public']['Tables']['captains']['Row']
export type CaptainInsert = Database['public']['Tables']['captains']['Insert']
export type CaptainUpdate = Database['public']['Tables']['captains']['Update']

export type Player = Database['public']['Tables']['players']['Row']
export type PlayerInsert = Database['public']['Tables']['players']['Insert']
export type PlayerUpdate = Database['public']['Tables']['players']['Update']

export type DraftPick = Database['public']['Tables']['draft_picks']['Row']
export type DraftPickInsert = Database['public']['Tables']['draft_picks']['Insert']
export type DraftPickUpdate = Database['public']['Tables']['draft_picks']['Update']

export type PlayerCustomField = Database['public']['Tables']['player_custom_fields']['Row']
export type PlayerCustomFieldInsert = Database['public']['Tables']['player_custom_fields']['Insert']
export type PlayerCustomFieldUpdate = Database['public']['Tables']['player_custom_fields']['Update']

export type CaptainDraftQueue = Database['public']['Tables']['captain_draft_queues']['Row']
export type CaptainDraftQueueInsert = Database['public']['Tables']['captain_draft_queues']['Insert']
export type CaptainDraftQueueUpdate = Database['public']['Tables']['captain_draft_queues']['Update']

export type LeagueFieldSchema = Database['public']['Tables']['league_field_schemas']['Row']
export type LeagueFieldSchemaInsert = Database['public']['Tables']['league_field_schemas']['Insert']

// Extended types with relations
export interface LeagueWithCaptains extends League {
  captains: Captain[]
}

export interface LeagueWithPlayers extends League {
  players: Player[]
}

export interface LeagueFull extends League {
  captains: Captain[]
  players: Player[]
  draft_picks: DraftPick[]
}

export interface CaptainWithPlayers extends Captain {
  players: Player[]
}

export interface PlayerWithCustomFields extends Player {
  custom_fields: PlayerCustomField[]
}

