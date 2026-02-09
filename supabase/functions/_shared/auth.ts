import { createAdminClient } from './supabase.ts'
import { errorResponse } from './validation.ts'

/**
 * Authenticate the request as a manager of the specified league.
 * Returns { user, league } on success, or a Response (error) on failure.
 */
export async function authenticateManager(
  req: Request,
  leagueId: string
): Promise<{ user: { id: string }; league: Record<string, unknown> } | Response> {
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!authHeader) {
    return errorResponse('Unauthorized', 401, req)
  }

  const supabaseAdmin = createAdminClient()

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

  return { user, league }
}
