import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewToggleProps {
  view: 'grid' | 'list'
  onViewChange: (v: 'grid' | 'list') => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div role="radiogroup" aria-label="View mode" className="flex rounded-md border border-input">
      <button
        type="button"
        role="radio"
        aria-checked={view === 'grid'}
        aria-label="Grid view"
        onClick={() => onViewChange('grid')}
        className={cn(
          'flex items-center justify-center rounded-l-md p-2 transition-colors',
          view === 'grid'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === 'list'}
        aria-label="List view"
        onClick={() => onViewChange('list')}
        className={cn(
          'flex items-center justify-center rounded-r-md p-2 transition-colors',
          view === 'list'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  )
}
