import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getSessions, saveSession, updateSession, deleteSession, checkAndUpdatePR, getLastExerciseSets,
  getTemplates, saveTemplate, deleteTemplate, updateProfile,
  getCustomExercises, saveCustomExercise, deleteCustomExercise,
  getPostSessionCoach,
} from '../lib/db'
import { MUSCLE_GROUPS, EXERCISES, CARDIO_TYPES, calcSessionVolume } from '../lib/ranks'
import { getNotifPermission, requestNotifPermission, showTimerNotification, subscribePush, isPushSubscribed } from '../lib/notifications'
import { haptic } from '../lib/haptics'
import { audio } from '../lib/audio'
import { TargetIcon, FlameIcon, DumbbellIcon, BoltIcon, TrophyIcon, CrownIcon, StarIcon, MedalIcon, CameraIcon, EditIcon, TrashIcon, ListIcon, BikeIcon, SparkleIcon } from '../lib/icons'
import { estimateCalories } from '../lib/food'

const REP_RANGE_KEY = 'bm_rep_ranges'
const getRepRanges = () => { try { return JSON.parse(localStorage.getItem(REP_RANGE_KEY) || '{}') } catch { return {} } }
const saveRepRange = (name, min, max) => { const r = getRepRanges(); r[name] = { min: +min, max: +max }; localStorage.setItem(REP_RANGE_KEY, JSON.stringify(r)) }
const deleteRepRange = (name) => { const r = getRepRanges(); delete r[name]; localStorage.setItem(REP_RANGE_KEY, JSON.stringify(r)) }
const SESSION_MILESTONES = [1, 10, 25, 50, 100, 250, 500]

