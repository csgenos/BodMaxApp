import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getWeightLog, addWeight, getPRs, getSessions,
  getBodyMeasurements, addBodyMeasurement, deleteBodyMeasurement,
} from '../lib/db'
import { calcVolumes, getRank, MUSCLE_GROUPS } from '../lib/ranks'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const TT = { contentStyle:{ background:'#141414', border:'1px solid #222', borderRadius:8, color:'#f0f0f0', fontSize:12 }, cursor:{ stroke:'#333' } }

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
  const [tab, setTab] = useState('history')
  const [weightLog, setWeightLog] = useState([])
  const [prs, setPRs] = useState([])
  const [sessions, setSessions] = useState([])
  const [volumes, setVolumes] = useState({})
  const [newWeight, setNewWeight] = useState('')
  const [showAddW, setShowAddW] = useState(false)
  const [histRange, setHistRange] = useState(30)
  const [volMode, setVolMode] = useState('week') // week | month
  const [measurements, setMeasurements] = useState([])
  const [showAddM, setShowAddM] = useState(false)
  const [mForm, setMForm] = useState({})

  useEffect(() => {
    if (!profile) return
    getWeightLog(profile.id).then(setWeightLog)
    getPRs(profile.id).then(setPRs)
    getSessions(profile.id).then(s => { setSessions(s); setVolumes(calcVolumes(s)) })
    getBodyMeasurements(profile.id).then(setMeasurements)
  }, [profile?.id])

  const handleAddWeight = async () => {
    if (!newWeight) return
    await addWeight(profile.id, new Date().toISOString().split('T')[0], +newWeight)
    setWeightLog(await getWeightLog(profile.id))
    setNewWeight(''); setShowAddW(false)
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
    } catch(e) { alert(e.message) }
  }

  const handleDeleteMeasurement = async (id) => {
    try { await deleteBodyMeasurement(profile.id, id); setMeasurements(await getBodyMeasurements(profile.id)) }
    catch(e) { alert(e.message) }
  }

  const weightChartData = weightLog.slice(-histRange).map(e => ({
    date: new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}),
    weight: e.weight
  }))

  // Volume over time (last 8 weeks)
  const volumeByWeek = () => {
    const weeks = {}
    sessions.slice(0, 56).forEach(s => {
      const d = new Date(s.date)
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})
      if (!weeks[key]) weeks[key] = 0
      const vol = (s.exercises||[]).reduce((sum,ex) => sum+(ex.sets||[]).reduce((s2,set) => s2+((+set.weight||0)*(+set.reps||0)),0),0)
      weeks[key] += vol
    })
    return Object.entries(weeks).slice(-8).map(([week,vol]) => ({ week, vol: Math.round(vol/1000*10)/10 })).reverse()
  }

  // Session frequency (days per week over last 8 weeks)
  const freqData = () => {
    const weeks = {}
    sessions.slice(0, 56).forEach(s => {
      const d = new Date(s.date)
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})
      if (!weeks[key]) weeks[key] = new Set()
      weeks[key].add(s.date?.split('T')[0])
    })
    return Object.entries(weeks).slice(-8).map(([week,days]) => ({ week, days: days.size })).reverse()
  }

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

  const volumeData = MUSCLE_GROUPS.map(g => ({ name: g.slice(0,4).toUpperCase(), vol: Math.round((volumes[g]||0)/1000*10)/10 }))
  const INP = { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'12px 14px', fontSize:15, outline:'none' }

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

      <div style={{ padding:20 }}>

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {[30,90,180].map(r => (
                <button key={r} onClick={()=>setHistRange(r)} style={{ flex:1, background:histRange===r?'var(--accent-low)':'var(--bg3)', border:`1px solid ${histRange===r?'var(--accent)':'var(--border)'}`, borderRadius:'var(--radius-sm)', padding:'8px 0', color:histRange===r?'var(--accent)':'var(--text-dim)', fontSize:11, fontWeight:700 }}>{r}d</button>
              ))}
            </div>
            <ChartCard title="WEEKLY VOLUME (k lbs)">
              {volumeByWeek().length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeByWeek()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="week" tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} unit="k" />
                    <Tooltip {...TT} formatter={v=>[`${v}k lbs`,'Volume']} />
                    <Bar dataKey="vol" fill="var(--accent)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty>Not enough data yet</Empty>}
            </ChartCard>
            <ChartCard title="SESSIONS PER WEEK">
              {freqData().length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={freqData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="week" tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TT} formatter={v=>[`${v} days`,'Sessions']} />
                    <Bar dataKey="days" fill="#4a9eb5" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty>Not enough data yet</Empty>}
            </ChartCard>
            <div style={{ display:'flex', gap:10 }}>
              <StatCard label="TOTAL SESSIONS" value={sessions.length} />
              <StatCard label="TOTAL PRs" value={prs.length} />
              <StatCard label="SINCE" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US',{month:'short',year:'2-digit'}) : '—'} />
            </div>
          </div>
        )}

        {/* WEIGHT TAB */}
        {tab === 'weight' && (
          <div>
            {weightChartData.length > 1 && (
              <ChartCard title="WEIGHT TREND">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} domain={['dataMin - 3','dataMax + 3']} />
                    <Tooltip {...TT} />
                    <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {!showAddW ? (
              <button onClick={()=>setShowAddW(true)} style={{ width:'100%', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', padding:14, color:'#fff', fontWeight:700, fontSize:14, marginBottom:16 }}>+ LOG WEIGHT</button>
            ) : (
              <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                <input style={{...INP,flex:1}} type="number" inputMode="decimal" placeholder={`Weight (${profile?.unit||'lbs'})`} value={newWeight} onChange={e=>setNewWeight(e.target.value)} autoFocus />
                <button onClick={handleAddWeight} style={{ background:'var(--accent)', border:'none', borderRadius:'var(--radius-sm)', padding:'12px 18px', color:'#fff', fontWeight:700 }}>LOG</button>
                <button onClick={()=>setShowAddW(false)} style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'12px 14px', color:'var(--text-dim)' }}>×</button>
              </div>
            )}
            {weightLog.length === 0 && <Empty>No weight logged yet</Empty>}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[...weightLog].reverse().slice(0,15).map((e,i) => (
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
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
            {prs.length === 0 && <Empty>No PRs yet. Log a session.</Empty>}
            {MUSCLE_GROUPS.map(g => {
              const gPRs = prs.filter(p => p.muscle_group === g)
              if (!gPRs.length) return null
              return (
                <div key={g} style={{ marginBottom:24 }}>
                  <div className="label" style={{ color:'var(--accent)', marginBottom:8 }}>{g.toUpperCase()}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {gPRs.map(pr => (
                      <div key={pr.id} className="card" style={{ padding:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:14 }}>{pr.exercise}</div>
                          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2, fontFamily:'var(--mono)' }}>{new Date(pr.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:22, fontWeight:800, color:'var(--accent)', fontFamily:'var(--mono)' }}>{pr.weight}</div>
                          <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{pr.reps} reps · lbs</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VOLUME TAB */}
        {tab === 'volume' && (
          <div>
            <ChartCard title="VOLUME BY MUSCLE (k lbs)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="name" tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#444',fontSize:9}} axisLine={false} tickLine={false} unit="k" />
                  <Tooltip {...TT} formatter={v=>[`${v}k lbs`,'Volume']} />
                  <Bar dataKey="vol" fill="var(--accent)" radius={[4,4,0,0]} />
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
                const vol = volumes[g]||0
                const rank = getRank(vol)
                return (
                  <div key={g} className="card" style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:600, fontSize:14 }}>{g}</span>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:9, letterSpacing:'2px', color:rank.color, fontFamily:'var(--mono)', fontWeight:700 }}>{rank.name}</div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{Math.round(vol).toLocaleString()} lbs</div>
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
    <div className="card" style={{ padding:16, marginBottom:16 }}>
      <div className="label" style={{ marginBottom:12 }}>{title}</div>
      {children}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ flex:1, padding:14, textAlign:'center' }}>
      <div style={{ fontSize:22, fontWeight:800, color:'var(--accent)', fontFamily:'var(--mono)' }}>{value}</div>
      <div className="label" style={{ marginTop:3 }}>{label}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)', fontSize:13 }}>{children}</div>
}
