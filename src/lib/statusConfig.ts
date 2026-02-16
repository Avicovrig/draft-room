import type { LeagueStatus } from '@/lib/types'

export const statusConfig: Record<LeagueStatus, { label: string; color: string; dot: string }> = {
  not_started: {
    label: 'Not Started',
    color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    dot: 'bg-yellow-500',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-green-500/10 text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
  },
  paused: {
    label: 'Paused',
    color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
}
