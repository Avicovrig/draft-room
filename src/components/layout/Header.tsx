import { Link } from 'react-router-dom'
import { LogOut, Trophy } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { Button } from '@/components/ui/Button'

export function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="h-5 w-5 text-primary" />
          <span>Draft<span className="text-primary">Room</span></span>
        </Link>

        <div className="flex items-center gap-1">
          <SoundToggle />
          <ThemeToggle />
          {user && (
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Sign out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
