import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDietByDate, addDietEntry, deleteDietEntry } from '../lib/db'

const todayStr = () => new Date().toISOString().split('T')[0]
const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, width: '100%' }

export default function Diet() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ meal: '', calories: '', protein: '', carbs: '', fat: '', photo: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef()
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const load = async () => {
    try {
      const data = await getDietByDate(profile.id, todayStr())
      if (mounted.current) setEntries(data)
    } catch (e) {
      if (mounted.current) setError(e.message)
    }
  }

  useEffect(() => { if (profile) load() }, [profile?.id])

  const totalCal = entries.reduce((s, e) => s + (e.calories || 0), 0)
  const totalProt = entries.reduce((s, e) => s + (e.protein || 0), 0)
  const totalCarbs = entries.reduce((s, e) => s + (e.carbs || 0), 0)
  const totalFat = entries.reduce((s, e) => s + (e.fat || 0), 0)
  const pct = (cur, target) => target ? Math.min(100, Math.round(cur / target * 100)) : 0
  const calPct = pct(totalCal, profile?.target_calories)
  const protPct = pct(totalProt, profile?.target_protein)
  const carbPct = pct(totalCarbs, profile?.target_carbs)
  const fatPct = pct(totalFat, profile?.target_fat)

  const handlePhoto = e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, photo: ev.target.result }))
    reader.readAsDataURL(file)
  }

  const handleAdd = async () => {
    if (!form.meal || !form.calories || saving) return
    setSaving(true)
    setError(null)
    try {
      await addDietEntry(profile.id, {
        date: todayStr(),
        meal: form.meal,
        calories: +form.calories,
        protein: form.protein ? +form.protein : 0,
        carbs: form.carbs ? +form.carbs : 0,
        fat: form.fat ? +form.fat : 0,
        photo_url: form.photo,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      })
      if (mounted.current) {
        setForm({ meal: '', calories: '', protein: '', carbs: '', fat: '', photo: null })
        setShowAdd(false)
        await load()
      }
    } catch (e) {
      if (mounted.current) setError(e.message)
    }
    if (mounted.current) setSaving(false)
  }

  const handleDelete = async id => {
    try {
      await deleteDietEntry(profile.id, id)
      if (mounted.current) await load()
    } catch (e) {
      if (mounted.current) setError(e.message)
    }
  }

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <div style={{ padding: '52px 20px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 16 }}>Diet</h2>
        <MacroBar label="CALORIES" current={totalCal.toLocaleString()} target={(profile?.target_calories || 0).toLocaleString()} pct={calPct} color="var(--accent)" />
        <div style={{ marginTop: 10 }}>
          <MacroBar label="PROTEIN" current={`${totalProt}g`} target={`${profile?.target_protein || 0}g`} pct={protPct} color="#4a9eb5" />
        </div>
        {(profile?.target_carbs || totalCarbs > 0) && (
          <div style={{ marginTop:10 }}>
            <MacroBar label="CARBS" current={`${totalCarbs}g`} target={`${profile?.target_carbs||0}g`} pct={carbPct} color="#c88a2e" />
          </div>
        )}
        {(profile?.target_fat || totalFat > 0) && (
          <div style={{ marginTop:10 }}>
            <MacroBar label="FAT" current={`${totalFat}g`} target={`${profile?.target_fat||0}g`} pct={fatPct} color="#9a5ad4" />
          </div>
        )}
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {error && <div style={{ padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}
        {entries.length === 0 && !showAdd && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No meals logged today</div>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="card" style={{ overflow: 'hidden' }}>
            {entry.photo_url && <img src={entry.photo_url} alt="" style={{ width: '100%', height: 130, objectFit: 'cover' }} />}
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{entry.meal}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--mono)' }}>{entry.time}</div>
                </div>
                <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, padding: '0 0 0 8px' }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{entry.calories} kcal</span>
                {entry.protein > 0 && <span style={{ fontSize: 13, color: '#4a9eb5', fontWeight: 700, fontFamily: 'var(--mono)' }}>{entry.protein}g P</span>}
                {entry.carbs > 0 && <span style={{ fontSize: 13, color: '#c88a2e', fontWeight: 700, fontFamily: 'var(--mono)' }}>{entry.carbs}g C</span>}
                {entry.fat > 0 && <span style={{ fontSize: 13, color: '#9a5ad4', fontWeight: 700, fontFamily: 'var(--mono)' }}>{entry.fat}g F</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="label">LOG MEAL</div>
          <input style={INP} placeholder="Meal name *" value={form.meal} onChange={e => setForm(f => ({ ...f, meal: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10 }}>
            <input style={INP} type="number" placeholder="Calories *" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
            <input style={INP} type="number" placeholder="Protein (g)" value={form.protein} onChange={e => setForm(f => ({ ...f, protein: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input style={INP} type="number" placeholder="Carbs (g)" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))} />
            <input style={INP} type="number" placeholder="Fat (g)" value={form.fat} onChange={e => setForm(f => ({ ...f, fat: e.target.value }))} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
          {form.photo ? (
            <div style={{ position: 'relative' }}>
              <img src={form.photo} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
              <button onClick={() => setForm(f => ({ ...f, photo: null }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, fontSize: 16 }}>×</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()} style={{ background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 13, color: 'var(--text-muted)', fontSize: 13 }}>📷 Add Photo (optional)</button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, color: 'var(--text-dim)', fontWeight: 600 }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving} style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: 12, color: '#fff', fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? 'SAVING...' : 'LOG MEAL'}</button>
          </div>
        </div>
      )}

      {!showAdd && (
        <div style={{ padding: '8px 20px 0' }}>
          <button onClick={() => setShowAdd(true)} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', padding: 16, color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '1px' }}>+ LOG MEAL</button>
        </div>
      )}
    </div>
  )
}

function MacroBar({ label, current, target, pct, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="label">{label}</span>
        <span style={{ fontSize: 11, color, fontFamily: 'var(--mono)', fontWeight: 700 }}>{current} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {target}</span></span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}
