import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getPasswordRequirements,
  isPasswordValid,
  passwordsMatch,
} from '../../shared/passwordPolicy.js'

function readInvitationAccessToken() {
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const accessToken = fragment.get('access_token') || query.get('access_token')
  const type = fragment.get('type') || query.get('type')
  window.history.replaceState(null, document.title, window.location.pathname)
  return type === 'invite' ? accessToken : null
}

function CompleteInvitation() {
  const [accessToken] = useState(readInvitationAccessToken)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const passwordRequirements = getPasswordRequirements(password)
  const passwordIsValid = isPasswordValid(password)
  const confirmationMatches = passwordsMatch(password, passwordConfirmation)
  const passwordsDoNotMatch = passwordConfirmation.length > 0 &&
    !confirmationMatches

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!accessToken) {
      setError('This invitation link is invalid or has expired. Ask an administrator to send another invitation.')
      return
    }
    if (!passwordIsValid) {
      setError(
        'Use at least 8 characters, including uppercase and lowercase letters, a number, and a special character.',
      )
      return
    }
    if (!confirmationMatches) {
      setError('The passwords do not match.')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/auth/complete-invitation', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })
      let payload
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (!response.ok || payload?.success !== true) {
        throw new Error(
          typeof payload?.message === 'string'
            ? payload.message
            : 'Unable to set your password right now.',
        )
      }

      setIsComplete(true)
      setPassword('')
      setPasswordConfirmation('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-ivory)] px-4 py-10 text-[var(--charcoal)]">
      <section className="w-full max-w-lg border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[var(--shadow-soft)] sm:p-9">
        <Link
          className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brown)]"
          to="/"
        >
          Braunwork Builders Corporation
        </Link>
        <p className="eyebrow mt-8">Staff account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Set your password
        </h1>
        {isComplete ? (
          <div className="mt-6">
            <p className="text-sm text-[var(--muted)]" role="status">
              Your password is ready. You can now sign in to the staff workspace.
            </p>
            <Link
              className="mt-6 inline-flex min-h-11 items-center bg-[var(--charcoal)] px-5 text-sm font-medium text-white hover:bg-[var(--brown)]"
              to="/admin/login"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Choose a password to finish setting up your staff account.
            </p>
            {error && (
              <p className="mt-5 border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--brown)]" role="alert">
                {error}
              </p>
            )}
            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm">
                New password
                <input
                  autoComplete="new-password"
                  className="min-h-11 border border-[var(--line)] bg-white px-3"
                  maxLength={128}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <ul
                aria-label="Password requirements"
                aria-live="polite"
                className="-mt-2 grid gap-2 text-sm text-[var(--muted)]"
              >
                {passwordRequirements.map((requirement) => (
                  <li
                    className="flex items-center gap-2"
                    key={requirement.id}
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.65rem] ${
                        requirement.isSatisfied
                          ? 'bg-emerald-600 font-semibold text-white'
                          : 'bg-gray-300'
                      }`}
                    >
                      {requirement.isSatisfied ? '✓' : ''}
                    </span>
                    <span className={
                      requirement.isSatisfied
                        ? 'text-emerald-700'
                        : undefined
                    }>
                      {requirement.label}
                    </span>
                  </li>
                ))}
              </ul>
              <label className="grid gap-2 text-sm">
                Confirm password
                <input
                  autoComplete="new-password"
                  className="min-h-11 border border-[var(--line)] bg-white px-3"
                  maxLength={128}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required
                  type="password"
                  value={passwordConfirmation}
                />
              </label>
              <div aria-live="polite" className="-mt-2 text-sm">
                {confirmationMatches ? (
                  <p className="flex items-center gap-2 text-emerald-700">
                    <span
                      aria-hidden="true"
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[0.65rem] font-semibold text-white"
                    >
                      ✓
                    </span>
                    Passwords match
                  </p>
                ) : passwordsDoNotMatch ? (
                  <p className="flex items-center gap-2 text-[var(--brown)]">
                    <span
                      aria-hidden="true"
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-300"
                    />
                    Passwords do not match
                  </p>
                ) : null}
              </div>
              {passwordsDoNotMatch && (
                <p className="-mt-3 text-sm text-[var(--brown)]" role="status">
                  The passwords do not match.
                </p>
              )}
              <button
                className="mt-2 min-h-11 bg-[var(--charcoal)] px-5 text-sm font-medium text-white hover:bg-[var(--brown)] disabled:cursor-wait disabled:opacity-60"
                disabled={isSaving || !passwordIsValid || !confirmationMatches}
                type="submit"
              >
                {isSaving ? 'Saving password…' : 'Set password'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}

export default CompleteInvitation
