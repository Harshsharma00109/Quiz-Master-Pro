// PATH: quiz-platform/frontend/src/components/QuizCard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CAT_ICONS, diffBadgeClass, timeAgo } from '../utils/helpers';
import styles from './QuizCard.module.css';

export default function QuizCard({ quiz, actionBar }) {
  const navigate = useNavigate();

  return (
    <div
      className={`${styles.card} card card-hover`}
      onClick={() => navigate(`/quiz/${quiz.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/quiz/${quiz.id}`)}
    >
      {/* Top stripe on hover */}
      <div className={styles.stripe} />

      <div className={styles.header}>
        <span className="badge badge-accent">
          {CAT_ICONS[quiz.category] || '📂'} {quiz.category}
        </span>
        <span className={`badge ${diffBadgeClass(quiz.difficulty)}`}>
          {quiz.difficulty}
        </span>
      </div>

      <h3 className={styles.title}>{quiz.title}</h3>
      <p  className={styles.desc}>
        {quiz.description || 'Test your knowledge with this quiz!'}
      </p>

      <div className={styles.footer}>
        <div className={styles.meta}>
          <span>📝 {quiz.question_count ?? quiz.questions?.length ?? 0} Qs</span>
          <span>▶ {quiz.plays || 0} plays</span>
          <span>🕒 {timeAgo(quiz.created_at)}</span>
        </div>
        <span className={styles.creator}>by {quiz.creator_name || 'Anonymous'}</span>
      </div>

      {/* Optional action bar (edit/delete buttons) */}
      {actionBar && (
        <div className={styles.actionBar} onClick={e => e.stopPropagation()}>
          {actionBar}
        </div>
      )}
    </div>
  );
}
