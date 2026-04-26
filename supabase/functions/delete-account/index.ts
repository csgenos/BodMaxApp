import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('APP_URL') || 'https://getbodmax.com'
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

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

    const userId = user.id

    // Delete all user-owned data in dependency order
    // 1. Get session IDs first (child rows need to go before parent)
    const { data: sessionRows } = await supabase
      .from('sessions').select('id').eq('user_id', userId)

    if (sessionRows?.length) {
      const sessionIds = sessionRows.map((s: { id: string }) => s.id)

      const { data: exRows } = await supabase
        .from('exercises').select('id').in('session_id', sessionIds)

      if (exRows?.length) {
        await supabase.from('sets').delete()
          .in('exercise_id', exRows.map((e: { id: string }) => e.id))
        await supabase.from('exercises').delete().in('session_id', sessionIds)
      }

      await supabase.from('cardio').delete().in('session_id', sessionIds)
      await supabase.from('session_comments').delete().in('session_id', sessionIds)
      await supabase.from('session_likes').delete().in('session_id', sessionIds)
    }

    // 2. Delete top-level user tables
    await Promise.all([
      supabase.from('sessions').delete().eq('user_id', userId),
      supabase.from('personal_records').delete().eq('user_id', userId),
      supabase.from('custom_exercises').delete().eq('user_id', userId),
      supabase.from('workout_templates').delete().eq('user_id', userId),
      supabase.from('diet_entries').delete().eq('user_id', userId),
      supabase.from('weight_log').delete().eq('user_id', userId),
      supabase.from('body_measurements').delete().eq('user_id', userId),
      supabase.from('saved_meals').delete().eq('user_id', userId),
      supabase.from('coach_messages').delete().eq('user_id', userId),
      supabase.from('coach_insights').delete().eq('user_id', userId),
      supabase.from('user_programs').delete().eq('user_id', userId),
      supabase.from('feedback').delete().eq('user_id', userId),
    ])

    // 3. Delete friendships (user appears in either column)
    await supabase.from('friendships').delete().eq('user_id', userId)
    await supabase.from('friendships').delete().eq('friend_id', userId)

    // 4. Delete session comments/likes the user made on others' sessions
    await supabase.from('session_comments').delete().eq('user_id', userId)
    await supabase.from('session_likes').delete().eq('user_id', userId)

    // 5. Delete the profile row
    await supabase.from('profiles').delete().eq('id', userId)

    // 6. Delete the auth user — must be last
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(userId)
    if (deleteErr) throw deleteErr

    return json({ success: true })
  } catch (err) {
    console.error('delete-account error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
