const navigationItems = [
  { label: 'Dashboard', icon: 'grid', active: true },
  { label: 'Inquiries', icon: 'inbox', comingSoon: true },
  { label: 'Staff Management', icon: 'people', adminOnly: true },
  { label: 'Settings', icon: 'settings', comingSoon: true },
]

export function getDashboardNavigation(role) {
  return navigationItems.filter((item) => !item.adminOnly || role === 'admin')
}
