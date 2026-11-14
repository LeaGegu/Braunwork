import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { getProtectedRouteDecision } from '../auth/protectedRoutePolicy.js'

function ProtectedRoute() {
  const {
    initialized,
    user,
    staffProfile,
  } = useAuth()
  const location = useLocation()
  const decision = getProtectedRouteDecision({
    initialized,
    user,
    staffProfile,
  })

  if (decision === 'loading') {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-[var(--bg-ivory)] px-6 text-[var(--muted)]"
      >
        <p role="status">Checking your session…</p>
      </main>
    )
  }

  if (decision === 'redirect') {
    return (
      <Navigate
        replace
        state={{ from: location }}
        to="/admin/login"
      />
    )
  }

  return <Outlet />
}

export default ProtectedRoute
