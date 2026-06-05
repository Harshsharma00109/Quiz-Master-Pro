// PATH: quiz-platform/frontend/src/components/BadgeToast.js
import React, { useEffect, useState } from 'react';

export default function BadgeToast({ badges = [], onDone }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!badges.length) return;
    const t = setTimeout(() => {
      if (index < badges.length - 1) setIndex(i => i + 1);
      else onDone?.();
    }, 3000);
    return () => clearTimeout(t);
  }, [index, badges.length]); // eslint-disable-line

  if (!badges.length) return null;
  const badge = badges[index];

  return (
    <div style={{ position:'fixed', bottom:32, right:32, zIndex:9999,
      background:'var(--surface)', border:'1px solid rgba(108,99,255,.4)',
      borderRadius:16, padding:'18px 22px', minWidth:240,
      animation:'_bslide .4s ease' }}>
      <style>{`@keyframes _bslide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:'2.2rem' }}>{badge.emoji}</div>
        <div>
          <div style={{ fontSize:'.7rem', color:'var(--accent)', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>
            New Badge Earned!
          </div>
          <div style={{ fontWeight:700, fontSize:'.95rem', marginBottom:2 }}>{badge.label}</div>
          <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{badge.desc}</div>
        </div>
      </div>
    </div>
  );
}