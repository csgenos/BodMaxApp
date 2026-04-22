import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSessions, getPRs, updateProfile } from '../lib/db'
import { calcVolumes, getRank, getRankProgress, getNextTier, getTotalVolume, MUSCLE_GROUPS } from '../lib/ranks'
import { calcStreak } from '../lib/streaks'
import { getAchievements } from '../lib/achievements'

const ACCENTS = ['#e0161e', '#e07016', '#e0c016', '#16c216', '#1680e0', '#8016e0', '#e016b4', '#f0f0f0']
const GOALS = ['bulk', 'cut', 'maintain']
const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, width: '100%' }

export default function Profile() {
  const { profile, setProfile, signOut, theme, toggleTheme } = useAuth()
  const [sessions, setSessions] = useState([])
  const [prs, setPRs] = useState([])
  const [volumes, setVolumes] = useState({})
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!profile) return
    setForm(profile)
    Promise.all([getSessions(profile.id), getPRs(profile.id)]).then(([s, p]) => {
      if (!mounted.current) return
      setSessions(s); setVolumes(calcVolumes(s)); setPRs(p)
    }).catch(e => { if (mounted.current) setError(e.message) })
  }, [profile?.id])

  const totalVol = getTotalVolume(volumes)
  const overallRank = getRank(totalVol)
  const progress = getRankProgress(totalVol)
  const nextTier = getNextTier(totalVol)
  const streak = useMemo(() => calcStreak(sessions), [sessions])
  const achievements = useMemo(() => getAchievements(sessions, prs, streak.best), [sessions, prs, streak.best])
  const earnedCount = achievements.filter(a => a.earned).length

  const saveProfile = async () => {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const updated = await updateProfile(profile.id, {
        name: form.name, username: form.username?.toLowerCase(),
        goal: form.goal, target_calories: +form.target_calories,
        target_protein: +form.target_protein,
        target_carbs: form.target_carbs ? +form.target_carbs : null,
        target_fat: form.target_fat ? +form.target_fat : null,
        accent_color: form.accent_color,
      })
      if (mounted.current) { setProfile(updated); setEditing(false) }
    } catch (e) { if (mounted.current) setError(e.message) }
    if (mounted.current) setSaving(false)
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--accent-low)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
            {profile?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{profile?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>@{profile?.username}</div>
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 10, letterSpacing: '1.5px', fontFamily: 'var(--mono)', fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: profile?.goal === 'bulk' ? 'var(--accent-low)' : profile?.goal === 'cut' ? 'rgba(74,158,181,0.1)' : 'rgba(74,154,74,0.1)', color: profile?.goal === 'bulk' ? 'var(--accent)' : profile?.goal === 'cut' ? '#4a9eb5' : '#4a9a4a' }}>
                {profile?.goal?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Overall Rank */}
        <div style={{ background: 'var(--bg3)', border: `1px solid ${overallRank.color}`, borderRadius: 'var(--radius)', padding: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>OVERALL RANK</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: overallRank.color, letterSpacing: '1px', fontFamily: 'var(--mono)' }}>{overallRank.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{Math.round(totalVol).toLocaleString()} lbs</div>
              {nextTier && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>→ {nextTier.name}</div>}
            </div>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: overallRank.color, borderRadius: 3, transition: 'width 0.6s' }} />
          </div>
          {nextTier && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--mono)' }}>{progress}% to {nextTier.name} ({Math.round(nextTier.min - totalVol).toLocaleString()} lbs to go)</div>}
        </div>

        {/* Streak row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px 0' }}>
          <span style={{ fontSize: 13, color: streak.current > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
            {streak.current > 0 ? `🔥 ${streak.current} day streak` : '💤 No active streak'}
          </span>
          {streak.best > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>Best: {streak.best}</span>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '16px 20px 0' }}>
        {[['SESSIONS', sessions.length], ['PRs SET', prs.length], ['TOTAL VOL', `${Math.round(totalVol / 1000)}k`]].map(([l, v]) => (
          <div key={l} className="card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{v}</div>
            <div className="label" style={{ marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '16px 20px 0', borderBottom: '1px solid var(--border)', marginTop: 8 }}>
        {['overview', 'prs', 'settings'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, color: tab === t ? 'var(--accent)' : 'var(--text-muted)', padding: '10px 0', fontSize: '9px', letterSpacing: '3px', fontFamily: 'var(--mono)', fontWeight: 600, textTransform: 'uppercase' }}>
            {t === 'overview' ? `OVERVIEW${earnedCount > 0 ? ` (${earnedCount})` : ''}` : t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div className="label" style={{ marginBottom: 10 }}>MUSCLE RANKS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
              {MUSCLE_GROUPS.map(g => {
                const vol = volumes[g] || 0
                const rank = getRank(vol)
                const prog = getRankProgress(vol)
                return (
                  <div key={g} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{g}</span>
                      <span style={{ fontSize: '7px', letterSpacing: '1.5px', fontFamily: 'var(--mono)', color: rank.color, fontWeight: 700 }}>{rank.name}</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${prog}%`, background: rank.color, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--mono)' }}>{Math.round(vol).toLocaleString()} lbs</div>
                  </div>
                )
              })}
            </div>

            {/* Achievements */}
            <div className="label" style={{ marginBottom: 10 }}>ACHIEVEMENTS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {achievements.filter(a => a.earned).map(a => (
                <div key={a.id} className="card" style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{a.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 1 }}>{a.desc}</div>
                  </div>
                </div>
              ))}
              {achievements.filter(a => !a.earned).map(a => (
                <div key={a.id} style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', opacity: 0.3, background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 22, filter: 'grayscale(1)' }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{a.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 1 }}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRs */}
        {tab === 'prs' && (
          <div>
            {prs.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No PRs yet</div>}
            {MUSCLE_GROUPS.map(g => {
              const gPRs = prs.filter(p => p.muscle_group === g)
              if (!gPRs.length) return null
              return (
                <div key={g} style={{ marginBottom: 20 }}>
                  <div className="label" style={{ color: 'var(--accent)', marginBottom: 8 }}>{g.toUpperCase()}</div>
                  {gPRs.map(pr => (
                    <div key={pr.id} className="card" style={{ padding: 14, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{pr.exercise}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{pr.weight}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{pr.reps} reps · lbs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && (
          <div>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="NAME"><input style={INP} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
                <Field label="USERNAME"><input style={INP} value={form.username || ''} onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/\s/g, '') }))} /></Field>
                <Field label="GOAL">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {GOALS.map(g => <ToggleBtn key={g} active={form.goal === g} onClick={() => setForm(f => ({ ...f, goal: g }))}>{g}</ToggleBtn>)}
                  </div>
                </Field>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Field label="CALORIES" style={{ flex: 1 }}><input style={INP} type="number" value={form.target_calories || ''} onChange={e => setForm(f => ({ ...f, target_calories: e.target.value }))} /></Field>
                  <Field label="PROTEIN (g)" style={{ flex: 1 }}><input style={INP} type="number" value={form.target_protein || ''} onChange={e => setForm(f => ({ ...f, target_protein: e.target.value }))} /></Field>
                </div>
                <div style={{ display:'flex', gap:12 }}>
                  <Field label="CARBS (g)" style={{ flex:1 }}><input style={INP} type="number" value={form.target_carbs||''} onChange={e=>setForm(f=>({...f,target_carbs:e.target.value}))} /></Field>
                  <Field label="FAT (g)" style={{ flex:1 }}><input style={INP} type="number" value={form.target_fat||''} onChange={e=>setForm(f=>({...f,target_fat:e.target.value}))} /></Field>
                </div>
                <Field label="ACCENT COLOR">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ACCENTS.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, accent_color: c }))} style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: `2px solid ${form.accent_color === c ? '#fff' : 'transparent'}`, boxShadow: form.accent_color === c ? `0 0 0 2px ${c}` : '' }} />)}
                  </div>
                </Field>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setEditing(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Cancel</button>
                  <button onClick={saveProfile} disabled={saving} style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: 12, color: '#fff', fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? 'SAVING...' : 'SAVE'}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[['DAILY CALORIES', `${profile?.target_calories} kcal`], ['PROTEIN TARGET', `${profile?.target_protein}g`], ['WEIGHT UNIT', profile?.unit], ['MEMBER SINCE', profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—']].map(([l, v]) => (
                  <div key={l} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="label">{l}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <button onClick={() => setEditing(true)} style={{ marginTop: 8, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>EDIT PROFILE</button>
                <button onClick={toggleTheme} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, color: 'var(--text-dim)', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {theme === 'dark' ? '☀ LIGHT MODE' : '☾ DARK MODE'}
                </button>
                <button onClick={signOut} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, color: 'var(--text-dim)', fontWeight: 600, fontSize: 14 }}>SIGN OUT</button>
                {!showReset ? (
                  <button onClick={() => setShowReset(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Delete account data</button>
                ) : (
                  <div style={{ background: 'rgba(224,22,30,0.08)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>⚠ This will sign you out</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>To fully delete your data, contact support after signing out.</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowReset(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, color: 'var(--text-dim)', fontWeight: 600 }}>Cancel</button>
                      <button onClick={signOut} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: 10, color: '#fff', fontWeight: 700 }}>SIGN OUT</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, style }) {
  return <div style={style}><div className="label" style={{ marginBottom: 8 }}>{label}</div>{children}</div>
}

function ToggleBtn({ active, onClick, children }) {
  return <button onClick={onClick} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-low)' : 'var(--bg3)', color: active ? 'var(--accent)' : 'var(--text-dim)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</button>
}
