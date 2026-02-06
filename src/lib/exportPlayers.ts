import * as XLSX from 'xlsx'
import type { Player, Captain, PlayerCustomField } from './types'

export function exportPlayersToSpreadsheet(
  leagueName: string,
  players: Player[],
  captains: Captain[],
  customFieldsMap: Record<string, PlayerCustomField[]>
) {
  // Build set of captain-linked player IDs
  const captainByPlayerId = new Map<string, Captain>()
  for (const c of captains) {
    if (c.player_id) captainByPlayerId.set(c.player_id, c)
  }

  // Collect all unique custom field names (ordered by first appearance)
  const customFieldNames: string[] = []
  const seenFields = new Set<string>()
  for (const player of players) {
    const fields = customFieldsMap[player.id] || []
    for (const f of fields) {
      if (!seenFields.has(f.field_name)) {
        seenFields.add(f.field_name)
        customFieldNames.push(f.field_name)
      }
    }
  }

  // Build headers
  const headers = ['Name', 'Status', 'Height', 'Weight', 'Birthday', 'Hometown', 'Bio', ...customFieldNames]

  // Build rows
  const rows = players.map((player) => {
    // Determine status
    let status: string
    if (captainByPlayerId.has(player.id)) {
      status = 'Captain'
    } else if (player.drafted_by_captain_id) {
      const captain = captains.find((c) => c.id === player.drafted_by_captain_id)
      status = captain ? `Drafted by ${captain.name}` : 'Drafted'
    } else {
      status = 'Available'
    }

    // Build custom field values in the same order as headers
    const customValues = customFieldNames.map((fieldName) => {
      const fields = customFieldsMap[player.id] || []
      const field = fields.find((f) => f.field_name === fieldName)
      return field?.field_value || ''
    })

    return [
      player.name,
      status,
      player.height || '',
      player.weight || '',
      player.birthday || '',
      player.hometown || '',
      player.bio || '',
      ...customValues,
    ]
  })

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Set column widths
  worksheet['!cols'] = [
    { wch: 20 }, // Name
    { wch: 18 }, // Status
    { wch: 10 }, // Height
    { wch: 12 }, // Weight
    { wch: 12 }, // Birthday
    { wch: 15 }, // Hometown
    { wch: 40 }, // Bio
    ...customFieldNames.map(() => ({ wch: 15 })),
  ]

  // Create workbook and download
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Players')

  const safeName = leagueName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-')
  XLSX.writeFile(workbook, `${safeName}-players.xlsx`)
}
