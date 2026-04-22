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
    <div style={{ background:'var(--bg2)', borderTop:'1px solid var(--border)', display:'flex', flexShrink:0, paddingBottom:'env(safe-area-inset-bottom)', transition:'background-color 0.25s ease, border-color 0.25s ease' }}>
      {TABS.map(t => {
        const active = loc.pathname === t.path
        return (
          <button key={t.path} onClick={() => nav(t.path)} style={{ flex:1, background:'none', border:'none', padding:'10px 0 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', color:active?'var(--accent)':'var(--text-muted)', transition:'color 0.2s ease', position:'relative' }}>
            <span style={{ fontSize:'16px', lineHeight:1, display:'block', transform:active?'scale(1.22)':'scale(1)', transition:'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>{t.icon}</span>
            <span style={{ fontSize:'7px', letterSpacing:'1px', fontFamily:'var(--mono)', opacity:active?1:0.55, transition:'opacity 0.2s ease' }}>{t.label}</span>
            <div style={{ position:'absolute', bottom:0, left:'50%', width:18, height:2, borderRadius:1, background:'var(--accent)', transform:`translateX(-50%) scaleX(${active?1:0})`, transition:'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)', transformOrigin:'center' }} />
          </button>
        )
      })}
    </div>
  )
}
