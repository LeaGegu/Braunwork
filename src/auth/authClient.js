const authBasePath = '/api/auth'

const messages = {
  login: {
    400: 'Please enter a valid email address and password.',
    401: 'The email address or password is incorrect.',
    403: 'This account does not have active staff access.',
    429: 'Too many sign-in attempts. Please try again later.',
    503: 'Sign-in is temporarily unavailable. Please try again later.',
  },
  currentUser: {
    401: 'Your session has expired. Please sign in again.',
    403: 'This account no longer has staff access.',
    503: 'Unable to verify your session right now.',
  },
  refresh: {
    400: 'Your session has expired. Please sign in again.',
    401: 'Your session has expired. Please sign in again.',
    403: 'This account no longer has staff access.',
    503: 'Unable to refresh your session right now.',
  },
  logout: {
    400: 'Unable to verify the session for sign out.',
    401: 'The server session could not be confirmed as revoked.',
    503: 'Unable to confirm server sign out. Please try again.',
  },
  request: {
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have permission to perform this action.',
    503: 'The service is temporarily unavailable. Please try again.',
  },
}

export class AuthApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

function messageFor(operation, status) {
  return messages[operation][status] ??
    (operation === 'login'
      ? 'Unable to sign in. Please try again.'
      : operation === 'logout'
        ? 'Unable to confirm server sign out.'
        : 'Unable to complete the request. Please try again.')
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function hasSessionTokens(payload) {
  return typeof payload?.access_token === 'string' &&
    payload.access_token.length > 0 &&
    typeof payload?.refresh_token === 'string' &&
    payload.refresh_token.length > 0
}

export function createAuthClient(fetchImplementation = globalThis.fetch) {
  let accessToken = null
  let refreshToken = null
  let refreshPromise = null
  let currentUserPromise = null
  let snapshot = {
    user: null,
    staffProfile: null,
    isAuthenticated: false,
  }
  const listeners = new Set()

  function publish(user, staffProfile) {
    snapshot = {
      user,
      staffProfile,
      isAuthenticated: Boolean(user && staffProfile),
    }
    listeners.forEach((listener) => listener())
  }

  function clearSession() {
    accessToken = null
    refreshToken = null
    publish(null, null)
  }

  async function send(path, options = {}, token = null) {
    const headers = new Headers(options.headers ?? {})
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return fetchImplementation(path, {
      ...options,
      headers,
    })
  }

  async function fetchVerifiedUser(token, operation = 'currentUser') {
    let response
    try {
      response = await send(`${authBasePath}/me`, {}, token)
    } catch {
      throw new AuthApiError(messageFor(operation, 0))
    }

    const payload = await readJson(response)
    if (!response.ok || !payload?.user || !payload?.staffProfile) {
      throw new AuthApiError(
        messageFor(operation, response.status),
        response.status,
      )
    }

    publish(payload.user, payload.staffProfile)
    return snapshot
  }

  async function rotateTokens() {
    const tokenToRefresh = refreshToken
    let response
    try {
      response = await send(
        `${authBasePath}/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: tokenToRefresh }),
        },
      )
    } catch {
      throw new AuthApiError(messageFor('refresh', 0))
    }

    const payload = await readJson(response)
    if (!response.ok || !hasSessionTokens(payload)) {
      throw new AuthApiError(
        messageFor('refresh', response.status),
        response.status,
      )
    }

    accessToken = payload.access_token
    refreshToken = payload.refresh_token
    await fetchVerifiedUser(accessToken, 'refresh')
  }

  async function refreshAfterUnauthorized(failedToken) {
    if (refreshPromise) {
      return refreshPromise
    }
    if (accessToken && accessToken !== failedToken) {
      return snapshot
    }
    if (!refreshToken) {
      clearSession()
      throw new AuthApiError(messageFor('currentUser', 401), 401)
    }

    refreshPromise = rotateTokens()
      .catch((error) => {
        clearSession()
        throw error instanceof AuthApiError
          ? error
          : new AuthApiError(messageFor('refresh', 0))
      })
      .finally(() => {
        refreshPromise = null
      })
    return refreshPromise
  }

  async function getCurrentUser() {
    if (!accessToken) {
      return null
    }
    if (currentUserPromise) {
      return currentUserPromise
    }

    const tokenForRequest = accessToken
    currentUserPromise = (async () => {
      try {
        const response = await send(`${authBasePath}/me`, {}, tokenForRequest)
        if (response.status === 401) {
          await refreshAfterUnauthorized(tokenForRequest)
          return snapshot
        }

        const payload = await readJson(response)
        if (!response.ok || !payload?.user || !payload?.staffProfile) {
          throw new AuthApiError(
            messageFor('currentUser', response.status),
            response.status,
          )
        }

        publish(payload.user, payload.staffProfile)
        return snapshot
      } catch (error) {
        if (!(error instanceof AuthApiError) || [401, 403].includes(error.status)) {
          clearSession()
        }
        throw error instanceof AuthApiError
          ? error
          : new AuthApiError(messageFor('currentUser', 0))
      }
    })().finally(() => {
      currentUserPromise = null
    })

    return currentUserPromise
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
    hasSession() {
      return Boolean(accessToken && refreshToken)
    },
    async login(email, password) {
      let response
      try {
        response = await send(`${authBasePath}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
      } catch {
        throw new AuthApiError(messageFor('login', 0))
      }

      const payload = await readJson(response)
      if (!response.ok) {
        throw new AuthApiError(
          messageFor('login', response.status),
          response.status,
        )
      }
      if (
        !hasSessionTokens(payload) ||
        !payload.user ||
        !payload.staffProfile
      ) {
        throw new AuthApiError(messageFor('login', 0))
      }

      accessToken = payload.access_token
      refreshToken = payload.refresh_token
      try {
        return await fetchVerifiedUser(accessToken)
      } catch (error) {
        clearSession()
        throw error
      }
    },
    getCurrentUser,
    async request(path, options = {}) {
      const tokenForRequest = accessToken
      let response
      try {
        response = await send(path, options, tokenForRequest)
      } catch {
        throw new AuthApiError('Unable to reach the service. Please try again.')
      }

      if (response.status !== 401 || !tokenForRequest) {
        return response
      }

      await refreshAfterUnauthorized(tokenForRequest)
      try {
        return await send(path, options, accessToken)
      } catch {
        throw new AuthApiError('Unable to reach the service. Please try again.')
      }
    },
    async logout() {
      const currentAccessToken = accessToken
      const currentRefreshToken = refreshToken
      let logoutError

      if (currentAccessToken && currentRefreshToken) {
        try {
          const response = await send(
            `${authBasePath}/logout`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                refresh_token: currentRefreshToken,
              }),
            },
            currentAccessToken,
          )

          if (!response.ok) {
            logoutError = new AuthApiError(
              messageFor('logout', response.status),
              response.status,
            )
          }
        } catch {
          logoutError = new AuthApiError(messageFor('logout', 0))
        }
      }

      clearSession()
      if (logoutError) {
        throw logoutError
      }
    },
  }
}

export const authClient = createAuthClient()
