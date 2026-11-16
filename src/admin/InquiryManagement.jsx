import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { inquiryCategories } from '../data/inquiryCategories.js'
import { getDashboardNavigation } from './dashboardNavigation.js'
import InquiryDetails from './InquiryDetails.jsx'
import {
  formatInquiryDate,
  formatInquiryStatus,
  getInquiryAssigneeLabel,
  inquiryStatuses,
  loadInquiryAssignees,
  loadInquiryDetails,
  loadInquiryPage,
  syncInquiryAssignment,
  syncInquiryStatus,
} from './inquiryList.js'

const pageSize = 20
const initialFilters = {
  search: '',
  status: '',
  category: '',
  assigned_to: '',
  sort: 'newest',
}

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

function InquiryManagement() {
  const { user, staffProfile, logout, request } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { inquiryId } = useParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [inquiries, setInquiries] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0,
  })
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState(initialFilters)
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [assignees, setAssignees] = useState([])
  const [assigneesError, setAssigneesError] = useState('')
  const [selectedInquiry, setSelectedInquiry] = useState(null)
  const [messages, setMessages] = useState([])
  const [activities, setActivities] = useState([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const listRequestId = useRef(0)
  const detailsRequestId = useRef(0)

  const canManageInquiries = staffProfile.role === 'admin' ||
    (staffProfile.role === 'staff' &&
      staffProfile.can_manage_inquiries === true)
  const displayName = staffProfile.full_name?.trim() || user.email
  const roleLabel = staffProfile.role === 'admin' ? 'Administrator' : 'Staff'
  const navigationItems = getDashboardNavigation(
    staffProfile.role,
    location.pathname,
    staffProfile.can_manage_inquiries,
  )

  const loadList = useCallback(async () => {
    if (inquiryId) return
    const requestId = ++listRequestId.current
    setIsLoading(true)
    setListError('')
    try {
      const result = await loadInquiryPage(request, page, pageSize, filters)
      if (requestId === listRequestId.current) {
        setInquiries(result.inquiries)
        setPagination(result.pagination)
      }
    } catch (error) {
      if (requestId === listRequestId.current) setListError(error.message)
    } finally {
      if (requestId === listRequestId.current) setIsLoading(false)
    }
  }, [filters, inquiryId, page, request])

  useEffect(() => {
    if (inquiryId) return undefined
    const timer = setTimeout(loadList, 0)
    return () => {
      clearTimeout(timer)
      listRequestId.current += 1
    }
  }, [inquiryId, loadList])

  const loadDetails = useCallback(async (id) => {
    const requestId = ++detailsRequestId.current
    setIsLoadingDetails(true)
    setDetailsError('')
    try {
      const result = await loadInquiryDetails(request, id)
      if (requestId === detailsRequestId.current) {
        setSelectedInquiry(result.inquiry)
        setMessages(result.messages)
        setActivities(result.activities)
      }
    } catch (error) {
      if (requestId === detailsRequestId.current) setDetailsError(error.message)
    } finally {
      if (requestId === detailsRequestId.current) setIsLoadingDetails(false)
    }
  }, [request])

  useEffect(() => {
    if (!inquiryId) return undefined
    const timer = setTimeout(() => loadDetails(inquiryId), 0)
    return () => {
      clearTimeout(timer)
      detailsRequestId.current += 1
    }
  }, [inquiryId, loadDetails])

  const refreshAssignees = useCallback(async () => {
    setAssigneesError('')
    try {
      setAssignees(await loadInquiryAssignees(request))
    } catch (error) {
      setAssigneesError(error.message)
    }
  }, [request])

  useEffect(() => {
    const timer = setTimeout(refreshAssignees, 0)
    return () => clearTimeout(timer)
  }, [refreshAssignees])

  if (!canManageInquiries) {
    return <Navigate replace to="/admin" />
  }

  const handleLogout = async () => {
    if (isLoggingOut) return
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

  const handleFilterChange = (field, value) => {
    setPage(1)
    setFilters((current) => ({ ...current, [field]: value }))
  }

  const handleSearch = (event) => {
    event.preventDefault()
    handleFilterChange('search', searchInput.trim())
  }

  const clearFilters = () => {
    setSearchInput('')
    setPage(1)
    setFilters(initialFilters)
  }

  const openInquiry = (id) => {
    setSelectedInquiry(null)
    setMessages([])
    setActivities([])
    setDetailsError('')
    navigate(`/admin/inquiries/${encodeURIComponent(id)}`)
  }

  const closeDetails = () => {
    detailsRequestId.current += 1
    setSelectedInquiry(null)
    setMessages([])
    setActivities([])
    setDetailsError('')
    setIsLoadingDetails(false)
    navigate('/admin/inquiries')
  }

  const handleStatusUpdated = (updatedInquiry) => {
    setInquiries((current) => syncInquiryStatus(current, updatedInquiry))
    setSelectedInquiry((current) => current
      ? { ...current, status: updatedInquiry.status }
      : current)
    loadDetails(updatedInquiry.id)
    if (filters.status && filters.status !== updatedInquiry.status) loadList()
  }

  const handleAssignmentUpdated = async (updatedInquiry) => {
    const assignedToName = assignees.find(
      (assignee) => assignee.id === updatedInquiry.assigned_to,
    )?.full_name ?? null
    const updateWithName = { ...updatedInquiry, assigned_to_name: assignedToName }
    setInquiries((current) =>
      syncInquiryAssignment(current, updateWithName, assignedToName))
    setSelectedInquiry((current) => current
      ? { ...current, ...updateWithName }
      : current)
    await loadDetails(updatedInquiry.id)
  }

  const handleFollowUpUpdated = async (updatedInquiry) => {
    setInquiries((current) => current.map((inquiry) =>
      inquiry.id === updatedInquiry.id
        ? {
            ...inquiry,
            follow_up_at: updatedInquiry.follow_up_at,
            follow_up_note: updatedInquiry.follow_up_note,
          }
        : inquiry))
    setSelectedInquiry((current) => current
      ? {
          ...current,
          follow_up_at: updatedInquiry.follow_up_at,
          follow_up_note: updatedInquiry.follow_up_note,
        }
      : current)
    await loadDetails(updatedInquiry.id)
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
              onClick={() => setMobileMenuOpen(false)}
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
              <span className="ml-auto text-[0.58rem] uppercase tracking-[0.12em]">Soon</span>
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

        <main className="mx-auto w-full max-w-[90rem] px-4 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">
          {inquiryId ? (
            <section aria-busy={isLoadingDetails}>
              {detailsError ? (
                <div className="mt-2 border-y border-[var(--line)] py-8" role="alert">
                  <p className="text-sm text-[var(--brown)]">{detailsError}</p>
                  <div className="mt-4 flex gap-4">
                    <button
                      className="text-sm font-medium underline"
                      onClick={() => loadDetails(inquiryId)}
                      type="button"
                    >
                      Try again
                    </button>
                    <button
                      className="text-sm text-[var(--muted)]"
                      onClick={closeDetails}
                      type="button"
                    >
                      Back to inquiries
                    </button>
                  </div>
                </div>
              ) : !selectedInquiry || selectedInquiry.id !== inquiryId ? (
                <p className="py-12 text-center text-sm text-[var(--muted)]" role="status">
                  Loading inquiry…
                </p>
              ) : (
                <InquiryDetails
                  activities={activities}
                  assignees={assignees}
                  currentUserId={user.id}
                  currentUserName={displayName}
                  inquiry={selectedInquiry}
                  key={selectedInquiry.id}
                  messages={messages}
                  onAssignmentUpdated={handleAssignmentUpdated}
                  onBack={closeDetails}
                  onFollowUpUpdated={handleFollowUpUpdated}
                  onNoteAdded={() => loadDetails(selectedInquiry.id)}
                  onRefresh={() => loadDetails(selectedInquiry.id)}
                  onStatusUpdated={handleStatusUpdated}
                  request={request}
                />
              )}
            </section>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow">Customer workspace</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Inquiries
                  </h1>
                </div>
                <p aria-live="polite" className="text-sm text-[var(--muted)]">
                  {isLoading
                    ? 'Loading…'
                    : `${pagination.total} ${pagination.total === 1 ? 'inquiry' : 'inquiries'}`}
                </p>
              </div>

              <section
                aria-label="Inquiry list and filters"
                className="mt-6 border-y border-[var(--line)]"
              >
                <form
                  className="grid gap-3 py-4 md:grid-cols-2 xl:grid-cols-[minmax(14rem,2fr)_repeat(3,minmax(9rem,1fr))_minmax(10rem,1fr)_auto_auto]"
                  onSubmit={handleSearch}
                >
                  <label className="text-xs text-[var(--muted)] md:col-span-2 xl:col-span-1">
                    Search
                    <input
                      className="mt-1 min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm text-[var(--charcoal)]"
                      maxLength={100}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Name, email, subject, or ID"
                      value={searchInput}
                    />
                  </label>
                  <label className="text-xs text-[var(--muted)]">
                    Status
                    <select
                      className="mt-1 min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
                      onChange={(event) => handleFilterChange('status', event.target.value)}
                      value={filters.status}
                    >
                      <option value="">All statuses</option>
                      {inquiryStatuses.map((status) => (
                        <option key={status} value={status}>{formatInquiryStatus(status)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-[var(--muted)]">
                    Category
                    <select
                      className="mt-1 min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
                      onChange={(event) => handleFilterChange('category', event.target.value)}
                      value={filters.category}
                    >
                      <option value="">All categories</option>
                      {inquiryCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-[var(--muted)]">
                    Assignment
                    <select
                      className="mt-1 min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
                      onChange={(event) => handleFilterChange('assigned_to', event.target.value)}
                      value={filters.assigned_to}
                    >
                      <option value="">All assignees</option>
                      <option value="unassigned">Unassigned</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>{assignee.full_name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-[var(--muted)]">
                    Sort
                    <select
                      className="mt-1 min-h-10 w-full border border-[var(--line)] bg-[var(--panel)] px-3 text-sm"
                      onChange={(event) => handleFilterChange('sort', event.target.value)}
                      value={filters.sort}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="recently_updated">Recently updated</option>
                      <option value="oldest_updated">Least recently updated</option>
                    </select>
                  </label>
                  <button
                    className="min-h-10 self-end bg-[var(--charcoal)] px-4 text-xs font-medium text-white hover:bg-[var(--brown)]"
                    type="submit"
                  >
                    Search
                  </button>
                  <button
                    className="min-h-10 self-end px-3 text-xs text-[var(--muted)] hover:text-[var(--charcoal)]"
                    onClick={clearFilters}
                    type="button"
                  >
                    Clear
                  </button>
                </form>

                {assigneesError && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] py-3 text-xs text-[var(--brown)]" role="alert">
                    <span>{assigneesError}</span>
                    <button className="underline" onClick={refreshAssignees} type="button">
                      Retry assignees
                    </button>
                  </div>
                )}

                {listError ? (
                  <div className="border-t border-[var(--line)] py-10 text-center" role="alert">
                    <p className="text-sm text-[var(--brown)]">{listError}</p>
                    <button
                      className="mt-3 text-sm underline"
                      onClick={loadList}
                      type="button"
                    >
                      Try again
                    </button>
                  </div>
                ) : isLoading ? (
                  <p className="border-t border-[var(--line)] py-10 text-center text-sm text-[var(--muted)]" role="status">
                    Loading inquiries…
                  </p>
                ) : inquiries.length === 0 ? (
                  <div className="border-t border-[var(--line)] py-10 text-center">
                    <p className="text-sm font-medium">No inquiries found</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {filters.search || filters.status || filters.category ||
                      filters.assigned_to
                        ? 'Try adjusting your search or filters.'
                        : 'New customer inquiries will appear here.'}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {inquiries.map((inquiry) => (
                      <li key={inquiry.id}>
                        <button
                          className="grid w-full gap-2 py-4 text-left transition-colors hover:bg-[var(--panel)] sm:px-2 lg:grid-cols-[minmax(0,1fr)_9rem_12rem_8rem] lg:items-center lg:gap-5"
                          onClick={() => openInquiry(inquiry.id)}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {inquiry.name}
                            </span>
                            <span className="mt-1 block truncate text-sm text-[var(--muted)]">
                              {inquiry.subject}
                              {inquiry.category ? ` · ${inquiry.category}` : ''}
                            </span>
                          </span>
                          <span className="text-xs text-[var(--brown)]">
                            {formatInquiryStatus(inquiry.status)}
                          </span>
                          <span className="truncate text-xs text-[var(--muted)]">
                            {getInquiryAssigneeLabel(inquiry)}
                          </span>
                          <time
                            className="text-xs text-[var(--muted)]"
                            dateTime={inquiry.created_at}
                          >
                            {formatInquiryDate(inquiry.created_at)}
                          </time>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between border-t border-[var(--line)] py-3 text-xs text-[var(--muted)]">
                  <span>
                    {pagination.total} {pagination.total === 1 ? 'inquiry' : 'inquiries'}
                    {pagination.totalPages > 0 && (
                      <> · Page {pagination.page} of {pagination.totalPages}</>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="min-h-9 border border-[var(--line)] px-3 disabled:opacity-40"
                      disabled={isLoading || page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      type="button"
                    >
                      Previous
                    </button>
                    <button
                      className="min-h-9 border border-[var(--line)] px-3 disabled:opacity-40"
                      disabled={isLoading || page >= pagination.totalPages}
                      onClick={() => setPage((current) => current + 1)}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          <p className="mt-7 text-center text-xs text-[var(--muted)]">
            Braunwork Builders Corporation · Inquiry Management
          </p>
        </main>
      </div>
    </div>
  )
}

export default InquiryManagement
