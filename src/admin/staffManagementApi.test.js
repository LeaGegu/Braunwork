import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inviteStaffMember,
  loadStaffProfiles,
  updateStaffMember,
} from './staffManagementApi.js'

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    async json() {
      return payload
    },
  }
}

test('loads staff profiles from the protected API', async () => {
  const profile = { id: 'staff-id', role: 'staff' }
  let path
  const profiles = await loadStaffProfiles(async (requestPath) => {
    path = requestPath
    return response(200, { success: true, data: [profile] })
  })

  assert.equal(path, '/api/admin/staff')
  assert.deepEqual(profiles, [profile])
})

test('sends an invitation payload to the protected API', async () => {
  const member = {
    email: 'staff@example.com',
    full_name: 'Staff User',
    role: 'staff',
    can_manage_inquiries: false,
  }
  let requestOptions
  const result = await inviteStaffMember(async (path, options) => {
    assert.equal(path, '/api/admin/staff')
    requestOptions = options
    return response(201, { success: true, data: { id: 'staff-id' } })
  }, member)

  assert.equal(requestOptions.method, 'POST')
  assert.deepEqual(JSON.parse(requestOptions.body), member)
  assert.deepEqual(result, { id: 'staff-id' })
})

test('updates a staff profile and encodes the user identifier', async () => {
  let receivedPath
  const result = await updateStaffMember(
    async (path, options) => {
      receivedPath = path
      assert.equal(options.method, 'PATCH')
      return response(200, { success: true, data: { id: 'user/id' } })
    },
    'user/id',
    { is_active: false },
  )

  assert.equal(receivedPath, '/api/admin/staff/user%2Fid')
  assert.deepEqual(result, { id: 'user/id' })
})

test('surfaces a safe server error message', async () => {
  await assert.rejects(
    loadStaffProfiles(async () =>
      response(503, {
        success: false,
        message: 'Unable to load staff accounts right now.',
      }),
    ),
    /Unable to load staff accounts right now/,
  )
})

test('rejects malformed success payloads', async () => {
  await assert.rejects(
    loadStaffProfiles(async () => response(200, { success: true, data: null })),
    /response was invalid/,
  )
})
