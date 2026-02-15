import type { SupabaseClient } from '@supabase/supabase-js'

export interface LeagueTokens {
  spectator_token: string
  captains: { id: string; name: string; access_token: string }[]
  players: { id: string; name: string; edit_token: string }[]
}

export async function getLeagueTokens(
  supabase: SupabaseClient,
  leagueId: string,
  managerEmail: string,
  managerPassword: string
): Promise<LeagueTokens> {
  // Sign in as manager to call the RPC (it checks auth.uid())
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: managerEmail,
    password: managerPassword,
  })
  if (authError) throw new Error(`Auth failed: ${authError.message}`)

  const { data, error } = await supabase.rpc('get_league_tokens', {
    p_league_id: leagueId,
  })
  if (error) throw new Error(`get_league_tokens failed: ${error.message}`)

  return data as LeagueTokens
}
