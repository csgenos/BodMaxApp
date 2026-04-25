// Supabase Edge Function — AI coaching features for BodMax
//
// Handles three actions:
//   workout  → personalized workout plan based on history + muscle frequency
//   insights → 2-3 daily coaching insights for the dashboard
//   chat     → free-form AI coach chat
//
// Required secrets:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Deploy:
//   supabase functions deploy ai-coach

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const VALID_EXERCISES: Record<string, string[]> = {
  Chest: ['Bench Press','Incline Bench Press','Decline Bench Press','Dumbbell Bench Press','Incline Dumbbell Press','Decline Dumbbell Press','Machine Chest Press','Smith Machine Bench Press','Hammer Strength Chest Press','Pec Deck Machine','Cable Fly','Low-to-High Cable Fly','High-to-Low Cable Fly','Dumbbell Fly','Incline Dumbbell Fly','Chest Dips','Push-ups','Svend Press'],
  Back: ['Deadlift','Sumo Deadlift','Trap Bar Deadlift','Rack Pulls','Pull-ups','Chin-ups','Assisted Pull-up Machine','Barbell Row','Pendlay Row','Yates Row','Smith Machine Row','Lat Pulldown','Wide-Grip Lat Pulldown','Close-Grip Lat Pulldown','Seated Cable Row','Wide-Grip Cable Row','T-Bar Row','Chest-Supported T-Bar Row','Single Arm Dumbbell Row','Meadows Row','Hammer Strength Row','Machine Row','Straight-Arm Pulldown','Shrugs','Dumbbell Shrugs','Good Mornings'],
  Shoulders: ['Overhead Press','Dumbbell OHP','Seated Dumbbell Press','Arnold Press','Smith Machine Shoulder Press','Machine Shoulder Press','Lateral Raises','Cable Lateral Raise','Machine Lateral Raise','Front Raises','Cable Front Raise','Plate Front Raise','Face Pulls','Reverse Pec Deck','Rear Delt Fly','Bent-Over Dumbbell Rear Delt Fly','Upright Row','Cable Upright Row'],
  Biceps: ['Barbell Curl','EZ-Bar Curl','Dumbbell Curl','Alternating Dumbbell Curl','Hammer Curl','Cross-Body Hammer Curl','Preacher Curl','Machine Preacher Curl','Incline Dumbbell Curl','Spider Curl','Concentration Curl','Cable Curl','Cable Rope Hammer Curl','Bayesian Cable Curl','Zottman Curl','Reverse Curl','21s'],
  Triceps: ['Skull Crushers','EZ-Bar Skull Crushers','Dumbbell Skull Crushers','Tricep Pushdown','Rope Pushdown','Single-Arm Cable Pushdown','Close-Grip Bench Press','Close-Grip Smith Machine Press','Overhead Tricep Extension','Cable Overhead Extension','Dumbbell Overhead Extension','Tricep Dips','Bench Dips','Assisted Dip Machine','Cable Kickback','Dumbbell Kickback','JM Press','Diamond Push-ups'],
  Legs: ['Barbell Squat','High-Bar Squat','Low-Bar Squat','Front Squat','Goblet Squat','Smith Machine Squat','Hack Squat Machine','Pendulum Squat','Romanian Deadlift','Stiff-Leg Deadlift','Leg Press','Horizontal Leg Press','Walking Lunges','Reverse Lunges','Dumbbell Lunges','Bulgarian Split Squat','Leg Curl','Seated Leg Curl','Lying Leg Curl','Nordic Hamstring Curl','Leg Extension','Single-Leg Extension','Calf Raises','Standing Calf Raise','Seated Calf Raise','Leg Press Calf Raise','Belt Squat'],
  Core: ['Plank','Side Plank','Crunches','Decline Crunches','Leg Raises','Hanging Leg Raise','Russian Twist','Weighted Russian Twist','Cable Crunch','Kneeling Cable Crunch','Ab Wheel Rollout','Ab Machine Crunch','Mountain Climbers','Dead Bug','Pallof Press','Hollow Body Hold','Dragon Flags'],
  Glutes: ['Hip Thrust','Barbell Hip Thrust','Machine Hip Thrust','Single-Leg Hip Thrust','Bulgarian Split Squat','Glute Bridge','Single-Leg Glute Bridge','Sumo Deadlift','Cable Kickback','Glute Kickback Machine','Step-ups','Weighted Step-ups','Cable Pull-Through','Good Mornings','Curtsy Lunge','Abduction Machine','Frog Pumps','Reverse Hyperextension'],
}

