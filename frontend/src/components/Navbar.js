// PATH: quiz-platform/frontend/src/components/Navbar.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth }        from '../context/AuthContext';
import { useLanguage }    from '../context/LanguageContext';
import AuthModal          from './AuthModal';
import LanguageSwitcher   from './LanguageSwitcher';
import { NotificationBell } from './NotificationCenter';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

const TXN_ICON = {
  spin:'🎡', quiz:'🎮', purchase:'💳', bonus:'🎁', refund:'↩️', daily:'📅', event:'🎉',
};

function getHintsForPath(path, t) {
  const PAGE_HINTS = {
    '/':          [
      { icon:'🎯', title: t('nav_streak'),      body: t('dashboard_streak_status') },
      { icon:'🤖', title: t('nav_ai_quiz'),     body: t('ai_generate_questions') },
      { icon:'🏆', title: t('nav_leaderboard'), body: t('lb_rank') },
      { icon:'🎡', title: t('nav_spin_wheel'),  body: t('dashboard_daily_spin') },
    ],
    '/browse':    [
      { icon:'🔍', title: t('search'),          body: t('filter') },
      { icon:'🔖', title: t('nav_saved'),        body: t('nav_saved_quizzes') },
      { icon:'⭐', title: t('quiz_difficulty'), body: t('quiz_easy') + ' → ' + t('quiz_hard') },
    ],
    '/ai':        [
      { icon:'💡', title: t('ai_topic_search'), body: t('ai_tutor_placeholder') },
      { icon:'📚', title: t('quiz_generate'),   body: t('ai_generate_questions') },
      { icon:'🔄', title: t('retry'),           body: t('ai_loading') },
    ],
    '/spin':      [
      { icon:'⏰', title: t('spin_next'),        body: t('spin_come_back') },
      { icon:'🔥', title: t('nav_streak'),       body: t('dashboard_streak_status') },
      { icon:'⭐', title: t('nav_subscription'), body: t('spin_prizes') },
    ],
    '/dashboard': [
      { icon:'📈', title: t('dashboard_rank_points'), body: t('dashboard_accuracy') },
      { icon:'🏅', title: t('dashboard_badges'),      body: t('dashboard_no_badges') },
      { icon:'🪙', title: t('dashboard_coins'),       body: t('dashboard_earn_more') },
    ],
    DEFAULT: [
      { icon:'💡', title: t('dashboard_overview'), body: t('dashboard_earn_more') },
      { icon:'🎡', title: t('nav_spin_wheel'),      body: t('spin_subtitle') },
    ],
  };
  if (PAGE_HINTS[path]) return PAGE_HINTS[path];
  const key = Object.keys(PAGE_HINTS).find(k => k !== 'DEFAULT' && path.startsWith(k) && k !== '/');
  return PAGE_HINTS[key] || PAGE_HINTS.DEFAULT;
}

