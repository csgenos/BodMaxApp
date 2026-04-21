import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSessions, getDietByDate, getPRs } from '../lib/db'
import { calcVolumes, getRank, getRankProgress, MUSCLE_GROUPS } from '../lib/ranks'
import { calcStreak, sessionsThisWeek, sessionsLastWeek, weeklyVolume } from '../lib/streaks'

const todayDate = () => new Date().toISOString().split('T')[0]

export default function Dashboard() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState([])
  const [volumes, setVolumes] = useState({})
  const [todayDiet, setTodayDiet] = useState([])
  const [prs, setPRs] = useState([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!profile) return
    Promise.all([
      getSessions(profile.id),
      getDietByDate(profile.id, todayDate()),
      getPRs(profile.id),
    ]).then(([s, diet, p]) => {
      if (!mounted.current) return
      setSessions(s); setVolumes(calcVolumes(s)); setTodayDiet(diet); setPRs(p)
    }).finally(() => { if (mounted.current) setLoading(false) })
  }, [profile?.id])

  const streak = useMemo(() => calcStreak(sessions), [sessions])
  const thisWeek = useMemo(() => sessionsThisWeek(sessions), [sessions])
  const lastWeek = useMemo(() => sessionsLastWeek(sessions), [sessions])
  const volNow = useMemo(() => weeklyVolume(sessions, 0), [sessions])
  const volPrev = useMemo(() => weeklyVolume(sessions, 1), [sessions])
  const latestPR = useMemo(() => prs.length ? prs.reduce((a, b) => new Date(b.date) > new Date(a.date) ? b : a) : null, [prs])

  const totalCal = todayDiet.reduce((s, e) => s + (e.calories || 0), 0)
  const totalProt = todayDiet.reduce((s, e) => s + (e.protein || 0), 0)
  const calPct = Math.min(100, profile ? Math.round(totalCal / profile.target_calories * 100) : 0)
  const protPct = Math.min(100, profile ? Math.round(totalProt / profile.target_protein * 100) : 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const sessionDiff = thisWeek - lastWeek
  const volDiff = volPrev > 0 ? Math.round((volNow - volPrev) / volPrev * 100) : null

  if (loading) return <Loader />

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '52px 20px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div className="label" style={{ marginBottom: 4 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</div>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>{greeting}, <span style={{ color: 'var(--accent)' }}>{profile?.name?.split(' ')[0]}</span></h1>
      </div>

      {/* Weekly Stats */}
      <Section label="THIS WEEK">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>{streak.current > 0 ? '🔥' : '💤'}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)', lineHeight: 1.1 }}>{streak.current}</div>
            <div className="label" style={{ fontSize: 8, marginTop: 2 }}>STREAK</div>
          </div>
          <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{thisWeek}</div>
            <div className="label" style={{ fontSize: 8, marginTop: 2 }}>SESSIONS</div>
            {sessionDiff !== 0 && (
              <div style={{ fontSize: 9, color: sessionDiff > 0 ? '#4a9a4a' : '#e0161e', fontFamily: 'var(--mono)', marginTop: 2 }}>
                {sessionDiff > 0 ? '↑' : '↓'}{Math.abs(sessionDiff)} vs last wk
              </div>
            )}
          </div>
          <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{Math.round(volNow / 1000 * 10) / 10 || 0}k</div>
            <div className="label" style={{ fontSize: 8, marginTop: 2 }}>VOLUME</div>
            {volDiff !== null && (
              <div style={{ fontSize: 9, color: volDiff >= 0 ? '#4a9a4a' : '#e0161e', fontFamily: 'var(--mono)', marginTop: 2 }}>
                {volDiff >= 0 ? '↑' : '↓'}{Math.abs(volDiff)}% vs last wk
              </div>
            )}
          </div>
        </div>
        {streak.best >= 3 && (
          <div style={{ marginTop: 8, padding: '7px 12px', background: 'var(--accent-low)', borderRadius: 8, fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', textAlign: 'center' }}>
            🏆 BEST STREAK: {streak.best} DAYS
          </div>
        )}
      </Section>

      {/* Nutrition */}
      <Section label="TODAY'S NUTRITION">
        <div style={{ display: 'flex', gap: 10 }}>
          <MacroCard label="CALORIES" value={totalCal.toLocaleString()} target={(profile?.target_calories || 0).toLocaleString()} pct={calPct} color="var(--accent)" />
          <MacroCard label="PROTEIN" value={`${totalProt}g`} target={`${profile?.target_protein || 0}g`} pct={protPct} color="#4a9eb5" />
        </div>
      </Section>

      {/* Latest PR */}
      {latestPR && (
        <Section label="LATEST PR">
          <div className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{latestPR.exercise}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                {latestPR.muscle_group} · {new Date(latestPR.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{latestPR.weight}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}> lbs × {latestPR.reps}</span>
            </div>
          </div>
        </Section>
      )}

      {/* Muscle Rankings */}
      <Section label="MUSCLE RANKINGS">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {MUSCLE_GROUPS.map(g => {
            const vol = volumes[g] || 0
            const rank = getRank(vol)
            const prog = getRankProgress(vol)
            return (
              <div key={g} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{g}</span>
                  <span style={{ fontSize: '8px', letterSpacing: '1.5px', fontFamily: 'var(--mono)', color: rank.color, fontWeight: 700 }}>{rank.name}</span>
                </div>
                <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${prog}%`, background: rank.color, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--mono)' }}>{Math.round(vol).toLocaleString()} lbs</div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Recent Sessions */}
      <Section label="RECENT SESSIONS">
        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No sessions yet — start lifting 💪</div>
        ) : sessions.slice(0, 3).map(s => {
          const vol = (s.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)
          const groups = [...new Set((s.exercises || []).map(e => e.muscle_group || e.muscleGroup))].filter(Boolean)
          return (
            <div key={s.id} className="card" style={{ padding: 14, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{groups.join(', ') || 'Workout'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--mono)' }}>
                {(s.exercises || []).length} exercises · {Math.round(vol).toLocaleString()} lbs{s.duration ? ` · ${Math.floor(s.duration / 60)}m` : ''}
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
    <div style={{ padding: '20px 20px 0' }}>
      <div className="label" style={{ marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

function MacroCard({ label, value, target, pct, color }) {
  return (
    <div className="card" style={{ flex: 1, padding: 14 }}>
      <div className="label" style={{ marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>/ {target}</div>
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
