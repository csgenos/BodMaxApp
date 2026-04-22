import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '14px 16px', fontSize: '16px', width: '100%', marginBottom: '12px' }

export default function UpdatePassword() {
  const { clearRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)

  const handle = async () => {
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return }
    if (password !== confirm) { setErr('Passwords do not match'); return }
    setLoading(true); setErr(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      setTimeout(() => clearRecovery(), 1500)
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: '10px', letterSpacing: '5px', color: 'var(--accent)', marginBottom: 8, fontFamily: 'var(--mono)' }}>WELCOME TO</div>
        <h1 style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-2px', lineHeight: 1 }}>BodMax</h1>
        <p style={{ color: 'var(--text-dim)', marginTop: 10, fontSize: 14 }}>Choose a new password</p>
      </div>

      {done ? (
        <div style={{ color: '#4a9eb5', fontSize: 15, padding: '14px 16px', background: 'rgba(74,158,181,0.1)', borderRadius: 'var(--radius-sm)' }}>
          Password updated — signing you in...
        </div>
      ) : (
        <>
          <input style={INP} type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} />
          <input style={INP} type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} />
          {err && <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: 'var(--accent-low)', borderRadius: 'var(--radius-sm)' }}>{err}</div>}
          <button onClick={handle} disabled={loading} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: 16, fontSize: 15, fontWeight: 700, letterSpacing: '1px', opacity: loading ? 0.7 : 1 }}>
            {loading ? '...' : 'SET NEW PASSWORD'}
          </button>
        </>
      )}
    </div>
  )
}
