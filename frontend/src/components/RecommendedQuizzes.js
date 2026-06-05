// PATH: quiz-platform/frontend/src/components/RecommendedQuizzes.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function RecommendedQuizzes() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.get('/recommendations')
      .then(r => setData(r.data))
      .catch(()  => {})
      .finally(()=> setLoading(false));
  }, [user]);

  if (!user || loading || !data?.recommendations?.length) return null;

  return (
    <div style={{ marginBottom:32 }}>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.1rem', fontWeight:800, marginBottom:6 }}>
        🎯 Recommended for You
      </div>
      {data.weak_category && (
        <p style={{ fontSize:'.83rem', color:'var(--text3)', marginBottom:14 }}>
          Based on your performance in <strong style={{ color:'#ff6b9d' }}>{data.weak_category}</strong>
        </p>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
        {data.recommendations.map((q, i) => (
          <div key={i} className="card" style={{ cursor:'pointer', padding:16 }}
            onClick={() => navigate(`/quiz/${q.id}`)}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span className="badge badge-accent" style={{ fontSize:'.65rem' }}>{q.category}</span>
              <span style={{ fontSize:'.7rem', color:'var(--text3)' }}>▶ {q.plays||0} plays</span>
            </div>
            <div style={{ fontWeight:600, fontSize:'.9rem', marginBottom:4 }}>{q.title}</div>
            <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>by {q.creator_name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}