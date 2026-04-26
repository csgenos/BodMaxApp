import { calcSessionVolume } from './ranks'
import {
  TargetIcon, MedalIcon, DumbbellIcon, FlameIcon, TrophyIcon, CrownIcon,
  BoltIcon, StarIcon, RocketIcon, ShieldIcon, BikeIcon, CalendarIcon, CheckIcon,
} from './icons'

export const ACHIEVEMENTS = [
  // Sessions
  { id: 'first_workout',  Icon: TargetIcon,    label: 'First Rep',        desc: 'Complete your first workout',              check: d => d.sessions >= 1 },
  { id: 'workouts_10',    Icon: MedalIcon,     label: 'Getting Started',  desc: '10 workouts completed',                    check: d => d.sessions >= 10 },
  { id: 'workouts_25',    Icon: DumbbellIcon,  label: 'Building Habit',   desc: '25 workouts completed',                    check: d => d.sessions >= 25 },
  { id: 'workouts_50',    Icon: FlameIcon,     label: 'On Fire',          desc: '50 workouts completed',                    check: d => d.sessions >= 50 },
  { id: 'workouts_100',   Icon: TrophyIcon,    label: 'Century Club',     desc: '100 workouts completed',                   check: d => d.sessions >= 100 },
  { id: 'workouts_250',   Icon: CrownIcon,     label: 'Elite',            desc: '250 workouts completed',                   check: d => d.sessions >= 250 },
  { id: 'workouts_500',   Icon: StarIcon,      label: 'Legend',           desc: '500 workouts completed',                   check: d => d.sessions >= 500 },
  { id: 'workouts_750',   Icon: RocketIcon,    label: 'Grinder',          desc: '750 workouts completed',                   check: d => d.sessions >= 750 },
  { id: 'workouts_1000',  Icon: CrownIcon,     label: 'Immortal',         desc: '1,000 workouts completed',                 check: d => d.sessions >= 1000 },
  // PRs
  { id: 'first_pr',       Icon: BoltIcon,      label: 'Personal Best',    desc: 'Set your first PR',                        check: d => d.prs >= 1 },
  { id: 'prs_10',         Icon: StarIcon,      label: 'PR Machine',       desc: '10 personal records',                      check: d => d.prs >= 10 },
  { id: 'prs_25',         Icon: RocketIcon,    label: 'Record Breaker',   desc: '25 personal records',                      check: d => d.prs >= 25 },
  { id: 'prs_50',         Icon: TrophyIcon,    label: 'PR Hunter',        desc: '50 personal records',                      check: d => d.prs >= 50 },
  // Streaks
  { id: 'streak_3',       Icon: FlameIcon,     label: '3-Day Streak',     desc: '3 days in a row',                          check: d => d.bestStreak >= 3 },
  { id: 'streak_7',       Icon: FlameIcon,     label: 'Week Warrior',     desc: '7 days in a row',                          check: d => d.bestStreak >= 7 },
  { id: 'streak_14',      Icon: BoltIcon,      label: 'Two Weeks',        desc: '14 days in a row',                         check: d => d.bestStreak >= 14 },
  { id: 'streak_30',      Icon: CrownIcon,     label: 'Unstoppable',      desc: '30 days in a row',                         check: d => d.bestStreak >= 30 },
  { id: 'streak_60',      Icon: StarIcon,      label: 'Iron Discipline',  desc: '60 days in a row',                         check: d => d.bestStreak >= 60 },
  { id: 'streak_100',     Icon: CrownIcon,     label: 'Centurion',        desc: '100 days in a row',                        check: d => d.bestStreak >= 100 },
  // Volume
  { id: 'vol_100k',       Icon: DumbbellIcon,  label: 'Heavy Lifter',     desc: 'Lift 100,000 lbs total',                   check: d => d.totalVol >= 100000 },
  { id: 'vol_500k',       Icon: RocketIcon,    label: 'Volume Monster',   desc: 'Lift 500,000 lbs total',                   check: d => d.totalVol >= 500000 },
  { id: 'vol_1m',         Icon: CrownIcon,     label: 'Million Club',     desc: 'Lift 1,000,000 lbs total',                 check: d => d.totalVol >= 1000000 },
  { id: 'vol_2m',         Icon: StarIcon,      label: 'Iron Giant',       desc: 'Lift 2,000,000 lbs total',                 check: d => d.totalVol >= 2000000 },
  { id: 'vol_5m',         Icon: CrownIcon,     label: 'Titan',            desc: 'Lift 5,000,000 lbs total',                 check: d => d.totalVol >= 5000000 },
  // Single-session feats
  { id: 'beast_session',  Icon: FlameIcon,     label: 'Beast Mode',       desc: '10,000 lbs lifted in a single session',    check: d => d.maxSessionVol >= 10000 },
  { id: 'marathon',       Icon: BoltIcon,      label: 'Iron Endurance',   desc: 'Complete a session over 2 hours',          check: d => d.maxDuration >= 7200 },
  // Variety & consistency
  { id: 'well_rounded',   Icon: CheckIcon,     label: 'Well Rounded',     desc: 'Train every major muscle group',           check: d => d.muscleGroups >= 6 },
  { id: 'perfect_week',   Icon: CalendarIcon,  label: 'Perfect Week',     desc: 'Train 5+ days in a single week',           check: d => d.bestWeek >= 5 },
  // Cardio
  { id: 'first_cardio',   Icon: BikeIcon,      label: 'Cardio Day',       desc: 'Complete your first cardio session',       check: d => d.cardioSessions >= 1 },
  { id: 'cardio_10',      Icon: BikeIcon,      label: 'Endurance',        desc: 'Log cardio in 10 sessions',                check: d => d.cardioSessions >= 10 },
  { id: 'cardio_50',      Icon: RocketIcon,    label: 'Cardio King',      desc: 'Log cardio in 50 sessions',                check: d => d.cardioSessions >= 50 },
  // Special
  { id: 'beta',           Icon: ShieldIcon,    label: 'Beta Tester',      desc: 'Early adopter — free subscription',        check: d => d.beta },
]

export const getAchievements = (sessions, prs, bestStreak, extra = {}) => {
  const totalVol = sessions.reduce((sum, s) => sum + calcSessionVolume(s), 0)
  const maxSessionVol = sessions.reduce((max, s) => Math.max(max, calcSessionVolume(s)), 0)
  const maxDuration = sessions.reduce((max, s) => Math.max(max, s.duration || 0), 0)
  const cardioSessions = sessions.filter(s => (s.cardio || []).length > 0).length
  const muscleGroups = new Set(
    sessions.flatMap(s => (s.exercises || []).map(e => e.muscle_group || e.muscleGroup))
  ).size

  const weekMap = {}
  sessions.forEach(s => {
    const d = new Date(s.date)
    const sunday = new Date(d); sunday.setDate(d.getDate() - d.getDay())
    const weekKey = sunday.toISOString().split('T')[0]
    const dayKey = d.toISOString().split('T')[0]
    if (!weekMap[weekKey]) weekMap[weekKey] = new Set()
    weekMap[weekKey].add(dayKey)
  })
  const bestWeek = Math.max(0, ...Object.values(weekMap).map(s => s.size))

  const data = {
    sessions: sessions.length, prs: prs.length, bestStreak, totalVol,
    maxSessionVol, maxDuration, cardioSessions, muscleGroups, bestWeek,
    beta: extra.beta || false,
  }
  return ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(data) }))
}
