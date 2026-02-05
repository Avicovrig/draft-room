import { useState } from 'react'
import { Copy, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import type { LeagueFull } from '@/lib/types'

interface ShareLinksProps {
  league: LeagueFull
}

export function ShareLinks({ league }: ShareLinksProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const baseUrl = window.location.origin
  const spectatorUrl = `${baseUrl}/league/${league.id}/spectate?token=${league.spectator_token}`

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
    window.open(url, '_blank')
  }

  const sortedCaptains = [...league.captains].sort((a, b) => a.draft_position - b.draft_position)

  return (
    <div className="space-y-6">
      {/* Spectator Link */}
      <Card>
        <CardHeader>
          <CardTitle>Spectator Link</CardTitle>
          <CardDescription>
            Share this link with anyone who wants to watch the draft live. Spectators can only view, not make picks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Spectator URL</Label>
            <div className="flex gap-2">
              <Input value={spectatorUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(spectatorUrl, 'spectator')}
              >
                {copiedId === 'spectator' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => openInNewTab(spectatorUrl)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Captain Links */}
      <Card>
        <CardHeader>
          <CardTitle>Captain Links</CardTitle>
          <CardDescription>
            Each captain has a unique link that lets them make picks during their turn. Share each link only with the respective captain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedCaptains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add captains to generate their draft links.
            </p>
          ) : (
            <div className="space-y-4">
              {sortedCaptains.map((captain) => {
                const captainUrl = `${baseUrl}/league/${league.id}/captain?token=${captain.access_token}`
                const captainId = `captain-${captain.id}`

                return (
                  <div key={captain.id} className="space-y-2">
                    <Label>
                      {captain.name}
                      <span className="ml-2 text-muted-foreground">
                        (Pick #{captain.draft_position})
                      </span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={captainUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(captainUrl, captainId)}
                      >
                        {copiedId === captainId ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openInNewTab(captainUrl)}
                      >
                        <ExternalLink className="h-4 w-4" />
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
            <strong className="text-foreground">Spectators</strong> can watch the draft in real-time but cannot make any picks.
          </p>
          <p>
            <strong className="text-foreground">Captains</strong> can make picks only when it's their turn. The timer shows how long they have to pick.
          </p>
          <p>
            <strong className="text-foreground">You (the manager)</strong> can view and control the draft from the Draft view, including pause/resume.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
