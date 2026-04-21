import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getWeightLog, addWeight, getPRs, getSessions } from '../lib/db'
import { calcVolumes, getRank, MUSCLE_GROUPS, calcSessionVolume } from '../lib/ranks'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const TT = { contentStyle:{ background:'#141414', border:'1px solid #222', borderRadius:8, color:'#f0f0f0', fontSize:12 }, cursor:{ stroke:'#333' } }

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

  useEffect(() => {
    if (!profile) return
    getWeightLog(profile.id).then(setWeightLog)
    getPRs(profile.id).then(setPRs)
    getSessions(profile.id).then(s => { setSessions(s); setVolumes(calcVolumes(s)) })
  }, [profile?.id])

  const handleAddWeight = async () => {
    if (!newWeight) return
    await addWeight(profile.id, new Date().toISOString().split('T')[0], +newWeight)
    setWeightLog(await getWeightLog(profile.id))
    setNewWeight(''); setShowAddW(false)
  }

  const weightChartData = weightLog.slice(-histRange).map(e => ({
    date: new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}),
    weight: e.weight
  }))

  const volumeByWeek = useMemo(() => {
    const weeks = {}
    sessions.slice(0, 56).forEach(s => {
      const d = new Date(s.date)
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})
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
      const key = weekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})
      if (!weeks[key]) weeks[key] = new Set()
      weeks[key].add(s.date?.split('T')[0])
    })
    return Object.entries(weeks).slice(-8).map(([week,days]) => ({ week, days: days.size })).reverse()
  }, [sessions])

  const volumeData = MUSCLE_GROUPS.map(g => ({ name: g.slice(0,4).toUpperCase(), vol: Math.round((volumes[g]||0)/1000*10)/10 }))
  const INP = { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'12px 14px', fontSize:15, outline:'none' }

  return (
    <div style={{ paddingBottom:24 }}>
      <div style={{ padding:'52px 20px 0', borderBottom:'1px solid var(--border)' }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:16 }}>Progress</h2>
        <div style={{ display:'flex' }}>
          {['history','weight','prs','volume'].map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1, background:'none', border:'none', borderBottom:`2px solid ${tab===t?'var(--accent)':'transparent'}`, color:tab===t?'var(--accent)':'var(--text-muted)', padding:'10px 0', fontSize:'8px', letterSpacing:'3px', fontFamily:'var(--mono)', fontWeight:600, textTransform:'uppercase' }}>{t}</button>
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
              {volumeByWeek.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeByWeek}>
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
              {freqData.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={freqData}>
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
              {weightLog.slice(-15).reverse().map((e,i) => (
                <div key={i} className="card" style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, color:'var(--text-dim)' }}>{new Date(e.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  <span style={{ fontSize:20, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{e.weight} <span style={{ fontSize:11, fontWeight:400, color:'var(--text-muted)' }}>{profile?.unit||'lbs'}</span></span>
                </div>
              ))}
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
