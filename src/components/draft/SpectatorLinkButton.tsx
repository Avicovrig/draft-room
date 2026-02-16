import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

interface SpectatorLinkButtonProps {
  leagueId: string
  spectatorToken: string
}

export function SpectatorLinkButton({ leagueId, spectatorToken }: SpectatorLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  async function handleCopy() {
    const url = `${window.location.origin}/league/${leagueId}/spectate?token=${spectatorToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      addToast('Spectator link copied', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Failed to copy link', 'error')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      title="Copy spectator link"
      aria-label="Copy spectator link"
    >
      {copied ? (
        <Check className="mr-1.5 h-4 w-4 text-green-500" />
      ) : (
        <Share2 className="mr-1.5 h-4 w-4" />
      )}
      Share
    </Button>
  )
}
