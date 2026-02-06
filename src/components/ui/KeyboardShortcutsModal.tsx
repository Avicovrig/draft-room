import { useModalFocus } from '@/hooks/useModalFocus'

interface KeyboardShortcutsModalProps {
  onClose: () => void
}

const shortcuts = [
  { key: '?', description: 'Open keyboard shortcuts' },
  { key: '/', description: 'Focus player search' },
  { key: '↑ ↓', description: 'Navigate player list' },
  { key: 'Enter', description: 'Confirm draft pick' },
  { key: 'Esc', description: 'Clear selection / close modal' },
]

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const { overlayProps } = useModalFocus({ onClose })

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Keyboard Shortcuts</h2>
        <div className="space-y-3">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <kbd className="rounded border border-border bg-muted px-2 py-1 text-xs font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
