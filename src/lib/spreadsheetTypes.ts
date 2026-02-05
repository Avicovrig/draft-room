export type StandardPlayerField = 'name' | 'height' | 'weight' | 'birthday' | 'hometown' | 'bio'

export type PlayerFieldMapping =
  | { type: 'standard'; field: StandardPlayerField }
  | { type: 'custom'; fieldName: string }
  | { type: 'skip' }

export interface SpreadsheetData {
  headers: string[]
  rows: string[][]
  fileName: string
}

export interface ParsedPlayer {
  rowNumber: number
  name: string
  height?: string
  weight?: string
  birthday?: string
  hometown?: string
  bio?: string
  customFields: Array<{ field_name: string; field_value: string }>
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