const photoToBase64 = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = e => resolve(e.target.result)
  reader.readAsDataURL(file)
})

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
  const { profile, setProfile, isSubscribed, user } = useAuth()
  const navigate = useNavigate()
  const unit = profile?.unit || 'lbs'
  const distUnit = unit === 'kg' ? 'km' : 'mi'
  const weightKg = profile?.weight ? (unit === 'kg' ? +profile.weight : Math.round(+profile.weight / 2.205)) : 70
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
  const [coachCard, setCoachCard] = useState(null)
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
  const [oneRMEx, setOneRMEx] = useState(null)
  const [plateEx, setPlateEx] = useState(null)
  const [customExercises, setCustomExercises] = useState([])
  const [repRanges, setRepRanges] = useState(getRepRanges)
  const [editingRange, setEditingRange] = useState(null)
  const [rangeForm, setRangeForm] = useState({ min: '', max: '' })
  const [milestone, setMilestone] = useState(null)
  const [prCelebration, setPrCelebration] = useState(null)
  const restIntervalRef = useRef(null)
  const [restSeconds, setRestSeconds] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [restDone, setRestDone] = useState(false)
  const [calDaySessions, setCalDaySessions] = useState(null)
  const photoRef = useRef()

  useEffect(() => { if (profile) load() }, [profile?.id])
  const load = async () => {
    try {
      const [s, t, cx] = await Promise.all([getSessions(profile.id), getTemplates(profile.id), getCustomExercises(profile.id)])
      setSessions(s); setTemplates(t); setCustomExercises(cx)
    } catch(e) { setError('Failed to load: ' + e.message) }
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

  useEffect(() => {
    const el = document.getElementById('scroll-root')
    if (!el) return
    el.style.overflowY = showPicker ? 'hidden' : 'auto'
    return () => { el.style.overflowY = 'auto' }
  }, [showPicker])

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
        sets: (ex.sets || []).map(st => ({ id: st.id, weight: String(st.weight ?? ''), reps: String(st.reps ?? ''), warmup: st.is_warmup || false })),
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

  const addExercise = async (name, group, isCustom = false) => {
    const newEx = { id: uid(), name, muscleGroup: group, sets: [{ id: uid(), weight: '', reps: '', warmup: false }] }
    setActive(s => ({ ...s, exercises: [...s.exercises, newEx] }))
    setShowPicker(false)
    if (isCustom) {
      try { await saveCustomExercise(profile.id, name, group) } catch { /* duplicate — ignore */ }
      setCustomExercises(prev => prev.find(e => e.name === name) ? prev : [...prev, { name, muscle_group: group }])
    }
    const lastSets = await getLastExerciseSets(profile.id, name)
    if (lastSets?.length) {
      const best = lastSets.reduce((a, b) => (+b.weight || 0) > (+a.weight || 0) ? b : a)
      setSuggestions(s => ({ ...s, [name]: { weight: best.weight, reps: best.reps } }))
    }
  }

  const handleDeleteCustomExercise = async (id) => {
    await deleteCustomExercise(profile.id, id)
    setCustomExercises(prev => prev.filter(e => e.id !== id))
  }

  const overloadStatus = (ex) => {
    const sugg = suggestions[ex.name]
    if (!sugg) return null
    const working = (ex.sets || []).filter(s => !s.warmup && s.weight && s.reps)
    if (!working.length) return null
    const best = working.reduce((a, b) => +b.weight > +a.weight ? b : a)
    if (+best.weight > +sugg.weight) return 'up'
    if (+best.weight < +sugg.weight) return 'down'
    if (+best.reps > +sugg.reps) return 'up'
    if (+best.reps < +sugg.reps) return 'down'
    return 'same'
  }

  const removeExercise = id => setActive(s => ({ ...s, exercises: s.exercises.filter(e => e.id !== id) }))
  const addSet = (exId) => {
    if (!restActive) {
      const ex = active?.exercises?.find(e => e.id === exId)
      const lastSet = ex?.sets?.[ex.sets.length - 1]
      if (lastSet?.weight && lastSet?.reps && !lastSet?.warmup) {
        const w = +lastSet.weight
        const wLbs = (profile?.unit || 'lbs') === 'kg' ? w * 2.205 : w
        startRest(wLbs >= 200 ? 180 : wLbs >= 120 ? 120 : 90)
      }
    }
    setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: [...ex.sets, { id: uid(), weight: '', reps: '', warmup: false }] } : ex) }))
  }
  const removeSet = (exId, setId) => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.filter(st => st.id !== setId) } : ex) }))
  const updateSet = (exId, setId, f, v) => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, [f]: v } : st) } : ex) }))
  const toggleWarmup = (exId, setId) => setActive(s => ({ ...s, exercises: s.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map(st => st.id === setId ? { ...st, warmup: !st.warmup } : st) } : ex) }))
  const addCardio = c => { setActive(s => ({ ...s, cardio: [...s.cardio, { ...c, id: uid() }] })); setShowCardio(false) }

  const handleSessionPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const b64 = await photoToBase64(file)
    setActive(s => ({ ...s, photo: b64 }))
  }

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
        haptic.timer(); audio.restDone()
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
        const newCount = sessions.length + 1
        const hitSessionMilestone = SESSION_MILESTONES.includes(newCount)
        if (prs.length > 0) { haptic.pr(); audio.pr() }
        else if (hitSessionMilestone) { haptic.success(); audio.milestone() }
        else { haptic.success(); audio.setLogged() }
        const MILESTONE_LABELS = { 1: { Icon: TargetIcon, label: 'First Session!' }, 10: { Icon: MedalIcon, label: '10 Sessions!' }, 25: { Icon: DumbbellIcon, label: '25 Sessions!' }, 50: { Icon: BoltIcon, label: '50 Sessions!' }, 100: { Icon: TrophyIcon, label: '100 Sessions!' }, 250: { Icon: CrownIcon, label: '250 Sessions!' }, 500: { Icon: StarIcon, label: '500 Sessions!' } }
        await load()
        setNewPRs(prs)
        setSummary(sess)
        setCoachCard(null)
        setActive(null)
        setMilestone(hitSessionMilestone ? MILESTONE_LABELS[newCount] : null)
        if (prs.length > 0) setPrCelebration(prs)
        setView('summary')
        if (isSubscribed && user) {
          const exSummary = sess.exercises
            .map(ex => `${ex.name}: ${(ex.sets || []).filter(s => s.weight && s.reps).map(s => `${s.weight}×${s.reps}`).join(', ')}`)
            .join('\n')
          const sessionSummary = `Duration: ${Math.floor(elapsed / 60)} min\n${exSummary}`
          getPostSessionCoach(user.id, sessionSummary).then(c => setCoachCard(c)).catch(() => {})
        }
      }
    } catch(e) { setError('Save failed: ' + e.message) }
    setSaving(false)
  }

  const fmtTime = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  const sessVol = exs => (exs || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((set.warmup || set.is_warmup) ? 0 : (+set.weight || 0) * (+set.reps || 0)), 0), 0)

  const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 6px', fontSize: 15, textAlign: 'center', width: '100%', fontFamily: 'var(--mono)' }

  // ── SUMMARY ───────────────────────────────────────────────
  if (view === 'summary' && summary) return (
    <div className="page" style={{ padding:'var(--page-top) 20px 24px', textAlign:'center' }}>
      {milestone && <MilestoneCelebration Icon={milestone.Icon} label={milestone.label} onDone={() => setMilestone(null)} />}
      {!milestone && prCelebration && <PRCelebration prs={prCelebration} onDone={() => setPrCelebration(null)} />}
      <div style={{ marginBottom:16, color:'var(--accent)' }}><TrophyIcon size={48} /></div>
      <h2 style={{ fontSize:28, fontWeight:800, marginBottom:4 }}>Session Done</h2>
      <div style={{ color:'var(--text-dim)', marginBottom:20 }}>{fmtTime(summary.duration||0)} · {(summary.exercises||[]).length} exercises</div>
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <StatPill label="VOLUME" value={`${Math.round(calcSessionVolume(summary)).toLocaleString()} ${profile?.unit || 'lbs'}`} />
        <StatPill label="SETS" value={(summary.exercises||[]).reduce((s,e)=>s+(e.sets||[]).filter(st=>st.weight&&st.reps).length,0)} />
      </div>

      {newPRs.length > 0 && (
        <div style={{ background: 'var(--accent-low)', border: '1px solid var(--accent)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div className="label" style={{ color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><FlameIcon size={10} /> NEW PRs</div>
          {newPRs.map(pr => <div key={pr} style={{ fontWeight: 600, marginBottom: 4 }}>{pr}</div>)}
        </div>
      )}

      {summary.photo && (
        <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden' }}>
          <img src={summary.photo} alt="" style={{ width: '100%', height: 180, objectFit: 'cover' }} />
        </div>
      )}

      {(summary.exercises || []).length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, textAlign: 'left' }}>
          <div className="label" style={{ marginBottom: 12 }}>EXERCISES</div>
          {(summary.exercises || []).map(ex => {
            const validSets = (ex.sets || []).filter(s => s.weight && s.reps)
            if (!validSets.length) return null
            return (
              <div key={ex.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                  {validSets.map((s, i) => `${i + 1}: ${s.weight}×${s.reps}`).join(' · ')}
                </div>
              </div>
            )
          })}
          {(summary.cardio || []).map((c, i) => (
            <div key={i} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#4a9eb5', fontFamily: 'var(--mono)' }}>
                <BikeIcon size={10} /> {c.type} · {c.duration} min{c.calories ? ` · ${c.calories} kcal` : ''}
              </div>
            </div>
          ))}
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
      <ShareWorkoutButton summary={summary} newPRs={newPRs} profile={profile} fmtTime={fmtTime} />
      {coachCard && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, marginBottom: 12, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--accent)' }}><SparkleIcon size={14} /></span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>COACH ANALYSIS</span>
            </div>
            {coachCard.rating != null && (
              <div style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>
                {coachCard.rating}/10
              </div>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{coachCard.headline}</div>
          {coachCard.summary && <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>{coachCard.summary}</div>}
          {coachCard.strengths?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', letterSpacing: 1, marginBottom: 5 }}>STRENGTHS</div>
              {coachCard.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, display: 'flex', gap: 6, marginBottom: 3 }}>
                  <span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span>{s}
                </div>
              ))}
            </div>
          )}
          {coachCard.improvements?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: 1, marginBottom: 5 }}>IMPROVE</div>
              {coachCard.improvements.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, display: 'flex', gap: 6, marginBottom: 3 }}>
                  <span style={{ color: '#f59e0b', flexShrink: 0 }}>↑</span>{s}
                </div>
              ))}
            </div>
          )}
          {coachCard.muscleBalance && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>Balance: </span>{coachCard.muscleBalance}
            </div>
          )}
          {coachCard.nextSession && (
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>NEXT SESSION</div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{coachCard.nextSession}</div>
            </div>
          )}
          {coachCard.action && (
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>→ {coachCard.action}</div>
          )}
          {/* Fallback for old single-field format */}
          {!coachCard.summary && coachCard.body && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{coachCard.body}</div>
          )}
        </div>
      )}
      <button onClick={() => { setSummary(null); setNewPRs([]); setCoachCard(null); setPrCelebration(null); setView('list') }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '14px 32px', color: '#fff', fontWeight: 700, fontSize: 15, width: '100%' }}>DONE</button>
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
        <button onClick={()=>setShowPicker(true)} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius)', padding:14, color:'#fff', fontSize:14, fontWeight:700, letterSpacing:'0.5px' }}>+ ADD EXERCISE</button>

        {active.exercises.map(ex => (
          <div key={ex.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</div>
                  {(() => {
                    const status = overloadStatus(ex)
                    if (!status) return null
                    const cfg = { up: { label: '↑', color: '#22c55e' }, down: { label: '↓', color: 'var(--accent)' }, same: { label: '→', color: 'var(--text-muted)' } }[status]
                    return <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, fontFamily: 'var(--mono)' }}>{cfg.label}</span>
                  })()}
                </div>
                <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '2px', fontFamily: 'var(--mono)', marginTop: 2 }}>{ex.muscleGroup}</div>
                {suggestions[ex.name] && (
                  <div style={{ fontSize: 11, color: '#4a9eb5', marginTop: 4, background: 'rgba(74,158,181,0.1)', borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>
                    Last: {suggestions[ex.name].weight} lbs × {suggestions[ex.name].reps} reps
                  </div>
                )}
                {/* Rep range badge / inline editor */}
                {editingRange === ex.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <input type="number" inputMode="numeric" placeholder="8" value={rangeForm.min} onChange={e => setRangeForm(f => ({ ...f, min: e.target.value }))} style={{ width: 44, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 6px', fontSize: 12, textAlign: 'center', fontFamily: 'var(--mono)' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
                    <input type="number" inputMode="numeric" placeholder="12" value={rangeForm.max} onChange={e => setRangeForm(f => ({ ...f, max: e.target.value }))} style={{ width: 44, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 6px', fontSize: 12, textAlign: 'center', fontFamily: 'var(--mono)' }} />
                    <button onClick={() => { if (rangeForm.min && rangeForm.max) { saveRepRange(ex.name, rangeForm.min, rangeForm.max); setRepRanges(getRepRanges()) } setEditingRange(null) }} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: 11, fontWeight: 700 }}>SET</button>
                    <button onClick={() => { deleteRepRange(ex.name); setRepRanges(getRepRanges()); setEditingRange(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14 }}>×</button>
                  </div>
                ) : (
                  <button onClick={() => { const r = repRanges[ex.name]; setRangeForm(r ? { min: String(r.min), max: String(r.max) } : { min: '', max: '' }); setEditingRange(ex.id) }} style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, color: repRanges[ex.name] ? '#22c55e' : 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--mono)', cursor: 'pointer' }}>
                    {repRanges[ex.name] ? `TARGET ${repRanges[ex.name].min}–${repRanges[ex.name].max} reps` : '+ SET REP RANGE'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <button onClick={() => setOneRMEx(ex)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, padding: '3px 7px', fontFamily: 'var(--mono)' }}>1RM</button>
                <button onClick={() => { const last = ex.sets.filter(s=>!s.warmup&&s.weight).slice(-1)[0]; setPlateEx({ name: ex.name, lastWeight: last?.weight || '' }) }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, padding: '3px 7px', fontFamily: 'var(--mono)' }}>PLATES</button>
                <button onClick={() => removeExercise(ex.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20 }}>×</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 28px', gap: 6, marginBottom: 6 }}>
              <span className="label" style={{ textAlign: 'center' }}>SET</span><span className="label" style={{ textAlign: 'center' }}>{(profile?.unit || 'lbs').toUpperCase()}</span><span className="label" style={{ textAlign: 'center' }}>REPS</span><span />
            </div>
            {ex.sets.map((set, i) => (
              <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <button onClick={() => { toggleWarmup(ex.id, set.id); haptic.light() }} style={{ background: set.warmup ? 'rgba(224,22,30,0.15)' : 'var(--bg3)', border: set.warmup ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 6, color: set.warmup ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, padding: '4px 2px', textAlign: 'center', fontFamily: 'var(--mono)', fontWeight: 700, cursor: 'pointer' }}>{set.warmup ? 'W' : i + 1}</button>
                <input style={INP} type="number" inputMode="decimal" placeholder={suggestions[ex.name]?.weight || '0'} value={set.weight} onChange={e => updateSet(ex.id, set.id, 'weight', e.target.value)} />
                <input style={{ ...INP, ...((() => { const r = repRanges[ex.name]; if (!r || !set.reps) return {}; const inRange = +set.reps >= r.min && +set.reps <= r.max; return { borderColor: inRange ? '#22c55e' : '#f59e0b', background: inRange ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)' } })()) }} type="number" inputMode="numeric" placeholder={suggestions[ex.name]?.reps || '0'} value={set.reps} onChange={e => { updateSet(ex.id, set.id, 'reps', e.target.value); if (e.target.value) audio.setLogged() }} />
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
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{c.duration} min{c.distance ? ` · ${c.distance} ${distUnit}` : ''}{c.calories ? ` · ${c.calories} kcal` : ''}</div>
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

        {/* Session Notes */}
        <div className="card" style={{ padding: 14 }}>
          <div className="label" style={{ marginBottom: 8 }}>SESSION NOTES</div>
          <textarea
            value={active.notes || ''}
            onChange={e => setActive(s => ({ ...s, notes: e.target.value }))}
            placeholder="How did this session feel? Any injuries, PRs, or notes..."
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '10px 12px', fontSize: 14, width: '100%', minHeight: 72, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        <button onClick={()=>setShowCardio(true)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:12, color:'var(--text-muted)', fontSize:12 }}>+ ADD CARDIO</button>
        {active.exercises.length > 0 && (
          <button onClick={()=>setShowSaveTpl(true)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:10, color:'var(--text-muted)', fontSize:11, letterSpacing:'1px', fontWeight:700 }}>SAVE AS TEMPLATE</button>
        )}

        <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={handleSessionPhoto} style={{ display: 'none' }} />
        {active.photo ? (
          <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <img src={active.photo} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />
            <button onClick={() => setActive(s => ({ ...s, photo: null }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, fontSize: 16, cursor: 'pointer' }}>×</button>
          </div>
        ) : (
          <button onClick={() => photoRef.current.click()} style={{ background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}><CameraIcon size={14} /> ADD SESSION PHOTO</button>
        )}

        <button onClick={()=>setShowDiscard(true)} style={{ background:'transparent', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:10, color:'var(--text-muted)', fontSize:11, letterSpacing:'1px', fontWeight:700 }}>DISCARD SESSION</button>
      </div>

      {showPicker && <ExercisePicker group={pickerGroup} onGroupChange={setPickerGroup} onSelect={addExercise} onClose={()=>setShowPicker(false)} customExercises={customExercises} onDeleteCustom={handleDeleteCustomExercise} />}
      {showCardio && <CardioModal onAdd={addCardio} onClose={()=>setShowCardio(false)} distUnit={distUnit} weightKg={weightKg} />}
      {oneRMEx && <OneRMModal ex={oneRMEx} onClose={()=>setOneRMEx(null)} />}
      {plateEx && <PlateModal name={plateEx.name} lastWeight={plateEx.lastWeight} unit={profile?.unit || 'lbs'} onClose={()=>setPlateEx(null)} />}
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

  // ── CALENDAR / HEATMAP VIEW ───────────────────────────────
  if (view === 'calendar') {
    return (
      <div className="page" style={{ padding: 'var(--page-top) 20px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Training</h2>
        <div style={{ display: 'flex', gap: 8, background: 'var(--bg3)', borderRadius: 100, padding: 4, marginBottom: 16 }}>
          <TabBtn active={false} onClick={() => setView('list')}>List</TabBtn>
          <TabBtn active={true} onClick={() => setView('calendar')}>Calendar</TabBtn>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          <button onClick={startSession} style={{ flex:2, background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:'16px 0', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><span>▶</span> Start Session</button>
          <button onClick={()=>setShowTemplates(true)} style={{ flex:1, background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:16, fontSize:14, fontWeight:600 }}>Template</button>
        </div>
        <SessionHeatmap sessions={sessions} />
        {showTemplates && <TemplatesModal templates={templates} sessions={sessions} onPickTemplate={startFromTemplate} onPickSession={startFromPastSession} onDeleteTemplate={handleDeleteTemplate} onClose={()=>setShowTemplates(false)} />}
        {calDaySessions && (
          <Modal onClose={() => setCalDaySessions(null)} title={new Date(calDaySessions.dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {calDaySessions.list.map(s => {
                const vol = calcSessionVolume(s)
                const groups = [...new Set((s.exercises||[]).map(e=>e.muscle_group||e.muscleGroup))].filter(Boolean)
                return (
                  <div key={s.id} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{groups.join(', ') || 'Workout'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                      {(s.exercises||[]).length} exercises · {Math.round(vol).toLocaleString()} {profile?.unit || 'lbs'}{s.duration ? ` · ${Math.floor(s.duration/60)}m` : ''}
                    </div>
                    {(s.exercises||[]).slice(0, 4).map(ex => (
                      <div key={ex.id || ex.name} style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 2 }}>
                        {ex.name} — {(ex.sets||[]).filter(st=>st.weight&&st.reps).length} sets
                      </div>
                    ))}
                    {(s.exercises||[]).length > 4 && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>+{(s.exercises||[]).length - 4} more</div>}
                  </div>
                )
              })}
            </div>
          </Modal>
        )}
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => setView('split')} style={{ flex:1, background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 0', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <ListIcon size={16} /> Weekly Split
        </button>
        <button onClick={() => navigate('/programs')} style={{ flex:1, background:'var(--bg3)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 0', fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <DumbbellIcon size={16} /> Programs
        </button>
      </div>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 14 }}>No sessions yet — start lifting</div>
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
                    <button onClick={() => editSession(s)} style={{ background:'none', border:'none', color:'var(--text-dim)', padding:'4px', display:'flex' }}><EditIcon size={16} /></button>
                    <button onClick={() => setConfirmDelete(deleting ? null : s.id)} style={{ background:'none', border:'none', color:'var(--accent)', padding:'4px', display:'flex' }}><TrashIcon size={16} /></button>
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

function SessionHeatmap({ sessions }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const volMap = {}
  sessions.forEach(s => {
    const d = s.date?.split('T')[0]
    if (d) volMap[d] = (volMap[d] || 0) + calcSessionVolume(s)
  })
  // Build 18 weeks × 7 days grid, columns = weeks (left = oldest)
  const WEEKS = 18
  const totalDays = WEEKS * 7
  const start = new Date(today)
  start.setDate(today.getDate() - totalDays + 1)
  // Align start to Sunday
  start.setDate(start.getDate() - start.getDay())
  const days = []
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({ dateStr, vol: volMap[dateStr] || 0, isFuture: d > today, isToday: d.getTime() === today.getTime() })
  }
  const maxVol = Math.max(...days.map(d => d.vol), 1)
  const totalSessions = sessions.length
  const streak = (() => {
    let s = 0, d = new Date(today)
    while (true) {
      const key = d.toISOString().split('T')[0]
      if (!volMap[key]) break
      s++; d.setDate(d.getDate() - 1)
    }
    return s
  })()
  const DAY_LABELS = ['S','M','T','W','T','F','S']
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Activity</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
          <span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{streak}</span> day streak</span>
          <span><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{totalSessions}</span> sessions</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {/* Day labels column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 2 }}>
          {DAY_LABELS.map((l, i) => (
            <div key={i} style={{ height: 12, width: 10, fontSize: 8, color: 'var(--text-muted)', lineHeight: '12px', fontFamily: 'var(--mono)' }}>{i % 2 === 1 ? l : ''}</div>
          ))}
        </div>
        {/* Week columns */}
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto' }}>
          {Array.from({ length: WEEKS }, (_, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {days.slice(wi * 7, wi * 7 + 7).map(({ dateStr, vol, isFuture, isToday }) => {
                const opacity = isFuture ? 0 : vol ? Math.max(0.2, vol / maxVol) : 1
                const bg = isFuture ? 'transparent' : vol ? 'var(--accent)' : 'var(--bg3)'
                return (
                  <div key={dateStr} title={vol ? `${dateStr}: ${Math.round(vol).toLocaleString()} lbs` : dateStr}
                    style={{ width: 12, height: 12, borderRadius: 2, background: bg, opacity, outline: isToday ? '1px solid var(--accent)' : 'none', outlineOffset: 1 }} />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>LESS</span>
        {[0.15, 0.35, 0.6, 0.85, 1].map(o => (
          <div key={o} style={{ width: 10, height: 10, borderRadius: 2, background: o === 0.15 ? 'var(--bg3)' : 'var(--accent)', opacity: o }} />
        ))}
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>MORE</span>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return <button onClick={onClick} style={{ flex: 1, background: active ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 100, padding: '9px 20px', color: active ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: active ? 700 : 500 }}>{children}</button>
}

function StatPill({ label, value }) {
  return (
    <div className="card" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
      <div className="label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)' }}>{value}</div>
    </div>
  )
}

function ExercisePicker({ group, onGroupChange, onSelect, onClose, customExercises = [], onDeleteCustom }) {
  const [customName, setCustomName] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const submitCustom = () => {
    const n = customName.trim()
    if (!n) return
    onSelect(n, group, true)
    setCustomName(''); setShowCustom(false)
  }
  const groupCustom = customExercises.filter(e => e.muscle_group === group)
  return createPortal(
    <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:100, display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div className="modal-sheet" style={{ background:'var(--bg2)', borderRadius:'20px 20px 0 0', width:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
        <div style={{ flexShrink:0, borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 20px 10px' }}>
            <span className="label">ADD EXERCISE</span>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', fontSize:22 }}>×</button>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', padding:'0 20px 12px' }}>
            {MUSCLE_GROUPS.map(g => <button key={g} onClick={() => onGroupChange(g)} style={{ padding:'7px 14px', borderRadius:20, border:'none', background:group===g?'var(--accent)':'var(--bg3)', color:group===g?'#fff':'var(--text-dim)', fontSize:12, fontWeight:600 }}>{g}</button>)}
          </div>
        </div>
        <div style={{ overflowY:'auto', padding:'16px 20px 40px', flex:1 }}>
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
      {groupCustom.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 8 }}>MY EXERCISES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groupCustom.map(ex => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => onSelect(ex.name, group)} style={{ flex: 1, background: 'rgba(224,22,30,0.08)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '13px 14px', textAlign: 'left', color: 'var(--text)', fontSize: 14 }}>{ex.name}</button>
                <button onClick={() => onDeleteCustom(ex.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, padding: '0 4px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {(EXERCISES[group]||[]).map(ex => <button key={ex} onClick={()=>onSelect(ex,group)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'13px 14px', textAlign:'left', color:'var(--text)', fontSize:14 }}>{ex}</button>)}
      </div>
        </div>
      </div>
    </div>,
    document.body
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

function CardioModal({ onAdd, onClose, distUnit = 'mi', weightKg = 70 }) {
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
        <input style={INP} type="number" placeholder={`Distance (${distUnit}) — optional`} value={distance} onChange={e => setDistance(e.target.value)} />
        <input style={INP} type="number" placeholder="Calories burned — optional" value={calories} onChange={e => setCalories(e.target.value)} />
        {!calories && type && duration && (
          <button
            type="button"
            onClick={() => setCalories(String(estimateCalories(type, +duration, weightKg)))}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, padding: '4px 0', textAlign: 'left', fontWeight: 600 }}
          >
            Use est. {estimateCalories(type, +duration, weightKg)} kcal (MET · {weightKg}kg)
          </button>
        )}
      </div>
      <button onClick={() => duration && onAdd({ type, duration: +duration, distance: distance ? +distance : null, calories: calories ? +calories : null })} style={{ background: '#4a9eb5', border: 'none', borderRadius: 'var(--radius-sm)', padding: 14, width: '100%', color: '#fff', fontWeight: 700, fontSize: 14 }}>ADD CARDIO</button>
    </Modal>
  )
}

function ShareWorkoutButton({ summary, newPRs, profile, fmtTime }) {
  const [sharing, setSharing] = useState(false)

  const generateCard = () => new Promise((resolve) => {
    const W = 1080, H = 1350
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e0161e'

    // Background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    // Accent strip top
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, W, 8)

    // BodMax wordmark
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 52px -apple-system, sans-serif'
    ctx.fillText('BODMAX', 72, 100)
    ctx.fillStyle = accent
    ctx.font = 'bold 26px -apple-system, sans-serif'
    ctx.fillText('WORKOUT COMPLETE', 72, 145)

    // Date
    ctx.fillStyle = '#666'
    ctx.font = '28px -apple-system, sans-serif'
    ctx.fillText(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), 72, 200)

    // Divider
    ctx.fillStyle = '#222'
    ctx.fillRect(72, 230, W - 144, 2)

    // Stats row
    const stats = [
      { label: 'DURATION', value: fmtTime(summary?.duration || 0) },
      { label: 'VOLUME', value: `${Math.round(calcSessionVolume(summary || {})).toLocaleString()} ${profile?.unit || 'lbs'}` },
      { label: 'EXERCISES', value: String((summary?.exercises || []).length) },
    ]
    stats.forEach((s, i) => {
      const x = 72 + i * (W - 144) / 3
      ctx.fillStyle = '#555'
      ctx.font = 'bold 22px -apple-system, sans-serif'
      ctx.fillText(s.label, x, 295)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 48px -apple-system, sans-serif'
      ctx.fillText(s.value, x, 360)
    })

    // Divider
    ctx.fillStyle = '#222'
    ctx.fillRect(72, 400, W - 144, 2)

    // Exercises
    ctx.fillStyle = '#555'
    ctx.font = 'bold 24px -apple-system, sans-serif'
    ctx.fillText('EXERCISES', 72, 455)

    let y = 500
    const exercises = (summary?.exercises || []).slice(0, 8)
    exercises.forEach(ex => {
      const validSets = (ex.sets || []).filter(s => s.weight && s.reps)
      if (!validSets.length) return
      const best = validSets.reduce((a, b) => +b.weight > +a.weight ? b : a)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 30px -apple-system, sans-serif'
      ctx.fillText(ex.name, 72, y)
      ctx.fillStyle = '#888'
      ctx.font = '26px -apple-system, sans-serif'
      ctx.fillText(`${validSets.length} sets · ${best.weight}×${best.reps} top set`, 72, y + 36)
      y += 88
    })
    if ((summary?.exercises || []).length > 8) {
      ctx.fillStyle = '#555'
      ctx.font = '26px -apple-system, sans-serif'
      ctx.fillText(`+ ${(summary?.exercises || []).length - 8} more exercises`, 72, y)
      y += 50
    }

    // PRs
    if (newPRs?.length > 0) {
      y = Math.max(y + 20, 1050)
      ctx.fillStyle = accent
      ctx.fillRect(72, y, W - 144, 2)
      ctx.fillStyle = accent
      ctx.font = 'bold 24px -apple-system, sans-serif'
      ctx.fillText('🏆 NEW PERSONAL RECORDS', 72, y + 48)
      newPRs.forEach((pr, i) => {
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 28px -apple-system, sans-serif'
        ctx.fillText(`· ${pr}`, 72, y + 92 + i * 44)
      })
    }

    // Footer
    ctx.fillStyle = '#333'
    ctx.fillRect(0, H - 80, W, 80)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 28px -apple-system, sans-serif'
    ctx.fillText('getbodmax.com', W / 2 - 110, H - 30)

    canvas.toBlob(blob => resolve(blob), 'image/png')
  })

  const handleShare = async () => {
    setSharing(true)
    try {
      const blob = await generateCard()
      const file = new File([blob], 'bodmax-workout.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'BodMax Workout' })
      } else if (navigator.share) {
        // Fallback: share text if files not supported
        const vol = Math.round(calcSessionVolume(summary || {})).toLocaleString()
        await navigator.share({
          title: 'BodMax Workout',
          text: `Just crushed a ${fmtTime(summary?.duration || 0)} session!\n${vol} ${profile?.unit || 'lbs'} total volume\n${(summary?.exercises || []).map(e => e.name).join(', ')}`,
        })
      } else {
        // Download fallback
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'bodmax-workout.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* user cancelled or not supported */ }
    setSharing(false)
  }

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 32px', color: 'var(--text-dim)', fontWeight: 600, fontSize: 14, width: '100%', marginBottom: 12, opacity: sharing ? 0.6 : 1 }}
    >
      {sharing ? 'GENERATING…' : 'SHARE WORKOUT'}
    </button>
  )
}

function PRCelebration({ prs, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t) }, [])
  const particles = Array.from({ length: 40 }, (_, i) => {
    const angle = (i / 40) * 360
    const dist = 60 + Math.random() * 120
    const size = 5 + Math.random() * 10
    const colors = ['var(--accent)', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#fff']
    const color = colors[i % colors.length]
    return { angle, dist, size, color, delay: Math.random() * 0.6 }
  })
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.82)', animation: 'fadeInOut 4s ease forwards' }}
      onClick={onDone}
    >
      <style>{`
        @keyframes prBurst { 0%{transform:translate(-50%,-50%) scale(0);opacity:1} 25%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1);opacity:1} 100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(0.4);opacity:0} }
        @keyframes prPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
      `}</style>
      {particles.map((p, i) => {
        const tx = Math.cos(p.angle * Math.PI / 180) * p.dist
        const ty = Math.sin(p.angle * Math.PI / 180) * p.dist
        return (
          <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: p.size, height: p.size, borderRadius: i % 3 === 0 ? 2 : '50%', background: p.color, '--tx': `${tx}px`, '--ty': `${ty}px`, animation: `prBurst 1.4s ${p.delay}s ease-out forwards`, transform: 'translate(-50%,-50%) scale(0)' }} />
        )
      })}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, animation: 'prPulse 1.2s ease-in-out infinite' }}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-1px', marginBottom: 8 }}>NEW PR{prs.length > 1 ? 's' : ''}!</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          {prs.map(pr => (
            <div key={pr} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '6px 18px', fontSize: 15, fontWeight: 700 }}>{pr}</div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>tap to dismiss</div>
      </div>
    </div>
  )
}

function MilestoneCelebration({ Icon, label, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [])
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360
    const dist = 80 + Math.random() * 80
    const size = 6 + Math.random() * 8
    const colors = ['var(--accent)', '#22c55e', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899']
    const color = colors[i % colors.length]
    return { angle, dist, size, color, delay: Math.random() * 0.4 }
  })
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', animation: 'fadeInOut 3.2s ease forwards' }}
      onClick={onDone}>
      <style>{`
        @keyframes fadeInOut { 0%{opacity:0} 8%{opacity:1} 75%{opacity:1} 100%{opacity:0} }
        @keyframes burst { 0%{transform:translate(-50%,-50%) scale(0)} 20%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(1)} 100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) scale(0.5);opacity:0} }
      `}</style>
      {particles.map((p, i) => {
        const tx = Math.cos(p.angle * Math.PI / 180) * p.dist
        const ty = Math.sin(p.angle * Math.PI / 180) * p.dist
        return (
          <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: p.size, height: p.size, borderRadius: '50%', background: p.color, '--tx': `${tx}px`, '--ty': `${ty}px`, animation: `burst 1.2s ${p.delay}s ease-out forwards`, transform: 'translate(-50%,-50%) scale(0)' }} />
        )
      })}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ lineHeight: 1, marginBottom: 16, color: 'var(--accent)' }}>{Icon && <Icon size={80} />}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{label}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>tap to dismiss</div>
      </div>
    </div>
  )
}

function PlateModal({ name, lastWeight, unit, onClose }) {
  const [weight, setWeight] = useState(String(lastWeight || ''))
  const isKg = unit === 'kg'
  const barWeight = isKg ? 20 : 45
  const plateList = isKg ? [20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]
  const plateColors = { 20: '#e0161e', 15: '#2563eb', 10: '#16a34a', 5: '#ca8a04', 2.5: '#9ca3af', 1.25: '#d1d5db', 45: '#e0161e', 35: '#2563eb', 25: '#16a34a' }

  const calcPlates = (target) => {
    if (!target || +target <= barWeight) return []
    let rem = Math.round(((+target - barWeight) / 2) * 1000) / 1000
    const result = []
    for (const p of plateList) {
      const count = Math.floor(Math.round(rem / p * 1000) / 1000)
      if (count > 0) { result.push({ plate: p, count }); rem = Math.round((rem - count * p) * 1000) / 1000 }
    }
    return result
  }

  const plates = calcPlates(weight)
  const total = plates.reduce((s, p) => s + p.plate * p.count * 2, 0) + barWeight
  const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '11px 12px', fontSize: 18, textAlign: 'center', fontFamily: 'var(--mono)', width: '100%' }

  return (
    <Modal onClose={onClose} title={`PLATES — ${name}`}>
      <div style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 6 }}>TARGET WEIGHT ({unit.toUpperCase()})</div>
        <input style={INP} type="number" inputMode="decimal" placeholder={`e.g. ${isKg ? '100' : '225'}`} value={weight} onChange={e => setWeight(e.target.value)} autoFocus />
      </div>
      {+weight > 0 && +weight <= barWeight && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>Bar only ({barWeight} {unit})</div>
      )}
      {plates.length > 0 && (
        <>
          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 16px', textAlign: 'center', marginBottom: 16, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--mono)' }}>EACH SIDE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)' }}>{plates.reduce((s,p)=>s+p.plate*p.count,0)} {unit}</div>
            </div>
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.3)' }} />
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--mono)' }}>TOTAL</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)' }}>{total} {unit}</div>
            </div>
          </div>
          {/* Visual bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginBottom: 16, height: 48 }}>
            <div style={{ width: 24, height: 8, background: 'var(--text-dim)', borderRadius: 2 }} />
            <div style={{ width: 8, height: 32, background: '#888', borderRadius: 2 }} />
            {[...plates].reverse().map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: p.count }, (_, j) => (
                  <div key={j} style={{ width: 10, height: 28 + (plateList.indexOf(p.plate) * -2), background: plateColors[p.plate] || '#888', borderRadius: 2 }} />
                ))}
              </div>
            ))}
            <div style={{ width: 40, height: 8, background: 'var(--text-dim)', borderRadius: 2 }} />
            {plates.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: p.count }, (_, j) => (
                  <div key={j} style={{ width: 10, height: 28 + (plateList.indexOf(p.plate) * -2), background: plateColors[p.plate] || '#888', borderRadius: 2 }} />
                ))}
              </div>
            ))}
            <div style={{ width: 8, height: 32, background: '#888', borderRadius: 2 }} />
            <div style={{ width: 24, height: 8, background: 'var(--text-dim)', borderRadius: 2 }} />
          </div>
          {/* Plate list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plates.map(p => (
              <div key={p.plate} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 20, background: plateColors[p.plate] || '#888', borderRadius: 2 }} />
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{p.plate} {unit}</span>
                </div>
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontFamily: 'var(--mono)', fontSize: 18 }}>× {p.count} per side</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
              <span>BAR</span><span>{barWeight} {unit}</span>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

function OneRMModal({ ex, onClose }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  // Pre-fill with best working set (non-warmup, highest weight)
  useEffect(() => {
    const working = (ex.sets || []).filter(s => !s.warmup && s.weight && s.reps)
    if (working.length) {
      const best = working.reduce((a, b) => (+b.weight || 0) > (+a.weight || 0) ? b : a)
      setWeight(best.weight); setReps(best.reps)
    }
  }, [ex])
  const oneRM = weight && reps && +reps > 0 ? Math.round(+weight * (1 + +reps / 30)) : null
  const pcts = [100, 95, 90, 85, 80, 75, 70, 65, 60]
  const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '11px 12px', fontSize: 16, textAlign: 'center', fontFamily: 'var(--mono)', width: '100%' }
  return (
    <Modal onClose={onClose} title={`1RM — ${ex.name}`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>WEIGHT (LBS)</div>
          <input style={INP} type="number" inputMode="decimal" placeholder="135" value={weight} onChange={e => setWeight(e.target.value)} />
        </div>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>REPS</div>
          <input style={INP} type="number" inputMode="numeric" placeholder="5" value={reps} onChange={e => setReps(e.target.value)} />
        </div>
      </div>
      {oneRM && (
        <>
          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--mono)', marginBottom: 4 }}>ESTIMATED 1RM</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)' }}>{oneRM} lbs</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {pcts.map(p => (
              <div key={p} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{p}%</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{Math.round(oneRM * p / 100)} lbs</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

function Modal({ children, onClose, title }) {
  useEffect(() => {
    const el = document.getElementById('scroll-root')
    if (!el) return
    el.style.overflowY = 'hidden'
    return () => { el.style.overflowY = 'auto' }
  }, [])
  return createPortal(
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div className="modal-sheet" style={{ background: 'var(--bg2)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 20px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <span className="label">{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 20px 40px', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
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