async function callClaude(system: string, userMessage: string, maxTokens = 700): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error: ${err}`)
  }
  const data = await res.json()
  return data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
}

function extractJSON(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in response')
  return JSON.parse(match[0])
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Verify JWT
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  let body: { action: string; data: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { action, data } = body

  try {
    if (action === 'workout') {
      const { profile, sessions, muscleFreq } = data as {
        profile: Record<string, unknown>
        sessions: Array<Record<string, unknown>>
        muscleFreq: Record<string, number | null>
      }

      const exerciseList = Object.entries(VALID_EXERCISES)
        .map(([g, exs]) => `${g}: ${exs.join(', ')}`)
        .join('\n')

      const recentSummary = (sessions || []).slice(0, 10).map((s: Record<string, unknown>) => {
        const exs = (s.exercises as Array<{ muscle_group?: string; muscleGroup?: string }> || [])
        const groups = [...new Set(exs.map(e => e.muscle_group || e.muscleGroup))].filter(Boolean)
        return `${new Date(s.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${groups.join(', ')}`
      }).join('\n')

      const freqSummary = Object.entries(muscleFreq || {})
        .map(([g, d]) => `${g}: ${d === null ? 'never trained' : d === 0 ? 'today' : `${d}d ago`}`)
        .join(', ')

      const splitInfo = (profile?.workout_split as { days?: Record<string, string[]> } | null)?.days
        ? Object.entries((profile.workout_split as { days: Record<string, string[]> }).days)
            .map(([day, muscles]) => {
              const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
              return muscles ? `${names[+day]}: ${Array.isArray(muscles) ? muscles.join('+') : muscles}` : null
            })
            .filter(Boolean)
            .join(', ')
        : 'No split set'

      const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]

      const system = `You are an expert personal trainer AI for BodMax. Generate a personalized workout plan as JSON only — no prose, no markdown. Output exactly this shape:
{"focus":"<short label>","exercises":[{"name":"<exact name>","muscleGroup":"<group>"},...],"tip":"<one coaching sentence>"}

RULES:
- Only use exercise names from the approved list below — exact spelling.
- Choose 5-8 exercises total.
- Prioritize muscle groups that were trained longest ago (highest day count).
- Respect the user's workout split if set.
- Today is ${todayName}.

APPROVED EXERCISES:
${exerciseList}`

      const userMsg = `Athlete type: ${profile?.athlete_type || 'General Fitness'}
Goal: ${profile?.goal || 'maintain'}
Unit: ${profile?.unit || 'lbs'}
Weekly split: ${splitInfo}
Muscle frequency (days since last trained): ${freqSummary}
Recent sessions:
${recentSummary || 'No sessions yet — this is their first workout'}

Generate the best workout for today.`

      const raw = await callClaude(system, userMsg, 1000)
      const parsed = extractJSON(raw)
      return json(parsed)

    } else if (action === 'insights') {
      const { profile, sessions, todayNutrition, streak, weeklyStats } = data as {
        profile: Record<string, unknown>
        sessions: Array<Record<string, unknown>>
        todayNutrition: Record<string, number>
        streak: number
        weeklyStats: Record<string, unknown>
      }

      const recentGroups = (sessions || []).slice(0, 14).map((s: Record<string, unknown>) => {
        const exs = (s.exercises as Array<{ muscle_group?: string; muscleGroup?: string }> || [])
        const groups = [...new Set(exs.map(e => e.muscle_group || e.muscleGroup))].filter(Boolean)
        const daysAgo = Math.floor((Date.now() - new Date(s.date as string).getTime()) / 86400000)
        return `${daysAgo}d ago: ${groups.join(', ')}`
      }).join('\n')

      const nutrition = todayNutrition || {}
      const nutSummary = `Calories: ${nutrition.calories || 0}/${profile?.target_calories || 0}, Protein: ${nutrition.protein || 0}g/${profile?.target_protein || 0}g`

      const system = `You are a direct, motivating personal trainer AI coach on BodMax. Generate 2-3 concise insights as JSON. Be specific and actionable. No fluff.

Output exactly:
{"insights":[{"type":"positive"|"warning"|"tip","title":"<5 words max>","body":"<2 sentences max, specific>"}]}`

      const userMsg = `Athlete: ${profile?.athlete_type || 'General Fitness'}, Goal: ${profile?.goal || 'maintain'}
Streak: ${streak} days
Sessions this week: ${weeklyStats?.thisWeek || 0}, Volume change vs last week: ${weeklyStats?.volDiff !== null ? weeklyStats?.volDiff + '%' : 'N/A'}
Today's nutrition: ${nutSummary}
Recent training history:
${recentGroups || 'No sessions yet'}

Give them 2-3 sharp insights about their training and nutrition.`

      const raw = await callClaude(system, userMsg, 600)
      const parsed = extractJSON(raw)
      return json(parsed)

    } else if (action === 'chat') {
      const { profile, sessions, message, history } = data as {
        profile: Record<string, unknown>
        sessions: Array<Record<string, unknown>>
        message: string
        history: Array<{ role: string; content: string }>
      }

      const recentGroups = (sessions || []).slice(0, 7).map((s: Record<string, unknown>) => {
        const exs = (s.exercises as Array<{ muscle_group?: string; muscleGroup?: string }> || [])
        const groups = [...new Set(exs.map(e => e.muscle_group || e.muscleGroup))].filter(Boolean)
        const daysAgo = Math.floor((Date.now() - new Date(s.date as string).getTime()) / 86400000)
        return `${daysAgo}d ago: ${groups.join(', ')}`
      }).join('; ')

      const system = `You are an expert personal trainer and nutrition coach for BodMax. Be direct, motivating, and specific. Keep replies under 120 words unless explaining something complex. Use the user's context when relevant.

User context: Athlete type: ${profile?.athlete_type || 'General'}, Goal: ${profile?.goal || 'maintain'}, Unit: ${profile?.unit || 'lbs'}
Recent training: ${recentGroups || 'no history'}`

      // Build multi-turn messages for conversation history
      const historyMessages = (history || []).slice(-8).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      }))
      historyMessages.push({ role: 'user', content: message })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 400,
          system,
          messages: historyMessages,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const result = await res.json()
      const reply = result.content?.find((b: { type: string }) => b.type === 'text')?.text ?? ''
      return json({ reply })

    } else {
      return json({ error: 'Unknown action' }, 400)
    }
  } catch (err) {
    console.error('ai-coach error:', err)
    return json({ error: String(err) }, 500)
  }
})
