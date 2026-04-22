import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { path:'/',         label:'HOME',     icon:'⊞' },
  { path:'/session',  label:'SESSION',  icon:'◈' },
  { path:'/diet',     label:'DIET',     icon:'◉' },
  { path:'/progress', label:'PROGRESS', icon:'▲' },
  { path:'/social',   label:'SOCIAL',   icon:'◎' },
  { path:'/profile',  label:'PROFILE',  icon:'○' },
]

export default function BottomNav() {
  const loc = useLocation()
  const nav = useNavigate()
  const { socialCounts } = useAuth()
  const socialBadge = (socialCounts?.requests || 0) + (socialCounts?.feed || 0)

  return (
    <div style={{ background:'var(--bg2)', borderTop:'1px solid var(--border)', display:'flex', flexShrink:0, paddingBottom:'env(safe-area-inset-bottom)' }}>
      {TABS.map(t => {
        const active = loc.pathname === t.path
        const badge = t.path === '/social' ? socialBadge : 0
        return (
          <button key={t.path} onClick={() => nav(t.path)} style={{ flex:1, background:'none', border:'none', padding:'14px 0 12px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', color:active?'var(--accent)':'var(--text-muted)', transition:'color 0.15s', minHeight:56, position:'relative' }}>
            <span style={{ position:'relative', lineHeight:1 }}>
              <span style={{ fontSize:'20px' }}>{t.icon}</span>
              {badge > 0 && (
                <span style={{ position:'absolute', top:-4, right:-8, background:'var(--accent)', color:'#fff', borderRadius:10, fontSize:9, fontWeight:700, minWidth:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', fontFamily:'var(--mono)', lineHeight:1 }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span style={{ fontSize:'9px', letterSpacing:'1px', fontFamily:'var(--mono)' }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
