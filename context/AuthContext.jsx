import React, { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount, check if token is still valid
  useEffect(() => {
    const token = localStorage.getItem('kendachi_token')
    if (!token) { setLoading(false); return }

    auth.me()
      .then(data => setUser(data.employee))
      .catch(() => {
        localStorage.removeItem('kendachi_token')
        localStorage.removeItem('kendachi_user')
      })
      .finally(() => setLoading(false))
  }, [])

  function login(token, employee) {
    localStorage.setItem('kendachi_token', token)
    localStorage.setItem('kendachi_user',  JSON.stringify(employee))
    setUser(employee)
  }

  async function logout() {
    try { await auth.logout() } catch (_) {}
    localStorage.removeItem('kendachi_token')
    localStorage.removeItem('kendachi_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