function HintBubble({ location }) {
  const { t } = useLanguage();
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [idx,       setIdx]       = useState(0);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef(null);

  const hints = getHintsForPath(location.pathname, t);
  const hint  = hints[idx % hints.length];

  useEffect(() => {
    setDismissed(false); setIdx(0); setVisible(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timerRef.current);
  }, [location.pathname]);

  useEffect(() => {
    if (!visible || dismissed) return;
    const timer = setInterval(() => cycleHint(1), 8000);
    return () => clearInterval(timer);
  }, [visible, dismissed, idx]); // eslint-disable-line

  const cycleHint = (dir) => {
    setAnimating(true);
    setTimeout(() => {
      setIdx(i => (i + dir + hints.length) % hints.length);
      setAnimating(false);
    }, 200);
  };

  const dismiss = () => { setVisible(false); setDismissed(true); };

  if (!visible || dismissed) {
    if (dismissed) return (
      <button onClick={() => { setDismissed(false); setVisible(true); }} title={t('loading')}
        style={{ position:'fixed', bottom:88, right:20, zIndex:250, width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', cursor:'pointer', fontSize:'1rem', boxShadow:'0 4px 16px rgba(99,102,241,.4)', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}
        onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
        💡
      </button>
    );
    return null;
  }

  return (
    <div style={{ position:'fixed', bottom:88, right:20, zIndex:250, width:280, background:'var(--surface)', border:'1px solid rgba(99,102,241,.35)', borderRadius:18, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.35)', animation:'hintSlideIn .35s cubic-bezier(.175,.885,.32,1.275)' }}>
      <style>{`
        @keyframes hintSlideIn { from{opacity:0;transform:translateY(16px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        .hint-content{transition:opacity .2s,transform .2s}
        .hint-content.animating{opacity:0;transform:translateY(4px)}
      `}</style>
      <div style={{ background:'linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.1))', borderBottom:'1px solid rgba(99,102,241,.15)', padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:'.65rem', fontWeight:800, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1.5 }}>💡 Tip</span>
          <div style={{ display:'flex', gap:3, marginLeft:4 }}>
            {hints.map((_, i) => (
              <div key={i} onClick={() => cycleHint(i - idx)} style={{ width: i === idx%hints.length ? 12 : 5, height:5, borderRadius:99, background: i === idx%hints.length ? 'var(--accent)' : 'rgba(99,102,241,.25)', cursor:'pointer', transition:'all .25s' }}/>
            ))}
          </div>
        </div>
        <button onClick={dismiss} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:'.75rem', padding:'2px 4px', borderRadius:4, lineHeight:1 }}>✕</button>
      </div>
      <div className={`hint-content${animating?' animating':''}`} style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.1))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>{hint.icon}</div>
          <div>
            <div style={{ fontWeight:800, fontSize:'.85rem', color:'var(--text)', marginBottom:3 }}>{hint.title}</div>
            <div style={{ fontSize:'.78rem', color:'var(--text2)', lineHeight:1.5 }}>{hint.body}</div>
          </div>
        </div>
      </div>
      <div style={{ borderTop:'1px solid var(--border)', padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => cycleHint(-1)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:8, padding:'4px 10px', cursor:'pointer', color:'var(--text2)', fontSize:'.72rem', fontWeight:600 }}>← {t('back')}</button>
        <span style={{ fontSize:'.68rem', color:'var(--text3)' }}>{(idx % hints.length) + 1} / {hints.length}</span>
        <button onClick={() => cycleHint(1)} style={{ background:'linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.1))', border:'1px solid rgba(99,102,241,.3)', borderRadius:8, padding:'4px 10px', cursor:'pointer', color:'var(--accent)', fontSize:'.72rem', fontWeight:700 }}>{t('next')} →</button>
      </div>
    </div>
  );
}

function Avatar({ user, size = 32 }) {
  const s = { width:size, height:size, borderRadius:'50%', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 };
  if (user?.avatar_url)    return <div style={{ ...s, background:'var(--surface2)' }}><img src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>;
  if (user?.avatar_preset) return <div style={{ ...s, background:'var(--surface2)', fontSize:size*0.5 }}>{user.avatar_preset}</div>;
  return <div style={{ ...s, background:'var(--accent)', fontWeight:700, color:'#fff', fontSize:size*0.4 }}>{user?.username?.[0]?.toUpperCase()||'?'}</div>;
}

