import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getSessions, saveSession, updateSession, deleteSession, checkAndUpdatePR, getLastExerciseSets,
  getTemplates, saveTemplate, deleteTemplate, updateProfile,
} from '../lib/db'
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, calcSessionVolume } from '../lib/ranks'
import { getNotifPermission, requestNotifPermission, showTimerNotification, subscribePush, isPushSubscribed } from '../lib/notifications'

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
  const { profile, setProfile } = useAuth()
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
  const [error, setError] = useState(null)
  const restIntervalRef = useRef(null)
  const [restSeconds, setRestSeconds] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [restDone, setRestDone] = useState(false)

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
    catch(e) { setError('Delete failed: ' + e.message) }
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
    } catch (e) { setError(e.message) }
  }

  const handleSaveSummaryTemplate = async () => {
    if (!templateName.trim() || !summary?.exercises?.length) return
    setTemplateSaving(true)
    try {
      await saveTemplate(profile.id, templateName.trim(), summary.exercises)
      setTemplates(await getTemplates(profile.id))
      setTemplateName(''); setShowTemplateSave(false)
    } catch (e) { setError(e.message) }
    setTemplateSaving(false)
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
    } catch(e) { setError('Save failed: ' + e.message) }
    setSaving(false)
  }

  const fmtTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const sessVol = exs => (exs || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)

  const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 6px', fontSize: 15, textAlign: 'center', width: '100%', fontFamily: 'var(--mono)' }

  // ── SUMMARY ───────────────────────────────────────────────
  if (view === 'summary' && summary) return (
    <div className="page" style={{ padding:'var(--page-top) 20px 24px', textAlign:'center' }}>
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
              onKeyDown={e => e.key === 'Enter' && handleSaveSummaryTemplate()}
            />
            <button onClick={handleSaveSummaryTemplate} disabled={templateSaving || !templateName.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '11px 16px', color: '#fff', fontWeight: 700, fontSize: 13 }}>
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
    <div className="page" style={{ paddingBottom:24 }}>
      <div style={{ padding:'var(--page-top) 20px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
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

        {/* Rest Timer */}
        <div className="card" style={{ padding: 14 }}>
          <div className="label" style={{ marginBottom: 10 }}>REST TIMER</div>
          {restActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--mono)', color: restSeconds <= 10 ? 'var(--accent)' : 'var(--text)', flex: 1 }}>
                {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}
              </div>
              <button onClick={cancelRest} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', color: 'var(--text-dim)', fontWeight: 700, fontSize: 12 }}>STOP</button>
            </div>
          ) : restDone ? (
            <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14 }}>Rest complete — get to your next set!</div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              {[60, 90, 120, 180].map(s => (
                <button key={s} onClick={() => startRest(s)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '9px 0', color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                  {`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

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

  const handleSaveSplit = async (splitData) => {
    const updated = await updateProfile(profile.id, { workout_split: splitData })
    setProfile(updated)
  }

  // ── SPLIT VIEW ────────────────────────────────────────────
  if (view === 'split') return (
    <div className="page" style={{ padding: 'var(--page-top) 20px 32px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={() => setView('list')} style={{ background:'none', border:'none', color:'var(--accent)', fontSize:14, fontWeight:600, padding:0 }}>← Back</button>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Weekly Split</h2>
      </div>
      <WorkoutSplitView profile={profile} setProfile={setProfile} onSave={handleSaveSplit} />
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
      <div className="page" style={{ padding: 'var(--page-top) 20px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Training</h2>
        <div style={{ display: 'flex', gap: 8, background: 'var(--bg3)', borderRadius: 100, padding: 4, marginBottom: 16 }}>
          <TabBtn active={false} onClick={() => setView('list')}>List</TabBtn>
          <TabBtn active={true} onClick={() => setView('calendar')}>Calendar</TabBtn>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:12 }}>
          <button onClick={startSession} style={{ flex:2, background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:'16px 0', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><span>▶</span> Start Session</button>
          <button onClick={()=>setShowTemplates(true)} style={{ flex:1, background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, fontSize:14, fontWeight:600 }}>Template</button>
        </div>

        <div className="card" style={{ padding:16, marginBottom:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:18, fontWeight:800 }}>{monthStr}</span>
          <div style={{ display:'flex', gap:8 }}><button onClick={()=>setCalMonth(new Date(year,month-1,1))} style={{ background:'none', border:'none', color:'var(--text-dim)', fontSize:20, padding:'0 4px' }}>←</button>
          <button onClick={()=>setCalMonth(new Date(year,month+1,1))} style={{ background:'none', border:'none', color:'var(--text-dim)', fontSize:20, padding:'0 4px' }}>→</button></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', padding: '4px 0' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const hasSession = sessionDates.has(dateStr)
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            return (
              <div key={i} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: isToday ? '1px solid var(--accent)' : '1px solid transparent' }}>
                <span style={{ fontSize: 14, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text)' }}>{d}</span>
                {hasSession && <div style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', marginTop: 2 }} />}
              </div>
            )
          })}
        </div>
        </div>
        {showTemplates && <TemplatesModal templates={templates} sessions={sessions} onPickTemplate={startFromTemplate} onPickSession={startFromPastSession} onDeleteTemplate={handleDeleteTemplate} onClose={()=>setShowTemplates(false)} />}
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────
  return (
    <div className="page" style={{ padding: 'var(--page-top) 20px 24px' }}>
      {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Training</h2>
      <div style={{ display: 'flex', gap: 8, background: 'var(--bg3)', borderRadius: 100, padding: 4, marginBottom: 16 }}>
        <TabBtn active={true} onClick={() => setView('list')}>List</TabBtn>
        <TabBtn active={false} onClick={() => setView('calendar')}>Calendar</TabBtn>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <button onClick={startSession} style={{ flex:2, background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:'16px 0', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <span>▶</span> Start Session
        </button>
        <button onClick={()=>setShowTemplates(true)} style={{ flex:1, background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, fontSize:14, fontWeight:600 }}>Template</button>
      </div>
      <button onClick={() => setView('split')} style={{ width:'100%', background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 0', fontSize:14, fontWeight:600, marginBottom:20, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <span>📋</span> Weekly Split
      </button>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 14 }}>No sessions yet — start lifting 💪</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => {
            const vol = calcSessionVolume(s)
            const groups = [...new Set((s.exercises||[]).map(e=>e.muscle_group||e.muscleGroup))].filter(Boolean)
            const deleting = confirmDelete === s.id
            return (
              <div key={s.id} className="card" style={{ padding:'16px 18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>{groups.join(', ')||'Workout'}</div>
                    <div style={{ fontSize:13, color:'var(--text-dim)' }}>
                      {(s.exercises||[]).length} exercises · {Math.round(vol).toLocaleString()} lbs{s.duration?` · ${Math.floor(s.duration/60)}m`:''}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>
                      {new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, marginLeft:8 }}>
                    <button onClick={() => editSession(s)} style={{ background:'none', border:'none', color:'var(--text-dim)', fontSize:18, padding:'4px' }}>✏️</button>
                    <button onClick={() => setConfirmDelete(deleting ? null : s.id)} style={{ background:'none', border:'none', color:'var(--accent)', fontSize:18, padding:'4px' }}>🗑️</button>
                  </div>
                </div>
                {deleting && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                    <div style={{ fontSize:13, color:'var(--text-dim)', marginBottom:10 }}>Delete this session permanently?</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => setConfirmDelete(null)} style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px', color:'var(--text-dim)', fontSize:13, fontWeight:600 }}>Cancel</button>
                      <button onClick={() => handleDelete(s.id)} style={{ flex:1, background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:'9px', color:'#fff', fontSize:13, fontWeight:700 }}>Delete</button>
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
  return <button onClick={onClick} style={{ background: active ? 'var(--accent)' : 'var(--bg3)', border: 'none', borderRadius: 100, padding: '9px 20px', color: active ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: active ? 700 : 500 }}>{children}</button>
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
      <div style={{ position:'sticky', top:0, background:'var(--bg2)', zIndex:1, marginLeft:-20, marginRight:-20, paddingLeft:20, paddingRight:20, paddingTop:4, paddingBottom:12, marginTop:-16, marginBottom:2 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MUSCLE_GROUPS.map(g => <button key={g} onClick={() => onGroupChange(g)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', background: group === g ? 'var(--accent)' : 'var(--bg3)', color: group === g ? '#fff' : 'var(--text-dim)', fontSize: 12, fontWeight: 600 }}>{g}</button>)}
        </div>
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
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div className="modal-sheet" style={{ background: 'var(--bg2)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* Fixed header — never scrolls away */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 20px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <span className="label">{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22 }}>×</button>
        </div>
        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 40px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── WORKOUT SPLIT EDITOR ──────────────────────────────────
const SPLIT_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SPLIT_DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function WorkoutSplitView({ profile, setProfile, onSave }) {
  const saved = profile?.workout_split || {}
  const [days, setDays] = useState(() => {
    const d = saved.days || {}
    const r = {}
    for (let i = 0; i < 7; i++) r[i] = Object.prototype.hasOwnProperty.call(d, i) ? d[i] : null
    return r
  })
  const [editDay, setEditDay] = useState(null)
  const [notifyEnabled, setNotifyEnabled] = useState(saved.notifyEnabled ?? false)
  const [notifyTime, setNotifyTime] = useState(saved.notifyTime ?? '09:00')
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [notifPerm, setNotifPerm] = useState(() => getNotifPermission())
  const [error, setError] = useState(null)

  useEffect(() => {
    isPushSubscribed().then(() => {})
  }, [])

  const handleDayClick = (i) => {
    if (editDay === i) { setEditDay(null); return }
    if (days[i] === null) setDays(d => ({ ...d, [i]: [] }))
    setEditDay(i)
  }

  const removeDay = (i) => {
    setDays(d => ({ ...d, [i]: null }))
    if (editDay === i) setEditDay(null)
  }

  const toggleMuscle = (muscle) => {
    if (editDay === null) return
    setDays(d => {
      const curr = d[editDay] || []
      return { ...d, [editDay]: curr.includes(muscle) ? curr.filter(m => m !== muscle) : [...curr, muscle] }
    })
  }

  const handleNotifyToggle = async () => {
    setError(null)
    if (!notifyEnabled) {
      let perm = notifPerm
      if (perm === 'default') {
        perm = await requestNotifPermission()
        setNotifPerm(perm)
      }
      if (perm === 'denied') {
        setError('Notifications are blocked. Please enable them in your device/browser settings.')
        return
      }
      try {
        await subscribePush(profile.id)
      } catch (e) {
        setError('Could not subscribe to push notifications. Make sure VAPID keys are configured.')
        return
      }
    }
    setNotifyEnabled(v => !v)
  }

  const handleSave = async () => {
    setSaving(true); setError(null)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      await onSave({ days, notifyEnabled, notifyTime, timezone })
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2200)
    } catch (e) {
      setError('Failed to save: ' + e.message)
    }
    setSaving(false)
  }

  const workoutDays = Object.entries(days).filter(([, m]) => m !== null)

  return (
    <div>
      {/* Day grid */}
      <div className="label" style={{ marginBottom: 10 }}>WORKOUT DAYS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {SPLIT_DAY_SHORT.map((name, i) => {
          const isOn = days[i] !== null
          const isActive = editDay === i
          return (
            <button key={i} onClick={() => handleDayClick(i)} style={{
              background: isOn ? (isActive ? 'var(--accent)' : 'var(--accent-low)') : 'var(--bg3)',
              border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, padding: '11px 0',
              color: isOn ? (isActive ? '#fff' : 'var(--accent)') : 'var(--text-muted)',
              fontSize: 10, fontWeight: 700,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}>
              {name}
              {isOn && <div style={{ width: 4, height: 4, borderRadius: '50%', background: isActive ? 'rgba(255,255,255,0.7)' : 'var(--accent)' }} />}
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20, textAlign: 'center' }}>Tap a day to add it — tap again to edit muscles</p>

      {/* Muscle editor for selected day */}
      {editDay !== null && days[editDay] !== null && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{SPLIT_DAY_FULL[editDay]}</div>
              <div className="label" style={{ marginTop: 3 }}>SELECT MUSCLES</div>
            </div>
            <button onClick={() => removeDay(editDay)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '1px' }}>
              REMOVE
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MUSCLE_GROUPS.map(m => {
              const sel = (days[editDay] || []).includes(m)
              return (
                <button key={m} onClick={() => toggleMuscle(m)} style={{
                  padding: '8px 16px', borderRadius: 20, border: 'none',
                  background: sel ? 'var(--accent)' : 'var(--bg3)',
                  color: sel ? '#fff' : 'var(--text-dim)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {m}
                </button>
              )
            })}
          </div>
          {(days[editDay] || []).length === 0 && (
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>No muscles selected — this day will just show as a workout day.</p>
          )}
        </div>
      )}

      {/* Split summary (all workout days) */}
      {workoutDays.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {workoutDays.map(([i, muscles]) => (
            <div key={i} onClick={() => handleDayClick(Number(i))} className="card" style={{
              padding: '11px 14px', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderColor: editDay === Number(i) ? 'var(--accent)' : 'var(--border)',
            }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{SPLIT_DAY_FULL[i]}</span>
              <span style={{ fontSize: 11, color: muscles.length ? 'var(--text-dim)' : 'var(--text-muted)', maxWidth: '55%', textAlign: 'right' }}>
                {muscles.length ? muscles.join(' · ') : 'No muscles set'}
              </span>
            </div>
          ))}
        </div>
      )}

      {workoutDays.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          No workout days set yet. Tap the days above to build your split.
        </div>
      )}

      {/* Gym Reminders */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 12 }}>GYM REMINDERS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Workout Notifications</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {notifPerm === 'denied' ? 'Blocked — enable in device settings' : 'Remind me on workout days'}
            </div>
          </div>
          <button onClick={handleNotifyToggle} style={{
            background: notifyEnabled ? 'var(--accent)' : 'var(--bg3)',
            border: `1px solid ${notifyEnabled ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 20, padding: '8px 18px',
            color: notifyEnabled ? '#fff' : 'var(--text-dim)',
            fontSize: 12, fontWeight: 700,
          }}>
            {notifyEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {notifyEnabled && (
          <div style={{ marginTop: 14 }}>
            <div className="label" style={{ marginBottom: 8 }}>REMINDER TIME</div>
            <input
              type="time"
              value={notifyTime}
              onChange={e => setNotifyTime(e.target.value)}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '10px 14px', fontSize: 16, width: '100%' }}
            />
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button onClick={handleSave} disabled={saving} style={{
        background: saveOk ? '#2a7a2a' : 'var(--accent)', border: 'none',
        borderRadius: 'var(--radius)', padding: '15px', width: '100%',
        color: '#fff', fontWeight: 700, fontSize: 15,
        transition: 'background 0.3s ease',
      }}>
        {saveOk ? '✓ SAVED!' : saving ? 'SAVING…' : 'SAVE SPLIT'}
      </button>
    </div>
  )
}
