// PATH: quiz-platform/frontend/src/components/StreakBadge.js
import React from 'react';

export default function StreakBadge({ streak = 0, size = 'md' }) {
  if (!streak || streak < 1) return null;
  const sm    = size === 'sm';
  const color = streak >= 7 ? '#ef4444' : '#f97316';
  const bg    = streak >= 7 ? 'rgba(239,68,68,.1)' : 'rgba(249,115,22,.1)';
  const border= streak >= 7 ? 'rgba(239,68,68,.25)' : 'rgba(249,115,22,.25)';
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap: sm?4:6,
      background:bg, border:`1px solid ${border}`, borderRadius:50,
      padding: sm?'3px 10px':'5px 14px' }}>
      <span style={{ fontSize: sm?14:18 }}>🔥</span>
      <span style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color, fontSize: sm?'.78rem':'1rem' }}>
        {streak}
      </span>
      <span style={{ fontSize: sm?'.7rem':'.8rem', color:'var(--text3)' }}>
        day{streak!==1?'s':''} streak
      </span>
    </div>
  );
}