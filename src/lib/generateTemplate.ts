import * as XLSX from 'xlsx'
import type { LeagueFieldSchema } from './types'

export function downloadPlayerTemplate(fieldSchemas?: LeagueFieldSchema[]) {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()

  // Build schema field columns
  const sortedSchemas = [...(fieldSchemas || [])].sort((a, b) => a.field_order - b.field_order)
  const schemaHeaders = sortedSchemas.map((s) => s.is_required ? `${s.field_name} *` : s.field_name)

  // Define headers and example data
  const headers = ['Name', 'Height', 'Weight', 'Birthday', 'Hometown', 'Bio', ...schemaHeaders]
  const exampleRow1 = ['John Smith', '6\'2"', '185 lbs', '1995-03-15', 'New York', 'Team captain with 5 years experience', ...schemaHeaders.map(() => '')]
  const exampleRow2 = ['Jane Doe', '5\'8"', '150 lbs', '1998-07-22', 'Los Angeles', '', ...schemaHeaders.map(() => '')]

  const data = [headers, exampleRow1, exampleRow2]

  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 20 }, // Name
    { wch: 10 }, // Height
    { wch: 12 }, // Weight
    { wch: 12 }, // Birthday
    { wch: 15 }, // Hometown
    { wch: 40 }, // Bio
    ...schemaHeaders.map(() => ({ wch: 15 })),
  ]

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Players')

  // Generate and download file
  XLSX.writeFile(workbook, 'player-import-template.xlsx')
}
