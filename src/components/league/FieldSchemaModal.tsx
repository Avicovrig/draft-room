import { X } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import { FieldSchemaList } from '@/components/league/FieldSchemaList'
import type { LeagueFullPublic } from '@/lib/types'

interface FieldSchemaModalProps {
  league: LeagueFullPublic
  isOpen: boolean
  onClose: () => void
}

export function FieldSchemaModal({ league, isOpen, onClose }: FieldSchemaModalProps) {
  const { overlayProps } = useModalFocus({ onClose, enabled: isOpen })

  if (!isOpen) return null

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Custom Fields</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close custom fields"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <FieldSchemaList league={league} />
        </div>
      </div>
    </div>
  )
}
