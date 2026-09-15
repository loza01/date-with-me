import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { ADMIN_PATH, homeFor } from './lib/routes'
import { isConfigured } from './lib/supabase'
import { FullPageLoader, Shell } from './components/Shell'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Questionnaire from './pages/Questionnaire'
import FinalStep from './pages/FinalStep'
import Payment from './pages/Payment'
import Complete from './pages/Complete'
import NotFound from './pages/NotFound'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

// Loaded only once an admin is signed in, so applicants never download it.
const Admin = lazy(() => import('./pages/Admin'))

/**
 * Every route is gated by the server-side application status.
 * Signed-out visitors only see "/", "/login" and "/signup"; signed-in
 * users are always pushed to the single page their status allows.
 */
function Gate({ path, children }) {
  const auth = useAuth()
  if (auth.loading) return <FullPageLoader />

  const publicPaths = ['/', '/login', '/signup']
  if (!auth.session) {
    return publicPaths.includes(path) ? children : <Navigate to="/" replace />
  }

  const home = homeFor(auth)
  return path === home ? children : <Navigate to={home} replace />
}

/**
 * The hidden dashboard. Everyone except a signed-in admin gets a plain 404.
 * The login form only appears with ?access=true.
 */
function AdminGate() {
  const auth = useAuth()
  const [params] = useSearchParams()
  if (auth.loading) return <FullPageLoader />

  if (auth.session && auth.isAdmin) {
    if (params.has('access')) return <Navigate to={ADMIN_PATH} replace />
    return (
      <Suspense fallback={<FullPageLoader />}>
        <Admin />
      </Suspense>
    )
  }
  if (!auth.session && params.get('access') === 'true') return <Auth mode="login" hideSignupLink />
  return <NotFound />
}

function AppRoutes() {
  const { profile } = useAuth()
  const routes = [
    ['/', <Landing />],
    ['/login', <Auth mode="login" />],
    ['/signup', <Auth mode="signup" />],
    ['/onboarding', <Onboarding />],
    ['/payment', <Payment />],
    // Remount when the server state changes so the state machine re-initialises.
    ['/questionnaire', <Questionnaire key={`${profile?.status}-${profile?.current_step}`} />],
    ['/final-step', <FinalStep />],
    ['/complete', <Complete />],
  ]

  return (
    <Routes>
      {routes.map(([path, element]) => (
        <Route key={path} path={path} element={<Gate path={path}>{element}</Gate>} />
      ))}
      <Route path={ADMIN_PATH} element={<AdminGate />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function SetupNeeded() {
  return (
    <Shell>
      <div className="card space-y-3 p-8">
        <h1 className="font-serif text-3xl">Almost there</h1>
        <p className="text-charcoal-500">
          Copy <code className="rounded bg-cream-200 px-1.5">.env.example</code> to{' '}
          <code className="rounded bg-cream-200 px-1.5">.env</code>, add your Supabase URL and anon key, then restart{' '}
          <code className="rounded bg-cream-200 px-1.5">npm run dev</code>.
        </p>
      </div>
    </Shell>
  )
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
