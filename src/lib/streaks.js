// freezeDates: array of ISO date strings like ['2026-04-25'] treated as workout days
export function calcStreak(sessions, freezeDates = []) {
  const allDates = [
    ...sessions.map(s => (s.date || '').split('T')[0]),
    ...freezeDates,
  ].filter(Boolean)

  if (!allDates.length) return { current: 0, best: 0 }

  const dateSet = new Set(allDates)
  const dates = [...dateSet].sort()

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const yd = new Date(today); yd.setDate(yd.getDate() - 1)
  const ydStr = yd.toISOString().split('T')[0]

  let current = 0
  if (dateSet.has(todayStr) || dateSet.has(ydStr)) {
    const start = new Date(dateSet.has(todayStr) ? today : yd)
    while (dateSet.has(start.toISOString().split('T')[0])) {
      current++
      start.setDate(start.getDate() - 1)
    }
  }

  let best = current, run = 1
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000)
    if (diff === 1) { run++; if (run > best) best = run }
    else run = 1
  }
  if (run > best) best = run

  return { current, best }
}

export function sessionsThisWeek(sessions) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7); cutoff.setHours(0, 0, 0, 0)
  return sessions.filter(s => new Date(s.date) >= cutoff).length
}

export function sessionsLastWeek(sessions) {
  const w1 = new Date(); w1.setDate(w1.getDate() - 7); w1.setHours(0, 0, 0, 0)
  const w2 = new Date(); w2.setDate(w2.getDate() - 14); w2.setHours(0, 0, 0, 0)
  return sessions.filter(s => { const d = new Date(s.date); return d >= w2 && d < w1 }).length
}

export function weeklyVolume(sessions, weeksAgo = 0) {
  const end = new Date(); end.setDate(end.getDate() - weeksAgo * 7); end.setHours(23, 59, 59, 999)
  const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0)
  return sessions
    .filter(s => { const d = new Date(s.date); return d >= start && d <= end })
    .reduce((sum, s) => sum + (s.exercises || []).reduce((es, ex) =>
      es + (ex.sets || []).reduce((ss, set) => ss + ((+set.weight || 0) * (+set.reps || 0)), 0), 0), 0)
}

// Returns the ISO week string (YYYY-Www) for a date, used to enforce once-per-week freeze
export function isoWeek(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

// True if the user can use a freeze right now:
//   - Has an active streak
//   - Has NOT logged a session today
//   - Has NOT used a freeze this ISO week
export function canUseFreeze(sessions, freezeDates = []) {
  const todayStr = new Date().toISOString().split('T')[0]
  const hasSessionToday = sessions.some(s => s.date?.split('T')[0] === todayStr)
  if (hasSessionToday) return false

  const { current } = calcStreak(sessions, freezeDates)
  if (current === 0) return false

  const currentWeek = isoWeek()
  const usedThisWeek = freezeDates.some(d => isoWeek(new Date(d)) === currentWeek)
  return !usedThisWeek
}