export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, token, logout, isAdmin } = useAuth();
  const { t }     = useLanguage();

  const [authMode,     setAuthMode]     = useState(null);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [coins,        setCoins]        = useState(0);
  const [coinsOpen,    setCoinsOpen]    = useState(false);
  const [coinsHistory, setCoinsHistory] = useState(null);
  const [coinsLoading, setCoinsLoading] = useState(false);
  const coinsBtnRef  = useRef(null);
  const coinsDropRef = useRef(null);

  const fetchCoinHistory = useCallback(async () => {
    if (!token || coinsHistory !== null) return;
    setCoinsLoading(true);
    try {
      const r = await fetch(`${BASE}/coins/history`, { headers: { Authorization: `Bearer ${token}` } });
      setCoinsHistory(r.ok ? (await r.json() || []).slice(0, 8) : []);
    } catch { setCoinsHistory([]); }
    setCoinsLoading(false);
  }, [token, coinsHistory]);

  const handleCoinsClick = () => {
    const next = !coinsOpen;
    setCoinsOpen(next);
    if (next) fetchCoinHistory();
  };

  useEffect(() => {
    if (!coinsOpen) return;
    const handler = (e) => {
      if (coinsBtnRef.current && !coinsBtnRef.current.contains(e.target) &&
          coinsDropRef.current && !coinsDropRef.current.contains(e.target)) {
        setCoinsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [coinsOpen]);

  useEffect(() => { if (user?.coins != null) setCoins(user.coins); }, [user?.coins]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.coins != null) { setCoins(e.detail.coins); setCoinsHistory(null); }
    };
    window.addEventListener('coinsUpdated', handler);
    return () => window.removeEventListener('coinsUpdated', handler);
  }, []);

  useEffect(() => { setMenuOpen(false); setCoinsOpen(false); }, [location.pathname]);

  const isActive = path => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavLink = ({ to, children, dot }) => (
    <Link to={to} onClick={() => setMenuOpen(false)}
      style={{ textDecoration:'none', color:isActive(to)?'var(--accent)':'var(--text2)', fontWeight:isActive(to)?700:500, fontSize:'.88rem', display:'flex', alignItems:'center', gap:4, position:'relative', padding:'4px 0' }}>
      {children}
      {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', position:'absolute', top:0, right:-8 }} />}
    </Link>
  );

  // Dropdown menu items — all labels from t()
  const menuItems = [
    { label:`📊 ${t('nav_dashboard')}`,          path:'/dashboard' },
    { label:`👤 ${t('nav_my_profile')}`,          path:'/profile' },
    { label:`🎡 ${t('nav_spin_wheel')}`,          path:'/spin' },
    { label:`📅 ${t('nav_streak')}`,              path:'/streak' },
    { label:`📋 ${t('nav_quiz_history')}`,        path:'/history' },
    { label:`🔖 ${t('nav_saved_quizzes')}`,       path:'/bookmarks' },
    { label:`✏️ ${t('nav_my_quizzes')}`,           path:'/my-quizzes' },
    { label:`📈 ${t('nav_creator_dashboard')}`,   path:'/creator' },
    { label:`🏆 ${t('nav_leaderboard')}`,         path:'/leaderboard' },
    { label:`💎 ${t('nav_subscription')}`,        path:'/subscription' },
    ...(isAdmin ? [{ label:`⚙️ ${t('nav_admin_panel')}`, path:'/admin' }] : []),
  ];

  return (
    <>
      <style>{`
        .nav-links { display:flex; }
        @media(max-width:768px){ .nav-links{ display:none; } }
        .nav-dropdown-btn:hover { background:var(--surface2) !important; }
        @keyframes coinDropIn { from{opacity:0;transform:translateY(-6px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .coin-drop { animation: coinDropIn .18s cubic-bezier(.25,.8,.25,1); }
        .coin-txn-row:hover { background: rgba(234,179,8,.06) !important; }
      `}</style>

      <nav style={{ position:'fixed', top:0, left:0, right:0, height:64, background:'var(--surface)', borderBottom:'1px solid var(--border)', zIndex:300, display:'flex', alignItems:'center', padding:'0 20px', gap:16 }}>

        {/* Logo */}
        <Link to="/" style={{ textDecoration:'none', fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'1.1rem', color:'var(--text)', flexShrink:0 }}>
          ✦ <span style={{ color:'var(--accent)' }}>QuizMaster</span> Pro
        </Link>

        {/* Desktop nav */}
        <div className="nav-links" style={{ gap:20, alignItems:'center', flex:1, marginLeft:8 }}>
          <NavLink to="/browse">{t('nav_browse')}</NavLink>
          <NavLink to="/ai">🤖 {t('nav_ai_quiz')}</NavLink>
          <Link to="/events" onClick={() => setMenuOpen(false)}
            style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(108,99,255,.3)', background:isActive('/events')?'rgba(108,99,255,.2)':'rgba(108,99,255,.08)', color:'var(--accent)', fontSize:'.82rem', fontWeight:700, transition:'all .2s' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(108,99,255,.2)'}
            onMouseLeave={e=>e.currentTarget.style.background=isActive('/events')?'rgba(108,99,255,.2)':'rgba(108,99,255,.08)'}>
            🎉 {t('nav_events')}
          </Link>
          <NavLink to="/leaderboard">🏆 {t('nav_leaderboard')}</NavLink>
          {user && <NavLink to="/history">{t('nav_history')}</NavLink>}
          {user && <NavLink to="/bookmarks">{t('nav_saved')}</NavLink>}
          {isAdmin && (
            <Link to="/admin" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:6, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', color:'#ef4444', fontSize:'.78rem', fontWeight:700 }}>
              ⚙️ {t('nav_admin')}
            </Link>
          )}
        </div>

        {/* Right side */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto', flexShrink:0 }}>
          {user ? (
            <>
              <NotificationBell />
              <LanguageSwitcher />

              {/* Coins badge + dropdown */}
              <div style={{ position:'relative' }}>
                <button ref={coinsBtnRef} onClick={handleCoinsClick}
                  title={t('nav_current_balance')}
                  style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, background: coinsOpen ? 'rgba(234,179,8,.2)' : 'rgba(234,179,8,.1)', border:`1px solid ${coinsOpen ? 'rgba(234,179,8,.6)' : 'rgba(234,179,8,.25)'}`, fontSize:'.78rem', fontWeight:800, color:'#eab308', cursor:'pointer', transition:'all .15s' }}>
                  🪙 <span>{coins.toLocaleString()}</span>
                  <span style={{ fontSize:'.6rem', marginLeft:1, opacity:.7 }}>{coinsOpen?'▲':'▼'}</span>
                </button>

                {coinsOpen && (
                  <div ref={coinsDropRef} className="coin-drop"
                    style={{ position:'absolute', top:'calc(100% + 10px)', right:0, width:300, background:'var(--surface)', border:'1px solid rgba(234,179,8,.25)', borderRadius:14, zIndex:400, boxShadow:'0 12px 40px rgba(0,0,0,.45)', overflow:'hidden' }}>
                    <div style={{ padding:'14px 16px', background:'linear-gradient(135deg,rgba(234,179,8,.12),rgba(249,115,22,.07))', borderBottom:'1px solid rgba(234,179,8,.15)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:'#eab308', fontSize:'1.15rem', lineHeight:1 }}>🪙 {coins.toLocaleString()}</div>
                        <div style={{ fontSize:'.68rem', color:'var(--text3)', marginTop:3 }}>{t('nav_current_balance')}</div>
                      </div>
                      <Link to="/spin" onClick={() => setCoinsOpen(false)}
                        style={{ textDecoration:'none', background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', borderRadius:8, padding:'6px 12px', fontSize:'.72rem', fontWeight:800 }}>
                        🎡 {t('nav_spin')}
                      </Link>
                    </div>

                    <div style={{ padding:'8px 0' }}>
                      <div style={{ padding:'4px 16px 8px', fontSize:'.68rem', fontWeight:800, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5 }}>
                        {t('nav_recent_transactions')}
                      </div>

                      {coinsLoading ? (
                        <div style={{ padding:'20px 16px', textAlign:'center', color:'var(--text3)', fontSize:'.82rem' }}>
                          <div style={{ fontSize:'1.4rem', marginBottom:6 }}>⏳</div>{t('nav_loading')}
                        </div>
                      ) : !coinsHistory || coinsHistory.length === 0 ? (
                        <div style={{ padding:'20px 16px', textAlign:'center', color:'var(--text3)', fontSize:'.82rem' }}>
                          <div style={{ fontSize:'1.4rem', marginBottom:6 }}>💸</div>{t('nav_no_transactions')}
                        </div>
                      ) : coinsHistory.map((txn, i) => {
                        const icon = TXN_ICON[txn.type] || '🪙';
                        const pos  = txn.amount > 0;
                        return (
                          <div key={i} className="coin-txn-row"
                            style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderBottom: i < coinsHistory.length-1 ? '1px solid var(--border)' : 'none', transition:'background .15s' }}>
                            <div style={{ width:32, height:32, borderRadius:8, background: pos?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.9rem', flexShrink:0 }}>{icon}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:'.8rem', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{txn.description || t('nav_coins')}</div>
                              <div style={{ fontSize:'.68rem', color:'var(--text3)', marginTop:1 }}>
                                {txn.created_at ? new Date(txn.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}
                                {txn.balance_after != null && <span style={{ marginLeft:6, opacity:.7 }}>· {txn.balance_after}</span>}
                              </div>
                            </div>
                            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'.88rem', color:pos?'#22c55e':'#ef4444', flexShrink:0 }}>
                              {pos?'+':''}{txn.amount}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ borderTop:'1px solid var(--border)', padding:'10px 16px' }}>
                      <Link to="/dashboard" onClick={() => setCoinsOpen(false)}
                        style={{ textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:'#eab308', fontSize:'.78rem', fontWeight:700 }}>
                        {t('nav_view_history')}
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Streak badge */}
              <Link to="/streak"
                style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.25)', fontSize:'.78rem', fontWeight:700, color:'#f97316' }}>
                🔥 <span>{user.streak_count || 0}</span>
              </Link>

              {/* Spin shortcut */}
              <Link to="/spin" title={t('nav_spin_wheel')}
                style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, background:'rgba(249,115,22,.08)', border:'1px solid rgba(249,115,22,.2)', fontSize:'.78rem', fontWeight:700, color:'#f97316' }}>
                🎡
              </Link>

              {/* Avatar dropdown */}
              <div style={{ position:'relative' }}>
                <button onClick={() => setMenuOpen(v => !v)}
                  style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, padding:'4px 6px', borderRadius:8 }}>
                  <Avatar user={user} size={32} />
                  <span style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.username}</span>
                  <span style={{ color:'var(--text3)', fontSize:'.7rem' }}>{menuOpen?'▲':'▼'}</span>
                </button>

                {menuOpen && (
                  <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, minWidth:200, zIndex:200, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>
                    <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface2)' }}>
                      <div style={{ fontWeight:800, fontSize:'.9rem', color:'var(--text)' }}>{user.username}</div>
                      <div style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:2 }}>
                        🪙 {coins.toLocaleString()} {t('nav_coins')} · 🔥 {user.streak_count||0} {t('nav_streak')}
                      </div>
                    </div>

                    {menuItems.map((item, i) => (
                      <button key={i} className="nav-dropdown-btn"
                        onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        style={{ width:'100%', padding:'10px 16px', background:'none', border:'none', borderBottom:'1px solid var(--border)', textAlign:'left', cursor:'pointer', fontSize:'.85rem', color:'var(--text)' }}>
                        {item.label}
                      </button>
                    ))}

                    <button onClick={() => { logout(); setMenuOpen(false); }}
                      style={{ width:'100%', padding:'10px 16px', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontSize:'.85rem', color:'#ef4444' }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,.08)'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}>
                      🚪 {t('nav_sign_out')}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <LanguageSwitcher />
              <button className="btn btn-secondary btn-sm" onClick={() => setAuthMode('login')}>{t('nav_sign_in')}</button>
              <button className="btn btn-primary btn-sm"   onClick={() => setAuthMode('register')}>{t('nav_sign_up')}</button>
            </div>
          )}
        </div>
      </nav>

      <HintBubble location={location} />

      {authMode && (
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitch={m => setAuthMode(m)} />
      )}
    </>
  );
}