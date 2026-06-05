// PATH: quiz-platform/frontend/src/pages/RewardWall.js
// CPX Research survey wall — users earn XP + Coins on completion
// Polls /auth/me every 8s while wall is open to detect new rewards instantly

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

const HOW_IT_WORKS = [
  { emoji:'📋', step:'1', title:'Pick a Survey',     desc:'Choose any survey from the wall. Takes 2–15 minutes.' },
  { emoji:'✍️', step:'2', title:'Answer Honestly',   desc:'Complete all questions — dishonest answers may disqualify you.' },
  { emoji:'🪙', step:'3', title:'Get Coins + XP',    desc:'Rewards are credited automatically within seconds.' },
  { emoji:'💡', step:'4', title:'Spend Your Coins',  desc:'Use coins for hints during quizzes or on the spin wheel.' },
];

const FAQ = [
  { q:'How fast do I get my coins?',              a:'Automatically within a few seconds of completing the survey.' },
  { q:'I was disqualified — is that normal?',     a:'Yes. Surveys target specific audiences. If you don\'t qualify, try another.' },
  { q:'I completed a survey but got nothing?',    a:'Contact support with the survey name and time. We\'ll verify manually.' },
  { q:'How many surveys can I do per day?',       a:'No daily limit — do as many as you want.' },
  { q:'What can I spend coins on?',               a:'In-quiz hints, daily spin top-ups, and future shop items.' },
];

