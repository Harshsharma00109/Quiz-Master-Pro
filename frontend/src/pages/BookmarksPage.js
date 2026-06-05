// PATH: quiz-platform/frontend/src/pages/BookmarksPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function BookmarksPage() {
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const [quizzes,  setQuizzes]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    setLoading(true);
    setError(null);
    api.get('/bookmarks')
      .then(r => setQuizzes(Array.isArray(r.data) ? r.data : []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load saved quizzes.'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const remove = async (quizId) => {
    try {
      await api.post('/bookmarks/toggle', { quiz_id: quizId });
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
    } catch {
      alert('Failed to remove bookmark. Please try again.');
    }
  };

  const diffColor = d => {
    if (!d) return 'var(--text3)';
    if (d.toLowerCase() === 'easy') return '#22c55e';
    if (d.toLowerCase() === 'hard') return '#ef4444';
    return '#f59e0b';
  };

  return (
    <div className="page-enter section-sm">
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Back</button>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.8rem', fontWeight:800 }}>🔖 Saved Quizzes</h1>
          <p style={{ color:'var(--text2)', fontSize:'.88rem', marginTop:2 }}>
            {loading ? '...' : `${quizzes.length} saved quiz${quizzes.length !== 1 ? 'zes' : ''}`}
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, padding:'12px 16px', color:'#ef4444', marginBottom:16, fontSize:'.88rem' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height:76, borderRadius:10 }} />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔖</div>
          <div className="empty-text">No saved quizzes yet</div>
          <div className="empty-sub">Tap the bookmark icon on any quiz to save it here.</div>
          <button
            className="btn btn-primary"
            style={{ marginTop:16 }}
            onClick={() => navigate('/browse')}
          >
            Browse Quizzes
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="card"
              style={{ display:'flex', alignItems:'center', gap:14, cursor:'pointer', transition:'transform .15s' }}
              onClick={() => navigate(`/quiz/${q.id}`)}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}
            >
              {/* Category pill */}
              <div style={{
                width:44, height:44, borderRadius:10, background:'var(--surface2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'1.2rem', flexShrink:0
              }}>
                {q.category === 'Science' ? '🔬' : q.category === 'History' ? '📜' :
                 q.category === 'Technology' ? '💻' : q.category === 'Mathematics' ? '➗' :
                 q.category === 'Geography' ? '🌍' : q.category === 'Sports' ? '⚽' :
                 q.category === 'Entertainment' ? '🎬' : q.category === 'Art' ? '🎨' :
                 q.category === 'Literature' ? '📚' : '🧩'}
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:'.92rem', marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {q.title}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:'.72rem', background:'var(--surface2)', padding:'2px 8px', borderRadius:20, color:'var(--text2)' }}>
                    {q.category || 'General'}
                  </span>
                  <span style={{ fontSize:'.72rem', color:diffColor(q.difficulty), fontWeight:600 }}>
                    {q.difficulty || 'Medium'}
                  </span>
                  <span style={{ fontSize:'.72rem', color:'var(--text3)' }}>▶ {q.plays || 0} plays</span>
                  <span style={{ fontSize:'.72rem', color:'var(--text3)' }}>by {q.creator_name || 'Unknown'}</span>
                </div>
              </div>

              <button
                onClick={e => { e.stopPropagation(); remove(q.id); }}
                title="Remove bookmark"
                style={{
                  background:'none', border:'1px solid var(--border)', color:'var(--text3)',
                  cursor:'pointer', fontSize:'.8rem', flexShrink:0, padding:'6px 10px',
                  borderRadius:8, transition:'all .15s'
                }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(239,68,68,.1)'; e.currentTarget.style.color='#ef4444'; e.currentTarget.style.borderColor='rgba(239,68,68,.3)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='none'; e.currentTarget.style.color='var(--text3)'; e.currentTarget.style.borderColor='var(--border)'; }}
              >
                🗑️ Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && quizzes.length > 0 && (
        <div style={{ textAlign:'center', marginTop:24 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/browse')}>
            + Browse More Quizzes
          </button>
        </div>
      )}
    </div>
  );
}
