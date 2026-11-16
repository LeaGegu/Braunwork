import assert from 'node:assert/strict'
import test from 'node:test'
import { getDashboardNavigation } from './dashboardNavigation.js'

test('admin navigation includes staff management', () => {
  const navigation = getDashboardNavigation('admin')
  const labels = navigation.map((item) => item.label)
  assert.deepEqual(labels, [
    'Dashboard',
    'Inquiries',
    'Staff Management',
    'Settings',
  ])
  assert.equal(
    navigation.find((item) => item.label === 'Staff Management').to,
    '/admin/staff',
  )
  assert.equal(
    navigation.find((item) => item.label === 'Inquiries').to,
    '/admin/inquiries',
  )
  assert.equal(
    getDashboardNavigation('admin', '/admin/inquiries/00000000')
      .find((item) => item.label === 'Inquiries').active,
    true,
  )
  assert.equal(
    getDashboardNavigation('admin', '/admin/staff')
      .find((item) => item.label === 'Staff Management').active,
    true,
  )
})

test('staff navigation does not include staff management', () => {
  const labels = getDashboardNavigation('staff').map((item) => item.label)
  assert.deepEqual(labels, ['Dashboard', 'Settings'])
})

test('staff with inquiry permission can access the inquiry workspace', () => {
  const labels = getDashboardNavigation('staff', '/admin', true)
    .map((item) => item.label)
  assert.deepEqual(labels, ['Dashboard', 'Inquiries', 'Settings'])
})
