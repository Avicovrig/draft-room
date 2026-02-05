import * as XLSX from 'xlsx'

export function downloadPlayerTemplate() {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()

  // Define headers and example data
  const data = [
    ['Name', 'Height', 'Weight', 'Birthday', 'Hometown', 'Bio'],
    ['John Smith', '6\'2"', '185 lbs', '1995-03-15', 'New York', 'Team captain with 5 years experience'],
    ['Jane Doe', '5\'8"', '150 lbs', '1998-07-22', 'Los Angeles', ''],
  ]

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
  ]

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Players')

  // Generate and download file
  XLSX.writeFile(workbook, 'player-import-template.xlsx')
}
