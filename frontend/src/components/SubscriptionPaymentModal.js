// PATH: quiz-platform/frontend/src/components/SubscriptionPaymentModal.js
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import RazorpayButton from './RazorpayButton';

const UPI_ID = '7015097910@ybl';

const PLANS = {
  pro: {
    name: 'Pro', emoji: '⭐', color: '#eab308',
    monthly: 299, yearly: 2390,
    features: ['Unlimited AI quizzes', 'No ads', '5 streak freezes/month', 'Advanced analytics', '⭐ Pro badge'],
  },
  elite: {
    name: 'Elite', emoji: '💎', color: '#8b5cf6',
    monthly: 599, yearly: 4790,
    features: ['All Pro features', 'Exclusive event quizzes', '10 streak freezes/month', '💎 Elite badge + XP 2×', 'AI study roadmap'],
  },
};

function QRCode({ amount, planName }) {
  const upiStr = `upi://pay?pa=${UPI_ID}&pn=QuizMaster+Pro&am=${amount}&tn=QuizMaster+${planName}+Plan&cu=INR`;
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiStr)}&bgcolor=0d0d1a&color=a855f7&margin=10&format=png`;
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'inline-block', background: '#0d0d1a', border: '2px solid rgba(168,85,247,.4)', borderRadius: 14, padding: 12, marginBottom: 8, position: 'relative' }}>
        {!loaded && (
          <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '.82rem' }}>
            Loading QR…
          </div>
        )}
        <img
          src={qrUrl}
          alt="UPI QR"
          style={{ width: 180, height: 180, display: loaded ? 'block' : 'none', borderRadius: 6 }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </div>
      <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>Scan with PhonePe, GPay, Paytm or any UPI app</div>
    </div>
  );
}

export default function SubscriptionPaymentModal({ plan, billing = 'monthly', onClose, onSuccess }) {
  const { refreshUser, loginWithToken } = useAuth();   // ← get auth helpers

  const cfg      = PLANS[plan];
  const amount   = billing === 'yearly' ? cfg?.yearly : cfg?.monthly;
  const perMonth = billing === 'yearly' ? Math.round((cfg?.yearly || 0) / 12) : null;

  const [step,      setStep]      = useState('details');
  const [utr,       setUtr]       = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(300);

  useEffect(() => {
    if (step !== 'payment') return;
    setCountdown(300);
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [step]);

  if (!cfg) return null;
  const fmt = n => `${Math.floor(n / 60)}:${(n % 60).toString().padStart(2, '0')}`;

  // ── Razorpay success handler ──────────────────────────
  const handleRazorpaySuccess = async (paymentId, newToken) => {
    if (newToken) {
      // 1. Save new token to localStorage
      localStorage.setItem('qm_token', newToken);

      // 2. Update axios header synchronously so next requests use new plan
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      // 3. Parse the new token to get updated user fields
      try {
        const payload = JSON.parse(atob(newToken.split('.')[1]));
        const updatedUser = {
          id:                payload.id,
          username:          payload.username,
          email:             payload.email,
          is_admin:          payload.is_admin || false,
          plan:              payload.plan || plan,
          subscription_plan: payload.plan || plan,
        };
        // Update AuthContext with new token + user (keeps session alive)
        loginWithToken(newToken, updatedUser, localStorage.getItem('qm_remember') === 'true');
      } catch { /* ignore parse errors */ }

      // 4. Fetch full fresh profile so coins/streak/plan all update in UI
      try { await refreshUser(); } catch { /* ignore */ }
    }

    setStep('success');
  };

  // ── Manual UPI verify handler ─────────────────────────
  const handleVerify = async () => {
    const trimmed = utr.trim();
    if (!trimmed || trimmed.length < 5) {
      setError('Enter a valid UPI transaction reference (UTR number).');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const { data } = await api.post('/subscription/activate', {
        plan,
        billing_cycle: billing,
        amount,
        upi_ref: trimmed,
      });

      if (data.token) {
        localStorage.setItem('qm_token', data.token);
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

        try {
          const payload = JSON.parse(atob(data.token.split('.')[1]));
          const updatedUser = {
            id:                payload.id,
            username:          payload.username,
            email:             payload.email,
            is_admin:          payload.is_admin || false,
            plan:              payload.plan || plan,
            subscription_plan: payload.plan || plan,
          };
          loginWithToken(data.token, updatedUser, localStorage.getItem('qm_remember') === 'true');
        } catch { /* ignore */ }

        try { await refreshUser(); } catch { /* ignore */ }
      }

      setStep('success');
    } catch (e) {
      setError(e.response?.data?.error || 'Verification failed. Make sure you entered the correct UTR number.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = (text) => { navigator.clipboard?.writeText(text).catch(() => {}); };

  // ── Success button: close modal + call parent callback ─
  const handleSuccessClose = async () => {
    // Final refresh to make 100% sure UI reflects new plan
    try { await refreshUser(); } catch { /* ignore */ }
    onSuccess?.();
    onClose?.();
  };

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.82)', backdropFilter:'blur(12px)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div style={{ background:'var(--surface)', border:`1.5px solid ${cfg.color}44`, borderRadius:20, width:'100%', maxWidth:460, maxHeight:'92vh', overflowY:'auto', position:'relative' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${cfg.color}22,${cfg.color}0f)`, padding:'18px 24px', borderBottom:`1px solid ${cfg.color}33`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.1rem', color:cfg.color }}>{cfg.emoji} {cfg.name} Plan</div>
            <div style={{ fontSize:'.78rem', color:'var(--text2)', marginTop:2 }}>QuizMaster Pro Subscription</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)', border:'none', color:'var(--text2)', borderRadius:'50%', width:30, height:30, cursor:'pointer', fontSize:'.9rem' }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>

          {/* ── STEP: DETAILS ── */}
          {step === 'details' && (
            <div>
              <div style={{ textAlign:'center', marginBottom:24 }}>
                <div style={{ fontFamily:'Syne', fontSize:'2.8rem', fontWeight:900, color:cfg.color }}>₹{amount}</div>
                <div style={{ fontSize:'.82rem', color:'var(--text3)', marginTop:2 }}>
                  per {billing === 'yearly' ? 'year' : 'month'}
                </div>
                {billing === 'yearly' && perMonth && (
                  <div style={{ fontSize:'.78rem', color:'#00d4aa', marginTop:4 }}>≈ ₹{perMonth}/month · 20% savings</div>
                )}
              </div>

              <div style={{ background:'var(--surface2)', borderRadius:12, padding:'16px 18px', marginBottom:20 }}>
                <div style={{ fontWeight:700, marginBottom:10, fontSize:'.88rem' }}>What's included:</div>
                {cfg.features.map((f, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:8, fontSize:'.85rem' }}>
                    <span style={{ color:'#00d4aa', flexShrink:0 }}>✓</span>{f}
                  </div>
                ))}
              </div>

              {/* Razorpay */}
              <RazorpayButton
                amount={amount * 100}
                plan={plan}
                billingCycle={billing}
                planColor={cfg.color}
                planEmoji={cfg.emoji}
                planName={cfg.name}
                onSuccess={handleRazorpaySuccess}
                onCancel={() => setError('Payment cancelled. You can try again anytime.')}
              />

              {/* Divider */}
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'14px 0' }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
                <span style={{ fontSize:'.72rem', color:'var(--text3)', whiteSpace:'nowrap' }}>or pay manually via UPI</span>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
              </div>

              <button
                style={{ width:'100%', background:'rgba(255,255,255,.04)', border:'1px solid var(--border)', borderRadius:10, padding:13, cursor:'pointer', fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'.95rem', color:'var(--text2)', transition:'all .2s' }}
                onClick={() => setStep('payment')}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
              >
                📱 Pay ₹{amount} via QR / UPI ID
              </button>

              {error && (
                <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:8, padding:'8px 12px', marginTop:12, fontSize:'.82rem', color:'#ef4444' }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: PAYMENT (manual UPI) ── */}
          {step === 'payment' && (
            <div>
              <div style={{ textAlign:'center', marginBottom:16 }}>
                <div style={{ fontWeight:800, fontSize:'1rem', marginBottom:4 }}>Scan & Pay ₹{amount}</div>
                <div style={{ fontSize:'.78rem', color:'var(--text3)' }}>PhonePe · Google Pay · Paytm · Any UPI</div>
              </div>

              <QRCode amount={amount} planName={cfg.name} />

              <div style={{ background:'var(--surface2)', borderRadius:10, padding:'14px 16px', margin:'16px 0', textAlign:'center' }}>
                <div style={{ fontSize:'.7rem', color:'var(--text3)', marginBottom:4, textTransform:'uppercase', letterSpacing:.5 }}>UPI ID</div>
                <div style={{ fontFamily:'monospace', fontSize:'1.1rem', fontWeight:700, letterSpacing:1, marginBottom:8 }}>{UPI_ID}</div>
                <button
                  onClick={() => handleCopy(UPI_ID)}
                  style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 12px', cursor:'pointer', fontSize:'.75rem', color:'var(--accent)' }}
                >
                  📋 Copy UPI ID
                </button>
              </div>

              <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                <div style={{ background:`${cfg.color}18`, border:`1px solid ${cfg.color}44`, borderRadius:50, padding:'6px 20px', fontFamily:'Syne', fontWeight:800, fontSize:'1.1rem', color:cfg.color }}>
                  ₹{amount}
                </div>
              </div>

              {countdown > 0 && (
                <div style={{ textAlign:'center', fontSize:'.75rem', color:countdown < 60 ? '#ef4444' : 'var(--text3)', marginBottom:14 }}>
                  ⏱ Session: <strong>{fmt(countdown)}</strong>
                </div>
              )}

              <div style={{ background:'var(--surface2)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
                <div style={{ fontSize:'.78rem', fontWeight:700, marginBottom:8 }}>After paying:</div>
                {[
                  `Scan QR or pay to ${UPI_ID}`,
                  `Amount: ₹${amount}`,
                  'Copy the UTR/transaction reference from your UPI app',
                  'Paste it below and click Verify',
                ].map((s, i) => (
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:6, fontSize:'.8rem', color:'var(--text2)' }}>
                    <span style={{ width:18, height:18, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.62rem', fontWeight:700, flexShrink:0 }}>{i + 1}</span>
                    {s}
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:'.82rem', color:'#ef4444' }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">UPI Transaction Reference (UTR)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 123456789012 or T25041600000"
                  value={utr}
                  onChange={e => { setUtr(e.target.value); setError(''); }}
                  style={{ fontFamily:'monospace', letterSpacing:.5 }}
                />
                <div style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:4 }}>
                  Find in your UPI app under "Transaction Details"
                </div>
              </div>

              <button
                className="btn btn-full"
                style={{ background:`linear-gradient(135deg,${cfg.color},${cfg.color}cc)`, border:'none', color:'#fff', padding:13, borderRadius:10, cursor:verifying || !utr.trim() ? 'not-allowed' : 'pointer', opacity:verifying || !utr.trim() ? 0.7 : 1, fontFamily:'Syne', fontWeight:800, fontSize:'1rem' }}
                onClick={handleVerify}
                disabled={verifying || !utr.trim()}
              >
                {verifying ? (
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block' }} />
                    Activating…
                  </span>
                ) : '✓ Verify & Activate'}
              </button>

              <p style={{ fontSize:'.72rem', color:'var(--text3)', textAlign:'center', marginTop:10, lineHeight:1.5 }}>
                Activated instantly. Manual review takes up to 2 hours if needed.
              </p>

              <button
                onClick={() => { setStep('details'); setError(''); }}
                style={{ width:'100%', background:'none', border:'none', color:'var(--text3)', fontSize:'.78rem', cursor:'pointer', marginTop:4, padding:'6px 0' }}
              >
                ← Back to payment options
              </button>
            </div>
          )}

          {/* ── STEP: SUCCESS ── */}
          {step === 'success' && (
            <div style={{ textAlign:'center', padding:'24px 0' }}>
              <div style={{ fontSize:'5rem', marginBottom:16, animation:'_spin 1s ease' }}>{cfg.emoji}</div>
              <style>{`@keyframes _spin{from{transform:scale(0) rotate(-180deg)}to{transform:scale(1) rotate(0)}}`}</style>
              <div style={{ fontFamily:'Syne', fontWeight:900, fontSize:'1.7rem', marginBottom:8, color:cfg.color }}>
                Welcome to {cfg.name}!
              </div>
              <div style={{ background:`${cfg.color}14`, border:`1px solid ${cfg.color}33`, borderRadius:14, padding:'18px 20px', marginBottom:20 }}>
                <div style={{ fontSize:'1rem', fontWeight:700, marginBottom:6 }}>
                  🎉 You are now a member of the <span style={{ color:cfg.color }}>{cfg.name} subscription</span>.
                </div>
                <div style={{ fontSize:'.85rem', color:'var(--text2)', lineHeight:1.6 }}>
                  All {cfg.name} features are unlocked.<br />
                  Your {cfg.emoji} badge will appear on your profile.
                </div>
              </div>
              <button
                className="btn btn-full"
                style={{ background:`linear-gradient(135deg,${cfg.color},${cfg.color}cc)`, border:'none', color:'#fff', padding:13, borderRadius:10, cursor:'pointer', fontFamily:'Syne', fontWeight:800, fontSize:'1rem' }}
                onClick={handleSuccessClose}
              >
                Start Exploring {cfg.emoji}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}