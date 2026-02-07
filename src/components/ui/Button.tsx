/* eslint-disable react-refresh/only-export-components */
import { forwardRef, useState, useCallback, type ButtonHTMLAttributes, type MouseEvent } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

interface Ripple {
  id: number
  x: number
  y: number
  size: number
}

let rippleCounter = 0

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, onMouseDown, ...props }, ref) => {
    const [ripples, setRipples] = useState<Ripple[]>([])
    const hasRipple = variant !== 'ghost' && variant !== 'link'

    const handleMouseDown = useCallback(
      (e: MouseEvent<HTMLButtonElement>) => {
        onMouseDown?.(e)
        if (!hasRipple) return
        const rect = e.currentTarget.getBoundingClientRect()
        const rippleSize = Math.max(rect.width, rect.height) * 2
        setRipples((prev) => [
          ...prev,
          {
            id: ++rippleCounter,
            x: e.clientX - rect.left - rippleSize / 2,
            y: e.clientY - rect.top - rippleSize / 2,
            size: rippleSize,
          },
        ])
      },
      [hasRipple, onMouseDown]
    )

    const removeRipple = useCallback((id: number) => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, [])

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        onMouseDown={handleMouseDown}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/20 animate-[ripple_0.6s_ease-out] pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
            onAnimationEnd={() => removeRipple(ripple.id)}
          />
        ))}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
