import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSessions, getDietByDate } from '../lib/db'
import { calcVolumes, getRank, getRankProgress, MUSCLE_GROUPS } from '../lib/ranks'

const todayStr = () => new Date().toISOString().split('T')[0]

export default function Dashboard() {
  const { profile } = useAuth()
  const [volumes, setVolumes] = useState({})
  const [todayDiet, setTodayDiet] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    Promise.all([
      getSessions(profile.id).then(s => { setRecent(s.slice(0,3)); setVolumes(calcVolumes(s)) }),
      getDietByDate(profile.id, todayStr()).then(setTodayDiet),
    ]).finally(() => setLoading(false))
  }, [profile?.id])

  const totalCal = todayDiet.reduce((s,e) => s+(e.calories||0), 0)
  const totalProt = todayDiet.reduce((s,e) => s+(e.protein||0), 0)
  const calPct = Math.min(100, profile ? Math.round(totalCal/profile.target_calories*100) : 0)
  const protPct = Math.min(100, profile ? Math.round(totalProt/profile.target_protein*100) : 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) return <Loader />

  return (
    <div style={{ paddingBottom:24 }}>
      <div style={{ padding:'52px 20px 20px', background:'var(--bg2)', borderBottom:'1px solid var(--border)' }}>
        <div className="label" style={{ marginBottom:4 }}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}).toUpperCase()}</div>
        <h1 style={{ fontSize:26, fontWeight:700 }}>{greeting}, <span style={{ color:'var(--accent)' }}>{profile?.name?.split(' ')[0]}</span></h1>
      </div>

      <Section label="TODAY'S NUTRITION">
        <div style={{ display:'flex', gap:10 }}>
          <MacroCard label="CALORIES" value={totalCal.toLocaleString()} target={(profile?.target_calories||0).toLocaleString()} pct={calPct} color="var(--accent)" />
          <MacroCard label="PROTEIN" value={`${totalProt}g`} target={`${profile?.target_protein||0}g`} pct={protPct} color="#4a9eb5" />
        </div>
      </Section>

      <Section label="MUSCLE RANKINGS">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {MUSCLE_GROUPS.map(g => {
            const vol = volumes[g]||0
            const rank = getRank(vol)
            const prog = getRankProgress(vol)
            return (
              <div key={g} className="card" style={{ padding:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{g}</span>
                  <span style={{ fontSize:'8px', letterSpacing:'1.5px', fontFamily:'var(--mono)', color:rank.color, fontWeight:700 }}>{rank.name}</span>
                </div>
                <div style={{ height:3, background:'var(--border)', borderRadius:2 }}>
                  <div style={{ height:'100%', width:`${prog}%`, background:rank.color, borderRadius:2 }} />
                </div>
                <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:4, fontFamily:'var(--mono)' }}>{Math.round(vol).toLocaleString()} lbs</div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section label="RECENT SESSIONS">
        {recent.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)', fontSize:13 }}>No sessions yet — start lifting 💪</div>
        ) : recent.map(s => {
          const vol = (s.exercises||[]).reduce((sum,ex) => sum+(ex.sets||[]).reduce((s2,set) => s2+((+set.weight||0)*(+set.reps||0)),0),0)
          const groups = [...new Set((s.exercises||[]).map(e=>e.muscle_group||e.muscleGroup))].filter(Boolean)
          return (
            <div key={s.id} className="card" style={{ padding:14, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{groups.join(', ')||'Workout'}</span>
                <span style={{ fontSize:11, color:'var(--text-dim)' }}>{new Date(s.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3, fontFamily:'var(--mono)' }}>
                {(s.exercises||[]).length} exercises · {Math.round(vol).toLocaleString()} lbs{s.duration?` · ${Math.floor(s.duration/60)}m`:''}
              </div>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ padding:'20px 20px 0' }}>
      <div className="label" style={{ marginBottom:10 }}>{label}</div>
      {children}
    </div>
  )
}

function MacroCard({ label, value, target, pct, color }) {
  return (
    <div className="card" style={{ flex:1, padding:14 }}>
      <div className="label" style={{ marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color, fontFamily:'var(--mono)' }}>{value}</div>
      <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:8 }}>/ {target}</div>
      <div style={{ height:3, background:'var(--border)', borderRadius:2 }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2 }} />
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
