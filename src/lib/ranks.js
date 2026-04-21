export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Glutes']

export const EXERCISES = {
  Chest: ['Bench Press', 'Incline Bench Press', 'Decline Bench Press', 'Cable Fly', 'Dumbbell Fly', 'Chest Dips', 'Push-ups'],
  Back: ['Deadlift', 'Pull-ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'T-Bar Row', 'Single Arm Row'],
  Shoulders: ['Overhead Press', 'Dumbbell OHP', 'Lateral Raises', 'Front Raises', 'Arnold Press', 'Face Pulls', 'Rear Delt Fly'],
  Biceps: ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Incline Curl', 'Cable Curl'],
  Triceps: ['Skull Crushers', 'Tricep Pushdown', 'Close-Grip Bench', 'Overhead Tricep Extension', 'Tricep Dips', 'Cable Kickback'],
  Legs: ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunges', 'Leg Curl', 'Leg Extension', 'Calf Raises'],
  Core: ['Plank', 'Crunches', 'Leg Raises', 'Russian Twist', 'Cable Crunch', 'Ab Wheel Rollout', 'Hanging Leg Raise'],
  Glutes: ['Hip Thrust', 'Bulgarian Split Squat', 'Glute Bridge', 'Sumo Deadlift', 'Cable Kickback', 'Step-ups'],
}

export const CARDIO_TYPES = ['Running', 'Cycling', 'Rowing', 'Jump Rope', 'Stairmaster', 'Swimming', 'Elliptical', 'HIIT']

export const TIERS = [
  { name: 'UNRANKED',     min: 0,        color: '#555',    bg: 'rgba(85,85,85,0.15)' },
  { name: 'ROOKIE',       min: 500,      color: '#9B7B4A', bg: 'rgba(155,123,74,0.15)' },
  { name: 'BEGINNER',     min: 2500,     color: '#4A9A4A', bg: 'rgba(74,154,74,0.15)' },
  { name: 'NOVICE',       min: 10000,    color: '#4A8AAA', bg: 'rgba(74,138,170,0.15)' },
  { name: 'INTERMEDIATE', min: 30000,    color: '#8A5AC8', bg: 'rgba(138,90,200,0.15)' },
  { name: 'ADVANCED',     min: 100000,   color: '#D4A030', bg: 'rgba(212,160,48,0.15)' },
  { name: 'ELITE',        min: 250000,   color: '#E8202A', bg: 'rgba(232,32,42,0.15)' },
  { name: 'MASTER',       min: 600000,   color: '#F0F0F0', bg: 'rgba(240,240,240,0.15)' },
]

export const getRank = (vol) => {
  let r = TIERS[0]
  for (const t of TIERS) { if (vol >= t.min) r = t; else break }
  return r
}
export const getNextTier = (vol) => {
  for (const t of TIERS) { if (vol < t.min) return t }
  return null
}
export const getRankProgress = (vol) => {
  const cur = getRank(vol)
  const next = getNextTier(vol)
  if (!next) return 100
  return Math.min(100, Math.round(((vol - cur.min) / (next.min - cur.min)) * 100))
}
export const calcVolumes = (sessions) => {
  const vols = {}
  MUSCLE_GROUPS.forEach(g => vols[g] = 0)
  sessions.forEach(s => {
    ;(s.exercises || []).forEach(ex => {
      const group = ex.muscle_group || ex.muscleGroup
      if (!group || vols[group] === undefined) return
      const vol = (ex.sets || []).reduce((sum, set) => sum + ((+set.weight || 0) * (+set.reps || 0)), 0)
      vols[group] += vol
    })
  })
  return vols
}
export const getTotalVolume = (vols) => Object.values(vols).reduce((s, v) => s + v, 0)
export const calcSessionVolume = (session) =>
  (session.exercises || []).reduce((sum, ex) =>
    sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)
