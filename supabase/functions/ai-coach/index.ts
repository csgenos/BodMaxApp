import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

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
      .select('name, goal, unit, subscription_status, beta')
      .eq('id', user.id)
      .single()

    const isSubscribed = profile?.subscription_status === 'active' || profile?.beta === true
    if (!isSubscribed) return json({ error: 'Subscription required' }, 403)

    const body = await req.json()
    const { type, sessionSummary, profileSummary } = body

    if (type === 'ask') {
      return await handleAsk(supabase, user.id, body.message, profile, profileSummary)
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

async function handleAsk(supabase: any, userId: string, message: string, profile: any, profileSummary: string) {
  if (!message?.trim()) return json({ error: 'Message required' }, 400)

  // Rate limit: 25 user messages per day
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('coach_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', dayStart.toISOString())

  if ((count || 0) >= 25) {
    return json({ reply: "You've reached the 25 message daily limit. Check back tomorrow!" })
  }

  // Fetch recent conversation history
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

  // Store both sides
  await supabase.from('coach_messages').insert([
    { user_id: userId, role: 'user', content: message },
    { user_id: userId, role: 'assistant', content: reply },
  ])

  return json({ reply })
}

async function handlePostSession(supabase: any, userId: string, sessionSummary: string, profile: any) {
  if (!sessionSummary) return json({ error: 'Session summary required' }, 400)

  const systemPrompt = `You are BodMax AI Coach. Analyze this workout and give ONE specific, actionable insight.
Respond with valid JSON only: {"headline": "short title", "body": "2-3 sentence analysis", "action": "one specific tip for next session"}
No markdown, no extra text — pure JSON.`

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Workout for ${profile?.name || 'user'} (goal: ${profile?.goal || 'build muscle'}, unit: ${profile?.unit || 'lbs'}):\n${sessionSummary}` }],
  })

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '{}'
  let insight = { headline: 'Nice work!', body: 'You completed your session.', action: 'Keep the momentum going.' }
  try { insight = JSON.parse(text) } catch { /* fallback to defaults */ }

  return json({ insight })
}

async function handleDailyInsight(supabase: any, userId: string, profile: any, profileSummary: string) {
  // Check cache
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

  // Cache for 24 hours
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
