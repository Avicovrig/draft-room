import { cn } from '@/lib/utils'

interface FilterOption<T extends string> {
  value: T
  label: string
}

interface FilterPillsProps<T extends string> {
  options: FilterOption<T>[]
  selected: T
  onChange: (value: T) => void
  ariaLabel: string
}

export function FilterPills<T extends string>({
  options,
  selected,
  onChange,
  ariaLabel,
}: FilterPillsProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-2 overflow-x-auto scrollbar-hide">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={selected === option.value}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            selected === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
