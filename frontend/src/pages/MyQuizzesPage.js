// PATH: quiz-platform/frontend/src/pages/MyQuizzesPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyQuizzes }  from '../hooks/useQuizzes';
import { useToast }      from '../context/ToastContext';
import QuizCard          from '../components/QuizCard';
import { quizAPI }       from '../utils/api';
import styles            from './MyQuizzesPage.module.css';

export default function MyQuizzesPage() {
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { quizzes, loading, refetch } = useMyQuizzes();
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, quizId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this quiz? This cannot be undone.')) return;
    setDeletingId(quizId);
    try {
      await quizAPI.remove(quizId);
      toast.success('Quiz deleted');
      refetch();
    } catch {
      toast.error('Failed to delete quiz');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (e, quizId) => {
    e.stopPropagation();
    navigate(`/edit/${quizId}`);
  };

  const handleTake = (e, quizId) => {
    e.stopPropagation();
    navigate(`/quiz/${quizId}/take`);
  };

  // Stats summary
  const totalPlays     = quizzes.reduce((s, q) => s + (q.plays || 0), 0);
  const totalQuestions = quizzes.reduce((s, q) => s + (q.question_count || 0), 0);

  return (
    <div className={`page-enter section`}>
      <div className="section-header">
        <div className="section-title">My Quizzes</div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/create')}>
          + New Quiz
        </button>
      </div>

      {/* Summary bar */}
      {!loading && quizzes.length > 0 && (
        <div className={styles.summaryBar}>
          {[
            { val: quizzes.length, label: 'Quizzes Created' },
            { val: totalPlays,     label: 'Total Plays'     },
            { val: totalQuestions, label: 'Total Questions' },
          ].map((s, i) => (
            <div key={i} className={styles.summaryItem}>
              <span className={styles.summaryVal}>{s.val}</span>
              <span className={styles.summaryLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quiz list */}
      {loading ? (
        <div className="quiz-grid">
          {[1,2,3].map(i => <div key={i} className="skeleton card" style={{ height: 220 }} />)}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <div className="empty-text">No quizzes yet</div>
          <div className="empty-sub">Create your first quiz and share it with the world!</div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/create')}>
            Create Your First Quiz
          </button>
        </div>
      ) : (
        <div className="quiz-grid">
          {quizzes.map(quiz => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              actionBar={
                <>
                  <button
                    className="btn btn-success btn-sm"
                    style={{ flex: 1 }}
                    onClick={e => handleTake(e, quiz.id)}
                  >
                    ▶ Take
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={e => handleEdit(e, quiz.id)}
                    title="Edit quiz"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={e => handleDelete(e, quiz.id)}
                    disabled={deletingId === quiz.id}
                    title="Delete quiz"
                  >
                    {deletingId === quiz.id ? '…' : '🗑'}
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
