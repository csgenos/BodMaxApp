import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { acceptTerms } from '../lib/db'
import { TERMS_OF_SERVICE, PRIVACY_POLICY, APP_NAME } from '../lib/legal'

const DOC_STYLE = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  color: 'var(--text-dim)',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

export default function TermsAcceptance() {
  const { profile, setProfile, signOut } = useAuth()
  const [tab, setTab] = useState('tos')
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleAccept = async () => {
    if (!checked) return
    setSaving(true)
    setError(null)
    try {
      await acceptTerms()
      setProfile(p => ({ ...p, terms_accepted_at: new Date().toISOString() }))
    } catch (e) {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Welcome to {APP_NAME}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.4 }}>
          Before you get started, please read and accept our Terms of Service and Privacy Policy.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[['tos', 'Terms of Service'], ['pp', 'Privacy Policy']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: 'none',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === key ? 'var(--accent)' : 'var(--text-dim)',
              fontWeight: tab === key ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Document content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', WebkitOverflowScrolling: 'touch' }}>
        <p style={DOC_STYLE}>{tab === 'tos' ? TERMS_OF_SERVICE : PRIVACY_POLICY}</p>
      </div>

      {/* Accept section */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        {error && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 12 }}>
            {error}
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{ marginTop: 2, width: 18, height: 18, accentColor: 'var(--accent)', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            I have read and agree to the <strong style={{ color: 'var(--text)' }}>Terms of Service</strong> and <strong style={{ color: 'var(--text)' }}>Privacy Policy</strong>. I confirm that I am at least 13 years old.
          </span>
        </label>
        <button
          onClick={handleAccept}
          disabled={!checked || saving}
          style={{
            width: '100%',
            background: checked ? 'var(--accent)' : 'var(--bg3)',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: 15,
            color: checked ? '#fff' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: 15,
            opacity: saving ? 0.7 : 1,
            cursor: checked ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving...' : 'Accept & Continue'}
        </button>
        <button
          onClick={signOut}
          style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, padding: '10px 0 0', cursor: 'pointer' }}
        >
          Decline & Sign Out
        </button>
      </div>
    </div>
  )
}
