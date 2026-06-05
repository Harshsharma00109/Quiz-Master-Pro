// PATH: quiz-platform/frontend/src/pages/HistoryPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useAuth }          from '../context/AuthContext';
import { useUserAttempts }  from '../hooks/useQuizzes';
import ProgressChart        from '../components/ProgressChart';   // NEW
import WeakTopicsChart      from '../components/WeakTopicsChart'; // NEW
import { formatTime, getScoreColor, getScoreMessage, timeAgo } from '../utils/helpers';
import ScoreRing from '../components/ScoreRing';
import api from '../utils/api';

export default function HistoryPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { attempts, loading } = useUserAttempts(user?.id);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState('all');
  const [analytics, setAnalytics] = useState(null); // NEW

  // Fetch category analytics for WeakTopicsChart
  useEffect(() => { // NEW
    if (!user?.id) return;
    api.get(`/users/${user.id}/analytics`)
      .then(r => setAnalytics(r.data))
      .catch(() => {});
  }, [user?.id]);

  const filtered = attempts.filter(a => {
    const pct = Math.round((a.score / a.total_questions) * 100);
    if (filter === 'passed') return pct >= 60;
    if (filter === 'failed') return pct < 60;
    return true;
  });

  const avgScore   = attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / attempts.length) : 0;
  const bestScore  = attempts.length ? Math.max(...attempts.map(a => Math.round((a.score / a.total_questions) * 100))) : 0;
  const totalTime  = attempts.reduce((s, a) => s + (a.time_taken || 0), 0);
  const totalRight = attempts.reduce((s, a) => s + a.score, 0);
  const totalQs    = attempts.reduce((s, a) => s + a.total_questions, 0);
  const passRate   = attempts.length ? Math.round(attempts.filter(a => (a.score / a.total_questions) * 100 >= 60).length / attempts.length * 100) : 0;

  return (
    <div className="page-enter section-sm">

      {/* Header — unchanged */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/profile')}>← Profile</button>
        <div>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.5px' }}>
            📊 My Quiz History
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '.88rem', marginTop: 2 }}>
            All your quiz attempts and scores
          </p>
        </div>
      </div>

      {/* Overall stats — unchanged */}
      {attempts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { val: attempts.length,           label: 'Total Attempts',   color: 'var(--accent)'  },
            { val: `${avgScore}%`,             label: 'Average Score',    color: 'var(--accent3)' },
            { val: `${bestScore}%`,            label: 'Best Score',       color: 'var(--accent4)' },
            { val: formatTime(totalTime),      label: 'Total Time',       color: 'var(--accent2)' },
            { val: `${totalRight}/${totalQs}`, label: 'Total Correct',    color: 'var(--accent)'  },
            { val: `${passRate}%`,             label: 'Pass Rate (≥60%)', color: passRate >= 60 ? 'var(--accent3)' : 'var(--accent2)' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.35rem', fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── PROGRESS CHART — NEW ── */}
      {!loading && attempts.length >= 2 && (
        <ProgressChart attempts={attempts} title="📈 Score Progress Over Time" maxPoints={15} />
      )}

      {/* ── WEAK TOPICS CHART — NEW ── */}
      {!loading && analytics?.categories?.length > 0 && (
        <WeakTopicsChart categories={analytics.categories} />
      )}

      {/* Filter tabs — unchanged */}
      {attempts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 50, padding: 4, width: 'fit-content' }}>
          {[
            { val: 'all',    label: `All (${attempts.length})` },
            { val: 'passed', label: '✓ Passed' },
            { val: 'failed', label: '✕ Failed' },
          ].map(f => (
            <button key={f.val} onClick={() => setFilter(f.val)}
              style={{ padding: '7px 18px', borderRadius: 50, border: 'none', fontFamily: 'DM Sans', fontSize: '.84rem', cursor: 'pointer', transition: 'all .2s',
                background: filter === f.val ? 'var(--accent)' : 'transparent',
                color:      filter === f.val ? '#fff' : 'var(--text2)',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Detail modal — unchanged */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: 2 }}>{detail.quiz_title || 'Quiz Result'}</div>
                {detail.category && <span className="badge badge-accent" style={{ fontSize: '.7rem' }}>{detail.category}</span>}
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <ScoreRing score={detail.score} total={detail.total_questions} size={130} />
              <div style={{ marginTop: 10, fontSize: '.9rem', color: 'var(--text2)' }}>
                {getScoreMessage(Math.round((detail.score / detail.total_questions) * 100)).emoji}{' '}
                {getScoreMessage(Math.round((detail.score / detail.total_questions) * 100)).text}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { l: 'Score',      v: `${detail.score}/${detail.total_questions}` },
                { l: 'Percentage', v: `${Math.round((detail.score / detail.total_questions) * 100)}%` },
                { l: 'Time Taken', v: formatTime(detail.time_taken || 0) },
                { l: 'Date',       v: new Date(detail.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              ].map((d, i) => (
                <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '11px 14px' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginBottom: 3 }}>{d.l}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '.9rem' }}>{d.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setDetail(null); navigate(`/quiz/${detail.quiz_id}/take`); }}>↺ Retake Quiz</button>
              <button className="btn btn-secondary" onClick={() => { setDetail(null); navigate(`/quiz/${detail.quiz_id}`); }}>View Quiz</button>
            </div>
          </div>
        </div>
      )}

      {/* List — unchanged */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 10 }} />)}
        </div>
      ) : attempts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div className="empty-text">No quiz history yet</div>
          <div className="empty-sub">Take some quizzes to build your history!</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/browse')}>Browse Quizzes</button>
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-icon">🔍</div>
              <div className="empty-text">No results for this filter</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((a, i) => {
                const pct    = Math.round((a.score / a.total_questions) * 100);
                const col    = getScoreColor(pct);
                const msg    = getScoreMessage(pct);
                const passed = pct >= 60;
                return (
                  <div key={i} onClick={() => setDetail(a)}
                    style={{ background: 'var(--surface)', border: `1px solid ${passed ? 'rgba(0,212,170,.15)' : 'rgba(255,107,157,.12)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all .18s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(108,99,255,.35)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = passed ? 'rgba(0,212,170,.15)' : 'rgba(255,107,157,.12)'}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontWeight: 700, fontSize: '.82rem', color: 'var(--text3)' }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.quiz_title || 'Unknown Quiz'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {a.category && <span className="badge badge-accent" style={{ fontSize: '.65rem' }}>{a.category}</span>}
                        <span style={{ color: 'var(--text3)', fontSize: '.76rem' }}>{timeAgo(a.completed_at)}</span>
                        <span style={{ color: 'var(--text3)', fontSize: '.76rem' }}>⏱ {formatTime(a.time_taken || 0)}</span>
                        <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 50, background: passed ? 'rgba(0,212,170,.12)' : 'rgba(255,107,157,.1)', color: passed ? 'var(--accent3)' : 'var(--accent2)', fontWeight: 600 }}>
                          {passed ? '✓ Passed' : '✕ Failed'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '1.1rem', marginBottom: 2 }}>{msg.emoji}</div>
                      <div style={{ fontFamily: 'Syne', fontSize: '1.15rem', fontWeight: 800, color: col }}>{pct}%</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{a.score}/{a.total_questions}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}