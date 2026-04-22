import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile, updateLastActive } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [uiScale, setUiScaleState] = useState(() => parseFloat(localStorage.getItem('uiScale') || '1'))
  const loadingRef = useRef(false)

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
        if (event === 'SIGNED_IN') updateLastActive(u.id)
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
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const clearRecovery = () => setIsRecovering(false)
  const setUiScale = (v) => { setUiScaleState(v); localStorage.setItem('uiScale', v) }

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, refreshProfile: () => user && loadProfile(user.id), signOut: () => supabase.auth.signOut(), isRecovering, clearRecovery, theme, toggleTheme, uiScale, setUiScale }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
