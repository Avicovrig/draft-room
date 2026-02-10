import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { LeagueFullPublic } from './types'

export function formatPickTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  return `${Math.round(seconds)}s`
}

export async function exportDraftResults(league: LeagueFullPublic): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sortedCaptains = [...league.captains].sort((a, b) => a.draft_position - b.draft_position)
  const captainCount = league.captains.length
  const sortedPicks = [...league.draft_picks].sort((a, b) => a.pick_number - b.pick_number)

  // --- Sheet 1: Team Rosters ---
  const rosterSheet = workbook.addWorksheet('Team Rosters')
  const rosterRows: (string | number)[][] = [['Player', 'Pick #', 'Type']]

  for (let i = 0; i < sortedCaptains.length; i++) {
    const captain = sortedCaptains[i]
    if (i > 0) rosterRows.push([]) // blank row between teams

    rosterRows.push([`Team: ${captain.team_name || captain.name}`, '', ''])

    if (captain.is_participant) {
      rosterRows.push([captain.name, '', 'Captain'])
    }

    const players = league.players
      .filter((p) => p.drafted_by_captain_id === captain.id)
      .sort((a, b) => (a.draft_pick_number ?? 0) - (b.draft_pick_number ?? 0))

    for (const player of players) {
      const pick = league.draft_picks.find((p) => p.player_id === player.id)
      rosterRows.push([
        player.name,
        player.draft_pick_number ?? '',
        pick?.is_auto_pick ? 'Auto' : 'Manual',
      ])
    }
  }

  rosterSheet.addRows(rosterRows)
  rosterSheet.getColumn(1).width = 25
  rosterSheet.getColumn(2).width = 8
  rosterSheet.getColumn(3).width = 10
  rosterSheet.getRow(1).font = { bold: true }

  // --- Sheet 2: Pick History ---
  const historySheet = workbook.addWorksheet('Pick History')
  const historyRows: (string | number)[][] = [['Pick', 'Round', 'Captain', 'Player', 'Type', 'Time']]

  for (const pick of sortedPicks) {
    const round = Math.floor((pick.pick_number - 1) / captainCount) + 1
    const captain = league.captains.find((c) => c.id === pick.captain_id)
    const player = league.players.find((p) => p.id === pick.player_id)
    const time = new Date(pick.picked_at).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })

    historyRows.push([
      pick.pick_number,
      round,
      captain?.team_name || captain?.name || 'Unknown',
      player?.name ?? 'Unknown',
      pick.is_auto_pick ? 'Auto' : 'Manual',
      time,
    ])
  }

  historySheet.addRows(historyRows)
  historySheet.getColumn(1).width = 6
  historySheet.getColumn(2).width = 7
  historySheet.getColumn(3).width = 20
  historySheet.getColumn(4).width = 20
  historySheet.getColumn(5).width = 8
  historySheet.getColumn(6).width = 10
  historySheet.getRow(1).font = { bold: true }

  // --- Sheet 3: Summary ---
  const summarySheet = workbook.addWorksheet('Summary')
  const totalPicks = league.draft_picks.length
  const totalRounds = captainCount > 0 ? Math.ceil(totalPicks / captainCount) : 0
  const totalAutoPicks = league.draft_picks.filter((p) => p.is_auto_pick).length
  const autoPickRate = totalPicks > 0 ? ((totalAutoPicks / totalPicks) * 100).toFixed(1) : '0'

  // Avg pick time (same logic as Summary.tsx)
  let avgPickTimeStr = '—'
  if (sortedPicks.length > 1) {
    const deltas: number[] = []
    for (let i = 1; i < sortedPicks.length; i++) {
      const delta = (new Date(sortedPicks[i].picked_at).getTime() - new Date(sortedPicks[i - 1].picked_at).getTime()) / 1000
      if (delta > 0 && delta < league.time_limit_seconds * 2) {
        deltas.push(delta)
      }
    }
    if (deltas.length > 0) {
      const avg = deltas.reduce((sum, d) => sum + d, 0) / deltas.length
      avgPickTimeStr = formatPickTime(avg)
    }
  }

  const summaryRows: (string | number)[][] = [
    ['League', league.name],
    ['Draft Type', league.draft_type === 'snake' ? 'Snake' : 'Round Robin'],
    ['Total Picks', totalPicks],
    ['Rounds', totalRounds],
    ['Teams', captainCount],
    ['Auto Picks', `${totalAutoPicks} (${autoPickRate}%)`],
    ['Avg Pick Time', avgPickTimeStr],
  ]

  summarySheet.addRows(summaryRows)
  summarySheet.getColumn(1).width = 15
  summarySheet.getColumn(2).width = 25

  // Download
  const safeName = league.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-')
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), `${safeName}-draft-results.xlsx`)
}
