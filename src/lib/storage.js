const K = {
  PROFILE: 'bm_profile', SESSIONS: 'bm_sessions',
  DIET: 'bm_diet', WEIGHT: 'bm_weight', PRS: 'bm_prs',
}
const get = (key, fb = null) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb } catch { return fb }
}
const set = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

// Profile
export const getProfile = () => get(K.PROFILE)
export const saveProfile = (p) => set(K.PROFILE, p)

// Sessions
export const getSessions = () => get(K.SESSIONS, [])
export const addSession = (s) => { const arr = getSessions(); arr.unshift(s); set(K.SESSIONS, arr) }

// Diet (keyed by date string YYYY-MM-DD)
export const getDietByDate = (date) => { const all = get(K.DIET, {}); return all[date] || [] }
export const addDietEntry = (date, entry) => {
  const all = get(K.DIET, {})
  if (!all[date]) all[date] = []
  all[date].unshift(entry)
  set(K.DIET, all)
}
export const deleteDietEntry = (date, id) => {
  const all = get(K.DIET, {})
  if (all[date]) { all[date] = all[date].filter(e => e.id !== id); set(K.DIET, all) }
}

// Weight
export const getWeightLog = () => get(K.WEIGHT, [])
export const addWeight = (entry) => {
  const arr = [...getWeightLog(), entry]
  arr.sort((a, b) => new Date(a.date) - new Date(b.date))
  set(K.WEIGHT, arr)
}

// PRs — auto-updates if new weight is higher
export const getPRs = () => get(K.PRS, [])
export const checkAndUpdatePR = (exercise, muscleGroup, weight, reps, date) => {
  const prs = getPRs()
  const i = prs.findIndex(p => p.exercise === exercise)
  const isNew = i < 0
  const isBetter = !isNew && (+weight > prs[i].weight || (+weight === prs[i].weight && +reps > prs[i].reps))
  if (isNew || isBetter) {
    const entry = { exercise, muscleGroup, weight: +weight, reps: +reps, date }
    if (isNew) prs.push(entry); else prs[i] = entry
    set(K.PRS, prs)
    return true
  }
  return false
}
