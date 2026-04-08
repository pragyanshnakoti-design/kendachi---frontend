import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Login            from './pages/Login.jsx'
import EmployeeDashboard from './pages/EmployeeDashboard.jsx'
import ManagerDashboard  from './pages/ManagerDashboard.jsx'
import AdminDashboard    from './pages/AdminDashboard.jsx'

function RoleRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ color: 'var(--dim)', fontFamily: 'var(--mono)', padding: '40px', textAlign: 'center' }}>LOADING...</div>
  if (!user)   return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />
  if (user.role === 'admin')   return <Navigate to="/admin"    replace />
  if (user.role === 'manager') return <Navigate to="/manager"  replace />
  return <Navigate to="/employee" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"        element={<RootRedirect />} />
          <Route path="/login"   element={<Login />} />

          <Route path="/employee" element={
            <RoleRoute roles={['employee','manager','admin']}>
              <EmployeeDashboard />
            </RoleRoute>
          } />

          <Route path="/manager" element={
            <RoleRoute roles={['manager','admin']}>
              <ManagerDashboard />
            </RoleRoute>
          } />

          <Route path="/admin" element={
            <RoleRoute roles={['admin']}>
              <AdminDashboard />
            </RoleRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
