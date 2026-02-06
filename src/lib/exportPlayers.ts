import * as XLSX from 'xlsx'
import type { Player, Captain, PlayerCustomField, LeagueFieldSchema } from './types'

export function exportPlayersToSpreadsheet(
  leagueName: string,
  players: Player[],
  captains: Captain[],
  customFieldsMap: Record<string, PlayerCustomField[]>,
  fieldSchemas: LeagueFieldSchema[] = []
) {
  // Build set of captain-linked player IDs
  const captainByPlayerId = new Map<string, Captain>()
  for (const c of captains) {
    if (c.player_id) captainByPlayerId.set(c.player_id, c)
  }

  // Schema field columns first (always present, in field_order)
  const sortedSchemas = [...fieldSchemas].sort((a, b) => a.field_order - b.field_order)
  const schemaFieldNames = sortedSchemas.map((s) => s.is_required ? `${s.field_name} *` : s.field_name)
  // Collect freeform custom field names (non-schema, ordered by first appearance)
  const freeformFieldNames: string[] = []
  const seenFields = new Set<string>()
  for (const player of players) {
    const fields = customFieldsMap[player.id] || []
    for (const f of fields) {
      if (!f.schema_id && !seenFields.has(f.field_name)) {
        seenFields.add(f.field_name)
        freeformFieldNames.push(f.field_name)
      }
    }
  }

  // Build headers: standard + schema + freeform
  const headers = ['Name', 'Status', 'Height', 'Weight', 'Birthday', 'Hometown', 'Bio', ...schemaFieldNames, ...freeformFieldNames]

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

    const playerFields = customFieldsMap[player.id] || []

    // Schema field values (by schema_id)
    const schemaValues = sortedSchemas.map((schema) => {
      const field = playerFields.find((f) => f.schema_id === schema.id)
      return field?.field_value || ''
    })

    // Freeform field values (non-schema)
    const freeformValues = freeformFieldNames.map((fieldName) => {
      const field = playerFields.find((f) => !f.schema_id && f.field_name === fieldName)
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
      ...schemaValues,
      ...freeformValues,
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
    ...schemaFieldNames.map(() => ({ wch: 15 })),
    ...freeformFieldNames.map(() => ({ wch: 15 })),
  ]

  // Create workbook and download
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Players')

  const safeName = leagueName.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-')
  XLSX.writeFile(workbook, `${safeName}-players.xlsx`)
}
