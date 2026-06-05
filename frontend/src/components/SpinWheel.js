// PATH: quiz-platform/frontend/src/components/SpinWheel.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth }     from '../context/AuthContext';
import { useToast }    from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

const FALLBACK_PRIZES = [
  { label:'50 Coins',         value:'50c',     probability:30, color:'#f97316', emoji:'🪙' },
  { label:'100 Coins',        value:'100c',    probability:20, color:'#eab308', emoji:'💰' },
  { label:'200 Coins',        value:'200c',    probability:15, color:'#22c55e', emoji:'💎' },
  { label:'10 Coins',         value:'10c',     probability:20, color:'#6366f1', emoji:'🎯' },
  { label:'Pro Trial 3 Days', value:'pro3',    probability:5,  color:'#8b5cf6', emoji:'⭐' },
  { label:'Streak Restore',   value:'restore', probability:10, color:'#ef4444', emoji:'🔥' },
];

const COLORS = ['#f97316','#eab308','#22c55e','#6366f1','#8b5cf6','#ef4444','#06b6d4','#ec4899'];

function normalizePrizes(raw) {
  return raw.map((p, i) => ({
    color: COLORS[i % COLORS.length],
    emoji: p.value?.endsWith('c') ? '🪙' : p.value?.startsWith('pro') ? '⭐' : p.value === 'restore' ? '🔥' : '🎁',
    ...p,
  }));
}

function broadcastCoins(n) {
  window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: n } }));
}

function SpinLogo({ spinning }) {
  return (
    <div style={{ position:'relative', width:90, height:90, margin:'0 auto 8px' }}>
      <style>{`
        @keyframes rotateLogo { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes rotateLogoPulse { 0%,100%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.08)} }
        .spin-logo-ring  { animation: rotateLogo ${spinning ? '0.6s' : '4s'} linear infinite; transform-origin:center; }
        .spin-logo-inner { animation: rotateLogoPulse ${spinning ? '0.6s' : '6s'} ease-in-out infinite; transform-origin:center; }
      `}</style>
      <svg viewBox="0 0 90 90" width="90" height="90">
        <circle cx="45" cy="45" r="42" fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="3"/>
        <g className="spin-logo-ring">
          {FALLBACK_PRIZES.map((_, i) => {
            const angle = (360 / FALLBACK_PRIZES.length) * i;
            const rad   = (angle * Math.PI) / 180;
            return <line key={i} x1={45+30*Math.cos(rad)} y1={45+30*Math.sin(rad)} x2={45+42*Math.cos(rad)} y2={45+42*Math.sin(rad)} stroke={COLORS[i%COLORS.length]} strokeWidth="4" strokeLinecap="round"/>;
          })}
          <circle cx="45" cy="45" r="30" fill="none" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" strokeDasharray="4 4"/>
        </g>
        <g className="spin-logo-inner">
          {FALLBACK_PRIZES.map((_, i) => {
            const arc = (2*Math.PI)/FALLBACK_PRIZES.length;
            const s = arc*i - Math.PI/2, e = s+arc;
            return <path key={i} d={`M45,45 L${45+26*Math.cos(s)},${45+26*Math.sin(s)} A26,26 0 0,1 ${45+26*Math.cos(e)},${45+26*Math.sin(e)} Z`} fill={COLORS[i%COLORS.length]} opacity="0.85"/>;
          })}
        </g>
        <circle cx="45" cy="45" r="10" fill="#1a1a2e" stroke="rgba(99,102,241,0.8)" strokeWidth="2"/>
        <text x="45" y="49" textAnchor="middle" fontSize="10" fill="#a5b4fc" fontWeight="bold">✦</text>
      </svg>
    </div>
  );
}

