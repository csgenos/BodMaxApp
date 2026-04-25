import { lazy, Suspense, Component, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import BottomNav from './components/BottomNav'
import Auth from './pages/Auth'
import Setup from './pages/Setup'
import UpdatePassword from './pages/UpdatePassword'
import LegalModal from './components/LegalModal'
import { updateProfile } from './lib/db'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Session = lazy(() => import('./pages/Session'))
const Diet = lazy(() => import('./pages/Diet'))
const Progress = lazy(() => import('./pages/Progress'))
const Social = lazy(() => import('./pages/Social'))
const Profile = lazy(() => import('./pages/Profile'))

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Something went wrong on this page.</div>
        <button onClick={() => this.setState({ error: null })} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: 13 }}>Retry</button>
      </div>
    )
    return this.props.children
  }
}

function PageLoader() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function TermsAcceptModal({ userId, onAccepted }) {
  const [legalDoc, setLegalDoc] = useState(null)
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAccept = async () => {
    if (!checked || saving) return
    setSaving(true)
    try {
      await updateProfile(userId, { terms_accepted_at: new Date().toISOString() })
      onAccepted()
    } catch {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg2)', borderRadius: '20px 20px 0 0', padding: '28px 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px', color: 'var(--accent)', marginBottom: 6 }}>BodMax</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Before you continue</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              We've updated our Terms of Service and Privacy Policy. Please review them and confirm you agree before using the app.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setLegalDoc('terms')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 16px', color: 'var(--text)', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Terms of Service <span style={{ color: 'var(--accent)', fontSize: 16 }}>›</span>
            </button>
            <button onClick={() => setLegalDoc('privacy')} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '13px 16px', color: 'var(--text)', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Privacy Policy <span style={{ color: 'var(--accent)', fontSize: 16 }}>›</span>
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              I am at least 13 years old and I agree to the{' '}
              <button onClick={() => setLegalDoc('terms')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</button>
              {' '}and{' '}
              <button onClick={() => setLegalDoc('privacy')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>Privacy Policy</button>.
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!checked || saving}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: '15px 0', color: '#fff', fontWeight: 800, fontSize: 15, opacity: (!checked || saving) ? 0.45 : 1, transition: 'opacity 0.2s' }}
          >
            {saving ? 'Saving...' : 'I Agree & Continue'}
          </button>
        </div>
      </div>
      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}
    </>
  )
}

function Inner() {
  const { user, profile, setProfile, isRecovering, uiScale } = useAuth()

  if (user === undefined) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (isRecovering) return <UpdatePassword />
  if (!user) return <Auth />
  if (!profile) return <Setup />

  if (!profile.terms_accepted_at) {
    return (
      <TermsAcceptModal
        userId={user.id}
        onAccepted={() => setProfile(p => ({ ...p, terms_accepted_at: new Date().toISOString() }))}
      />
    )
  }

  return (
    <BrowserRouter>
      <div style={{ maxWidth: 480, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ zoom: uiScale }}>
          <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/session" element={<Session />} />
              <Route path="/diet" element={<Diet />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/social" element={<Social />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </ErrorBoundary>
          </Suspense>
          </div>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return <ThemeProvider><AuthProvider><Inner /></AuthProvider></ThemeProvider>
}
