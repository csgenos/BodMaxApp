import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { searchUsers, sendFriendRequest, getFriendsFeedAndFriends, getFriendPRs, getFriendSessions, getFriendRequests, acceptFriendRequest, declineFriendRequest, getFriendshipStatus, getLeaderboard, getLikesForSessions, toggleLike } from '../lib/db'
import { MUSCLE_GROUPS, calcSessionVolume, calcVolumes, getRank, getTotalVolume } from '../lib/ranks'

const todayStr = () => new Date().toISOString().split('T')[0]
const isActiveToday = (lastActive) => lastActive && lastActive.split('T')[0] === todayStr()

export default function Social() {
  const { profile, socialCounts, updateSocialCounts, markFeedSeen, markRequestsSeen } = useAuth()
  const [tab, setTab] = useState('feed')
  const [feed, setFeed] = useState([])
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [friendPRs, setFriendPRs] = useState([])
  const [friendSessions, setFriendSessions] = useState([])
  const [friendVolumes, setFriendVolumes] = useState({})
  const [likes, setLikes] = useState({})
  const [leaderboard, setLeaderboard] = useState([])
  const [competeMode, setCompeteMode] = useState('weekly')
  const [loading, setLoading] = useState(true)
  const [leaderLoading, setLeaderLoading] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  const searchTimer = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => { if (profile) load() }, [profile?.id])

  // Clear feed badge as soon as the Social page opens (default tab is feed)
  useEffect(() => { markFeedSeen() }, [])

  useEffect(() => {
    if (tab === 'compete' && profile && leaderboard.length === 0) loadLeaderboard()
  }, [tab])

  const load = async () => {
    setLoading(true)
    try {
      const [{ feed: f, friends: fr }, req] = await Promise.all([
        getFriendsFeedAndFriends(profile.id),
        getFriendRequests(profile.id),
      ])
      if (!mounted.current) return
      setFeed(f); setFriends(fr); setRequests(req)
      const lastSeen = localStorage.getItem('lastFeedSeen') || new Date(0).toISOString()
      const newFeed = f.filter(s => s.completed_at > lastSeen).length
      updateSocialCounts({ requests: req.length, feed: newFeed })
      if (f.length) {
        const likesData = await getLikesForSessions(f.map(s => s.id))
        if (!mounted.current) return
        const map = {}
        for (const l of likesData) {
          if (!map[l.session_id]) map[l.session_id] = new Set()
          map[l.session_id].add(l.user_id)
        }
        setLikes(map)
      }
    } catch (e) { if (mounted.current) setError(e.message) }
    if (mounted.current) setLoading(false)
  }

  const switchTab = (key) => {
    setTab(key)
    if (key === 'feed') markFeedSeen()
    if (key === 'add') markRequestsSeen()
  }

  const loadLeaderboard = async () => {
    setLeaderLoading(true)
    try {
      const data = await getLeaderboard(profile.id, profile)
      if (mounted.current) setLeaderboard(data)
    } catch (e) { if (mounted.current) setError(e.message) }
    if (mounted.current) setLeaderLoading(false)
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
    } catch { if (mounted.current) setError('Friend request already sent or failed') }
  }

  const handleAccept = async (id) => {
    try { await acceptFriendRequest(profile.id, id); load() }
    catch (e) { if (mounted.current) setError(e.message) }
  }
  const handleDecline = async (id) => {
    try { await declineFriendRequest(profile.id, id); load() }
    catch (e) { if (mounted.current) setError(e.message) }
  }

  const viewFriendProfile = async (friend) => {
    setSelectedFriend(friend)
    try {
      const [prs, sessions] = await Promise.all([getFriendPRs(friend.id), getFriendSessions(friend.id)])
      setFriendPRs(prs)
      setFriendSessions(sessions)
      setFriendVolumes(calcVolumes(sessions))
    } catch {
      setFriendPRs([])
      setFriendSessions([])
      setFriendVolumes({})
    }
  }

  const handleLike = async (sessionId) => {
    const alreadyLiked = likes[sessionId]?.has(profile.id)
    // Optimistic update
    setLikes(prev => {
      const next = new Set(prev[sessionId] || [])
      alreadyLiked ? next.delete(profile.id) : next.add(profile.id)
      return { ...prev, [sessionId]: next }
    })
    try {
      await toggleLike(sessionId, profile.id)
    } catch {
      // Rollback on failure
      setLikes(prev => {
        const next = new Set(prev[sessionId] || [])
        alreadyLiked ? next.add(profile.id) : next.delete(profile.id)
        return { ...prev, [sessionId]: next }
      })
    }
  }

  if (selectedFriend) {
    const totalVol = getTotalVolume(friendVolumes)
    const rank = getRank(totalVol)
    return (
      <div style={{ padding:'var(--page-top) 20px 24px' }}>
        <button onClick={() => setSelectedFriend(null)} style={{ background:'none', border:'none', color:'var(--accent)', fontSize:14, fontWeight:600, marginBottom:20, padding:0 }}>← Back</button>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <Avatar name={selectedFriend.name} size={52} />
          <div>
            <div style={{ fontWeight:700, fontSize:20 }}>{selectedFriend.name}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>@{selectedFriend.username}</div>
          </div>
        </div>
        <div style={{ background:'var(--bg3)', border:`1px solid ${rank.color}`, borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="label" style={{ marginBottom:2 }}>RANK</div>
            <div style={{ fontSize:18, fontWeight:900, color:rank.color, fontFamily:'var(--mono)' }}>{rank.name}</div>
          </div>
          <div style={{ textAlign:'right', fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>
            <div>{Math.round(totalVol).toLocaleString()} lbs</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:24 }}>
          {[['SESSIONS', friendSessions.length], ['PRs SET', friendPRs.length]].map(([l,v]) => (
            <div key={l} className="card" style={{ padding:12, textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--accent)', fontFamily:'var(--mono)' }}>{v}</div>
              <div className="label" style={{ marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="label" style={{ marginBottom:12 }}>PERSONAL RECORDS</div>
        {friendPRs.length === 0 ? <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)', fontSize:13 }}>No PRs yet</div>
          : MUSCLE_GROUPS.map(g => {
            const gPRs = friendPRs.filter(p => p.muscle_group === g)
            if (!gPRs.length) return null
            return (
              <div key={g} style={{ marginBottom:20 }}>
                <div className="label" style={{ color:'var(--accent)', marginBottom:8 }}>{g.toUpperCase()}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {gPRs.map(pr => (
                    <div key={pr.id} className="card" style={{ padding:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontWeight:600, fontSize:14 }}>{pr.exercise}</span>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:20, fontWeight:800, color:'var(--accent)', fontFamily:'var(--mono)' }}>{pr.weight}</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>{pr.reps} reps · lbs</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    )
  }

  const sortedLeaderboard = [...leaderboard].sort((a, b) =>
    competeMode === 'weekly' ? b.weeklyCount - a.weeklyCount : b.monthlyCount - a.monthlyCount)

  const activeToday = friends.filter(f => isActiveToday(f.last_active))

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <div style={{ padding: 'var(--page-top) 20px 16px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Social</h2>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { key: 'feed',    label: 'Feed',    badge: socialCounts?.feed     || 0 },
            { key: 'friends', label: 'Friends', badge: 0 },
            { key: 'add',     label: 'Add',     badge: socialCounts?.requests || 0 },
            { key: 'compete', label: 'Compete', badge: 0 },
          ].map(({ key, label, badge }) => (
            <button key={key} onClick={() => switchTab(key)} style={{ background: tab === key ? 'var(--accent)' : 'var(--bg3)', border: 'none', borderRadius: 100, padding: '9px 18px', color: tab === key ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: tab === key ? 700 : 500, flexShrink: 0, position: 'relative' }}>
              {label}
              {badge > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--accent)', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid var(--bg2)' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        {/* FEED */}
        {tab === 'feed' && (
          loading ? <Loader /> : feed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No activity yet — add friends to see their workouts</div>
            </div>
          ) : feed.map(s => {
            const vol = calcSessionVolume(s)
            const groups = [...new Set((s.exercises||[]).map(e=>e.muscle_group||e.muscleGroup))].filter(Boolean)
            const user = s.profiles
            const likedByMe = likes[s.id]?.has(profile.id) || false
            const likeCount = likes[s.id]?.size || 0
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
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
                  {(s.exercises||[]).length} exercises · {Math.round(vol).toLocaleString()} lbs{s.duration ? ` · ${Math.floor(s.duration / 60)}m` : ''}
                </div>
                <button
                  onClick={() => handleLike(s.id)}
                  style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 6, color: likedByMe ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-block', transform: likedByMe ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    {likedByMe ? '♥' : '♡'}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, transition: 'color 0.15s' }}>
                    {likeCount > 0 ? likeCount : 'Like'}
                  </span>
                </button>
              </div>
            )
          })
        )}

        {/* FRIENDS */}
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
                <button onClick={() => viewFriendProfile(f)} style={{ background:'var(--accent-low)', border:`1px solid var(--accent)`, borderRadius:'var(--radius-sm)', padding:'8px 14px', color:'var(--accent)', fontSize:12, fontWeight:700 }}>View</button>
              </div>
            ))}
          </div>
        )}

        {/* ADD FRIENDS */}
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

        {/* COMPETE */}
        {tab === 'compete' && (
          <div>
            <div style={{ display: 'flex', gap: 8, background: 'var(--bg3)', borderRadius: 100, padding: 4, marginBottom: 20 }}>
              {[['weekly','This Week'],['monthly','This Month']].map(([m, label]) => (
                <button key={m} onClick={() => setCompeteMode(m)} style={{ flex: 1, background: competeMode === m ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 100, padding: '10px 0', color: competeMode === m ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: competeMode === m ? 700 : 500 }}>{label}</button>
              ))}
            </div>

            {leaderLoading ? <Loader /> : sortedLeaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Add friends to compete!</div>
              </div>
            ) : sortedLeaderboard.map((entry, i) => {
              const count = competeMode === 'weekly' ? entry.weeklyCount : entry.monthlyCount
              const isPodium = i < 3
              const podiumBg = i === 0 ? 'var(--accent)' : i === 2 ? 'rgba(224,22,30,0.5)' : 'var(--bg3)'
              return (
                <div key={entry.id} style={{ borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, background: isPodium ? podiumBg : 'var(--bg3)', border: entry.isMe && !isPodium ? '1px solid var(--accent)' : '1px solid transparent' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: isPodium ? '#fff' : 'var(--text-dim)' }}>{i + 1}</span>
                  </div>
                  <Avatar name={entry.name} size={36} light={isPodium} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: isPodium ? '#fff' : 'var(--text)' }}>
                      {entry.name}{entry.isMe ? ' (you)' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: isPodium ? 'rgba(255,255,255,0.7)' : 'var(--text-dim)', marginTop: 1 }}>
                      {count} session{count !== 1 ? 's' : ''}{entry.streak > 0 ? ` · ${entry.streak} day streak` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: isPodium ? '#fff' : 'var(--text)' }}>
                      {Math.round((competeMode === 'weekly' ? entry.weeklyVolume : entry.monthlyVolume) || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: isPodium ? 'rgba(255,255,255,0.6)' : 'var(--text-dim)' }}>lbs</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Avatar({ name, size = 40, light = false }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: light ? 'rgba(255,255,255,0.2)' : 'var(--accent-low)', border: `1px solid ${light ? 'rgba(255,255,255,0.4)' : 'var(--accent)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 800, color: light ? '#fff' : 'var(--accent)', flexShrink: 0 }}>
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
