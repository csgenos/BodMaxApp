import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPrograms, getUserProgram, startProgram, updateProgramDay, quitProgram } from '../lib/db'

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const DumbbellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="12" r="2.5" />
    <line x1="9" y1="12" x2="15" y2="12" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
  </svg>
)

export default function Programs() {
  const { user, profile, isSubscribed } = useAuth()
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [userProgram, setUserProgram] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [progs, up] = await Promise.all([getPrograms(), getUserProgram(user.id)])
      setPrograms(progs)
      setUserProgram(up)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const handleStart = async (programId) => {
    setStarting(programId)
    try {
      await startProgram(user.id, programId)
      await load()
    } catch (e) { setError(e.message) }
    setStarting(null)
  }

  const handleAdvanceDay = async () => {
    if (!userProgram) return
    const prog = userProgram.workout_programs
    const days = prog.program_data?.days || []
    const nextDay = userProgram.current_day >= days.length ? 1 : userProgram.current_day + 1
    try {
      await updateProgramDay(userProgram.id, user.id, nextDay)
      setUserProgram(u => ({ ...u, current_day: nextDay }))
    } catch (e) { setError(e.message) }
  }

  const handleQuit = async () => {
    if (!userProgram) return
    try {
      await quitProgram(userProgram.id, user.id)
      setUserProgram(null)
      setConfirmQuit(false)
    } catch (e) { setError(e.message) }
  }

  const activeProg = userProgram?.workout_programs
  const activeDays = activeProg?.program_data?.days || []
  const todayDay = activeDays[(userProgram?.current_day ?? 1) - 1]

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div className="page" style={{ padding: 'var(--page-top) 20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/session')} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 4, display: 'flex', alignItems: 'center' }}>
          <BackIcon />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Programs</h1>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Structured training plans</div>
        </div>
      </div>

      {error && <div style={{ background: '#fee', color: '#c00', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* Active program card */}
      {userProgram && activeProg && (
        <div style={{ background: 'var(--bg2)', border: '2px solid var(--accent)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, marginBottom: 6 }}>CURRENT PROGRAM</div>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{activeProg.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
            Day {userProgram.current_day} of {activeDays.length} · {activeProg.duration_weeks} weeks
          </div>

          {/* Progress bar */}
          <div style={{ background: 'var(--bg3)', borderRadius: 4, height: 4, marginBottom: 14 }}>
            <div style={{ background: 'var(--accent)', borderRadius: 4, height: 4, width: `${((userProgram.current_day - 1) / activeDays.length) * 100}%`, transition: 'width 0.4s ease' }} />
          </div>

          {/* Today's workout */}
          {todayDay && (
            <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: todayDay.isRest ? 0 : 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: todayDay.isRest ? 'var(--border)' : 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {userProgram.current_day}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{todayDay.name}</div>
                  {todayDay.muscles?.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{todayDay.muscles.join(' · ')}</div>
                  )}
                </div>
              </div>
              {!todayDay.isRest && todayDay.exercises?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {todayDay.exercises.map(ex => (
                    <span key={ex} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>{ex}</span>
                  ))}
                </div>
              )}
              {todayDay.note && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)', fontStyle: 'italic' }}>{todayDay.note}</div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {!todayDay?.isRest ? (
              <button
                onClick={() => navigate('/session')}
                style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '11px 0', color: '#fff', fontWeight: 700, fontSize: 14 }}
              >
                Start Workout
              </button>
            ) : (
              <button
                onClick={handleAdvanceDay}
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 0', color: 'var(--text)', fontWeight: 700, fontSize: 14 }}
              >
                Mark Rest Day Done →
              </button>
            )}
            <button
              onClick={() => setConfirmQuit(true)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px', color: 'var(--text-muted)', fontSize: 13 }}
            >
              Quit
            </button>
          </div>
        </div>
      )}

      {/* Confirm quit overlay */}
      {confirmQuit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--bg2)', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%' }}>
            <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>Quit Program?</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.5 }}>Your progress will be lost. You can always restart it later.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmQuit(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 0', fontWeight: 600, fontSize: 14 }}>Cancel</button>
              <button onClick={handleQuit} style={{ flex: 1, background: '#c00', border: 'none', borderRadius: 10, padding: '11px 0', color: '#fff', fontWeight: 700, fontSize: 14 }}>Quit</button>
            </div>
          </div>
        </div>
      )}

      {/* All programs */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 12 }}>
        {userProgram ? 'ALL PROGRAMS' : 'CHOOSE A PROGRAM'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {programs.map(prog => {
          const isActive = userProgram?.program_id === prog.id
          const locked = prog.is_premium && !isSubscribed
          const days = prog.program_data?.days || []
          const isOpen = expanded === prog.id

          return (
            <div key={prog.id} style={{ background: 'var(--bg2)', border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', opacity: locked ? 0.7 : 1 }}>
              <button
                onClick={() => !locked && setExpanded(isOpen ? null : prog.id)}
                style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', textAlign: 'left', cursor: locked ? 'default' : 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{prog.name}</span>
                      {isActive && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>ACTIVE</span>}
                      {locked && <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}><LockIcon /> Pro</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.4 }}>{prog.description}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{prog.days_per_week}×/week</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{prog.duration_weeks} weeks</span>
                    </div>
                  </div>
                  {!locked && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{isOpen ? '−' : '+'}</span>
                  )}
                  {locked && (
                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'var(--bg3)', borderRadius: 8, flexShrink: 0 }}>
                      <LockIcon />
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded day schedule */}
              {isOpen && !locked && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 10 }}>WEEKLY SCHEDULE</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {days.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: d.isRest ? 'var(--bg3)' : 'var(--accent-low)', border: `1px solid ${d.isRest ? 'var(--border)' : 'var(--accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: d.isRest ? 'var(--text-muted)' : 'var(--accent)', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: d.isRest ? 'var(--text-muted)' : 'var(--text)' }}>{d.name}</div>
                          {!d.isRest && d.exercises?.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{d.exercises.slice(0, 3).join(', ')}{d.exercises.length > 3 ? ` +${d.exercises.length - 3} more` : ''}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!isActive && (
                    <button
                      onClick={() => handleStart(prog.id)}
                      disabled={starting === prog.id}
                      style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '12px 0', color: '#fff', fontWeight: 700, fontSize: 14, opacity: starting === prog.id ? 0.7 : 1 }}
                    >
                      {starting === prog.id ? 'Starting…' : userProgram ? 'Switch to This Program' : 'Start Program'}
                    </button>
                  )}
                  {isActive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>
                      <CheckIcon /> Currently active
                    </div>
                  )}
                </div>
              )}

              {locked && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Upgrade to Pro to unlock this program.</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
