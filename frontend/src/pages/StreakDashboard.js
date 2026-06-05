// PATH: quiz-platform/frontend/src/pages/StreakDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../utils/api';

const SM = [
  { days:3,  key:'beginner_learner',  label:'Beginner Learner',  emoji:'📚', xp:50,   coins:50   },
  { days:7,  key:'quiz_explorer',     label:'Quiz Explorer',     emoji:'🔭', xp:100,  coins:100  },
  { days:10, key:'knowledge_warrior', label:'Knowledge Warrior', emoji:'⚔️', xp:200,  coins:200  },
  { days:20, key:'quiz_master',       label:'Quiz Master',       emoji:'🎓', xp:500,  coins:500  },
  { days:30, key:'legend_scholar',    label:'Legend Scholar',    emoji:'📜', xp:1000, coins:1000 },
  { days:60, key:'grand_champion',    label:'Grand Champion',    emoji:'👑', xp:3000, coins:3000 },
];

function CalendarHeatmap({ history }) {
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = d.toISOString().split('T')[0];
    const entry = history.find(h => h.date === ds);
    days.push({ date: ds, action: entry?.action, day: d.getDate(), month: d.getMonth() });
  }
  const getColor = action => {
    if (!action) return 'var(--surface2)';
    if (action === 'freeze_used') return 'rgba(99,102,241,.4)';
    return 'rgba(249,115,22,.85)';
  };
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
      {days.map((d, i) => (
        <div key={i} title={`${d.date}${d.action ? ` (${d.action.replace('_', ' ')})` : ''}`}
          style={{ width:14, height:14, borderRadius:3, background:getColor(d.action), cursor:'default', transition:'transform .1s' }}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.4)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'} />
      ))}
    </div>
  );
}

