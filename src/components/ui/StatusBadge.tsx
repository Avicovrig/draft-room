import { cn } from '@/lib/utils'
import { statusConfig } from '@/lib/statusConfig'
import type { LeagueStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: LeagueStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  )
}

export function StatusDot({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', config.dot, className)}
      aria-label={config.label}
    />
  )
}
