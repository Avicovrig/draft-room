import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Landing } from '@/pages/Landing'
import { Login } from '@/pages/auth/Login'
import { Signup } from '@/pages/auth/Signup'
import { AuthCallback } from '@/pages/auth/Callback'
import { Dashboard } from '@/pages/Dashboard'
import { NewLeague } from '@/pages/league/NewLeague'
import { ManageLeague } from '@/pages/league/ManageLeague'
import { DraftView } from '@/pages/league/DraftView'
import { CaptainView } from '@/pages/league/CaptainView'
import { SpectatorView } from '@/pages/league/SpectatorView'
import { Summary } from '@/pages/league/Summary'
import { EditProfile } from '@/pages/player/EditProfile'
import { NotFound } from '@/pages/NotFound'
import { PageTransition } from '@/components/layout/PageTransition'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary>
              <BrowserRouter>
                <Routes>
              <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
              <Route path="/auth/login" element={<PageTransition><Login /></PageTransition>} />
              <Route path="/auth/signup" element={<PageTransition><Signup /></PageTransition>} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <PageTransition><Dashboard /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/league/new"
                element={
                  <ProtectedRoute>
                    <PageTransition><NewLeague /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/league/:id/manage"
                element={
                  <ProtectedRoute>
                    <PageTransition><ManageLeague /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/league/:id/draft"
                element={
                  <ProtectedRoute>
                    <PageTransition><DraftView /></PageTransition>
                  </ProtectedRoute>
                }
              />
              {/* Token-based routes (no auth required) */}
              <Route path="/league/:id/captain" element={<PageTransition><CaptainView /></PageTransition>} />
              <Route path="/league/:id/spectate" element={<PageTransition><SpectatorView /></PageTransition>} />
              <Route path="/league/:id/summary" element={<PageTransition><Summary /></PageTransition>} />
              <Route path="/player/:playerId/edit" element={<PageTransition><EditProfile /></PageTransition>} />
              <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
                </Routes>
              </BrowserRouter>
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
