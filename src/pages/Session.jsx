import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSessions, saveSession, checkAndUpdatePR, getLastExerciseSets } from '../lib/db'
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES } from '../lib/ranks'

const uid = () => Math.random().toString(36).slice(2)

const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 6px', fontSize: 15, textAlign: 'center', width: '100%', fontFamily: 'var(--mono)' }

export default function Session() {
  const { profile } = useAuth()
  const [view, setView] = useState('list') // list | calendar | active | summary
  const [sessions, setSessions] = useState([])
  const [active, setActive] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [showCardio, setShowCardio] = useState(false)
  const [pickerGroup, setPickerGroup] = useState(MUSCLE_GROUPS[0])
  const [summary, setSummary] = useState(null)
  const [newPRs, setNewPRs] = useState([])
  const [calMonth, setCalMonth] = useState(new Date())
  const [suggestions, setSuggestions] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (profile) load()
  }, [profile?.id])

  const load = async () => {
    try {
      const s = await getSessions(profile.id)
      if (mounted.current) setSessions(s)
    } catch (e) {
      if (mounted.current) setError(e.message)
    }
  }

  useEffect(() => {
    if (active) { timer.current = setInterval(() => setElapsed(e => e + 1), 1000) }
    else { clearInterval(timer.current); setElapsed(0) }
    return () => clearInterval(timer.current)
  }, [!!active])

  const startSession = () => {
    setActive({ id: uid(), date: new Date().toISOString(), exercises: [], cardio: [] })
    setView('active')
  }

  const addExercise = async (name, group) => {
    const newEx = { id: uid(), name, muscleGroup: group, sets: [{ id: uid(), weight: '', reps: '' }] }
    setActive(s => ({ ...s, exercises: [...s.exercises, newEx] }))
    setShowPicker(false)
    try {
      const lastSets = await getLastExerciseSets(profile.id, name)
      if (lastSets?.length && mounted.current) {
        const best = lastSets.reduce((a, b) => (+b.weight || 0) > (+a.weight || 0) ? b : a)
        setSuggestions(s => ({ ...s, [name]: { weight: best.weight, reps: best.reps } }))
      }
    } catch { /* suggestion is optional */ }
  }

  const removeExercise = id => setActive(s => ({ ...s, exercises: s.exercises.filter(e => e.id !== id) }))
  const addSet = exId => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: [...ex.sets, { id: uid(), weight: '', reps: '' }] } : ex) }))
  const removeSet = (exId, setId) => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.filter(st => st.id !== setId) } : ex) }))
  const updateSet = (exId, setId, f, v) => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, [f]: v } : st) } : ex) }))
  const addCardio = c => { setActive(s => ({ ...s, cardio: [...s.cardio, { ...c, id: uid() }] })); setShowCardio(false) }

  const finishSession = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    const sess = { ...active, completedAt: new Date().toISOString(), duration: elapsed }
    try {
      await saveSession(profile.id, sess)
      const prs = []
      for (const ex of sess.exercises) {
        for (const set of ex.sets) {
          if (set.weight && set.reps) {
            try {
              const isNew = await checkAndUpdatePR(profile.id, ex.name, ex.muscleGroup, +set.weight, +set.reps)
              if (isNew && !prs.includes(ex.name)) prs.push(ex.name)
            } catch { /* non-fatal: PR check failure shouldn't fail the session */ }
          }
        }
      }
      await load()
      if (mounted.current) {
        setNewPRs(prs); setSummary(sess); setActive(null); setView('summary')
      }
    } catch (e) {
      if (mounted.current) setError('Save failed: ' + e.message)
    }
    if (mounted.current) setSaving(false)
  }

  const fmtTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const sessVol = exs => (exs || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)

  if (view === 'summary' && summary) return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Session Done</h2>
      <div style={{ color: 'var(--text-dim)', marginBottom: 28 }}>{fmtTime(summary.duration || 0)} · {(summary.exercises || []).length} exercises</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <StatPill label="VOLUME" value={`${Math.round(sessVol(summary.exercises)).toLocaleString()} lbs`} />
        <StatPill label="SETS" value={(summary.exercises || []).reduce((s, e) => s + e.sets.length, 0)} />
      </div>
      {newPRs.length > 0 && (
        <div style={{ background: 'var(--accent-low)', border: '1px solid var(--accent)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div className="label" style={{ color: 'var(--accent)', marginBottom: 8 }}>🔥 NEW PRs</div>
          {newPRs.map(pr => <div key={pr} style={{ fontWeight: 600, marginBottom: 4 }}>{pr}</div>)}
        </div>
      )}
      <button onClick={() => { setSummary(null); setNewPRs([]); setView('list') }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '14px 32px', color: '#fff', fontWeight: 700, fontSize: 15, width: '100%' }}>DONE</button>
    </div>
  )

  if (view === 'active' && active) return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '52px 20px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="label">SESSION IN PROGRESS</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 2 }}>{fmtTime(elapsed)}</div>
        </div>
        <button onClick={finishSession} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '10px 22px', color: '#fff', fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? 'SAVING...' : 'FINISH'}</button>
      </div>

      {error && <div style={{ margin: '12px 20px 0', padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {active.exercises.map(ex => (
          <div key={ex.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</div>
                <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '2px', fontFamily: 'var(--mono)', marginTop: 2 }}>{ex.muscleGroup}</div>
                {suggestions[ex.name] && (
                  <div style={{ fontSize: 11, color: '#4a9eb5', marginTop: 4, background: 'rgba(74,158,181,0.1)', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>
                    💡 Last: {suggestions[ex.name].weight} lbs × {suggestions[ex.name].reps} reps
                  </div>
                )}
              </div>
              <button onClick={() => removeExercise(ex.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr 28px', gap: 6, marginBottom: 6 }}>
              <span className="label">#</span><span className="label" style={{ textAlign: 'center' }}>LBS</span><span className="label" style={{ textAlign: 'center' }}>REPS</span><span />
            </div>
            {ex.sets.map((set, i) => (
              <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', textAlign: 'center' }}>{i + 1}</span>
                <input style={INP} type="number" inputMode="decimal" placeholder={suggestions[ex.name]?.weight || '0'} value={set.weight} onChange={e => updateSet(ex.id, set.id, 'weight', e.target.value)} />
                <input style={INP} type="number" inputMode="numeric" placeholder={suggestions[ex.name]?.reps || '0'} value={set.reps} onChange={e => updateSet(ex.id, set.id, 'reps', e.target.value)} />
                <button onClick={() => removeSet(ex.id, set.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18 }}>−</button>
              </div>
            ))}
            <button onClick={() => addSet(ex.id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px', width: '100%', color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>+ ADD SET</button>
          </div>
        ))}

        {active.cardio.map(c => (
          <div key={c.id} className="card" style={{ padding: 14, borderColor: '#1a3a4a' }}>
            <div style={{ fontSize: 9, color: '#4a9eb5', letterSpacing: '2px', fontFamily: 'var(--mono)', marginBottom: 4 }}>CARDIO</div>
            <div style={{ fontWeight: 600 }}>{c.type}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{c.duration} min{c.distance ? ` · ${c.distance} mi` : ''}{c.calories ? ` · ${c.calories} kcal` : ''}</div>
          </div>
        ))}

        <button onClick={() => setShowPicker(true)} style={{ background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: 14, color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>+ ADD EXERCISE</button>
        <button onClick={() => setShowCardio(true)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>+ ADD CARDIO</button>
      </div>

      {showPicker && <ExercisePicker group={pickerGroup} onGroupChange={setPickerGroup} onSelect={addExercise} onClose={() => setShowPicker(false)} />}
      {showCardio && <CardioModal onAdd={addCardio} onClose={() => setShowCardio(false)} />}
    </div>
  )

  if (view === 'calendar') {
    const sessionDates = new Set(sessions.map(s => s.date?.split('T')[0]))
    const year = calMonth.getFullYear(), month = calMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    const monthStr = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return (
      <div style={{ padding: '52px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Sessions</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <TabBtn active={view === 'list'} onClick={() => setView('list')}>LIST</TabBtn>
            <TabBtn active={view === 'calendar'} onClick={() => setView('calendar')}>CAL</TabBtn>
          </div>
        </div>
        <button onClick={startSession} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: 16, fontSize: 15, fontWeight: 700, width: '100%', marginBottom: 24 }}>START SESSION</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text-dim)' }}>‹</button>
          <span style={{ fontWeight: 700 }}>{monthStr}</span>
          <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', color: 'var(--text-dim)' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)', padding: '4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const hasSession = sessionDates.has(dateStr)
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            return (
              <div key={i} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: hasSession ? 'var(--accent-low)' : isToday ? 'var(--bg3)' : 'transparent', border: `1px solid ${isToday ? 'var(--accent)' : 'transparent'}`, position: 'relative' }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: hasSession ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--text-dim)' }}>{d}</span>
                {hasSession && <div style={{ width: 4, height: 4, background: 'var(--accent)', borderRadius: '50%', marginTop: 2 }} />}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '52px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Sessions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabBtn active={view === 'list'} onClick={() => setView('list')}>LIST</TabBtn>
          <TabBtn active={view === 'calendar'} onClick={() => setView('calendar')}>CAL</TabBtn>
        </div>
      </div>
      <p style={{ color: 'var(--text-dim)', marginBottom: 24, fontSize: 14 }}>Log workouts, track your lifts</p>
      <button onClick={startSession} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: 16, fontSize: 15, fontWeight: 700, width: '100%', marginBottom: 24 }}>START SESSION</button>

      {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>No sessions yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map(s => {
            const vol = (s.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)
            const groups = [...new Set((s.exercises || []).map(e => e.muscle_group || e.muscleGroup))].filter(Boolean)
            return (
              <div key={s.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{groups.join(', ') || 'Workout'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                      {(s.exercises || []).length} exercises · {Math.round(vol).toLocaleString()} lbs{s.duration ? ` · ${Math.floor(s.duration / 60)}m` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', marginLeft: 8 }}>{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return <button onClick={onClick} style={{ background: active ? 'var(--accent-low)' : 'var(--bg3)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, padding: '6px 12px', color: active ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '1px', fontFamily: 'var(--mono)' }}>{children}</button>
}

function StatPill({ label, value }) {
  return (
    <div className="card" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
      <div className="label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)' }}>{value}</div>
    </div>
  )
}

function ExercisePicker({ group, onGroupChange, onSelect, onClose }) {
  return (
    <Modal onClose={onClose} title="ADD EXERCISE">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {MUSCLE_GROUPS.map(g => <button key={g} onClick={() => onGroupChange(g)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: group === g ? 'var(--accent)' : 'var(--bg3)', color: group === g ? '#fff' : 'var(--text-dim)', fontSize: 12, fontWeight: 600 }}>{g}</button>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(EXERCISES[group] || []).map(ex => <button key={ex} onClick={() => onSelect(ex, group)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', textAlign: 'left', color: 'var(--text)', fontSize: 14 }}>{ex}</button>)}
      </div>
    </Modal>
  )
}

const CARD_INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '11px 12px', fontSize: 15, width: '100%' }

function CardioModal({ onAdd, onClose }) {
  const [type, setType] = useState(CARDIO_TYPES[0])
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [calories, setCalories] = useState('')
  return (
    <Modal onClose={onClose} title="ADD CARDIO">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {CARDIO_TYPES.map(t => <button key={t} onClick={() => setType(t)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: type === t ? '#4a9eb5' : 'var(--bg3)', color: type === t ? '#fff' : 'var(--text-dim)', fontSize: 12, fontWeight: 600 }}>{t}</button>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <input style={CARD_INP} type="number" placeholder="Duration (minutes) *" value={duration} onChange={e => setDuration(e.target.value)} />
        <input style={CARD_INP} type="number" placeholder="Distance (miles) — optional" value={distance} onChange={e => setDistance(e.target.value)} />
        <input style={CARD_INP} type="number" placeholder="Calories burned — optional" value={calories} onChange={e => setCalories(e.target.value)} />
      </div>
      <button onClick={() => duration && onAdd({ type, duration: +duration, distance: distance ? +distance : null, calories: calories ? +calories : null })} style={{ background: '#4a9eb5', border: 'none', borderRadius: 'var(--radius-sm)', padding: 14, width: '100%', color: '#fff', fontWeight: 700, fontSize: 14 }}>ADD CARDIO</button>
    </Modal>
  )
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span className="label">{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
