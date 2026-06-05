// PATH: quiz-platform/frontend/src/components/Leaderboard.js
import React from 'react';
import { formatTime } from '../utils/helpers';
import styles from './Leaderboard.module.css';

const MEDALS = ['🥇','🥈','🥉'];

export default function Leaderboard({ board, loading }) {
  if (loading) return (
    <div style={{ padding: 24 }}>
      {[1,2,3].map(i => (
        <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8, borderRadius: 8 }} />
      ))}
    </div>
  );

  if (!board.length) return (
    <div className="empty-state" style={{ padding: '32px 20px' }}>
      <div className="empty-icon">🏆</div>
      <div className="empty-text">No attempts yet</div>
      <div className="empty-sub">Be the first to complete this quiz!</div>
    </div>
  );

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <span>#</span>
        <span>Player</span>
        <span>Score</span>
        <span>Time</span>
      </div>
      {board.map((row, i) => {
        const pct = Math.round((row.score / row.total_questions) * 100);
        return (
          <div key={i} className={`${styles.row} ${i < 3 ? styles.top : ''}`}>
            <span className={styles.rank}>
              {i < 3 ? MEDALS[i] : <span style={{ color: 'var(--text3)' }}>{i + 1}</span>}
            </span>
            <span className={styles.name}>{row.user_name}</span>
            <span className={styles.score} style={{
              color: pct >= 80 ? 'var(--accent3)' : pct >= 60 ? 'var(--accent)' : 'var(--text2)',
            }}>
              {row.score}/{row.total_questions}
            </span>
            <span className={styles.time}>{formatTime(row.time_taken || 0)}</span>
          </div>
        );
      })}
    </div>
  );
}
