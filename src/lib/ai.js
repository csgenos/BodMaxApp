import { supabase } from './supabase'

async function callAI(action, data) {
  const { data: result, error } = await supabase.functions.invoke('ai-coach', {
    body: { action, data },
  })
  if (error) throw new Error(error.message || 'AI request failed')
  if (result?.error) throw new Error(result.error)
  return result
}

export async function generateWorkout(profile, sessions) {
  const muscleFreq = {}
  const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Glutes']
  MUSCLE_GROUPS.forEach(g => {
    const last = (sessions || []).find(s =>
      (s.exercises || []).some(ex => (ex.muscle_group || ex.muscleGroup) === g)
    )
    muscleFreq[g] = last
      ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000)
      : null
  })
  return callAI('workout', { profile, sessions: sessions?.slice(0, 10), muscleFreq })
}

export async function generateInsights(profile, sessions, todayNutrition, streak, weeklyStats) {
  return callAI('insights', { profile, sessions: sessions?.slice(0, 14), todayNutrition, streak, weeklyStats })
}

export async function chatWithCoach(profile, sessions, message, history = []) {
  return callAI('chat', { profile, sessions: sessions?.slice(0, 7), message, history })
}
