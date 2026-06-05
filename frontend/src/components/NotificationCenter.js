// PATH: quiz-platform/frontend/src/components/NotificationCenter.js
// Exports: NotificationBell, WelcomeToast, NewDevicePopup
// Usage in Navbar:  replace inline bell with <NotificationBell />
// Usage in App.js:  <WelcomeToast /> and <NewDevicePopup /> inside <AuthProvider>
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../utils/api';

// ── helpers ───────────────────────────────────────────────
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

const TYPE_ICONS = {
  welcome:        '🎉',
  login_alert:    '🔐',
  new_device:     '⚠️',
  streak_warning: '🔥',
  streak_reward:  '🏅',
  subscription:   '💎',
  badge:          '🏆',
  bookmark:       '🔖',
  default:        '🔔',
};

const TYPE_COLORS = {
  welcome:        'rgba(99,102,241,.12)',
  login_alert:    'rgba(59,130,246,.10)',
  new_device:     'rgba(249,115,22,.12)',
  streak_warning: 'rgba(249,115,22,.12)',
  streak_reward:  'rgba(234,179,8,.10)',
  subscription:   'rgba(168,85,247,.12)',
  badge:          'rgba(34,197,94,.10)',
  default:        'transparent',
};

// ══════════════════════════════════════════════════════════
// NOTIFICATION BELL  (drop-in replacement for Navbar)
// ══════════════════════════════════════════════════════════
export function NotificationBell() {
  const { user }        = useAuth();
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(false);
  const panelRef = useRef(null);

  // ── poll unread count every 60s ──────────────────────────
  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnread(data.count || 0);
    } catch {}
  }, [user]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || data || []);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifications([]); setUnread(0); return; }
    fetchUnread();
    const t = setInterval(fetchUnread, 60000);
    return () => clearInterval(t);
  }, [fetchUnread, user]);

  // close on outside click
  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await fetchAll();
      if (unread > 0) {
        try { await api.put('/notifications/read'); setUnread(0); } catch {}
      }
    }
  };

  if (!user) return null;

  return (
    <div style={{ position:'relative' }} ref={panelRef}>
      {/* ── Bell button ── */}
      <button onClick={handleOpen} aria-label="Notifications"
        style={{
          position:'relative', background:'rgba(255,255,255,.06)',
          border:'1px solid rgba(255,255,255,.1)', borderRadius:10,
          width:38, height:38, display:'flex', alignItems:'center',
          justifyContent:'center', cursor:'pointer', fontSize:'1.1rem',
          transition:'background .2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.12)'}
        onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.06)'}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position:'absolute', top:-4, right:-4,
            background:'#ef4444', color:'#fff', borderRadius:'50%',
            width:18, height:18, fontSize:'.65rem', fontWeight:800,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid #0d0d1a',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 10px)', right:0,
          width:360, background:'#1a1a2e',
          border:'1px solid rgba(255,255,255,.1)', borderRadius:16,
          zIndex:1000, overflow:'hidden',
          boxShadow:'0 16px 48px rgba(0,0,0,.6)',
          animation:'_nopen .2s ease',
        }}>
          <style>{`
            @keyframes _nopen { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
            .notif-item:hover { background: rgba(255,255,255,.04) !important; }
          `}</style>

          {/* Header */}
          <div style={{
            padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.08)',
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <div style={{ fontWeight:700, fontSize:'.95rem', color:'#f0f0ff' }}>
              Notifications
              {unread > 0 && (
                <span style={{ marginLeft:8, background:'#6366f1', color:'#fff', borderRadius:20, padding:'1px 7px', fontSize:'.72rem', fontWeight:700 }}>
                  {unread} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  try { await api.put('/notifications/read'); setUnread(0); setNotifications(p => p.map(n => ({...n, is_read:true}))); } catch {}
                }}
                style={{ background:'none', border:'none', color:'#a855f7', cursor:'pointer', fontSize:'.75rem', fontWeight:600 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight:420, overflowY:'auto' }}>
            {loading ? (
              <div style={{ padding:'24px', textAlign:'center', color:'#5a5a7a', fontSize:'.85rem' }}>Loading…</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding:'36px 20px', textAlign:'center' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:10 }}>🔔</div>
                <div style={{ color:'#5a5a7a', fontSize:'.85rem' }}>No notifications yet</div>
                <div style={{ color:'#3a3a5a', fontSize:'.75rem', marginTop:4 }}>We'll notify you of important events</div>
              </div>
            ) : notifications.map((n, i) => (
              <NotifItem key={n.id || i} notif={n} />
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding:'10px 16px', borderTop:'1px solid rgba(255,255,255,.06)', textAlign:'center' }}>
              <span style={{ fontSize:'.75rem', color:'#5a5a7a' }}>{notifications.length} notification{notifications.length!==1?'s':''} total</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Single notification item ───────────────────────────────
