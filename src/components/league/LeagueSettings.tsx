import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { useUpdateLeague } from '@/hooks/useLeagues'
import { toDatetimeLocal, fromDatetimeLocal } from '@/lib/draft'
import type { LeagueFull } from '@/lib/types'

const settingsSchema = z.object({
  name: z.string().trim().min(1, 'League name is required').max(100),
  draft_type: z.enum(['snake', 'round_robin']),
  time_limit_seconds: z.coerce.number().min(15).max(1800),
  scheduled_start_at: z.string().optional().nullable(),
})


interface LeagueSettingsProps {
  league: LeagueFull
}

export function LeagueSettings({ league }: LeagueSettingsProps) {
  const updateLeague = useUpdateLeague()
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: league.name,
      draft_type: league.draft_type as 'snake' | 'round_robin',
      time_limit_seconds: league.time_limit_seconds,
      scheduled_start_at: toDatetimeLocal(league.scheduled_start_at),
    },
  })

  const scheduledValue = watch('scheduled_start_at')

  async function onSubmit(data: {
    name: string
    draft_type: 'snake' | 'round_robin'
    time_limit_seconds: number
    scheduled_start_at?: string | null
  }) {
    setSuccess(false)
    try {
      await updateLeague.mutateAsync({
        id: league.id,
        name: data.name,
        draft_type: data.draft_type,
        time_limit_seconds: data.time_limit_seconds,
        scheduled_start_at: fromDatetimeLocal(data.scheduled_start_at || ''),
      })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      // Error handled by mutation
    }
  }

  function clearScheduledTime() {
    setValue('scheduled_start_at', '', { shouldDirty: true })
  }

  const isEditable = league.status === 'not_started' || league.status === 'paused'

  return (
    <Card>
      <CardHeader>
        <CardTitle>League Settings</CardTitle>
        <CardDescription>
          {isEditable
            ? 'Configure your league settings before starting the draft.'
            : 'Settings cannot be changed while a draft is in progress.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {success && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              Settings saved successfully!
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">League Name</Label>
            <Input
              id="name"
              {...register('name')}
              disabled={!isEditable}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft_type">Draft Type</Label>
            <Select id="draft_type" {...register('draft_type')} disabled={!isEditable}>
              <option value="snake">Snake Draft</option>
              <option value="round_robin">Round Robin</option>
            </Select>
            <p className="text-sm text-muted-foreground">
              Snake: Pick order reverses each round. Round Robin: Same order every round.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time_limit_seconds">Time Limit Per Pick</Label>
            <Select
              id="time_limit_seconds"
              {...register('time_limit_seconds')}
              disabled={!isEditable}
            >
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="120">2 minutes</option>
              <option value="300">5 minutes</option>
              <option value="600">10 minutes</option>
              <option value="900">15 minutes</option>
              <option value="1800">30 minutes</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_start_at">Scheduled Start Time (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="scheduled_start_at"
                type="datetime-local"
                {...register('scheduled_start_at')}
                disabled={!isEditable}
                className="flex-1"
              />
              {scheduledValue && isEditable && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={clearScheduledTime}
                  title="Clear scheduled time"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Set a time to let participants know when the draft will begin.
              You will still need to manually start the draft.
            </p>
          </div>

          {isEditable && (
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
