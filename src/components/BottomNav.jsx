import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const HomeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
)
const TrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6.5" cy="12" r="2.5" />
    <circle cx="17.5" cy="12" r="2.5" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="2" y1="12" x2="4" y2="12" />
    <line x1="20" y1="12" x2="22" y2="12" />
  </svg>
)
const FuelIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
)
const TrackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 17 8 11 13 14 21 6" />
    <polyline points="17 6 21 6 21 10" />
  </svg>
)
const ConnectIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3" />
    <path d="M3 21v-1a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v1" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M14 21v-0.5a4.5 4.5 0 0 1 4.5-4.5H17" />
  </svg>
)
const YouIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
  </svg>
)

const TABS = [
  { path: '/',         label: 'Home',    Icon: HomeIcon    },
  { path: '/session',  label: 'Train',   Icon: TrainIcon   },
  { path: '/diet',     label: 'Fuel',    Icon: FuelIcon    },
  { path: '/progress', label: 'Track',   Icon: TrackIcon   },
  { path: '/social',   label: 'Connect', Icon: ConnectIcon },
  { path: '/profile',  label: 'You',     Icon: YouIcon     },
]

export default function BottomNav() {
  const loc = useLocation()
  const nav = useNavigate()
  const { socialCounts } = useAuth()
  const socialBadge = (socialCounts?.requests || 0) + (socialCounts?.feed || 0)

  return (
    <div style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)', transition: 'background-color 0.25s ease, border-color 0.25s ease' }}>
      {TABS.map(({ path, label, Icon }) => {
        const active = loc.pathname === path
        const badge = path === '/social' ? socialBadge : 0
        return (
          <button
            key={path}
            onClick={() => nav(path)}
            style={{ flex: 1, background: 'none', border: 'none', padding: '12px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: active ? 'var(--accent)' : 'var(--text-dim)', transition: 'color 0.2s ease', minHeight: 62, position: 'relative' }}
          >
            <span style={{ position: 'relative', lineHeight: 1 }}>
              <span style={{ display: 'block', transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
                <Icon />
              </span>
              {badge > 0 && (
                <span style={{ position: 'absolute', top: -3, right: -6, background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontFamily: 'var(--mono)', lineHeight: 1 }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, opacity: active ? 1 : 0.55, transition: 'opacity 0.2s ease' }}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