function NotifItem({ notif: n }) {
  const icon  = TYPE_ICONS[n.type]  || TYPE_ICONS.default;
  const bg    = TYPE_COLORS[n.type] || 'transparent';

  // Parse metadata if it's a login_alert — show rich details
  let meta = null;
  if ((n.type === 'login_alert' || n.type === 'new_device') && n.metadata) {
    try { meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata; } catch {}
  }

  return (
    <div className="notif-item" style={{
      padding:'12px 16px',
      background: n.is_read ? 'transparent' : bg,
      borderBottom:'1px solid rgba(255,255,255,.05)',
      display:'flex', gap:10, alignItems:'flex-start',
      transition:'background .15s',
    }}>
      {/* Icon */}
      <div style={{
        fontSize:'1.15rem', flexShrink:0, marginTop:2,
        width:32, height:32, borderRadius:8,
        background:'rgba(255,255,255,.05)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize:'.85rem', marginBottom:2, color:'#f0f0ff' }}>
          {n.title}
        </div>
        <div style={{ fontSize:'.78rem', color:'#8888aa', lineHeight:1.5 }}>{n.message}</div>

        {/* ✅ Rich login details panel */}
        {meta && (
          <div style={{
            marginTop:8, padding:'8px 10px',
            background:'rgba(0,0,0,.25)', borderRadius:8,
            border:'1px solid rgba(255,255,255,.06)',
            fontSize:'.73rem', color:'#8888aa',
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px',
          }}>
            {meta.ip       && <span>🌐 <strong style={{ color:'#a0a0c0' }}>IP:</strong> {meta.ip}</span>}
            {meta.location && <span>📍 <strong style={{ color:'#a0a0c0' }}>Location:</strong> {meta.location}</span>}
            {meta.device   && <span>💻 <strong style={{ color:'#a0a0c0' }}>Device:</strong> {meta.device}</span>}
            {meta.browser  && <span>🌍 <strong style={{ color:'#a0a0c0' }}>Browser:</strong> {meta.browser}</span>}
          </div>
        )}

        <div style={{ fontSize:'.7rem', color:'#5a5a7a', marginTop:5 }}>{timeAgo(n.created_at)}</div>
      </div>

      {/* Unread dot */}
      {!n.is_read && (
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#6366f1', flexShrink:0, marginTop:6 }} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// WELCOME TOAST — place <WelcomeToast /> in App.js
// ══════════════════════════════════════════════════════════
export function WelcomeToast() {
  const { user }     = useAuth();
  const [msg,        setMsg]     = useState(null);
  const [visible,    setVisible] = useState(false);
  const shownRef     = useRef(new Set());

  useEffect(() => {
    if (!user) return;
    const key = `welcome_${user.id}_${new Date().toDateString()}`;
    if (shownRef.current.has(key)) return;
    shownRef.current.add(key);

    const justLoggedIn = sessionStorage.getItem('qm_just_logged_in');
    if (justLoggedIn) {
      sessionStorage.removeItem('qm_just_logged_in');
      const isFirstTime = !localStorage.getItem(`welcomed_${user.id}`);
      if (isFirstTime) {
        localStorage.setItem(`welcomed_${user.id}`, '1');
        setMsg({ type:'welcome', title:`🎉 Welcome, ${user.username}!`, text:"Your account is ready. Let's start learning!" });
      } else {
        setMsg({ type:'login', title:`👋 Welcome back, ${user.username}!`, text:'Good to see you again.' });
      }
      setVisible(true);
      setTimeout(() => setVisible(false), 5000);
    }
  }, [user]);

  if (!msg || !visible) return null;

  return (
    <div style={{
      position:'fixed', bottom:32, left:24, maxWidth:320,
      background:'#1a1a2e', border:'1px solid rgba(99,102,241,.3)',
      borderRadius:14, padding:'14px 18px', zIndex:2000,
      display:'flex', gap:12, alignItems:'flex-start',
      boxShadow:'0 8px 32px rgba(0,0,0,.5)',
      animation:'_wtin .4s ease',
    }}>
      <style>{`@keyframes _wtin{from{transform:translateX(-20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{ fontSize:'1.5rem', flexShrink:0 }}>{msg.type==='welcome'?'🎉':'👋'}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:3, color:'#f0f0ff' }}>{msg.title}</div>
        <div style={{ fontSize:'.8rem', color:'#8888aa' }}>{msg.text}</div>
      </div>
      <button onClick={() => setVisible(false)}
        style={{ background:'none', border:'none', color:'#5a5a7a', cursor:'pointer', fontSize:'.9rem', padding:0, flexShrink:0 }}>✕</button>
      <div style={{ position:'absolute', bottom:0, left:0, height:3, borderRadius:'0 0 14px 14px', background:'#6366f1', animation:'_wprog 5s linear forwards' }} />
      <style>{`@keyframes _wprog{from{width:100%}to{width:0%}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// NEW DEVICE POPUP — place <NewDevicePopup /> in App.js
// ══════════════════════════════════════════════════════════
export function NewDevicePopup() {
  const navigate = useNavigate();
  const { newDeviceInfo, clearNewDevice } = useAuth();

  if (!newDeviceInfo) return null;

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.8)',
      backdropFilter:'blur(8px)', zIndex:4000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <div style={{
        background:'#1a1a2e', border:'1px solid rgba(249,115,22,.35)',
        borderRadius:20, padding:'32px 28px', maxWidth:400, width:'100%',
        animation:'_ndpop .4s cubic-bezier(.175,.885,.32,1.275)',
        boxShadow:'0 24px 64px rgba(0,0,0,.6)',
      }}>
        <style>{`@keyframes _ndpop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        <div style={{ fontSize:'3rem', marginBottom:12, textAlign:'center' }}>⚠️</div>
        <div style={{ fontWeight:800, fontSize:'1.2rem', marginBottom:8, textAlign:'center', color:'#f0f0ff' }}>
          New Device Detected
        </div>
        <div style={{ fontSize:'.9rem', color:'#9898b8', marginBottom:20, textAlign:'center', lineHeight:1.6 }}>
          A login was detected from a <strong style={{ color:'#f97316' }}>new device</strong>.<br/>
          If this was you, continue. Otherwise, change your password immediately.
        </div>

        {/* ✅ Rich device info card */}
        <div style={{
          background:'rgba(249,115,22,.07)', border:'1px solid rgba(249,115,22,.2)',
          borderRadius:12, padding:'14px 16px', marginBottom:20,
          fontSize:'.82rem', color:'#c8a87a',
          display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 16px',
        }}>
          {newDeviceInfo.device   && <div>💻 <strong>Device</strong><br/><span style={{ color:'#f0f0ff' }}>{newDeviceInfo.device}</span></div>}
          {newDeviceInfo.browser  && <div>🌍 <strong>Browser</strong><br/><span style={{ color:'#f0f0ff' }}>{newDeviceInfo.browser}</span></div>}
          {newDeviceInfo.ip       && <div>🌐 <strong>IP Address</strong><br/><span style={{ color:'#f0f0ff' }}>{newDeviceInfo.ip}</span></div>}
          {newDeviceInfo.location && <div>📍 <strong>Location</strong><br/><span style={{ color:'#f0f0ff' }}>{newDeviceInfo.location}</span></div>}
          {newDeviceInfo.time     && <div style={{ gridColumn:'1/-1' }}>🕐 <strong>Time</strong><br/><span style={{ color:'#f0f0ff' }}>{newDeviceInfo.time}</span></div>}
        </div>

        <p style={{ fontSize:'.75rem', color:'#5a5a7a', textAlign:'center', marginBottom:16 }}>
          A security email was sent to your registered address.
        </p>

        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={clearNewDevice}
            style={{
              flex:1, padding:'12px', borderRadius:10,
              border:'1px solid rgba(255,255,255,.15)',
              background:'rgba(255,255,255,.05)', color:'#f0f0ff',
              cursor:'pointer', fontWeight:600, fontSize:'.9rem',
              transition:'background .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.1)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.05)'}
          >
            ✓ That was me
          </button>
          <button
            onClick={() => { clearNewDevice(); navigate('/forgot-password'); }}
            style={{
              flex:1, padding:'12px', borderRadius:10, border:'none',
              background:'#ef4444', color:'#fff',
              cursor:'pointer', fontWeight:700, fontSize:'.9rem',
            }}
          >
            🔒 Change Password
          </button>
        </div>
      </div>
    </div>
  );
}