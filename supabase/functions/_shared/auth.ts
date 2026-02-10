import { createAdminClient } from './supabase.ts'
import { errorResponse } from './validation.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** League row fields returned by authenticateManager (scalar columns only, no relations). */
export interface LeagueRow {
  id: string
  name: string
  manager_id: string
  status: string
  draft_type: string
  current_pick_index: number
  current_pick_started_at: string | null
  time_limit_seconds: number
  spectator_token: string
  [key: string]: unknown
}

/**
 * Authenticate the request as a manager of the specified league.
 * Accepts an optional Supabase admin client to avoid creating a duplicate instance.
 * Returns { user, league } on success, or a Response (error) on failure.
 */
export async function authenticateManager(
  req: Request,
  leagueId: string,
  existingClient?: SupabaseClient
): Promise<{ user: { id: string }; league: LeagueRow } | Response> {
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!authHeader) {
    return errorResponse('Unauthorized', 401, req)
  }

  const supabaseAdmin = existingClient ?? createAdminClient()

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader)
  if (authError || !user) {
    return errorResponse('Unauthorized', 401, req)
  }

  const { data: league, error: leagueError } = await supabaseAdmin
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (leagueError || !league) {
    return errorResponse('League not found', 404, req)
  }

  if (league.manager_id !== user.id) {
    return errorResponse('Forbidden', 403, req)
  }

  return { user, league: league as LeagueRow }
}
