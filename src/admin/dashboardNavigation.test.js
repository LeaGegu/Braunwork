import assert from 'node:assert/strict'
import test from 'node:test'
import { getDashboardNavigation } from './dashboardNavigation.js'

test('admin navigation includes staff management', () => {
  const labels = getDashboardNavigation('admin').map((item) => item.label)
  assert.deepEqual(labels, [
    'Dashboard',
    'Inquiries',
    'Staff Management',
    'Settings',
  ])
})

test('staff navigation does not include staff management', () => {
  const labels = getDashboardNavigation('staff').map((item) => item.label)
  assert.deepEqual(labels, ['Dashboard', 'Inquiries', 'Settings'])
})
