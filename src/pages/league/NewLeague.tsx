import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { useCreateLeague } from '@/hooks/useLeagues'

const createLeagueSchema = z.object({
  name: z.string().trim().min(1, 'League name is required').max(100, 'Name is too long'),
  draft_type: z.enum(['snake', 'round_robin']),
  time_limit_seconds: z.coerce.number().min(15).max(1800),
})


export function NewLeague() {
  const navigate = useNavigate()
  const createLeague = useCreateLeague()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createLeagueSchema),
    defaultValues: {
      name: '',
      draft_type: 'snake' as const,
      time_limit_seconds: 60,
    },
  })

  async function onSubmit(data: { name: string; draft_type: 'snake' | 'round_robin'; time_limit_seconds: number }) {
    setError(null)
    try {
      const league = await createLeague.mutateAsync(data)
      navigate(`/league/${league.id}/manage`)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('duplicate')) {
          setError('You already have a league with this name')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to create league')
      }
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-6 sm:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Create a New League</CardTitle>
            <CardDescription>
              Set up your league basics. You can add players and captains after creating the league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">League Name</Label>
                <Input
                  id="name"
                  placeholder="My Awesome League"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="draft_type">Draft Type</Label>
                <Select id="draft_type" {...register('draft_type')}>
                  <option value="snake">Snake Draft</option>
                  <option value="round_robin">Round Robin</option>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Snake: Pick order reverses each round (1,2,3,4,4,3,2,1...)
                  <br />
                  Round Robin: Same order every round (1,2,3,4,1,2,3,4...)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_limit_seconds">Time Limit Per Pick</Label>
                <Select id="time_limit_seconds" {...register('time_limit_seconds')}>
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                  <option value="600">10 minutes</option>
                  <option value="900">15 minutes</option>
                  <option value="1800">30 minutes</option>
                </Select>
                <p className="text-sm text-muted-foreground">
                  If a captain doesn't pick in time, a random player will be selected.
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create League'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
