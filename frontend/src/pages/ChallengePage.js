// PATH: quiz-platform/frontend/src/pages/ChallengePage.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import ScoreRing from '../components/ScoreRing';

export default function ChallengePage() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    api.get(`/challenges/${token}`)
      .then(r => setChallenge(r.data))
      .catch(e => setError(e.response?.data?.error || 'Challenge not found.'))
      .finally(()=> setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ textAlign:'center', paddingTop:80 }}>
      <div className="skeleton" style={{ width:200, height:24, margin:'0 auto 12px', borderRadius:8 }} />
    </div>
  );

  if (error) return (
    <div style={{ textAlign:'center', paddingTop:80 }}>
      <div style={{ fontSize:'3rem', marginBottom:16 }}>⏰</div>
      <p style={{ color:'var(--text2)', marginBottom:20 }}>{error}</p>
      <button className="btn btn-primary" onClick={() => navigate('/browse')}>Browse Quizzes</button>
    </div>
  );

  const pct      = Math.round((challenge.challenger_score / challenge.challenger_total) * 100);
  const expires  = new Date(challenge.expires_at);
  const daysLeft = Math.max(0, Math.ceil((expires - Date.now()) / 86400000));

  return (
    <div className="page-enter section-xs" style={{ maxWidth:480, margin:'0 auto' }}>
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <div style={{ fontSize:'3rem', marginBottom:8 }}>⚔️</div>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.8rem', fontWeight:800, marginBottom:8 }}>
          You've been challenged!
        </h1>
        <p style={{ color:'var(--text2)', fontSize:'.9rem' }}>
          <strong style={{ color:'var(--accent)' }}>{challenge.challenger_name}</strong> wants to see if you can beat their score
        </p>
      </div>

      <div className="card" style={{ textAlign:'center', padding:24, marginBottom:20 }}>
        <div style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:12 }}>
          {challenge.quiz?.title || 'Quiz Challenge'}
        </div>
        <ScoreRing score={challenge.challenger_score} total={challenge.challenger_total} size={120} />
        <div style={{ marginTop:12, fontFamily:'Syne', fontSize:'1.4rem', fontWeight:800, color:pct>=60?'#00d4aa':'#ff6b9d' }}>
          {pct}%
        </div>
        <div style={{ fontSize:'.8rem', color:'var(--text3)', marginTop:4 }}>
          {challenge.challenger_name}'s score: {challenge.challenger_score}/{challenge.challenger_total}
        </div>
      </div>

      {challenge.completed ? (
        <div style={{ textAlign:'center', padding:'20px', background:'rgba(0,212,170,.08)', border:'1px solid rgba(0,212,170,.2)', borderRadius:12, marginBottom:20 }}>
          <div style={{ fontSize:'1.5rem', marginBottom:8 }}>✅</div>
          <div style={{ fontWeight:600, marginBottom:4 }}>Challenge already completed!</div>
          <div style={{ fontSize:'.82rem', color:'var(--text3)' }}>
            {challenge.opponent_name} scored {challenge.opponent_score}/{challenge.challenger_total}
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize:'.78rem', color:'var(--text3)', textAlign:'center', marginBottom:16 }}>
            ⏱ {daysLeft > 0 ? `Expires in ${daysLeft} day${daysLeft!==1?'s':''}` : 'Expires today!'}
          </div>
          <button className="btn btn-primary btn-full" style={{ fontSize:'1rem', padding:'14px' }}
            onClick={() => navigate(`/quiz/${challenge.quiz?.id}/take`, { state: { challengeToken: token } })}>
            ⚔️ Accept Challenge
          </button>
        </>
      )}

      <button className="btn btn-secondary btn-full" style={{ marginTop:10 }}
        onClick={() => navigate('/browse')}>
        Browse Other Quizzes
      </button>
    </div>
  );
}