import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { searchUsers, sendFriendRequest, getFriends, getFriendsFeed, getFriendPRs, getFriendRequests, acceptFriendRequest, declineFriendRequest } from '../lib/db'
import { MUSCLE_GROUPS } from '../lib/ranks'

export default function Social() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('feed')
  const [feed, setFeed] = useState([])
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [friendPRs, setFriendPRs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  const searchTimer = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => { if (profile) load() }, [profile?.id])

  const load = async () => {
    setLoading(true)
    try {
      const [f, fr, req] = await Promise.all([
        getFriendsFeed(profile.id),
        getFriends(profile.id),
        getFriendRequests(profile.id),
      ])
      if (!mounted.current) return
      setFeed(f); setFriends(fr); setRequests(req)
    } catch (e) {
      if (mounted.current) setError(e.message)
    }
    if (mounted.current) setLoading(false)
  }

  const doSearch = (q) => {
    setSearch(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchUsers(q, profile.id)
        if (mounted.current) setSearchResults(res)
      } catch { /* non-fatal */ }
    }, 300)
  }

  const addFriend = async (userId) => {
    try {
      await sendFriendRequest(profile.id, userId)
      if (mounted.current) setSearchResults(r => r.filter(u => u.id !== userId))
    } catch {
      if (mounted.current) setError('Friend request already sent or failed')
    }
  }

  const handleAccept = async (id) => {
    try { await acceptFriendRequest(id); load() }
    catch (e) { if (mounted.current) setError(e.message) }
  }
  const handleDecline = async (id) => {
    try { await declineFriendRequest(id); load() }
    catch (e) { if (mounted.current) setError(e.message) }
  }

  const viewFriendPRs = async (friend) => {
    setSelectedFriend(friend)
    try {
      const prs = await getFriendPRs(friend.id)
      if (mounted.current) setFriendPRs(prs)
    } catch { /* show empty */ }
  }

  if (selectedFriend) return (
    <div style={{ padding: '52px 20px 24px' }}>
      <button onClick={() => setSelectedFriend(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 600, marginBottom: 20, padding: 0 }}>← Back</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Avatar name={selectedFriend.name} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedFriend.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>@{selectedFriend.username}</div>
        </div>
      </div>
      <div className="label" style={{ marginBottom: 12 }}>PERSONAL RECORDS</div>
      {friendPRs.length === 0
        ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No PRs yet</div>
        : MUSCLE_GROUPS.map(g => {
          const gPRs = friendPRs.filter(p => p.muscle_group === g)
          if (!gPRs.length) return null
          return (
            <div key={g} style={{ marginBottom: 20 }}>
              <div className="label" style={{ color: 'var(--accent)', marginBottom: 8 }}>{g.toUpperCase()}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {gPRs.map(pr => (
                  <div key={pr.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{pr.exercise}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{pr.weight}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{pr.reps} reps · lbs</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '52px 20px 0', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Social</h2>
        <div style={{ display: 'flex' }}>
          {['feed', 'friends', 'add'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, color: tab === t ? 'var(--accent)' : 'var(--text-muted)', padding: '10px 0', fontSize: '9px', letterSpacing: '3px', fontFamily: 'var(--mono)', fontWeight: 600, textTransform: 'uppercase' }}>
              {t === 'add' ? `ADD${requests.length ? ' (' + requests.length + ')' : ''}` : t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        {tab === 'feed' && (
          loading ? <Loader /> : feed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity yet — add friends to see their workouts</div>
            </div>
          ) : feed.map(s => {
            const vol = (s.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)
            const groups = [...new Set((s.exercises || []).map(e => e.muscle_group || e.muscleGroup))].filter(Boolean)
            const user = s.profiles
            return (
              <div key={s.id} className="card" style={{ padding: 16, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Avatar name={user?.name || '?'} size={32} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>@{user?.username}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{groups.join(', ') || 'Workout'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                  {(s.exercises || []).length} exercises · {Math.round(vol).toLocaleString()} lbs{s.duration ? ` · ${Math.floor(s.duration / 60)}m` : ''}
                </div>
              </div>
            )
          })
        )}

        {tab === 'friends' && (
          <div>
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No friends yet — go to Add tab</div>
            ) : friends.map(f => (
              <div key={f.id} className="card" style={{ padding: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={f.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>@{f.username}</div>
                </div>
                <button onClick={() => viewFriendPRs(f)} style={{ background: 'var(--accent-low)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>PRs</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'add' && (
          <div>
            {requests.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="label" style={{ marginBottom: 10 }}>FRIEND REQUESTS</div>
                {requests.map(r => (
                  <div key={r.id} className="card" style={{ padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.profiles?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>@{r.profiles?.username}</div>
                    </div>
                    <button onClick={() => handleAccept(r.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: '#fff', fontWeight: 700, fontSize: 12 }}>✓</button>
                    <button onClick={() => handleDecline(r.id)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-dim)', fontSize: 12 }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="label" style={{ marginBottom: 10 }}>SEARCH BY USERNAME</div>
            <input
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '13px 16px', fontSize: 15, width: '100%', marginBottom: 12 }}
              placeholder="Search username..."
              value={search}
              onChange={e => doSearch(e.target.value)}
            />
            {searchResults.map(u => (
              <div key={u.id} className="card" style={{ padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>@{u.username}</div>
                </div>
                <button onClick={() => addFriend(u.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 12 }}>ADD</button>
              </div>
            ))}
            {search.length >= 2 && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>No users found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Avatar({ name, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent-low)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800, color: 'var(--accent)', flexShrink: 0 }}>
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
