import React, { useState, useEffect } from 'react'
import Topbar from '../components/Topbar.jsx'
import { admin, auth, manager as managerApi, fmtSeconds, fmtDate, fmtTime, fmtDateTime, downloadJSON } from '../api.js'

export default function AdminDashboard() {
  const [tab,        setTab]        = useState('dashboard')
  const [stats,      setStats]      = useState(null)
  const [records,    setRecords]    = useState([])
  const [auditLogs,  setAuditLogs]  = useState([])
  const [anomalies,  setAnomalies]  = useState([])
  const [otPending,  setOtPending]  = useState([])
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(false)
  const [correction, setCorrection] = useState(null)
  const [corrStatus, setCorrStatus] = useState('')
  const [newEmp,     setNewEmp]     = useState(null)
  const [regStatus,  setRegStatus]  = useState('')
  const [exporting,  setExporting]  = useState(false)
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [logAction,  setLogAction]  = useState('')

  const tColor = { none:'var(--dim)', low:'var(--blue)', medium:'var(--amber)', high:'var(--red)', critical:'var(--red)' }

  useEffect(() => {
    admin.dashboard().then(d => setStats(d.stats)).catch(() => {})
    admin.pending().then(d => setOtPending(d.requests || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'records')   loadRecords()
    if (tab === 'audit')     loadAudit()
    if (tab === 'anomalies') admin.anomalies().then(d => setAnomalies(d.anomalies || []))
    if (tab === 'overtime')  admin.pending().then(d => setOtPending(d.requests || []))
    if (tab === 'employees') managerApi.employees().then(d => setEmployees(d.employees || []))
  }, [tab])

  async function loadRecords() {
    setLoading(true)
    const p = {}; if (dateFrom) p.from = dateFrom; if (dateTo) p.to = dateTo
    admin.records(p).then(d => setRecords(d.sessions || [])).finally(() => setLoading(false))
  }
  async function loadAudit() {
    setLoading(true)
    const p = {}; if (logAction) p.action = logAction
    admin.auditLog(p).then(d => setAuditLogs(d.logs || [])).finally(() => setLoading(false))
  }

  async function submitCorrection() {
    setCorrStatus('saving')
    try {
      await admin.correct({ work_session_id: correction.ws.id, field_changed: correction.field, new_value: correction.value, reason: correction.reason })
      setCorrStatus('done')
      setTimeout(() => { setCorrStatus(''); setCorrection(null) }, 2000)
    } catch (e) { setCorrStatus('error:' + e.message) }
  }

  async function otDecide(id, decision) {
    try {
      await admin.otDecide(id, decision, decision === 'approved' ? 'Approved by admin' : '')
      setOtPending(p => p.filter(r => r.id !== id))
    } catch (e) { alert(e.message) }
  }

  async function resolveFlag(id) {
    await admin.resolveFlag(id)
    setAnomalies(p => p.map(a => a.id === id ? { ...a, resolved: true } : a))
  }

  async function exportFull() {
    setExporting(true)
    try { downloadJSON(await admin.exportFull({ from: dateFrom, to: dateTo }), `kendachi-export-${new Date().toISOString().slice(0,10)}.json`) }
    catch (e) { alert(e.message) }
    setExporting(false)
  }

  async function registerEmployee(e) {
    e.preventDefault(); setRegStatus('saving')
    try { await auth.register(newEmp); setRegStatus('done'); setTimeout(() => { setRegStatus(''); setNewEmp(null) }, 2500) }
    catch (err) { setRegStatus('error:' + err.message) }
  }

  return (
    <div className="page">
      <Topbar rightSlot={
        <button className="btn btn-ghost" style={{ fontSize:'10px', padding:'5px 10px' }}
          onClick={() => setNewEmp({ name:'', email:'', department:'', role:'employee' })}>
          + REGISTER EMPLOYEE
        </button>
      } />

      <div className="shell" style={{ padding:'20px', flex:1 }}>
        <div className="tabs" style={{ flexWrap:'wrap' }}>
          {['dashboard','records','overtime','audit','anomalies','employees'].map(t => (
            <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>
              {t.toUpperCase()}
              {t==='overtime' && otPending.length > 0 && <span style={{ marginLeft:'6px', background:'var(--amber)', color:'#000', borderRadius:'10px', padding:'1px 6px', fontSize:'9px', fontWeight:600 }}>{otPending.length}</span>}
            </button>
          ))}
        </div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="fade-up">
            {stats ? (
                <div className="grid4" style={{ marginBottom:'20px' }}>
                  {[
                    { label:'Total Employees',  val:stats.total_employees,  color:'var(--amber)' },
                    { label:'Sessions Today',   val:stats.sessions_today,   color:'var(--green)' },
                    { label:'Currently Active', val:stats.currently_active, color:'var(--green)' },
                    { label:'Monitoring Alerts', val:stats.monitoring_alerts, color:parseInt(stats.monitoring_alerts)>0?'var(--red)':'var(--muted)' },
                  ].map(s => (
                  <div key={s.label} className="stat-tile">
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-val" style={{ color:s.color, fontSize:'32px' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            ) : <div style={{ padding:'40px', textAlign:'center', color:'var(--dim)' }} className="mono">LOADING STATS...</div>}

            {parseInt(stats?.unresolved_flags) > 0 && (
              <div className="error-box" style={{ marginBottom:'16px' }}>{stats.unresolved_flags} unresolved anomaly flag(s) — check Anomalies tab</div>
            )}

            {otPending.length > 0 && (
              <div className="card" style={{ marginBottom:'16px' }}>
                <div className="card-header">
                  <span className="card-title">Pending Overtime Decisions</span>
                  <span className="pill pill-amber">{otPending.length} PENDING</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Employee</th><th>Reason</th><th>Est. Hrs</th><th>Manager Note</th><th>Action</th></tr></thead>
                    <tbody>
                      {otPending.map(r => (
                        <tr key={r.id}>
                          <td style={{color:'var(--text)'}}>{r.employee_name} <span style={{color:'var(--dim)'}}>({r.emp_code})</span></td>
                          <td style={{color:'var(--text2)',maxWidth:'180px'}}>{r.reason}</td>
                          <td>{r.estimated_hours || '—'}</td>
                          <td style={{color:'var(--dim)'}}>{r.manager_note || '—'}</td>
                          <td>
                            <div style={{ display:'flex', gap:'5px' }}>
                              <button className="btn btn-green" style={{ padding:'4px 10px', fontSize:'10px' }} onClick={() => otDecide(r.id,'approved')}>APPROVE</button>
                              <button className="btn btn-red" style={{ padding:'4px 10px', fontSize:'10px' }} onClick={() => otDecide(r.id,'rejected')}>REJECT</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="info-box">All admin actions permanently logged. Corrections append — never overwrite. Exports signed with your admin ID.</div>
          </div>
        )}

        {/* RECORDS */}
        {tab === 'records' && (
          <div className="fade-up">
            <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'flex-end' }}>
              <div><label className="input-label">From</label><input type="date" className="input" style={{ width:'150px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
              <div><label className="input-label">To</label><input type="date" className="input" style={{ width:'150px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
              <button className="btn btn-ghost" style={{ alignSelf:'flex-end' }} onClick={loadRecords}>SEARCH</button>
              <button className="btn btn-amber" style={{ marginLeft:'auto', alignSelf:'flex-end' }} onClick={exportFull} disabled={exporting}>
                {exporting ? <span className="spinner" /> : '↓ EXPORT SIGNED'}
              </button>
            </div>
            <div className="card">
              <div className="table-wrap">
                {loading
                  ? <div style={{ padding:'32px', textAlign:'center', color:'var(--dim)' }} className="mono">LOADING...</div>
                  : <table>
                    <thead><tr><th>Employee</th><th>Date</th><th>Login</th><th>Logout</th><th>Total</th><th>OT</th><th>Status</th><th>Note</th></tr></thead>
                    <tbody>
                      {records.length === 0 && <tr><td colSpan="8" style={{ textAlign:'center', color:'var(--dim)', padding:'24px' }}>No records — press Search</td></tr>}
                      {records.map(r => (
                        <tr key={r.id}>
                          <td style={{color:'var(--text)'}}>{r.name} <span style={{color:'var(--dim)',fontSize:'10px'}}>({r.emp_code})</span></td>
                          <td>{fmtDate(r.login_time)}</td>
                          <td>{fmtTime(r.login_time)}</td>
                          <td>{r.logout_time ? fmtTime(r.logout_time) : <span style={{color:'var(--green)'}}>ACTIVE</span>}</td>
                          <td style={{color:'var(--text)'}}>{fmtSeconds(r.total_seconds)}</td>
                          <td style={{color:r.overtime_seconds>0?'var(--amber)':'var(--dim)'}}>{r.overtime_seconds>0?fmtSeconds(r.overtime_seconds):'—'}</td>
                          <td>{r.auto_closed?<span className="pill pill-amber">AUTO</span>:r.closed?<span className="pill pill-dim">DONE</span>:<span className="pill pill-green">LIVE</span>}</td>
                          <td><button className="btn btn-ghost" style={{ padding:'3px 8px', fontSize:'10px' }} onClick={() => setCorrection({ ws:r, field:'notes', value:'', reason:'' })}>NOTE</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
              </div>
            </div>
          </div>
        )}

        {/* OVERTIME */}
        {tab === 'overtime' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Reason</th><th>Est. Hrs</th><th>Manager Note</th><th>Requested</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {otPending.length === 0 && <tr><td colSpan="7" style={{ textAlign:'center', color:'var(--dim)', padding:'24px' }}>No pending requests</td></tr>}
                    {otPending.map(r => (
                      <tr key={r.id}>
                        <td style={{color:'var(--text)'}}>{r.employee_name}</td>
                        <td style={{color:'var(--text2)',maxWidth:'160px'}}>{r.reason}</td>
                        <td>{r.estimated_hours || '—'}</td>
                        <td style={{color:'var(--dim)'}}>{r.manager_note || '—'}</td>
                        <td>{fmtDateTime(r.requested_at)}</td>
                        <td><span className="pill pill-amber">PENDING</span></td>
                        <td>
                          <div style={{ display:'flex', gap:'4px' }}>
                            <button className="btn btn-green" style={{ padding:'4px 8px', fontSize:'10px' }} onClick={() => otDecide(r.id,'approved')}>✓ APPROVE</button>
                            <button className="btn btn-red" style={{ padding:'4px 8px', fontSize:'10px' }} onClick={() => otDecide(r.id,'rejected')}>✗ REJECT</button>
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

        {/* AUDIT LOG */}
        {tab === 'audit' && (
          <div className="fade-up">
            <div style={{ display:'flex', gap:'10px', marginBottom:'14px' }}>
              <input className="input" style={{ width:'220px' }} placeholder="Filter by action..." value={logAction} onChange={e => setLogAction(e.target.value)} />
              <button className="btn btn-ghost" onClick={loadAudit}>SEARCH</button>
            </div>
            <div className="card">
              <div style={{ maxHeight:'520px', overflowY:'auto' }}>
                {loading
                  ? <div style={{ padding:'32px', textAlign:'center', color:'var(--dim)' }} className="mono">LOADING...</div>
                  : auditLogs.length === 0
                  ? <div style={{ padding:'32px', textAlign:'center', color:'var(--dim)' }} className="mono">NO LOGS — press Search</div>
                  : auditLogs.map(log => (
                    <div key={log.id} className="log-row">
                      <span className="log-time" style={{ fontSize:'10px' }}>{fmtDateTime(log.recorded_at)}</span>
                      <span className="mono" style={{ minWidth:'160px', fontSize:'11px', color:!log.success?'var(--red)':log.threat_level!=='none'?'var(--amber)':'var(--green)' }}>{log.action}</span>
                      <span className="mono" style={{ color:'var(--dim)', fontSize:'11px', flex:1 }}>
                        {log.actor_name?`${log.actor_name} (${log.actor_role})`:'system'}{log.ip_address?` · ${log.ip_address}`:''}
                      </span>
                      {log.threat_level !== 'none' && <span className="pill" style={{ color:tColor[log.threat_level], borderColor:tColor[log.threat_level], background:'transparent', fontSize:'9px' }}>{log.threat_level.toUpperCase()}</span>}
                    </div>
                  ))}
              </div>
            </div>
            <div className="mono" style={{ fontSize:'10px', color:'var(--muted)', marginTop:'6px' }}>Append-only. No entries can be deleted.</div>
          </div>
        )}

        {/* ANOMALIES */}
        {tab === 'anomalies' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Employee</th><th>Flag Type</th><th>Description</th><th>Severity</th><th>Flagged</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {anomalies.length === 0 && <tr><td colSpan="7" style={{ textAlign:'center', color:'var(--dim)', padding:'24px' }}>No anomalies detected</td></tr>}
                    {anomalies.map(a => (
                      <tr key={a.id} style={{ opacity:a.resolved?.4:1 }}>
                        <td style={{color:'var(--text)'}}>{a.name} <span style={{color:'var(--dim)'}}>({a.emp_code})</span></td>
                        <td className="mono" style={{ color:'var(--amber)', fontSize:'10px' }}>{a.flag_type}</td>
                        <td style={{ color:'var(--text2)', maxWidth:'200px', fontSize:'11px' }}>{a.description}</td>
                        <td><span style={{ fontFamily:'var(--mono)', fontSize:'10px', color:tColor[a.severity] }}>{a.severity.toUpperCase()}</span></td>
                        <td>{fmtDateTime(a.flagged_at)}</td>
                        <td>{a.resolved?<span className="pill pill-dim">RESOLVED</span>:<span className="pill pill-amber">OPEN</span>}</td>
                        <td>{!a.resolved && <button className="btn btn-ghost" style={{ padding:'3px 8px', fontSize:'10px' }} onClick={() => resolveFlag(a.id)}>RESOLVE</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EMPLOYEES */}
        {tab === 'employees' && (
          <div className="fade-up">
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Role</th><th>Status</th></tr></thead>
                  <tbody>
                    {employees.length === 0 && <tr><td colSpan="5" style={{textAlign:'center',color:'var(--dim)',padding:'24px'}}>No employees</td></tr>}
                    {employees.map(e => (
                      <tr key={e.id}>
                        <td className="mono" style={{color:'var(--amber)'}}>{e.emp_code}</td>
                        <td style={{color:'var(--text)'}}>{e.name}</td>
                        <td style={{color:'var(--dim)'}}>{e.department||'—'}</td>
                        <td><span className={`pill ${e.role==='admin'?'pill-amber':e.role==='manager'?'pill-blue':'pill-dim'}`}>{e.role.toUpperCase()}</span></td>
                        <td><span className={`pill ${e.is_active?'pill-green':'pill-red'}`}>{e.is_active?'ACTIVE':'INACTIVE'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Correction modal */}
      {correction && (
        <div className="modal-backdrop" onClick={() => setCorrection(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">APPEND CORRECTION</div>
            <div className="info-box" style={{ marginBottom:'12px', fontSize:'10px' }}>Original record preserved. Correction appended with your admin ID + reason.</div>
            <div className="mono" style={{ fontSize:'11px', color:'var(--dim)', marginBottom:'12px' }}>#{correction.ws.id} — {correction.ws.name} — {fmtDate(correction.ws.login_time)}</div>
            <label className="input-label">Field</label>
            <select className="input" style={{ marginBottom:'10px' }} value={correction.field} onChange={e => setCorrection({...correction,field:e.target.value})}>
              <option value="notes">Notes / Context</option>
              <option value="logout_time">Logout Time (note only)</option>
              <option value="login_time">Login Time (note only)</option>
            </select>
            <label className="input-label">Correction detail</label>
            <input className="input" style={{ marginBottom:'10px' }} value={correction.value} onChange={e => setCorrection({...correction,value:e.target.value})} placeholder="e.g. System outage — actual logout 18:30" />
            <label className="input-label">Reason (required)</label>
            <textarea className="input" rows={2} style={{ marginBottom:'14px', resize:'vertical' }} value={correction.reason} onChange={e => setCorrection({...correction,reason:e.target.value})} placeholder="Why is this correction needed?" />
            {corrStatus==='done' ? <div className="success-box">Correction logged. Original preserved.</div>
              : corrStatus.startsWith('error:') ? <div className="error-box" style={{ marginBottom:'10px' }}>{corrStatus.replace('error:','')}</div>
              : <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-amber" style={{ flex:1, justifyContent:'center' }} disabled={!correction.value||!correction.reason||corrStatus==='saving'} onClick={submitCorrection}>
                  {corrStatus==='saving'?<span className="spinner" />:null} APPEND
                </button>
                <button className="btn btn-ghost" onClick={() => setCorrection(null)}>CANCEL</button>
              </div>}
          </div>
        </div>
      )}

      {/* Register modal */}
      {newEmp && (
        <div className="modal-backdrop" onClick={() => setNewEmp(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">REGISTER EMPLOYEE</div>
            {regStatus==='done' ? <div className="success-box">Registered. Employee can now login with OTP.</div>
              : <form onSubmit={registerEmployee}>
                {[{f:'name',p:'Full Name'},{f:'email',p:'name@company.org'},{f:'department',p:'Engineering'}].map(({f,p}) => (
                  <div key={f} style={{ marginBottom:'10px' }}>
                    <label className="input-label">{f}</label>
                    <input className="input" required={f!=='department'} placeholder={p} value={newEmp[f]||''} onChange={e => setNewEmp({...newEmp,[f]:e.target.value})} />
                  </div>
                ))}
                <div style={{ marginBottom:'14px' }}>
                  <label className="input-label">Role</label>
                  <select className="input" value={newEmp.role} onChange={e => setNewEmp({...newEmp,role:e.target.value})}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {regStatus.startsWith('error:') && <div className="error-box" style={{ marginBottom:'10px' }}>{regStatus.replace('error:','')}</div>}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button type="submit" className="btn btn-green" style={{ flex:1, justifyContent:'center' }} disabled={regStatus==='saving'}>
                    {regStatus==='saving'?<span className="spinner" />:null} REGISTER
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
