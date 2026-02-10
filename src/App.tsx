import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { PageTransition } from '@/components/layout/PageTransition'
import { Analytics } from '@vercel/analytics/react'

const Landing = lazy(() => import('@/pages/Landing').then(m => ({ default: m.Landing })))
const Login = lazy(() => import('@/pages/auth/Login').then(m => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/auth/Signup').then(m => ({ default: m.Signup })))
const AuthCallback = lazy(() => import('@/pages/auth/Callback').then(m => ({ default: m.AuthCallback })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const NewLeague = lazy(() => import('@/pages/league/NewLeague').then(m => ({ default: m.NewLeague })))
const ManageLeague = lazy(() => import('@/pages/league/ManageLeague').then(m => ({ default: m.ManageLeague })))
const DraftView = lazy(() => import('@/pages/league/DraftView').then(m => ({ default: m.DraftView })))
const CaptainView = lazy(() => import('@/pages/league/CaptainView').then(m => ({ default: m.CaptainView })))
const SpectatorView = lazy(() => import('@/pages/league/SpectatorView').then(m => ({ default: m.SpectatorView })))
const Summary = lazy(() => import('@/pages/league/Summary').then(m => ({ default: m.Summary })))
const EditProfile = lazy(() => import('@/pages/player/EditProfile').then(m => ({ default: m.EditProfile })))
const NotFound = lazy(() => import('@/pages/NotFound').then(m => ({ default: m.NotFound })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min default
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ErrorBoundary>
              <BrowserRouter>
                <Suspense fallback={
                  <div className="flex h-screen items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }>
                <Routes>
              <Route path="/" element={<ErrorBoundary><PageTransition><Landing /></PageTransition></ErrorBoundary>} />
              <Route path="/auth/login" element={<ErrorBoundary><PageTransition><Login /></PageTransition></ErrorBoundary>} />
              <Route path="/auth/signup" element={<ErrorBoundary><PageTransition><Signup /></PageTransition></ErrorBoundary>} />
              <Route path="/auth/callback" element={<ErrorBoundary><AuthCallback /></ErrorBoundary>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary><PageTransition><Dashboard /></PageTransition></ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/league/new"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary><PageTransition><NewLeague /></PageTransition></ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/league/:id/manage"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary><PageTransition><ManageLeague /></PageTransition></ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/league/:id/draft"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary><PageTransition><DraftView /></PageTransition></ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              {/* Token-based routes (no auth required) */}
              <Route path="/league/:id/captain" element={<ErrorBoundary><PageTransition><CaptainView /></PageTransition></ErrorBoundary>} />
              <Route path="/league/:id/spectate" element={<ErrorBoundary><PageTransition><SpectatorView /></PageTransition></ErrorBoundary>} />
              <Route path="/league/:id/summary" element={<ErrorBoundary><PageTransition><Summary /></PageTransition></ErrorBoundary>} />
              <Route path="/player/:playerId/edit" element={<ErrorBoundary><PageTransition><EditProfile /></PageTransition></ErrorBoundary>} />
              <Route path="*" element={<ErrorBoundary><PageTransition><NotFound /></PageTransition></ErrorBoundary>} />
                </Routes>
                </Suspense>
              </BrowserRouter>
              <Analytics />
            </ErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
