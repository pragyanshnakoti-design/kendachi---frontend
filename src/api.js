// All API calls go through this file.
// Base URL uses Vite proxy in dev (/api → localhost:3001/api).
// In production set VITE_API_URL env var.

const BASE = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('kendachi_token')
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

const get  = (path)        => request('GET',    path)
const post = (path, body)  => request('POST',   path, body)

// ── Auth ────────────────────────────────────────────────
export const auth = {
  requestOtp:  (email)        => post('/api/auth/request-otp', { email }),
  verifyOtp:   (email, code)  => post('/api/auth/verify-otp',  { email, code }),
  logout:      ()             => post('/api/auth/logout'),
  me:          ()             => get('/api/auth/me'),
  register:    (data)         => post('/api/auth/register', data),
}

// ── Work Session ────────────────────────────────────────
export const session = {
  start:       ()              => post('/api/session/start'),
  stop:        (id, notes)    => post('/api/session/stop',      { work_session_id: id, notes }),
  heartbeat:   (payload)      => post('/api/session/heartbeat', payload),
  signal:      (payload)      => post('/api/session/signal', payload),
  active:      ()              => get('/api/session/active'),
}

// ── Overtime ────────────────────────────────────────────
export const overtime = {
  request:     (data)          => post('/api/overtime/request',     data),
  comment:     (id, note)      => post(`/api/overtime/${id}/comment`, { note }),
  decide:      (id, decision, admin_note) =>
    post(`/api/overtime/${id}/decide`, { decision, admin_note }),
  my:          ()              => get('/api/overtime/my'),
  pending:     ()              => get('/api/overtime/pending'),
  queue:       ()              => get('/api/manager/overtime-queue'),
}

// ── Employee (self) ─────────────────────────────────────
export const employee = {
  records:     (params = {})   => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/employee/records${q ? '?' + q : ''}`)
  },
  record:      (id)            => get(`/api/employee/records/${id}`),
  today:       ()              => get('/api/employee/today'),
  exportProof: (params = {})   => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/employee/export${q ? '?' + q : ''}`)
  },
}

// ── Manager ─────────────────────────────────────────────
export const manager = {
  employees:   ()              => get('/api/manager/employees'),
  hours:       (params = {})   => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/manager/hours${q ? '?' + q : ''}`)
  },
  otQueue:     ()              => get('/api/manager/overtime-queue'),
}

// ── Admin ────────────────────────────────────────────────
export const admin = {
  dashboard:   ()              => get('/api/admin/dashboard'),
  records:     (params = {})   => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/admin/records${q ? '?' + q : ''}`)
  },
  correct:     (data)          => post('/api/admin/correct', data),
  auditLog:    (params = {})   => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/admin/audit-log${q ? '?' + q : ''}`)
  },
  anomalies:   ()              => get('/api/admin/anomalies'),
  resolveFlag: (id)            => post(`/api/admin/anomalies/${id}/resolve`),
  exportFull:  (params = {})   => {
    const q = new URLSearchParams(params).toString()
    return get(`/api/admin/export-full${q ? '?' + q : ''}`)
  },
  deactivate:  (id)            => post(`/api/admin/employees/${id}/deactivate`),
  pending:     ()              => get('/api/overtime/pending'),
  otDecide:    (id, d, n)      => post(`/api/overtime/${id}/decide`, { decision: d, admin_note: n }),
}

// ── Helpers ──────────────────────────────────────────────
export function fmtSeconds(s) {
  if (!s) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${m}:${String(sec).padStart(2,'0')}`
}

export function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
