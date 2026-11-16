import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { getDashboardNavigation } from './dashboardNavigation.js'
import {
  inviteStaffMember,
  loadStaffProfiles,
  updateStaffMember,
} from './staffManagementApi.js'

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

function StaffManagement() {
  const { user, staffProfile, logout, request } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [staff, setStaff] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'staff',
    can_manage_inquiries: false,
  })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const navigationItems = getDashboardNavigation(
    staffProfile.role,
    location.pathname,
    staffProfile.can_manage_inquiries,
  )
  const activeAdmins = useMemo(
    () => staff.filter(
      (member) => member.role === 'admin' && member.is_active,
    ).length,
    [staff],
  )

  const loadStaff = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      setStaff(await loadStaffProfiles(request))
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [request])

  useEffect(() => {
    const timer = setTimeout(loadStaff, 0)
    return () => clearTimeout(timer)
  }, [loadStaff])

  if (staffProfile.role !== 'admin') {
    return <Navigate replace to="/admin" />
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

  const handleInvite = async (event) => {
    event.preventDefault()
    setNotice('')
    setLoadError('')
    setIsSaving(true)
    try {
      await inviteStaffMember(request, inviteForm)
      setInviteForm({
        email: '',
        full_name: '',
        role: 'staff',
        can_manage_inquiries: false,
      })
      setNotice('Invitation sent successfully.')
      await loadStaff()
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = (member) => {
    setNotice('')
    setEditingId(member.id)
    setEditForm({
      full_name: member.full_name,
      role: member.role,
      is_active: member.is_active,
      can_manage_inquiries: member.can_manage_inquiries,
    })
  }

  const handleUpdate = async (event) => {
    event.preventDefault()
    if (!editingId || !editForm) {
      return
    }
    setNotice('')
    setLoadError('')
    setIsSaving(true)
    try {
      const updatedProfile = await updateStaffMember(
        request,
        editingId,
        editingId === user.id
          ? { full_name: editForm.full_name }
          : editForm,
      )
      setStaff((current) => current.map((member) =>
        member.id === updatedProfile.id ? updatedProfile : member,
      ))
      setEditingId(null)
      setEditForm(null)
      setNotice('Staff account updated successfully.')
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsSaving(false)
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
            <p className="truncate text-sm font-medium">
              {staffProfile.full_name?.trim() || user.email}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Administrator</p>
          </div>
          <button
            className="flex w-full items-center gap-3 border-t border-[var(--line)] px-4 py-4 text-left text-sm text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--charcoal)] disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={handleLogout}
            type="button"
          >
            <NavigationIcon name="logout" />
            <span>{isLoggingOut ? 'Signing out…' : 'Log out'}</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-[var(--line)] bg-[rgba(245,241,235,0.94)] px-4 sm:px-7 lg:h-20 lg:px-10">
          <p className="text-sm text-[var(--muted)]">Admin workspace</p>
          <p className="max-w-48 truncate text-sm font-medium">
            {staffProfile.full_name?.trim() || user.email}
          </p>
        </header>
        <main className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
          <div className="mb-8 lg:hidden">
            {navigation}
            <button
              className="mt-3 flex w-full items-center gap-3 border-t border-[var(--line)] px-4 py-4 text-left text-sm text-[var(--muted)]"
              disabled={isLoggingOut}
              onClick={handleLogout}
              type="button"
            >
              <NavigationIcon name="logout" />
              <span>{isLoggingOut ? 'Signing out…' : 'Log out'}</span>
            </button>
          </div>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Administration</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Staff Management
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Invite staff, maintain account access, and manage inquiry permissions.
              </p>
            </div>
            <span className="inline-flex w-fit border border-[var(--taupe)] bg-[var(--bg-warm)] px-3 py-2 text-xs font-medium text-[var(--brown)]">
              {staff.length} {staff.length === 1 ? 'staff account' : 'staff accounts'}
            </span>
          </div>

          {notice && (
            <p className="mt-6 border border-[var(--taupe)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--brown)]" role="status">
              {notice}
            </p>
          )}
          {loadError && (
            <div className="mt-6 flex flex-col gap-3 border border-[var(--line)] bg-[var(--panel)] px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert">
              <p className="text-[var(--brown)]">{loadError}</p>
              <button
                className="w-fit border border-[var(--line)] px-3 py-2 hover:bg-[var(--bg-warm)]"
                onClick={loadStaff}
                type="button"
              >
                Try again
              </button>
            </div>
          )}

          <section aria-labelledby="invite-heading" className="mt-8 border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-soft)] sm:p-7">
            <div className="mb-5">
              <p className="eyebrow">New account</p>
              <h2 className="mt-1 text-xl font-semibold" id="invite-heading">
                Invite a staff member
              </h2>
            </div>
            <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleInvite}>
              <label className="grid gap-2 text-sm">
                Full name
                <input
                  autoComplete="name"
                  className="min-h-11 border border-[var(--line)] bg-white px-3"
                  maxLength={120}
                  onChange={(event) => setInviteForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))}
                  required
                  value={inviteForm.full_name}
                />
              </label>
              <label className="grid gap-2 text-sm">
                Email address
                <input
                  autoComplete="email"
                  className="min-h-11 border border-[var(--line)] bg-white px-3"
                  maxLength={254}
                  onChange={(event) => setInviteForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))}
                  required
                  type="email"
                  value={inviteForm.email}
                />
              </label>
              <label className="grid gap-2 text-sm">
                Role
                <select
                  className="min-h-11 border border-[var(--line)] bg-white px-3"
                  onChange={(event) => setInviteForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))}
                  value={inviteForm.role}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <div className="flex flex-col justify-end gap-3">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    checked={inviteForm.can_manage_inquiries}
                    onChange={(event) => setInviteForm((current) => ({
                      ...current,
                      can_manage_inquiries: event.target.checked,
                    }))}
                    type="checkbox"
                  />
                  Can manage inquiries
                </label>
                <button
                  className="min-h-11 bg-[var(--charcoal)] px-4 text-sm font-medium text-white hover:bg-[var(--brown)] disabled:cursor-wait disabled:opacity-60"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? 'Sending invitation…' : 'Send invitation'}
                </button>
              </div>
            </form>
          </section>

          <section aria-labelledby="staff-list-heading" className="mt-8">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Accounts</p>
                <h2 className="mt-1 text-xl font-semibold" id="staff-list-heading">
                  Staff directory
                </h2>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {activeAdmins} active {activeAdmins === 1 ? 'administrator' : 'administrators'}
              </p>
            </div>
            <div className="overflow-hidden border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow-soft)]">
              {isLoading ? (
                <p className="px-5 py-12 text-center text-sm text-[var(--muted)]" role="status">
                  Loading staff accounts…
                </p>
              ) : staff.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">
                  No staff accounts are available.
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {staff.map((member) => {
                    const isSelf = member.id === user.id
                    const editing = editingId === member.id
                    const isLastActiveAdmin = member.role === 'admin' &&
                      member.is_active &&
                      activeAdmins <= 1

                    return (
                      <article className="p-5 sm:p-6" key={member.id}>
                        {editing && editForm ? (
                          <form className="grid gap-4 lg:grid-cols-[minmax(12rem,1fr)_repeat(3,minmax(8rem,0.7fr))_auto]" onSubmit={handleUpdate}>
                            <label className="grid gap-2 text-sm">
                              Full name
                              <input
                                className="min-h-10 border border-[var(--line)] bg-white px-3"
                                maxLength={120}
                                onChange={(event) => setEditForm((current) => ({
                                  ...current,
                                  full_name: event.target.value,
                                }))}
                                required
                                value={editForm.full_name}
                              />
                            </label>
                            <label className="grid gap-2 text-sm">
                              Role
                              <select
                                className="min-h-10 border border-[var(--line)] bg-white px-3"
                                disabled={isSelf || isLastActiveAdmin}
                                onChange={(event) => setEditForm((current) => ({
                                  ...current,
                                  role: event.target.value,
                                }))}
                                value={editForm.role}
                              >
                                <option value="staff">Staff</option>
                                <option value="admin">Administrator</option>
                              </select>
                            </label>
                            <label className="grid gap-2 text-sm">
                              Status
                              <select
                                className="min-h-10 border border-[var(--line)] bg-white px-3"
                                disabled={isSelf || isLastActiveAdmin}
                                onChange={(event) => setEditForm((current) => ({
                                  ...current,
                                  is_active: event.target.value === 'active',
                                }))}
                                value={editForm.is_active ? 'active' : 'inactive'}
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm">
                              <input
                                checked={editForm.can_manage_inquiries}
                                disabled={isSelf}
                                onChange={(event) => setEditForm((current) => ({
                                  ...current,
                                  can_manage_inquiries: event.target.checked,
                                }))}
                                type="checkbox"
                              />
                              Manage inquiries
                            </label>
                            <div className="flex items-end gap-2">
                              <button
                                className="min-h-10 bg-[var(--charcoal)] px-3 text-sm text-white disabled:opacity-60"
                                disabled={isSaving}
                                type="submit"
                              >
                                Save
                              </button>
                              <button
                                className="min-h-10 border border-[var(--line)] px-3 text-sm"
                                onClick={() => {
                                  setEditingId(null)
                                  setEditForm(null)
                                }}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                            {isSelf && (
                              <p className="text-xs text-[var(--muted)] lg:col-span-full">
                                Your role, inquiry permission, and account status cannot be changed here.
                              </p>
                            )}
                          </form>
                        ) : (
                          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {member.full_name || 'Unnamed staff member'}
                                {isSelf && (
                                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                                    You
                                  </span>
                                )}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className="border border-[var(--line)] px-2 py-1">
                                  {member.role === 'admin' ? 'Administrator' : 'Staff'}
                                </span>
                                <span className={`border px-2 py-1 ${
                                  member.is_active
                                    ? 'border-[var(--taupe)] text-[var(--brown)]'
                                    : 'border-[var(--line)] text-[var(--muted)]'
                                }`}>
                                  {member.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <span className="border border-[var(--line)] px-2 py-1 text-[var(--muted)]">
                                  {member.can_manage_inquiries
                                    ? 'Can manage inquiries'
                                    : 'No inquiry management'}
                                </span>
                              </div>
                            </div>
                            <button
                              className="w-fit border border-[var(--line)] px-4 py-2 text-sm hover:bg-[var(--bg-warm)]"
                              onClick={() => startEditing(member)}
                              type="button"
                            >
                              Manage
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
          <p className="mt-7 text-center text-xs text-[var(--muted)]">
            Braunwork Builders Corporation · Admin workspace
          </p>
        </main>
      </div>
    </div>
  )
}

export default StaffManagement
