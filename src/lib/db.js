import { supabase } from './supabase'

// ── PROFILE ──────────────────────────────────────────────
export const getProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error && error.code !== 'PGRST116') throw error
  return data
}
export const createProfile = async (userId, d) => {
  const { data, error } = await supabase.from('profiles').insert({ id: userId, ...d }).select().single()
  if (error) throw error
  return data
}
export const updateProfile = async (userId, d) => {
  const { data, error } = await supabase.from('profiles').update(d).eq('id', userId).select().single()
  if (error) throw error
  return data
}
export const updateLastActive = async (userId) => {
  await supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', userId)
}

// ── SESSIONS ─────────────────────────────────────────────
export const saveSession = async (userId, session) => {
  const completedAt = session.completedAt || new Date().toISOString()
  const payload = {
    date: session.date,
    duration: session.duration,
    completed_at: completedAt,
    notes: session.notes || null,
    exercises: (session.exercises || []).map(ex => ({
      name: ex.name,
      muscle_group: ex.muscleGroup,
      sets: (ex.sets || [])
        .filter(s => s.weight && s.reps)
        .map(s => ({ weight: +s.weight, reps: +s.reps, is_warmup: s.warmup || false })),
    })),
    cardio: (session.cardio || []).map(c => ({
      type: c.type,
      duration: c.duration,
      distance: c.distance ?? null,
      calories: c.calories ?? null,
    })),
  }
  const { data, error } = await supabase.rpc('save_session', { payload })
  if (error) throw error
  if (session.photo) {
    await supabase.from('sessions')
      .update({ photo_url: session.photo })
      .eq('user_id', userId)
      .eq('completed_at', completedAt)
  }
  return data
}

export const getSessions = async (userId) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, exercises(*, sets(*)), cardio(*)')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
  if (error) throw error
  return data || []
}

export const getLastExerciseSets = async (userId, exerciseName) => {
  const { data: sessionRows } = await supabase
    .from('sessions').select('id').eq('user_id', userId)
    .not('completed_at', 'is', null).order('date', { ascending: false }).limit(30)
  if (!sessionRows?.length) return null
  const ids = sessionRows.map(s => s.id)
  const { data: exRows } = await supabase
    .from('exercises').select('id, session_id, sets(*)')
    .eq('name', exerciseName).in('session_id', ids)
  if (!exRows?.length) return null
  const idRank = new Map(ids.map((id, i) => [id, i]))
  const sorted = exRows.sort((a, b) => (idRank.get(a.session_id) ?? Infinity) - (idRank.get(b.session_id) ?? Infinity))
  return sorted[0]?.sets || null
}

// ── CUSTOM EXERCISES ─────────────────────────────────────
export const getCustomExercises = async (userId) => {
  const { data } = await supabase.from('custom_exercises').select('*')
    .eq('user_id', userId).order('name')
  return data || []
}
export const saveCustomExercise = async (userId, name, muscleGroup) => {
  const { error } = await supabase.from('custom_exercises')
    .upsert({ user_id: userId, name, muscle_group: muscleGroup }, { onConflict: 'user_id,name' })
  if (error) throw error
}
export const deleteCustomExercise = async (userId, id) => {
  await supabase.from('custom_exercises').delete().eq('id', id).eq('user_id', userId)
}

