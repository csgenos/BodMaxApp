import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  getWeightLog, addWeight, getPRs, getSessions,
  getBodyMeasurements, addBodyMeasurement, deleteBodyMeasurement,
  checkAndUpdatePR,
} from '../lib/db'
import { calcVolumes, getRank, MUSCLE_GROUPS, EXERCISES, calcSessionVolume } from '../lib/ranks'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

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

export default function Progress() {
  const { profile } = useAuth()
  const { theme } = useTheme()
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

  return (
    <div style={{ paddingBottom:24 }}>
      <div style={{ padding:'52px 20px 0', borderBottom:'1px solid var(--border)' }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:16 }}>Progress</h2>
        <div style={{ display:'flex', overflowX:'auto' }}>
          {['history','weight','body','prs','volume'].map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1, background:'none', border:'none', borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`, color:tab===t?'var(--accent)':'var(--text-muted)', padding:'10px 4px', fontSize:'8px', letterSpacing:'3px', fontFamily:'var(--mono)', fontWeight:600, textTransform:'uppercase', whiteSpace:'nowrap' }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[30, 90, 180].map(r => (
                <button key={r} onClick={() => setHistRange(r)} style={{ flex: 1, background: histRange === r ? 'var(--accent-low)' : 'var(--bg3)', border: `1px solid ${histRange === r ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '8px 0', color: histRange === r ? 'var(--accent)' : 'var(--text-dim)', fontSize: 11, fontWeight: 700 }}>{r}d</button>
              ))}
            </div>
            <ChartCard title="WEEKLY VOLUME (k lbs)">
              {volumeByWeek.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeByWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} unit="k" />
                    <Tooltip {...TT} formatter={v => [`${v}k lbs`, 'Volume']} />
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
            <div style={{ display: 'flex', gap: 10 }}>
              <StatCard label="TOTAL SESSIONS" value={sessions.length} />
              <StatCard label="TOTAL PRs" value={prs.length} />
              <StatCard label="SINCE" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '—'} />
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
                      <div key={pr.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{pr.exercise}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>{new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{pr.weight}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{pr.reps} reps · lbs</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
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
            <ChartCard title="VOLUME BY MUSCLE (k lbs)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartTheme.tick, fontSize: 9 }} axisLine={false} tickLine={false} unit="k" />
                  <Tooltip {...TT} formatter={v => [`${v}k lbs`, 'Volume']} />
                  <Bar dataKey="vol" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'4px 0 10px' }}>
              <div className="label">BREAKDOWN BY MUSCLE</div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>setVolMode('week')} style={{ background:volMode==='week'?'var(--accent-low)':'var(--bg3)', border:`1px solid ${volMode==='week'?'var(--accent)':'var(--border)'}`, borderRadius:6, padding:'5px 10px', color:volMode==='week'?'var(--accent)':'var(--text-muted)', fontSize:10, fontWeight:700, letterSpacing:'1px', fontFamily:'var(--mono)' }}>WEEK</button>
                <button onClick={()=>setVolMode('month')} style={{ background:volMode==='month'?'var(--accent-low)':'var(--bg3)', border:`1px solid ${volMode==='month'?'var(--accent)':'var(--border)'}`, borderRadius:6, padding:'5px 10px', color:volMode==='month'?'var(--accent)':'var(--text-muted)', fontSize:10, fontWeight:700, letterSpacing:'1px', fontFamily:'var(--mono)' }}>MONTH</button>
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
                        <span style={{ fontSize:11, color:'var(--accent)', fontFamily:'var(--mono)', fontWeight:700 }}>{Math.round(total).toLocaleString()} lbs</span>
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
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{Math.round(vol).toLocaleString()} lbs</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="label" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{value}</div>
      <div className="label" style={{ marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{children}</div>
}

function PRModal({ form, setForm, status, saving, onClose, onSave }) {
  const INP = { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'11px 12px', fontSize:15, width:'100%' }
  const options = EXERCISES[form.muscleGroup] || []
  const name = form.exercise === '__custom__' ? form.customExercise.trim() : form.exercise.trim()
  const canSave = !!name && !!form.weight && !!form.reps && !saving
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:100, display:'flex', alignItems:'flex-end' }} onClick={onClose}>
      <div style={{ background:'var(--bg2)', borderRadius:'20px 20px 0 0', padding:'24px 20px 40px', width:'100%', maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
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
    </div>
  )
}
