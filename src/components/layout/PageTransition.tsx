import type { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-fade-in" style={{ animationDuration: '0.15s' }}>
      {children}
    </div>
  )
}
