// PATH: quiz-platform/frontend/src/components/LeaderboardTable.js
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatTime } from '../utils/helpers';

const MEDALS = ['🥇','🥈','🥉'];

export default function LeaderboardTable({ quizId }) {
  const [data,    setData]    = useState([]);
  const [period,  setPeriod]  = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    api.get(`/quizzes/${quizId}/leaderboard?period=${period}`)
      .then(r => setData(r.data || []))
      .catch(()  => {})
      .finally(()=> setLoading(false));
  }, [quizId, period]);

  return (
    <div style={{ marginTop:32 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div className="section-title">🏆 Leaderboard</div>
        <div style={{ display:'flex', gap:6 }}>
          {['all','week'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding:'5px 14px', borderRadius:50, border:'1px solid var(--border)', fontSize:'.78rem', cursor:'pointer',
                background:period===p?'var(--accent)':'transparent',
                color:     period===p?'#fff':'var(--text2)' }}>
              {p==='all'?'All Time':'This Week'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:52, borderRadius:10 }} />)}
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:'center', color:'var(--text3)', padding:'24px 0', fontSize:'.88rem' }}>
          No entries yet. Be the first on the board!
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {data.map((row, i) => {
            const pct = Math.round((row.score / row.total_questions) * 100);
            return (
              <div key={i} style={{ background:'var(--surface)', border:`1px solid ${i===0?'rgba(255,215,0,.25)':i===1?'rgba(192,192,192,.2)':i===2?'rgba(205,127,50,.2)':'var(--border)'}`, borderRadius:10, padding:'11px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:28, textAlign:'center', fontSize:i<3?'1.1rem':'.82rem', fontFamily:'Syne', fontWeight:700, color:'var(--text3)' }}>
                  {i < 3 ? MEDALS[i] : i+1}
                </div>
                <div style={{ flex:1, fontWeight:600, fontSize:'.9rem' }}>{row.user_name}</div>
                <div style={{ fontSize:'.78rem', color:'var(--text3)' }}>⏱ {formatTime(row.time_taken||0)}</div>
                <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:'1rem', color:pct>=80?'#00d4aa':pct>=60?'#eab308':'#ff6b9d' }}>{pct}%</div>
                <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{row.score}/{row.total_questions}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}