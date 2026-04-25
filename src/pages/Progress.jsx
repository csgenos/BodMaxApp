import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import {
  getWeightLog, addWeight, getPRs, getSessions,
  getBodyMeasurements, addBodyMeasurement, deleteBodyMeasurement,
  checkAndUpdatePR, getExerciseProgress,
} from '../lib/db'
import { calcVolumes, getRank, MUSCLE_GROUPS, EXERCISES, calcSessionVolume } from '../lib/ranks'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { TargetIcon, FlameIcon, DumbbellIcon, BoltIcon, TrophyIcon, CrownIcon, StarIcon, RocketIcon, MedalIcon } from '../lib/icons'

const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, outline: 'none' }

const MEASURE_FIELDS = [
  { key:'chest',       label:'Chest' },
  { key:'waist',       label:'Waist' },
  { key:'hips',        label:'Hips' },
  { key:'left_arm',    label:'Left Arm' },
  { key:'right_arm',   label:'Right Arm' },
  { key:'left_thigh',  label:'Left Thigh' },
  { key:'right_thigh', label:'Right Thigh' },
  { key:'neck',        label:'Neck' },
  { key:'body_fat',    label:'Body Fat %' },
]

const STRENGTH_STANDARDS = {
  'Bench Press':    [0.5, 0.75, 1.0, 1.25, 1.5],
  'Squat':          [0.75, 1.0, 1.25, 1.5, 2.0],
  'Deadlift':       [1.0, 1.25, 1.5, 2.0, 2.5],
  'Overhead Press': [0.35, 0.5, 0.65, 0.8, 1.0],
  'Barbell Row':    [0.5, 0.75, 1.0, 1.25, 1.5],
}
const STANDARD_LABELS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite']
const STANDARD_COLORS = ['#888', '#4a9eb5', '#22c55e', '#f59e0b', 'var(--accent)']

