import { useLocation, useNavigate } from 'react-router-dom'

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
  return (
    <div style={{ background:'var(--bg2)', borderTop:'1px solid var(--border)', display:'flex', flexShrink:0, paddingBottom:'env(safe-area-inset-bottom)' }}>
      {TABS.map(t => {
        const active = loc.pathname === t.path
        return (
          <button key={t.path} onClick={() => nav(t.path)} style={{ flex:1, background:'none', border:'none', padding:'10px 0 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', color:active?'var(--accent)':'var(--text-muted)', transition:'color 0.15s' }}>
            <span style={{ fontSize:'16px', lineHeight:1 }}>{t.icon}</span>
            <span style={{ fontSize:'7px', letterSpacing:'1px', fontFamily:'var(--mono)' }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
