// PATH: quiz-platform/frontend/src/pages/AdminProctoringPage.js
//
// SETUP:
//   1. In App.js add:
//      import AdminProctoringPage from './pages/AdminProctoringPage';
//      <Route path="/admin/proctoring" element={<ProtectedRoute><AdminProctoringPage /></ProtectedRoute>} />
//   2. Add link in AdminDashboard sidebar: /admin/proctoring
//   3. Add backend routes (see adminProctoringRoutes.js)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

const VIOLATION_LABELS = {
  tab_switch:         { label: 'Tab Switch',        icon: '🪟', color: '#f97316' },
  copy_attempt:       { label: 'Copy Attempt',       icon: '📋', color: '#f97316' },
  right_click:        { label: 'Right Click',        icon: '🖱',  color: '#f59e0b' },
  face_not_visible:   { label: 'Face Not Visible',   icon: '👁',  color: '#ef4444' },
  camera_covered:     { label: 'Camera Covered',     icon: '📷', color: '#ef4444' },
  excessive_movement: { label: 'Excessive Movement', icon: '🏃', color: '#8b5cf6' },
  window_blur:        { label: 'Window Left',        icon: '💨', color: '#f97316' },
  fullscreen_exit:    { label: 'Fullscreen Exit',    icon: '⛶',  color: '#f59e0b' },
  unknown:            { label: 'Unknown',             icon: '❓', color: '#6b7280' },
};

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN');
}

function fmtTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}

function duration(start, end) {
  if (!start) return '—';
  const s = Math.floor((new Date(end || Date.now()) - new Date(start)) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function riskLevel(s) {
  if (s.auto_submitted)          return { label: 'HIGH RISK',   color: '#ef4444', bg: 'rgba(239,68,68,.12)'  };
  if ((s.warning_count || 0) >= 2) return { label: 'MEDIUM RISK', color: '#f97316', bg: 'rgba(249,115,22,.12)' };
  if ((s.warning_count || 0) === 1) return { label: 'LOW RISK',    color: '#f59e0b', bg: 'rgba(245,158,11,.1)'  };
  return                                  { label: 'CLEAN',        color: '#22c55e', bg: 'rgba(34,197,94,.1)'   };
}

// ── Session list row ─────────────────────────────────────────
function SessionRow({ s, onClick, selected }) {
  const risk = riskLevel(s);
  return (
    <div
      onClick={() => onClick(s)}
      style={{
        display:    'grid',
        gridTemplateColumns: '1fr auto auto auto',
        alignItems: 'center',
        gap:        12,
        padding:    '11px 14px',
        borderRadius: 10,
        border:     `1px solid ${selected ? 'var(--accent,#6c63ff)' : 'rgba(255,255,255,.07)'}`,
        background: selected ? 'rgba(108,99,255,.08)' : 'rgba(255,255,255,.02)',
        cursor:     'pointer',
        transition: 'all .15s',
        marginBottom: 6,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: '.87rem', color: 'var(--text,#f0f0ff)', marginBottom: 2 }}>
          {s.user_name || s.user_email || 'Guest'}
          <span style={{ fontWeight: 400, color: 'rgba(200,200,220,.45)', marginLeft: 6, fontSize: '.78rem' }}>
            Quiz #{s.quiz_id}
          </span>
        </div>
        <div style={{ fontSize: '.71rem', color: 'rgba(200,200,220,.45)' }}>
          {fmtTime(s.started_at)} · {duration(s.started_at, s.ended_at)}
        </div>
      </div>

      {/* Violation count */}
      <span style={{ fontSize: '.72rem', color: 'rgba(200,200,220,.5)', minWidth: 40, textAlign: 'center' }}>
        {s.violation_count || 0}
        <span style={{ display: 'block', fontSize: '.6rem', color: 'rgba(200,200,220,.3)' }}>events</span>
      </span>

      {/* Warning pip track */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2].map(n => (
          <div key={n} style={{
            width: 20, height: 4, borderRadius: 99,
            background: (s.warning_count || 0) >= n ? '#f97316' : 'rgba(255,255,255,.08)',
          }} />
        ))}
      </div>

      {/* Risk badge */}
      <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
        background: risk.bg, color: risk.color, whiteSpace: 'nowrap' }}>
        {risk.label}
      </span>
    </div>
  );
}

// ── Snapshot lightbox ────────────────────────────────────────
function Lightbox({ snap, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!snap) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'zoom-out', backdropFilter: 'blur(8px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '85vh' }}>
        <img src={snap.src} alt="Evidence"
          style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12,
            border: '2px solid rgba(239,68,68,.5)', display: 'block', boxShadow: '0 0 60px rgba(239,68,68,.2)' }} />
        <div style={{ marginTop: 10, textAlign: 'center', fontSize: '.78rem', color: 'rgba(255,255,255,.45)' }}>
          <strong style={{ color: '#ef4444' }}>{snap.label}</strong>
          {' · '}{fmtTime(snap.ts)}
          {' · '}Press Esc or click outside to close
        </div>
      </div>
    </div>
  );
}

