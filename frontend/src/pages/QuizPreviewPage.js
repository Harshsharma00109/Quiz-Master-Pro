// PATH: quiz-platform/frontend/src/pages/QuizPreviewPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuiz }   from '../hooks/useQuizzes';
import { useAuth }   from '../context/AuthContext';
import { useToast }  from '../context/ToastContext';
import { quizAPI }   from '../utils/api';
import api           from '../utils/api';
import LeaderboardTable from '../components/LeaderboardTable';   // NEW
import CommentsSection  from '../components/CommentsSection';    // NEW
import { CAT_ICONS, diffBadgeClass, timeAgo } from '../utils/helpers';
import styles from './QuizPreviewPage.module.css';

export default function QuizPreviewPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { toast } = useToast();
  const { quiz, loading, error } = useQuiz(id);

  // ── Bookmark state ─────────────────────────────────────
  const [bookmarked,   setBookmarked]   = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    api.get(`/bookmarks/check/${id}`)
      .then(r => setBookmarked(r.data?.bookmarked || false))
      .catch(() => {});
  }, [user, id]);

  const handleBookmark = async () => {
    if (!user) { toast.error('Sign in to bookmark quizzes'); return; }
    setBookmarkBusy(true);
    try {
      const { data } = await api.post('/bookmarks/toggle', { quiz_id: id });
      setBookmarked(data.bookmarked);
      toast.success(data.bookmarked ? '🔖 Bookmarked!' : 'Bookmark removed');
    } catch { toast.error('Failed to update bookmark'); }
    finally  { setBookmarkBusy(false); }
  };
  // ───────────────────────────────────────────────────────

  const isOwner = user && quiz && String(quiz.creator_id) === String(user.id);

  const handleDelete = async () => {
    if (!window.confirm('Delete this quiz? This cannot be undone.')) return;
    try {
      await quizAPI.remove(id);
      toast.success('Quiz deleted');
      navigate('/my-quizzes');
    } catch {
      toast.error('Failed to delete quiz');
    }
  };

  if (loading) return (
    <div className="section-sm">
      <div className="skeleton" style={{ height: 48, marginBottom: 12, borderRadius: 12 }} />
      <div className="skeleton card" style={{ height: 280 }} />
    </div>
  );

  if (error) return (
    <div className="section-sm">
      <div className="empty-state">
        <div className="empty-icon">😕</div>
        <div className="empty-text">Quiz not found</div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/browse')}>
          Back to Browse
        </button>
      </div>
    </div>
  );

  return (
    <div className={`page-enter section-sm`}>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 24 }} onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* ── HERO CARD ── */}
      <div className={`card ${styles.hero}`}>
        <div className={styles.heroTop}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-accent">{CAT_ICONS[quiz.category] || '📂'} {quiz.category}</span>
            <span className={`badge ${diffBadgeClass(quiz.difficulty)}`}>{quiz.difficulty}</span>
            {!quiz.is_public && (
              <span className="badge" style={{ background: 'rgba(255,255,255,.08)', color: 'var(--text3)' }}>🔒 Private</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Bookmark button — NEW */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleBookmark}
              disabled={bookmarkBusy}
              title={bookmarked ? 'Remove bookmark' : 'Save quiz'}
              style={{ fontSize: '1rem', padding: '6px 12px' }}
            >
              {bookmarked ? '🔖' : '🔖'}
              <span style={{ marginLeft: 4, fontSize: '.78rem' }}>
                {bookmarked ? 'Saved' : 'Save'}
              </span>
            </button>

            {isOwner && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/edit/${id}`)}>✏️ Edit</button>
                <button className="btn btn-danger btn-sm"   onClick={handleDelete}>🗑 Delete</button>
              </>
            )}
          </div>
        </div>

        <h1 className={styles.title}>{quiz.title}</h1>
        {quiz.description && <p className={styles.desc}>{quiz.description}</p>}

        <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginBottom: 20 }}>
          Created by <strong style={{ color: 'var(--text2)' }}>{quiz.creator_name}</strong>
          &nbsp;·&nbsp;{timeAgo(quiz.created_at)}
        </p>

        {/* Info grid — unchanged */}
        <div className={styles.infoGrid}>
          {[
            { val: quiz.questions?.length ?? 0, label: 'Questions'    },
            { val: quiz.plays || 0,             label: 'Times Played' },
            { val: quiz.difficulty,             label: 'Difficulty'   },
            ...(quiz.time_limit ? [{ val: `${quiz.time_limit}m`, label: 'Time Limit' }] : []),
          ].map((item, i) => (
            <div key={i} className={styles.infoItem}>
              <div className={styles.infoVal}>{item.val}</div>
              <div className={styles.infoLabel}>{item.label}</div>
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: 24, padding: '14px 36px', fontSize: '1rem' }}
          onClick={() => navigate(`/quiz/${id}/take`)}
        >
          ▶ Start Quiz
        </button>
      </div>

      {/* ── LEADERBOARD — replaces old Leaderboard component ── */}
      <LeaderboardTable quizId={id} />

      {/* ── COMMENTS — NEW ── */}
      <CommentsSection quizId={id} />
    </div>
  );
}