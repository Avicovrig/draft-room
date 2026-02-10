import { Check, X as XIcon } from 'lucide-react'
import type { PlayerPublic, PlayerCustomField, LeagueFieldSchema } from '@/lib/types'
import { getInitials } from '@/lib/utils'

interface PlayerProfileViewProps {
  player: PlayerPublic
  customFields?: PlayerCustomField[]
  fieldSchemas?: LeagueFieldSchema[]
}

function formatFieldValue(field: PlayerCustomField, schema?: LeagueFieldSchema): React.ReactNode {
  const value = field.field_value
  if (!value) return '-'
  if (!schema) return value

  switch (schema.field_type) {
    case 'checkbox':
      return value === 'true' ? (
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <XIcon className="h-4 w-4" /> No
        </span>
      )
    case 'number':
      if (schema.field_options?.unit) {
        return `${value} ${schema.field_options.unit}`
      }
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

export function PlayerProfileView({ player, customFields = [], fieldSchemas = [] }: PlayerProfileViewProps) {
  const sortedCustomFields = [...customFields].sort((a, b) => a.field_order - b.field_order)
  const schemaMap = new Map(fieldSchemas.map((s) => [s.id, s]))

  return (
    <div className="space-y-6">
      {/* Profile Picture and Name */}
      <div className="flex items-center gap-4">
        {player.profile_picture_url ? (
          <img
            src={player.profile_picture_url}
            alt={player.name}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-2 ring-border">
            {getInitials(player.name)}
          </div>
        )}
        <div>
          <h3 className="text-xl font-bold">{player.name}</h3>
        </div>
      </div>

      {/* Bio */}
      {player.bio && (
        <div>
          <h4 className="mb-2 font-semibold">About</h4>
          <p className="whitespace-pre-wrap text-muted-foreground">{player.bio}</p>
        </div>
      )}

      {/* Custom Fields */}
      {sortedCustomFields.length > 0 && (
        <div>
          <h4 className="mb-2 font-semibold">Details</h4>
          <dl className="space-y-2">
            {sortedCustomFields.map((field) => {
              const schema = field.schema_id ? schemaMap.get(field.schema_id) : undefined
              return (
                <div key={field.id} className="flex justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground">{field.field_name}</dt>
                  <dd className="font-medium">{formatFieldValue(field, schema)}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      {/* Empty State */}
      {!player.bio && sortedCustomFields.length === 0 && (
        <p className="text-center text-muted-foreground">No profile information available</p>
      )}
    </div>
  )
}
