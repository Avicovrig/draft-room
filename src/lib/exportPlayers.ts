import type { PlayerPublic, CaptainPublic, PlayerCustomField, LeagueFieldSchema } from './types'

function formatExportValue(value: string, schema: LeagueFieldSchema): string {
  switch (schema.field_type) {
    case 'checkbox':
      return value === 'true' ? 'Yes' : 'No'
    case 'number':
      if (schema.field_options?.unit) return `${value} ${schema.field_options.unit}`
      return value
    case 'date': {
      const date = new Date(value)
      if (isNaN(date.getTime())) return value
      return schema.field_options?.includeTime
        ? date.toLocaleString()
        : date.toLocaleDateString()
    }
    default:
      return value
  }
}

export async function exportPlayersToSpreadsheet(
  leagueName: string,
  players: PlayerPublic[],
  captains: CaptainPublic[],
  customFieldsMap: Record<string, PlayerCustomField[]>,
  fieldSchemas: LeagueFieldSchema[] = []
) {
  const XLSX = await import('xlsx')

  // Build set of captain-linked player IDs
  const captainByPlayerId = new Map<string, CaptainPublic>()
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
  const headers = ['Name', 'Status', 'Bio', ...schemaFieldNames, ...freeformFieldNames]

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

    // Schema field values (by schema_id), formatted by type
    const schemaValues = sortedSchemas.map((schema) => {
      const field = playerFields.find((f) => f.schema_id === schema.id)
      const value = field?.field_value || ''
      if (!value) return ''
      return formatExportValue(value, schema)
    })

    // Freeform field values (non-schema)
    const freeformValues = freeformFieldNames.map((fieldName) => {
      const field = playerFields.find((f) => !f.schema_id && f.field_name === fieldName)
      return field?.field_value || ''
    })

    return [
      player.name,
      status,
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
