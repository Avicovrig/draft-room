import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function NotFound() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <SearchX className="h-12 w-12 text-muted-foreground/50" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-center text-muted-foreground">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <div className="flex gap-4">
        {user && (
          <Link
            to="/dashboard"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Dashboard
          </Link>
        )}
        <Link to="/" className="text-primary underline underline-offset-4 hover:text-primary/80">
          Home
        </Link>
      </div>
    </div>
  )
}
