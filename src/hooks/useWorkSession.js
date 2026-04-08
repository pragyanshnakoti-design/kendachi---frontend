import { useEffect, useRef, useState } from 'react'
import { session } from '../api.js'

const DEFAULT_CONFIG = {
  regular_limit_seconds: 60,
  company_session_seconds: 300,
  heartbeat_interval_seconds: 5,
  idle_threshold_seconds: 10,
  idle_timeout_seconds: 60,
  presence_interval_seconds: 60,
  presence_response_seconds: 15,
  hidden_alert_seconds: 30,
}

function computeMonitoringScore(metrics) {
  const idlePenalty = Math.min(30, Math.floor(metrics.idle_seconds / 10) * 6)
  const hiddenPenalty = Math.min(25, Math.floor(metrics.hidden_seconds / 10) * 5)
  const focusPenalty = Math.min(20, metrics.focus_loss_count * 4)
  const presencePenalty = Math.min(50, metrics.presence_failures * 35)
  const activityBoost = Math.min(10, Math.floor(metrics.activity_events / 10))
  const presenceBoost = Math.min(6, metrics.presence_passes * 2)
  return Math.max(0, Math.min(100, 100 - idlePenalty - hiddenPenalty - focusPenalty - presencePenalty + activityBoost + presenceBoost))
}

function nowSeconds(startedAt) {
  return startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
}

