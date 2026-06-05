// PATH: quiz-platform/frontend/src/components/WeakTopicsChart.js
import React from 'react';

function getColor(pct) {
  if (pct >= 80) return '#00d4aa';
  if (pct >= 60) return '#eab308';
  return '#ff6b9d';
}

export default function WeakTopicsChart({ categories = [] }) {
  if (!categories.length) return null;
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'22px 20px', marginBottom:28 }}>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1rem', fontWeight:700, marginBottom:18 }}>🧠 Performance by Category</div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {categories.map((cat, i) => (
          <div key={i}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:'.83rem' }}>
              <span style={{ color:'var(--text)' }}>{cat.name}</span>
              <span style={{ color:getColor(cat.pct), fontWeight:700, fontFamily:'Syne' }}>
                {cat.pct}%
                <span style={{ color:'var(--text3)', fontWeight:400, fontSize:'.75rem', marginLeft:4 }}>({cat.attempts} attempts)</span>
              </span>
            </div>
            <div style={{ height:8, background:'var(--surface2)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${cat.pct}%`, background:getColor(cat.pct), borderRadius:4, transition:'width .6s ease' }} />
            </div>
          </div>
        ))}
      </div>
      {categories[0]?.pct < 60 && (
        <div style={{ marginTop:16, padding:'10px 14px', background:'rgba(255,107,157,.08)', border:'1px solid rgba(255,107,157,.2)', borderRadius:8, fontSize:'.82rem', color:'var(--text2)' }}>
          💡 Focus on <strong style={{ color:'#ff6b9d' }}>{categories[0].name}</strong> — your weakest category at {categories[0].pct}%
        </div>
      )}
    </div>
  );
}