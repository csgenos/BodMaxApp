import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getWeightLog, addWeight, getPRs, getSessions, getProgressPhotos, addProgressPhoto, deleteProgressPhoto } from '../lib/db'
import { calcVolumes, getRank, getRankProgress, MUSCLE_GROUPS } from '../lib/ranks'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const TT = { contentStyle: { background: '#141414', border: '1px solid #222', borderRadius: 8, color: '#f0f0f0', fontSize: 12 }, cursor: { stroke: '#333' } }

export default function Progress() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('history')
  const [weightLog, setWeightLog] = useState([])
  const [prs, setPRs] = useState([])
  const [sessions, setSessions] = useState([])
  const [volumes, setVolumes] = useState({})
  const [newWeight, setNewWeight] = useState('')
  const [showAddW, setShowAddW] = useState(false)
  const [histRange, setHistRange] = useState(30)
  // Photos
  const [photos, setPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photoWeight, setPhotoWeight] = useState('')
  const [photoNotes, setPhotoNotes] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showPhotoForm, setShowPhotoForm] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const fileInputRef = useRef(null)
  const pendingFileRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    getWeightLog(profile.id).then(setWeightLog)
    getPRs(profile.id).then(setPRs)
    getSessions(profile.id).then(s => { setSessions(s); setVolumes(calcVolumes(s)) })
  }, [profile?.id])

  useEffect(() => {
    if (tab === 'photos' && profile) loadPhotos()
  }, [tab, profile?.id])

  const loadPhotos = async () => {
    setPhotosLoading(true)
    setPhotos(await getProgressPhotos(profile.id))
    setPhotosLoading(false)
  }

  const handleAddWeight = async () => {
    if (!newWeight) return
    await addWeight(profile.id, new Date().toISOString().split('T')[0], +newWeight)
    setWeightLog(await getWeightLog(profile.id))
    setNewWeight(''); setShowAddW(false)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    pendingFileRef.current = file
    setShowPhotoForm(true)
    e.target.value = ''
  }

  const handleUploadPhoto = async () => {
    const file = pendingFileRef.current
    if (!file) return
    setPhotoUploading(true)
    try {
      await addProgressPhoto(profile.id, file, photoWeight ? +photoWeight : null, photoNotes || null)
      await loadPhotos()
      setShowPhotoForm(false)
      setPhotoWeight('')
      setPhotoNotes('')
      pendingFileRef.current = null
    } catch (e) {
      alert('Upload failed: ' + e.message)
    }
    setPhotoUploading(false)
  }

  const handleDeletePhoto = async (photo) => {
    if (!confirm('Delete this photo?')) return
    await deleteProgressPhoto(photo.id, photo.photo_url)
    setSelectedPhoto(null)
    await loadPhotos()
  }

  const weightChartData = weightLog.slice(-histRange).map(e => ({
    date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weight: e.weight
  }))

  const volumeByWeek = () => {
    const weeks = {}
    sessions.slice(0, 56).forEach(s => {
      const d = new Date(s.date)
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!weeks[key]) weeks[key] = 0
      const vol = (s.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).reduce((s2, set) => s2 + ((+set.weight || 0) * (+set.reps || 0)), 0), 0)
      weeks[key] += vol
    })
    return Object.entries(weeks).slice(-8).map(([week, vol]) => ({ week, vol: Math.round(vol / 1000 * 10) / 10 })).reverse()
  }

  const freqData = () => {
    const weeks = {}
    sessions.slice(0, 56).forEach(s => {
      const d = new Date(s.date)
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!weeks[key]) weeks[key] = new Set()
      weeks[key].add(s.date?.split('T')[0])
    })
    return Object.entries(weeks).slice(-8).map(([week, days]) => ({ week, days: days.size })).reverse()
  }

  const volumeData = MUSCLE_GROUPS.map(g => ({ name: g.slice(0, 4).toUpperCase(), vol: Math.round((volumes[g] || 0) / 1000 * 10) / 10 }))
  const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, outline: 'none' }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '52px 20px 0', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Progress</h2>
        <div style={{ display: 'flex' }}>
          {['history', 'weight', 'photos', 'prs', 'volume'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`, color: tab === t ? 'var(--accent)' : 'var(--text-muted)', padding: '10px 0', fontSize: '7px', letterSpacing: '2px', fontFamily: 'var(--mono)', fontWeight: 600, textTransform: 'uppercase' }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[30, 90, 180].map(r => (
                <button key={r} onClick={() => setHistRange(r)} style={{ flex: 1, background: histRange === r ? 'var(--accent-low)' : 'var(--bg3)', border: `1px solid ${histRange === r ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '8px 0', color: histRange === r ? 'var(--accent)' : 'var(--text-dim)', fontSize: 11, fontWeight: 700 }}>{r}d</button>
              ))}
            </div>
            <ChartCard title="WEEKLY VOLUME (k lbs)">
              {volumeByWeek().length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeByWeek()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} unit="k" />
                    <Tooltip {...TT} formatter={v => [`${v}k lbs`, 'Volume']} />
                    <Bar dataKey="vol" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty>Not enough data yet</Empty>}
            </ChartCard>
            <ChartCard title="SESSIONS PER WEEK">
              {freqData().length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={freqData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...TT} formatter={v => [`${v} days`, 'Sessions']} />
                    <Bar dataKey="days" fill="#4a9eb5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty>Not enough data yet</Empty>}
            </ChartCard>
            <div style={{ display: 'flex', gap: 10 }}>
              <StatCard label="TOTAL SESSIONS" value={sessions.length} />
              <StatCard label="TOTAL PRs" value={prs.length} />
              <StatCard label="SINCE" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '—'} />
            </div>
          </div>
        )}

        {/* WEIGHT TAB */}
        {tab === 'weight' && (
          <div>
            {weightChartData.length > 1 && (
              <ChartCard title="WEIGHT TREND">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="date" tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} domain={['dataMin - 3', 'dataMax + 3']} />
                    <Tooltip {...TT} />
                    <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {!showAddW ? (
              <button onClick={() => setShowAddW(true)} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: 14, color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>+ LOG WEIGHT</button>
            ) : (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input style={{ ...INP, flex: 1 }} type="number" inputMode="decimal" placeholder={`Weight (${profile?.unit || 'lbs'})`} value={newWeight} onChange={e => setNewWeight(e.target.value)} autoFocus />
                <button onClick={handleAddWeight} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px 18px', color: '#fff', fontWeight: 700 }}>LOG</button>
                <button onClick={() => setShowAddW(false)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', color: 'var(--text-dim)' }}>×</button>
              </div>
            )}
            {weightLog.length === 0 && <Empty>No weight logged yet</Empty>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...weightLog].reverse().slice(0, 15).map((e, i) => (
                <div key={i} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{e.weight} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{profile?.unit || 'lbs'}</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHOTOS TAB */}
        {tab === 'photos' && (
          <div>
            {/* Hidden file input — capture="environment" opens camera on mobile */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: 14, color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 16 }}
            >
              + ADD PROGRESS PHOTO
            </button>

            {/* Upload form */}
            {showPhotoForm && (
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>PHOTO DETAILS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  <input
                    style={INP}
                    type="number"
                    inputMode="decimal"
                    placeholder={`Body weight (${profile?.unit || 'lbs'}) — optional`}
                    value={photoWeight}
                    onChange={e => setPhotoWeight(e.target.value)}
                  />
                  <input
                    style={INP}
                    placeholder="Notes — optional"
                    value={photoNotes}
                    onChange={e => setPhotoNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setShowPhotoForm(false); pendingFileRef.current = null; setPhotoWeight(''); setPhotoNotes('') }}
                    style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, color: 'var(--text-dim)', fontWeight: 600 }}
                  >Cancel</button>
                  <button
                    onClick={handleUploadPhoto}
                    disabled={photoUploading}
                    style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: 12, color: '#fff', fontWeight: 700, fontSize: 14 }}
                  >{photoUploading ? 'UPLOADING...' : 'UPLOAD'}</button>
                </div>
              </div>
            )}

            {photosLoading ? (
              <Loader />
            ) : photos.length === 0 ? (
              <Empty>No progress photos yet — add your first one!</Empty>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {photos.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPhoto(p)}
                    style={{ borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative', aspectRatio: '3/4', background: 'var(--bg3)', cursor: 'pointer' }}
                  >
                    <img
                      src={p.photo_url}
                      alt={p.date}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', padding: '20px 8px 8px' }}>
                      <div style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>
                        {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </div>
                      {p.weight && (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--mono)' }}>
                          {p.weight} {profile?.unit || 'lbs'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Photo lightbox */}
            {selectedPhoto && (
              <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', flexDirection: 'column' }}
                onClick={() => setSelectedPhoto(null)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '52px 20px 16px' }} onClick={e => e.stopPropagation()}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
                      {new Date(selectedPhoto.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    {selectedPhoto.weight && (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                        {selectedPhoto.weight} {profile?.unit || 'lbs'}
                      </div>
                    )}
                    {selectedPhoto.notes && (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{selectedPhoto.notes}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDeletePhoto(selectedPhoto)}
                      style={{ background: 'rgba(224,22,30,0.2)', border: '1px solid #e0161e', borderRadius: 8, padding: '8px 14px', color: '#e0161e', fontWeight: 700, fontSize: 12 }}
                    >DELETE</button>
                    <button
                      onClick={() => setSelectedPhoto(null)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 20, lineHeight: 1 }}
                    >×</button>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px 40px' }}>
                  <img
                    src={selectedPhoto.photo_url}
                    alt={selectedPhoto.date}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRs TAB */}
        {tab === 'prs' && (
          <div>
            {prs.length === 0 && <Empty>No PRs yet. Log a session.</Empty>}
            {MUSCLE_GROUPS.map(g => {
              const gPRs = prs.filter(p => p.muscle_group === g)
              if (!gPRs.length) return null
              return (
                <div key={g} style={{ marginBottom: 24 }}>
                  <div className="label" style={{ color: 'var(--accent)', marginBottom: 8 }}>{g.toUpperCase()}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gPRs.map(pr => (
                      <div key={pr.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{pr.exercise}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>{new Date(pr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{pr.weight}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{pr.reps} reps · lbs</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VOLUME TAB */}
        {tab === 'volume' && (
          <div>
            <ChartCard title="VOLUME BY MUSCLE (k lbs)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={volumeData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#444', fontSize: 9 }} axisLine={false} tickLine={false} unit="k" />
                  <Tooltip {...TT} formatter={v => [`${v}k lbs`, 'Volume']} />
                  <Bar dataKey="vol" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MUSCLE_GROUPS.map(g => {
                const vol = volumes[g] || 0
                const rank = getRank(vol)
                return (
                  <div key={g} className="card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{g}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, letterSpacing: '2px', color: rank.color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{rank.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{Math.round(vol).toLocaleString()} lbs</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="label" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ flex: 1, padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{value}</div>
      <div className="label" style={{ marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>{children}</div>
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