export function useWorkSession() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [workSessionId, setWorkSessionId] = useState(null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [loginTime, setLoginTime] = useState(null)
  const [isIdle, setIsIdle] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [monitoringScore, setMonitoringScore] = useState(100)
  const [activityEvents, setActivityEvents] = useState(0)
  const [idleSeconds, setIdleSeconds] = useState(0)
  const [hiddenSeconds, setHiddenSeconds] = useState(0)
  const [focusLossCount, setFocusLossCount] = useState(0)
  const [presencePasses, setPresencePasses] = useState(0)
  const [presenceFailures, setPresenceFailures] = useState(0)
  const [challenge, setChallenge] = useState({ active: false, remaining: 0 })
  const [signals, setSignals] = useState([])

  const intervalRef = useRef(null)
  const heartbeatRef = useRef(0)
  const elapsedRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const lastCountedActivityRef = useRef(0)
  const hiddenBaseSecondsRef = useRef(0)
  const hiddenStartedAtRef = useRef(null)
  const activityEventsRef = useRef(0)
  const idleSecondsRef = useRef(0)
  const hiddenSecondsRef = useRef(0)
  const focusLossCountRef = useRef(0)
  const presencePassesRef = useRef(0)
  const presenceFailuresRef = useRef(0)
  const challengeActiveRef = useRef(false)
  const challengeDeadlineRef = useRef(0)
  const nextChallengeAtRef = useRef(DEFAULT_CONFIG.presence_interval_seconds)

  function applyConfig(nextConfig) {
    setConfig(prev => ({ ...prev, ...(nextConfig || {}) }))
  }

  function resetMonitoringState() {
    setMonitoringScore(100)
    setActivityEvents(0)
    setIdleSeconds(0)
    setHiddenSeconds(0)
    setFocusLossCount(0)
    setPresencePasses(0)
    setPresenceFailures(0)
    setSignals([])
    setChallenge({ active: false, remaining: 0 })
    setIsHidden(false)
    setIsIdle(false)
    activityEventsRef.current = 0
    idleSecondsRef.current = 0
    hiddenBaseSecondsRef.current = 0
    hiddenStartedAtRef.current = null
    hiddenSecondsRef.current = 0
    focusLossCountRef.current = 0
    presencePassesRef.current = 0
    presenceFailuresRef.current = 0
    challengeActiveRef.current = false
    challengeDeadlineRef.current = 0
    heartbeatRef.current = 0
  }

  function pushSignal(label, tone = 'dim') {
    setSignals(prev => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        label,
        tone,
        at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev,
    ].slice(0, 6))
  }

  function syncMonitoringState(next) {
    if (typeof next.activity_events === 'number') {
      activityEventsRef.current = next.activity_events
      setActivityEvents(next.activity_events)
    }
    if (typeof next.idle_seconds === 'number') {
      idleSecondsRef.current = next.idle_seconds
      setIdleSeconds(next.idle_seconds)
      setIsIdle(next.idle_seconds >= config.idle_threshold_seconds)
    }
    if (typeof next.hidden_seconds === 'number') {
      hiddenBaseSecondsRef.current = next.hidden_seconds
      hiddenSecondsRef.current = next.hidden_seconds
      setHiddenSeconds(next.hidden_seconds)
    }
    if (typeof next.focus_loss_count === 'number') {
      focusLossCountRef.current = next.focus_loss_count
      setFocusLossCount(next.focus_loss_count)
    }
    if (typeof next.presence_passes === 'number') {
      presencePassesRef.current = next.presence_passes
      setPresencePasses(next.presence_passes)
    }
    if (typeof next.presence_failures === 'number') {
      presenceFailuresRef.current = next.presence_failures
      setPresenceFailures(next.presence_failures)
    }
    if (typeof next.monitoring_score === 'number') {
      setMonitoringScore(next.monitoring_score)
    }
  }

  function currentMetrics() {
    const hiddenTotal = hiddenBaseSecondsRef.current + nowSeconds(hiddenStartedAtRef.current)
    hiddenSecondsRef.current = hiddenTotal

    return {
      activity_events: activityEventsRef.current,
      idle_seconds: idleSecondsRef.current,
      hidden_seconds: hiddenTotal,
      focus_loss_count: focusLossCountRef.current,
      presence_passes: presencePassesRef.current,
      presence_failures: presenceFailuresRef.current,
    }
  }

  function updateLocalScore() {
    const score = computeMonitoringScore(currentMetrics())
    setMonitoringScore(score)
    return score
  }

  function handleAutoClosed(data, fallbackMessage) {
    clearInterval(intervalRef.current)
    challengeActiveRef.current = false
    setChallenge({ active: false, remaining: 0 })
    setRunning(false)
    if (data?.summary) {
      setSummary(data.summary)
      syncMonitoringState(data.summary)
    }
    setSaveStatus('saved')
    setError(fallbackMessage || data?.reason || 'Session closed by monitoring controls')
    pushSignal(`AUTO LOCKED: ${data?.reason || 'monitoring trigger'}`, 'red')
  }

  async function emitSignal(type, extra = {}) {
    if (!workSessionId || !running) return
    try {
      const response = await session.signal({
        work_session_id: workSessionId,
        type,
        elapsed_seconds: elapsedRef.current,
        ...currentMetrics(),
        ...extra,
      })
      if (typeof response.monitoring_score === 'number') {
        setMonitoringScore(response.monitoring_score)
      }
      if (response.auto_closed) {
        handleAutoClosed(response, `Session auto-closed: ${response.reason}`)
      }
    } catch (_) {}
  }

  async function doHeartbeat(nextElapsed) {
    if (!workSessionId) return
    setSaveStatus('saving')
    try {
      const response = await session.heartbeat({
        work_session_id: workSessionId,
        elapsed_seconds: nextElapsed,
        is_idle: idleSecondsRef.current >= config.idle_threshold_seconds,
        ...currentMetrics(),
      })
      if (typeof response.monitoring_score === 'number') {
        setMonitoringScore(response.monitoring_score)
      } else {
        updateLocalScore()
      }
      if (response.auto_closed) {
        handleAutoClosed(response, `Session auto-closed: ${response.reason}`)
        return
      }
      setSaveStatus('saved')
    } catch (e) {
      setSaveStatus('error')
    }
  }

  async function confirmPresence() {
    if (!challenge.active) return
    challengeActiveRef.current = false
    setChallenge({ active: false, remaining: 0 })
    presencePassesRef.current += 1
    setPresencePasses(presencePassesRef.current)
    pushSignal('LIVE PRESENCE VERIFIED', 'green')
    nextChallengeAtRef.current = elapsedRef.current + config.presence_interval_seconds
    updateLocalScore()
    await emitSignal('presence_passed', { presence_passes: presencePassesRef.current })
  }

  useEffect(() => {
    session.active()
      .then(data => {
        applyConfig(data.config)
        if (!data.active || !data.work_session) return
        const ws = data.work_session
        setWorkSessionId(ws.id)
        setLoginTime(ws.login_time)
        setElapsed(ws.live_elapsed || 0)
        elapsedRef.current = ws.live_elapsed || 0
        setRunning(true)
        syncMonitoringState(ws)
        nextChallengeAtRef.current = (ws.live_elapsed || 0) + (data.config?.presence_interval_seconds || DEFAULT_CONFIG.presence_interval_seconds)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onActivity() {
      const now = Date.now()
      lastActivityRef.current = now
      if (now - lastCountedActivityRef.current > 800) {
        lastCountedActivityRef.current = now
        activityEventsRef.current += 1
        setActivityEvents(activityEventsRef.current)
        updateLocalScore()
      }
      if (idleSecondsRef.current !== 0) {
        idleSecondsRef.current = 0
        setIdleSeconds(0)
        setIsIdle(false)
      }
    }

    function onVisibilityChange() {
      if (!running || !workSessionId) return

      if (document.hidden) {
        hiddenStartedAtRef.current = Date.now()
        setIsHidden(true)
        pushSignal('DASHBOARD HIDDEN', 'amber')
        emitSignal('visibility_hidden')
      } else {
        hiddenBaseSecondsRef.current += nowSeconds(hiddenStartedAtRef.current)
        hiddenStartedAtRef.current = null
        hiddenSecondsRef.current = hiddenBaseSecondsRef.current
        setHiddenSeconds(hiddenSecondsRef.current)
        setIsHidden(false)
        updateLocalScore()
        pushSignal('DASHBOARD RESTORED', 'green')
        emitSignal('visibility_visible', { hidden_seconds: hiddenSecondsRef.current })
      }
    }

    function onBlur() {
      if (!running || !workSessionId) return
      focusLossCountRef.current += 1
      setFocusLossCount(focusLossCountRef.current)
      updateLocalScore()
      pushSignal('WINDOW FOCUS LOST', 'amber')
      emitSignal('focus_lost', { focus_loss_count: focusLossCountRef.current })
    }

    function onFocus() {
      if (!running || !workSessionId) return
      pushSignal('WINDOW FOCUS RESTORED', 'green')
      emitSignal('focus_restored')
    }

    window.addEventListener('mousemove', onActivity)
    window.addEventListener('keydown', onActivity)
    window.addEventListener('click', onActivity)
    window.addEventListener('scroll', onActivity)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)

    return () => {
      window.removeEventListener('mousemove', onActivity)
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('click', onActivity)
      window.removeEventListener('scroll', onActivity)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [running, workSessionId, config.idle_threshold_seconds])

  useEffect(() => {
    if (!running) return undefined

    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        elapsedRef.current = next

        const idleFor = Math.max(0, Math.floor((Date.now() - lastActivityRef.current) / 1000))
        idleSecondsRef.current = idleFor
        setIdleSeconds(idleFor)
        setIsIdle(idleFor >= config.idle_threshold_seconds)

        const hiddenFor = hiddenBaseSecondsRef.current + nowSeconds(hiddenStartedAtRef.current)
        hiddenSecondsRef.current = hiddenFor
        setHiddenSeconds(hiddenFor)
        setIsHidden(Boolean(hiddenStartedAtRef.current))

        if (!challengeActiveRef.current && next >= nextChallengeAtRef.current) {
          challengeActiveRef.current = true
          challengeDeadlineRef.current = Date.now() + config.presence_response_seconds * 1000
          setChallenge({ active: true, remaining: config.presence_response_seconds })
          pushSignal('LIVE PRESENCE CHECK TRIGGERED', 'amber')
        }

        if (challengeActiveRef.current) {
          const remaining = Math.max(0, Math.ceil((challengeDeadlineRef.current - Date.now()) / 1000))
          setChallenge({ active: true, remaining })

          if (remaining <= 0) {
            challengeActiveRef.current = false
            setChallenge({ active: false, remaining: 0 })
            presenceFailuresRef.current += 1
            setPresenceFailures(presenceFailuresRef.current)
            updateLocalScore()
            emitSignal('presence_failed', {
              presence_failures: presenceFailuresRef.current,
              hidden_seconds: hiddenSecondsRef.current,
              idle_seconds: idleSecondsRef.current,
            })
          }
        }

        heartbeatRef.current += 1
        if (heartbeatRef.current >= config.heartbeat_interval_seconds) {
          heartbeatRef.current = 0
          doHeartbeat(next)
        } else {
          updateLocalScore()
        }

        return next
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [running, workSessionId, config])

  async function start() {
    setError('')
    resetMonitoringState()
    lastActivityRef.current = Date.now()
    try {
      const data = await session.start()
      applyConfig(data.config)
      setWorkSessionId(data.work_session_id)
      setLoginTime(data.login_time)
      setElapsed(0)
      elapsedRef.current = 0
      setRunning(true)
      setSummary(null)
      setMonitoringScore(data.monitoring_score ?? 100)
      nextChallengeAtRef.current = (data.config?.presence_interval_seconds || DEFAULT_CONFIG.presence_interval_seconds)
      pushSignal('SESSION STARTED WITH LIVE AUDIT MODE', 'green')
    } catch (e) {
      setError(e.message)
    }
  }

  async function stop(notes = '') {
    setError('')
    clearInterval(intervalRef.current)
    setRunning(false)
    challengeActiveRef.current = false
    setChallenge({ active: false, remaining: 0 })
    try {
      const data = await session.stop(workSessionId, notes)
      setSummary(data.summary)
      syncMonitoringState(data.summary || {})
      setSaveStatus('saved')
      pushSignal('SESSION CLOSED MANUALLY', 'green')
    } catch (e) {
      setError(e.message)
    }
  }

  const regularSeconds = Math.min(elapsed, config.regular_limit_seconds)
  const overtimeSeconds = Math.max(0, elapsed - config.regular_limit_seconds)
  const isOvertime = elapsed > config.regular_limit_seconds
  const monitoringState =
    presenceFailures > 0 ? 'critical' :
    monitoringScore < 60 ? 'watch' :
    monitoringScore < 80 ? 'review' :
    'verified'

  return {
    workSessionId,
    running,
    elapsed,
    regularSeconds,
    overtimeSeconds,
    isOvertime,
    isIdle,
    isHidden,
    loginTime,
    saveStatus,
    summary,
    error,
    start,
    stop,
    confirmPresence,
    challenge,
    signals,
    monitoringScore,
    monitoringState,
    activityEvents,
    idleSeconds,
    hiddenSeconds,
    focusLossCount,
    presencePasses,
    presenceFailures,
    config,
    REGULAR_LIMIT: config.regular_limit_seconds,
  }
}
