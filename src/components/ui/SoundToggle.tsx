import { useState, useEffect } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { Button } from './Button'
import { isSoundEnabled, setSoundEnabled } from '@/lib/sounds'

export function SoundToggle() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(isSoundEnabled())
  }, [])

  function toggle() {
    const newValue = !enabled
    setEnabled(newValue)
    setSoundEnabled(newValue)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={enabled ? 'Mute sounds' : 'Unmute sounds'}
    >
      {enabled ? (
        <Volume2 className="h-5 w-5" />
      ) : (
        <VolumeX className="h-5 w-5" />
      )}
      <span className="sr-only">{enabled ? 'Mute sounds' : 'Unmute sounds'}</span>
    </Button>
  )
}
