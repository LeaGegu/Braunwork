import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { authClient } from './authClient.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const snapshot = useSyncExternalStore(
    authClient.subscribe,
    authClient.getSnapshot,
    authClient.getSnapshot,
  )
  const [hasInitialSession] = useState(authClient.hasSession)
  const [loading, setLoading] = useState(hasInitialSession)
  const [initialized, setInitialized] = useState(!hasInitialSession)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!hasInitialSession) {
      return
    }

    authClient.getCurrentUser().catch((authError) => {
      setError(authError.message)
    }).finally(() => {
      setLoading(false)
      setInitialized(true)
    })
  }, [hasInitialSession])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      return await authClient.login(email, password)
    } catch (authError) {
      setError(authError.message)
      throw authError
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCurrentUser = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      return await authClient.getCurrentUser()
    } catch (authError) {
      setError(authError.message)
      throw authError
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await authClient.logout()
    } catch (authError) {
      setError(authError.message)
      throw authError
    } finally {
      setLoading(false)
    }
  }, [])

  const value = {
    ...snapshot,
    loading,
    initialized,
    error,
    login,
    logout,
    loadCurrentUser,
    request: authClient.request,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
