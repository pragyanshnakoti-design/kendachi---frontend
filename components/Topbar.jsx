import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Topbar({ rightSlot }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const rolePill = {
    admin:    'pill-amber',
    manager:  'pill-blue',
    employee: 'pill-green',
  }[user?.role] || 'pill-dim'

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span className="logo">KENDACHI</span>
        {user?.role === 'admin' && (
          <nav style={{ display: 'flex', gap: '4px' }}>
            <Link to="/admin"    className="tab-link">Admin</Link>
            <Link to="/manager"  className="tab-link">Manager View</Link>
            <Link to="/employee" className="tab-link">Employee View</Link>
          </nav>
        )}
        {user?.role === 'manager' && (
          <nav style={{ display: 'flex', gap: '4px' }}>
            <Link to="/manager"  className="tab-link">Manager</Link>
            <Link to="/employee" className="tab-link">My Record</Link>
          </nav>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {rightSlot}
        {user && (
          <>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
              {user.empCode}
            </span>
            <span className={`pill ${rolePill}`}>{user.role.toUpperCase()}</span>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: '10px' }}
              onClick={handleLogout}>
              LOGOUT
            </button>
          </>
        )}
      </div>

      <style>{`
        .tab-link {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: .5px;
          color: var(--dim);
          text-decoration: none;
          padding: 4px 8px;
          border-radius: var(--radius);
          transition: color .15s, background .15s;
        }
        .tab-link:hover { color: var(--text2); background: var(--surface2); }
      `}</style>
    </div>
  )
}
