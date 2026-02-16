import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useUpdateLeague } from '@/hooks/useLeagues'
import { toDatetimeLocal, fromDatetimeLocal } from '@/lib/draft'
import type { LeagueFullPublic } from '@/lib/types'

const settingsSchema = z.object({
  name: z.string().trim().min(1, 'League name is required').max(100),
  draft_type: z.enum(['snake', 'round_robin']),
  time_limit_seconds: z.coerce.number().min(15).max(1800),
  scheduled_start_at: z.string().optional().nullable(),
  allow_player_custom_fields: z.boolean(),
})

interface LeagueSettingsProps {
  league: LeagueFullPublic
  onOpenFieldSchemas?: () => void
  fieldSchemaCount?: number
}

export function LeagueSettings({
  league,
  onOpenFieldSchemas,
  fieldSchemaCount,
}: LeagueSettingsProps) {
  const updateLeague = useUpdateLeague()
  const { addToast } = useToast()

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
      allow_player_custom_fields: league.allow_player_custom_fields,
    },
  })

  const scheduledValue = watch('scheduled_start_at') // eslint-disable-line react-hooks/incompatible-library

  async function onSubmit(data: {
    name: string
    draft_type: 'snake' | 'round_robin'
    time_limit_seconds: number
    scheduled_start_at?: string | null
    allow_player_custom_fields: boolean
  }) {
    try {
      await updateLeague.mutateAsync({
        id: league.id,
        name: data.name,
        draft_type: data.draft_type,
        time_limit_seconds: data.time_limit_seconds,
        scheduled_start_at: fromDatetimeLocal(data.scheduled_start_at || ''),
        allow_player_custom_fields: data.allow_player_custom_fields,
      })
      addToast('Settings saved', 'success')
    } catch {
      // Error handled by mutation
    }
  }

  function clearScheduledTime() {
    setValue('scheduled_start_at', '', { shouldDirty: true })
  }

  const isEditable = league.status === 'not_started' || league.status === 'paused'

  return (
    <>
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
            <div className="space-y-2">
              <Label htmlFor="name">League Name</Label>
              <Input id="name" {...register('name')} error={!!errors.name} disabled={!isEditable} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
                    aria-label="Clear scheduled time"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Set a time to let participants know when the draft will begin. You will still need
                to manually start the draft.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="allow_player_custom_fields"
                type="checkbox"
                {...register('allow_player_custom_fields')}
                disabled={!isEditable}
                className="mt-1 h-4 w-4 rounded border-border"
              />
              <div>
                <Label htmlFor="allow_player_custom_fields">Allow player custom fields</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, players can add their own custom fields to their profiles.
                </p>
              </div>
            </div>

            {isEditable && (
              <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
                Save Settings
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {onOpenFieldSchemas && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Custom Fields
              {fieldSchemaCount !== undefined && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                  {fieldSchemaCount}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Define custom fields that players fill out in their profiles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={onOpenFieldSchemas}>
              <ListChecks className="mr-2 h-4 w-4" />
              Manage Fields
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
