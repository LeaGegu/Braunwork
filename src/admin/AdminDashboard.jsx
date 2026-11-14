import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { getDashboardNavigation } from './dashboardNavigation.js'
import InquiryDetails from './InquiryDetails.jsx'
import {
  formatInquiryDate,
  formatInquiryStatus,
  getInquiryAssigneeLabel,
  loadInquiryDetails,
  loadInquiryPage,
  syncInquiryAssignment,
  syncInquiryStatus,
} from './inquiryList.js'

const overviewItems = [
  { label: 'Total inquiries', value: '—', note: 'Awaiting live data' },
  { label: 'New inquiries', value: '—', note: 'Awaiting live data' },
  { label: 'In progress', value: '—', note: 'Awaiting live data' },
  { label: 'Resolved', value: '—', note: 'Awaiting live data' },
]

function NavigationIcon({ name }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M4 13h4l2 3h4l2-3h4" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14c1.8.8 3 2.8 3 5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.9Z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
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
  const [inquiries, setInquiries] = useState([])
  const [inquiryPagination, setInquiryPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(true)
  const [inquiryError, setInquiryError] = useState('')
  const inquiryRequestId = useRef(0)
  const [selectedInquiryId, setSelectedInquiryId] = useState(null)
  const [selectedInquiry, setSelectedInquiry] = useState(null)
  const [inquiryMessages, setInquiryMessages] = useState([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const detailsRequestId = useRef(0)

  const displayName = staffProfile.full_name?.trim() || user.email
  const roleLabel = staffProfile.role === 'admin' ? 'Administrator' : 'Staff'
  const navigationItems = getDashboardNavigation(staffProfile.role)

  const loadInquiries = useCallback(async (page = 1) => {
    const requestId = ++inquiryRequestId.current
    setIsLoadingInquiries(true)
    setInquiryError('')
    try {
      const result = await loadInquiryPage(request, page)
      if (requestId === inquiryRequestId.current) {
        setInquiries(result.inquiries)
        setInquiryPagination(result.pagination)
      }
    } catch (error) {
      if (requestId === inquiryRequestId.current) {
        setInquiryError(error.message)
      }
    } finally {
      if (requestId === inquiryRequestId.current) {
        setIsLoadingInquiries(false)
      }
    }
  }, [request])

  useEffect(() => {
    const timer = setTimeout(() => loadInquiries(1), 0)
    return () => {
      clearTimeout(timer)
      inquiryRequestId.current += 1
    }
  }, [loadInquiries])

  const loadDetails = useCallback(async (inquiryId) => {
    const requestId = ++detailsRequestId.current
    setIsLoadingDetails(true)
    setDetailsError('')
    try {
      const result = await loadInquiryDetails(request, inquiryId)
      if (requestId === detailsRequestId.current) {
        setSelectedInquiry(result.inquiry)
        setInquiryMessages(result.messages)
      }
    } catch (error) {
      if (requestId === detailsRequestId.current) {
        setDetailsError(error.message)
      }
    } finally {
      if (requestId === detailsRequestId.current) {
        setIsLoadingDetails(false)
      }
    }
  }, [request])

  const handleInquiryStatusUpdated = useCallback((updatedInquiry) => {
    inquiryRequestId.current += 1
    setInquiries((currentInquiries) =>
      syncInquiryStatus(currentInquiries, updatedInquiry),
    )
    setSelectedInquiry((currentInquiry) =>
      currentInquiry?.id === updatedInquiry.id
        ? { ...currentInquiry, status: updatedInquiry.status }
        : currentInquiry,
    )
  }, [])

  const handleInquiryAssignmentUpdated = useCallback((updatedInquiry) => {
    const requestId = ++inquiryRequestId.current
    setIsLoadingInquiries(true)
    setInquiryError('')
    setInquiries((currentInquiries) =>
      syncInquiryAssignment(currentInquiries, updatedInquiry),
    )
    setSelectedInquiry((currentInquiry) =>
      currentInquiry?.id === updatedInquiry.id
        ? {
            ...currentInquiry,
            assigned_to: updatedInquiry.assigned_to,
            assigned_to_name: null,
          }
        : currentInquiry,
    )

    const refreshAssignmentName = async () => {
      try {
        const result = await loadInquiryPage(request, inquiryPagination.page)
        if (requestId !== inquiryRequestId.current) {
          return
        }

        const refreshedInquiry = result.inquiries.find(
          (inquiry) => inquiry.id === updatedInquiry.id,
        )
        const confirmedName = refreshedInquiry?.assigned_to === updatedInquiry.assigned_to
          ? refreshedInquiry.assigned_to_name
          : null
        setInquiries(
          result.inquiries.map((inquiry) =>
            inquiry.id === updatedInquiry.id
              ? {
                  ...inquiry,
                  assigned_to: updatedInquiry.assigned_to,
                  assigned_to_name: updatedInquiry.assigned_to
                    ? confirmedName
                    : null,
                }
              : inquiry,
          ),
        )
        setInquiryPagination(result.pagination)
        setSelectedInquiry((currentInquiry) =>
          currentInquiry?.id === updatedInquiry.id
            ? {
                ...currentInquiry,
                assigned_to: updatedInquiry.assigned_to,
                assigned_to_name: updatedInquiry.assigned_to
                  ? confirmedName
                  : null,
              }
            : currentInquiry,
        )
      } catch (error) {
        if (requestId === inquiryRequestId.current) {
          setInquiryError(error.message)
        }
      } finally {
        if (requestId === inquiryRequestId.current) {
          setIsLoadingInquiries(false)
        }
      }
    }

    return refreshAssignmentName()
  }, [inquiryPagination.page, request])

  useEffect(() => {
    if (!selectedInquiryId) {
      return undefined
    }

    const timer = setTimeout(() => loadDetails(selectedInquiryId), 0)
    return () => {
      clearTimeout(timer)
      detailsRequestId.current += 1
    }
  }, [loadDetails, selectedInquiryId])

  const openInquiry = (inquiryId) => {
    setSelectedInquiry(null)
    setInquiryMessages([])
    setDetailsError('')
    setSelectedInquiryId(inquiryId)
  }

  const returnToInquiryList = () => {
    detailsRequestId.current += 1
    setSelectedInquiryId(null)
    setSelectedInquiry(null)
    setInquiryMessages([])
    setDetailsError('')
    setIsLoadingDetails(false)
  }

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
      {navigationItems.map((item) => (
        <button
          key={item.label}
          aria-current={item.active ? 'page' : undefined}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${
            item.active
              ? 'bg-[var(--panel-strong)] font-semibold text-[var(--charcoal)]'
              : 'text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--charcoal)]'
          }`}
          disabled={item.comingSoon}
          title={item.comingSoon ? 'Available in a later update' : undefined}
          type="button"
        >
          <NavigationIcon name={item.icon} />
          <span>{item.label}</span>
          {item.comingSoon && (
            <span className="ml-auto text-[0.58rem] uppercase tracking-[0.12em] text-[var(--muted)]">
              Soon
            </span>
          )}
        </button>
      ))}
    </nav>
  )

  const logoutButton = (
    <button
      className="flex w-full items-center gap-3 border-t border-[var(--line)] px-4 py-4 text-left text-sm text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--charcoal)] disabled:cursor-wait disabled:opacity-60"
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
          <span className="flex h-10 w-10 items-center justify-center bg-[var(--charcoal)] text-sm font-semibold tracking-[0.2em] text-[var(--bg-ivory)]">
            B
          </span>
          <span>
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.2em]">
              Braunwork
            </span>
            <span className="mt-1 block text-[0.55rem] uppercase tracking-[0.14em] text-[var(--brown)]">
              Builders Corporation
            </span>
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
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center bg-[var(--charcoal)] text-xs font-semibold tracking-[0.2em] text-[var(--bg-ivory)]">
              B
            </span>
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.16em]">
                Braunwork
              </span>
              <span className="block text-[0.53rem] uppercase tracking-[0.12em] text-[var(--brown)]">
                Builders Corporation
              </span>
            </span>
          </div>
          <p className="hidden text-sm text-[var(--muted)] lg:block">
            Admin workspace
          </p>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-medium">{displayName}</p>
              <p className="text-xs text-[var(--muted)]">{roleLabel}</p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--taupe)] bg-[var(--bg-warm)] text-sm font-semibold text-[var(--brown)]"
            >
              {(staffProfile.full_name?.trim() || user.email)[0].toUpperCase()}
            </span>
            <button
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close admin menu' : 'Open admin menu'}
              className="flex h-10 w-10 items-center justify-center border border-[var(--line)] text-[var(--charcoal)] lg:hidden"
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
            <div className="mt-3 border-t border-[var(--line)] pt-3">
              {logoutButton}
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Overview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                A clear view of your inquiry workspace.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 border border-[var(--taupe)] bg-[var(--bg-warm)] px-3 py-2 text-xs font-medium text-[var(--brown)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--brown)]" />
              Preview mode
            </span>
          </div>

          <section aria-labelledby="overview-heading" className="mt-8">
            <h2 className="sr-only" id="overview-heading">
              Inquiry overview
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewItems.map((item, index) => (
                <article
                  className="border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
                  key={item.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--muted)]">
                      {item.label}
                    </p>
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${
                        index === 0
                          ? 'bg-[var(--charcoal)]'
                          : index === 1
                            ? 'bg-[var(--brown)]'
                            : index === 2
                              ? 'bg-[var(--taupe)]'
                              : 'bg-[var(--greige)]'
                      }`}
                    />
                  </div>
                  <p className="mt-5 text-3xl font-semibold tracking-tight">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.note}</p>
                </article>
              ))}
            </div>
          </section>

          {selectedInquiryId ? (
            <section
              aria-busy={isLoadingDetails}
              className="mt-8 min-h-40"
            >
              {isLoadingDetails ? (
                <p className="border border-[var(--line)] bg-[var(--panel)] px-5 py-12 text-center text-sm text-[var(--muted)]" role="status">
                  Loading inquiry details…
                </p>
              ) : detailsError ? (
                <div className="border border-[var(--line)] bg-[var(--panel)] px-5 py-10 text-center" role="alert">
                  <p className="text-sm text-[var(--brown)]">{detailsError}</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      className="border border-[var(--taupe)] px-4 py-2 text-xs font-medium text-[var(--brown)] hover:bg-[var(--bg-warm)]"
                      onClick={() => loadDetails(selectedInquiryId)}
                      type="button"
                    >
                      Try again
                    </button>
                    <button
                      className="border border-[var(--line)] px-4 py-2 text-xs font-medium text-[var(--muted)] hover:bg-[var(--bg-warm)]"
                      onClick={returnToInquiryList}
                      type="button"
                    >
                      Back to inquiries
                    </button>
                  </div>
                </div>
              ) : selectedInquiry ? (
                <InquiryDetails
                  key={selectedInquiry.id}
                  inquiry={selectedInquiry}
                  messages={inquiryMessages}
                  currentUserId={user.id}
                  onBack={returnToInquiryList}
                  onAssignmentUpdated={handleInquiryAssignmentUpdated}
                  onNoteAdded={() => loadDetails(selectedInquiryId)}
                  onStatusUpdated={handleInquiryStatusUpdated}
                  request={request}
                />
              ) : null}
            </section>
          ) : (
          <section
            aria-labelledby="recent-inquiries-heading"
            className="mt-8 border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-soft)]"
          >
            <div className="flex flex-col gap-2 border-b border-[var(--line)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <h2
                  className="text-lg font-semibold tracking-tight"
                  id="recent-inquiries-heading"
                >
                  Recent inquiries
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  The latest inquiries submitted to Braunwork.
                </p>
              </div>
              <button
                className="w-fit border border-[var(--taupe)] px-3 py-2 text-xs font-medium text-[var(--brown)] hover:bg-[var(--bg-warm)] disabled:cursor-wait disabled:opacity-60"
                disabled={isLoadingInquiries}
                onClick={() => loadInquiries(inquiryPagination.page)}
                type="button"
              >
                {isLoadingInquiries ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div aria-busy={isLoadingInquiries} className="min-h-40">
              {isLoadingInquiries ? (
                <p className="px-5 py-12 text-center text-sm text-[var(--muted)]" role="status">
                  Loading inquiries…
                </p>
              ) : inquiryError ? (
                <div className="px-5 py-10 text-center" role="alert">
                  <p className="text-sm text-[var(--brown)]">{inquiryError}</p>
                  <button
                    className="mt-4 border border-[var(--taupe)] px-4 py-2 text-xs font-medium text-[var(--brown)] hover:bg-[var(--bg-warm)]"
                    onClick={() => loadInquiries(inquiryPagination.page)}
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              ) : inquiries.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">
                  No inquiries have been submitted yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[52rem] text-left text-sm">
                    <thead className="bg-[var(--panel)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                      <tr>
                        <th className="px-5 py-3 font-medium sm:px-7" scope="col">
                          Inquiry
                        </th>
                        <th className="px-5 py-3 font-medium" scope="col">
                          Category
                        </th>
                        <th className="px-5 py-3 font-medium" scope="col">
                          Status
                        </th>
                        <th className="px-5 py-3 font-medium" scope="col">
                          Assigned To
                        </th>
                        <th className="px-5 py-3 font-medium" scope="col">
                          Submitted
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiries.map((inquiry) => (
                        <tr className="border-t border-[var(--line)]" key={inquiry.id}>
                          <td className="px-5 py-4 sm:px-7">
                            <button
                              className="text-left hover:text-[var(--brown)]"
                              onClick={() => openInquiry(inquiry.id)}
                              type="button"
                            >
                              <span className="block font-medium underline decoration-[var(--taupe)] underline-offset-2">
                                {inquiry.subject}
                              </span>
                              <span className="mt-1 block text-xs text-[var(--muted)]">
                                {inquiry.name}
                              </span>
                            </button>
                          </td>
                          <td className="px-5 py-4 text-[var(--muted)]">
                            {inquiry.category}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex border border-[var(--line)] bg-[var(--bg-ivory)] px-2.5 py-1 text-xs text-[var(--brown)]">
                              {formatInquiryStatus(inquiry.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-[var(--muted)]">
                            {getInquiryAssigneeLabel(inquiry)}
                          </td>
                          <td className="px-5 py-4 text-xs text-[var(--muted)]">
                            {formatInquiryDate(inquiry.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--line)] px-5 py-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <span>
                {inquiryPagination.total} {inquiryPagination.total === 1 ? 'inquiry' : 'inquiries'}
                {inquiryPagination.totalPages > 0 && (
                  <> · Page {inquiryPagination.page} of {inquiryPagination.totalPages}</>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="border border-[var(--line)] px-3 py-2 hover:bg-[var(--bg-warm)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoadingInquiries || inquiryPagination.page <= 1}
                  onClick={() => loadInquiries(inquiryPagination.page - 1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="border border-[var(--line)] px-3 py-2 hover:bg-[var(--bg-warm)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isLoadingInquiries || inquiryPagination.page >= inquiryPagination.totalPages}
                  onClick={() => loadInquiries(inquiryPagination.page + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
          )}

          <p className="mt-7 text-center text-xs text-[var(--muted)]">
            Braunwork Builders Corporation · Admin workspace
          </p>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