// ── Evidence detail panel ────────────────────────────────────
function EvidencePanel({ sessionId, token }) {
  const [session,    setSession]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [activeSnap, setActiveSnap] = useState(null);

  // Fetch full session detail (with violations) when sessionId changes
  useEffect(() => {
    if (!sessionId) { setSession(null); return; }
    setLoading(true);
    setSession(null);

    fetch(`${BASE}/admin/proctoring/${sessionId}`, {
      headers: { Authorization: `Bearer ${token || localStorage.getItem('qm_token')}` },
    })
      .then(r => r.json())
      .then(d => { setSession(d.session || d); })
      .catch(e => console.error('fetch session detail:', e))
      .finally(() => setLoading(false));
  }, [sessionId, token]);

  if (!sessionId) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'rgba(200,200,220,.3)', gap: 12, padding: 40, textAlign: 'center' }}>
      <span style={{ fontSize: '2.8rem' }}>🔍</span>
      <span style={{ fontSize: '.88rem', lineHeight: 1.6 }}>
        Select a session from the list<br />to view proctoring evidence
      </span>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(200,200,220,.4)' }}>
      <div>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: '.82rem' }}>Loading evidence…</div>
      </div>
    </div>
  );

  if (!session) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(200,200,220,.3)' }}>
      Failed to load session.
    </div>
  );

  const violations = session.violations || [];
  const risk       = riskLevel(session);
  const snapshots  = violations.filter(v => v.snapshot_data);

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      <Lightbox snap={activeSnap} onClose={() => setActiveSnap(null)} />

      {/* ── Summary header ─────────────────────────── */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'sticky', top: 0, background: 'var(--bg,#0d0d1a)', zIndex: 10 }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '.95rem', color: 'var(--text,#f0f0ff)', marginBottom: 6 }}>
          {session.user_name || session.user_email || 'Guest'}
          <span style={{ fontWeight: 400, color: 'rgba(200,200,220,.4)', marginLeft: 8, fontSize: '.8rem' }}>
            Session #{session.id} · Quiz #{session.quiz_id}
          </span>
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '.72rem', color: 'rgba(200,200,220,.5)', marginBottom: 10 }}>
          <div>🕐 Started: {fmtTime(session.started_at)}</div>
          <div>🏁 Ended: {fmtTime(session.ended_at)}</div>
          <div>⏱ Duration: {duration(session.started_at, session.ended_at)}</div>
          <div>📍 IP: {session.ip_address || '—'}</div>
        </div>

        {/* Badge row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 99,
            background: risk.bg, color: risk.color, border: `1px solid ${risk.color}44` }}>
            {risk.label}
          </span>
          <span style={{ fontSize: '.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99,
            background: session.auto_submitted ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.08)',
            color: session.auto_submitted ? '#ef4444' : '#22c55e',
            border: `1px solid ${session.auto_submitted ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.2)'}` }}>
            {session.auto_submitted ? '🚫 Auto-Submitted' : '✓ Normal Submit'}
          </span>
          <span style={{ fontSize: '.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99,
            background: 'rgba(249,115,22,.1)', color: '#f97316', border: '1px solid rgba(249,115,22,.25)' }}>
            ⚠ {session.warning_count || 0} warnings
          </span>
          <span style={{ fontSize: '.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99,
            background: 'rgba(108,99,255,.1)', color: '#8b5cf6', border: '1px solid rgba(108,99,255,.2)' }}>
            {violations.length} events
          </span>
          {snapshots.length > 0 && (
            <span style={{ fontSize: '.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 99,
              background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' }}>
              📷 {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Why it was auto-submitted ──────────────── */}
      {session.auto_submitted && (
        <div style={{ margin: '14px 20px 0', padding: '12px 14px',
          background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 10 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>
            🚫 Why was this quiz auto-submitted?
          </div>
          <div style={{ fontSize: '.78rem', color: 'rgba(200,200,220,.7)', lineHeight: 1.65 }}>
            The quiz was automatically submitted because the user accumulated{' '}
            <strong style={{ color: '#f97316' }}>{session.warning_count} warnings</strong> from proctoring violations.
            After the 2nd warning they were notified; upon a 3rd violation the system submitted the quiz on their behalf.
          </div>
          {violations.length > 0 && (
            <div style={{ marginTop: 8, fontSize: '.73rem', color: 'rgba(200,200,220,.5)' }}>
              <strong style={{ color: 'rgba(200,200,220,.7)' }}>Violations recorded:</strong>{' '}
              {[...new Set(violations.map(v => (VIOLATION_LABELS[v.type] || VIOLATION_LABELS.unknown).label))].join(', ')}
            </div>
          )}
        </div>
      )}

      {/* ── Snapshot gallery ───────────────────────── */}
      {snapshots.length > 0 && (
        <div style={{ margin: '14px 20px 0' }}>
          <div style={{ fontSize: '.7rem', fontWeight: 500, color: 'rgba(200,200,220,.4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            📷 Evidence Snapshots ({snapshots.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: 8 }}>
            {snapshots.map((v, i) => {
              const cfg = VIOLATION_LABELS[v.type] || VIOLATION_LABELS.unknown;
              return (
                <div key={i} style={{ position: 'relative', cursor: 'zoom-in' }}
                  onClick={() => setActiveSnap({ src: v.snapshot_data, label: cfg.label, ts: v.timestamp })}>
                  <img src={v.snapshot_data} alt={`Snapshot ${i + 1}`}
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8,
                      border: '1px solid rgba(239,68,68,.3)', display: 'block' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px',
                    background: 'linear-gradient(transparent,rgba(0,0,0,.7))', borderRadius: '0 0 8px 8px',
                    fontSize: '.6rem', color: 'rgba(255,255,255,.7)' }}>
                    {cfg.icon} {cfg.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Violation timeline ─────────────────────── */}
      <div style={{ margin: '14px 20px 20px' }}>
        <div style={{ fontSize: '.7rem', fontWeight: 500, color: 'rgba(200,200,220,.4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Violation Timeline
        </div>

        {violations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(200,200,220,.3)', fontSize: '.85rem' }}>
            ✅ No violations recorded for this session
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {violations.map((v, idx) => {
              const cfg = VIOLATION_LABELS[v.type] || VIOLATION_LABELS.unknown;
              return (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,.025)',
                  border: `1px solid ${v.snapshot_data ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.06)'}`,
                  borderLeft: `3px solid ${cfg.color}`,
                  borderRadius: 10, padding: '12px 14px', position: 'relative',
                }}>
                  {/* Warning number */}
                  {v.warning_number && (
                    <div style={{ position: 'absolute', top: 10, right: 10, fontSize: '.62rem', fontWeight: 700,
                      padding: '2px 6px', borderRadius: 99,
                      background: v.warning_number === 1 ? 'rgba(249,115,22,.15)' : 'rgba(239,68,68,.15)',
                      color: v.warning_number === 1 ? '#f97316' : '#ef4444',
                      border: `1px solid ${v.warning_number === 1 ? 'rgba(249,115,22,.3)' : 'rgba(239,68,68,.3)'}` }}>
                      Warning #{v.warning_number}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                    <span style={{ fontSize: '1rem' }}>{cfg.icon}</span>
                    <span style={{ fontSize: '.83rem', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  </div>

                  <div style={{ fontSize: '.71rem', color: 'rgba(200,200,220,.45)', marginBottom: v.snapshot_data ? 10 : 0 }}>
                    🕐 {fmtTime(v.timestamp)}
                    {v.meta?.motion_score  && <span style={{ marginLeft: 8 }}>Motion: {v.meta.motion_score}%</span>}
                    {v.meta?.consecutive   && <span style={{ marginLeft: 8 }}>{v.meta.consecutive} consecutive misses</span>}
                    {v.meta?.tab_url       && <span style={{ marginLeft: 8 }}>→ {v.meta.tab_url}</span>}
                  </div>

                  {v.snapshot_data && (
                    <div>
                      <div style={{ fontSize: '.63rem', color: 'rgba(239,68,68,.65)', marginBottom: 6, fontWeight: 500 }}>
                        📷 Camera snapshot captured at time of violation
                      </div>
                      <img src={v.snapshot_data} alt={`Evidence ${idx + 1}`}
                        onClick={() => setActiveSnap({ src: v.snapshot_data, label: cfg.label, ts: v.timestamp })}
                        style={{ width: '100%', maxWidth: 200, borderRadius: 8,
                          border: '1px solid rgba(239,68,68,.35)', cursor: 'zoom-in', display: 'block',
                          transition: 'transform .15s', }} />
                      <div style={{ fontSize: '.6rem', color: 'rgba(200,200,220,.3)', marginTop: 4 }}>
                        Click to enlarge
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stats card ───────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '14px 18px', minWidth: 100 }}>
      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '1.5rem', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '.7rem', color: 'rgba(200,200,220,.45)', marginTop: 4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: '.65rem', color: 'rgba(200,200,220,.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function AdminProctoringPage() {
  const navigate        = useNavigate();
  const { user, token } = useAuth();

  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState(0);
  const [selectedId,  setSelectedId]  = useState(null);
  const [page,        setPage]        = useState(1);
  const [filter,      setFilter]      = useState('all');
  const [searchQ,     setSearchQ]     = useState('');
  const searchTimer = useRef(null);
  const LIMIT = 25;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: (page - 1) * LIMIT });
      if (filter === 'auto')     params.set('auto_submitted', '1');
      if (filter === 'warnings') params.set('has_warnings', '1');
      if (searchQ)               params.set('search', searchQ);

      const res = await fetch(`${BASE}/admin/proctoring?${params}`, {
        headers: { Authorization: `Bearer ${token || localStorage.getItem('qm_token')}` },
      });
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filter, searchQ, token]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Debounce search
  const handleSearch = (val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearchQ(val); setPage(1); }, 400);
  };

  if (!user?.is_admin) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'rgba(200,200,220,.4)' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
      <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Admin Access Required</div>
      <button className="btn btn-secondary" onClick={() => navigate('/')}>Go Home</button>
    </div>
  );

  const totalPages    = Math.ceil(total / LIMIT);
  const autoCount     = sessions.filter(s => s.auto_submitted).length;
  const warningCount  = sessions.filter(s => (s.warning_count || 0) > 0).length;
  const cleanCount    = sessions.filter(s => (s.warning_count || 0) === 0).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg,#0d0d1a)', color: 'var(--text,#f0f0ff)', fontFamily: 'DM Sans,sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ──────────────────────────────────── */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, flexShrink: 0 }}>
        <div>
          <button onClick={() => navigate('/admin')}
            style={{ background: 'none', border: 'none', color: 'rgba(200,200,220,.45)', cursor: 'pointer', fontSize: '.8rem', marginBottom: 3, padding: 0 }}>
            ← Back to Admin
          </button>
          <h1 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔍 Proctoring Evidence Center
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder="Search by name or email…"
            onChange={e => handleSearch(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: 'var(--text,#f0f0ff)', fontSize: '.82rem', outline: 'none', width: 190 }}
          />
          {['all', 'auto', 'warnings', 'clean'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              style={{ padding: '6px 13px', borderRadius: 8, border: `1px solid ${filter === f ? 'var(--accent,#6c63ff)' : 'rgba(255,255,255,.09)'}`, background: filter === f ? 'rgba(108,99,255,.15)' : 'transparent', color: filter === f ? 'var(--accent,#6c63ff)' : 'rgba(200,200,220,.55)', fontSize: '.76rem', cursor: 'pointer', fontWeight: filter === f ? 600 : 400 }}>
              {f === 'all' ? 'All' : f === 'auto' ? '🚫 Auto' : f === 'warnings' ? '⚠ Warnings' : '✅ Clean'}
            </button>
          ))}
          <button onClick={fetchSessions}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.09)', background: 'transparent', color: 'rgba(200,200,220,.55)', fontSize: '.8rem', cursor: 'pointer' }}>
            ↺
          </button>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────── */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: 10, borderBottom: '1px solid rgba(255,255,255,.04)', flexWrap: 'wrap', flexShrink: 0 }}>
        <StatCard label="Total Sessions" value={total}        color="var(--accent,#6c63ff)" />
        <StatCard label="Auto-Submitted" value={autoCount}    color="#ef4444" sub="quiz force-ended" />
        <StatCard label="Has Warnings"   value={warningCount} color="#f97316" sub="1–2 violations" />
        <StatCard label="Clean"          value={cleanCount}   color="#22c55e" sub="no issues" />
      </div>

      {/* ── Split layout ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', flex: 1, overflow: 'hidden' }}>

        {/* Session list */}
        <div style={{ overflowY: 'auto', padding: '14px 18px', borderRight: '1px solid rgba(255,255,255,.06)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(200,200,220,.4)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              Loading sessions…
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(200,200,220,.3)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
              No sessions found
            </div>
          ) : (
            <>
              <div style={{ fontSize: '.7rem', color: 'rgba(200,200,220,.35)', marginBottom: 10, fontWeight: 500 }}>
                Showing {sessions.length} of {total} sessions
              </div>
              {sessions.map(s => (
                <SessionRow key={s.id} s={s}
                  onClick={(s) => setSelectedId(s.id)}
                  selected={selectedId === s.id} />
              ))}

              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.09)', background: 'transparent', color: 'rgba(200,200,220,.55)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? .4 : 1, fontSize: '.8rem' }}>
                    ← Prev
                  </button>
                  <span style={{ padding: '6px 14px', fontSize: '.8rem', color: 'rgba(200,200,220,.4)' }}>
                    {page} / {totalPages}
                  </span>
                  <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.09)', background: 'transparent', color: 'rgba(200,200,220,.55)', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? .4 : 1, fontSize: '.8rem' }}>
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Evidence panel — fetches its own detail */}
        <EvidencePanel sessionId={selectedId} token={token} />
      </div>
    </div>
  );
}