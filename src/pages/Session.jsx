import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getSessions, saveSession, updateSession, deleteSession, checkAndUpdatePR, getLastExerciseSets,
  getTemplates, saveTemplate, deleteTemplate,
} from '../lib/db'
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, calcSessionVolume } from '../lib/ranks'

const uid = () => Math.random().toString(36).slice(2)
const ACTIVE_KEY = 'bm_active_session'

const loadActive = () => {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.startTime ? parsed : null
  } catch { return null }
}

export default function Session() {
  const { profile } = useAuth()
  // Restore any in-progress session synchronously before first paint so we
  // never render the list view and flicker into 'active'.
  const [active, setActive] = useState(loadActive)
  const [view, setView] = useState(() => (loadActive() ? 'active' : 'list')) // list | calendar | active | summary
  const [sessions, setSessions] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [showCardio, setShowCardio] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showTemplateSave, setShowTemplateSave] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [pickerGroup, setPickerGroup] = useState(MUSCLE_GROUPS[0])
  const [summary, setSummary] = useState(null)
  const [newPRs, setNewPRs] = useState([])
  const [calMonth, setCalMonth] = useState(new Date())
  const [suggestions, setSuggestions] = useState({}) // exerciseName -> sets
  const [isEditing, setIsEditing] = useState(false)
  const [editSessionId, setEditSessionId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const timer = useRef(null)
  const [, setTick] = useState(0) // triggers re-render each second so the timer ticks
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [tplName, setTplName] = useState('')
  const [showDiscard, setShowDiscard] = useState(false)

  useEffect(() => { if (profile) load() }, [profile?.id])
  const load = async () => {
    const [s, t] = await Promise.all([getSessions(profile.id), getTemplates(profile.id)])
    setSessions(s); setTemplates(t)
  }

  // Persist / clear the in-progress session on every change. Elapsed is
  // derived from startTime, so a full page refresh or tab close loses
  // nothing — the stopwatch keeps counting real wall-clock time.
  useEffect(() => {
    try {
      if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active))
      else localStorage.removeItem(ACTIVE_KEY)
    } catch { /* storage quota / private mode — don't crash */ }
  }, [active])

  useEffect(() => {
    if (!active || isEditing) return
    timer.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer.current)
  }, [!!active, isEditing])

  const elapsed = active?.startTime ? Math.max(0, Math.floor((Date.now() - active.startTime) / 1000)) : 0

  const startSession = () => {
    setIsEditing(false); setEditSessionId(null)
    setActive({ id: uid(), date: new Date().toISOString(), startTime: Date.now(), exercises:[], cardio:[] })
    setView('active')
  }

  const editSession = (s) => {
    const converted = {
      id: s.id,
      date: s.date,
      duration: s.duration,
      exercises: (s.exercises || []).map(ex => ({
        id: ex.id,
        name: ex.name,
        muscleGroup: ex.muscle_group || ex.muscleGroup,
        sets: (ex.sets || []).map(st => ({ id: st.id, weight: String(st.weight ?? ''), reps: String(st.reps ?? '') })),
      })),
      cardio: (s.cardio || []).map(c => ({ ...c })),
    }
    setIsEditing(true)
    setEditSessionId(s.id)
    setActive(converted)
    setView('active')
  }

  const cancelEdit = () => { setActive(null); setIsEditing(false); setEditSessionId(null); setView('list') }

  const handleDelete = async (sessionId) => {
    try { await deleteSession(sessionId, profile.id); await load() }
    catch(e) { alert('Delete failed: ' + e.message) }
    setConfirmDelete(null)
  }

  const discardSession = () => {
    setActive(null)
    setShowDiscard(false)
    setView('list')
  }

  const startFromTemplate = async (tpl) => {
    const exs = (tpl.exercises || []).map(e => ({
      id: uid(),
      name: e.name,
      muscleGroup: e.muscleGroup || e.muscle_group,
      sets: [{ id: uid(), weight:'', reps:'' }],
    }))
    setIsEditing(false); setEditSessionId(null)
    setActive({ id: uid(), date: new Date().toISOString(), startTime: Date.now(), exercises: exs, cardio: [] })
    setView('active')
    setShowTemplates(false)
    // prefetch suggestions for each exercise
    for (const ex of exs) {
      const lastSets = await getLastExerciseSets(profile.id, ex.name)
      if (lastSets?.length) {
        const best = lastSets.reduce((a,b) => (+b.weight||0)>(+a.weight||0)?b:a)
        setSuggestions(s => ({ ...s, [ex.name]: { weight: best.weight, reps: best.reps } }))
      }
    }
  }

  const startFromPastSession = async (s) => {
    const exs = (s.exercises || []).map(e => ({
      id: uid(),
      name: e.name,
      muscleGroup: e.muscle_group || e.muscleGroup,
      sets: [{ id: uid(), weight:'', reps:'' }],
    }))
    setIsEditing(false); setEditSessionId(null)
    setActive({ id: uid(), date: new Date().toISOString(), startTime: Date.now(), exercises: exs, cardio: [] })
    setView('active')
    setShowTemplates(false)
    for (const ex of exs) {
      const lastSets = await getLastExerciseSets(profile.id, ex.name)
      if (lastSets?.length) {
        const best = lastSets.reduce((a,b) => (+b.weight||0)>(+a.weight||0)?b:a)
        setSuggestions(s => ({ ...s, [ex.name]: { weight: best.weight, reps: best.reps } }))
      }
    }
  }

  const handleSaveTemplate = async () => {
    if (!tplName.trim() || !active?.exercises?.length) return
    try {
      await saveTemplate(profile.id, tplName.trim(), active.exercises)
      setTemplates(await getTemplates(profile.id))
      setTplName(''); setShowSaveTpl(false)
    } catch (e) { alert(e.message) }
  }

  const handleDeleteTemplate = async (id) => {
    await deleteTemplate(id)
    setTemplates(await getTemplates(profile.id))
  }

  const addExercise = async (name, group) => {
    const newEx = { id: uid(), name, muscleGroup: group, sets: [{ id: uid(), weight: '', reps: '' }] }
    setActive(s => ({ ...s, exercises: [...s.exercises, newEx] }))
    setShowPicker(false)
    const lastSets = await getLastExerciseSets(profile.id, name)
    if (lastSets?.length) {
      const best = lastSets.reduce((a, b) => (+b.weight || 0) > (+a.weight || 0) ? b : a)
      setSuggestions(s => ({ ...s, [name]: { weight: best.weight, reps: best.reps } }))
    }
  }

  const removeExercise = id => setActive(s => ({ ...s, exercises: s.exercises.filter(e => e.id !== id) }))
  const addSet = exId => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: [...ex.sets, { id: uid(), weight: '', reps: '' }] } : ex) }))
  const removeSet = (exId, setId) => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.filter(st => st.id !== setId) } : ex) }))
  const updateSet = (exId, setId, f, v) => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, [f]: v } : st) } : ex) }))
  const addCardio = c => { setActive(s => ({ ...s, cardio: [...s.cardio, { ...c, id: uid() }] })); setShowCardio(false) }

  // ── REST TIMER ───────────────────────────────────────────
  const startRest = async (duration) => {
    // Request notification permission on first use
    if (getNotifPermission() === 'default') await requestNotifPermission()

    clearInterval(restIntervalRef.current)
    setRestSeconds(duration)
    setRestActive(true)
    setRestDone(false)

    let remaining = duration
    restIntervalRef.current = setInterval(() => {
      remaining--
      setRestSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(restIntervalRef.current)
        setRestActive(false)
        setRestDone(true)
        setTimeout(() => setRestDone(false), 4000)
        // Show notification — works even when app is backgrounded in standalone mode
        showTimerNotification('Rest Complete ⏱', 'Time to get back to your workout!')
      }
    }, 1000)
  }

  const cancelRest = () => {
    clearInterval(restIntervalRef.current)
    setRestActive(false)
    setRestSeconds(0)
    setRestDone(false)
  }

  const finishSession = async () => {
    setSaving(true)
    try {
      if (isEditing) {
        await updateSession(editSessionId, profile.id, active)
        await load()
        setActive(null); setIsEditing(false); setEditSessionId(null); setView('list')
      } else {
        const sess = { ...active, completedAt: new Date().toISOString(), duration: elapsed }
        await saveSession(profile.id, sess)
        const prChecks = sess.exercises.flatMap(ex =>
          ex.sets
            .filter(set => set.weight && set.reps)
            .map(set => checkAndUpdatePR(profile.id, ex.name, ex.muscleGroup, +set.weight, +set.reps)
              .then(isNew => isNew ? ex.name : null))
        )
        const results = await Promise.all(prChecks)
        const prs = [...new Set(results.filter(Boolean))]
        await load()
        setNewPRs(prs); setSummary(sess); setActive(null); setView('summary')
      }
    } catch(e) { alert('Save failed: ' + e.message) }
    setSaving(false)
  }

  const fmtTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const sessVol = exs => (exs || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)

  const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 6px', fontSize: 15, textAlign: 'center', width: '100%', fontFamily: 'var(--mono)' }

  // ── SUMMARY ───────────────────────────────────────────────
  if (view === 'summary' && summary) return (
    <div style={{ padding:'60px 20px', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🏁</div>
      <h2 style={{ fontSize:28, fontWeight:800, marginBottom:4 }}>Session Done</h2>
      <div style={{ color:'var(--text-dim)', marginBottom:28 }}>{fmtTime(summary.duration||0)} · {(summary.exercises||[]).length} exercises</div>
      <div style={{ display:'flex', gap:10, marginBottom:24 }}>
        <StatPill label="VOLUME" value={`${Math.round(calcSessionVolume(summary)).toLocaleString()} lbs`} />
        <StatPill label="SETS" value={(summary.exercises||[]).reduce((s,e)=>s+e.sets.length,0)} />
      </div>
      {newPRs.length > 0 && (
        <div style={{ background: 'var(--accent-low)', border: '1px solid var(--accent)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div className="label" style={{ color: 'var(--accent)', marginBottom: 8 }}>🔥 NEW PRs</div>
          {newPRs.map(pr => <div key={pr} style={{ fontWeight: 600, marginBottom: 4 }}>{pr}</div>)}
        </div>
      )}
      {showTemplateSave ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'left' }}>
          <div className="label" style={{ marginBottom: 10 }}>TEMPLATE NAME</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              autoFocus
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '11px 12px', fontSize: 15 }}
              placeholder="e.g. Push Day A"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
            />
            <button onClick={handleSaveTemplate} disabled={templateSaving || !templateName.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 16px', color: '#fff', fontWeight: 700, fontSize: 13 }}>
              {templateSaving ? '…' : 'SAVE'}
            </button>
            <button onClick={() => setShowTemplateSave(false)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '11px 12px', color: 'var(--text-dim)' }}>×</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowTemplateSave(true)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 32px', color: 'var(--text-dim)', fontWeight: 600, fontSize: 14, width: '100%', marginBottom: 12 }}>
          SAVE AS TEMPLATE
        </button>
      )}
      <button onClick={() => { setSummary(null); setNewPRs([]); setView('list') }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '14px 32px', color: '#fff', fontWeight: 700, fontSize: 15, width: '100%' }}>DONE</button>
    </div>
  )

  // ── ACTIVE SESSION ────────────────────────────────────────
  if (view === 'active' && active) return (
    <div style={{ paddingBottom:24 }}>
      <div style={{ padding:'52px 20px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div className="label">{isEditing ? 'EDIT SESSION' : 'SESSION IN PROGRESS'}</div>
          {isEditing
            ? <div style={{ fontSize:13, color:'var(--text-dim)', marginTop:2 }}>{new Date(active.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
            : <div style={{ fontSize:24, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)', marginTop:2 }}>{fmtTime(elapsed)}</div>
          }
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {isEditing && <button onClick={cancelEdit} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'10px 16px', color:'var(--text-dim)', fontWeight:700, fontSize:14 }}>CANCEL</button>}
          <button onClick={finishSession} disabled={saving} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:'10px 22px', color:'#fff', fontWeight:700, fontSize:14 }}>{saving ? 'SAVING...' : isEditing ? 'SAVE' : 'FINISH'}</button>
        </div>
      </div>

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

        <button onClick={()=>setShowPicker(true)} style={{ background:'transparent', border:'1px dashed var(--border)', borderRadius:'var(--radius)', padding:14, color:'var(--text-dim)', fontSize:14, fontWeight:600 }}>+ ADD EXERCISE</button>
        <button onClick={()=>setShowCardio(true)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:12, color:'var(--text-muted)', fontSize:12 }}>+ ADD CARDIO</button>
        {active.exercises.length > 0 && (
          <button onClick={()=>setShowSaveTpl(true)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:10, color:'var(--text-muted)', fontSize:11, letterSpacing:'1px', fontWeight:700 }}>SAVE AS TEMPLATE</button>
        )}
        <button onClick={()=>setShowDiscard(true)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:10, color:'var(--text-muted)', fontSize:11, letterSpacing:'1px', fontWeight:700 }}>DISCARD SESSION</button>
      </div>

      {showPicker && <ExercisePicker group={pickerGroup} onGroupChange={setPickerGroup} onSelect={addExercise} onClose={()=>setShowPicker(false)} />}
      {showCardio && <CardioModal onAdd={addCardio} onClose={()=>setShowCardio(false)} />}
      {showDiscard && (
        <Modal onClose={()=>setShowDiscard(false)} title="DISCARD SESSION?">
          <div style={{ fontSize:13, color:'var(--text-dim)', marginBottom:16, lineHeight:1.5 }}>
            You&apos;ll lose {active.exercises.length} exercise{active.exercises.length===1?'':'s'} and {fmtTime(elapsed)} of tracked time. This can&apos;t be undone.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setShowDiscard(false)} style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:12, color:'var(--text-dim)', fontWeight:600 }}>Keep going</button>
            <button onClick={discardSession} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:12, color:'#fff', fontWeight:700, fontSize:14 }}>DISCARD</button>
          </div>
        </Modal>
      )}
      {showSaveTpl && (
        <Modal onClose={()=>setShowSaveTpl(false)} title="SAVE AS TEMPLATE">
          <input
            autoFocus
            value={tplName}
            onChange={e=>setTplName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleSaveTemplate()}
            placeholder="Template name (e.g. Push Day)"
            style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'12px 14px', fontSize:15, width:'100%', marginBottom:12 }}
          />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{ setShowSaveTpl(false); setTplName('') }} style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:12, color:'var(--text-dim)', fontWeight:600 }}>Cancel</button>
            <button onClick={handleSaveTemplate} disabled={!tplName.trim()} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:12, color:'#fff', fontWeight:700, fontSize:14, opacity:tplName.trim()?1:0.5 }}>SAVE</button>
          </div>
        </Modal>
      )}
    </div>
  )

  // ── CALENDAR VIEW ─────────────────────────────────────────
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
            <TabBtn active={false} onClick={() => setView('list')}>LIST</TabBtn>
            <TabBtn active={true} onClick={() => setView('calendar')}>CAL</TabBtn>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          <button onClick={startSession} style={{ flex:2, background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:16, fontSize:15, fontWeight:700 }}>START SESSION</button>
          <button onClick={()=>setShowTemplates(true)} style={{ flex:1, background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, fontSize:12, fontWeight:700, letterSpacing:'1px' }}>TEMPLATE</button>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <button onClick={()=>setCalMonth(new Date(year,month-1,1))} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'6px 12px', color:'var(--text-dim)' }}>‹</button>
          <span style={{ fontWeight:700 }}>{monthStr}</span>
          <button onClick={()=>setCalMonth(new Date(year,month+1,1))} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'6px 12px', color:'var(--text-dim)' }}>›</button>
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
              <div key={i} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: hasSession ? 'var(--accent-low)' : isToday ? 'var(--bg3)' : 'transparent', border: `1px solid ${isToday ? 'var(--accent)' : 'transparent'}` }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: hasSession ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--text-dim)' }}>{d}</span>
                {hasSession && <div style={{ width: 4, height: 4, background: 'var(--accent)', borderRadius: '50%', marginTop: 2 }} />}
              </div>
            )
          })}
        </div>
        {showTemplates && <TemplatesModal templates={templates} sessions={sessions} onPickTemplate={startFromTemplate} onPickSession={startFromPastSession} onDeleteTemplate={handleDeleteTemplate} onClose={()=>setShowTemplates(false)} />}
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────
  return (
    <div style={{ padding: '52px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800 }}>Sessions</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabBtn active={true} onClick={() => setView('list')}>LIST</TabBtn>
          <TabBtn active={false} onClick={() => setView('calendar')}>CAL</TabBtn>
        </div>
      </div>
      <p style={{ color:'var(--text-dim)', marginBottom:24, fontSize:14 }}>Log workouts, track your lifts</p>
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        <button onClick={startSession} style={{ flex:2, background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:16, fontSize:15, fontWeight:700 }}>START SESSION</button>
        <button onClick={()=>setShowTemplates(true)} style={{ flex:1, background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, fontSize:12, fontWeight:700, letterSpacing:'1px' }}>TEMPLATE</button>
      </div>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>No sessions yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map(s => {
            const vol = calcSessionVolume(s)
            const groups = [...new Set((s.exercises||[]).map(e=>e.muscle_group||e.muscleGroup))].filter(Boolean)
            const deleting = confirmDelete === s.id
            return (
              <div key={s.id} className="card" style={{ padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{groups.join(', ')||'Workout'}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>
                      {(s.exercises||[]).length} exercises · {Math.round(vol).toLocaleString()} lbs{s.duration?` · ${Math.floor(s.duration/60)}m`:''}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:8 }}>
                    <span style={{ fontSize:11, color:'var(--text-dim)' }}>{new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                    <button onClick={() => editSession(s)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 8px', color:'var(--text-dim)', fontSize:11, fontWeight:600 }}>Edit</button>
                    <button onClick={() => setConfirmDelete(deleting ? null : s.id)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:18, lineHeight:1, padding:'2px 4px' }}>✕</button>
                  </div>
                </div>
                {deleting && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                    <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:10 }}>Delete this session permanently?</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => setConfirmDelete(null)} style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px', color:'var(--text-dim)', fontSize:12, fontWeight:600 }}>Cancel</button>
                      <button onClick={() => handleDelete(s.id)} style={{ flex:1, background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:'8px', color:'#fff', fontSize:12, fontWeight:700 }}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {showTemplates && <TemplatesModal templates={templates} sessions={sessions} onPickTemplate={startFromTemplate} onPickSession={startFromPastSession} onDeleteTemplate={handleDeleteTemplate} onClose={()=>setShowTemplates(false)} />}
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
  const [customName, setCustomName] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const submitCustom = () => {
    const n = customName.trim()
    if (!n) return
    onSelect(n, group)
    setCustomName(''); setShowCustom(false)
  }
  return (
    <Modal onClose={onClose} title="ADD EXERCISE">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {MUSCLE_GROUPS.map(g => <button key={g} onClick={() => onGroupChange(g)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: group === g ? 'var(--accent)' : 'var(--bg3)', color: group === g ? '#fff' : 'var(--text-dim)', fontSize: 12, fontWeight: 600 }}>{g}</button>)}
      </div>
      {showCustom ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', letterSpacing:'2px', fontFamily:'var(--mono)' }}>CUSTOM — {group.toUpperCase()}</div>
          <input
            autoFocus
            value={customName}
            onChange={e=>setCustomName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&submitCustom()}
            placeholder="e.g. Landmine Twist"
            style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'12px 14px', fontSize:15, width:'100%' }}
          />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>{ setShowCustom(false); setCustomName('') }} style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:11, color:'var(--text-dim)', fontWeight:600 }}>Cancel</button>
            <button onClick={submitCustom} disabled={!customName.trim()} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:11, color:'#fff', fontWeight:700, fontSize:14, opacity:customName.trim()?1:0.5 }}>ADD</button>
          </div>
        </div>
      ) : (
        <button onClick={()=>setShowCustom(true)} style={{ width:'100%', background:'transparent', border:'1px dashed var(--accent)', borderRadius:'var(--radius-sm)', padding:'12px', color:'var(--accent)', fontSize:13, fontWeight:700, letterSpacing:'1px', marginBottom:12 }}>+ CUSTOM MACHINE / EXERCISE</button>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {(EXERCISES[group]||[]).map(ex => <button key={ex} onClick={()=>onSelect(ex,group)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'13px 14px', textAlign:'left', color:'var(--text)', fontSize:14 }}>{ex}</button>)}
      </div>
    </Modal>
  )
}

