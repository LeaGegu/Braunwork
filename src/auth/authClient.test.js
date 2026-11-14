import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthClient } from './authClient.js'

const user = { id: 'user-test', email: 'staff@example.test' }
const staffProfile = {
  id: user.id,
  full_name: 'Test Staff',
  role: 'staff',
  can_manage_inquiries: false,
  is_active: true,
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function loginResponse(accessToken = 'access-one', refresh = 'refresh-one') {
  return jsonResponse(200, {
    success: true,
    user,
    staffProfile,
    access_token: accessToken,
    refresh_token: refresh,
  })
}

function currentUserResponse(status = 200) {
  return jsonResponse(
    status,
    status === 200
      ? { success: true, user, staffProfile }
      : { success: false, message: 'internal detail must not be surfaced' },
  )
}

async function login(client) {
  return client.login(user.email, 'dummy-password')
}

test('login stores an in-memory session only after backend and /me success', async () => {
  const calls = []
  const client = createAuthClient(async (path, options) => {
    calls.push({ path, options })
    return path.endsWith('/login') ? loginResponse() : currentUserResponse()
  })

  const result = await login(client)

  assert.equal(result.isAuthenticated, true)
  assert.deepEqual(result.user, user)
  assert.deepEqual(result.staffProfile, staffProfile)
  assert.equal(client.hasSession(), true)
  assert.deepEqual(calls.map(({ path }) => path), [
    '/api/auth/login',
    '/api/auth/me',
  ])
  assert.equal(calls[0].options.body.includes('dummy-password'), true)
});

test('login failure exposes a safe message and does not create a session', async () => {
  const client = createAuthClient(async () =>
    jsonResponse(401, { message: 'private auth provider error' }),
  )

  await assert.rejects(login(client), {
    message: 'The email address or password is incorrect.',
  })
  assert.equal(client.hasSession(), false)
  assert.equal(client.getSnapshot().isAuthenticated, false)
})

test('login clears tokens if backend verification with /me fails', async () => {
  const client = createAuthClient(async (path) =>
    path.endsWith('/login') ? loginResponse() : currentUserResponse(403),
  )

  await assert.rejects(login(client), {
    message: 'This account no longer has staff access.',
  })
  assert.equal(client.hasSession(), false)
})

test('current-user loading uses the Bearer token and verified profile', async () => {
  let meRequest
  const client = createAuthClient(async (path, options) => {
    if (path.endsWith('/login')) {
      return loginResponse()
    }
    meRequest = options
    return currentUserResponse()
  })

  await login(client)
  const result = await client.getCurrentUser()

  assert.equal(meRequest.headers.get('Authorization'), 'Bearer access-one')
  assert.deepEqual(result.staffProfile, staffProfile)
})

test('current-user loading refreshes an expired access token', async () => {
  const paths = []
  const client = createAuthClient(async (path) => {
    paths.push(path)
    if (path.endsWith('/login')) return loginResponse()
    if (path.endsWith('/refresh')) {
      return jsonResponse(200, {
        access_token: 'access-two',
        refresh_token: 'refresh-two',
      })
    }
    if (path.endsWith('/me') && paths.filter((item) => item.endsWith('/me')).length === 2) {
      return currentUserResponse(401)
    }
    return currentUserResponse()
  })

  await login(client)
  await client.getCurrentUser()

  assert.deepEqual(paths.slice(-3), [
    '/api/auth/me',
    '/api/auth/refresh',
    '/api/auth/me',
  ])
  assert.equal(client.hasSession(), true)
})

test('refresh failure clears session and returns a safe error', async () => {
  const client = createAuthClient(async (path) => {
    if (path.endsWith('/login')) return loginResponse()
    if (path.endsWith('/refresh')) {
      return jsonResponse(401, { message: 'private refresh error' })
    }
    if (path.endsWith('/private')) return currentUserResponse(401)
    return currentUserResponse()
  })

  await login(client)
  await assert.rejects(client.request('/api/private'), {
    message: 'Your session has expired. Please sign in again.',
  })
  assert.equal(client.hasSession(), false)
  assert.equal(client.getSnapshot().isAuthenticated, false)
})

test('simultaneous unauthorized requests share one refresh and retry once', async () => {
  let privateCalls = 0
  let refreshCalls = 0
  const client = createAuthClient(async (path) => {
    if (path.endsWith('/login')) return loginResponse()
    if (path.endsWith('/refresh')) {
      refreshCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return jsonResponse(200, {
        access_token: 'access-two',
        refresh_token: 'refresh-two',
      })
    }
    if (path.endsWith('/me')) return currentUserResponse()
    if (path.startsWith('/api/private')) {
      privateCalls += 1
      return privateCalls <= 2
        ? currentUserResponse(401)
        : jsonResponse(200, { success: true })
    }
    return jsonResponse(404, {})
  })

  await login(client)
  const [first, second] = await Promise.all([
    client.request('/api/private/one'),
    client.request('/api/private/two'),
  ])

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(privateCalls, 4)
  assert.equal(refreshCalls, 1)
})

test('an API request is not retried again after its single retry is unauthorized', async () => {
  let privateCalls = 0
  let refreshCalls = 0
  const client = createAuthClient(async (path) => {
    if (path.endsWith('/login')) return loginResponse()
    if (path.endsWith('/refresh')) {
      refreshCalls += 1
      return jsonResponse(200, {
        access_token: 'access-two',
        refresh_token: 'refresh-two',
      })
    }
    if (path.endsWith('/me')) return currentUserResponse()
    if (path.endsWith('/private')) {
      privateCalls += 1
      return currentUserResponse(401)
    }
    return jsonResponse(404, {})
  })

  await login(client)
  const response = await client.request('/api/private')

  assert.equal(response.status, 401)
  assert.equal(privateCalls, 2)
  assert.equal(refreshCalls, 1)
  assert.equal(client.hasSession(), true)
})

test('logout success clears local auth state and calls backend with both tokens', async () => {
  let logoutRequest
  const client = createAuthClient(async (path, options) => {
    if (path.endsWith('/login')) return loginResponse()
    if (path.endsWith('/logout')) {
      logoutRequest = options
      return jsonResponse(200, { success: true })
    }
    return currentUserResponse()
  })

  await login(client)
  await client.logout()

  assert.equal(logoutRequest.headers.get('Authorization'), 'Bearer access-one')
  assert.deepEqual(JSON.parse(logoutRequest.body), {
    refresh_token: 'refresh-one',
  })
  assert.equal(client.hasSession(), false)
  assert.equal(client.getSnapshot().isAuthenticated, false)
})

test('logout failure clears local state and reports that revocation is unconfirmed', async () => {
  const client = createAuthClient(async (path) => {
    if (path.endsWith('/login')) return loginResponse()
    if (path.endsWith('/logout')) {
      return jsonResponse(503, { message: 'private logout error' })
    }
    return currentUserResponse()
  })

  await login(client)
  await assert.rejects(client.logout(), {
    message: 'Unable to confirm server sign out. Please try again.',
  })
  assert.equal(client.hasSession(), false)
  assert.equal(client.getSnapshot().isAuthenticated, false)
})
