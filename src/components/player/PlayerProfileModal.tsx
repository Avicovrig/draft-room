import { X, StickyNote } from 'lucide-react'
import { PlayerProfileView } from './PlayerProfileView'
import { useModalFocus } from '@/hooks/useModalFocus'
import type { Player, PlayerCustomField } from '@/lib/types'

interface PlayerProfileModalProps {
  player: Player
  customFields?: PlayerCustomField[]
  note?: string
  onClose: () => void
}

export function PlayerProfileModal({ player, customFields = [], note, onClose }: PlayerProfileModalProps) {
  const { overlayProps } = useModalFocus({ onClose })

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-lg border border-border bg-background shadow-lg">
        {/* Sticky header with close button */}
        <div className="flex items-center justify-end border-b border-border p-2">
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {note && (
            <div className="mb-4 rounded-lg bg-yellow-50/50 p-3 dark:bg-yellow-950/20">
              <div className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="whitespace-pre-wrap">{note}</p>
              </div>
            </div>
          )}
          <PlayerProfileView player={player} customFields={customFields} />
        </div>
      </div>
    </div>
  )
}
