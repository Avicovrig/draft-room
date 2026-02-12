import { Check } from 'lucide-react'
import { TEAM_COLORS } from '@/lib/colors'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const normalizedValue = value.toUpperCase()

  return (
    <div className="flex flex-wrap gap-1.5">
      {TEAM_COLORS.map((color) => {
        const isSelected = normalizedValue === color.hex.toUpperCase()
        const isLight =
          color.hex === '#FFFFFF' ||
          color.hex === '#D1D5DB' ||
          color.hex === '#FACC15' ||
          color.hex === '#86EFAC' ||
          color.hex === '#93C5FD' ||
          color.hex === '#C4B5FD'

        return (
          <button
            key={color.hex}
            type="button"
            title={color.name}
            onClick={() => onChange(color.hex)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110',
              isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              color.hex === '#FFFFFF' && 'border border-border'
            )}
            style={{ backgroundColor: color.hex }}
          >
            {isSelected && (
              <Check className={cn('h-3.5 w-3.5', isLight ? 'text-gray-800' : 'text-white')} />
            )}
          </button>
        )
      })}
    </div>
  )
}
