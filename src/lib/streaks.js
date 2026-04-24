export function calcStreak(sessions) {
  if (!sessions.length) return { current: 0, best: 0 }
  const dates = [...new Set(sessions.map(s => (s.date || '').split('T')[0]).filter(Boolean))].sort()
  const dateSet = new Set(dates)

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
