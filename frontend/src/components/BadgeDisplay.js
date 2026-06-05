// PATH: quiz-platform/frontend/src/components/BadgeDisplay.js
import React, { useEffect, useState } from 'react';
import api from '../utils/api';

export default function BadgeDisplay({ userId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!userId) return;
    api.get(`/users/${userId}/badges`)
      .then(r => setData(r.data))
      .catch(() => {});
  }, [userId]);

  if (!data) return null;
  const earned = new Set(data.badges.map(b => b.id));

  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1rem', fontWeight:700, marginBottom:14 }}>
        🎖️ Badges ({data.badges.length}/{data.all_badges.length})
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10 }}>
        {data.all_badges.map(b => {
          const has  = earned.has(b.id);
          const info = data.badges.find(x => x.id === b.id);
          return (
            <div key={b.id} style={{ background:'var(--surface)', border:`1px solid ${has?'rgba(108,99,255,.3)':'var(--border)'}`, borderRadius:12, padding:'14px 10px', textAlign:'center', opacity:has?1:0.4, transition:'opacity .2s' }}>
              <div style={{ fontSize:'1.6rem', marginBottom:6 }}>{b.emoji}</div>
              <div style={{ fontWeight:600, fontSize:'.78rem', marginBottom:3, color:has?'var(--text)':'var(--text3)' }}>{b.label}</div>
              <div style={{ fontSize:'.68rem', color:'var(--text3)', lineHeight:1.3 }}>{b.desc}</div>
              {has && info?.earned_at && (
                <div style={{ fontSize:'.65rem', color:'var(--accent)', marginTop:5 }}>
                  ✓ {new Date(info.earned_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}