import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './Button'

interface ErrorAlertProps {
  message: string
  onRetry?: () => void
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
      <p className="text-destructive">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  )
}
