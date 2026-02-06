import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Trophy, Users, Zap, Clock, Share2, Check } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Confetti } from '@/components/ui/Confetti'
import { useDraft } from '@/hooks/useDraft'
import { useAuth } from '@/context/AuthContext'
import { playSound, resumeAudioContext } from '@/lib/sounds'
import type { Captain, Player } from '@/lib/types'

export function Summary() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [showConfetti, setShowConfetti] = useState(false)
  const [copied, setCopied] = useState(false)

  const { league, isLoading, error } = useDraft(id)

  // Play celebration when draft is complete
  useEffect(() => {
    if (league?.status === 'completed') {
      setShowConfetti(true)
      // Resume audio context and play sound
      resumeAudioContext()
      playSound('draftComplete')
    }
  }, [league?.status])

  async function handleCopyLink() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      console.error('Failed to copy link')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading summary...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            {error?.message || 'League not found'}
          </div>
        </main>
      </div>
    )
  }

  const isManager = league.manager_id === user?.id
  const sortedCaptains = [...league.captains].sort(
    (a, b) => a.draft_position - b.draft_position
  )

  function getPlayersForCaptain(captainId: string): Player[] {
    return league!.players
      .filter((p) => p.drafted_by_captain_id === captainId)
      .sort((a, b) => (a.draft_pick_number ?? 0) - (b.draft_pick_number ?? 0))
  }

  function getTeamStats(captain: Captain) {
    const players = getPlayersForCaptain(captain.id)
    const autoPicks = league!.draft_picks.filter(
      (p) => p.captain_id === captain.id && p.is_auto_pick
    ).length
    return {
      totalPlayers: players.length + (captain.is_participant ? 1 : 0),
      autoPicks,
    }
  }

  // Calculate draft stats
  const totalAutoPicks = league.draft_picks.filter((p) => p.is_auto_pick).length
  const totalRounds = Math.ceil(league.draft_picks.length / league.captains.length)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {showConfetti && league.status === 'completed' && <Confetti />}

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          {isManager && (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          )}

          {/* Hero Header for Completed Draft */}
          {league.status === 'completed' ? (
            <div className="animate-scale-in mb-8 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 text-center">
              <div className="mb-4 inline-flex animate-bounce-slow">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/25">
                  <Trophy className="h-10 w-10 text-primary-foreground" />
                </div>
              </div>
              <h1 className="mb-2 text-4xl font-bold">Draft Complete!</h1>
              <p className="text-lg text-muted-foreground">{league.name}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500" />
              <div>
                <h1 className="text-3xl font-bold">{league.name}</h1>
                <p className="text-muted-foreground">Draft Summary</p>
              </div>
            </div>
          )}
        </div>

        {league.status !== 'completed' && (
          <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-yellow-600 dark:text-yellow-400">
            <p className="font-medium">Draft is not yet complete</p>
            <p className="text-sm">
              {league.status === 'not_started'
                ? 'The draft has not started yet.'
                : league.status === 'paused'
                ? 'The draft is currently paused.'
                : `Pick ${league.current_pick_index + 1} is in progress.`}
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">{league.draft_picks.length}</div>
                  <div className="text-sm text-muted-foreground">Total Picks</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">{league.captains.length}</div>
                  <div className="text-sm text-muted-foreground">Teams</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-3xl font-bold">{totalRounds}</div>
                  <div className="text-sm text-muted-foreground">Rounds</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
                  <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold">{totalAutoPicks}</div>
                  <div className="text-sm text-muted-foreground">Auto Picks</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Share Button */}
        {league.status === 'completed' && (
          <div className="mb-8 flex justify-center">
            <Button onClick={handleCopyLink} variant="outline" className="gap-2">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Share Results
                </>
              )}
            </Button>
          </div>
        )}

        <h2 className="mb-4 text-xl font-semibold">Team Rosters</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {sortedCaptains.map((captain, index) => {
            const players = getPlayersForCaptain(captain.id)
            const stats = getTeamStats(captain)

            return (
              <Card
                key={captain.id}
                className="animate-slide-up overflow-hidden"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {captain.draft_position}
                      </div>
                      <span>{captain.name}</span>
                    </div>
                    <span className="text-sm font-normal text-muted-foreground">
                      {stats.totalPlayers} players
                      {stats.autoPicks > 0 && ` (${stats.autoPicks} auto)`}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-2">
                    {captain.is_participant && (
                      <li className="flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2 ring-1 ring-primary/20">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-medium text-primary-foreground">
                          C
                        </span>
                        <span className="font-medium">{captain.name}</span>
                        <span className="ml-auto text-xs text-primary">Captain</span>
                      </li>
                    )}
                    {players.map((player) => {
                      const pick = league.draft_picks.find((p) => p.player_id === player.id)
                      return (
                        <li
                          key={player.id}
                          className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium">
                            {player.draft_pick_number}
                          </span>
                          <span>{player.name}</span>
                          {pick?.is_auto_pick && (
                            <span className="ml-auto rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                              Auto
                            </span>
                          )}
                        </li>
                      )
                    })}
                    {players.length === 0 && !captain.is_participant && (
                      <li className="py-2 text-center text-sm italic text-muted-foreground">
                        No players drafted
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {league.draft_picks.length > 0 && (
          <>
            <h2 className="mb-4 mt-8 text-xl font-semibold">Pick History</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b text-left text-sm text-muted-foreground">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Captain</th>
                        <th className="pb-2 pr-4">Player</th>
                        <th className="pb-2">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...league.draft_picks]
                        .sort((a, b) => a.pick_number - b.pick_number)
                        .map((pick) => {
                          const captain = league.captains.find((c) => c.id === pick.captain_id)
                          const player = league.players.find((p) => p.id === pick.player_id)
                          return (
                            <tr key={pick.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{pick.pick_number}</td>
                              <td className="py-2 pr-4">{captain?.name ?? 'Unknown'}</td>
                              <td className="py-2 pr-4">{player?.name ?? 'Unknown'}</td>
                              <td className="py-2">
                                {pick.is_auto_pick ? (
                                  <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                                    Auto
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Manual</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Action buttons */}
        {isManager && league.status === 'completed' && (
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/league/new">
              <Button>Create Another League</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
