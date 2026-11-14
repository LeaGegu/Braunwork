import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { getAdminRedirect } from '../auth/protectedRoutePolicy.js'

function AdminLogin() {
  const { initialized, isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [validationErrors, setValidationErrors] = useState({
    email: false,
    password: false,
  })
  const [loginError, setLoginError] = useState(
    location.state?.logoutNotice ?? '',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate(getAdminRedirect(location.state), { replace: true })
    }
  }, [initialized, isAuthenticated, location.state, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoginError('')
    const emailInvalid = !event.currentTarget.querySelector(
      '#admin-email',
    ).validity.valid
    const passwordInvalid = !event.currentTarget.querySelector(
      '#admin-password',
    ).validity.valid
    setValidationErrors({ email: emailInvalid, password: passwordInvalid })

    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }

    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)
    try {
      await login(formData.get('email'), formData.get('password'))
      navigate(getAdminRedirect(location.state), { replace: true })
    } catch (error) {
      setLoginError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const { email: emailInvalid, password: passwordInvalid } = validationErrors

  if (!initialized || isAuthenticated) {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-[var(--bg-ivory)] px-6 text-[var(--muted)]"
      >
        <p role="status">Checking your session…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--bg-ivory)] text-[var(--charcoal)]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(19rem,0.9fr)_minmax(30rem,1.1fr)]">
        <aside className="relative flex min-h-[17rem] flex-col justify-between overflow-hidden bg-[var(--charcoal)] px-7 py-8 text-[var(--bg-ivory)] sm:px-10 sm:py-10 lg:min-h-screen lg:px-14 lg:py-12">
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center border border-[var(--taupe)] bg-[var(--bg-ivory)] text-sm font-semibold tracking-[0.2em] text-[var(--charcoal)]">
              B
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em]">
                Braunwork
              </p>
              <p className="mt-1 text-[0.6rem] uppercase tracking-[0.18em] text-[var(--taupe)]">
                Builders Corporation
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-7 bottom-0 top-24 opacity-25 sm:inset-x-10 lg:inset-x-14 lg:top-40"
          >
            <div className="absolute bottom-0 left-[12%] top-0 border-l border-[var(--taupe)]" />
            <div className="absolute bottom-0 left-[37%] top-[15%] border-l border-[var(--taupe)]" />
            <div className="absolute bottom-0 right-[14%] top-[6%] border-l border-[var(--taupe)]" />
            <div className="absolute bottom-[18%] left-0 right-0 border-t border-[var(--taupe)]" />
            <div className="absolute bottom-[47%] left-[12%] right-0 border-t border-[var(--taupe)]" />
            <div className="absolute bottom-[18%] left-[37%] right-[14%] border-t border-[var(--taupe)]" />
          </div>

          <div className="relative z-10 mt-12 max-w-md lg:mb-12 lg:mt-auto">
            <p className="eyebrow text-[var(--taupe)]">Built with intention</p>
            <p className="mt-4 text-2xl font-light leading-snug tracking-tight sm:text-3xl">
              Thoughtful spaces.
              <br />
              Lasting work.
            </p>
            <div className="mt-6 h-px w-14 bg-[var(--taupe)]" />
            <p className="mt-4 max-w-xs text-sm leading-6 text-[rgba(245,241,235,0.68)]">
              A dedicated workspace for the people behind every project.
            </p>
          </div>

          <p className="relative z-10 mt-8 hidden text-[0.62rem] uppercase tracking-[0.18em] text-[rgba(245,241,235,0.48)] lg:block">
            Craftsmanship in every detail
          </p>
        </aside>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <p className="eyebrow">Secure workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Admin Portal
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
              Sign in to access your Braunwork account.
            </p>

            <form className="mt-9 space-y-6" noValidate onSubmit={handleSubmit}>
              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor="admin-email"
                >
                  Email address
                </label>
                <input
                  aria-describedby={emailInvalid ? 'admin-email-error' : undefined}
                  aria-invalid={emailInvalid}
                  autoComplete="username"
                  className={`w-full border bg-[var(--panel)] px-4 py-3 text-sm text-[var(--charcoal)] placeholder:text-[var(--muted)] focus:border-[var(--brown)] focus:outline-none focus:ring-2 focus:ring-[var(--brown)]/20 ${
                    emailInvalid
                      ? 'border-red-800'
                      : 'border-[var(--line)]'
                  }`}
                  id="admin-email"
                  name="email"
                  placeholder="name@company.com"
                  required
                  type="email"
                />
                {emailInvalid && (
                  <p
                    className="mt-2 text-sm text-red-800"
                    id="admin-email-error"
                  >
                    Enter a valid email address.
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium"
                  htmlFor="admin-password"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    aria-describedby={
                      passwordInvalid ? 'admin-password-error' : undefined
                    }
                    aria-invalid={passwordInvalid}
                    autoComplete="current-password"
                    className={`w-full border bg-[var(--panel)] px-4 py-3 pr-20 text-sm text-[var(--charcoal)] placeholder:text-[var(--muted)] focus:border-[var(--brown)] focus:outline-none focus:ring-2 focus:ring-[var(--brown)]/20 ${
                      passwordInvalid
                        ? 'border-red-800'
                        : 'border-[var(--line)]'
                    }`}
                    id="admin-password"
                    name="password"
                    placeholder="Enter your password"
                    required
                    type={showPassword ? 'text' : 'password'}
                  />
                  <button
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 px-4 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--brown)] hover:text-[var(--charcoal)]"
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {passwordInvalid && (
                  <p
                    className="mt-2 text-sm text-red-800"
                    id="admin-password-error"
                  >
                    Enter your password.
                  </p>
                )}
              </div>

              <button
                className="btn-primary w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Signing In…' : 'Sign In'}
              </button>

              {loginError && (
                <p
                  aria-live="polite"
                  className="border border-red-800/30 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900"
                  role="alert"
                >
                  {loginError}
                </p>
              )}
            </form>

            <div className="mt-8 border-t border-[var(--line)] pt-5">
              <Link
                className="text-sm text-[var(--muted)] underline decoration-[var(--taupe)] underline-offset-4 hover:text-[var(--charcoal)]"
                to="/"
              >
                Return to the public website
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default AdminLogin
