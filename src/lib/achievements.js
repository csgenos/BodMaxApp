import { calcSessionVolume } from './ranks'
import {
  TargetIcon, MedalIcon, DumbbellIcon, FlameIcon, TrophyIcon, CrownIcon,
  BoltIcon, StarIcon, RocketIcon, ShieldIcon,
} from './icons'

export const ACHIEVEMENTS = [
  // Sessions
  { id: 'first_workout', Icon: TargetIcon,   label: 'First Rep',       desc: 'Complete your first workout',        check: d => d.sessions >= 1 },
  { id: 'workouts_10',   Icon: MedalIcon,    label: 'Getting Started', desc: '10 workouts completed',              check: d => d.sessions >= 10 },
  { id: 'workouts_25',   Icon: DumbbellIcon, label: 'Building Habit',  desc: '25 workouts completed',              check: d => d.sessions >= 25 },
  { id: 'workouts_50',   Icon: FlameIcon,    label: 'On Fire',         desc: '50 workouts completed',              check: d => d.sessions >= 50 },
  { id: 'workouts_100',  Icon: TrophyIcon,   label: 'Century Club',    desc: '100 workouts completed',             check: d => d.sessions >= 100 },
  { id: 'workouts_250',  Icon: CrownIcon,    label: 'Elite',           desc: '250 workouts completed',             check: d => d.sessions >= 250 },
  { id: 'workouts_500',  Icon: StarIcon,     label: 'Legend',          desc: '500 workouts completed',             check: d => d.sessions >= 500 },
  // PRs
  { id: 'first_pr',      Icon: BoltIcon,     label: 'Personal Best',   desc: 'Set your first PR',                  check: d => d.prs >= 1 },
  { id: 'prs_10',        Icon: StarIcon,     label: 'PR Machine',      desc: '10 personal records',                check: d => d.prs >= 10 },
  { id: 'prs_25',        Icon: RocketIcon,   label: 'Record Breaker',  desc: '25 personal records',                check: d => d.prs >= 25 },
  // Streaks
  { id: 'streak_3',      Icon: FlameIcon,    label: '3-Day Streak',    desc: '3 days in a row',                    check: d => d.bestStreak >= 3 },
  { id: 'streak_7',      Icon: FlameIcon,    label: 'Week Warrior',    desc: '7 days in a row',                    check: d => d.bestStreak >= 7 },
  { id: 'streak_14',     Icon: BoltIcon,     label: 'Two Weeks',       desc: '14 days in a row',                   check: d => d.bestStreak >= 14 },
  { id: 'streak_30',     Icon: CrownIcon,    label: 'Unstoppable',     desc: '30 days in a row',                   check: d => d.bestStreak >= 30 },
  // Volume
  { id: 'vol_100k',      Icon: DumbbellIcon, label: 'Heavy Lifter',    desc: 'Lift 100,000 lbs total',             check: d => d.totalVol >= 100000 },
  { id: 'vol_500k',      Icon: RocketIcon,   label: 'Volume Monster',  desc: 'Lift 500,000 lbs total',             check: d => d.totalVol >= 500000 },
  { id: 'vol_1m',        Icon: CrownIcon,    label: 'Million Club',    desc: 'Lift 1,000,000 lbs total',           check: d => d.totalVol >= 1000000 },
  // Special
  { id: 'beta',          Icon: ShieldIcon,   label: 'Beta Tester',     desc: 'Early adopter — free subscription',  check: d => d.beta },
]

export const getAchievements = (sessions, prs, bestStreak, extra = {}) => {
  const totalVol = sessions.reduce((sum, s) => sum + calcSessionVolume(s), 0)
  const data = { sessions: sessions.length, prs: prs.length, bestStreak, totalVol, beta: extra.beta || false }
  return ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(data) }))
}
