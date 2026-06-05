// PATH: quiz-platform/frontend/src/components/ProgressChart.js
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Dot
} from 'recharts';

// ── Custom tooltip ─────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: '.82rem',
      boxShadow: '0 8px 32px rgba(0,0,0,.35)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>{d.title}</div>
      <div style={{ color: '#6366f1' }}>Score: <strong>{d.pct}%</strong></div>
      <div style={{ color: 'var(--text3)' }}>{d.score}/{d.total} correct</div>
      {d.date && <div style={{ color: 'var(--text3)', marginTop: 3 }}>{d.date}</div>}
    </div>
  );
}

// ── Custom dot — green if passed, red if failed ────────────
function CustomDot(props) {
  const { cx, cy, payload } = props;
  const passed = payload.pct >= 60;
  return (
    <Dot
      cx={cx} cy={cy} r={5}
      fill={passed ? '#00d4aa' : '#ff6b9d'}
      stroke={passed ? '#00d4aa' : '#ff6b9d'}
      strokeWidth={2}
    />
  );
}

// ── Main component ─────────────────────────────────────────
// Props:
//   attempts — array of { quiz_title, score, total_questions, completed_at }
//   title    — section heading (optional)
//   maxPoints — how many recent attempts to show (default 10)
export default function ProgressChart({ attempts = [], title = '📈 Score Progress', maxPoints = 10 }) {
  if (!attempts || attempts.length < 2) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '28px 20px',
        textAlign: 'center',
        marginBottom: 28,
      }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📈</div>
        <div style={{ color: 'var(--text2)', fontSize: '.88rem' }}>
          Complete at least 2 quizzes to see your progress chart.
        </div>
      </div>
    );
  }

  // Take the most recent `maxPoints` attempts, oldest first for left→right trend
  const slice = [...attempts]
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
    .slice(-maxPoints);

  const data = slice.map((a, i) => ({
    name:  `#${i + 1}`,
    pct:   Math.round((a.score / a.total_questions) * 100),
    score: a.score,
    total: a.total_questions,
    title: a.quiz_title || 'Quiz',
    date:  a.completed_at
      ? new Date(a.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : '',
  }));

  const avg = Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '22px 20px 16px',
      marginBottom: 28,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1rem', fontWeight: 700 }}>{title}</div>
        <div style={{ display: 'flex', gap: 14, fontSize: '.76rem' }}>
          <span style={{ color: '#00d4aa', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4aa', display: 'inline-block' }} />
            Passed (≥60%)
          </span>
          <span style={{ color: '#ff6b9d', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b9d', display: 'inline-block' }} />
            Failed
          </span>
          <span style={{ color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 16, height: 2, background: 'rgba(108,99,255,.5)', display: 'inline-block', borderTop: '2px dashed rgba(108,99,255,.5)' }} />
            Avg {avg}%
          </span>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--text3)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--text3)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Pass/fail reference line at 60% */}
          <ReferenceLine
            y={60}
            stroke="rgba(108,99,255,.35)"
            strokeDasharray="5 4"
            label={{ value: '60% pass', fill: 'rgba(108,99,255,.6)', fontSize: 10, position: 'insideTopRight' }}
          />

          {/* Average reference line */}
          <ReferenceLine
            y={avg}
            stroke="rgba(108,99,255,.2)"
            strokeDasharray="3 3"
          />

          <Line
            type="monotone"
            dataKey="pct"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={<CustomDot />}
            activeDot={{ r: 7, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Footer summary */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 10, fontSize: '.76rem', color: 'var(--text3)' }}>
        <span>Showing last {data.length} attempt{data.length !== 1 ? 's' : ''}</span>
        <span>Average: <strong style={{ color: '#6366f1' }}>{avg}%</strong></span>
        <span>Best: <strong style={{ color: '#00d4aa' }}>{Math.max(...data.map(d => d.pct))}%</strong></span>
      </div>
    </div>
  );
}