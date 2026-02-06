import { X } from 'lucide-react'
import { PlayerProfileView } from './PlayerProfileView'
import { useModalFocus } from '@/hooks/useModalFocus'
import type { Player, PlayerCustomField } from '@/lib/types'

interface PlayerProfileModalProps {
  player: Player
  customFields?: PlayerCustomField[]
  onClose: () => void
}

export function PlayerProfileModal({ player, customFields = [], onClose }: PlayerProfileModalProps) {
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
          <PlayerProfileView player={player} customFields={customFields} />
        </div>
      </div>
    </div>
  )
}
