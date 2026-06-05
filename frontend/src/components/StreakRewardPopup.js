// PATH: quiz-platform/frontend/src/components/StreakRewardPopup.js
// Usage: <StreakRewardPopup reward={streakReward} onClose={() => setStreakReward(null)} />
// streakReward: { days, key, label, emoji, xp }
import React, { useEffect, useState, useCallback } from 'react';

const CONFETTI_COLORS = ['#6366f1','#f97316','#eab308','#00d4aa','#ef4444','#8b5cf6'];

function Confetti() {
  const pieces = Array.from({ length:20 },(_,i)=>({
    id:i,
    left:`${Math.random()*100}%`,
    delay:`${Math.random()*1.5}s`,
    color:CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)],
    size:`${6+Math.random()*8}px`,
    duration:`${1.5+Math.random()}s`,
  }));
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none', borderRadius:20 }}>
      <style>{`
        @keyframes _fall{from{transform:translateY(-20px) rotate(0);opacity:1}to{transform:translateY(120px) rotate(360deg);opacity:0}}
      `}</style>
      {pieces.map(p=>(
        <div key={p.id} style={{ position:'absolute', top:0, left:p.left, width:p.size, height:p.size, background:p.color, borderRadius:'50%', animationName:'_fall', animationDuration:p.duration, animationDelay:p.delay, animationFillMode:'forwards' }} />
      ))}
    </div>
  );
}

export default function StreakRewardPopup({ reward, onClose }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(()=>{ setVisible(false); onClose?.(); },400);
  }, [onClose]);

  useEffect(() => {
    if (!reward) return;
    setVisible(true); setClosing(false);
    const t = setTimeout(handleClose, 7000);
    return () => clearTimeout(t);
  }, [reward, handleClose]);

  if (!reward||!visible) return null;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', backdropFilter:'blur(10px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={handleClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:'var(--surface)', border:'2px solid rgba(249,115,22,.4)', borderRadius:20, padding:'40px 32px', maxWidth:360, width:'100%', textAlign:'center', position:'relative', overflow:'hidden',
          animation:closing?'_popout .4s ease forwards':'_popin .5s cubic-bezier(.175,.885,.32,1.275)' }}>
        <style>{`
          @keyframes _popin{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
          @keyframes _popout{from{transform:scale(1);opacity:1}to{transform:scale(.8);opacity:0}}
        `}</style>

        <Confetti />

        <div style={{ fontSize:'5.5rem', marginBottom:12, lineHeight:1, position:'relative', zIndex:1 }}>{reward.emoji}</div>

        <div style={{ fontSize:'.72rem', color:'#f97316', fontWeight:800, textTransform:'uppercase', letterSpacing:2, marginBottom:8 }}>
          🔥 Streak Milestone Unlocked!
        </div>

        <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.8rem', fontWeight:900, marginBottom:6 }}>
          {reward.label}
        </div>

        <div style={{ fontSize:'.9rem', color:'var(--text2)', marginBottom:20, lineHeight:1.6 }}>
          You've maintained a <strong style={{ color:'#f97316' }}>{reward.days}-day streak!</strong>
          <br />You're unstoppable! Keep it up 🚀
        </div>

        <div style={{ background:'linear-gradient(135deg,rgba(249,115,22,.15),rgba(239,68,68,.1))', border:'1px solid rgba(249,115,22,.3)', borderRadius:12, padding:'14px 20px', marginBottom:20 }}>
          <div style={{ fontSize:'.72rem', color:'var(--text3)', marginBottom:4 }}>New Title Earned</div>
          <div style={{ fontWeight:800, color:'#f97316', fontSize:'1.1rem' }}>{reward.emoji} {reward.label}</div>
          {reward.xp&&<div style={{ fontSize:'.75rem', color:'#eab308', marginTop:4 }}>+{reward.xp} XP earned!</div>}
        </div>

        <button className="btn btn-primary btn-full" onClick={handleClose} style={{ fontSize:'1rem', padding:'12px' }}>
          Awesome! 🎉
        </button>
        <p style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:10 }}>Tap anywhere to close · Auto-closes in 7s</p>
      </div>
    </div>
  );
}
