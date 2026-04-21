import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(null)

  const loadProfile = async (userId) => {
    try { setProfile(await getProfile(userId)) }
    catch { setProfile(null) }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setUser(null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
      else { setUser(null); setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const color = profile?.accent_color || '#e0161e'
    document.documentElement.style.setProperty('--accent', color)
    // derive low-opacity version
    const hex = color.replace('#', '')
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16)
    document.documentElement.style.setProperty('--accent-low', `rgba(${r},${g},${b},0.12)`)
  }, [profile?.accent_color])

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, refreshProfile: () => user && loadProfile(user.id), signOut: () => supabase.auth.signOut() }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
