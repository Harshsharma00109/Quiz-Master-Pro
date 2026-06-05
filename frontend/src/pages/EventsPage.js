// PATH: quiz-platform/frontend/src/pages/EventsPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../utils/api';

function EventCard({ event, onPlay, isEliteLocked }) {
  const now      = new Date();
  const start    = new Date(event.start_date);
  const end      = new Date(event.end_date);
  const isLive   = now >= start && now <= end;
  const isUpcoming = start > now;
  const daysLeft = isLive ? Math.ceil((end - now) / 86400000) : null;
  const daysUntil = isUpcoming ? Math.ceil((start - now) / 86400000) : null;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${event.banner_color}18, ${event.banner_color}08)`,
      border: `1.5px solid ${event.banner_color}44`,
      borderRadius: 18, overflow: 'hidden', transition: 'transform .2s, box-shadow .2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 32px ${event.banner_color}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>

      {/* Banner bar */}
      <div style={{ background: `linear-gradient(135deg, ${event.banner_color}cc, ${event.banner_color}88)`, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.8rem' }}>{event.emoji || '🎉'}</span>
          <div>
            <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '1rem', color: '#fff' }}>{event.title}</div>
            <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.7)' }}>
              {new Date(event.start_date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })} →{' '}
              {new Date(event.end_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
          {isLive && <span style={{ background: 'rgba(0,212,170,.2)', border: '1px solid #00d4aa', borderRadius: 50, padding: '3px 10px', fontSize: '.68rem', color: '#00d4aa', fontWeight: 700 }}>🟢 LIVE</span>}
          {isUpcoming && <span style={{ background: 'rgba(255,255,255,.15)', borderRadius: 50, padding: '3px 10px', fontSize: '.68rem', color: '#fff' }}>⏳ Upcoming</span>}
          {event.is_elite_only && <span style={{ background: 'rgba(139,92,246,.3)', borderRadius: 50, padding: '3px 10px', fontSize: '.68rem', color: '#c4b5fd', fontWeight: 700 }}>💎 Elite</span>}
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {event.description && <p style={{ fontSize: '.88rem', color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>{event.description}</p>}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          {isLive && daysLeft !== null && (
            <div style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
              ⏳ <strong style={{ color: 'var(--text)' }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> left
            </div>
          )}
          {isUpcoming && daysUntil !== null && (
            <div style={{ fontSize: '.78rem', color: 'var(--text3)' }}>
              🗓 Starts in <strong style={{ color: 'var(--text)' }}>{daysUntil} day{daysUntil !== 1 ? 's' : ''}</strong>
            </div>
          )}
          {event.bonus_xp > 0 && (
            <div style={{ fontSize: '.78rem', color: '#eab308' }}>⭐ +{event.bonus_xp} Bonus XP</div>
          )}
          {event.bonus_badge && (
            <div style={{ fontSize: '.78rem', color: event.banner_color }}>🏆 Exclusive Badge</div>
          )}
        </div>

        {/* Action button */}
        {isEliteLocked ? (
          <button className="btn btn-full"
            style={{ background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.3)', color: '#a78bfa', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontSize: '.88rem', fontWeight: 600 }}
            onClick={() => onPlay(event, true)}>
            💎 Elite Required — Upgrade to Play
          </button>
        ) : isLive && event.quiz_id ? (
          <button className="btn btn-full"
            style={{ background: `linear-gradient(135deg, ${event.banner_color}, ${event.banner_color}bb)`, border: 'none', color: '#fff', borderRadius: 10, padding: '11px 16px', cursor: 'pointer', fontSize: '.9rem', fontWeight: 700 }}
            onClick={() => onPlay(event, false)}>
            {event.emoji || '🎮'} Play Event Quiz →
          </button>
        ) : isUpcoming ? (
          <button className="btn btn-secondary btn-full" disabled style={{ opacity: .6 }}>
            ⏳ Not started yet
          </button>
        ) : !event.quiz_id ? (
          <button className="btn btn-secondary btn-full" disabled style={{ opacity: .6 }}>
            📋 No quiz attached
          </button>
        ) : (
          <button className="btn btn-secondary btn-full" disabled style={{ opacity: .6 }}>
            ⏰ Event ended
          </button>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  const navigate   = useNavigate();
  const { user, isElite, isAdmin } = useAuth();
  const [events,   setEvents]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all'); // all | live | upcoming

  useEffect(() => {
    api.get('/events/all')
      .then(r => setEvents(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePlay = (event, needsUpgrade) => {
    if (needsUpgrade) { navigate('/subscription'); return; }
    navigate(`/quiz/${event.quiz_id}`, { state: { event_id: event.id, event_title: event.title, bonus_xp: event.bonus_xp } });
  };

  const now = new Date();
  const filtered = events.filter(ev => {
    const start = new Date(ev.start_date), end = new Date(ev.end_date);
    const isLive = now >= start && now <= end;
    const isUpcoming = start > now;
    if (filter === 'live')     return isLive;
    if (filter === 'upcoming') return isUpcoming;
    return true;
  });

  const liveCount     = events.filter(ev => now >= new Date(ev.start_date) && now <= new Date(ev.end_date)).length;
  const upcomingCount = events.filter(ev => new Date(ev.start_date) > now).length;

  return (
    <div className="page-enter section-sm">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Home</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.5px' }}>
            🎉 Event Quizzes
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '.88rem', marginTop: 2 }}>
            Special quizzes for festivals, sports, and more
          </p>
        </div>
        {liveCount > 0 && (
          <div style={{ background: 'rgba(0,212,170,.1)', border: '1px solid rgba(0,212,170,.3)', borderRadius: 8, padding: '6px 12px', fontSize: '.82rem', color: '#00d4aa', fontWeight: 700 }}>
            🟢 {liveCount} Live Now
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'all',      label: `All (${events.length})` },
          { id: 'live',     label: `🟢 Live (${liveCount})` },
          { id: 'upcoming', label: `⏳ Upcoming (${upcomingCount})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{ padding: '7px 16px', borderRadius: 50, border: '1px solid var(--border)', fontSize: '.82rem', cursor: 'pointer', fontWeight: 600,
              background: filter === f.id ? 'var(--accent)' : 'var(--surface)', color: filter === f.id ? '#fff' : 'var(--text2)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 18 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎉</div>
          <div className="empty-title">No {filter !== 'all' ? filter : ''} events</div>
          <div className="empty-text">Check back soon for upcoming event quizzes!</div>
          {user?.is_admin && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/admin')}>
              ➕ Create Event (Admin)
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {filtered.map((ev, i) => {
            const isEliteLocked = ev.is_elite_only && !isElite && !isAdmin;
            return <EventCard key={i} event={ev} onPlay={handlePlay} isEliteLocked={isEliteLocked} />;
          })}
        </div>
      )}
    </div>
  );
}