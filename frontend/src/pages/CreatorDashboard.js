// PATH: quiz-platform/frontend/src/pages/CreatorDashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function CreatorDashboard() {
  const navigate  = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/creator/dashboard')
      .then(r => setData(r.data))
      .catch(()  => {})
      .finally(()=> setLoading(false));
  }, []);

  if (loading) return (
    <div className="section-sm">
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:72, borderRadius:12, marginBottom:10 }} />)}
    </div>
  );

  return (
    <div className="page-enter section-sm">
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/profile')}>← Profile</button>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.8rem', fontWeight:800 }}>📊 Creator Dashboard</h1>
          <p style={{ color:'var(--text2)', fontSize:'.88rem', marginTop:2 }}>How your quizzes are performing</p>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:28 }}>
        {[
          { val: data?.total_quizzes || 0,    label:'Quizzes Created', color:'var(--accent)'  },
          { val: data?.total_plays   || 0,    label:'Total Plays',     color:'var(--accent3)' },
          { val: `${data?.avg_score  || 0}%`, label:'Avg Score',       color:'var(--accent4)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ textAlign:'center', padding:16 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.35rem', fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {!data?.quizzes?.length ? (
        <div className="empty-state">
          <div className="empty-icon">✏️</div>
          <div className="empty-text">No quizzes yet</div>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => navigate('/create')}>Create Your First Quiz</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {data.quizzes.map((q, i) => (
            <div key={i} className="card" style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:'.9rem', marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {q.title}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <span className="badge badge-accent" style={{ fontSize:'.65rem' }}>{q.category}</span>
                  <span style={{ fontSize:'.74rem', color:'var(--text3)' }}>{q.is_public ? '🌍 Public' : '🔒 Private'}</span>
                  <span style={{ fontSize:'.74rem', color:'var(--text3)' }}>{q.attempt_count} plays</span>
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:'1.1rem', color:'var(--accent3)' }}>
                  {q.avg_score !== null ? `${q.avg_score}%` : '—'}
                </div>
                <div style={{ fontSize:'.72rem', color:'var(--text3)' }}>avg score</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/edit/${q.id}`)}>Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}