import React, { useEffect, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useWorkSession } from '../hooks/useWorkSession.js'
import { overtime, employee, downloadJSON, fmtSeconds, fmtTime, fmtDate, fmtDateTime } from '../api.js'

function fmt(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function scoreTone(score) {
  if (score >= 80) return 'var(--green)'
  if (score >= 60) return 'var(--amber)'
  return 'var(--red)'
}

function scorePill(score) {
  if (score >= 80) return 'pill-green'
  if (score >= 60) return 'pill-amber'
  return 'pill-red'
}

function monitoringLabel(state) {
  if (state === 'critical') return 'CRITICAL'
  if (state === 'watch') return 'WATCH'
  if (state === 'review') return 'REVIEW'
  return 'VERIFIED'
}

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const ws = useWorkSession()

  const [tab, setTab] = useState('timer')
  const [records, setRecords] = useState([])
  const [otRequests, setOtRequests] = useState([])
  const [showOTForm, setShowOTForm] = useState(false)
  const [otReason, setOtReason] = useState('')
  const [otHours, setOtHours] = useState('')
  const [otStatus, setOtStatus] = useState('')
  const [stopNotes, setStopNotes] = useState('')
  const [showStop, setShowStop] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loadingRec, setLoadingRec] = useState(false)

  useEffect(() => {
    if (tab === 'history') {
      setLoadingRec(true)
      employee.records().then(d => setRecords(d.sessions || [])).finally(() => setLoadingRec(false))
    }
    if (tab === 'overtime') {
      overtime.my().then(d => setOtRequests(d.requests || []))
    }
  }, [tab, ws.running])

  async function handleOTSubmit(e) {
    e.preventDefault()
    setOtStatus('sending')
    try {
      await overtime.request({
        work_session_id: ws.workSessionId,
        reason: otReason,
        estimated_hours: parseFloat(otHours) || null,
      })
      setOtStatus('done')
      setOtReason('')
      setOtHours('')
      setTimeout(() => {
        setOtStatus('')
        setShowOTForm(false)
      }, 1800)
    } catch (err) {
      setOtStatus(`error:${err.message}`)
    }
  }

  async function handleStop(e) {
    e.preventDefault()
    setShowStop(false)
    await ws.stop(stopNotes)
    setStopNotes('')
  }

  async function handleExport() {
    setExporting(true)
    try {
      const data = await employee.exportProof()
      downloadJSON(data, `kendachi-proof-${user.empCode}-${new Date().toISOString().slice(0, 10)}.json`)
    } catch (err) {
      alert(err.message)
    }
    setExporting(false)
  }

  const pct = Math.min(100, (ws.elapsed / ws.REGULAR_LIMIT) * 100)
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="page">
      <Topbar />

      <div className="shell" style={{ padding: '20px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'var(--amber-dim)',
              border: '2px solid var(--amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mono)',
              fontSize: '13px',
              color: 'var(--amber)',
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: '15px' }}>{user?.name}</div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)' }}>
              {user?.empCode} · {user?.department} · {user?.email}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className={`pill ${scorePill(ws.monitoringScore)}`}>AUDIT {monitoringLabel(ws.monitoringState)}</span>
            <span className="pill pill-dim mono" style={{ fontSize: '10px' }}>
              SCORE {ws.monitoringScore}
            </span>
          </div>
        </div>

        {ws.isIdle && ws.running && (
          <div className="error-box fade-up" style={{ marginBottom: '16px' }}>
            IDLE DETECTED - no activity for {ws.idleSeconds}s. Session auto-locks at {fmtSeconds(ws.config.idle_timeout_seconds)}.
          </div>
        )}

        {ws.isHidden && ws.running && (
          <div className="info-box fade-up" style={{ marginBottom: '16px', borderColor: 'var(--amber)' }}>
            DASHBOARD NOT IN FOCUS - hidden time is being audited and will reduce the monitoring score.
          </div>
        )}

        {ws.challenge.active && (
          <div className="info-box fade-up" style={{ marginBottom: '16px', borderColor: 'var(--red)', color: 'var(--text)' }}>
            LIVE PRESENCE CHECK ACTIVE - confirm in {ws.challenge.remaining}s or this session will be auto-locked.
          </div>
        )}

        {ws.error && <div className="error-box" style={{ marginBottom: '14px' }}>{ws.error}</div>}

        <div className="tabs">
          {['timer', 'history', 'overtime'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === 'timer' && (
          <div className="fade-up">
            <div className="card" style={{ marginBottom: '16px', textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    fontFamily: 'var(--mono)',
                    fontSize: '10px',
                    color: 'var(--dim)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      display: 'inline-block',
                      background:
                        ws.saveStatus === 'saving' ? 'var(--amber)' :
                        ws.saveStatus === 'saved' ? 'var(--green)' :
                        ws.saveStatus === 'error' ? 'var(--red)' :
                        'var(--muted)',
                    }}
                  />
                  {ws.saveStatus === 'saving' ? 'SYNCING...' :
                    ws.saveStatus === 'saved' ? 'AUDITED' :
                    ws.saveStatus === 'error' ? 'SYNC ERR' :
                    'IDLE'}
                </div>

                <div className={`timer-display ${ws.isOvertime ? 'overtime' : ''} ${!ws.running && !ws.elapsed ? 'stopped' : ''}`}>
                  {fmt(ws.elapsed)}
                </div>
                <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', marginTop: '8px', letterSpacing: '1px' }}>
                  {ws.running
                    ? (ws.isOvertime ? 'OVERTIME WINDOW ACTIVE - ADMIN WILL SEE THIS' : 'LIVE AUDIT SESSION RUNNING')
                    : ws.summary ? 'SESSION CLOSED - AUDIT SNAPSHOT SAVED' : 'SESSION NOT STARTED'}
                </div>
              </div>

              {(ws.running || ws.elapsed > 0) && (
                <div style={{ margin: '16px 0 0', background: 'var(--border)', borderRadius: '2px', height: '3px' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: '2px',
                      width: `${pct}%`,
                      background: ws.isOvertime ? 'var(--amber)' : 'var(--green)',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              )}

              {ws.loginTime && (
                <div className="mono" style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '8px' }}>
                  LOGIN: {fmtDateTime(ws.loginTime)}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div className="stat-tile">
                <div className="stat-label">Verified Work Window</div>
                <div className="stat-val">{fmtSeconds(ws.regularSeconds)}</div>
                <div className="stat-sub">overtime starts after {fmtSeconds(ws.config.regular_limit_seconds)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Overtime Window</div>
                <div className="stat-val" style={{ color: ws.overtimeSeconds > 0 ? 'var(--amber)' : 'var(--muted)' }}>
                  {fmtSeconds(ws.overtimeSeconds)}
                </div>
                <div className="stat-sub">company cap: {fmtSeconds(ws.config.company_session_seconds)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Audit Score</div>
                <div className="stat-val" style={{ color: scoreTone(ws.monitoringScore) }}>{ws.monitoringScore}</div>
                <div className="stat-sub">{monitoringLabel(ws.monitoringState)}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Presence Checks</div>
                <div className="stat-val" style={{ color: ws.presenceFailures > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {ws.presencePasses}/{ws.presencePasses + ws.presenceFailures}
                </div>
                <div className="stat-sub">every {fmtSeconds(ws.config.presence_interval_seconds)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button className="btn btn-green" disabled={ws.running || !!ws.summary} onClick={ws.start}>
                START AUDIT
              </button>
              <button className="btn btn-red" disabled={!ws.running} onClick={() => setShowStop(true)}>
                STOP SESSION
              </button>
              <button className="btn btn-amber" disabled={!ws.running} onClick={() => setShowOTForm(true)}>
                OT REQUEST
              </button>
            </div>

            {ws.summary && (
              <div className="success-box fade-up" style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '6px', fontWeight: 500 }}>SESSION COMPLETE</div>
                <div>Total: {fmtSeconds(ws.summary.total_seconds)}</div>
                <div>Regular: {fmtSeconds(ws.summary.regular_seconds)} | OT: {fmtSeconds(ws.summary.overtime_seconds)}</div>
                <div>Monitoring Score: {ws.summary.monitoring_score}</div>
                <div>Presence Passes: {ws.summary.presence_passes} | Presence Fails: {ws.summary.presence_failures}</div>
                <div style={{ marginTop: '8px' }}>
                  <button className="btn btn-ghost" style={{ fontSize: '10px', padding: '5px 10px' }} onClick={handleExport} disabled={exporting}>
                    {exporting ? 'EXPORTING...' : 'EXPORT AUDIT PROOF'}
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header">
                <span className="card-title">Live Audit Monitor</span>
                <span className={`pill ${scorePill(ws.monitoringScore)}`}>{monitoringLabel(ws.monitoringState)}</span>
              </div>
              <div style={{ padding: '16px', display: 'grid', gap: '16px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {[
                    { label: 'Activity Events', value: ws.activityEvents, tone: 'var(--text)' },
                    { label: 'Idle Window', value: fmtSeconds(ws.idleSeconds), tone: ws.isIdle ? 'var(--amber)' : 'var(--text)' },
                    { label: 'Hidden Time', value: fmtSeconds(ws.hiddenSeconds), tone: ws.hiddenSeconds > 0 ? 'var(--amber)' : 'var(--text)' },
                    { label: 'Focus Losses', value: ws.focusLossCount, tone: ws.focusLossCount > 0 ? 'var(--amber)' : 'var(--text)' },
                    { label: 'Presence Fails', value: ws.presenceFailures, tone: ws.presenceFailures > 0 ? 'var(--red)' : 'var(--text)' },
                    { label: 'Mode', value: 'Live audit', tone: 'var(--green)' },
                  ].map(item => (
                    <div
                      key={item.label}
                      style={{
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '12px',
                      }}
                    >
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginBottom: '6px' }}>{item.label}</div>
                      <div style={{ fontSize: '22px', color: item.tone, fontFamily: 'var(--mono)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="info-box">
                  Demo monitoring rules: overtime starts after {fmtSeconds(ws.config.regular_limit_seconds)}, session auto-closes at {fmtSeconds(ws.config.company_session_seconds)}, heartbeat every {fmtSeconds(ws.config.heartbeat_interval_seconds)}, idle threshold {fmtSeconds(ws.config.idle_threshold_seconds)}, live presence challenge every {fmtSeconds(ws.config.presence_interval_seconds)}, auto-lock at {fmtSeconds(ws.config.idle_timeout_seconds)}.
                </div>

                <div>
                  <div className="section-title" style={{ marginBottom: '10px' }}>LIVE SIGNALS</div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {ws.signals.length === 0 && (
                      <div className="mono" style={{ color: 'var(--dim)', fontSize: '11px' }}>No live signals yet. Start a session to see audit events.</div>
                    )}
                    {ws.signals.map(signal => (
                      <div
                        key={signal.id}
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '10px',
                          alignItems: 'center',
                        }}
                      >
                        <span className="mono" style={{ color: signal.tone === 'red' ? 'var(--red)' : signal.tone === 'amber' ? 'var(--amber)' : 'var(--text2)', fontSize: '11px' }}>
                          {signal.label}
                        </span>
                        <span className="mono" style={{ color: 'var(--dim)', fontSize: '10px' }}>
                          {signal.at}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span className="section-title">AUDITED SESSION HISTORY</span>
              <button className="btn btn-ghost" style={{ fontSize: '10px', padding: '5px 10px' }} onClick={handleExport} disabled={exporting}>
                {exporting ? 'EXPORTING...' : 'EXPORT ALL'}
              </button>
            </div>

            {loadingRec ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }} className="mono">LOADING...</div>
            ) : (
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Score</th>
                        <th>Hidden</th>
                        <th>Presence</th>
                        <th>Status</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.length === 0 && (
                        <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No sessions yet</td></tr>
                      )}
                      {records.map(r => (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--text)' }}>
                            <div>{fmtDate(r.login_time)}</div>
                            <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)' }}>
                              {fmtTime(r.login_time)} - {r.logout_time ? fmtTime(r.logout_time) : 'LIVE'}
                            </div>
                          </td>
                          <td style={{ color: 'var(--text)' }}>{fmtSeconds(r.total_seconds)}</td>
                          <td style={{ color: scoreTone(r.monitoring_score || 100) }}>{r.monitoring_score || 100}</td>
                          <td>{fmtSeconds(r.hidden_seconds || 0)}</td>
                          <td>{(r.presence_passes || 0)}/{(r.presence_passes || 0) + (r.presence_failures || 0)}</td>
                          <td>
                            {r.auto_closed
                              ? <span className="pill pill-amber">AUTO-LOCKED</span>
                              : r.closed
                              ? <span className="pill pill-green">VERIFIED</span>
                              : <span className="pill pill-dim">LIVE</span>}
                          </td>
                          <td style={{ color: 'var(--dim)', maxWidth: '180px' }}>{r.auto_close_reason || 'Manual / normal close'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="info-box" style={{ marginTop: '12px' }}>
              This history now stores monitoring score, hidden-tab duration, focus breaks, and live-presence failures in addition to time totals.
            </div>
          </div>
        )}

        {tab === 'overtime' && (
          <div className="fade-up">
            <span className="section-title">OVERTIME REVIEW QUEUE</span>
            <div className="card" style={{ marginTop: '12px' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Requested</th>
                      <th>Reason</th>
                      <th>Est. Hours</th>
                      <th>Manager Note</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otRequests.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--dim)', padding: '24px' }}>No overtime requests</td></tr>
                    )}
                    {otRequests.map(r => (
                      <tr key={r.id}>
                        <td>{fmtDateTime(r.requested_at)}</td>
                        <td style={{ color: 'var(--text)', maxWidth: '220px' }}>{r.reason}</td>
                        <td>{r.estimated_hours || '—'}</td>
                        <td style={{ color: 'var(--dim)' }}>{r.manager_note || '—'}</td>
                        <td>
                          <span className={`pill ${
                            r.status === 'approved' ? 'pill-green' :
                            r.status === 'rejected' ? 'pill-red' :
                            'pill-amber'
                          }`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="info-box" style={{ marginTop: '12px' }}>
              The monitoring score remains attached to the session that generated the overtime request, so approval is not based on time alone.
            </div>
          </div>
        )}
      </div>

      {ws.challenge.active && (
        <div className="modal-backdrop" onClick={() => {}}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">LIVE PRESENCE CHECK</div>
            <div className="info-box" style={{ marginBottom: '14px' }}>
              The audit engine needs proof that you are still at the workstation. Confirm before the timer reaches zero.
            </div>
            <div className="timer-display" style={{ fontSize: '42px', marginBottom: '16px', color: 'var(--amber)' }}>
              {String(ws.challenge.remaining).padStart(2, '0')}
            </div>
            <button className="btn btn-green btn-full" onClick={ws.confirmPresence}>
              I AM PRESENT
            </button>
          </div>
        </div>
      )}

      {showStop && (
        <div className="modal-backdrop" onClick={() => setShowStop(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">CONFIRM SESSION STOP</div>
            <form onSubmit={handleStop}>
              <label className="input-label">Optional note</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Project, work batch, reason for stop..."
                value={stopNotes}
                onChange={e => setStopNotes(e.target.value)}
                style={{ resize: 'vertical', marginBottom: '14px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-red" style={{ flex: 1, justifyContent: 'center' }}>
                  CONFIRM STOP
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowStop(false)}>
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOTForm && (
        <div className="modal-backdrop" onClick={() => setShowOTForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">OVERTIME REQUEST</div>
            {otStatus === 'done' ? (
              <div className="success-box">Request submitted. Monitoring data remains attached for admin review.</div>
            ) : (
              <form onSubmit={handleOTSubmit}>
                <label className="input-label">Reason</label>
                <textarea
                  className="input"
                  rows={3}
                  required
                  placeholder="Why should this monitored session continue beyond the verified work window?"
                  value={otReason}
                  onChange={e => setOtReason(e.target.value)}
                  style={{ resize: 'vertical', marginBottom: '12px' }}
                />
                <label className="input-label">Estimated Extra Hours</label>
                <input
                  className="input"
                  type="number"
                  min="0.1"
                  max="12"
                  step="0.1"
                  placeholder="0.5"
                  value={otHours}
                  onChange={e => setOtHours(e.target.value)}
                  style={{ marginBottom: '14px' }}
                />

                {otStatus.startsWith('error:') && (
                  <div className="error-box" style={{ marginBottom: '12px' }}>
                    {otStatus.replace('error:', '')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="btn btn-amber" style={{ flex: 1, justifyContent: 'center' }} disabled={otStatus === 'sending'}>
                    {otStatus === 'sending' ? <span className="spinner" /> : null}
                    SUBMIT FOR REVIEW
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowOTForm(false)}>
                    CANCEL
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
