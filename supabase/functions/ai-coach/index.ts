import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://getbodmax.com'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const PAID_MSG_LIMIT     = 30  // messages/day for subscribers
const TRIAL_MSG_LIMIT    = 3   // lifetime asks for free trial
const PAID_SESSION_LIMIT = 3   // post-session analyses/day for subscribers

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, goal, unit, subscription_status, beta, ai_coach_trial_uses')
      .eq('id', user.id)
      .single()

    const isSubscribed = profile?.subscription_status === 'active' || profile?.beta === true
    const trialUses = profile?.ai_coach_trial_uses ?? 0
    const hasTrialRemaining = !isSubscribed && trialUses < TRIAL_MSG_LIMIT

    if (!isSubscribed && !hasTrialRemaining) {
      return json({ error: 'Subscription required', trialExhausted: true }, 403)
    }

    const body = await req.json()
    const { type, sessionSummary, profileSummary } = body

    // Trial users may only use the ask endpoint
    if (!isSubscribed && type !== 'ask') {
      return json({ error: 'Subscription required' }, 403)
    }

    if (type === 'ask') {
      return await handleAsk(supabase, user.id, body.message, profile, profileSummary, isSubscribed, trialUses)
    }

    if (type === 'post_session') {
      return await handlePostSession(supabase, user.id, sessionSummary, profile)
    }

    if (type === 'daily_insight') {
      return await handleDailyInsight(supabase, user.id, profile, profileSummary)
    }

    return json({ error: 'Unknown type' }, 400)
  } catch (e) {
    return json({ error: e.message }, 500)
  }
})

async function handleAsk(
  supabase: any, userId: string, message: string, profile: any,
  profileSummary: string, isSubscribed: boolean, trialUses: number
) {
  if (!message?.trim()) return json({ error: 'Message required' }, 400)

  if (isSubscribed) {
    // Paid users: PAID_MSG_LIMIT messages per day
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('coach_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', dayStart.toISOString())

    if ((count || 0) >= PAID_MSG_LIMIT) {
      return json({ reply: `You've reached the ${PAID_MSG_LIMIT} message daily limit. Check back tomorrow!` })
    }
  }

  const { data: history } = await supabase
    .from('coach_messages')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(40)

  const messages = [
    ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const systemPrompt = `You are BodMax AI Coach, a concise fitness coach for ${profile?.name || 'this athlete'}.
Their goal: ${profile?.goal || 'build muscle'}. Unit preference: ${profile?.unit || 'lbs'}.
${profileSummary ? `Context: ${profileSummary}` : ''}
Give practical, direct answers. Max 3 sentences unless detail is genuinely needed. No fluff.`

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    system: systemPrompt,
    messages,
  })

  const reply = resp.content[0].type === 'text' ? resp.content[0].text : ''

  await supabase.from('coach_messages').insert([
    { user_id: userId, role: 'user', content: message },
    { user_id: userId, role: 'assistant', content: reply },
  ])

  // Increment trial counter for free trial users
  if (!isSubscribed) {
    await supabase
      .from('profiles')
      .update({ ai_coach_trial_uses: trialUses + 1 })
      .eq('id', userId)
  }

  const newTrialUses = isSubscribed ? null : trialUses + 1
  return json({ reply, trialUses: newTrialUses, trialLimit: isSubscribed ? null : TRIAL_MSG_LIMIT })
}

async function handlePostSession(supabase: any, userId: string, sessionSummary: string, profile: any) {
  if (!sessionSummary) return json({ error: 'Session summary required' }, 400)

  // Rate limit: PAID_SESSION_LIMIT post-session analyses per day
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('coach_insights')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'post_session')
    .gte('created_at', dayStart.toISOString())
  if ((count || 0) >= PAID_SESSION_LIMIT) return json({ insight: null })

  const systemPrompt = `You are BodMax AI Coach — an expert strength and conditioning coach.
Analyze the athlete's workout in full detail and respond with valid JSON only.

JSON shape (all fields required):
{
  "headline": "punchy 4-6 word title for the session",
  "rating": <integer 1-10 overall session quality>,
  "summary": "2-3 sentence overall assessment — volume, intensity, execution",
  "strengths": ["up to 3 specific things done well"],
  "improvements": ["up to 3 specific, actionable things to fix next time"],
  "muscleBalance": "1-2 sentences on muscle group balance or imbalances observed",
  "nextSession": "concrete recommendation for what to do next session — exercise, weight, rep target, or focus",
  "action": "the single most important thing to do before the next workout"
}

No markdown fences, no extra keys, no extra text — pure JSON only.`

  const userContent = `Athlete: ${profile?.name || 'User'}
Goal: ${profile?.goal || 'build muscle'}
Unit: ${profile?.unit || 'lbs'}

Workout data:
${sessionSummary}`

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 900,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}'
  let insight = {
    headline: 'Session Complete',
    rating: 7,
    summary: 'You put in the work today.',
    strengths: ['Showed up and completed the session'],
    improvements: ['Track weights more precisely next time'],
    muscleBalance: 'Continue monitoring balance across muscle groups.',
    nextSession: 'Aim to add small weight increases on your main lifts.',
    action: 'Log your sleep and nutrition tonight to support recovery.',
  }
  try {
    const parsed = JSON.parse(text)
    // Ensure arrays are actually arrays
    if (!Array.isArray(parsed.strengths)) parsed.strengths = [parsed.strengths].filter(Boolean)
    if (!Array.isArray(parsed.improvements)) parsed.improvements = [parsed.improvements].filter(Boolean)
    insight = parsed
  } catch { /* fallback to defaults */ }

  // Cache the insight so it can be retrieved without re-calling the API
  await supabase.from('coach_insights').insert({
    user_id: userId,
    type: 'post_session',
    content: JSON.stringify(insight),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  return json({ insight })
}

async function handleDailyInsight(supabase: any, userId: string, profile: any, profileSummary: string) {
  const { data: cached } = await supabase
    .from('coach_insights')
    .select('content')
    .eq('user_id', userId)
    .eq('type', 'daily_insight')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cached) {
    try { return json({ insight: JSON.parse(cached.content) }) } catch { /* fall through */ }
  }

  const systemPrompt = `You are BodMax AI Coach. Generate a personalized daily fitness tip.
Respond with valid JSON only: {"headline": "short title", "body": "2-3 sentence tip or insight", "action": "one concrete action for today"}
No markdown, no extra text — pure JSON.`

  const userContent = `Athlete: ${profile?.name || 'User'}, Goal: ${profile?.goal || 'build muscle'}, Unit: ${profile?.unit || 'lbs'}.${profileSummary ? `\n${profileSummary}` : ''}`

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}'
  let insight = { headline: 'Stay consistent', body: 'Every session counts toward your goal.', action: 'Show up today.' }
  try { insight = JSON.parse(text) } catch { /* fallback */ }

  const expires = new Date(); expires.setHours(expires.getHours() + 24)
  await supabase.from('coach_insights').insert({
    user_id: userId,
    type: 'daily_insight',
    content: JSON.stringify(insight),
    expires_at: expires.toISOString(),
  })

  return json({ insight })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
