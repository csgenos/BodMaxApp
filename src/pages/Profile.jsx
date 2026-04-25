import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { getSessions, getPRs, updateProfile, addFeedback } from '../lib/db'
import { calcVolumes, getRank, getRankProgress, getNextTier, getTotalVolume, MUSCLE_GROUPS } from '../lib/ranks'
import { calcStreak } from '../lib/streaks'
import { getAchievements } from '../lib/achievements'
import { isAudioEnabled, setAudioEnabled } from '../lib/audio'
import { FlameIcon, ZzzIcon, SunIcon, MoonIcon, VolumeIcon, VolumeMuteIcon } from '../lib/icons'

const ACCENTS = ['#e0161e', '#e07016', '#e0c016', '#16c216', '#1680e0', '#8016e0', '#e016b4', '#f0f0f0']
const GOALS = ['bulk', 'cut', 'maintain']
const ATHLETE_TYPES = ['Bodybuilder', 'Powerlifter', 'Calisthenics', 'CrossFit', 'Olympic Lifting', 'Strongman', 'General Fitness', 'Athlete']
const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, width: '100%' }

export default function Profile() {
  const { profile, setProfile, signOut, theme, toggleTheme, uiScale, setUiScale } = useAuth()
  const unit = profile?.unit || 'lbs'
  const [sessions, setSessions] = useState([])
  const [prs, setPRs] = useState([])
  const [volumes, setVolumes] = useState({})
  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [error, setError] = useState(null)
  const [audioOn, setAudioOn] = useState(() => isAudioEnabled())
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
  const achievements = useMemo(() => getAchievements(sessions, prs, streak.best, { beta: profile?.beta }), [sessions, prs, streak.best, profile?.beta])
  const earnedCount = achievements.filter(a => a.earned).length

  const applyAccent = (c) => {
    if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) return
    document.documentElement.style.setProperty('--accent', c)
    const hex = c.slice(1)
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
    document.documentElement.style.setProperty('--accent-low', `rgba(${r},${g},${b},0.12)`)
  }

  useEffect(() => {
    if (editing) applyAccent(form.accent_color)
    else applyAccent(profile?.accent_color)
  }, [editing, form.accent_color, profile?.accent_color])

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
        athlete_type: form.athlete_type || null,
        accent_color: form.accent_color,
        unit: form.unit || 'lbs',
        weight: form.weight ? +form.weight : null,
      })
      if (mounted.current) { setProfile(updated); setEditing(false) }
    } catch (e) { if (mounted.current) setError(e.message) }
    if (mounted.current) setSaving(false)
  }

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      {/* Hero header card */}
      <div style={{ margin: 'var(--page-top) 20px 0', background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff' }}>
            {profile?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{profile?.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>@{profile?.username}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                Goal: {profile?.goal ? profile.goal.charAt(0).toUpperCase() + profile.goal.slice(1) : '—'}
              </span>
              {profile?.beta && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.9)', color: 'var(--accent)', letterSpacing: '0.5px' }}>
                  BETA
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rank + XP bar */}
        <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{overallRank.name} Rank</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {Math.round(totalVol).toLocaleString()} / {nextTier ? Math.round(nextTier.min).toLocaleString() : '∞'} XP
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#fff', borderRadius: 4, transition: 'width 0.6s' }} />
          </div>
          {nextTier && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 5 }}>{Math.round(nextTier.min - totalVol).toLocaleString()} XP to {nextTier.name}</div>}
        </div>

        {/* Streak */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff' }}>{streak.current > 0 ? <FlameIcon size={18} /> : <ZzzIcon size={18} />}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            {streak.current > 0 ? `${streak.current} Day Streak` : 'No active streak'}
          </span>
          {streak.best > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 'auto' }}>Best: {streak.best}</span>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '16px 20px 0' }}>
        {[['Sessions', sessions.length], ['PRs', prs.length], ['Volume', totalVol >= 1000000 ? `${(totalVol/1000000).toFixed(1)}M` : `${Math.round(totalVol/1000)}k`]].map(([l, v]) => (
          <div key={l} className="card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 20px 0' }}>
        {[['overview','Overview'],['prs','PRs'],['settings','Settings']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, background: tab === key ? 'var(--accent)' : 'var(--bg3)', border: 'none', borderRadius: 100, padding: '10px 0', color: tab === key ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: tab === key ? 700 : 500 }}>
            {label}{key === 'overview' && earnedCount > 0 ? ` (${earnedCount})` : ''}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12, marginTop: 4 }}>Muscle Rankings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              {MUSCLE_GROUPS.map(g => {
                const vol = volumes[g] || 0
                const rank = getRank(vol)
                const prog = getRankProgress(vol)
                return (
                  <div key={g} className="card" style={{ padding: '14px 14px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{g}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: rank.color, background: `${rank.color}22`, padding: '2px 8px', borderRadius: 20 }}>{rank.name}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 5 }}>
                      <div style={{ height: '100%', width: `${prog}%`, background: rank.color, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{Math.round(vol).toLocaleString()} {unit}</div>
                  </div>
                )
              })}
            </div>

            {/* Achievements */}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12 }}>Achievements</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {achievements.filter(a => a.earned).map(a => (
                <div key={a.id} style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                  <span style={{ color: '#fff' }}>{a.Icon && <a.Icon size={24} />}</span>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{a.label}</div>
                </div>
              ))}
              {achievements.filter(a => !a.earned).map(a => (
                <div key={a.id} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', opacity: 0.4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{a.Icon && <a.Icon size={24} />}</span>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', lineHeight: 1.3 }}>{a.label}</div>
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
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{pr.reps} reps · {unit}</div>
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
                <Field label="ATHLETE TYPE">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ATHLETE_TYPES.map(t => <ToggleBtn key={t} active={form.athlete_type === t} onClick={() => setForm(f => ({ ...f, athlete_type: f.athlete_type === t ? null : t }))}>{t}</ToggleBtn>)}
                  </div>
                </Field>
                <Field label="WEIGHT UNIT">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['lbs', 'kg'].map(u => <ToggleBtn key={u} active={(form.unit || 'lbs') === u} onClick={() => setForm(f => ({ ...f, unit: u }))}>{u}</ToggleBtn>)}
                  </div>
                </Field>
                <Field label={`BODY WEIGHT (${form.unit || 'lbs'})`}><input style={INP} type="number" inputMode="decimal" placeholder={form.unit === 'kg' ? '75' : '165'} value={form.weight || ''} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} /></Field>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Field label="CALORIES" style={{ flex: 1 }}><input style={INP} type="number" value={form.target_calories || ''} onChange={e => setForm(f => ({ ...f, target_calories: e.target.value }))} /></Field>
                  <Field label="PROTEIN (g)" style={{ flex: 1 }}><input style={INP} type="number" value={form.target_protein || ''} onChange={e => setForm(f => ({ ...f, target_protein: e.target.value }))} /></Field>
                </div>
                <div style={{ display:'flex', gap:12 }}>
                  <Field label="CARBS (g)" style={{ flex:1 }}><input style={INP} type="number" value={form.target_carbs||''} onChange={e=>setForm(f=>({...f,target_carbs:e.target.value}))} /></Field>
                  <Field label="FAT (g)" style={{ flex:1 }}><input style={INP} type="number" value={form.target_fat||''} onChange={e=>setForm(f=>({...f,target_fat:e.target.value}))} /></Field>
                </div>
                <Field label="ACCENT COLOR">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {ACCENTS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, accent_color: c }))} style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: `2px solid ${form.accent_color === c ? '#fff' : 'transparent'}`, boxShadow: form.accent_color === c ? `0 0 0 2px ${c}` : 'none', flexShrink: 0 }} />
                    ))}
                    {/* Custom colour — rainbow swatch opens native picker */}
                    <label title="Custom colour" style={{ width: 36, height: 36, borderRadius: '50%', background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', border: `2px solid ${!ACCENTS.includes(form.accent_color) ? '#fff' : 'transparent'}`, boxShadow: !ACCENTS.includes(form.accent_color) ? `0 0 0 2px ${form.accent_color}` : 'none', cursor: 'pointer', flexShrink: 0, position: 'relative' }}>
                      <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.accent_color||'') ? form.accent_color : '#e0161e'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: /^#[0-9a-fA-F]{6}$/.test(form.accent_color||'') ? form.accent_color : 'var(--border)', flexShrink: 0, border: '2px solid var(--border)' }} />
                    <input
                      type="text"
                      value={form.accent_color || ''}
                      onChange={e => {
                        const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value
                        setForm(f => ({ ...f, accent_color: v }))
                      }}
                      placeholder="#e0161e"
                      maxLength={7}
                      style={{ ...INP, fontFamily: 'var(--mono)', fontSize: 13, flex: 1, padding: '8px 12px' }}
                    />
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
                <div className="card" style={{ padding: '12px 14px', marginTop: 8 }}>
                  <div className="label" style={{ marginBottom: 10 }}>TEXT SIZE</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: 1, label: 'Default' }, { v: 1.15, label: 'Large' }, { v: 1.3, label: 'X-Large' }].map(({ v, label }) => (
                      <button key={v} onClick={() => setUiScale(v)} style={{ flex: 1, padding: '10px 4px', borderRadius: 'var(--radius-sm)', border: `1px solid ${uiScale === v ? 'var(--accent)' : 'var(--border)'}`, background: uiScale === v ? 'var(--accent-low)' : 'var(--bg3)', color: uiScale === v ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 700, fontSize: 11, letterSpacing: '0.5px' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">APPEARANCE</span>
                  <button onClick={toggleTheme} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 14px', color: 'var(--text)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {theme === 'dark' ? <><SunIcon size={14} /> LIGHT</> : <><MoonIcon size={14} /> DARK</>}
                  </button>
                </div>
                <div className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label">AUDIO CUES</span>
                  <button onClick={() => { const next = !audioOn; setAudioEnabled(next); setAudioOn(next) }} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 14px', color: audioOn ? 'var(--accent)' : 'var(--text-dim)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {audioOn ? <><VolumeIcon size={14} /> ON</> : <><VolumeMuteIcon size={14} /> OFF</>}
                  </button>
                </div>
                <button onClick={() => setEditing(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>EDIT PROFILE</button>
                <button onClick={() => setShowFeedback(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>SEND FEEDBACK</button>
                <button onClick={signOut} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, color: 'var(--text-dim)', fontWeight: 600, fontSize: 14 }}>SIGN OUT</button>
                {!showReset ? (
                  <button onClick={() => setShowReset(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Delete account data</button>
                ) : (
                  <div style={{ background: 'rgba(224,22,30,0.08)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: 16 }}>
                    <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>Warning — this will sign you out</div>
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
      {showFeedback && <FeedbackModal userId={profile?.id} onClose={() => setShowFeedback(false)} />}
    </div>
  )
}

function FeedbackModal({ userId, onClose }) {
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!message.trim() || saving) return
    setSaving(true); setError(null)
    try {
      await addFeedback(userId, message.trim(), rating || null)
      setDone(true)
      setTimeout(onClose, 1800)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div style={{ background: 'var(--bg2)', borderRadius: '20px 20px 0 0', width: '100%', padding: '24px 20px 40px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Send Feedback</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22 }}>×</button>
        </div>
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 15, color: '#22c55e', fontWeight: 700 }}>Thanks — feedback received!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s === rating ? 0 : s)} style={{ background: 'none', border: 'none', fontSize: 28, opacity: s <= rating ? 1 : 0.3, transition: 'opacity 0.15s' }}>★</button>
              ))}
            </div>
            <textarea
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, resize: 'none', height: 110, fontFamily: 'inherit' }}
              placeholder="What's working? What's not? What would you love to see?"
              value={message}
              onChange={e => setMessage(e.target.value)}
              autoFocus
            />
            {error && <div style={{ fontSize: 12, color: 'var(--accent)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, color: 'var(--text-dim)', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !message.trim()} style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: 14, color: '#fff', fontWeight: 700, fontSize: 14, opacity: (!message.trim() || saving) ? 0.6 : 1 }}>
                {saving ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
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
