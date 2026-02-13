import { useState } from 'react'
import { Copy, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import type { LeagueFullPublic, LeagueTokens } from '@/lib/types'

interface ShareLinksProps {
  league: LeagueFullPublic
  tokens: LeagueTokens | null | undefined
}

export function ShareLinks({ league, tokens }: ShareLinksProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const baseUrl = window.location.origin
  const spectatorUrl = tokens
    ? `${baseUrl}/league/${league.id}/spectate?token=${tokens.spectator_token}`
    : ''

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  function openInNewTab(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const sortedCaptains = [...league.captains].sort((a, b) => a.draft_position - b.draft_position)

  if (!tokens) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading share links...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Spectator Link */}
      <Card>
        <CardHeader>
          <CardTitle>Spectator Link</CardTitle>
          <CardDescription>
            Share this link with anyone who wants to watch the draft live. Spectators can only view,
            not make picks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(spectatorUrl, 'spectator')}
            >
              {copiedId === 'spectator' ? (
                <Check className="mr-1.5 h-4 w-4 text-green-500" />
              ) : (
                <Copy className="mr-1.5 h-4 w-4" />
              )}
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => openInNewTab(spectatorUrl)}>
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Open
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Captain Links */}
      <Card>
        <CardHeader>
          <CardTitle>Captain Links</CardTitle>
          <CardDescription>
            Each captain has a unique link that lets them make picks during their turn. Share each
            link only with the respective captain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedCaptains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add captains to generate their draft links.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedCaptains.map((captain) => {
                const tokenEntry = tokens.captains.find((c) => c.id === captain.id)
                const captainUrl = tokenEntry
                  ? `${baseUrl}/league/${league.id}/captain?token=${tokenEntry.access_token}`
                  : ''
                const captainId = `captain-${captain.id}`

                return (
                  <div key={captain.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {captain.name}
                      <span className="ml-1.5 text-muted-foreground font-normal">
                        #{captain.draft_position}
                      </span>
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(captainUrl, captainId)}
                        aria-label={`Copy link for ${captain.name}`}
                      >
                        {copiedId === captainId ? (
                          <Check className="mr-1.5 h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="mr-1.5 h-4 w-4" />
                        )}
                        Copy Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openInNewTab(captainUrl)}
                        aria-label={`Open link for ${captain.name} in new tab`}
                      >
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        Open
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Spectators</strong> can watch the draft in real-time
            but cannot make any picks.
          </p>
          <p>
            <strong className="text-foreground">Captains</strong> can make picks only when it's
            their turn. The timer shows how long they have to pick.
          </p>
          <p>
            <strong className="text-foreground">You (the manager)</strong> can view and control the
            draft from the Draft view, including pause/resume.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
