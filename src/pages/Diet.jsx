import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { useAuth } from '../context/AuthContext'
import { getDietByDate, addDietEntry, deleteDietEntry, getTodayCardioCalories, getSavedMeals, saveMeal, deleteSavedMeal } from '../lib/db'
import { searchFood } from '../lib/food'
import { FlameIcon, CameraIcon, BarcodeIcon, CopyIcon } from '../lib/icons'

const todayStr = () => new Date().toISOString().split('T')[0]
const INP = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, width: '100%' }

export default function Diet() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ meal: '', calories: '', protein: '', carbs: '', fat: '', photo: null })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [cardioCalories, setCardioCalories] = useState(0)
  const [savedMeals, setSavedMeals] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedFood, setSelectedFood] = useState(null)
  const [servingG, setServingG] = useState('100')
  const [savedFeedback, setSavedFeedback] = useState(null)
  const [showBarcode, setShowBarcode] = useState(false)
  const [copyingYesterday, setCopyingYesterday] = useState(false)
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

  useEffect(() => {
    if (!profile) return
    load()
    getTodayCardioCalories(profile.id).then(c => { if (mounted.current) setCardioCalories(c) }).catch(() => {})
    getSavedMeals(profile.id).then(m => { if (mounted.current) setSavedMeals(m) }).catch(() => {})
  }, [profile?.id])

  useEffect(() => {
    const q = form.meal?.trim()
    if (!q || q.length < 2) { setSearchResults([]); setSearchLoading(false); return }
    setSearchLoading(true)
    searchFood(q).then(results => { setSearchResults(results); setSearchLoading(false) })
  }, [form.meal])

  useEffect(() => {
    if (!selectedFood || !servingG || +servingG <= 0) return
    const f = +servingG / 100
    setForm(prev => ({
      ...prev,
      calories: String(Math.round(selectedFood.cal100 * f)),
      protein: String(parseFloat((selectedFood.prot100 * f).toFixed(1))),
      carbs: String(parseFloat((selectedFood.carb100 * f).toFixed(1))),
      fat: String(parseFloat((selectedFood.fat100 * f).toFixed(1))),
    }))
  }, [servingG, selectedFood])

  useEffect(() => {
    const el = document.getElementById('scroll-root')
    if (!el) return
    el.style.overflow = showAdd ? 'hidden' : ''
    return () => { el.style.overflow = '' }
  }, [showAdd])

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
    setSaving(true); setError(null)
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
        setSelectedFood(null)
        setServingG('100')
        setSearchResults([])
        await load()
      }
    } catch (e) {
      if (mounted.current) setError(e.message)
    }
    if (mounted.current) setSaving(false)
  }

  const handleDelete = async id => {
    try { await deleteDietEntry(profile.id, id); if (mounted.current) await load() }
    catch (e) { if (mounted.current) setError(e.message) }
  }

  const handleSaveMeal = async (entry) => {
    try {
      await saveMeal(profile.id, { name: entry.meal, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat })
      setSavedMeals(await getSavedMeals(profile.id))
      setSavedFeedback(entry.id)
      setTimeout(() => setSavedFeedback(null), 1500)
    } catch (e) { if (mounted.current) setError(e.message) }
  }

  const handleDeleteSavedMeal = async (id) => {
    try { await deleteSavedMeal(profile.id, id); setSavedMeals(await getSavedMeals(profile.id)) }
    catch (e) { if (mounted.current) setError(e.message) }
  }

  const handleSelectSavedMeal = (meal) => {
    setSelectedFood(null)
    setServingG('100')
    setForm(f => ({ ...f, meal: meal.name, calories: String(meal.calories), protein: String(meal.protein || ''), carbs: String(meal.carbs || ''), fat: String(meal.fat || '') }))
  }

  const handleBarcodeFound = (food) => {
    setSelectedFood(food)
    setServingG('100')
    setForm(f => ({ ...f, meal: food.name }))
    setShowBarcode(false)
    if (!showAdd) setShowAdd(true)
  }

  const handleCopyYesterday = async () => {
    if (copyingYesterday) return
    const yd = new Date(); yd.setDate(yd.getDate() - 1)
    const yStr = yd.toISOString().split('T')[0]
    setCopyingYesterday(true); setError(null)
    try {
      const yEntries = await getDietByDate(profile.id, yStr)
      if (!yEntries.length) { setError("No meals logged yesterday"); setCopyingYesterday(false); return }
      await Promise.all(yEntries.map(e => addDietEntry(profile.id, {
        date: todayStr(), meal: e.meal, calories: e.calories,
        protein: e.protein, carbs: e.carbs, fat: e.fat, time: e.time,
      })))
      await load()
    } catch (e) { if (mounted.current) setError(e.message) }
    if (mounted.current) setCopyingYesterday(false)
  }

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: 'var(--page-top) 20px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800 }}>Nutrition</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCopyYesterday} disabled={copyingYesterday} title="Copy yesterday's meals" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 100, padding: '10px 14px', color: 'var(--text-dim)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, opacity: copyingYesterday ? 0.6 : 1 }}><CopyIcon size={15} />{copyingYesterday ? '...' : 'Yesterday'}</button>
            <button onClick={() => setShowAdd(true)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 100, padding: '10px 18px', color: '#fff', fontWeight: 700, fontSize: 14 }}>+ Log Meal</button>
          </div>
        </div>
        <MacroBar label="CALORIES" current={totalCal.toLocaleString()} target={(profile?.target_calories || 0).toLocaleString()} pct={calPct} color="var(--accent)" />
        <div style={{ marginTop: 10 }}>
          <MacroBar label="PROTEIN" current={`${totalProt}g`} target={`${profile?.target_protein || 0}g`} pct={protPct} color="#4a9eb5" />
        </div>
        <div style={{ marginTop: 10 }}>
          <MacroBar label="CARBS" current={`${totalCarbs}g`} target={`${profile?.target_carbs || 0}g`} pct={carbPct} color="#c88a2e" />
        </div>
        <div style={{ marginTop: 10 }}>
          <MacroBar label="FAT" current={`${totalFat}g`} target={`${profile?.target_fat || 0}g`} pct={fatPct} color="#9a5ad4" />
        </div>
        {cardioCalories > 0 && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(74,158,181,0.1)', border: '1px solid rgba(74,158,181,0.3)', borderRadius: 8 }}>
            <span style={{ fontSize: 10, color: '#4a9eb5', fontFamily: 'var(--mono)', letterSpacing: '2px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><FlameIcon size={12} /> CARDIO BURNED</span>
            <span style={{ fontSize: 12, color: '#4a9eb5', fontFamily: 'var(--mono)', fontWeight: 700 }}>-{cardioCalories} kcal</span>
          </div>
        )}
      </div>

      {/* Meals list */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <div style={{ padding: '10px 14px', background: 'rgba(224,22,30,0.1)', border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)', fontSize: 13 }}>{error}</div>}

        {entries.length > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4 }}>Today's Meals</div>
        )}

        {entries.length === 0 && !showAdd && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: 14 }}>No meals logged today</div>
        )}

        {entries.map(entry => (
          <div key={entry.id} className="card" style={{ overflow: 'hidden' }}>
            {entry.photo_url && <img src={entry.photo_url} alt="" style={{ width: '100%', height: 130, objectFit: 'cover' }} />}
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{entry.meal}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{entry.time}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, padding: '0 0 0 8px' }}>×</button>
                  <button
                    onClick={() => handleSaveMeal(entry)}
                    style={{ background: 'none', border: 'none', color: savedFeedback === entry.id ? '#22c55e' : 'var(--text-muted)', fontSize: 12, padding: '0 0 0 8px', fontWeight: 700, fontFamily: 'var(--mono)' }}
                  >
                    {savedFeedback === entry.id ? 'SAVED' : 'SAVE'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <MacroBadge value={`${entry.calories} cal`} color="var(--accent)" />
                {entry.protein > 0 && <MacroBadge value={`${entry.protein}g P`} color="#4a9eb5" />}
                {entry.carbs > 0 && <MacroBadge value={`${entry.carbs}g C`} color="#c88a2e" />}
                {entry.fat > 0 && <MacroBadge value={`${entry.fat}g F`} color="#9a5ad4" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Log meal form modal-style */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowAdd(false)}>
          <div style={{ background: 'var(--bg2)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Log Meal</span>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={INP} placeholder="Meal name *" value={form.meal} onChange={e => setForm(f => ({ ...f, meal: e.target.value }))} />
              {(searchLoading || searchResults.length > 0) && (
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: -8 }}>
                  {searchLoading && <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>Searching...</div>}
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedFood(r); setServingG('100'); setForm(f => ({ ...f, meal: r.name })); setSearchResults([]) }}
                      style={{ width: '100%', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', padding: '10px 14px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.name}</div>
                        {r.brand && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.brand}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{r.cal100} cal</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>P:{r.prot100}g per 100g</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedFood && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>Serving:</span>
                  <input
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 15, width: 60, fontFamily: 'var(--mono)', outline: 'none' }}
                    type="number"
                    inputMode="decimal"
                    value={servingG}
                    onChange={e => setServingG(e.target.value)}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>g</span>
                  <button onClick={() => { setSelectedFood(null); setServingG('100') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13 }}>Clear</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <input style={INP} type="number" placeholder="Calories *" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
                <input style={INP} type="number" placeholder="Protein (g)" value={form.protein} onChange={e => setForm(f => ({ ...f, protein: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input style={INP} type="number" placeholder="Carbs (g)" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))} />
                <input style={INP} type="number" placeholder="Fat (g)" value={form.fat} onChange={e => setForm(f => ({ ...f, fat: e.target.value }))} />
              </div>
              {savedMeals.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '4px', color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginBottom: 8 }}>SAVED MEALS</div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {savedMeals.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 10px 6px 12px', flexShrink: 0 }}>
                        <button onClick={() => handleSelectSavedMeal(m)} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, fontWeight: 600, padding: 0 }}>{m.name} <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 10 }}>{m.calories}cal</span></button>
                        <button onClick={() => handleDeleteSavedMeal(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, padding: '0 0 0 4px', lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setShowBarcode(true)} style={{ width: '100%', background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 13, color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><BarcodeIcon size={16} /> Scan Barcode</button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
              {form.photo ? (
                <div style={{ position: 'relative' }}>
                  <img src={form.photo} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  <button onClick={() => setForm(f => ({ ...f, photo: null }))} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, fontSize: 16 }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current.click()} style={{ background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: 13, color: 'var(--text-dim)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><CameraIcon size={16} /> Add Photo (optional)</button>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, color: 'var(--text-dim)', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.meal || !form.calories} style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: 14, color: '#fff', fontWeight: 700, fontSize: 14, opacity: (saving || !form.meal || !form.calories) ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : 'Log Meal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showBarcode && <BarcodeModal onFound={handleBarcodeFound} onClose={() => setShowBarcode(false)} />}
    </div>
  )
}

function MacroBar({ label, current, target, pct, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          <span style={{ color, fontWeight: 700 }}>{current}</span> / {target}
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function MacroBadge({ value, color }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}22`, padding: '4px 10px', borderRadius: 20 }}>{value}</span>
  )
}

const INP_MODAL = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '12px 14px', fontSize: 15, width: '100%' }

function BarcodeModal({ onFound, onClose }) {
  const [val, setVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef()
  const mountedRef = useRef(true)
  const readerRef = useRef(null)
  const nativeStreamRef = useRef(null)
  const nativeScanRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; stopCamera() }
  }, [])

  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      try { readerRef.current.reset() } catch {}
      readerRef.current = null
    }
    if (nativeScanRef.current) cancelAnimationFrame(nativeScanRef.current)
    nativeStreamRef.current?.getTracks().forEach(t => t.stop())
    nativeStreamRef.current = null
    if (mountedRef.current) setScanning(false)
  }, [])

  const startCamera = async () => {
    setScanning(true); setError(null)
    if ('BarcodeDetector' in window) {
      // Fast native path (Chrome/Edge/Safari 17.4+)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        nativeStreamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] })
        const scan = async () => {
          if (!mountedRef.current || !nativeStreamRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) { stopCamera(); lookup(codes[0].rawValue); return }
          } catch {}
          nativeScanRef.current = requestAnimationFrame(scan)
        }
        nativeScanRef.current = requestAnimationFrame(scan)
      } catch { stopCamera(); setError('Camera unavailable') }
    } else {
      // ZXing fallback — works on all browsers
      try {
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader
        const devices = await reader.listVideoInputDevices()
        const deviceId = devices.find(d => /back|rear|environment/i.test(d.label))?.deviceId || devices[0]?.deviceId
        reader.decodeFromVideoDevice(deviceId || null, videoRef.current, (result, err) => {
          if (!mountedRef.current) return
          if (result) { stopCamera(); lookup(result.getText()); return }
          if (err && !(err instanceof NotFoundException)) setError('Scanner error')
        })
      } catch { stopCamera(); setError('Camera unavailable') }
    }
  }

  const lookup = async (code) => {
    const trimmed = (code || '').trim()
    if (!trimmed) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(trimmed)}.json`)
      const data = await res.json()
      if (data.status !== 1) { setError('Product not found'); setLoading(false); return }
      const p = data.product
      const name = p.product_name || p.product_name_en || ''
      const brand = p.brands?.split(',')[0]?.trim() || ''
      const label = [name, brand].filter(Boolean).join(' — ')
      const n = p.nutriments || {}
      onFound({
        name: label || 'Scanned product',
        cal100: Math.round(n['energy-kcal_100g'] || n['energy-kcal'] || 0),
        prot100: parseFloat((+(n.proteins_100g || 0)).toFixed(1)),
        carb100: parseFloat((+(n.carbohydrates_100g || 0)).toFixed(1)),
        fat100: parseFloat((+(n.fat_100g || 0)).toFixed(1)),
      })
    } catch { setError('Lookup failed') }
    if (mountedRef.current) setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg2)', borderRadius: 'var(--radius)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Scan Barcode</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22 }}>×</button>
        </div>
        <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scanning ? (
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
              <video ref={videoRef} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} playsInline muted />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '70%', height: 60, border: '2px solid var(--accent)', borderRadius: 6 }} />
              </div>
              <button onClick={stopCamera} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, fontSize: 18 }}>×</button>
              <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>Align barcode within frame…</div>
            </div>
          ) : (
            <button onClick={startCamera} style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: 13, color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <BarcodeIcon size={18} /> Open Camera
            </button>
          )}
          <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-muted)' }}>or enter barcode manually</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ ...INP_MODAL, flex: 1 }}
              type="text"
              inputMode="numeric"
              placeholder="e.g. 5449000000996"
              value={val}
              onChange={e => setVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup(val)}
            />
            <button onClick={() => lookup(val)} disabled={loading || !val.trim()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0 18px', color: '#fff', fontWeight: 700, fontSize: 14, opacity: (!val.trim() || loading) ? 0.6 : 1 }}>
              {loading ? '…' : 'GO'}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--accent)', textAlign: 'center' }}>{error}</div>}
        </div>
      </div>
    </div>
  )
}
