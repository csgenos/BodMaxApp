import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, updateLastActive, getSocialNotifCounts } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [uiScale, setUiScaleState] = useState(() => parseFloat(localStorage.getItem('uiScale') || '1'))
  const [socialCounts, setSocialCounts] = useState({ requests: 0, feed: 0 })
  const loadingRef = useRef(false)

  const fetchSocialCounts = async (userId) => {
    try {
      if (!localStorage.getItem('lastFeedSeen')) localStorage.setItem('lastFeedSeen', new Date().toISOString())
      const counts = await getSocialNotifCounts(userId, localStorage.getItem('lastFeedSeen'))
      setSocialCounts(counts)
    } catch { /* non-fatal */ }
  }

  const loadProfile = async (userId) => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const p = await getProfile(userId)
      setProfile(p)
    } catch {
      setProfile(null)
    } finally {
      loadingRef.current = false
    }
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadProfile(u.id)
        updateLastActive(u.id)
        fetchSocialCounts(u.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovering(true)
        return
      }
      if (u) {
        loadProfile(u.id)
        if (event === 'SIGNED_IN') { updateLastActive(u.id); fetchSocialCounts(u.id) }
      } else {
        setProfile(null)
        setIsRecovering(false)
      }
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const color = profile?.accent_color || '#e0161e'
    document.documentElement.style.setProperty('--accent', color)
    const hex = color.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
    document.documentElement.style.setProperty('--accent-low', `rgba(${r},${g},${b},0.12)`)
  }, [profile?.accent_color])

  useEffect(() => {
    const el = document.documentElement
    const LIGHT = { '--bg':'#f2f2f2','--bg2':'#ffffff','--bg3':'#e8e8e8','--bg4':'#dedede','--border':'#d4d4d4','--border2':'#c8c8c8','--text':'#111111','--text-dim':'#555555','--text-muted':'#aaaaaa' }
    const DARK  = { '--bg':'#080808','--bg2':'#0e0e0e','--bg3':'#161616','--bg4':'#1c1c1c','--border':'#222','--border2':'#2a2a2a','--text':'#f0f0f0','--text-dim':'#888','--text-muted':'#444' }
    Object.entries(theme === 'light' ? LIGHT : DARK).forEach(([k, v]) => el.style.setProperty(k, v))
    el.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const clearRecovery = () => setIsRecovering(false)
  const setUiScale = (v) => { setUiScaleState(v); localStorage.setItem('uiScale', v) }
  const updateSocialCounts = (counts) => setSocialCounts(counts)
  const markFeedSeen = () => {
    localStorage.setItem('lastFeedSeen', new Date().toISOString())
    setSocialCounts(prev => ({ ...prev, feed: 0 }))
  }
  const markRequestsSeen = () => setSocialCounts(prev => ({ ...prev, requests: 0 }))

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, refreshProfile: () => user && loadProfile(user.id), signOut: () => supabase.auth.signOut(), isRecovering, clearRecovery, theme, toggleTheme, uiScale, setUiScale, socialCounts, updateSocialCounts, markFeedSeen, markRequestsSeen }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
