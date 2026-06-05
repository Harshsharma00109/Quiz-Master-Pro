// PATH: quiz-platform/frontend/src/components/ScoreRing.js
import React from 'react';
import { getScoreColor } from '../utils/helpers';

export default function ScoreRing({ score, total, size = 160 }) {
  const pct          = total > 0 ? Math.round((score / total) * 100) : 0;
  const radius       = (size / 2) - 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset   = circumference - (pct / 100) * circumference;
  const color        = getScoreColor(pct);
  const center       = size / 2;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="var(--surface2)" strokeWidth="10"
        />
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'Syne,sans-serif', fontSize: size > 120 ? '2rem' : '1.4rem',
          fontWeight: 800, color,
        }}>
          {pct}%
        </div>
        <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: 2 }}>
          {score}/{total}
        </div>
      </div>
    </div>
  );
}
