import { lazy, Suspense, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import BottomNav from './components/BottomNav'
import Auth from './pages/Auth'
import Setup from './pages/Setup'
import UpdatePassword from './pages/UpdatePassword'

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

function Inner() {
  const { user, profile, isRecovering, uiScale } = useAuth()

  if (user === undefined) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (isRecovering) return <UpdatePassword />
  if (!user) return <Auth />
  if (!profile) return <Setup />

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
