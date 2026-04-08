import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [otpMinutes, setOtpMinutes] = useState(2)
  const [attemptLimit, setAttemptLimit] = useState(4)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleRequestOTP(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setDevOtp('')

    try {
      const data = await auth.requestOtp(email)
      const otp = data.dev_otp || ''
      setOtpMinutes(data.otp_expires_minutes || 2)
      setAttemptLimit(data.verify_attempts_allowed || 4)
      setDevOtp(otp)
      if (otp) setCode(otp)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await auth.verifyOtp(email, code)
      login(data.token, data.employee)

      if (data.employee.role === 'admin') navigate('/admin')
      else if (data.employee.role === 'manager') navigate('/manager')
      else navigate('/employee')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function resetToEmailStep() {
    setStep('email')
    setCode('')
    setDevOtp('')
    setError('')
  }

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.4,
        }}
      />

      <div className="fade-up" style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="logo" style={{ fontSize: '22px', marginBottom: '8px' }}>KENDACHI</div>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--dim)', letterSpacing: '1px' }}>
            EMPLOYEE JUSTICE &amp; AUDIT PLATFORM
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{step === 'email' ? 'IDENTIFY' : 'VERIFY'}</span>
            <span className={`pill ${step === 'email' ? 'pill-amber' : 'pill-green'}`}>
              STEP {step === 'email' ? '1' : '2'} / 2
            </span>
          </div>

          <div className="card-body" style={{ padding: '24px' }}>
            {step === 'email' ? (
              <form onSubmit={handleRequestOTP}>
                <label className="input-label">Company Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="your.name@company.org"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={{ marginBottom: '16px' }}
                />

                <div className="info-box" style={{ marginBottom: '16px' }}>
                  Enter your company email. A 6-digit code will be sent immediately.
                  No password required.
                </div>

                {error && <div className="error-box" style={{ marginBottom: '14px' }}>{error}</div>}

                <button className="btn btn-amber btn-full" type="submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'SENDING...' : 'SEND CODE ->'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP}>
                <div className="success-box" style={{ marginBottom: '16px' }}>
                  Code sent to <strong>{email}</strong>. It is valid for {otpMinutes} minute(s), and this code gets {attemptLimit} total try/tries before you need a new one.
                </div>

                {devOtp && (
                  <div className="info-box" style={{ marginBottom: '16px', borderColor: 'var(--green)', color: 'var(--text)' }}>
                    <div className="mono" style={{ fontSize: '10px', color: 'var(--dim)', marginBottom: '6px' }}>
                      LOCAL DEV OTP
                    </div>
                    <div style={{ fontSize: '28px', letterSpacing: '8px', textAlign: 'center', color: 'var(--green)', fontFamily: 'var(--mono)' }}>
                      {devOtp}
                    </div>
                  </div>
                )}

                <label className="input-label">6-Digit Code</label>
                <input
                  className="input"
                  type="text"
                  placeholder="482910"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  autoFocus
                  style={{ marginBottom: '16px', fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }}
                />

                {error && <div className="error-box" style={{ marginBottom: '14px' }}>{error}</div>}

                <button className="btn btn-green btn-full" type="submit" disabled={loading || code.length < 6}>
                  {loading ? <span className="spinner" /> : null}
                  {loading ? 'VERIFYING...' : 'VERIFY AND ENTER ->'}
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-full"
                  style={{ marginTop: '8px' }}
                  onClick={resetToEmailStep}
                >
                  {'<- BACK'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
          {['OTP AUTH', 'IP BOUND', 'ENCRYPTED', 'IMMUTABLE'].map(t => (
            <span key={t} className="pill pill-dim">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
