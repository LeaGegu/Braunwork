import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { getDashboardNavigation } from './dashboardNavigation.js'
import { loadInquirySummary } from './inquiryList.js'

const summaryItems = [
  { key: 'total', label: 'Total inquiries' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'archived', label: 'Archived' },
]

function NavigationIcon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    inbox: <><path d="M4 4h16v16H4z" /><path d="M4 13h4l2 3h4l2-3h4" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3 3 0 0 1 0 5.6M18 14c1.8.8 3 2.8 3 5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  )
}

function AdminDashboard() {
  const { user, staffProfile, logout, request } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [summary, setSummary] = useState(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(true)
  const [summaryError, setSummaryError] = useState('')

  const displayName = staffProfile.full_name?.trim() || user.email
  const roleLabel = staffProfile.role === 'admin' ? 'Administrator' : 'Staff'
  const canManageInquiries = staffProfile.role === 'admin' ||
    staffProfile.can_manage_inquiries === true
  const navigationItems = getDashboardNavigation(
    staffProfile.role,
    '/admin',
    staffProfile.can_manage_inquiries,
  )

  const loadSummary = useCallback(async () => {
    if (!canManageInquiries) {
      setIsLoadingSummary(false)
      return
    }

    setIsLoadingSummary(true)
    setSummaryError('')
    try {
      setSummary(await loadInquirySummary(request))
    } catch (error) {
      setSummaryError(error.message)
    } finally {
      setIsLoadingSummary(false)
    }
  }, [canManageInquiries, request])

  useEffect(() => {
    const timer = setTimeout(loadSummary, 0)
    return () => clearTimeout(timer)
  }, [loadSummary])

  const handleLogout = async () => {
    if (isLoggingOut) {
      return
    }
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/admin/login', { replace: true })
    } catch (error) {
      navigate('/admin/login', {
        replace: true,
        state: { logoutNotice: error.message },
      })
    }
  }

  const navigation = (
    <nav aria-label="Admin navigation" className="space-y-1">
      {navigationItems.map((item) => item.to
        ? (
            <Link
              key={item.label}
              aria-current={item.active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${
                item.active
                  ? 'bg-[var(--panel-strong)] font-semibold text-[var(--charcoal)]'
                  : 'text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--charcoal)]'
              }`}
              to={item.to}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        : (
            <button
              key={item.label}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-[var(--muted)]"
              disabled
              title="Available in a later update"
              type="button"
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
              <span className="ml-auto text-[0.58rem] uppercase tracking-[0.12em]">
                Soon
              </span>
            </button>
          ))}
    </nav>
  )

  const logoutButton = (
    <button
      className="flex w-full items-center gap-3 border-t border-[var(--line)] px-4 py-4 text-left text-sm text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--charcoal)] disabled:opacity-60"
      disabled={isLoggingOut}
      onClick={handleLogout}
      type="button"
    >
      <NavigationIcon name="logout" />
      <span>{isLoggingOut ? 'Signing out…' : 'Log out'}</span>
    </button>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-ivory)] text-[var(--charcoal)] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col border-r border-[var(--line)] bg-[var(--panel)] lg:flex">
        <Link
          aria-label="Braunwork admin dashboard"
          className="flex min-h-24 items-center gap-3 border-b border-[var(--line)] px-6"
          to="/admin"
        >
          <span className="flex h-10 w-10 items-center justify-center bg-[var(--charcoal)] text-sm font-semibold tracking-[0.2em] text-[var(--bg-ivory)]">B</span>
          <span>
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.2em]">Braunwork</span>
            <span className="mt-1 block text-[0.55rem] uppercase tracking-[0.14em] text-[var(--brown)]">Builders Corporation</span>
          </span>
        </Link>
        <div className="px-4 py-7">
          <p className="eyebrow mb-3 px-4">Workspace</p>
          {navigation}
        </div>
        <div className="mt-auto">
          <div className="border-t border-[var(--line)] px-6 py-5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{roleLabel}</p>
          </div>
          {logoutButton}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--line)] bg-[rgba(245,241,235,0.94)] px-4 backdrop-blur sm:px-7 lg:h-20 lg:px-10">
          <p className="hidden text-sm text-[var(--muted)] lg:block">Admin workspace</p>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="max-w-48 truncate text-sm font-medium">{displayName}</p>
              <p className="text-xs text-[var(--muted)]">{roleLabel}</p>
            </div>
            <button
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close admin menu' : 'Open admin menu'}
              className="flex h-10 w-10 items-center justify-center border border-[var(--line)] lg:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              type="button"
            >
              <NavigationIcon name={mobileMenuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </header>
        {mobileMenuOpen && (
          <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-4 lg:hidden">
            <p className="eyebrow mb-3 px-4">Workspace</p>
            {navigation}
            <div className="mt-3 border-t border-[var(--line)] pt-3">{logoutButton}</div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">A clear view of your inquiry workspace.</p>
            </div>
            {canManageInquiries && (
              <button
                className="w-fit border border-[var(--taupe)] bg-[var(--bg-warm)] px-3 py-2 text-xs font-medium text-[var(--brown)] disabled:opacity-60"
                disabled={isLoadingSummary}
                onClick={loadSummary}
                type="button"
              >
                {isLoadingSummary ? 'Refreshing…' : 'Refresh statistics'}
              </button>
            )}
          </div>

          <section aria-labelledby="overview-heading" className="mt-8">
            <h2 className="sr-only" id="overview-heading">Inquiry overview</h2>
            {!canManageInquiries ? (
              <p className="border border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">
                Inquiry statistics are available to administrators and staff with inquiry-management access.
              </p>
            ) : summaryError ? (
              <div className="border border-[var(--line)] bg-[var(--panel)] p-5" role="alert">
                <p className="text-sm text-[var(--brown)]">{summaryError}</p>
                <button
                  className="mt-3 border border-[var(--taupe)] px-4 py-2 text-xs text-[var(--brown)]"
                  onClick={loadSummary}
                  type="button"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div aria-busy={isLoadingSummary} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {summaryItems.map((item) => (
                  <article
                    className="border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
                    key={item.key}
                  >
                    <p className="text-sm font-medium text-[var(--muted)]">{item.label}</p>
                    <p className="mt-5 text-3xl font-semibold tracking-tight">
                      {isLoadingSummary ? '—' : summary?.[item.key] ?? '—'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Current accessible inquiries</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="mt-8 flex flex-col justify-between gap-4 border border-[var(--taupe)] bg-[var(--bg-warm)] p-5 sm:flex-row sm:items-center sm:px-7">
            <div>
              <p className="eyebrow">Inquiry workspace</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Search, filter, assign, and follow up on customer inquiries.
              </p>
            </div>
            {canManageInquiries && (
              <Link
                className="inline-flex min-h-11 w-fit items-center bg-[var(--charcoal)] px-4 text-sm font-medium text-white hover:bg-[var(--brown)]"
                to="/admin/inquiries"
              >
                Open Inquiry Management
              </Link>
            )}
          </div>
          <p className="mt-7 text-center text-xs text-[var(--muted)]">
            Braunwork Builders Corporation · Admin workspace
          </p>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
