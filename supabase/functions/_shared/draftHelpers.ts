import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Roll back a recorded pick: delete the pick row and optionally reset the player. */
export async function rollbackPick(
  supabase: SupabaseClient,
  leagueId: string,
  pickNumber: number,
  playerId: string,
  resetPlayer: boolean
): Promise<void> {
  const { error: rb1 } = await supabase
    .from('draft_picks')
    .delete()
    .eq('league_id', leagueId)
    .eq('pick_number', pickNumber)
  if (rb1) console.error('CRITICAL: Rollback failed (delete pick):', { leagueId, pickNumber, rb1 })
  if (resetPlayer) {
    const { error: rb2 } = await supabase
      .from('players')
      .update({ drafted_by_captain_id: null, draft_pick_number: null })
      .eq('id', playerId)
    if (rb2) console.error('CRITICAL: Rollback failed (reset player):', { leagueId, playerId, rb2 })
  }
}

/** Advance the league to the next pick, or mark complete. Uses optimistic locking. */
export async function advanceLeague(
  supabase: SupabaseClient,
  leagueId: string,
  currentPickIndex: number,
  isComplete: boolean
): Promise<{ success: boolean; error?: unknown }> {
  const { data, error } = await supabase
    .from('leagues')
    .update({
      status: isComplete ? 'completed' : 'in_progress',
      current_pick_index: isComplete ? currentPickIndex : currentPickIndex + 1,
      current_pick_started_at: isComplete ? null : new Date().toISOString(),
    })
    .eq('id', leagueId)
    .eq('current_pick_index', currentPickIndex)
    .select('id')

  if (error) return { success: false, error }
  if (!data || data.length === 0) return { success: false }
  return { success: true }
}