export default function Progress() {
  const { profile, theme } = useAuth()
  const unit = profile?.unit || 'lbs'
  const distUnit = unit === 'kg' ? 'km' : 'mi'
  const [tab, setTab] = useState('history')
  const [weightLog, setWeightLog] = useState([])
  const [prs, setPRs] = useState([])
  const [sessions, setSessions] = useState([])
  const [volumes, setVolumes] = useState({})
  const [newWeight, setNewWeight] = useState('')
  const [showAddW, setShowAddW] = useState(false)
  const [histRange, setHistRange] = useState(30)
  const [volMode, setVolMode] = useState('week')
  const [measurements, setMeasurements] = useState([])
  const [showAddM, setShowAddM] = useState(false)
  const [mForm, setMForm] = useState({})
  const [showAddPR, setShowAddPR] = useState(false)
  const [prForm, setPrForm] = useState({ muscleGroup: MUSCLE_GROUPS[0], exercise: '', customExercise: '', weight: '', reps: '' })
  const [prStatus, setPrStatus] = useState(null)
  const [prSaving, setPrSaving] = useState(false)
  const [selectedPR, setSelectedPR] = useState(null) // exercise name for drill-down
  const [prHistory, setPrHistory] = useState([])
  const [prHistoryLoading, setPrHistoryLoading] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!profile) return
    Promise.all([
      getWeightLog(profile.id),
      getPRs(profile.id),
      getSessions(profile.id),
      getBodyMeasurements(profile.id),
    ]).then(([wl, p, s, m]) => {
      if (!mounted.current) return
      setWeightLog(wl)
      setPRs(p)
      setSessions(s)
      setVolumes(calcVolumes(s))
      setMeasurements(m)
    }).catch(e => { if (mounted.current) setError(e.message) })
  }, [profile?.id])

  const handleAddWeight = async () => {
    if (!newWeight) return
    try {
      await addWeight(profile.id, new Date().toISOString().split('T')[0], +newWeight)
      const wl = await getWeightLog(profile.id)
      if (mounted.current) { setWeightLog(wl); setNewWeight(''); setShowAddW(false) }
    } catch (e) {
      if (mounted.current) setError(e.message)
    }
  }

  const handleAddMeasurement = async () => {
    const cleaned = {}
    for (const [k,v] of Object.entries(mForm)) {
      if (v !== '' && v !== null && v !== undefined) cleaned[k] = +v
    }
    if (Object.keys(cleaned).length === 0) return
    try {
      await addBodyMeasurement(profile.id, { date: new Date().toISOString().split('T')[0], ...cleaned })
      setMeasurements(await getBodyMeasurements(profile.id))
      setMForm({}); setShowAddM(false)
    } catch(e) { if (mounted.current) setError(e.message) }
  }

  const handleDeleteMeasurement = async (id) => {
    try { await deleteBodyMeasurement(profile.id, id); setMeasurements(await getBodyMeasurements(profile.id)) }
    catch(e) { if (mounted.current) setError(e.message) }
  }

  const handleSelectPR = async (pr) => {
    if (selectedPR === pr.exercise) { setSelectedPR(null); setPrHistory([]); return }
    setSelectedPR(pr.exercise)
    setPrHistoryLoading(true)
    try {
      const hist = await getExerciseProgress(profile.id, pr.exercise)
      if (mounted.current) setPrHistory(hist)
    } catch { if (mounted.current) setPrHistory([]) }
    if (mounted.current) setPrHistoryLoading(false)
  }

  const handleLogPR = async () => {
    const name = (prForm.exercise === '__custom__' ? prForm.customExercise : prForm.exercise).trim()
    if (!name || !prForm.weight || !prForm.reps) return
    setPrSaving(true)
    try {
      const isNew = await checkAndUpdatePR(profile.id, name, prForm.muscleGroup, +prForm.weight, +prForm.reps)
      setPRs(await getPRs(profile.id))
      setPrStatus(isNew ? 'new' : 'same')
      if (isNew) {
        setPrForm({ muscleGroup: MUSCLE_GROUPS[0], exercise: '', customExercise: '', weight: '', reps: '' })
        setShowAddPR(false)
      }
    } catch (e) { if (mounted.current) setError(e.message) }
    setPrSaving(false)
  }

  const chartTheme = useMemo(() => theme === 'light'
    ? { grid: '#e0e0e0', tick: '#888', cursor: '#ccc', tt: { background: '#fff', border: '1px solid #ddd', borderRadius: 8, color: '#111', fontSize: 12 } }
    : { grid: '#1a1a1a', tick: '#444', cursor: '#333', tt: { background: '#141414', border: '1px solid #222', borderRadius: 8, color: '#f0f0f0', fontSize: 12 } }
  , [theme])
  const TT = { contentStyle: chartTheme.tt, cursor: { stroke: chartTheme.cursor } }

  const weightChartData = weightLog.slice(-histRange).map(e => ({
    date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: e.weight
  }))

  const volumeByWeek = useMemo(() => {
    const weeks = {}
    sessions.slice(0, 56).forEach(s => {
      const d = new Date(s.date)
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!weeks[key]) weeks[key] = 0
      weeks[key] += calcSessionVolume(s)
    })
    return Object.entries(weeks).slice(-8).map(([week,vol]) => ({ week, vol: Math.round(vol/1000*10)/10 })).reverse()
  }, [sessions])

  const freqData = useMemo(() => {
    const weeks = {}
    sessions.slice(0, 56).forEach(s => {
      const d = new Date(s.date)
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!weeks[key]) weeks[key] = new Set()
      weeks[key].add(s.date?.split('T')[0])
    })
    return Object.entries(weeks).slice(-8).map(([week,days]) => ({ week, days: days.size })).reverse()
  }, [sessions])

  // Volume per muscle group, bucketed by week or month.
  // Used for the "Volume" tab breakdown.
  const volumeByGroup = useMemo(() => {
    const buckets = {}
    const keyFor = (d) => {
      if (volMode === 'month') return d.toLocaleDateString('en-US',{ month:'short', year:'2-digit' })
      const ws = new Date(d); ws.setDate(d.getDate() - d.getDay())
      return ws.toLocaleDateString('en-US',{ month:'short', day:'numeric' })
    }
    sessions.forEach(s => {
      const d = new Date(s.date)
      const k = keyFor(d)
      if (!buckets[k]) {
        buckets[k] = { _label: k }
        MUSCLE_GROUPS.forEach(g => buckets[k][g] = 0)
      }
      ;(s.exercises || []).forEach(ex => {
        const g = ex.muscle_group || ex.muscleGroup
        if (!g || !MUSCLE_GROUPS.includes(g)) return
        const vol = (ex.sets||[]).reduce((sum,set) => sum + ((+set.weight||0)*(+set.reps||0)), 0)
        buckets[k][g] += vol
      })
    })
    const arr = Object.values(buckets)
    return volMode === 'month' ? arr.slice(-6) : arr.slice(-8)
  }, [sessions, volMode])

  const volumeData = useMemo(() =>
    MUSCLE_GROUPS.map(g => ({ name: g.slice(0, 4).toUpperCase(), vol: Math.round((volumes[g] || 0) / 1000 * 10) / 10 })),
    [volumes])

  const lifetimeStats = useMemo(() => {
    if (!sessions.length) return null
    const totalVol = sessions.reduce((s, sess) => s + calcSessionVolume(sess), 0)
    const totalSets = sessions.reduce((s, sess) => s + (sess.exercises||[]).reduce((e, ex) => e + (ex.sets||[]).filter(st=>st.weight&&st.reps).length, 0), 0)
    const avgDur = sessions.filter(s=>s.duration).reduce((s,sess)=>s+(sess.duration||0),0) / (sessions.filter(s=>s.duration).length||1)
    // Streaks
    const dateSet = new Set(sessions.filter(s=>s.date).map(s=>s.date.split('T')[0]))
    const today = new Date(); today.setHours(0,0,0,0)
    let currentStreak = 0, d = new Date(today)
    while (dateSet.has(d.toISOString().split('T')[0])) { currentStreak++; d.setDate(d.getDate()-1) }
    let bestStreak = 0, streak = 0
    const sorted = [...dateSet].sort()
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) { streak = 1; continue }
      const prev = new Date(sorted[i-1]); prev.setDate(prev.getDate()+1)
      streak = prev.toISOString().split('T')[0] === sorted[i] ? streak+1 : 1
      bestStreak = Math.max(bestStreak, streak)
    }
    bestStreak = Math.max(bestStreak, currentStreak)
    // Weekly avg
    const weeks = new Set(sessions.filter(s=>s.date).map(s => { const d2=new Date(s.date); const ws=new Date(d2); ws.setDate(d2.getDate()-d2.getDay()); return ws.toISOString().split('T')[0] }))
    const weeklyAvg = weeks.size ? (sessions.length / weeks.size) : 0
    // Most trained muscle
    const muscleCount = {}
    sessions.forEach(s => (s.exercises||[]).forEach(ex => { const g = ex.muscle_group||ex.muscleGroup; if(g) muscleCount[g]=(muscleCount[g]||0)+1 }))
    const topMuscle = Object.entries(muscleCount).sort((a,b)=>b[1]-a[1])[0]
    // Milestones
    const milestones = [
      { label: '1st session', target: 1, Icon: TargetIcon },
      { label: '10 sessions', target: 10, Icon: MedalIcon },
      { label: '50 sessions', target: 50, Icon: DumbbellIcon },
      { label: '100 sessions', target: 100, Icon: TrophyIcon },
      { label: '500 sessions', target: 500, Icon: CrownIcon },
      { label: `100k ${unit}`, target: 100000, Icon: BoltIcon, vol: true },
      { label: `500k ${unit}`, target: 500000, Icon: RocketIcon, vol: true },
      { label: `1M ${unit}`, target: 1000000, Icon: StarIcon, vol: true },
    ]
    return { totalVol, totalSets, avgDur, currentStreak, bestStreak, weeklyAvg, topMuscle, milestones }
  }, [sessions, unit])

  return (
    <div className="page" style={{ paddingBottom:24 }}>
      <div style={{ padding:'var(--page-top) 20px 16px' }}>
        <h2 style={{ fontSize:28, fontWeight:800, marginBottom:16 }}>Progress</h2>
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
          {[['history','History'],['weight','Weight'],['body','Body'],['prs','PRs'],['volume','Volume'],['stats','Stats']].map(([key,label]) => (
            <button key={key} onClick={()=>setTab(key)} style={{ background:tab===key?'var(--accent)':'var(--bg3)', border:'none', borderRadius:100, padding:'9px 18px', color:tab===key?'#fff':'var(--text-dim)', fontSize:14, fontWeight:tab===key?700:500, whiteSpace:'nowrap', flexShrink:0 }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[30, 90, 180].map(r => (
                <button key={r} onClick={() => setHistRange(r)} style={{ flex: 1, background: histRange === r ? 'var(--accent)' : 'var(--bg3)', border: 'none', borderRadius: 100, padding: '9px 0', color: histRange === r ? '#fff' : 'var(--text-dim)', fontSize: 13, fontWeight: histRange === r ? 700 : 500 }}>{r}d</button>
              ))}
            </div>
            <ChartCard title={`WEEKLY VOLUME (k ${unit})`}>
              {volumeByWeek.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeByWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} unit="k" />
                    <Tooltip {...TT} formatter={v => [`${v}k ${unit}`, 'Volume']} />
                    <Bar dataKey="vol" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty>Not enough data yet</Empty>}
            </ChartCard>
            <ChartCard title="SESSIONS PER WEEK">
              {freqData.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={freqData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TT} formatter={v => [`${v} days`, 'Sessions']} />
                    <Bar dataKey="days" fill="#4a9eb5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty>Not enough data yet</Empty>}
            </ChartCard>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <StatCard label="Sessions" value={sessions.length} />
              <StatCard label="PRs" value={prs.length} />
              <StatCard label="Member" value={profile?.created_at ? `Since ${new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}` : '—'} />
            </div>
          </div>
        )}

        {tab === 'weight' && (
          <div>
            {weightChartData.length > 1 && (
              <ChartCard title="WEIGHT TREND">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="date" tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} domain={['dataMin - 3', 'dataMax + 3']} />
                    <Tooltip {...TT} />
                    <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {!showAddW ? (
              <button onClick={() => setShowAddW(true)} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: 14, color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>+ LOG WEIGHT</button>
            ) : (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input style={{ ...INP, flex: 1 }} type="number" inputMode="decimal" placeholder={`Weight (${profile?.unit || 'lbs'})`} value={newWeight} onChange={e => setNewWeight(e.target.value)} autoFocus />
                <button onClick={handleAddWeight} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px 18px', color: '#fff', fontWeight: 700 }}>LOG</button>
                <button onClick={() => setShowAddW(false)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', color: 'var(--text-dim)' }}>×</button>
              </div>
            )}
            {weightLog.length === 0 && <Empty>No weight logged yet</Empty>}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {weightLog.slice(-15).reverse().map((e,i) => (
                <div key={i} className="card" style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, color:'var(--text-dim)' }}>{new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  <span style={{ fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{e.weight} <span style={{ fontSize:11, fontWeight:400, color:'var(--text-muted)' }}>{profile?.unit||'lbs'}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BODY MEASUREMENTS TAB */}
        {tab === 'body' && (
          <div>
            {measurements.length > 1 && (
              <ChartCard title="MEASUREMENT TRENDS">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={measurements.map(m => ({
                    date: new Date(m.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}),
                    chest: m.chest, waist: m.waist, left_arm: m.left_arm,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="date" tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} domain={['dataMin - 1','dataMax + 1']} />
                    <Tooltip {...TT} />
                    <Line type="monotone" dataKey="chest"    stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="waist"    stroke="#4a9eb5"       strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="left_arm" stroke="#c88a2e"       strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:8, fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>
                  <span><span style={{ color:'var(--accent)' }}>●</span> CHEST</span>
                  <span><span style={{ color:'#4a9eb5' }}>●</span> WAIST</span>
                  <span><span style={{ color:'#c88a2e' }}>●</span> L. ARM</span>
                </div>
              </ChartCard>
            )}
            {!showAddM ? (
              <button onClick={()=>setShowAddM(true)} style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', padding:14, color:'#fff', fontWeight:700, fontSize:14, marginBottom:16 }}>+ LOG MEASUREMENTS</button>
            ) : (
              <div className="card" style={{ padding:14, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
                <div className="label">LOG MEASUREMENTS</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {MEASURE_FIELDS.map(f => (
                    <div key={f.key}>
                      <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4, fontFamily:'var(--mono)' }}>{f.label.toUpperCase()}</div>
                      <input
                        style={INP}
                        type="number"
                        inputMode="decimal"
                        placeholder={f.key === 'body_fat' ? '%' : (profile?.unit === 'kg' ? 'cm' : 'in')}
                        value={mForm[f.key] ?? ''}
                        onChange={e=>setMForm(s=>({...s,[f.key]:e.target.value}))}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button onClick={()=>{ setShowAddM(false); setMForm({}) }} style={{ flex:1, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:11, color:'var(--text-dim)', fontWeight:600 }}>Cancel</button>
                  <button onClick={handleAddMeasurement} style={{ flex:2, background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:11, color:'#fff', fontWeight:700, fontSize:14 }}>SAVE</button>
                </div>
              </div>
            )}
            {measurements.length === 0 && !showAddM && <Empty>No measurements logged yet</Empty>}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[...measurements].reverse().slice(0,10).map(m => {
                const entries = MEASURE_FIELDS.filter(f => m[f.key] != null)
                return (
                  <div key={m.id} className="card" style={{ padding:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:12, color:'var(--text-dim)', fontFamily:'var(--mono)' }}>{new Date(m.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                      <button onClick={()=>handleDeleteMeasurement(m.id)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:18 }}>×</button>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {entries.map(f => (
                        <div key={f.key} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                          <span style={{ color:'var(--text-muted)' }}>{f.label}</span>
                          <span style={{ color:'var(--accent)', fontWeight:700, fontFamily:'var(--mono)' }}>{m[f.key]}{f.key==='body_fat'?'%':''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PRs TAB */}
        {tab === 'prs' && (
          <div>
            <button onClick={()=>{ setPrStatus(null); setShowAddPR(true) }} style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', padding:14, color:'#fff', fontWeight:700, fontSize:14, marginBottom:16 }}>+ LOG PR</button>
            {prs.length === 0 && <Empty>No PRs yet. Log one above or finish a session.</Empty>}
            {MUSCLE_GROUPS.map(g => {
              const gPRs = prs.filter(p => p.muscle_group === g)
              if (!gPRs.length) return null
              return (
                <div key={g} style={{ marginBottom: 24 }}>
                  <div className="label" style={{ color: 'var(--accent)', marginBottom: 8 }}>{g.toUpperCase()}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gPRs.map(pr => (
                      <div key={pr.id} className="card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => handleSelectPR(pr)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{pr.exercise}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>{new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{pr.weight}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{pr.reps} reps · {unit}</div>
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedPR === pr.exercise ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {selectedPR === pr.exercise && (
                          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                            {prHistoryLoading ? (
                              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>Loading...</div>
                            ) : prHistory.length < 2 ? (
                              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Need 2+ sessions to show trend</div>
                            ) : (
                              <>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 10 }}>EST. 1RM PROGRESSION</div>
                                <ResponsiveContainer width="100%" height={120}>
                                  <LineChart data={prHistory.map(h => ({ date: new Date(h.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}), '1RM': h.est1rm, weight: h.weight }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                                    <XAxis dataKey="date" tick={{ fill: chartTheme.tick, fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                    <YAxis tick={{ fill: chartTheme.tick, fontSize: 8 }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} />
                                    <Tooltip {...TT} formatter={v => [`${v} ${unit}`]} />
                                    <Line type="monotone" dataKey="1RM" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
                                  </LineChart>
                                </ResponsiveContainer>
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                  <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>FIRST</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)' }}>{prHistory[0].weight} {unit}</div>
                                  </div>
                                  <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>BEST</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{Math.max(...prHistory.map(h=>h.weight))} {unit}</div>
                                  </div>
                                  <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>SESSIONS</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)' }}>{prHistory.length}</div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {/* Strength Standards */}
            {profile?.weight ? (
              <div style={{ marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 4 }}>STRENGTH STANDARDS</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Relative to bodyweight ({profile.weight} {unit})</div>
                {Object.entries(STRENGTH_STANDARDS).map(([exercise, levels]) => {
                  const pr = prs.find(p => p.exercise === exercise)
                  const bw = +profile.weight
                  const ratio = pr ? pr.weight / bw : 0
                  const levelIdx = levels.filter(l => ratio >= l).length - 1
                  const achieved = levelIdx >= 0 ? STANDARD_LABELS[levelIdx] : null
                  const nextIdx = levelIdx < 4 ? levelIdx + 1 : null
                  const nextTarget = nextIdx !== null ? Math.round(levels[nextIdx] * bw) : null
                  return (
                    <div key={exercise} className="card" style={{ padding: 14, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{exercise}</div>
                        {achieved ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: STANDARD_COLORS[levelIdx], background: `${STANDARD_COLORS[levelIdx]}22`, padding: '3px 10px', borderRadius: 20 }}>{achieved}</span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No PR yet</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {STANDARD_LABELS.map((label, i) => (
                          <div key={label} title={`${label}: ${Math.round(levels[i] * bw)} ${unit}`} style={{ flex: 1, height: 4, borderRadius: 2, background: ratio >= levels[i] ? STANDARD_COLORS[i] : 'var(--border)' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>PR: {pr ? `${pr.weight} ${unit}` : '—'}</span>
                        {nextTarget && <span>Next ({STANDARD_LABELS[nextIdx]}): {nextTarget} {unit}</span>}
                        {!nextTarget && achieved === 'Elite' && <span style={{ color: STANDARD_COLORS[4] }}>Elite ✓</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Set your bodyweight in Profile to see strength standards
              </div>
            )}
            {showAddPR && (
              <PRModal
                form={prForm}
                setForm={setPrForm}
                status={prStatus}
                saving={prSaving}
                onClose={()=>{ setShowAddPR(false); setPrStatus(null) }}
                onSave={handleLogPR}
              />
            )}
          </div>
        )}

        {tab === 'volume' && (
          <div>
            <ChartCard title={`VOLUME BY MUSCLE (k ${unit})`}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} unit="k" />
                  <Tooltip {...TT} formatter={v => [`${v}k ${unit}`, 'Volume']} />
                  <Bar dataKey="vol" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'4px 0 12px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text-dim)' }}>Breakdown by Muscle</div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>setVolMode('week')} style={{ background:volMode==='week'?'var(--accent)':'var(--bg3)', border:'none', borderRadius:100, padding:'7px 14px', color:volMode==='week'?'#fff':'var(--text-dim)', fontSize:12, fontWeight:volMode==='week'?700:500 }}>Week</button>
                <button onClick={()=>setVolMode('month')} style={{ background:volMode==='month'?'var(--accent)':'var(--bg3)', border:'none', borderRadius:100, padding:'7px 14px', color:volMode==='month'?'#fff':'var(--text-dim)', fontSize:12, fontWeight:volMode==='month'?700:500 }}>Month</button>
              </div>
            </div>

            {volumeByGroup.length === 0 ? <Empty>No sessions yet</Empty> : (
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
                {volumeByGroup.map(bucket => {
                  const total = MUSCLE_GROUPS.reduce((s,g) => s + (bucket[g]||0), 0)
                  const present = MUSCLE_GROUPS.filter(g => bucket[g] > 0)
                  return (
                    <div key={bucket._label} className="card" style={{ padding:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                        <span style={{ fontSize:13, fontWeight:700, fontFamily:'var(--mono)' }}>{bucket._label}</span>
                        <span style={{ fontSize:11, color:'var(--accent)', fontFamily:'var(--mono)', fontWeight:700 }}>{Math.round(total).toLocaleString()} {unit}</span>
                      </div>
                      {present.length === 0 ? (
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>—</div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {present
                            .map(g => ({ g, v: bucket[g] }))
                            .sort((a,b) => b.v - a.v)
                            .map(({g,v}) => {
                              const pct = total ? Math.round(v/total*100) : 0
                              return (
                                <div key={g} style={{ display:'grid', gridTemplateColumns:'60px 1fr 60px', alignItems:'center', gap:8 }}>
                                  <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{g.slice(0,4).toUpperCase()}</span>
                                  <div style={{ height:6, background:'var(--border)', borderRadius:3 }}>
                                    <div style={{ height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:3 }} />
                                  </div>
                                  <span style={{ fontSize:10, color:'var(--text-dim)', fontFamily:'var(--mono)', textAlign:'right' }}>{Math.round(v).toLocaleString()}</span>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {MUSCLE_GROUPS.map(g => {
                const vol = volumes[g] || 0
                const rank = getRank(vol)
                return (
                  <div key={g} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{g}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, letterSpacing: '2px', color: rank.color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{rank.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{Math.round(vol).toLocaleString()} {unit}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div>
            {!lifetimeStats ? <Empty>Complete a session to see your stats</Empty> : (
              <>
                {/* Overview */}
                <div className="label" style={{ marginBottom: 10 }}>LIFETIME</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <BigStat label="TOTAL SESSIONS" value={sessions.length} />
                  <BigStat label="TOTAL VOLUME" value={`${(lifetimeStats.totalVol/1000).toFixed(1)}k`} unit={unit} />
                  <BigStat label="TOTAL SETS" value={lifetimeStats.totalSets.toLocaleString()} />
                  <BigStat label="AVG SESSION" value={`${Math.round(lifetimeStats.avgDur/60)}m`} />
                </div>

                {/* Streaks */}
                <div className="label" style={{ marginBottom: 10 }}>STREAKS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <div className="card" style={{ padding: '16px 14px', textAlign: 'center', background: lifetimeStats.currentStreak > 0 ? 'var(--accent)' : undefined }}>
                    <div style={{ fontSize: 11, color: lifetimeStats.currentStreak > 0 ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 6 }}>CURRENT</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: lifetimeStats.currentStreak > 0 ? '#fff' : 'var(--text)', fontFamily: 'var(--mono)' }}>{lifetimeStats.currentStreak}</div>
                    <div style={{ fontSize: 10, color: lifetimeStats.currentStreak > 0 ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>days in a row</div>
                  </div>
                  <div className="card" style={{ padding: '16px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 6 }}>BEST EVER</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{lifetimeStats.bestStreak}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>days in a row</div>
                  </div>
                </div>

                {/* Averages */}
                <div className="label" style={{ marginBottom: 10 }}>AVERAGES</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <StatCard label="Per Week" value={lifetimeStats.weeklyAvg.toFixed(1)} />
                  <StatCard label="Top Muscle" value={lifetimeStats.topMuscle?.[0]?.slice(0,4) || '—'} />
                  <StatCard label="PRs Set" value={prs.length} />
                </div>

                {/* Top PRs by estimated 1RM */}
                {prs.length > 0 && (
                  <>
                    <div className="label" style={{ marginBottom: 10 }}>TOP LIFTS (EST. 1RM)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                      {[...prs]
                        .map(pr => ({ ...pr, est1rm: Math.round(pr.weight * (1 + pr.reps / 30)) }))
                        .sort((a, b) => b.est1rm - a.est1rm)
                        .slice(0, 5)
                        .map((pr, i) => (
                          <div key={pr.id} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 11, color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--mono)', fontWeight: 700, width: 16 }}>#{i+1}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{pr.exercise}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{pr.weight} {unit} × {pr.reps}</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{pr.est1rm}</div>
                          </div>
                        ))}
                    </div>
                  </>
                )}

                {/* Milestones */}
                <div className="label" style={{ marginBottom: 10 }}>MILESTONES</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  {lifetimeStats.milestones.map(m => {
                    const val = m.vol ? lifetimeStats.totalVol : sessions.length
                    const earned = val >= m.target
                    return (
                      <div key={m.label} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: earned ? 1 : 0.4 }}>
                        <span style={{ color: earned ? 'var(--accent)' : 'var(--text-muted)' }}><m.Icon size={22} /></span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: earned ? 'var(--text)' : 'var(--text-muted)' }}>{m.label}</div>
                          {earned && <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 700 }}>UNLOCKED</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Export */}
                <div className="label" style={{ margin: '20px 0 10px' }}>DATA EXPORT</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => exportCSV('sessions', sessions, prs)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 0', color: 'var(--text-dim)', fontWeight: 700, fontSize: 12, letterSpacing: '1px' }}>SESSIONS CSV</button>
                  <button onClick={() => exportCSV('prs', sessions, prs)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 0', color: 'var(--text-dim)', fontWeight: 700, fontSize: 12, letterSpacing: '1px' }}>PRs CSV</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function exportCSV(type, sessions, prs) {
  let csv, filename
  if (type === 'sessions') {
    const rows = [['Date','Duration (min)','Exercises','Sets','Volume (lbs)','Notes']]
    sessions.forEach(s => {
      const vol = Math.round(s.exercises?.reduce((t,ex)=>(ex.sets||[]).reduce((e,st)=>e+(st.is_warmup?0:(+st.weight||0)*(+st.reps||0)),t),0)||0)
      const sets = s.exercises?.reduce((t,ex)=>(ex.sets||[]).filter(st=>st.weight&&st.reps).length+t,0)||0
      rows.push([
        s.date?.split('T')[0] || '',
        s.duration ? Math.round(s.duration/60) : '',
        s.exercises?.length || 0,
        sets,
        vol,
        (s.notes||'').replace(/,/g,' '),
      ])
    })
    csv = rows.map(r => r.join(',')).join('\n')
    filename = 'bodmax-sessions.csv'
  } else {
    const rows = [['Exercise','Muscle Group','Weight (lbs)','Reps','Est 1RM','Date']]
    prs.forEach(pr => rows.push([
      pr.exercise, pr.muscle_group, pr.weight, pr.reps,
      Math.round(pr.weight*(1+pr.reps/30)),
      pr.date?.split('T')[0]||'',
    ]))
    csv = rows.map(r => r.join(',')).join('\n')
    filename = 'bodmax-prs.csv'
  }
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function BigStat({ label, value, unit }) {
  return (
    <div className="card" style={{ padding: '16px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{unit}</div>}
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ padding: '16px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{children}</div>
}

function PRModal({ form, setForm, status, saving, onClose, onSave }) {
  useEffect(() => {
    const el = document.getElementById('scroll-root')
    if (!el) return
    el.style.overflowY = 'hidden'
    return () => { el.style.overflowY = 'auto' }
  }, [])
  const INP = { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'11px 12px', fontSize:15, width:'100%' }
  const options = EXERCISES[form.muscleGroup] || []
  const name = form.exercise === '__custom__' ? form.customExercise.trim() : form.exercise.trim()
  const canSave = !!name && !!form.weight && !!form.reps && !saving
  return createPortal(
    <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:100, display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div className="modal-sheet" style={{ background:'var(--bg2)', borderRadius:'20px 20px 0 0', padding:'24px 20px 40px', width:'100%', maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span className="label">LOG PR</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', fontSize:22 }}>×</button>
        </div>
        <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:14, lineHeight:1.5 }}>
          Record a lift you hit outside a tracked session. Only saved if it beats your current PR for that exercise.
        </div>

        <div className="label" style={{ marginBottom:8 }}>MUSCLE GROUP</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {MUSCLE_GROUPS.map(g => (
            <button
              key={g}
              onClick={()=>setForm(f=>({ ...f, muscleGroup: g, exercise: '', customExercise: '' }))}
              style={{ padding:'6px 12px', borderRadius:20, border:'none', background:form.muscleGroup===g?'var(--accent)':'var(--bg3)', color:form.muscleGroup===g?'#fff':'var(--text-dim)', fontSize:12, fontWeight:600 }}
            >{g}</button>
          ))}
        </div>

        <div className="label" style={{ marginBottom:8 }}>EXERCISE</div>
        <select
          value={form.exercise}
          onChange={e=>setForm(f=>({ ...f, exercise: e.target.value }))}
          style={{ ...INP, marginBottom: form.exercise === '__custom__' ? 10 : 14 }}
        >
          <option value="">— select —</option>
          {options.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          <option value="__custom__">+ Custom exercise…</option>
        </select>
        {form.exercise === '__custom__' && (
          <input
            autoFocus
            style={{ ...INP, marginBottom:14 }}
            placeholder="Exercise name"
            value={form.customExercise}
            onChange={e=>setForm(f=>({ ...f, customExercise: e.target.value }))}
          />
        )}

        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <div className="label" style={{ marginBottom:8 }}>WEIGHT (lbs)</div>
            <input style={INP} type="number" inputMode="decimal" value={form.weight} onChange={e=>setForm(f=>({ ...f, weight: e.target.value }))} />
          </div>
          <div style={{ flex:1 }}>
            <div className="label" style={{ marginBottom:8 }}>REPS</div>
            <input style={INP} type="number" inputMode="numeric" value={form.reps} onChange={e=>setForm(f=>({ ...f, reps: e.target.value }))} />
          </div>
        </div>

        {status === 'same' && (
          <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:12, marginBottom:12, fontSize:12, color:'var(--text-dim)' }}>
            Not a PR — you already have a better lift on record for this exercise.
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!canSave}
          style={{ width:'100%', background:canSave?'var(--accent)':'var(--bg3)', border:'none', borderRadius:'var(--radius-sm)', padding:13, color:canSave?'#fff':'var(--text-muted)', fontWeight:700, fontSize:14 }}
        >
          {saving ? 'SAVING...' : 'SAVE PR'}
        </button>
      </div>
    </div>,
    document.body
  )
}
