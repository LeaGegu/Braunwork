import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAdminRedirect,
  getProtectedRouteDecision,
} from './protectedRoutePolicy.js'

const user = { id: 'staff-123' }

test('protected route stays on a loading screen until auth initializes', () => {
  assert.equal(
    getProtectedRouteDecision({
      initialized: false,
      user: null,
      staffProfile: null,
    }),
    'loading',
  )
})

test('protected route allows an authenticated active admin profile', () => {
  assert.equal(
    getProtectedRouteDecision({
      initialized: true,
      user,
      staffProfile: {
        id: user.id,
        role: 'admin',
        is_active: true,
      },
    }),
    'allow',
  )
})

test('protected route allows an authenticated active staff profile', () => {
  assert.equal(
    getProtectedRouteDecision({
      initialized: true,
      user,
      staffProfile: {
        id: user.id,
        role: 'staff',
        is_active: true,
      },
    }),
    'allow',
  )
})

test('protected route redirects unauthenticated visitors', () => {
  assert.equal(
    getProtectedRouteDecision({
      initialized: true,
      user: null,
      staffProfile: null,
    }),
    'redirect',
  )
})

test('protected route rejects missing, inactive, mismatched, or unsupported profiles', () => {
  const profiles = [
    null,
    { id: user.id, role: 'admin', is_active: false },
    { id: 'another-user', role: 'admin', is_active: true },
    { id: user.id, role: 'visitor', is_active: true },
  ]

  for (const staffProfile of profiles) {
    assert.equal(
      getProtectedRouteDecision({
        initialized: true,
        user,
        staffProfile,
      }),
      'redirect',
    )
  }
})

test('login redirect preserves only valid admin destinations', () => {
  assert.equal(
    getAdminRedirect({
      from: { pathname: '/admin/inquiries', search: '?status=new', hash: '#list' },
    }),
    '/admin/inquiries?status=new#list',
  )
  assert.equal(
    getAdminRedirect({ from: { pathname: '/admin/login' } }),
    '/admin',
  )
  assert.equal(
    getAdminRedirect({ from: { pathname: 'https://example.test/evil' } }),
    '/admin',
  )
})
