const navigationItems = [
  { label: 'Dashboard', icon: 'grid', to: '/admin' },
  {
    label: 'Inquiries',
    icon: 'inbox',
    to: '/admin/inquiries',
    inquiryPermission: true,
  },
  { label: 'Staff Management', icon: 'people', to: '/admin/staff', adminOnly: true },
  { label: 'Settings', icon: 'settings', comingSoon: true },
]

export function getDashboardNavigation(
  role,
  currentPath = '/admin',
  canManageInquiries = false,
) {
  return navigationItems
    .filter((item) =>
      (!item.adminOnly || role === 'admin') &&
      (
        !item.inquiryPermission ||
        role === 'admin' ||
        (role === 'staff' && canManageInquiries === true)
      )
    )
    .map((item) => ({
      ...item,
      active: item.to === currentPath ||
        item.to === '/admin/inquiries' &&
        currentPath.startsWith('/admin/inquiries/'),
    }))
}
