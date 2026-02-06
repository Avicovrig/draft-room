export type StandardPlayerField = 'name' | 'bio'

export type PlayerFieldMapping =
  | { type: 'standard'; field: StandardPlayerField }
  | { type: 'custom'; fieldName: string }
  | { type: 'schema'; schemaId: string; fieldName: string }
  | { type: 'skip' }

export interface SpreadsheetData {
  headers: string[]
  rows: string[][]
  fileName: string
}

export interface ParsedPlayer {
  rowNumber: number
  name: string
  bio?: string
  customFields: Array<{ field_name: string; field_value: string; schema_id?: string }>
  isValid: boolean
  errors: string[]
  isSelected: boolean
}

export interface ImportResult {
  success: boolean
  playersCreated: number
  playersSkipped: number
  errors: string[]
}
