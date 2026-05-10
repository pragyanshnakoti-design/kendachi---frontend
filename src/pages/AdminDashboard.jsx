import React, { useEffect, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import { admin, auth, manager as managerApi, fmtSeconds, fmtDate, fmtTime, fmtDateTime, downloadJSON } from '../api.js'

const REASON_LABELS = {
  employee_forgot_clock_out: 'Employee forgot clock-out',
  system_error: 'System error',
  approved_schedule_change: 'Approved schedule change',
  network_sync_issue: 'Network sync issue',
  duplicate_session_cleanup: 'Duplicate session cleanup',
  manager_dispute: 'Manager dispute',
  employee_dispute: 'Employee dispute',
  other: 'Other',
}

const DEFAULT_REASONS = Object.keys(REASON_LABELS)

export default function AdminDashboard() {
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [records, setRecords] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [corrections, setCorrections] = useState([])
  const [patterns, setPatterns] = useState({ repeated_corrections: [], pending_corrections: [] })
  const [otPending, setOtPending] = useState([])
  const [employees, setEmployees] = useState([])
  const [reasonCodes, setReasonCodes] = useState(DEFAULT_REASONS)
  const [loading, setLoading] = useState(false)
  const [correction, setCorrection] = useState(null)
  const [corrStatus, setCorrStatus] = useState('')
  const [newEmp, setNewEmp] = useState(null)
  const [regStatus, setRegStatus] = useState('')
  const [exporting, setExporting] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [logAction, setLogAction] = useState('')

  const tColor = { none: 'var(--dim)', low: 'var(--blue)', medium: 'var(--amber)', high: 'var(--red)', critical: 'var(--red)' }

  useEffect(() => {
    admin.dashboard().then(d => setStats(d.stats)).catch(() => {})
    admin.pending().then(d => setOtPending(d.requests || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'records') loadRecords()
    if (tab === 'audit') loadAudit()
    if (tab === 'anomalies') admin.anomalies().then(d => setAnomalies(d.anomalies || []))
    if (tab === 'corrections') loadCorrections()
    if (tab === 'patterns') admin.patterns().then(setPatterns).catch(() => {})
    if (tab === 'overtime') admin.pending().then(d => setOtPending(d.requests || []))
    if (tab === 'employees') managerApi.employees().then(d => setEmployees(d.employees || []))
  }, [tab])

  async function loadRecords() {
    setLoading(true)
    const p = {}
    if (dateFrom) p.from = dateFrom
    if (dateTo) p.to = dateTo
    admin.records(p).then(d => setRecords(d.sessions || [])).finally(() => setLoading(false))
  }

  async function loadAudit() {
    setLoading(true)
    const p = {}
    if (logAction) p.action = logAction
    admin.auditLog(p).then(d => setAuditLogs(d.logs || [])).finally(() => setLoading(false))
  }

  async function loadCorrections() {
    setLoading(true)
    admin.corrections('pending')
      .then(d => {
        setCorrections(d.corrections || [])
        setReasonCodes(d.reason_codes || DEFAULT_REASONS)
      })
      .finally(() => setLoading(false))
  }

  async function submitCorrection() {
    setCorrStatus('saving')
    try {
      await admin.correct({
        work_session_id: correction.ws.id,
        field_changed: correction.field,
        new_value: correction.value,
        reason_code: correction.reasonCode,
        reason: correction.reason,
      })
      setCorrStatus('done')
      loadCorrections()
      setTimeout(() => { setCorrStatus(''); setCorrection(null) }, 1800)
    } catch (e) {
      setCorrStatus(`error:${e.message}`)
    }
  }

  async function reviewCorrection(id, decision) {
    try {
      await admin.reviewCorrection(id, decision, decision === 'approved' ? 'Second-person governance review accepted.' : 'Correction rejected by reviewer.')
      setCorrections(p => p.filter(c => c.id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  async function otDecide(id, decision) {
    try {
      await admin.otDecide(id, decision, decision === 'approved' ? 'Approved by admin' : '')
      setOtPending(p => p.filter(r => r.id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  async function resolveFlag(id) {
    await admin.resolveFlag(id)
    setAnomalies(p => p.map(a => a.id === id ? { ...a, resolved: true } : a))
  }

  async function exportFull() {
    setExporting(true)
    try {
      downloadJSON(await admin.exportFull({ from: dateFrom, to: dateTo }), `workproof-export-${new Date().toISOString().slice(0, 10)}.json`)
    } catch (e) {
      alert(e.message)
    }
    setExporting(false)
  }

  async function registerEmployee(e) {
    e.preventDefault()
    setRegStatus('saving')
    try {
      await auth.register(newEmp)
      setRegStatus('done')
      setTimeout(() => { setRegStatus(''); setNewEmp(null) }, 2200)
    } catch (err) {
      setRegStatus(`error:${err.message}`)
    }
  }

  const pendingCorrectionCount = parseInt(stats?.pending_corrections || corrections.length || 0, 10)

  return (
    <div className="page">
      <Topbar rightSlot={
        <button className="btn btn-ghost" style={{ fontSize: '10px', padding: '5px 10px' }}
          onClick={() => setNewEmp({ name: '', email: '', department: '', role: 'employee' })}>
          + REGISTER EMPLOYEE
        </button>
      } />

      <div className="shell" style={{ padding: '20px', flex: 1 }}>
        <div className="info-box" style={{ marginBottom: '14px' }}>
          Every hour is accounted for, and every correction leaves a permanent trail.
        </div>

        <div className="tabs" style={{ flexWrap: 'wrap' }}>
          {['dashboard', 'records', 'corrections', 'patterns', 'overtime', 'audit', 'anomalies', 'employees'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.toUpperCase()}
              {t === 'corrections' && pendingCorrectionCount > 0 && <span style={{ marginLeft: '6px', background: 'var(--amber)', color: '#000', borderRadius: '10px', padding: '1px 6px', fontSize: '9px', fontWeight: 600 }}>{pendingCorrectionCount}</span>}
              {t === 'overtime' && otPending.length > 0 && <span style={{ marginLeft: '6px', background: 'var(--amber)', color: '#000', borderRadius: '10px', padding: '1px 6px', fontSize: '9px', fontWeight: 600 }}>{otPending.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="fade-up">
            {stats ? (
              <div className="grid4" style={{ marginBottom: '20px' }}>
                {[
                  { label: 'Total Employees', val: stats.total_employees, color: 'var(--amber)' },
                  { label: 'Sessions Today', val: stats.sessions_today, color: 'var(--green)' },
                  { label: 'Pending Corrections', val: stats.pending_corrections, color: parseInt(stats.pending_corrections) > 0 ? 'var(--amber)' : 'var(--muted)' },
                  { label: 'Monitoring Alerts', val: stats.monitoring_alerts, color: parseInt(stats.monitoring_alerts) > 0 ? 'var(--red)' : 'var(--muted)' },
                ].map(s => (
                  <div key={s.label} className="stat-tile">
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-val" style={{ color: s.color, fontSize: '32px' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            ) : <div style={{ padding: '40px', textAlign: 'center', color: 'var(--dim)' }} className="mono">LOADING STATS...</div>}

            {parseInt(stats?.unresolved_flags || 0, 10) > 0 && (
              <div className="error-box" style={{ marginBottom: '16px' }}>{stats.unresolved_flags} unresolved anomaly flag(s). Check Anomalies tab.</div>
            )}

            <div className="card">
              <div className="card-header">
                <span className="card-title">Governance Controls</span>
                <span className="pill pill-green">BILATERAL TRUST</span>
              </div>
              <div style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                <div className="info-box">Managers or admins can propose corrections, but a different person must approve them.</div>
                <div className="info-box">Employees are notified automatically when a correction is proposed, approved, or rejected.</div>
                <div className="info-box">Pattern detection flags repeated correction behavior so directors know where to investigate.</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'records' && (
          <div className="fade-up">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div><label className="input-label">From</label><input type="date" className="input" style={{ width: '150px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
              <div><label className="input-label">To</label><input type="date" className="input" style={{ width: '150px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
              <button className="btn btn-ghost" style={{ alignSelf: 'flex-end' }} onClick={loadRecords}>SEARCH</button>
              <button className="btn btn-amber" style={{ marginLeft: 'auto', alignSelf: 'flex-end' }} onClick={exportFull} disabled={exporting}>
                {exporting ? <span className="spinner" /> : 'EXPORT TRAIL'}
              </button>
            </div>
            <div className="card">
              <div className="table-wrap">
                {loading ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--dim)' }} className="mono">LOADING...</div>
                  : <table>
                    <thead><tr><th>Employee</th><th>Date</th><th>Login</th><th>Logout</th><th>Total</th><th>OT</th><th>Status</th><th>Governance</th></tr></thead>
                    <tbody>
                      {records.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No records. Press Search.</td></tr>}
                      {records.map(r => (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--text)' }}>{r.name} <span style={{ color: 'var(--dim)', fontSize: '10px' }}>({r.emp_code})</span></td>
                          <td>{fmtDate(r.login_time)}</td>
                          <td>{fmtTime(r.login_time)}</td>
                          <td>{r.logout_time ? fmtTime(r.logout_time) : <span style={{ color: 'var(--green)' }}>ACTIVE</span>}</td>
                          <td style={{ color: 'var(--text)' }}>{fmtSeconds(r.total_seconds)}</td>
                          <td style={{ color: r.overtime_seconds > 0 ? 'var(--amber)' : 'var(--dim)' }}>{r.overtime_seconds > 0 ? fmtSeconds(r.overtime_seconds) : '-'}</td>
                          <td>{r.auto_closed ? <span className="pill pill-amber">AUTO</span> : r.closed ? <span className="pill pill-dim">DONE</span> : <span className="pill pill-green">LIVE</span>}</td>
                          <td><button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '10px' }} onClick={() => setCorrection({ ws: r, field: 'notes', value: '', reasonCode: 'employee_forgot_clock_out', reason: '' })}>PROPOSE</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
              </div>
            </div>
          </div>
        )}

        {tab === 'corrections' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Field</th><th>Reason Code</th><th>Old</th><th>New</th><th>Proposed By</th><th>Action</th></tr></thead>
                  <tbody>
                    {corrections.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No pending correction approvals</td></tr>}
                    {corrections.map(c => (
                      <tr key={c.id}>
                        <td style={{ color: 'var(--text)' }}>{c.employee_name} <span style={{ color: 'var(--dim)' }}>({c.emp_code})</span></td>
                        <td className="mono" style={{ color: 'var(--amber)', fontSize: '10px' }}>{c.field_changed}</td>
                        <td>{REASON_LABELS[c.reason_code] || c.reason_code}</td>
                        <td style={{ maxWidth: '140px', color: 'var(--dim)' }}>{String(c.old_value || '-').slice(0, 40)}</td>
                        <td style={{ maxWidth: '140px', color: 'var(--text2)' }}>{String(c.new_value || '-').slice(0, 40)}</td>
                        <td>{c.proposer_name}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button className="btn btn-green" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => reviewCorrection(c.id, 'approved')}>APPROVE</button>
                            <button className="btn btn-red" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => reviewCorrection(c.id, 'rejected')}>REJECT</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="info-box" style={{ marginTop: '12px' }}>Second-person approval prevents silent overtime deletion while still letting HR fix real mistakes.</div>
          </div>
        )}

        {tab === 'patterns' && (
          <div className="fade-up">
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header"><span className="card-title">Repeated Correction Patterns</span><span className="pill pill-amber">ACTIVE AUDIT</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Reviewer</th><th>Employee</th><th>Corrections In 30 Days</th><th>Signal</th></tr></thead>
                  <tbody>
                    {(patterns.repeated_corrections || []).length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No repeated correction pattern detected</td></tr>}
                    {(patterns.repeated_corrections || []).map((p, idx) => (
                      <tr key={`${p.corrected_by}-${p.employee_id}-${idx}`}>
                        <td>{p.actor_name}</td>
                        <td style={{ color: 'var(--text)' }}>{p.employee_name}</td>
                        <td style={{ color: 'var(--amber)' }}>{p.correction_count}</td>
                        <td>Director review recommended</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="info-box">Pattern detection turns the audit log into a signal system. Directors do not need to read every row manually.</div>
          </div>
        )}

        {tab === 'overtime' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Reason</th><th>Est. Hrs</th><th>Manager Note</th><th>Requested</th><th>Action</th></tr></thead>
                  <tbody>
                    {otPending.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No pending requests</td></tr>}
                    {otPending.map(r => (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--text)' }}>{r.employee_name}</td>
                        <td style={{ color: 'var(--text2)', maxWidth: '160px' }}>{r.reason}</td>
                        <td>{r.estimated_hours || '-'}</td>
                        <td style={{ color: 'var(--dim)' }}>{r.manager_note || '-'}</td>
                        <td>{fmtDateTime(r.requested_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="btn btn-green" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => otDecide(r.id, 'approved')}>APPROVE</button>
                            <button className="btn btn-red" style={{ padding: '4px 8px', fontSize: '10px' }} onClick={() => otDecide(r.id, 'rejected')}>REJECT</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'audit' && (
          <div className="fade-up">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <input className="input" style={{ width: '220px' }} placeholder="Filter by action..." value={logAction} onChange={e => setLogAction(e.target.value)} />
              <button className="btn btn-ghost" onClick={loadAudit}>SEARCH</button>
            </div>
            <div className="card">
              <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                {loading ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--dim)' }} className="mono">LOADING...</div>
                  : auditLogs.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--dim)' }} className="mono">NO LOGS. Press Search.</div>
                  : auditLogs.map(log => (
                    <div key={log.id} className="log-row">
                      <span className="log-time" style={{ fontSize: '10px' }}>{fmtDateTime(log.recorded_at)}</span>
                      <span className="mono" style={{ minWidth: '170px', fontSize: '11px', color: !log.success ? 'var(--red)' : log.threat_level !== 'none' ? 'var(--amber)' : 'var(--green)' }}>{log.action}</span>
                      <span className="mono" style={{ color: 'var(--dim)', fontSize: '11px', flex: 1 }}>{log.actor_name ? `${log.actor_name} (${log.actor_role})` : 'system'}{log.ip_address ? ` - ${log.ip_address}` : ''}</span>
                      {log.threat_level !== 'none' && <span className="pill" style={{ color: tColor[log.threat_level], borderColor: tColor[log.threat_level], background: 'transparent', fontSize: '9px' }}>{log.threat_level.toUpperCase()}</span>}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'anomalies' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Flag Type</th><th>Description</th><th>Severity</th><th>Flagged</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {anomalies.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No anomalies detected</td></tr>}
                    {anomalies.map(a => (
                      <tr key={a.id} style={{ opacity: a.resolved ? 0.45 : 1 }}>
                        <td style={{ color: 'var(--text)' }}>{a.name} <span style={{ color: 'var(--dim)' }}>({a.emp_code})</span></td>
                        <td className="mono" style={{ color: 'var(--amber)', fontSize: '10px' }}>{a.flag_type}</td>
                        <td style={{ color: 'var(--text2)', maxWidth: '220px', fontSize: '11px' }}>{a.description}</td>
                        <td><span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: tColor[a.severity] }}>{a.severity.toUpperCase()}</span></td>
                        <td>{fmtDateTime(a.flagged_at)}</td>
                        <td>{a.resolved ? <span className="pill pill-dim">RESOLVED</span> : <span className="pill pill-amber">OPEN</span>}</td>
                        <td>{!a.resolved && <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '10px' }} onClick={() => resolveFlag(a.id)}>RESOLVE</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'employees' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>
                    {employees.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No employees</td></tr>}
                    {employees.map(e => (
                      <tr key={e.id}>
                        <td className="mono" style={{ color: 'var(--amber)' }}>{e.emp_code}</td>
                        <td style={{ color: 'var(--text)' }}>{e.name}</td>
                        <td style={{ color: 'var(--dim)' }}>{e.department || '-'}</td>
                        <td><span className={`pill ${e.role === 'admin' ? 'pill-amber' : e.role === 'manager' ? 'pill-blue' : 'pill-dim'}`}>{e.role.toUpperCase()}</span></td>
                        <td><span className={`pill ${e.is_active ? 'pill-green' : 'pill-red'}`}>{e.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {correction && (
        <div className="modal-backdrop" onClick={() => setCorrection(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">PROPOSE CORRECTION</div>
            <div className="info-box" style={{ marginBottom: '12px', fontSize: '10px' }}>Original record stays preserved. A different approver must review this correction.</div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginBottom: '12px' }}>#{correction.ws.id} - {correction.ws.name} - {fmtDate(correction.ws.login_time)}</div>
            <label className="input-label">Field</label>
            <select className="input" style={{ marginBottom: '10px' }} value={correction.field} onChange={e => setCorrection({ ...correction, field: e.target.value })}>
              <option value="notes">Notes / Context</option>
              <option value="logout_time">Logout Time</option>
              <option value="login_time">Login Time</option>
            </select>
            <label className="input-label">Reason Code</label>
            <select className="input" style={{ marginBottom: '10px' }} value={correction.reasonCode} onChange={e => setCorrection({ ...correction, reasonCode: e.target.value })}>
              {reasonCodes.map(code => <option key={code} value={code}>{REASON_LABELS[code] || code}</option>)}
            </select>
            <label className="input-label">Correction Detail</label>
            <input className="input" style={{ marginBottom: '10px' }} value={correction.value} onChange={e => setCorrection({ ...correction, value: e.target.value })} placeholder="Example: actual logout 18:30 after network sync issue" />
            <label className="input-label">Explanation</label>
            <textarea className="input" rows={2} style={{ marginBottom: '14px', resize: 'vertical' }} value={correction.reason} onChange={e => setCorrection({ ...correction, reason: e.target.value })} placeholder="Why is this correction needed?" />
            {corrStatus === 'done' ? <div className="success-box">Correction proposed for approval.</div>
              : corrStatus.startsWith('error:') ? <div className="error-box" style={{ marginBottom: '10px' }}>{corrStatus.replace('error:', '')}</div>
              : <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-amber" style={{ flex: 1, justifyContent: 'center' }} disabled={!correction.value || !correction.reason || corrStatus === 'saving'} onClick={submitCorrection}>
                  {corrStatus === 'saving' ? <span className="spinner" /> : null} PROPOSE
                </button>
                <button className="btn btn-ghost" onClick={() => setCorrection(null)}>CANCEL</button>
              </div>}
          </div>
        </div>
      )}

      {newEmp && (
        <div className="modal-backdrop" onClick={() => setNewEmp(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">REGISTER EMPLOYEE</div>
            {regStatus === 'done' ? <div className="success-box">Registered. Employee can now login with OTP.</div>
              : <form onSubmit={registerEmployee}>
                {[{ f: 'name', p: 'Full Name' }, { f: 'email', p: 'name@company.org' }, { f: 'department', p: 'Engineering' }].map(({ f, p }) => (
                  <div key={f} style={{ marginBottom: '10px' }}>
                    <label className="input-label">{f}</label>
                    <input className="input" required={f !== 'department'} placeholder={p} value={newEmp[f] || ''} onChange={e => setNewEmp({ ...newEmp, [f]: e.target.value })} />
                  </div>
                ))}
                <div style={{ marginBottom: '14px' }}>
                  <label className="input-label">Role</label>
                  <select className="input" value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value })}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {regStatus.startsWith('error:') && <div className="error-box" style={{ marginBottom: '10px' }}>{regStatus.replace('error:', '')}</div>}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-green" style={{ flex: 1, justifyContent: 'center' }} disabled={regStatus === 'saving'}>
                    {regStatus === 'saving' ? <span className="spinner" /> : null} REGISTER
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setNewEmp(null)}>CANCEL</button>
                </div>
              </form>}
          </div>
        </div>
      )}
    </div>
  )
}
