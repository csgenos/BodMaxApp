import { supabase } from './supabase'

// ── PROFILE ──────────────────────────────────────────────
export const getProfile = async (userId) => {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
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
  const { data } = await supabase
    .from('sessions')
    .select('*, exercises(*, sets(*)), cardio(*)')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })
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
  const { data } = await supabase.from('diet_entries').select('*')
    .eq('user_id', userId).eq('date', date).order('created_at', { ascending: false })
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
  const { data } = await supabase.from('weight_log').select('*').eq('user_id', userId).order('date', { ascending: true })
  return data || []
}
export const addWeight = async (userId, date, weight) => {
  await supabase.from('weight_log').insert({ user_id: userId, date, weight })
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
  const { data } = await supabase.from('personal_records').select('*').eq('user_id', userId).order('muscle_group')
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
    supabase.from('friendships').select('profiles!friendships_friend_id_fkey(id, name, username)')
      .eq('user_id', userId).eq('status', 'accepted'),
    supabase.from('friendships').select('profiles!friendships_user_id_fkey(id, name, username)')
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
export const getFriendshipStatus = async (userId, friendId) => {
  const { data } = await supabase.from('friendships').select('id, status, user_id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`).maybeSingle()
  return data
}
