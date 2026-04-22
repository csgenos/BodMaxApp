export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Glutes']

export const EXERCISES = {
  Chest: [
    'Bench Press', 'Incline Bench Press', 'Decline Bench Press',
    'Dumbbell Bench Press', 'Incline Dumbbell Press', 'Decline Dumbbell Press',
    'Machine Chest Press', 'Smith Machine Bench Press', 'Hammer Strength Chest Press',
    'Pec Deck Machine', 'Cable Fly', 'Low-to-High Cable Fly', 'High-to-Low Cable Fly',
    'Dumbbell Fly', 'Incline Dumbbell Fly', 'Chest Dips', 'Assisted Dip Machine',
    'Push-ups', 'Deficit Push-ups', 'Svend Press', 'Landmine Press',
  ],
  Back: [
    'Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift', 'Rack Pulls',
    'Pull-ups', 'Chin-ups', 'Assisted Pull-up Machine',
    'Barbell Row', 'Pendlay Row', 'Yates Row', 'Smith Machine Row',
    'Lat Pulldown', 'Wide-Grip Lat Pulldown', 'Close-Grip Lat Pulldown',
    'Seated Cable Row', 'Wide-Grip Cable Row', 'T-Bar Row', 'Chest-Supported T-Bar Row',
    'Single Arm Dumbbell Row', 'Meadows Row', 'Hammer Strength Row',
    'Machine Row', 'Straight-Arm Pulldown', 'Shrugs', 'Dumbbell Shrugs',
    'Reverse Hyperextension', 'Good Mornings',
  ],
  Shoulders: [
    'Overhead Press', 'Dumbbell OHP', 'Seated Dumbbell Press', 'Arnold Press',
    'Smith Machine Shoulder Press', 'Machine Shoulder Press', 'Landmine Press',
    'Lateral Raises', 'Cable Lateral Raise', 'Machine Lateral Raise',
    'Front Raises', 'Cable Front Raise', 'Plate Front Raise',
    'Face Pulls', 'Reverse Pec Deck', 'Rear Delt Fly', 'Bent-Over Dumbbell Rear Delt Fly',
    'Upright Row', 'Cable Upright Row', 'High Pull',
  ],
  Biceps: [
    'Barbell Curl', 'EZ-Bar Curl', 'Dumbbell Curl', 'Alternating Dumbbell Curl',
    'Hammer Curl', 'Cross-Body Hammer Curl', 'Preacher Curl', 'Machine Preacher Curl',
    'Incline Dumbbell Curl', 'Spider Curl', 'Concentration Curl',
    'Cable Curl', 'Cable Rope Hammer Curl', 'Bayesian Cable Curl',
    'Zottman Curl', 'Reverse Curl', '21s',
  ],
  Triceps: [
    'Skull Crushers', 'EZ-Bar Skull Crushers', 'Dumbbell Skull Crushers',
    'Tricep Pushdown', 'Rope Pushdown', 'Single-Arm Cable Pushdown',
    'Close-Grip Bench Press', 'Close-Grip Smith Machine Press',
    'Overhead Tricep Extension', 'Cable Overhead Extension', 'Dumbbell Overhead Extension',
    'Tricep Dips', 'Bench Dips', 'Assisted Dip Machine',
    'Cable Kickback', 'Dumbbell Kickback', 'JM Press', 'Diamond Push-ups',
  ],
  Legs: [
    'Barbell Squat', 'High-Bar Squat', 'Low-Bar Squat', 'Front Squat',
    'Goblet Squat', 'Smith Machine Squat', 'Hack Squat Machine', 'Pendulum Squat',
    'Romanian Deadlift', 'Stiff-Leg Deadlift', 'Leg Press', 'Horizontal Leg Press',
    'Walking Lunges', 'Reverse Lunges', 'Dumbbell Lunges', 'Bulgarian Split Squat',
    'Leg Curl', 'Seated Leg Curl', 'Lying Leg Curl', 'Nordic Hamstring Curl',
    'Leg Extension', 'Single-Leg Extension',
    'Calf Raises', 'Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise',
    'Box Jumps', 'Belt Squat',
  ],
  Core: [
    'Plank', 'Side Plank', 'Crunches', 'Decline Crunches',
    'Leg Raises', 'Hanging Leg Raise', 'Captain\'s Chair Leg Raise',
    'Russian Twist', 'Weighted Russian Twist',
    'Cable Crunch', 'Kneeling Cable Crunch', 'Ab Wheel Rollout',
    'Ab Machine Crunch', 'Mountain Climbers', 'Dead Bug',
    'Pallof Press', 'Hollow Body Hold', 'Dragon Flags',
  ],
  Glutes: [
    'Hip Thrust', 'Barbell Hip Thrust', 'Machine Hip Thrust', 'Single-Leg Hip Thrust',
    'Bulgarian Split Squat', 'Glute Bridge', 'Single-Leg Glute Bridge',
    'Sumo Deadlift', 'Cable Kickback', 'Glute Kickback Machine',
    'Step-ups', 'Weighted Step-ups', 'Cable Pull-Through', 'Good Mornings',
    'Curtsy Lunge', 'Abduction Machine', 'Frog Pumps', 'Reverse Hyperextension',
  ],
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
