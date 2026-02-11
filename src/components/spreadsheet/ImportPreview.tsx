import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParsedPlayer } from '@/lib/spreadsheetTypes'

interface ImportPreviewProps {
  players: ParsedPlayer[]
  onToggleRow: (index: number) => void
}

export function ImportPreview({ players, onToggleRow }: ImportPreviewProps) {
  const validCount = players.filter((p) => p.isValid && p.isSelected).length
  const invalidCount = players.filter((p) => !p.isValid).length
  const deselectedCount = players.filter((p) => p.isValid && !p.isSelected).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>{validCount} players will be imported</span>
        </div>
        {invalidCount > 0 && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{invalidCount} rows with errors</span>
          </div>
        )}
        {deselectedCount > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{deselectedCount} rows deselected</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Include</th>
              <th className="px-3 py-2 text-left font-medium">Row</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Bio</th>
              <th className="px-3 py-2 text-left font-medium">Custom Fields</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {players.map((player, index) => (
              <tr
                key={index}
                className={cn(
                  !player.isValid && 'bg-destructive/10',
                  !player.isSelected && player.isValid && 'opacity-50'
                )}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={player.isSelected}
                    onChange={() => onToggleRow(index)}
                    disabled={!player.isValid}
                    className="h-4 w-4 rounded border-border"
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">{player.rowNumber}</td>
                <td className="px-3 py-2 font-medium">
                  {player.name || <span className="text-destructive italic">Missing</span>}
                </td>
                <td className="px-3 py-2">{player.bio || '-'}</td>
                <td className="px-3 py-2">
                  {player.customFields.length > 0 ? (
                    <span className="text-muted-foreground">
                      {player.customFields.length} field
                      {player.customFields.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-3 py-2">
                  {player.isValid ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Valid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {player.errors.join(', ')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
