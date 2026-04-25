import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login') // login | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const handle = async () => {
    setLoading(true); setErr(null); setMsg(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Check your email to confirm your account.')
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMsg('Password reset email sent.')
      }
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const INP = { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', color:'var(--text)', padding:'14px 16px', fontSize:'16px', width:'100%', marginBottom:'12px' }

  return (
    <div className="page" style={{ height:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', justifyContent:'center', padding:'32px 24px', maxWidth:480, margin:'0 auto' }}>
      <div style={{ marginBottom:40 }}>
        <div style={{ fontSize:'10px', letterSpacing:'5px', color:'var(--accent)', marginBottom:8, fontFamily:'var(--mono)' }}>WELCOME TO</div>
        <h1 style={{ fontSize:56, fontWeight:900, letterSpacing:'-2px', lineHeight:1 }}>BodMax</h1>
        <p style={{ color:'var(--text-dim)', marginTop:10, fontSize:14 }}>
          {mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
        </p>
      </div>

      <input style={INP} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      {mode !== 'reset' && <input style={INP} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />}

      {err && <div style={{ color:'var(--accent)', fontSize:13, marginBottom:12, padding:'10px 14px', background:'var(--accent-low)', borderRadius:'var(--radius-sm)' }}>{err}</div>}
      {msg && <div style={{ color:'#4a9eb5', fontSize:13, marginBottom:12, padding:'10px 14px', background:'rgba(74,158,181,0.1)', borderRadius:'var(--radius-sm)' }}>{msg}</div>}

      <button onClick={handle} disabled={loading} style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', padding:16, fontSize:15, fontWeight:700, letterSpacing:'1px', marginBottom:16, opacity:loading?0.7:1 }}>
        {loading ? '...' : mode === 'login' ? 'SIGN IN' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SEND RESET EMAIL'}
      </button>

      <div style={{ display:'flex', justifyContent:'center', gap:24, fontSize:13 }}>
        {mode !== 'login' && <button onClick={() => setMode('login')} style={{ background:'none', border:'none', color:'var(--text-dim)' }}>Sign in</button>}
        {mode !== 'signup' && <button onClick={() => setMode('signup')} style={{ background:'none', border:'none', color:'var(--text-dim)' }}>Create account</button>}
        {mode !== 'reset' && <button onClick={() => setMode('reset')} style={{ background:'none', border:'none', color:'var(--text-muted)' }}>Forgot password</button>}
      </div>
    </div>
  )
}
