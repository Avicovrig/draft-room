import { Select } from '@/components/ui/Select'
import type { PlayerFieldMapping, StandardPlayerField } from '@/lib/spreadsheetTypes'
import type { LeagueFieldSchema } from '@/lib/types'

interface ColumnMapperProps {
  columns: string[]
  mappings: Record<string, PlayerFieldMapping>
  onMappingChange: (column: string, mapping: PlayerFieldMapping) => void
  sampleData: string[][] // First few rows for preview
  fieldSchemas?: LeagueFieldSchema[]
}

const STANDARD_FIELD_LABELS: Record<StandardPlayerField, string> = {
  name: 'Name (Required)',
  height: 'Height',
  weight: 'Weight',
  birthday: 'Birthday',
  hometown: 'Hometown',
  bio: 'Bio',
}

function getMappingValue(mapping: PlayerFieldMapping): string {
  if (mapping.type === 'skip') return 'skip'
  if (mapping.type === 'standard') return `standard:${mapping.field}`
  if (mapping.type === 'schema') return `schema:${mapping.schemaId}`
  return `custom:${mapping.fieldName}`
}

function parseMappingValue(value: string, columnName: string, fieldSchemas?: LeagueFieldSchema[]): PlayerFieldMapping {
  if (value === 'skip') return { type: 'skip' }
  if (value.startsWith('standard:')) {
    const field = value.replace('standard:', '') as StandardPlayerField
    return { type: 'standard', field }
  }
  if (value.startsWith('schema:')) {
    const schemaId = value.replace('schema:', '')
    const schema = fieldSchemas?.find((s) => s.id === schemaId)
    return { type: 'schema', schemaId, fieldName: schema?.field_name || columnName }
  }
  // Custom field - use the column name as the field name
  return { type: 'custom', fieldName: columnName }
}

export function ColumnMapper({
  columns,
  mappings,
  onMappingChange,
  sampleData,
  fieldSchemas = [],
}: ColumnMapperProps) {
  // Check which standard fields are already mapped
  const usedStandardFields = new Set<StandardPlayerField>()
  const usedSchemaIds = new Set<string>()
  Object.values(mappings).forEach((mapping) => {
    if (mapping.type === 'standard') {
      usedStandardFields.add(mapping.field)
    } else if (mapping.type === 'schema') {
      usedSchemaIds.add(mapping.schemaId)
    }
  })

  // Check if name is mapped
  const hasNameMapping = usedStandardFields.has('name')

  return (
    <div className="space-y-4">
      {!hasNameMapping && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          Please map one column to "Name" - this field is required.
        </div>
      )}

      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">
          <div>Spreadsheet Column</div>
          <div>Map To</div>
          <div>Sample Values</div>
        </div>

        <div className="divide-y divide-border">
          {columns.map((column, colIndex) => {
            const mapping = mappings[column] || { type: 'skip' }
            const samples = sampleData
              .slice(0, 3)
              .map((row) => row[colIndex] || '')
              .filter(Boolean)

            return (
              <div
                key={column || `col-${colIndex}`}
                className="grid grid-cols-[1fr,auto,1fr] gap-4 px-4 py-3 items-center"
              >
                <div className="font-medium truncate" title={column}>
                  {column || `Column ${colIndex + 1}`}
                </div>

                <Select
                  value={getMappingValue(mapping)}
                  onChange={(e) => {
                    const newMapping = parseMappingValue(e.target.value, column, fieldSchemas)
                    onMappingChange(column, newMapping)
                  }}
                  className="w-48"
                >
                  <option value="skip">Skip this column</option>
                  <optgroup label="Standard Fields">
                    {(Object.entries(STANDARD_FIELD_LABELS) as [StandardPlayerField, string][]).map(
                      ([field, label]) => {
                        const isUsed = usedStandardFields.has(field)
                        const isCurrentMapping =
                          mapping.type === 'standard' && mapping.field === field
                        return (
                          <option
                            key={field}
                            value={`standard:${field}`}
                            disabled={isUsed && !isCurrentMapping}
                          >
                            {label}
                            {isUsed && !isCurrentMapping ? ' (already mapped)' : ''}
                          </option>
                        )
                      }
                    )}
                  </optgroup>
                  {fieldSchemas.length > 0 && (
                    <optgroup label="League Fields">
                      {fieldSchemas.map((schema) => {
                        const isUsed = usedSchemaIds.has(schema.id)
                        const isCurrentMapping =
                          mapping.type === 'schema' && mapping.schemaId === schema.id
                        return (
                          <option
                            key={schema.id}
                            value={`schema:${schema.id}`}
                            disabled={isUsed && !isCurrentMapping}
                          >
                            {schema.field_name}
                            {schema.is_required ? ' (Required)' : ''}
                            {isUsed && !isCurrentMapping ? ' (already mapped)' : ''}
                          </option>
                        )
                      })}
                    </optgroup>
                  )}
                  <option value={`custom:${column}`}>Custom Field: {column}</option>
                </Select>

                <div className="text-sm text-muted-foreground truncate" title={samples.join(', ')}>
                  {samples.length > 0 ? samples.join(', ') : '(empty)'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
