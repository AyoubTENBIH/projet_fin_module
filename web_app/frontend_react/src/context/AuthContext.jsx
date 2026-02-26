import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ecoAgadirApi, getToken, clearSession } from '../utils/ecoAgadirApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('ecoagadir_user')
      return s ? JSON.parse(s) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(!!getToken())

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await ecoAgadirApi.auth.me()
      setUser(data.user)
      if (data.user) localStorage.setItem('ecoagadir_user', JSON.stringify(data.user))
    } catch {
      setUser(null)
      clearSession()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getToken() && !user) refreshUser()
    else setLoading(false)
  }, [refreshUser, user])

  const login = useCallback(async (email, password) => {
    const { redirect, user: u } = await ecoAgadirApi.auth.login(email, password)
    setUser(u)
    return { redirect }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
