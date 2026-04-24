import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createProfile } from '../lib/db'

const GOALS = ['bulk', 'cut', 'maintain']
const ACCENTS = ['#e0161e','#e07016','#e0c016','#16c216','#1680e0','#8016e0','#e016b4','#f0f0f0']

export default function Setup() {
  const { user, setProfile } = useAuth()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [goal, setGoal] = useState('bulk')
  const [calories, setCalories] = useState('2800')
  const [protein, setProtein] = useState('180')
  const [carbs, setCarbs] = useState('300')
  const [fat, setFat] = useState('80')
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState('lbs')
  const [accent, setAccent] = useState('#e0161e')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const handle = async () => {
    if (!name.trim() || !username.trim()) return
    setLoading(true); setErr(null)
    try {
      const p = await createProfile(user.id, {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        goal,
        target_calories: +calories,
        target_protein: +protein,
        target_carbs: carbs ? +carbs : null,
        target_fat: fat ? +fat : null,
        weight: weight ? +weight : null,
        unit,
        accent_color: accent,
      })
      setProfile(p)
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  const INP = { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'13px 16px', fontSize:'15px', width:'100%' }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'32px 24px', maxWidth:480, margin:'0 auto', overflowY:'auto' }}>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:'10px', letterSpacing:'5px', color:'var(--accent)', marginBottom:8, fontFamily:'var(--mono)' }}>SET UP YOUR</div>
        <h1 style={{ fontSize:44, fontWeight:900, letterSpacing:'-2px', lineHeight:1 }}>Profile</h1>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <Field label="DISPLAY NAME"><input style={INP} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="USERNAME"><input style={INP} placeholder="e.g. csgenos (shown to friends)" value={username} onChange={e => setUsername(e.target.value.replace(/\s/g,''))} /></Field>

        <Field label="GOAL">
          <div style={{ display:'flex', gap:8 }}>
            {GOALS.map(g => <ToggleBtn key={g} active={goal===g} onClick={() => setGoal(g)}>{g}</ToggleBtn>)}
          </div>
        </Field>

        <div style={{ display:'flex', gap:12 }}>
          <Field label="DAILY CALORIES" style={{ flex:1 }}><input style={INP} type="number" value={calories} onChange={e => setCalories(e.target.value)} /></Field>
          <Field label="PROTEIN (g)" style={{ flex:1 }}><input style={INP} type="number" value={protein} onChange={e => setProtein(e.target.value)} /></Field>
        </div>

        <div style={{ display:'flex', gap:12 }}>
          <Field label="CARBS (g)" style={{ flex:1 }}><input style={INP} type="number" value={carbs} onChange={e => setCarbs(e.target.value)} /></Field>
          <Field label="FAT (g)" style={{ flex:1 }}><input style={INP} type="number" value={fat} onChange={e => setFat(e.target.value)} /></Field>
        </div>

        <Field label="BODYWEIGHT (optional)">
          <div style={{ display:'flex', gap:8 }}>
            <input style={{ ...INP, flex:1 }} type="number" placeholder="e.g. 185" value={weight} onChange={e => setWeight(e.target.value)} />
            <ToggleBtn active={unit==='lbs'} onClick={() => setUnit('lbs')}>lbs</ToggleBtn>
            <ToggleBtn active={unit==='kg'} onClick={() => setUnit('kg')}>kg</ToggleBtn>
          </div>
        </Field>

        <Field label="ACCENT COLOR">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ACCENTS.map(c => (
              <button key={c} onClick={() => setAccent(c)} style={{ width:36, height:36, borderRadius:'50%', background:c, border:`2px solid ${accent===c?'#fff':'transparent'}`, boxShadow:accent===c?`0 0 0 2px ${c}`:'' }} />
            ))}
          </div>
        </Field>

        {err && <div style={{ color:'var(--accent)', fontSize:13, padding:'10px 14px', background:'var(--accent-low)', borderRadius:'var(--radius-sm)' }}>{err}</div>}

        <button onClick={handle} disabled={!name.trim() || !username.trim() || loading} style={{ marginTop:8, background:name.trim()&&username.trim()?'var(--accent)':'var(--border)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:16, fontSize:15, fontWeight:700, letterSpacing:'1px' }}>
          {loading ? 'SAVING...' : "LET'S GO →"}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize:'9px', letterSpacing:'3px', color:'var(--text-muted)', fontFamily:'var(--mono)', marginBottom:8 }}>{label}</div>
      {children}
    </div>
  )
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flex:1, padding:'12px 14px', borderRadius:'var(--radius-sm)', border:`1px solid ${active?'var(--accent)':'var(--border)'}`, background:active?'var(--accent-low)':'var(--bg3)', color:active?'var(--accent)':'var(--text-dim)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px' }}>
      {children}
    </button>
  )
}