export default function SpinWheel() {
  const { user, token, refreshUser } = useAuth();
  const { toast }                    = useToast();
  const { t }                        = useLanguage();
  const canvasRef   = useRef(null);
  const spinRef     = useRef({ angle:0, velocity:0, spinning:false, raf:null });
  const spinLockRef = useRef(false);

  const [prizes,     setPrizes]     = useState(FALLBACK_PRIZES);
  const [spinning,   setSpinning]   = useState(false);
  const [result,     setResult]     = useState(null);
  const [alreadySpin,setAlready]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [coins,      setCoins]      = useState(0);
  const [history,    setHistory]    = useState([]);
  const [timeLeft,   setTimeLeft]   = useState('');

  const prizesRef = useRef(prizes);
  useEffect(() => { prizesRef.current = prizes; }, [prizes]);

  useEffect(() => {
    if (!alreadySpin) return;
    const calc = () => {
      const now = new Date(), mid = new Date();
      mid.setHours(24,0,0,0);
      const d = mid - now;
      setTimeLeft(`${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m ${Math.floor((d%60000)/1000)}s`);
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [alreadySpin]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const pr = await fetch(`${BASE}/spin-prizes`, { headers: { Authorization: `Bearer ${token}` } });
        if (pr.ok && !cancelled) {
          const raw = await pr.json();
          if (Array.isArray(raw) && raw.length) {
            const normalized = normalizePrizes(raw);
            setPrizes(normalized);
            prizesRef.current = normalized;
          }
        }
      } catch (e) { console.warn('[SpinWheel] Using fallback prizes:', e.message); }

      try {
        const cR = await fetch(`${BASE}/coins/history`, { headers: { Authorization: `Bearer ${token}` } });
        if (cR.ok && !cancelled) {
          const ch = await cR.json();
          setHistory((ch || []).filter(item => item.type === 'spin').slice(0, 5));
        }
      } catch {}

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    setTimeout(() => {
      setCoins(user.coins ?? 0);
      if (user.last_spin_date === today) setAlready(true);
    }, 0);
  }, [user]);

  useEffect(() => {
    const h = (e) => { if (e.detail?.coins != null) setCoins(e.detail.coins); };
    window.addEventListener('coinsUpdated', h);
    return () => window.removeEventListener('coinsUpdated', h);
  }, []);

  const draw = useCallback((angle = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const list = prizesRef.current;
    if (!list.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2;
    const R = Math.min(cx, cy) - 8;
    const arc = (2*Math.PI) / list.length;
    ctx.clearRect(0, 0, W, H);

    const og = ctx.createRadialGradient(cx,cy,R-4,cx,cy,R+20);
    og.addColorStop(0,'rgba(99,102,241,.5)'); og.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(cx,cy,R+20,0,Math.PI*2); ctx.fillStyle=og; ctx.fill();

    list.forEach((prize, i) => {
      const start = angle + i*arc, end = start + arc, mid = start + arc/2;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,start,end); ctx.closePath();
      const g = ctx.createRadialGradient(cx,cy,0,cx+Math.cos(mid)*R*.5,cy+Math.sin(mid)*R*.5,R);
      g.addColorStop(0, prize.color+'cc'); g.addColorStop(1, prize.color+'ff');
      ctx.fillStyle=g; ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.2)'; ctx.lineWidth=2; ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(mid); ctx.textAlign='right';
      ctx.font=`${Math.round(R*.13)}px serif`;
      ctx.fillText(prize.emoji, R*.88, 6);
      ctx.font=`700 ${Math.round(R*.08)}px Syne,sans-serif`;
      ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=6;
      ctx.fillText(prize.label, R*.70, 22);
      ctx.restore();
    });

    for (let i = 0; i < list.length; i++) {
      const a = angle + i*arc;
      ctx.beginPath(); ctx.arc(cx+Math.cos(a)*R, cy+Math.sin(a)*R, 5, 0, Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,.6)'; ctx.fill();
    }

    const hub = ctx.createRadialGradient(cx-6,cy-6,2,cx,cy,32);
    hub.addColorStop(0,'#2a2a4a'); hub.addColorStop(1,'#0d0d1a');
    ctx.beginPath(); ctx.arc(cx,cy,32,0,Math.PI*2);
    ctx.fillStyle=hub; ctx.fill();
    ctx.strokeStyle='rgba(99,102,241,.9)'; ctx.lineWidth=3; ctx.stroke();
    ctx.font='bold 18px sans-serif'; ctx.fillStyle='#a5b4fc';
    ctx.textAlign='center'; ctx.fillText('✦',cx,cy+6);
  }, []);

  useEffect(() => { if (!loading) draw(spinRef.current.angle); }, [prizes, loading, draw]);

  const animate = useCallback((wonPrize, reward) => {
    const s = spinRef.current;
    s.velocity *= .983;
    s.angle    += s.velocity;
    draw(s.angle);

    if (s.velocity > .003) {
      s.raf = requestAnimationFrame(() => animate(wonPrize, reward));
    } else {
      s.spinning = false;
      spinLockRef.current = false;
      setSpinning(false);
      setResult(wonPrize);
      setShowResult(true);

      if (reward?.type === 'coins') {
        const earned = reward.amount || 0;
        setCoins(prev => prev + earned);
        toast.success(`🎉 ${t('spin_you_won')} ${earned} ${t('nav_coins')}!`);
      } else if (reward?.type === 'plan') {
        toast.success(`🎉 Pro Trial ${reward.days} days activated!`);
      } else if (reward?.type === 'restore') {
        toast.success(`🎉 ${t('spin_credited')}`);
      }

      if (refreshUser) {
        refreshUser().then(updated => {
          if (updated?.coins != null) {
            setCoins(updated.coins);
            setTimeout(() => broadcastCoins(updated.coins), 0);
          }
        }).catch(() => {});
      } else {
        setTimeout(() => { setCoins(prev => { broadcastCoins(prev); return prev; }); }, 0);
      }
    }
  }, [draw, toast, refreshUser, t]);

  const handleSpin = async () => {
    if (spinLockRef.current || spinning || alreadySpin || !token) return;
    spinLockRef.current = true;
    setSpinning(true);
    setShowResult(false);
    setResult(null);

    try {
      const r = await fetch(`${BASE}/spin-wheel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await r.json();

      if (!r.ok) {
        spinLockRef.current = false;
        setSpinning(false);
        if (r.status === 429 || data.already_spun) {
          setTimeout(() => setAlready(true), 0);
          toast.info(`${t('spin_already')}! ${t('spin_come_back')}`);
        } else {
          toast.error(data.error || t('error'));
        }
        return;
      }

      const wonValue      = data.won?.value;
      const currentPrizes = prizesRef.current;
      let wonIdx = currentPrizes.findIndex(p => p.value === wonValue);
      if (wonIdx < 0) wonIdx = 0;

      const prize       = currentPrizes[wonIdx];
      const arc         = (2 * Math.PI) / currentPrizes.length;
      const segCenter   = wonIdx * arc + arc / 2;
      const pointerAngle= -Math.PI / 2;
      const curAngle    = spinRef.current.angle % (2 * Math.PI);
      const extraSpins  = (8 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
      const targetAngle = pointerAngle - segCenter;
      const normalised  = ((targetAngle - curAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const totalSpin   = extraSpins + normalised;

      spinRef.current.velocity = totalSpin / 280;
      spinRef.current.spinning = true;
      cancelAnimationFrame(spinRef.current.raf);
      spinRef.current.raf = requestAnimationFrame(() => animate(prize, data.reward));

      setTimeout(() => setAlready(true), 0);

      if (data.reward?.type === 'coins') {
        setHistory(prev => [{
          description: `Spin: ${prize.label}`,
          amount: data.reward.amount,
          type: 'spin',
          created_at: new Date().toISOString(),
        }, ...prev].slice(0, 5));
      }
    } catch (err) {
      console.error('Spin error:', err);
      toast.error(t('error'));
      setSpinning(false);
      spinLockRef.current = false;
    }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner"/>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'32px 16px 64px' }}>
      <style>{`
        @keyframes spinPop   { from{transform:scale(.5);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.5)} 50%{box-shadow:0 0 0 20px rgba(249,115,22,0)} }
        @keyframes shimmer   { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes bounceIn  { 0%{transform:scale(.3);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        .spin-btn { transition:all .2s !important; }
        .spin-btn:hover:not(:disabled) { transform:scale(1.05)!important; box-shadow:0 12px 40px rgba(249,115,22,.6)!important; }
        .spin-btn:active:not(:disabled){ transform:scale(.96)!important; }
        .prize-card { transition:all .2s; }
        .prize-card:hover { transform:translateY(-2px); border-color:rgba(255,255,255,.2)!important; }
      `}</style>

      <div style={{ maxWidth:580, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <SpinLogo spinning={spinning}/>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'2rem', fontWeight:900, margin:'4px 0 8px',
            background:'linear-gradient(135deg,#f97316,#eab308,#f97316)', backgroundSize:'200% auto',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'shimmer 3s linear infinite' }}>
            {t('spin_title')}
          </h1>
          <p style={{ color:'var(--text2)', margin:'0 0 16px', fontSize:'.9rem' }}>{t('spin_subtitle')}</p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10,
            background:'linear-gradient(135deg,rgba(234,179,8,.12),rgba(249,115,22,.08))',
            border:'1px solid rgba(234,179,8,.35)', borderRadius:24, padding:'10px 24px' }}>
            <span style={{ fontSize:'1.4rem' }}>🪙</span>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#eab308', fontSize:'1.2rem', lineHeight:1 }}>
                {coins.toLocaleString()}
              </div>
              <div style={{ fontSize:'.68rem', color:'var(--text3)' }}>{t('your_coins')}</div>
            </div>
          </div>
        </div>

        {/* Already-spun banner */}
        {alreadySpin && (
          <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.08))', border:'1px solid rgba(99,102,241,.3)', borderRadius:14, padding:'12px 20px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:'1.4rem' }}>⏰</span>
              <div>
                <div style={{ fontWeight:700, fontSize:'.88rem' }}>{t('spin_already')}</div>
                <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{t('spin_next')}</div>
              </div>
            </div>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#f97316', fontSize:'1rem' }}>{timeLeft}</div>
          </div>
        )}

        {/* Pointer */}
        <div style={{ textAlign:'center', marginBottom:-22, zIndex:2, position:'relative' }}>
          <div style={{ display:'inline-block', position:'relative' }}>
            <div style={{ width:0, height:0, borderLeft:'18px solid transparent', borderRight:'18px solid transparent', borderTop:'36px solid #f97316', filter:'drop-shadow(0 4px 12px rgba(249,115,22,.8))' }}/>
            <div style={{ width:0, height:0, borderLeft:'12px solid transparent', borderRight:'12px solid transparent', borderTop:'24px solid #fbbf24', position:'absolute', top:4, left:'50%', transform:'translateX(-50%)' }}/>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ display:'flex', justifyContent:'center', position:'relative' }}>
          <div style={{ borderRadius:'50%', padding:4, background:'linear-gradient(135deg,#f97316,#8b5cf6,#06b6d4,#f97316)', backgroundSize:'300% 300%', animation:'shimmer 3s linear infinite' }}>
            <canvas ref={canvasRef} width={360} height={360}
              style={{ borderRadius:'50%', display:'block', animation: spinning ? 'glowPulse 0.8s ease-in-out infinite' : 'none' }}/>
          </div>
        </div>

        {/* Spin button */}
        <div style={{ textAlign:'center', marginTop:28 }}>
          {alreadySpin ? (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:'20px 28px', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', marginBottom:6 }}>🎡</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1rem', marginBottom:4 }}>{t('spin_come_back')}</div>
              <div style={{ color:'var(--text3)', fontSize:'.85rem' }}>
                {t('spin_next_in')} <strong style={{ color:'#f97316' }}>{timeLeft}</strong>
              </div>
            </div>
          ) : (
            <button className="spin-btn" onClick={handleSpin} disabled={spinning}
              style={{
                backgroundImage:  spinning ? 'none' : 'linear-gradient(135deg,#f97316,#ef4444,#f97316)',
                backgroundSize:   spinning ? 'auto' : '200% auto',
                backgroundColor:  spinning ? 'var(--surface2)' : 'transparent',
                animation:        spinning ? 'none' : 'shimmer 2s linear infinite',
                color:'#fff', border:'none', borderRadius:20, padding:'18px 64px',
                fontSize:'1.15rem', fontWeight:900, cursor: spinning ? 'not-allowed' : 'pointer',
                fontFamily:'Syne,sans-serif', boxShadow: spinning ? 'none' : '0 6px 28px rgba(249,115,22,.5)', letterSpacing:1,
              }}>
              {spinning ? `🎡 ${t('spin_spinning')}` : `🎡 ${t('spin_now')}`}
            </button>
          )}
        </div>

        {/* Win result */}
        {showResult && result && (
          <div style={{ background:`linear-gradient(135deg,${result.color}18,${result.color}08)`, border:`2px solid ${result.color}66`, borderRadius:24, padding:'32px 28px', marginTop:28, textAlign:'center', animation:'bounceIn .6s cubic-bezier(.175,.885,.32,1.275)' }}>
            <div style={{ fontSize:'4rem', marginBottom:10, lineHeight:1 }}>{result.emoji}</div>
            <div style={{ fontSize:'.7rem', color:result.color, fontWeight:900, textTransform:'uppercase', letterSpacing:3, marginBottom:8 }}>🎉 {t('spin_you_won')}</div>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:'2rem', fontWeight:900, color:result.color }}>{result.label}</div>
            <p style={{ color:'var(--text2)', fontSize:'.88rem', marginTop:10 }}>{t('spin_credited')}</p>
            <div style={{ marginTop:16, padding:'10px 20px', background:result.color+'22', borderRadius:12, display:'inline-block' }}>
              <span style={{ fontWeight:700, color:result.color }}>🪙 {t('spin_new_balance')}: {coins.toLocaleString()} {t('nav_coins')}</span>
            </div>
          </div>
        )}

        {/* Prizes grid */}
        <div style={{ marginTop:36 }}>
          <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'.82rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:2, marginBottom:14 }}>
            🎁 {t('spin_prizes')}
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {prizes.map((p, i) => (
              <div key={i} className="prize-card" style={{ background:'var(--surface)', border:`1px solid ${p.color}33`, borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${p.color}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', flexShrink:0 }}>
                  {p.emoji}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.88rem' }}>{p.label}</div>
                  <div style={{ fontSize:'.7rem', color:p.color, marginTop:2, fontWeight:600 }}>
                    {p.probability}% {t('spin_chance')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spin history */}
        {history.length > 0 && (
          <div style={{ marginTop:32 }}>
            <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'.82rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:2, marginBottom:14 }}>
              📜 {t('spin_recent')}
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {history.map((h, i) => (
                <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'var(--text2)', fontSize:'.85rem' }}>{h.description}</span>
                  <span style={{ fontWeight:800, color:h.amount>0?'#22c55e':'#ef4444', fontSize:'.9rem' }}>
                    {h.amount>0?'+':''}{h.amount} 🪙
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}