export default function StreakDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/users/${user.id}/streak`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <div className="section-sm">{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:100, borderRadius:12, marginBottom:12 }} />)}</div>;
  if (!data) return null;

  const earned = new Set((data.rewards || []).map(r => r.reward_key));
  const today  = new Date().toISOString().split('T')[0];
  const playedToday = data.last_played === today;

  return (
    <div className="page-enter section-sm">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Back</button>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.6rem', fontWeight:800 }}>🔥 Streak Dashboard</h1>
      </div>

      {/* Streak hero */}
      <div style={{ background:'linear-gradient(135deg,rgba(249,115,22,.25),rgba(239,68,68,.15))', border:'1px solid rgba(249,115,22,.35)', borderRadius:20, padding:'28px 24px', marginBottom:20, textAlign:'center' }}>
        <div style={{ fontSize:'4.5rem', fontFamily:'Syne,sans-serif', fontWeight:900, color:'#f97316', lineHeight:1 }}>{data.current_streak}</div>
        <div style={{ fontSize:'.95rem', color:'var(--text2)', marginTop:4, marginBottom:12 }}>Day Streak</div>
        {data.streak_title && (
          <div style={{ display:'inline-block', background:'rgba(249,115,22,.2)', border:'1px solid rgba(249,115,22,.4)', borderRadius:50, padding:'5px 18px', fontSize:'.85rem', fontWeight:700, color:'#f97316' }}>
            🔥 {data.streak_title}
          </div>
        )}
        {!playedToday && (
          <div style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'8px 14px', marginTop:14, fontSize:'.82rem', color:'#ef4444', fontWeight:600 }}>
            ⚠️ Play a quiz today to keep your streak alive!
          </div>
        )}
        {playedToday && (
          <div style={{ background:'rgba(0,212,170,.1)', border:'1px solid rgba(0,212,170,.25)', borderRadius:10, padding:'8px 14px', marginTop:14, fontSize:'.82rem', color:'#00d4aa', fontWeight:600 }}>
            ✅ You played today! Streak secured.
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { val:data.current_streak,  label:'Current',   icon:'🔥', color:'#f97316' },
          { val:data.longest_streak,  label:'Best',      icon:'🏆', color:'#eab308' },
          { val:data.freeze_credits,  label:'Freezes',   icon:'🧊', color:'#6366f1' },
          { val:`Lv.${data.level}`,   label:'Level',     icon:'⬆️', color:'var(--accent)' },
        ].map((s,i) => (
          <div key={i} className="card" style={{ textAlign:'center', padding:14 }}>
            <div style={{ fontSize:'1.3rem' }}>{s.icon}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:'1.2rem', color:s.color, lineHeight:1, marginTop:4 }}>{s.val}</div>
            <div style={{ fontSize:'.7rem', color:'var(--text3)', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress to next milestone */}
      {data.next_milestone && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <span style={{ fontWeight:700, fontSize:'.9rem' }}>Next: </span>
              <span style={{ color:'#f97316' }}>{data.next_milestone.emoji} {data.next_milestone.label}</span>
            </div>
            <div style={{ fontSize:'.8rem', color:'var(--text3)' }}>{data.current_streak}/{data.next_milestone.days} days</div>
          </div>
          <div style={{ height:10, background:'var(--surface2)', borderRadius:5, overflow:'hidden', marginBottom:8 }}>
            <div style={{ height:'100%', width:`${data.progress_to_next}%`, background:'linear-gradient(90deg,#f97316,#ef4444)', borderRadius:5, transition:'width .6s' }} />
          </div>
          <div style={{ display:'flex', gap:12, fontSize:'.78rem', color:'var(--text3)' }}>
            <span>🪙 +{data.next_milestone.coins} coins</span>
            <span>⭐ +{data.next_milestone.xp} XP</span>
            <span>🏅 Badge</span>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12 }}>📅 Activity (Last 90 Days)</div>
        <CalendarHeatmap history={data.streak_history || []} />
        <div style={{ display:'flex', gap:16, marginTop:12, fontSize:'.72rem', color:'var(--text3)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'rgba(249,115,22,.85)', display:'inline-block' }} /> Played</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'rgba(99,102,241,.4)', display:'inline-block' }} /> Freeze used</span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:10, borderRadius:2, background:'var(--surface2)', display:'inline-block' }} /> Missed</span>
        </div>
      </div>

      {/* All milestones */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:14 }}>🏅 Milestones</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {SM.map((m, i) => {
            const done    = earned.has(m.key);
            const current = !done && data.current_streak >= m.days;
            const locked  = !done && data.current_streak < m.days;
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, opacity: locked ? 0.5 : 1 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', flexShrink:0, background: done ? 'rgba(0,212,170,.15)' : current ? 'rgba(249,115,22,.15)' : 'var(--surface2)', border: done ? '2px solid rgba(0,212,170,.4)' : current ? '2px solid rgba(249,115,22,.4)' : '2px solid var(--border)' }}>
                  {done ? '✅' : m.emoji}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'.88rem' }}>{m.label} <span style={{ color:'#f97316', fontSize:'.75rem' }}>({m.days} days)</span></div>
                  <div style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:1 }}>+{m.coins} coins · +{m.xp} XP</div>
                </div>
                <div style={{ fontSize:'.78rem', fontWeight:600, color: done ? '#00d4aa' : 'var(--text3)' }}>
                  {done ? '✓ Earned' : locked ? `${m.days - data.current_streak}d to go` : '🔓 Unlocked'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Streak info */}
      <div className="card">
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12 }}>🧊 Streak Freeze System</div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:'.85rem' }}>
          <span>Freeze Credits Remaining</span>
          <span style={{ color:'#6366f1', fontWeight:700 }}>🧊 {data.freeze_credits}</span>
        </div>
        <div style={{ fontSize:'.82rem', color:'var(--text3)', lineHeight:1.6 }}>
          A streak freeze automatically protects your streak if you miss one day. Freezes are awarded based on your subscription plan: Free (2/month), Pro (5/month), Elite (10/month).
        </div>
        {data.freeze_credits === 0 && (
          <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={() => navigate('/subscription')}>
            ⬆️ Upgrade for More Freezes
          </button>
        )}
      </div>
    </div>
  );
}
