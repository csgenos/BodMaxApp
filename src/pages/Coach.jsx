import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createStripeCheckout, getDailyInsight, getCoachMessages, askCoach } from '../lib/db'
import { SparkleIcon, BoltIcon, TargetIcon, FlameIcon } from '../lib/icons'

const TRIAL_LIMIT = 3

export default function Coach() {
  const { user, profile, isSubscribed, refreshProfile } = useAuth()
  const location = useLocation()
  const [insight, setInsight] = useState(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [trialUses, setTrialUses] = useState(profile?.ai_coach_trial_uses ?? 0)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (new URLSearchParams(location.search).get('subscribed') === '1') {
      refreshProfile()
    }
  }, [])

  // Keep trial count in sync with profile
  useEffect(() => {
    setTrialUses(profile?.ai_coach_trial_uses ?? 0)
  }, [profile?.ai_coach_trial_uses])

  const trialRemaining = TRIAL_LIMIT - trialUses
  const trialExhausted = !isSubscribed && trialRemaining <= 0
  const isTrial = !isSubscribed && !trialExhausted

  useEffect(() => {
    if (!isSubscribed && trialExhausted) return
    if (isSubscribed) { loadInsight(); loadMessages() }
    else loadMessages() // trial users can see their chat history
  }, [isSubscribed, trialExhausted])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadInsight = async () => {
    setInsightLoading(true)
    try {
      const profileSummary = profile ? `Goal: ${profile.goal || 'build muscle'}, Unit: ${profile.unit || 'lbs'}` : ''
      const d = await getDailyInsight(user.id, profileSummary)
      setInsight(d)
    } catch { /* non-fatal */ }
    finally { setInsightLoading(false) }
  }

  const loadMessages = async () => {
    try {
      const msgs = await getCoachMessages(user.id)
      setMessages(msgs)
    } catch { /* non-fatal */ }
  }

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    setSending(true)
    const optimistic = { id: 'opt-' + Date.now(), role: 'user', content: msg }
    setMessages(m => [...m, optimistic])
    try {
      const profileSummary = profile ? `Goal: ${profile.goal || 'build muscle'}, Unit: ${profile.unit || 'lbs'}` : ''
      const res = await askCoach(user.id, msg, profileSummary)
      const { reply } = res
      const assistantMsg = { id: 'opt-a-' + Date.now(), role: 'assistant', content: reply }
      setMessages(m => [...m.filter(x => x.id !== optimistic.id), { ...optimistic, id: 'u-' + Date.now() }, assistantMsg])
      // Update trial counter from response and refresh profile
      if (!isSubscribed && res.trialUses != null) {
        setTrialUses(res.trialUses)
        refreshProfile()
      }
    } catch (e) {
      setMessages(m => m.filter(x => x.id !== optimistic.id))
      setInput(msg)
    }
    setSending(false)
  }

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    try {
      const { checkoutUrl } = await createStripeCheckout(user.id)
      if (checkoutUrl) window.location.href = checkoutUrl
    } catch (e) {
      alert('Could not start checkout: ' + e.message)
    }
    setCheckoutLoading(false)
  }

  if (trialExhausted) return <UpsellView onUpgrade={handleUpgrade} loading={checkoutLoading} trialExhausted />
  if (!isSubscribed && !isTrial) return <UpsellView onUpgrade={handleUpgrade} loading={checkoutLoading} />

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 'var(--page-top) 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ color: 'var(--accent)' }}><SparkleIcon size={22} /></span>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>AI Coach</h1>
        </div>

        {profile?.beta && (
          <div style={{ background: 'var(--accent-low)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            Beta Access — all Coach features are on us. Thank you for testing!
          </div>
        )}

        {/* Trial banner */}
        {isTrial && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>Free Trial</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{trialRemaining} of {TRIAL_LIMIT} messages remaining</div>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', fontWeight: 700, fontSize: 12, opacity: checkoutLoading ? 0.7 : 1 }}
            >
              Upgrade
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 0' }}>
        {/* Daily Insight — paid only */}
        {isSubscribed && (insightLoading ? (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, opacity: 0.5 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Loading insight…</div>
          </div>
        ) : insight ? (
          <div style={{ background: 'var(--bg2)', borderLeft: '3px solid var(--accent)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, marginBottom: 6 }}>TODAY'S INSIGHT</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{insight.headline}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: 8 }}>{insight.body}</div>
            {insight.action && (
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>→ {insight.action}</div>
            )}
          </div>
        ) : null)}

        {/* Chat messages */}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            {isTrial
              ? `Try ${TRIAL_LIMIT} free messages. Ask me anything about training or nutrition.`
              : 'Ask me anything about your training, nutrition, or recovery.'}
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '80%',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg2)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.5,
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: 14, color: 'var(--text-muted)' }}>
              …
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={isTrial ? `Ask your coach… (${trialRemaining} free left)` : 'Ask your coach…'}
          rows={1}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', color: 'var(--text)', fontSize: 14, resize: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 120, overflowY: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: 13, opacity: (sending || !input.trim()) ? 0.5 : 1 }}
        >
          {sending ? '…' : '↑'}
        </button>
      </div>
    </div>
  )
}

function UpsellView({ onUpgrade, loading, trialExhausted = false }) {
  const features = [
    { Icon: BoltIcon, title: 'Post-Workout Analysis', desc: 'Instant AI breakdown of every session — what worked, what to improve.' },
    { Icon: SparkleIcon, title: 'Daily Insights', desc: 'Personalized tips each morning tailored to your training history and goals.' },
    { Icon: TargetIcon, title: 'Ask Anything', desc: 'Chat with your AI coach anytime about training, nutrition, or recovery.' },
  ]

  return (
    <div className="page" style={{ padding: 'var(--page-top) 20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ color: 'var(--accent)', marginBottom: 12 }}><SparkleIcon size={40} /></div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>BodMax AI Coach</h1>

      {trialExhausted ? (
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 28, maxWidth: 300, lineHeight: 1.6 }}>
          You've used your {TRIAL_LIMIT} free messages. Upgrade to keep the momentum going with unlimited coaching.
        </p>
      ) : (
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 28, maxWidth: 300, lineHeight: 1.6 }}>
          Your personal AI coach that learns your training, spots weaknesses, and keeps you progressing.
        </p>
      )}

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
        {features.map(({ Icon, title, desc }) => (
          <div key={title} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, textAlign: 'left', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}><Icon size={20} /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onUpgrade}
        disabled={loading}
        style={{ background: 'var(--accent)', border: 'none', borderRadius: 12, padding: '14px 32px', color: '#fff', fontWeight: 800, fontSize: 16, width: '100%', maxWidth: 320, opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Loading…' : 'Upgrade — $5 / month'}
      </button>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>Cancel anytime. No commitments.</div>
    </div>
  )
}
