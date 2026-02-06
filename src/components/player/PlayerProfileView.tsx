import type { Player, PlayerCustomField } from '@/lib/types'

interface PlayerProfileViewProps {
  player: Player
  customFields?: PlayerCustomField[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PlayerProfileView({ player, customFields = [] }: PlayerProfileViewProps) {
  const sortedCustomFields = [...customFields].sort((a, b) => a.field_order - b.field_order)

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
            {sortedCustomFields.map((field) => (
              <div key={field.id} className="flex justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
                <dt className="text-muted-foreground">{field.field_name}</dt>
                <dd className="font-medium">{field.field_value || '-'}</dd>
              </div>
            ))}
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
