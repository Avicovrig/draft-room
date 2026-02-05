import { useEffect, useState } from 'react'

interface ConfettiPiece {
  id: number
  left: number
  delay: number
  color: string
  size: number
  rotation: number
}

interface ConfettiProps {
  duration?: number
  pieceCount?: number
}

// Detroit Lions colors
const COLORS = ['#0076B6', '#B0B7BC', '#000000', '#FFFFFF']

export function Confetti({ duration = 3000, pieceCount = 50 }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Generate confetti pieces
    const newPieces = Array.from({ length: pieceCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
    }))
    setPieces(newPieces)

    // Clean up after animation
    const timer = setTimeout(() => {
      setVisible(false)
    }, duration + 2000) // Extra time for animations to complete

    return () => clearTimeout(timer)
  }, [duration, pieceCount])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="animate-confetti absolute"
          style={{
            left: `${piece.left}%`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            transform: `rotate(${piece.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  )
}
