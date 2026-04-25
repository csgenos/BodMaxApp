import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSessions, getDietByDate, getPRs, getDailyInsight } from '../lib/db'
import { calcVolumes, getRank, getRankProgress, MUSCLE_GROUPS, calcSessionVolume } from '../lib/ranks'
import { calcStreak, sessionsThisWeek, sessionsLastWeek, weeklyVolume } from '../lib/streaks'
import { FlameIcon, ZzzIcon, TrophyIcon, AlertIcon, SparkleIcon } from '../lib/icons'

const todayDate = () => new Date().toISOString().split('T')[0]

export default function Dashboard() {
  const { profile, user, isSubscribed } = useAuth()
  const nav = useNavigate()
  const unit = profile?.unit || 'lbs'
  const [sessions, setSessions] = useState([])
  const [volumes, setVolumes] = useState({})
  const [todayDiet, setTodayDiet] = useState([])
  const [prs, setPRs] = useState([])
  const [loading, setLoading] = useState(true)
  const [coachInsight, setCoachInsight] = useState(null)
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

    if (isSubscribed && user) {
      const profileSummary = `Goal: ${profile.goal || 'build muscle'}, Unit: ${profile.unit || 'lbs'}`
      getDailyInsight(user.id, profileSummary).then(i => { if (mounted.current) setCoachInsight(i) }).catch(() => {})
    }
  }, [profile?.id])

  const streak = useMemo(() => calcStreak(sessions), [sessions])
  const thisWeek = useMemo(() => sessionsThisWeek(sessions), [sessions])
  const lastWeek = useMemo(() => sessionsLastWeek(sessions), [sessions])
  const volNow = useMemo(() => weeklyVolume(sessions, 0), [sessions])
  const volPrev = useMemo(() => weeklyVolume(sessions, 1), [sessions])
  const latestPR = useMemo(() => prs.length ? prs.reduce((a, b) => new Date(b.date) > new Date(a.date) ? b : a) : null, [prs])
  const recent = useMemo(() => sessions.slice(0, 3), [sessions])

  const totalCal = todayDiet.reduce((s, e) => s + (e.calories || 0), 0)
  const totalProt = todayDiet.reduce((s, e) => s + (e.protein || 0), 0)
  const totalCarbs = todayDiet.reduce((s, e) => s + (e.carbs || 0), 0)
  const totalFat = todayDiet.reduce((s, e) => s + (e.fat || 0), 0)
  const calPct = Math.min(100, profile?.target_calories ? Math.round(totalCal / profile.target_calories * 100) : 0)
  const protPct = Math.min(100, profile?.target_protein ? Math.round(totalProt / profile.target_protein * 100) : 0)
  const carbPct = Math.min(100, profile?.target_carbs ? Math.round(totalCarbs / profile.target_carbs * 100) : 0)
  const fatPct = Math.min(100, profile?.target_fat ? Math.round(totalFat / profile.target_fat * 100) : 0)

  const muscleFreq = useMemo(() => MUSCLE_GROUPS.map(g => {
    const last = sessions.find(s => (s.exercises || []).some(ex => (ex.muscle_group || ex.muscleGroup) === g))
    const days = last ? Math.floor((Date.now() - new Date(last.date)) / 86400000) : null
    return { group: g, days }
  }), [sessions])

  const daysSinceLast = useMemo(() => {
    if (!sessions.length) return null
    return Math.floor((Date.now() - new Date(sessions[0].date)) / 86400000)
  }, [sessions])

  const roasterMsg = useMemo(() => {
    if (daysSinceLast === null || daysSinceLast < 2) return null
    if (daysSinceLast >= 7) return "Over a week away. The gym filed a missing persons report."
    if (daysSinceLast >= 5) return `${daysSinceLast} days off. Your gains are evaporating.`
    if (daysSinceLast >= 3) return `${daysSinceLast} days since your last session. Don't let the momentum die.`
    return `${daysSinceLast} days off — the rest day stretched into two. Time to get back.`
  }, [daysSinceLast])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const sessionDiff = thisWeek - lastWeek
  const volDiff = volPrev > 0 ? Math.round((volNow - volPrev) / volPrev * 100) : null

  const todaySplitMsg = (() => {
    const split = profile?.workout_split
    if (!split?.days) return null
    const hasSplit = Object.values(split.days).some(v => v !== null && v !== undefined)
    if (!hasSplit) return null
    const todayMuscles = split.days[new Date().getDay()] ?? null
    if (todayMuscles === null) return "It's rest day — recovery is training too."
    if (todayMuscles.length === 0) return "Workout day — get to the gym"
    return `Today: ${todayMuscles.join(' & ')}`
  })()

  if (loading) return <Loader />

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: 'var(--page-top) 20px 20px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>
          {greeting}, {profile?.name?.split(' ')[0]}
        </h1>
        {todaySplitMsg && (
          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text-dim)' }}>{todaySplitMsg}</div>
        )}
      </div>

      {/* Session roaster */}
      {roasterMsg && (
        <div style={{ margin: '0 20px 16px', padding: '12px 16px', background: 'rgba(224,22,30,0.08)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><AlertIcon size={16} /></span>
          <span style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{roasterMsg}</span>
        </div>
      )}

      {/* Weekly stats */}
      <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <StatCard>
          <span style={{ color: streak.current > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{streak.current > 0 ? <FlameIcon size={24} /> : <ZzzIcon size={24} />}</span>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{streak.current}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Streak</div>
        </StatCard>
        <StatCard>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{thisWeek}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Sessions</div>
          {sessionDiff !== 0 && (
            <div style={{ fontSize: 11, color: sessionDiff > 0 ? '#4a9a4a' : '#e0161e', marginTop: 3 }}>
              {sessionDiff > 0 ? '↑' : '↓'}{Math.abs(sessionDiff)} vs last wk
            </div>
          )}
        </StatCard>
        <StatCard>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
            {Math.round(volNow / 1000 * 10) / 10 || 0}k
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Volume</div>
          {volDiff !== null && (
            <div style={{ fontSize: 11, color: volDiff >= 0 ? '#4a9a4a' : '#e0161e', marginTop: 3 }}>
              {volDiff >= 0 ? '↑' : '↓'}{Math.abs(volDiff)}% vs last wk
            </div>
          )}
        </StatCard>
      </div>

      {/* Nutrition Today */}
      <Section label="Nutrition Today">
        <div className="card" style={{ padding: '16px 18px' }}>
          <MacroBar label="Calories" current={totalCal.toLocaleString()} target={(profile?.target_calories || 0).toLocaleString()} pct={calPct} color="var(--accent)" />
          <div style={{ marginTop: 14 }}>
            <MacroBar label="Protein" current={`${totalProt}g`} target={`${profile?.target_protein || 0}g`} pct={protPct} color="#4a9eb5" />
          </div>
          {(profile?.target_carbs || totalCarbs > 0) && (
            <div style={{ marginTop: 14 }}>
              <MacroBar label="Carbs" current={`${totalCarbs}g`} target={`${profile?.target_carbs || 0}g`} pct={carbPct} color="#c88a2e" />
            </div>
          )}
          {(profile?.target_fat || totalFat > 0) && (
            <div style={{ marginTop: 14 }}>
              <MacroBar label="Fat" current={`${totalFat}g`} target={`${profile?.target_fat || 0}g`} pct={fatPct} color="#9a5ad4" />
            </div>
          )}
        </div>
      </Section>

      {/* AI Coach Insight */}
      {coachInsight && (
        <Section label="AI Coach">
          <div
            onClick={() => nav('/coach')}
            style={{ background: 'var(--bg2)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius)', padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
          >
            <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}><SparkleIcon size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{coachInsight.headline}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{coachInsight.body}</div>
              {coachInsight.action && (
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 6 }}>→ {coachInsight.action}</div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Latest PR */}
      {latestPR && (
        <Section label="Latest PR">
          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 4 }}>Latest PR</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{latestPR.exercise}</div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {latestPR.weight} {unit} × {latestPR.reps} reps
              </div>
            </div>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <TrophyIcon size={24} />
            </div>
          </div>
        </Section>
      )}

      {/* Volume by Muscle */}
      <Section label="Volume by Muscle">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {MUSCLE_GROUPS.map((g, i) => {
            const vol = volumes[g] || 0
            const rank = getRank(vol)
            return (
              <div key={g} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{g}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: rank.color, background: `${rank.color}22`, padding: '2px 8px', borderRadius: 20 }}>
                    #{i + 1}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{Math.round(vol).toLocaleString()} {unit}</div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Muscle Frequency */}
      {sessions.length > 0 && (
        <Section label="Muscle Frequency">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {muscleFreq.map(({ group, days }) => {
              const color = days === null ? 'var(--text-muted)' : days <= 3 ? '#22c55e' : days <= 6 ? '#f59e0b' : 'var(--accent)'
              const label = days === null ? 'Never' : days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`
              return (
                <div key={group} className="card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{group}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>{label}</span>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Recent Activity */}
      <Section label="Recent Activity">
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: 14 }}>
            No sessions yet — start lifting
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {recent.map((s, idx) => {
              const vol = calcSessionVolume(s)
              const groups = [...new Set((s.exercises || []).map(e => e.muscle_group || e.muscleGroup))].filter(Boolean)
              return (
                <div key={s.id} style={{ padding: '14px 16px', borderBottom: idx < recent.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{groups.join(', ') || 'Workout'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {(s.exercises || []).length} exercises · {Math.round(vol).toLocaleString()} {unit}{s.duration ? ` · ${Math.floor(s.duration / 60)}m` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0, marginLeft: 12 }}>
                    {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12 }}>{label}</div>
      {children}
    </div>
  )
}

function StatCard({ children }) {
  return (
    <div className="card" style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {children}
    </div>
  )
}

function MacroBar({ label, current, target, pct, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          <span style={{ color, fontWeight: 700 }}>{current}</span> / {target}
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
}