function TemplatesModal({ templates, sessions, onPickTemplate, onPickSession, onDeleteTemplate, onClose }) {
  const recent = (sessions || []).slice(0, 10)
  return (
    <Modal onClose={onClose} title="START FROM TEMPLATE">
      {templates.length === 0 && recent.length === 0 && (
        <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-muted)', fontSize:13 }}>
          No templates or past sessions yet. Finish a session first, then save it as a template.
        </div>
      )}
      {templates.length > 0 && (
        <>
          <div className="label" style={{ marginBottom:10 }}>SAVED TEMPLATES</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:18 }}>
            {templates.map(t => {
              const groups = [...new Set((t.exercises||[]).map(e => e.muscleGroup || e.muscle_group))].filter(Boolean)
              return (
                <div key={t.id} className="card" style={{ padding:12, display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{t.name}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)', marginTop:2 }}>
                      {(t.exercises||[]).length} exercises · {groups.join(', ')||'—'}
                    </div>
                  </div>
                  <button onClick={()=>onPickTemplate(t)} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:'8px 14px', color:'#fff', fontWeight:700, fontSize:12 }}>RUN</button>
                  <button onClick={()=>onDeleteTemplate(t.id)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:18, padding:'0 4px' }}>×</button>
                </div>
              )
            })}
          </div>
        </>
      )}
      {recent.length > 0 && (
        <>
          <div className="label" style={{ marginBottom:10 }}>RE-RUN PAST SESSION</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {recent.map(s => {
              const groups = [...new Set((s.exercises||[]).map(e=>e.muscle_group||e.muscleGroup))].filter(Boolean)
              return (
                <button key={s.id} onClick={()=>onPickSession(s)} className="card" style={{ padding:12, textAlign:'left', cursor:'pointer' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontWeight:600, fontSize:13 }}>{groups.join(', ')||'Workout'}</span>
                    <span style={{ fontSize:11, color:'var(--text-dim)' }}>{new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)', marginTop:3 }}>
                    {(s.exercises||[]).length} exercises
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}

function CardioModal({ onAdd, onClose }) {
  const [type, setType] = useState(CARDIO_TYPES[0])
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [calories, setCalories] = useState('')
  const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '11px 12px', fontSize: 15, width: '100%' }
  return (
    <Modal onClose={onClose} title="ADD CARDIO">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {CARDIO_TYPES.map(t => <button key={t} onClick={() => setType(t)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: type === t ? '#4a9eb5' : 'var(--bg3)', color: type === t ? '#fff' : 'var(--text-dim)', fontSize: 12, fontWeight: 600 }}>{t}</button>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <input style={INP} type="number" placeholder="Duration (minutes) *" value={duration} onChange={e => setDuration(e.target.value)} />
        <input style={INP} type="number" placeholder="Distance (miles) — optional" value={distance} onChange={e => setDistance(e.target.value)} />
        <input style={INP} type="number" placeholder="Calories burned — optional" value={calories} onChange={e => setCalories(e.target.value)} />
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
