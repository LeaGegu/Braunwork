export function getProtectedRouteDecision({ initialized, user, staffProfile }) {
  if (!initialized) {
    return 'loading'
  }

  const validProfile = staffProfile &&
    staffProfile.id === user?.id &&
    staffProfile.is_active === true &&
    ['admin', 'staff'].includes(staffProfile.role)

  return user && validProfile ? 'allow' : 'redirect'
}

export function getAdminRedirect(locationState) {
  const from = locationState?.from
  const pathname = from?.pathname

  if (
    typeof pathname !== 'string' ||
    (pathname !== '/admin' && !pathname.startsWith('/admin/')) ||
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login/')
  ) {
    return '/admin'
  }

  const search = typeof from.search === 'string' ? from.search : ''
  const hash = typeof from.hash === 'string' ? from.hash : ''
  return `${pathname}${search}${hash}`
}
