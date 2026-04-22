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
  const payload = {
    date: session.date,
    duration: session.duration,
    completed_at: session.completedAt || new Date().toISOString(),
    exercises: (session.exercises || []).map(ex => ({
      name: ex.name,
      muscle_group: ex.muscleGroup,
      sets: (ex.sets || [])
        .filter(s => s.weight && s.reps)
        .map(s => ({ weight: +s.weight, reps: +s.reps })),
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
export const deleteSession = async (sessionId, userId) => {
  const { data: exRows } = await supabase.from('exercises').select('id').eq('session_id', sessionId)
  if (exRows?.length) {
    await supabase.from('sets').delete().in('exercise_id', exRows.map(e => e.id))
  }
  await supabase.from('exercises').delete().eq('session_id', sessionId)
  await supabase.from('cardio').delete().eq('session_id', sessionId)
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('user_id', userId)
  if (error) throw error
}

export const updateSession = async (sessionId, userId, session) => {
  const { error } = await supabase.from('sessions')
    .update({ date: session.date, duration: session.duration })
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
      await supabase.from('sets').insert({ exercise_id: exRow.id, weight: +validSets[j].weight, reps: +validSets[j].reps, set_number: j + 1 })
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
    supabase.from('friendships').select('profiles!friendships_friend_id_fkey(id, name, username, last_active)')
      .eq('user_id', userId).eq('status', 'accepted'),
    supabase.from('friendships').select('profiles!friendships_user_id_fkey(id, name, username, last_active)')
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
