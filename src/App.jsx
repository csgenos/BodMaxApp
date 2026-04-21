import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Auth from './pages/Auth'
import Setup from './pages/Setup'
import Dashboard from './pages/Dashboard'
import Session from './pages/Session'
import Diet from './pages/Diet'
import Progress from './pages/Progress'
import Social from './pages/Social'
import Profile from './pages/Profile'

function Inner() {
  const { user, profile } = useAuth()

  if (user === undefined) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ width:32, height:32, border:'2px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!user) return <Auth />
  if (!profile) return <Setup />

  return (
    <BrowserRouter>
      <div style={{ maxWidth:480, margin:'0 auto', height:'100vh', display:'flex', flexDirection:'column', background:'var(--bg)' }}>
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', WebkitOverflowScrolling:'touch' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/session" element={<Session />} />
            <Route path="/diet" element={<Diet />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/social" element={<Social />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return <AuthProvider><Inner /></AuthProvider>
}
