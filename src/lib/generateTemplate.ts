import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { LeagueFieldSchema } from './types'

export async function downloadPlayerTemplate(fieldSchemas?: LeagueFieldSchema[]) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Players')

  // Build schema field columns
  const sortedSchemas = [...(fieldSchemas || [])].sort((a, b) => a.field_order - b.field_order)
  const schemaHeaders = sortedSchemas.map((s) =>
    s.is_required ? `${s.field_name} *` : s.field_name
  )

  // Define headers and example data
  const headers = ['Name', 'Bio', ...schemaHeaders]
  const exampleRow1 = [
    'John Smith',
    'Team captain with 5 years experience',
    ...schemaHeaders.map(() => ''),
  ]
  const exampleRow2 = ['Jane Doe', '', ...schemaHeaders.map(() => '')]

  worksheet.addRows([headers, exampleRow1, exampleRow2])

  // Set column widths for better readability
  worksheet.getColumn(1).width = 20 // Name
  worksheet.getColumn(2).width = 40 // Bio
  for (let i = 0; i < schemaHeaders.length; i++) {
    worksheet.getColumn(3 + i).width = 15
  }

  // Bold header row
  worksheet.getRow(1).font = { bold: true }

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), 'player-import-template.xlsx')
}
