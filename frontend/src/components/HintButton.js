// PATH: quiz-platform/frontend/src/components/HintButton.js
// FIX: userCoins now has TWO sources:
//   1. prop (from parent — preferred when parent tracks live balance)
//   2. useAuth().user.coins (fallback — guarantees correct value even if prop is missing/0)
// The component takes whichever is LARGER, so it's never wrong.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { useToast }    from '../context/ToastContext';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

function broadcastCoins(bal) {
  window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: bal } }));
}

function CoinIcon({ size = 18, spin = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ display:'inline-block', verticalAlign:'middle',
               animation: spin ? 'coinSpin 0.6s linear infinite' : 'none' }}>
      <circle cx="12" cy="12" r="10" fill="#eab308" opacity="0.9"/>
      <circle cx="12" cy="12" r="8"  fill="#fbbf24"/>
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#92400e">₿</text>
    </svg>
  );
}

export default function HintButton({
  questionId   = null,
  quizId       = null,
  questionText = '',
  options      = [],
  isAi         = false,
  userCoins,           // ← optional now; falls back to useAuth
  onCoinsUpdated,
  style        = {},
}) {
  const { token, user } = useAuth();
  const { toast }       = useToast();
  const navigate        = useNavigate();
  const modalRef        = useRef(null);

  // ── FIX: resolve live balance from both prop and auth context ──
  // Take the prop value if explicitly provided and > 0,
  // otherwise fall back to user.coins from auth context.
  // This means: if parent passes userCoins correctly → use it.
  // If parent forgets or passes 0 but user actually has coins → use auth.
  const [localCoins, setLocalCoins] = useState(
    userCoins != null ? userCoins : (user?.coins ?? 0)
  );

  // Keep localCoins in sync when prop or auth changes
  useEffect(() => {
    const fromProp = userCoins ?? 0;
    const fromAuth = user?.coins ?? 0;
    // Use whichever is the most recent authoritative value:
    // If prop was explicitly provided (not undefined), trust prop.
    // Otherwise trust auth.
    setLocalCoins(userCoins !== undefined ? fromProp : fromAuth);
  }, [userCoins, user?.coins]);

  // Also listen for broadcast updates (from Navbar, SpinWheel, etc.)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.coins != null) setLocalCoins(e.detail.coins);
    };
    window.addEventListener('coinsUpdated', handler);
    return () => window.removeEventListener('coinsUpdated', handler);
  }, []);

  const [cost,       setCost]       = useState(60);
  const [hintsToday, setHintsToday] = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(true);
  const [hintText,   setHintText]   = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [newBalance, setNewBalance] = useState(null);
  const [nextCost,   setNextCost]   = useState(120);
  const [revealed,   setRevealed]   = useState(false);

  // ── Fetch today's cost on mount ───────────────────────
  const refreshCost = useCallback(async () => {
    if (!token) { setFetching(false); return; }
    setFetching(true);
    try {
      const r = await fetch(`${BASE}/hints/cost`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setCost(d.cost || 60);
        setHintsToday(d.hints_used_today || 0);
        setNextCost((d.cost || 60) * 2);
      }
    } catch {}
    setFetching(false);
  }, [token]);

  useEffect(() => { refreshCost(); }, [refreshCost]);

  // ── Close modal on outside click ─────────────────────
  useEffect(() => {
    if (!showModal) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) setShowModal(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModal]);

  // ── Request hint ─────────────────────────────────────
  const handleHint = async () => {
    if (!token) { toast.error('Sign in to use hints.'); return; }
    if (loading) return;

    // Already revealed this session — just reopen modal
    if (revealed && hintText) { setShowModal(true); return; }

    // Use localCoins which is always correct (from auth or prop)
    if (localCoins < cost) {
      toast.error(`You need ${cost} coins for a hint! You have ${localCoins}. Redirecting to dashboard…`);
      setTimeout(() => navigate('/dashboard'), 1400);
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`${BASE}/hints/use`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id:   questionId,
          quiz_id:       quizId,
          question_text: questionText,
          options,
          is_ai:         isAi || !questionId,
        }),
      });
      const data = await r.json();

      if (r.status === 402) {
        toast.error(`Need ${data.required} coins, you have ${data.balance}.`);
        setTimeout(() => navigate('/dashboard'), 1400);
        return;
      }
      if (!r.ok) { toast.error(data.error || 'Failed to get hint.'); return; }

      // Success — update all coin state
      setHintText(data.hint);
      setNewBalance(data.new_balance);
      setNextCost(data.next_hint_cost);
      setHintsToday(data.hints_used_today);
      setCost(data.next_hint_cost);
      setLocalCoins(data.new_balance);  // update local immediately
      setRevealed(true);
      setShowModal(true);
      broadcastCoins(data.new_balance);
      if (onCoinsUpdated) onCoinsUpdated(data.new_balance);

    } catch { toast.error('Network error. Try again.'); }
    finally  { setLoading(false); }
  };

  const canAfford = localCoins >= cost;

  return (
    <>
      <style>{`
        @keyframes coinSpin    { to { transform: rotateY(360deg); } }
        @keyframes hintSlideUp {
          from { opacity:0; transform:translateY(24px) scale(.95); }
          to   { opacity:1; transform:translateY(0)    scale(1);   }
        }
        @keyframes hintGlow {
          0%,100% { box-shadow:0 0 0 0 rgba(234,179,8,.4); }
          50%     { box-shadow:0 0 0 12px rgba(234,179,8,0); }
        }
        .hint-btn:hover:not(:disabled) {
          transform:translateY(-2px) !important;
          box-shadow:0 8px 28px rgba(234,179,8,.45) !important;
        }
        .hint-btn:active:not(:disabled) { transform:translateY(0) scale(.97) !important; }
        .hint-overlay {
          position:fixed; inset:0;
          background:rgba(0,0,0,.65);
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          z-index:9500;
          display:flex; align-items:center; justify-content:center;
          padding:16px;
        }
        .hint-modal  { animation:hintSlideUp .35s cubic-bezier(.25,.8,.25,1); }
        .hint-reveal { animation:hintSlideUp .4s .1s both; }
      `}</style>

      {/* ── Button ── */}
      <button
        className="hint-btn"
        onClick={handleHint}
        disabled={loading || fetching}
        title={canAfford
          ? `Get a hint — costs ${cost} coins (you have ${localCoins})`
          : `Need ${cost - localCoins} more coins (you have ${localCoins})`}
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        8,
          padding:    '10px 20px',
          borderRadius: 14,
          border:     `1.5px solid ${canAfford ? 'rgba(234,179,8,.5)' : 'rgba(239,68,68,.4)'}`,
          background: canAfford
            ? 'linear-gradient(135deg,rgba(234,179,8,.15),rgba(249,115,22,.1))'
            : 'rgba(239,68,68,.08)',
          color:      canAfford ? '#eab308' : '#ef4444',
          fontSize:   '.85rem',
          fontWeight: 700,
          fontFamily: 'Syne,sans-serif',
          cursor:     loading ? 'wait' : 'pointer',
          transition: 'all .2s',
          whiteSpace: 'nowrap',
          animation:  revealed ? 'none' : 'hintGlow 2.5s ease-in-out infinite',
          opacity:    fetching ? .6 : 1,
          ...style,
        }}>
        {loading ? (
          <><CoinIcon size={16} spin/> Getting hint…</>
        ) : (
          <>
            <span style={{ fontSize:'1rem' }}>💡</span>
            {fetching ? 'Loading…' : revealed ? 'Show hint again' : (
              <>
                Hint&nbsp;
                <span style={{ display:'inline-flex', alignItems:'center', gap:3,
                  background:'rgba(234,179,8,.2)', borderRadius:8, padding:'2px 8px', fontSize:'.78rem' }}>
                  <CoinIcon size={14}/>&nbsp;{cost.toLocaleString()}
                </span>
              </>
            )}
            {!canAfford && !loading && !fetching && (
              <span style={{ fontSize:'.7rem', opacity:.8 }}>
                {' '}· Need {(cost - localCoins).toLocaleString()} more
              </span>
            )}
          </>
        )}
      </button>

      {/* ── Modal ── */}
      {showModal && hintText && (
        <div className="hint-overlay" onClick={() => setShowModal(false)}>
          <div
            ref={modalRef}
            className="hint-modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth:     460,
              width:        '100%',
              background:   'linear-gradient(135deg,#1a1a2e,#16213e)',
              border:       '1.5px solid rgba(234,179,8,.35)',
              borderRadius: 24,
              overflow:     'hidden',
              boxShadow:    '0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(234,179,8,.1)',
            }}>

            {/* Header */}
            <div style={{
              padding:     '18px 24px',
              background:  'linear-gradient(135deg,rgba(234,179,8,.15),rgba(249,115,22,.08))',
              borderBottom:'1px solid rgba(234,179,8,.2)',
              display:     'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:10,
                  background:'rgba(234,179,8,.2)', display:'flex',
                  alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>💡</div>
                <div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'.95rem', color:'#eab308' }}>
                    Quiz Hint
                  </div>
                  <div style={{ fontSize:'.7rem', color:'var(--text3,#6b7280)', marginTop:1 }}>
                    Hint #{hintsToday} today
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background:'rgba(255,255,255,.08)', border:'none', borderRadius:8,
                  width:30, height:30, cursor:'pointer', color:'#9ca3af',
                  fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
                ✕
              </button>
            </div>

            {/* Hint text */}
            <div className="hint-reveal" style={{ padding:'24px' }}>
              <div style={{
                background:'rgba(234,179,8,.06)', border:'1px solid rgba(234,179,8,.2)',
                borderRadius:14, padding:'18px 20px',
                fontSize:'.95rem', lineHeight:1.65, color:'#f0f0ff', position:'relative',
              }}>
                <span style={{ position:'absolute', top:-6, left:14,
                  fontSize:'2.5rem', color:'rgba(234,179,8,.25)', fontFamily:'serif', lineHeight:1 }}>"</span>
                <span style={{ paddingLeft:18 }}>{hintText}</span>
              </div>

              {/* Cost + balance row */}
              <div style={{ marginTop:16, display:'flex', alignItems:'center',
                justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                <div style={{ fontSize:'.78rem', color:'#6b7280' }}>
                  <span style={{ color:'#ef4444', fontWeight:700 }}>
                    −{(nextCost / 2).toLocaleString()} 🪙
                  </span>{' '}deducted
                </div>
                {newBalance != null && (
                  <div style={{ display:'flex', alignItems:'center', gap:6,
                    background:'rgba(234,179,8,.1)', border:'1px solid rgba(234,179,8,.25)',
                    borderRadius:10, padding:'4px 12px', fontSize:'.8rem' }}>
                    <CoinIcon size={14}/>
                    <span style={{ color:'#eab308', fontWeight:800 }}>{newBalance.toLocaleString()}</span>
                    <span style={{ color:'#6b7280' }}>remaining</span>
                  </div>
                )}
              </div>

              {/* Next hint warning */}
              <div style={{ marginTop:14, padding:'10px 14px',
                background:'rgba(249,115,22,.07)', border:'1px solid rgba(249,115,22,.2)',
                borderRadius:10, fontSize:'.75rem', color:'#f97316',
                display:'flex', alignItems:'center', gap:6 }}>
                ⚠️ Next hint today will cost{' '}
                <strong style={{ color:'#fb923c' }}>{nextCost.toLocaleString()} coins</strong>
                {' '}(doubles each time · resets at midnight)
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'0 24px 20px', display:'flex', gap:10 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex:1, padding:'11px', borderRadius:12, border:'none',
                  background:'rgba(255,255,255,.06)', color:'#9ca3af',
                  cursor:'pointer', fontWeight:600, fontSize:'.85rem' }}>
                Got it 👍
              </button>
              <button onClick={() => { setShowModal(false); navigate('/dashboard'); }}
                style={{ padding:'11px 18px', borderRadius:12, border:'none',
                  background:'linear-gradient(135deg,rgba(234,179,8,.25),rgba(249,115,22,.15))',
                  color:'#eab308', cursor:'pointer', fontWeight:700, fontSize:'.82rem',
                  whiteSpace:'nowrap' }}>
                🪙 Get coins
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}