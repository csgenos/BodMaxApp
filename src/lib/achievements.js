export const ACHIEVEMENTS = [
  { id: 'first_workout', icon: '💪', label: 'First Rep',      desc: 'Complete your first workout',    check: d => d.sessions >= 1 },
  { id: 'workouts_10',  icon: '🏃', label: 'Getting Started', desc: '10 workouts completed',           check: d => d.sessions >= 10 },
  { id: 'workouts_30',  icon: '📅', label: 'Dedicated',       desc: '30 workouts completed',           check: d => d.sessions >= 30 },
  { id: 'workouts_100', icon: '💯', label: 'Century Club',    desc: '100 workouts completed',          check: d => d.sessions >= 100 },
  { id: 'first_pr',     icon: '⚡', label: 'Personal Best',   desc: 'Set your first PR',               check: d => d.prs >= 1 },
  { id: 'prs_10',       icon: '🥇', label: 'PR Machine',      desc: '10 personal records set',         check: d => d.prs >= 10 },
  { id: 'streak_3',     icon: '🔥', label: '3-Day Streak',    desc: '3 consecutive workout days',      check: d => d.bestStreak >= 3 },
  { id: 'streak_7',     icon: '🔥', label: '7-Day Warrior',   desc: '7 consecutive workout days',      check: d => d.bestStreak >= 7 },
  { id: 'streak_30',    icon: '⚡', label: 'Unstoppable',     desc: '30 consecutive workout days',     check: d => d.bestStreak >= 30 },
]

export const getAchievements = (sessions, prs, bestStreak) =>
  ACHIEVEMENTS.map(a => ({ ...a, earned: a.check({ sessions: sessions.length, prs: prs.length, bestStreak }) }))