// ── EXERCISE PROGRESSION ─────────────────────────────────
export const getExerciseProgress = async (userId, exerciseName) => {
  const { data: sessionRows } = await supabase
    .from('sessions').select('id, date').eq('user_id', userId)
    .not('completed_at', 'is', null).order('date', { ascending: true }).limit(200)
  if (!sessionRows?.length) return []
  const ids = sessionRows.map(s => s.id)
  const dateMap = Object.fromEntries(sessionRows.map(s => [s.id, s.date]))
  const { data: exRows } = await supabase
    .from('exercises').select('id, session_id, sets(weight, reps, is_warmup)')
    .eq('name', exerciseName).in('session_id', ids)
  if (!exRows?.length) return []
  return exRows
    .map(ex => {
      const working = (ex.sets || []).filter(s => !s.is_warmup && s.weight && s.reps)
      if (!working.length) return null
      const best = working.reduce((a, b) => (+b.weight > +a.weight ? b : a))
      return {
        date: dateMap[ex.session_id],
        weight: +best.weight,
        reps: +best.reps,
        est1rm: Math.round(+best.weight * (1 + +best.reps / 30)),
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

// ── WORKOUT TEMPLATES ────────────────────────────────────
export const getTemplates = async (userId) => {
  const { data } = await supabase.from('workout_templates').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  return data || []
}
export const saveTemplate = async (userId, name, exercises) => {
  const payload = (exercises || []).map(ex => ({
    name: ex.name,
    muscleGroup: ex.muscleGroup || ex.muscle_group,
  }))
  const { data, error } = await supabase.from('workout_templates')
    .insert({ user_id: userId, name, exercises: payload })
    .select().single()
  if (error) throw error
  return data
}
export const deleteTemplate = async (id) => {
  await supabase.from('workout_templates').delete().eq('id', id)
}

// ── DIET ─────────────────────────────────────────────────
export const getDietByDate = async (userId, date) => {
  const { data, error } = await supabase.from('diet_entries').select('*')
    .eq('user_id', userId).eq('date', date).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
export const addDietEntry = async (userId, entry) => {
  const { data, error } = await supabase.from('diet_entries').insert({ user_id: userId, ...entry }).select().single()
  if (error) throw error
  return data
}
export const deleteDietEntry = async (userId, id) => {
  const { error } = await supabase.from('diet_entries').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export const getTodayCardioCalories = async (userId) => {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('sessions')
    .select('cardio(calories)')
    .eq('user_id', userId)
    .eq('date', today)
    .not('completed_at', 'is', null)
  if (!data) return 0
  return data.flatMap(s => s.cardio || []).reduce((sum, c) => sum + (c.calories || 0), 0)
}

// ── WEIGHT ────────────────────────────────────────────────
export const getWeightLog = async (userId) => {
  const { data, error } = await supabase.from('weight_log').select('*').eq('user_id', userId).order('date', { ascending: true })
  if (error) throw error
  return data || []
}
export const addWeight = async (userId, date, weight) => {
  const { error } = await supabase.from('weight_log').insert({ user_id: userId, date, weight })
  if (error) throw error
}

// ── BODY MEASUREMENTS ────────────────────────────────────
export const getBodyMeasurements = async (userId) => {
  const { data } = await supabase.from('body_measurements').select('*')
    .eq('user_id', userId).order('date', { ascending: true })
  return data || []
}
export const addBodyMeasurement = async (userId, entry) => {
  const { data, error } = await supabase.from('body_measurements')
    .insert({ user_id: userId, ...entry }).select().single()
  if (error) throw error
  return data
}
export const deleteBodyMeasurement = async (userId, id) => {
  const { error } = await supabase.from('body_measurements').delete()
    .eq('id', id).eq('user_id', userId)
  if (error) throw error
}

// ── PRs ───────────────────────────────────────────────────
export const getPRs = async (userId) => {
  const { data, error } = await supabase.from('personal_records').select('*').eq('user_id', userId).order('muscle_group')
  if (error) throw error
  return data || []
}
export const checkAndUpdatePR = async (userId, exercise, muscleGroup, weight, reps) => {
  const { data: ex } = await supabase.from('personal_records').select('*').eq('user_id', userId).eq('exercise', exercise).maybeSingle()
  const date = new Date().toISOString()
  if (!ex) {
    await supabase.from('personal_records').insert({ user_id: userId, exercise, muscle_group: muscleGroup, weight: +weight, reps: +reps, date })
    return true
  }
  if (+weight > ex.weight || (+weight === ex.weight && +reps > ex.reps)) {
    await supabase.from('personal_records').update({ weight: +weight, reps: +reps, date, muscle_group: muscleGroup }).eq('id', ex.id)
    return true
  }
  return false
}

// ── SESSION MUTATIONS ────────────────────────────────────
const recalcPR = async (userId, exerciseName) => {
  const { data: sessionRows } = await supabase
    .from('sessions').select('id').eq('user_id', userId).not('completed_at', 'is', null)
  if (!sessionRows?.length) {
    await supabase.from('personal_records').delete().eq('user_id', userId).eq('exercise', exerciseName)
    return
  }
  const { data: exRows } = await supabase
    .from('exercises').select('muscle_group, sets(*)')
    .eq('name', exerciseName).in('session_id', sessionRows.map(s => s.id))
  if (!exRows?.length) {
    await supabase.from('personal_records').delete().eq('user_id', userId).eq('exercise', exerciseName)
    return
  }
  let best = null
  for (const ex of exRows) {
    for (const set of (ex.sets || [])) {
      if (!set.weight || !set.reps || set.is_warmup) continue
      if (!best || +set.weight > best.weight || (+set.weight === best.weight && +set.reps > best.reps))
        best = { weight: +set.weight, reps: +set.reps, muscleGroup: ex.muscle_group }
    }
  }
  if (!best) {
    await supabase.from('personal_records').delete().eq('user_id', userId).eq('exercise', exerciseName)
    return
  }
  const { data: existing } = await supabase.from('personal_records').select('id').eq('user_id', userId).eq('exercise', exerciseName).maybeSingle()
  if (existing) {
    await supabase.from('personal_records').update({ weight: best.weight, reps: best.reps, muscle_group: best.muscleGroup }).eq('id', existing.id)
  } else {
    await supabase.from('personal_records').insert({ user_id: userId, exercise: exerciseName, muscle_group: best.muscleGroup, weight: best.weight, reps: best.reps, date: new Date().toISOString() })
  }
}

export const deleteSession = async (sessionId, userId) => {
  const { data: exRows } = await supabase.from('exercises').select('id, name').eq('session_id', sessionId)
  const exerciseNames = [...new Set((exRows || []).map(e => e.name))]
  if (exRows?.length) {
    await supabase.from('sets').delete().in('exercise_id', exRows.map(e => e.id))
  }
  await supabase.from('exercises').delete().eq('session_id', sessionId)
  await supabase.from('cardio').delete().eq('session_id', sessionId)
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('user_id', userId)
  if (error) throw error
  await Promise.all(exerciseNames.map(name => recalcPR(userId, name)))
}

export const updateSession = async (sessionId, userId, session) => {
  const { error } = await supabase.from('sessions')
    .update({ date: session.date, duration: session.duration, notes: session.notes || null })
    .eq('id', sessionId).eq('user_id', userId)
  if (error) throw error
  const { data: exRows } = await supabase.from('exercises').select('id').eq('session_id', sessionId)
  if (exRows?.length) {
    await supabase.from('sets').delete().in('exercise_id', exRows.map(e => e.id))
  }
  await supabase.from('exercises').delete().eq('session_id', sessionId)
  await supabase.from('cardio').delete().eq('session_id', sessionId)
  for (let i = 0; i < (session.exercises || []).length; i++) {
    const ex = session.exercises[i]
    const { data: exRow } = await supabase.from('exercises')
      .insert({ session_id: sessionId, name: ex.name, muscle_group: ex.muscleGroup, order_index: i })
      .select().single()
    if (!exRow) continue
    const validSets = (ex.sets || []).filter(s => s.weight && s.reps)
    for (let j = 0; j < validSets.length; j++) {
      await supabase.from('sets').insert({ exercise_id: exRow.id, weight: +validSets[j].weight, reps: +validSets[j].reps, set_number: j + 1, is_warmup: validSets[j].warmup || false })
    }
  }
  for (const c of (session.cardio || [])) {
    await supabase.from('cardio').insert({ session_id: sessionId, type: c.type, duration: c.duration, distance: c.distance || null, calories: c.calories || null })
  }
}

// ── SESSION COMMENTS ──────────────────────────────────────
export const getSessionComments = async (sessionId) => {
  const { data } = await supabase.from('session_comments')
    .select('*, profiles(name, username)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  return data || []
}

export const addSessionComment = async (sessionId, userId, text) => {
  const { data, error } = await supabase.from('session_comments')
    .insert({ session_id: sessionId, user_id: userId, text })
    .select('*, profiles(name, username)').single()
  if (error) throw error
  return data
}

// ── SOCIAL ────────────────────────────────────────────────
export const searchUsers = async (query, currentUserId) => {
  const { data } = await supabase.from('profiles').select('id, name, username')
    .ilike('username', `%${query}%`).neq('id', currentUserId).limit(10)
  return data || []
}
export const sendFriendRequest = async (userId, friendId) => {
  const { error } = await supabase.from('friendships').insert({ user_id: userId, friend_id: friendId, status: 'pending' })
  if (error) throw error
}
// Ownership check: only the recipient (friend_id) may accept.
// RLS also enforces this on the server; the explicit .eq is defense in depth.
export const acceptFriendRequest = async (userId, id) => {
  const { error } = await supabase.from('friendships')
    .update({ status: 'accepted' })
    .eq('id', id)
    .eq('friend_id', userId)
  if (error) throw error
}
export const declineFriendRequest = async (userId, id) => {
  const { error } = await supabase.from('friendships').delete()
    .eq('id', id)
    .eq('friend_id', userId)
  if (error) throw error
}
export const getFriendRequests = async (userId) => {
  const { data } = await supabase.from('friendships')
    .select('id, user_id, profiles!friendships_user_id_fkey(name, username)')
    .eq('friend_id', userId).eq('status', 'pending')
  return data || []
}
export const getFriends = async (userId) => {
  const [{ data: sent }, { data: recv }] = await Promise.all([
    supabase.from('friendships').select('profiles!friendships_friend_id_fkey(id, name, username, last_active, created_at)')
      .eq('user_id', userId).eq('status', 'accepted'),
    supabase.from('friendships').select('profiles!friendships_user_id_fkey(id, name, username, last_active, created_at)')
      .eq('friend_id', userId).eq('status', 'accepted'),
  ])
  return [
    ...(sent || []).map(f => f.profiles),
    ...(recv || []).map(f => f.profiles),
  ].filter(Boolean)
}
export const getFriendsFeedAndFriends = async (userId) => {
  const friends = await getFriends(userId)
  if (!friends.length) return { feed: [], friends: [] }
  const { data } = await supabase
    .from('sessions')
    .select('*, exercises(*, sets(*)), cardio(*), profiles!sessions_user_id_fkey(name, username)')
    .in('user_id', friends.map(f => f.id))
    .not('completed_at', 'is', null)
    .order('date', { ascending: false }).limit(40)
  return { feed: data || [], friends }
}
// Server-enforced friendship check via RPC (see supabase/schema.sql).
export const getFriendPRs = async (friendId) => {
  const { data, error } = await supabase.rpc('get_friend_prs', { friend: friendId })
  if (error) throw error
  return data || []
}
export const getFriendSessions = async (friendId) => {
  const { data } = await supabase
    .from('sessions')
    .select('*, exercises(*, sets(*)), cardio(*)')
    .eq('user_id', friendId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
  return data || []
}
export const getFriendshipStatus = async (userId, friendId) => {
  const { data } = await supabase.from('friendships').select('id, status, user_id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`).maybeSingle()
  return data
}

export const getSocialNotifCounts = async (userId, lastFeedSeen) => {
  const { count: reqCount } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('friend_id', userId)
    .eq('status', 'pending')
  const friends = await getFriends(userId)
  if (!friends.length) return { requests: reqCount || 0, feed: 0 }
  const { count: feedCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .in('user_id', friends.map(f => f.id))
    .not('completed_at', 'is', null)
    .gt('completed_at', lastFeedSeen)
  return { requests: reqCount || 0, feed: feedCount || 0 }
}

// ── LIKES ─────────────────────────────────────────────────
export const getLikesForSessions = async (sessionIds) => {
  if (!sessionIds?.length) return []
  const { data } = await supabase.from('session_likes')
    .select('session_id, user_id')
    .in('session_id', sessionIds)
  return data || []
}

export const toggleLike = async (sessionId, userId) => {
  const { data: existing } = await supabase.from('session_likes')
    .select('session_id').eq('session_id', sessionId).eq('user_id', userId).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('session_likes').delete()
      .eq('session_id', sessionId).eq('user_id', userId)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('session_likes').insert({ session_id: sessionId, user_id: userId })
  if (error) throw error
  return true
}

export const getLeaderboard = async (userId, currentProfile) => {
  const friends = await getFriends(userId)
  const allIds = [...friends.map(f => f.id), userId]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('sessions')
    .select('user_id, date')
    .in('user_id', allIds)
    .not('completed_at', 'is', null)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])

  const rows = data || []
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weekStr = weekAgo.toISOString().split('T')[0]

  const calcStreak = (dates) => {
    const ds = new Set(dates)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]
    const yd = new Date(today); yd.setDate(yd.getDate() - 1)
    const ydStr = yd.toISOString().split('T')[0]
    let streak = 0
    if (ds.has(todayStr) || ds.has(ydStr)) {
      const start = new Date(ds.has(todayStr) ? today : yd)
      while (ds.has(start.toISOString().split('T')[0])) { streak++; start.setDate(start.getDate() - 1) }
    }
    return streak
  }

  const allPersons = [...friends, { ...currentProfile, id: userId }]
  return allPersons.map(person => {
    const userRows = rows.filter(s => s.user_id === person.id)
    const dates = [...new Set(userRows.map(s => (s.date || '').split('T')[0]).filter(Boolean))].sort()
    return {
      id: person.id,
      name: person.name,
      username: person.username,
      weeklyCount: dates.filter(d => d >= weekStr).length,
      monthlyCount: dates.length,
      streak: calcStreak(dates),
      isMe: person.id === userId,
    }
  }).sort((a, b) => b.weeklyCount - a.weeklyCount)
}

// ── SAVED MEALS ──────────────────────────────────────────
export const getSavedMeals = async (userId) => {
  const { data, error } = await supabase.from('saved_meals').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
export const saveMeal = async (userId, meal) => {
  const { data, error } = await supabase.from('saved_meals')
    .insert({ user_id: userId, name: meal.name, calories: +meal.calories || 0, protein: +meal.protein || 0, carbs: +meal.carbs || 0, fat: +meal.fat || 0 })
    .select().single()
  if (error) throw error
  return data
}
export const deleteSavedMeal = async (userId, id) => {
  const { error } = await supabase.from('saved_meals').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export const useInviteCode = async (code) => {
  const { data, error } = await supabase.rpc('use_invite_code', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  return !!data
}

// ── AI COACH + STRIPE ────────────────────────────────────
export const createStripeCheckout = async (userId) => {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', { body: { userId } })
  if (error) throw error
  return data
}

export const getCoachInsight = async (userId, type) => {
  const { data } = await supabase
    .from('coach_insights')
    .select('content, metadata')
    .eq('user_id', userId)
    .eq('type', type)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  try { return { ...JSON.parse(data.content), metadata: data.metadata } } catch { return null }
}

export const getCoachMessages = async (userId, limit = 40) => {
  const { data } = await supabase
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return data || []
}

export const askCoach = async (userId, message, profileSummary) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'ask', message, profileSummary }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Coach error') }
  return res.json()
}

export const getPostSessionCoach = async (userId, sessionSummary) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'post_session', sessionSummary }),
  })
  if (!res.ok) return null
  const d = await res.json()
  return d.insight || null
}

export const getDailyInsight = async (userId, profileSummary) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'daily_insight', profileSummary }),
  })
  if (!res.ok) return null
  const d = await res.json()
  return d.insight || null
}

export const addFeedback = async (userId, message, rating) => {
  const { error } = await supabase.from('feedback').insert({ user_id: userId, message, rating: rating || null })
  if (error) throw error
  // Fire-and-forget email notification — non-fatal if it fails
  supabase.functions.invoke('send-feedback-email', { body: { message, rating, userId } }).catch(() => {})
}
