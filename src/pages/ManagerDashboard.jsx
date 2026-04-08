import React, { useState, useEffect } from 'react'
import Topbar from '../components/Topbar.jsx'
import { manager, overtime, fmtSeconds, fmtDate, fmtTime, fmtDateTime } from '../api.js'

export default function ManagerDashboard() {
  const [tab,        setTab]        = useState('hours')
  const [employees,  setEmployees]  = useState([])
  const [sessions,   setSessions]   = useState([])
  const [otQueue,    setOtQueue]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [filterEmp,  setFilterEmp]  = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [comment,    setComment]    = useState({id:null, text:''})
  const [commentOk,  setCommentOk]  = useState(null)

  useEffect(() => {
    manager.employees().then(d => setEmployees(d.employees || []))
  }, [])

  useEffect(() => {
    if (tab === 'hours') loadHours()
    if (tab === 'overtime') manager.otQueue().then(d => setOtQueue(d.requests || []))
  }, [tab])

  async function loadHours() {
    setLoading(true)
    const params = {}
    if (filterEmp) params.employee_id = filterEmp
    if (dateFrom)  params.from = dateFrom
    if (dateTo)    params.to   = dateTo
    manager.hours(params).then(d => setSessions(d.sessions || [])).finally(() => setLoading(false))
  }

  async function submitComment(otId) {
    try {
      await overtime.comment(otId, comment.text)
      setCommentOk(otId)
      setComment({id:null, text:''})
      setTimeout(() => setCommentOk(null), 3000)
    } catch (e) { alert(e.message) }
  }

  const totals = sessions.reduce((a, s) => ({
    total:    a.total    + (s.total_seconds    || 0),
    regular:  a.regular  + (s.regular_seconds  || 0),
    overtime: a.overtime + (s.overtime_seconds || 0),
  }), { total: 0, regular: 0, overtime: 0 })

  return (
    <div className="page">
      <Topbar />
      <div className="shell" style={{ padding:'20px', flex:1 }}>

        {/* Glass wall notice */}
        <div className="info-box fade-up" style={{ marginBottom:'20px' }}>
          MANAGER VIEW — Read only. You can see work hours and add comments on overtime requests.
          You cannot edit records, approve overtime, or export data. All your views are logged.
        </div>

        <div className="tabs">
          {['hours','overtime'].map(t => (
            <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* ── HOURS TAB ─────────────────────────────────── */}
        {tab === 'hours' && (
          <div className="fade-up">

            {/* Filters */}
            <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
              <select
                className="input"
                style={{ width:'180px' }}
                value={filterEmp}
                onChange={e => setFilterEmp(e.target.value)}
              >
                <option value="">All employees</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.emp_code})</option>
                ))}
              </select>
              <input type="date" className="input" style={{ width:'150px' }}
                value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <input type="date" className="input" style={{ width:'150px' }}
                value={dateTo} onChange={e => setDateTo(e.target.value)} />
              <button className="btn btn-ghost" onClick={loadHours}>FILTER</button>
            </div>

            {/* Summary stats */}
            {sessions.length > 0 && (
              <div className="grid3" style={{ marginBottom:'16px' }}>
                <div className="stat-tile">
                  <div className="stat-label">Total Hours</div>
                  <div className="stat-val" style={{ fontSize:'22px' }}>{fmtSeconds(totals.total)}</div>
                  <div className="stat-sub">{sessions.length} sessions</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Regular Hours</div>
                  <div className="stat-val" style={{ fontSize:'22px', color:'var(--green)' }}>{fmtSeconds(totals.regular)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Overtime Hours</div>
                  <div className="stat-val" style={{ fontSize:'22px', color: totals.overtime > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                    {fmtSeconds(totals.overtime)}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="table-wrap">
                {loading
                  ? <div style={{ padding:'32px', textAlign:'center', color:'var(--dim)' }} className="mono">LOADING...</div>
                  : (
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Dept</th>
                        <th>Date</th>
                        <th>Login</th>
                        <th>Logout</th>
                        <th>Total</th>
                        <th>OT</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.length === 0 && (
                        <tr><td colSpan="8" style={{ textAlign:'center', color:'var(--dim)', padding:'24px' }}>No sessions found</td></tr>
                      )}
                      {sessions.map(s => (
                        <tr key={s.id}>
                          <td style={{ color:'var(--text)' }}>{s.name}</td>
                          <td style={{ color:'var(--dim)' }}>{s.department || '—'}</td>
                          <td>{fmtDate(s.login_time)}</td>
                          <td>{fmtTime(s.login_time)}</td>
                          <td>{s.logout_time ? fmtTime(s.logout_time) : <span style={{color:'var(--green)'}}>ACTIVE</span>}</td>
                          <td style={{ color:'var(--text)' }}>{fmtSeconds(s.total_seconds)}</td>
                          <td style={{ color: s.overtime_seconds > 0 ? 'var(--amber)' : 'var(--dim)' }}>
                            {s.overtime_seconds > 0 ? fmtSeconds(s.overtime_seconds) : '—'}
                          </td>
                          <td>
                            {s.auto_closed
                              ? <span className="pill pill-amber">AUTO</span>
                              : s.closed
                              ? <span className="pill pill-dim">DONE</span>
                              : <span className="pill pill-green">LIVE</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="mono" style={{ fontSize:'10px', color:'var(--muted)', marginTop:'8px', textAlign:'right' }}>
              VIEW ONLY — edit buttons disabled — all views logged in audit trail
            </div>
          </div>
        )}

        {/* ── OT QUEUE TAB ──────────────────────────────── */}
        {tab === 'overtime' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Reason</th>
                      <th>Est. Hrs</th>
                      <th>Requested</th>
                      <th>Your Comment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otQueue.length === 0 && (
                      <tr><td colSpan="6" style={{ textAlign:'center', color:'var(--dim)', padding:'24px' }}>No overtime requests</td></tr>
                    )}
                    {otQueue.map(r => (
                      <tr key={r.id}>
                        <td style={{ color:'var(--text)' }}>{r.name}</td>
                        <td style={{ maxWidth:'180px', color:'var(--text2)' }}>{r.reason}</td>
                        <td>{r.estimated_hours || '—'}</td>
                        <td>{fmtDateTime(r.requested_at)}</td>
                        <td>
                          {commentOk === r.id
                            ? <span style={{color:'var(--green)', fontFamily:'var(--mono)', fontSize:'11px'}}>SAVED ✓</span>
                            : comment.id === r.id
                            ? (
                              <div style={{ display:'flex', gap:'4px' }}>
                                <input
                                  className="input"
                                  style={{ fontSize:'11px', padding:'4px 8px' }}
                                  placeholder="Add context..."
                                  value={comment.text}
                                  onChange={e => setComment({...comment, text:e.target.value})}
                                />
                                <button className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:'10px' }}
                                  onClick={() => submitComment(r.id)}>OK</button>
                              </div>
                            )
                            : (
                              <button
                                className="btn btn-ghost"
                                style={{ padding:'4px 10px', fontSize:'10px' }}
                                onClick={() => setComment({id:r.id, text: r.manager_note || ''})}
                              >
                                {r.manager_note ? 'EDIT NOTE' : '+ NOTE'}
                              </button>
                            )
                          }
                        </td>
                        <td>
                          <span className={`pill ${
                            r.status==='approved' ? 'pill-green' :
                            r.status==='rejected' ? 'pill-red' : 'pill-amber'
                          }`}>{r.status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="info-box" style={{ marginTop:'12px' }}>
              You can add a context note. Approval and rejection is admin-only.
              Your notes are logged with your employee ID.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