export default function RewardWall() {
  const { user, token } = useAuth();
  const { toast }       = useToast();

  const [config,      setConfig]      = useState(null);
  const [history,     setHistory]     = useState([]);
  const [coins,       setCoins]       = useState(0);
  const [xp,          setXP]          = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [iframeKey,   setIframeKey]   = useState(0);
  const [tab,         setTab]         = useState('wall');
  const [faqOpen,     setFaqOpen]     = useState(null);
  const prevCoinsRef  = useRef(null);

  // ── Sync from context ──────────────────────────────────
  useEffect(() => {
    if (user?.coins != null) { setCoins(user.coins); prevCoinsRef.current = user.coins; }
    if (user?.xp_points != null) setXP(user.xp_points);
  }, [user?.coins, user?.xp_points]);

  useEffect(() => {
    const h = (e) => { if (e.detail?.coins != null) setCoins(e.detail.coins); };
    window.addEventListener('coinsUpdated', h);
    return () => window.removeEventListener('coinsUpdated', h);
  }, []);

  // ── Load config + history ──────────────────────────────
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [cR, hR] = await Promise.all([
          fetch(`${BASE}/rewards/cpx/config`,  { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE}/rewards/cpx/history`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!cancelled) {
          if (cR.ok) setConfig(await cR.json());
          if (hR.ok) setHistory(await hR.json() || []);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ── Poll for new rewards while wall tab is open ────────
  // Detects when CPX postback credits coins and shows toast
  useEffect(() => {
    if (!token || tab !== 'wall') return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const data = await r.json();
        const fresh = data.coins ?? 0;
        const prev  = prevCoinsRef.current ?? fresh;
        if (fresh > prev) {
          const diff = fresh - prev;
          setCoins(fresh);
          setXP(data.xp_points ?? xp);
          window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: fresh } }));
          toast.success(`🎉 Survey reward! +${diff} coins credited!`);
          // Reload history
          fetch(`${BASE}/rewards/cpx/history`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : []).then(d => setHistory(d || [])).catch(() => {});
        }
        prevCoinsRef.current = fresh;
      } catch {}
    }, 8000);
    return () => clearInterval(iv);
  }, [token, tab, xp]); // eslint-disable-line

  const totalCoinsEarned = history.reduce((s, h) => s + (h.coins_awarded || 0), 0);
  const totalXPEarned    = history.reduce((s, h) => s + (h.xp_awarded || 0), 0);

  if (!user) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ textAlign:'center', maxWidth:400 }}>
        <div style={{ fontSize:'3.5rem', marginBottom:16 }}>🔒</div>
        <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:900, marginBottom:8 }}>Sign in to Earn Rewards</h2>
        <p style={{ color:'var(--text2)', marginBottom:24 }}>Complete surveys and earn coins + XP instantly.</p>
        <Link to="/" className="btn btn-primary">Sign In</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'32px 16px 64px' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes fadeUp  { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
        .rw-tab { background:transparent; border:none; cursor:pointer; border-radius:10px; padding:8px 20px; font-size:.85rem; font-weight:700; transition:all .2s; color:var(--text2); }
        .rw-tab.active { background:var(--surface); color:var(--text); border:1px solid var(--border); box-shadow:0 2px 8px rgba(0,0,0,.15); }
        .rw-tab:hover:not(.active) { color:var(--text); }
        .hist-row:hover { background:rgba(234,179,8,.05) !important; }
        .faq-item { border-bottom:1px solid var(--border); }
        .faq-q { width:100%; padding:14px 20px; background:none; border:none; text-align:left; cursor:pointer; font-size:.88rem; font-weight:700; color:var(--text); display:flex; justify-content:space-between; align-items:center; }
        .faq-q:hover { background:var(--surface2); }
      `}</style>

      <div style={{ maxWidth:860, margin:'0 auto' }}>

        {/* ── Header ── */}
        <div style={{ textAlign:'center', marginBottom:28, animation:'fadeUp .4s ease' }}>
          <div style={{ fontSize:'3rem', marginBottom:10 }}>🎁</div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'2.1rem', fontWeight:900, margin:'0 0 8px',
            backgroundImage:'linear-gradient(135deg,#f97316,#eab308,#22c55e)',
            backgroundSize:'200% auto', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            animation:'shimmer 3s linear infinite' }}>
            Reward Wall
          </h1>
          <p style={{ color:'var(--text2)', fontSize:'.9rem', margin:'0 0 20px' }}>
            Complete surveys · Earn <strong style={{ color:'#eab308' }}>Coins</strong> + <strong style={{ color:'#6366f1' }}>XP</strong> instantly · No credit card
          </p>

          {/* Balance pills */}
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8,
              background:'linear-gradient(135deg,rgba(234,179,8,.12),rgba(249,115,22,.08))',
              border:'1px solid rgba(234,179,8,.35)', borderRadius:24, padding:'10px 20px' }}>
              <span style={{ fontSize:'1.3rem' }}>🪙</span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#eab308', fontSize:'1.15rem', lineHeight:1 }}>{coins.toLocaleString()}</div>
                <div style={{ fontSize:'.65rem', color:'var(--text3)' }}>coins</div>
              </div>
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8,
              background:'linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08))',
              border:'1px solid rgba(99,102,241,.35)', borderRadius:24, padding:'10px 20px' }}>
              <span style={{ fontSize:'1.3rem' }}>⚡</span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#6366f1', fontSize:'1.15rem', lineHeight:1 }}>{xp.toLocaleString()}</div>
                <div style={{ fontSize:'.65rem', color:'var(--text3)' }}>XP</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:'flex', gap:6, marginBottom:22, justifyContent:'center', flexWrap:'wrap' }}>
          {[
            { id:'wall',    label:'🎯 Surveys' },
            { id:'history', label:`📜 History ${history.length > 0 ? `(${history.length})` : ''}` },
            { id:'howto',   label:'❓ How It Works' },
          ].map(t => (
            <button key={t.id} className={`rw-tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ SURVEY WALL ══ */}
        {tab === 'wall' && (
          <div style={{ animation:'fadeUp .3s ease' }}>

            {/* Stats bar */}
            {history.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
                {[
                  { label:'Surveys Done',    value: history.length,                 color:'#22c55e', emoji:'✅' },
                  { label:'Coins Earned',    value: totalCoinsEarned.toLocaleString(), color:'#eab308', emoji:'🪙' },
                  { label:'XP Earned',       value: totalXPEarned.toLocaleString(),   color:'#6366f1', emoji:'⚡' },
                ].map((s, i) => (
                  <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'12px 14px', textAlign:'center' }}>
                    <div style={{ fontSize:'1.2rem', marginBottom:4 }}>{s.emoji}</div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:s.color, fontSize:'1.1rem' }}>{s.value}</div>
                    <div style={{ fontSize:'.7rem', color:'var(--text3)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Live indicator + refresh */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'.75rem', color:'var(--text3)' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 2s ease-in-out infinite' }}/>
                <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
                Live — coins credited automatically
              </div>
              <button onClick={() => setIframeKey(k => k + 1)}
                style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontSize:'.75rem', fontWeight:700, color:'var(--text2)' }}>
                🔄 Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:400 }}>
                <div className="spinner"/>
              </div>
            ) : !config ? (
              /* Not configured */
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:18, padding:'44px 28px', textAlign:'center' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>⚙️</div>
                <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, marginBottom:8 }}>Reward Wall Not Configured</h3>
                <p style={{ color:'var(--text2)', fontSize:'.88rem', maxWidth:400, margin:'0 auto 16px', lineHeight:1.6 }}>
                  Admin needs to set up CPX Research credentials in the server <code>.env</code> file.
                </p>
                <div style={{ background:'var(--surface2)', borderRadius:12, padding:'14px 20px', display:'inline-block', textAlign:'left' }}>
                  <div style={{ fontSize:'.72rem', color:'var(--text3)', marginBottom:8, fontWeight:800, textTransform:'uppercase', letterSpacing:1 }}>Add to backend .env:</div>
                  <code style={{ fontSize:'.82rem', color:'var(--accent)', display:'block', lineHeight:2 }}>
                    CPX_APP_ID=your_app_id<br/>
                    CPX_SECURE_HASH_KEY=your_hash_key<br/>
                    CPX_COINS_PER_CENT=5<br/>
                    CPX_XP_PER_CENT=10
                  </code>
                </div>
              </div>
            ) : (
              /* CPX iframe */
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>
                <iframe
                  key={iframeKey}
                  src={config.iframe_url}
                  title="CPX Research Survey Wall"
                  width="100%"
                  height="680"
                  frameBorder="0"
                  scrolling="yes"
                  style={{ display:'block' }}
                />
              </div>
            )}

            <p style={{ fontSize:'.7rem', color:'var(--text3)', textAlign:'center', marginTop:10 }}>
              Surveys powered by CPX Research. Having issues? <Link to="/support" style={{ color:'var(--accent)' }}>Contact support</Link>.
            </p>
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {tab === 'history' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', background:'var(--surface2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800 }}>📜 Survey History</div>
                <div style={{ fontSize:'.78rem', color:'var(--text3)' }}>{history.length} completed</div>
              </div>

              {history.length === 0 ? (
                <div style={{ padding:'52px 24px', textAlign:'center', color:'var(--text3)' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📋</div>
                  <div style={{ fontWeight:700, fontSize:'.95rem', marginBottom:6 }}>No surveys completed yet</div>
                  <div style={{ fontSize:'.82rem', marginBottom:20 }}>Complete your first survey to earn coins + XP!</div>
                  <button className="btn btn-primary" onClick={() => setTab('wall')}>Browse Surveys</button>
                </div>
              ) : (
                <>
                  {/* Summary row */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0, borderBottom:'1px solid var(--border)' }}>
                    <div style={{ padding:'12px 20px', background:'rgba(234,179,8,.05)', borderRight:'1px solid var(--border)', textAlign:'center' }}>
                      <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#eab308', fontSize:'1.2rem' }}>+{totalCoinsEarned.toLocaleString()} 🪙</div>
                      <div style={{ fontSize:'.7rem', color:'var(--text3)' }}>total coins from surveys</div>
                    </div>
                    <div style={{ padding:'12px 20px', background:'rgba(99,102,241,.05)', textAlign:'center' }}>
                      <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#6366f1', fontSize:'1.2rem' }}>+{totalXPEarned.toLocaleString()} ⚡</div>
                      <div style={{ fontSize:'.7rem', color:'var(--text3)' }}>total XP from surveys</div>
                    </div>
                  </div>

                  {history.map((h, i) => (
                    <div key={i} className="hist-row"
                      style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom: i < history.length-1 ? '1px solid var(--border)' : 'none', transition:'background .15s' }}>
                      <div style={{ width:44, height:44, borderRadius:12,
                        background: h.status === 'reversed' ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                        border:`1px solid ${h.status === 'reversed' ? 'rgba(239,68,68,.25)' : 'rgba(34,197,94,.25)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', flexShrink:0 }}>
                        {h.status === 'reversed' ? '↩️' : '✅'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:'.88rem' }}>
                          Survey {h.status === 'reversed' ? 'Reversed' : 'Completed'}
                        </div>
                        <div style={{ fontSize:'.7rem', color:'var(--text3)', marginTop:2 }}>
                          ID: {h.trans_id?.slice(0,14)}… · {new Date(h.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                          <span style={{ marginLeft:6 }}>· ${(h.amount_local||0).toFixed(2)} value</span>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color: h.status === 'reversed' ? '#ef4444' : '#22c55e', fontSize:'.95rem' }}>
                          {h.status === 'reversed' ? '-' : '+'}{h.coins_awarded} 🪙
                        </div>
                        <div style={{ fontSize:'.7rem', color:'#6366f1', fontWeight:700 }}>
                          {h.status === 'reversed' ? '-' : '+'}{h.xp_awarded} ⚡
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ HOW IT WORKS ══ */}
        {tab === 'howto' && (
          <div style={{ animation:'fadeUp .3s ease' }}>

            {/* Steps */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
              {HOW_IT_WORKS.map((s, i) => (
                <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'22px 18px', textAlign:'center' }}>
                  <div style={{ width:52, height:52, borderRadius:16,
                    background:'linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.1))',
                    margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.7rem' }}>
                    {s.emoji}
                  </div>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'.88rem', marginBottom:6 }}>{s.title}</div>
                  <div style={{ fontSize:'.76rem', color:'var(--text2)', lineHeight:1.55 }}>{s.desc}</div>
                </div>
              ))}
            </div>

            {/* Reward rates */}
            <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.05))', border:'1px solid rgba(99,102,241,.2)', borderRadius:16, padding:'20px 22px', marginBottom:20 }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, marginBottom:14 }}>💰 Reward Rates</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ background:'rgba(234,179,8,.1)', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#eab308', fontSize:'1.3rem' }}>5 🪙</div>
                  <div style={{ fontSize:'.75rem', color:'var(--text2)', marginTop:4 }}>coins per 1¢ survey value</div>
                </div>
                <div style={{ background:'rgba(99,102,241,.1)', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#6366f1', fontSize:'1.3rem' }}>10 ⚡</div>
                  <div style={{ fontSize:'.75rem', color:'var(--text2)', marginTop:4 }}>XP per 1¢ survey value</div>
                </div>
              </div>
              <div style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:12 }}>
                Minimum reward: 10 coins + 20 XP regardless of survey value.
              </div>
            </div>

            {/* FAQ */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', background:'var(--surface2)' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800 }}>❓ FAQ</div>
              </div>
              {FAQ.map((f, i) => (
                <div key={i} className="faq-item">
                  <button className="faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                    <span>{f.q}</span>
                    <span style={{ color:'var(--accent)', fontSize:'.9rem', flexShrink:0, marginLeft:8 }}>
                      {faqOpen === i ? '▲' : '▼'}
                    </span>
                  </button>
                  {faqOpen === i && (
                    <div style={{ padding:'0 20px 14px', fontSize:'.82rem', color:'var(--text2)', lineHeight:1.6 }}>
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}