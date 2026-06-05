// PATH: quiz-platform/frontend/src/components/ProfileExtras.js
// Drop this component into your ProfilePage.js
// Usage: <ProfileExtras user={user} />
// Place it after the main profile card, before the stats grid

import React from 'react';
import { useNavigate } from 'react-router-dom';
import StreakBadge  from './StreakBadge';
import BadgeDisplay from './BadgeDisplay';

export default function ProfileExtras({ user }) {
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div style={{ marginBottom: 28 }}>

      {/* ── STREAK ── */}
      {user.streak_count > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>
            🔥 Current Streak
          </div>
          <StreakBadge streak={user.streak_count} size="md" />
          {user.last_played_date && (
            <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: 6 }}>
              Last played: {new Date(user.last_played_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      )}

      {/* ── QUICK LINKS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { icon: '🔖', label: 'Saved Quizzes',      path: '/bookmarks' },
          { icon: '📊', label: 'Creator Dashboard',  path: '/dashboard' },
          { icon: '📈', label: 'Quiz History',        path: '/history'   },
        ].map((item, i) => (
          <button key={i} onClick={() => navigate(item.path)}
            className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left' }}>
            <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
            <span style={{ fontWeight: 600, fontSize: '.85rem', color: 'var(--text)' }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── BADGES ── */}
      <BadgeDisplay userId={user.id} />
    </div>
  );
}