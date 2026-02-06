import { useMemo } from 'react'
import { CheckCircle2, XCircle, AlertCircle, ClipboardCheck } from 'lucide-react'
import { formatScheduledTime } from '@/lib/draft'
import type { LeagueFull, LeagueFieldSchema, PlayerCustomField } from '@/lib/types'

type Status = 'pass' | 'fail' | 'warn'

interface ChecklistItem {
  id: string
  label: string
  status: Status
  detail: string
}

interface DraftReadinessChecklistProps {
  league: LeagueFull
  fieldSchemas: LeagueFieldSchema[]
  customFieldsMap: Record<string, PlayerCustomField[]> | undefined
}

const statusIcon: Record<Status, typeof CheckCircle2> = {
  pass: CheckCircle2,
  fail: XCircle,
  warn: AlertCircle,
}

const statusColor: Record<Status, string> = {
  pass: 'text-green-600 dark:text-green-400',
  fail: 'text-destructive',
  warn: 'text-yellow-600 dark:text-yellow-400',
}

export function DraftReadinessChecklist({ league, fieldSchemas, customFieldsMap }: DraftReadinessChecklistProps) {
  const items = useMemo(() => {
    const result: ChecklistItem[] = []

    // 1. Captains added (blocking)
    const captainCount = league.captains.length
    result.push({
      id: 'captains',
      label: 'Captains added',
      status: captainCount >= 2 ? 'pass' : 'fail',
      detail: captainCount >= 2
        ? `${captainCount} captains ready`
        : `Need at least 2 captains (${captainCount} added)`,
    })

    // 2. Enough players (blocking)
    const playerCount = league.players.length
    result.push({
      id: 'players',
      label: 'Enough players',
      status: playerCount >= captainCount ? 'pass' : 'fail',
      detail: playerCount >= captainCount
        ? `${playerCount} players for ${captainCount} captains`
        : `Need at least ${captainCount} players (${playerCount} added)`,
    })

    // 3. Player profiles complete (warning, only if required schemas exist)
    const requiredSchemas = fieldSchemas.filter(s => s.is_required)
    if (requiredSchemas.length > 0 && customFieldsMap !== undefined) {
      let incompleteCount = 0
      for (const player of league.players) {
        const playerFields = customFieldsMap[player.id] || []
        const hasAll = requiredSchemas.every(schema => {
          const field = playerFields.find(f => f.schema_id === schema.id)
          return field && field.field_value && field.field_value.trim() !== ''
        })
        if (!hasAll) incompleteCount++
      }

      result.push({
        id: 'profiles',
        label: 'Player profiles complete',
        status: incompleteCount === 0 ? 'pass' : 'warn',
        detail: incompleteCount === 0
          ? 'All profiles complete'
          : `${incompleteCount} player${incompleteCount === 1 ? '' : 's'} missing required fields`,
      })
    }

    // 4. Scheduled start time (info)
    result.push({
      id: 'schedule',
      label: 'Scheduled start time',
      status: league.scheduled_start_at ? 'pass' : 'warn',
      detail: league.scheduled_start_at
        ? formatScheduledTime(league.scheduled_start_at)
        : 'No start time scheduled',
    })

    return result
  }, [league, fieldSchemas, customFieldsMap])

  const allBlockingPass = items.every(i => i.status !== 'fail')

  return (
    <div className={`mt-4 rounded-lg border p-4 ${
      allBlockingPass
        ? 'border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20'
        : 'border-border bg-card'
    }`}>
      <div className="mb-2 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Draft Readiness</span>
        {allBlockingPass && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Ready
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {items.map(item => {
          const Icon = statusIcon[item.status]
          return (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <Icon className={`h-4 w-4 shrink-0 ${statusColor[item.status]}`} />
              <span className="font-medium">{item.label}</span>
              <span className="ml-auto text-muted-foreground">{item.detail}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
