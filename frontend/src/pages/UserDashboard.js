// PATH: quiz-platform/frontend/src/pages/UserDashboard.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

const BADGE_MAP = {
  first_quiz:    { label:'first_quiz',    emoji:'🎯' },
  perfect_score: { label:'perfect_score', emoji:'💯' },
  speed_demon:   { label:'speed_demon',   emoji:'⚡' },
  century:       { label:'century',       emoji:'💪' },
  quiz_creator:  { label:'quiz_creator',  emoji:'✏️'  },
  social_star:   { label:'social_star',   emoji:'⚔️'  },
  bookworm:      { label:'bookworm',      emoji:'🔖' },
  event_hero:    { label:'event_hero',    emoji:'🎉' },
  streak_3:      { label:'streak_3',      emoji:'🔥' },
  streak_7:      { label:'streak_7',      emoji:'📅' },
  streak_30:     { label:'streak_30',     emoji:'🏆' },
  pro_member:    { label:'pro_member',    emoji:'⭐' },
  elite_member:  { label:'elite_member',  emoji:'💎' },
};

const BADGE_LABELS = {
  first_quiz:'First Quiz', perfect_score:'Perfect Score', speed_demon:'Speed Demon',
  century:'Century Club', quiz_creator:'Quiz Creator', social_star:'Social Star',
  bookworm:'Bookworm', event_hero:'Event Hero', streak_3:'On Fire',
  streak_7:'Week Warrior', streak_30:'Monthly Master', pro_member:'Pro Member',
  elite_member:'Elite Member',
};

const PLAN_STYLE = {
  free:     { color:'#6b7280', label:'Free',     icon:'📖' },
  pro:      { color:'#eab308', label:'Pro',       icon:'⭐' },
  elite:    { color:'#8b5cf6', label:'Elite',     icon:'💎' },
  lifetime: { color:'#f97316', label:'Lifetime',  icon:'♾️'  },
};

function StatCard({ icon, label, value, sub, color = '#6366f1' }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'18px 20px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-10, right:-10, fontSize:'3rem', opacity:.08 }}>{icon}</div>
      <div style={{ fontSize:'1.5rem', marginBottom:6 }}>{icon}</div>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.6rem', fontWeight:900, color }}>{value}</div>
      <div style={{ fontSize:'.78rem', fontWeight:700, color:'var(--text2)', marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max, color = '#6366f1', height = 8 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ background:'var(--surface2)', borderRadius:99, height, overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:99, transition:'width .8s ease' }}/>
    </div>
  );
}

export default function UserDashboard() {
  const { user, token, refreshUser } = useAuth();
  const { toast }    = useToast();
  const { t }        = useLanguage();
  const navigate     = useNavigate();

  const [badges,    setBadges]   = useState([]);
  const [attempts,  setAttempts] = useState([]);
  const [coinTxns,  setCoinTxns] = useState([]);
  const [streak,    setStreak]   = useState(null);
  const [loading,   setLoading]  = useState(true);
  const [activeTab, setTab]      = useState('overview');
  const [coins,     setCoins]    = useState(0);

  useEffect(() => { if (user?.coins != null) setCoins(user.coins); }, [user?.coins]);

  useEffect(() => {
    const handler = (e) => { if (e.detail?.coins != null) setCoins(e.detail.coins); };
    window.addEventListener('coinsUpdated', handler);
    return () => window.removeEventListener('coinsUpdated', handler);
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (refreshUser) {
          const updated = await refreshUser();
          if (updated?.coins != null && !cancelled) setCoins(updated.coins);
        }
        const [bR, aR, cR, sR] = await Promise.all([
          fetch(`${BASE}/users/${user.id}/badges`,   { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE}/users/${user.id}/attempts`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE}/coins/history`,             { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE}/users/${user.id}/streak`,   { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!cancelled) {
          if (bR.ok) { const d = await bR.json(); setBadges(d.badges || []); }
          if (aR.ok) { const d = await aR.json(); setAttempts(d.slice(0, 10)); }
          if (cR.ok) { const d = await cR.json(); setCoinTxns(d.slice(0, 8)); }
          if (sR.ok) { const d = await sR.json(); setStreak(d); }
        }
      } catch { toast.error(t('error')); }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [token, user?.id]); // eslint-disable-line

  if (!user) return (
    <div style={{ textAlign:'center', padding:'80px 24px' }}>
      <div style={{ fontSize:'3rem' }}>🔒</div>
      <h2 style={{ fontFamily:'Syne,sans-serif' }}>{t('auth_login_title')}</h2>
      <Link to="/login" className="btn btn-primary" style={{ display:'inline-block', marginTop:16 }}>{t('nav_sign_in')}</Link>
    </div>
  );

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div className="spinner"/>
    </div>
  );

  const plan     = PLAN_STYLE[user.subscription_plan] || PLAN_STYLE.free;
  const accuracy = user.total_questions_answered > 0
    ? Math.round((user.total_correct / user.total_questions_answered) * 100) : 0;
  const xpProg = (user.xp_points || 0) % 500;

  const tabs = ['overview', 'badges', 'history', 'coins'];
  const tabLabels = {
    overview: `📊 ${t('dashboard_overview')}`,
    badges:   `🏅 ${t('dashboard_badges')}`,
    history:  `📋 ${t('dashboard_history')}`,
    coins:    `🪙 ${t('dashboard_coins')}`,
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'32px 16px 64px' }}>
      <style>{`
        @keyframes fadeUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        .dash-section{animation:fadeUp .4s ease}
        .tab-btn{background:transparent;border:none;cursor:pointer;padding:10px 20px;border-radius:10px;font-weight:700;font-size:.9rem;transition:all .2s;color:var(--text2)}
        .tab-btn.active{background:var(--surface);color:var(--text);border:1px solid var(--border)}
        .tab-btn:hover:not(.active){color:var(--text)}
        .quick-link{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 18px;text-decoration:none;color:var(--text);transition:all .2s;cursor:pointer}
        .quick-link:hover{border-color:rgba(99,102,241,.5);transform:translateY(-2px)}
      `}</style>

      <div style={{ maxWidth:720, margin:'0 auto' }}>

        {/* Profile header */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:'28px 24px', marginBottom:24, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, right:0, width:200, height:200, background:`radial-gradient(circle,${plan.color}15,transparent 70%)`, borderRadius:'50%', transform:'translate(30%,-30%)' }}/>
          <div style={{ display:'flex', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>
            <div style={{ width:72, height:72, borderRadius:20, background:`linear-gradient(135deg,${plan.color}44,${plan.color}22)`, border:`2px solid ${plan.color}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', flexShrink:0 }}>
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', borderRadius:18, objectFit:'cover' }}/>
                : user.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
                <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.5rem', fontWeight:900, margin:0 }}>{user.username}</h1>
                <span style={{ background:`${plan.color}22`, border:`1px solid ${plan.color}55`, color:plan.color, borderRadius:20, padding:'3px 12px', fontSize:'.75rem', fontWeight:800 }}>
                  {plan.icon} {plan.label}
                </span>
                {user.streak_title && (
                  <span style={{ background:'rgba(249,115,22,.12)', border:'1px solid rgba(249,115,22,.3)', color:'#f97316', borderRadius:20, padding:'3px 12px', fontSize:'.75rem', fontWeight:800 }}>
                    🔥 {user.streak_title}
                  </span>
                )}
              </div>
              <div style={{ color:'var(--text3)', fontSize:'.82rem', marginBottom:12 }}>{user.unique_display_id}</div>
              <div style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:'.75rem', color:'var(--text2)', fontWeight:700 }}>{t('level')} {user.level || 1}</span>
                  <span style={{ fontSize:'.72rem', color:'var(--text3)' }}>{xpProg}/500 XP</span>
                </div>
                <ProgressBar value={xpProg} max={500} color="#6366f1"/>
              </div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                {[
                  { icon:'🔥', val: user.streak_count || 0,   label: t('streak') },
                  { icon:'🪙', val: coins.toLocaleString(),    label: t('nav_coins') },
                  { icon:'⚡', val: user.xp_points || 0,      label: 'XP' },
                  { icon:'👥', val: user.followers_count || 0, label: 'followers' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'1.1rem' }}>{s.icon} {s.val}</div>
                    <div style={{ fontSize:'.7rem', color:'var(--text3)' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => navigate('/profile')} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 16px', fontSize:'.82rem', fontWeight:700, cursor:'pointer', color:'var(--text)', flexShrink:0 }}>
              ✏️ {t('profile_edit')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:20, overflowX:'auto', paddingBottom:4 }}>
          {tabs.map(tab => (
            <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setTab(tab)}>
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {activeTab === 'overview' && (
          <div className="dash-section">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
              <StatCard icon="🎮" label={t('dashboard_quizzes_played')} value={user.total_quizzes || 0}                               color="#6366f1"/>
              <StatCard icon="✅" label={t('dashboard_accuracy')}       value={`${accuracy}%`}                                        color="#22c55e"/>
              <StatCard icon="🏆" label={t('dashboard_wins')}           value={user.total_wins || 0}                                   color="#eab308"/>
              <StatCard icon="⏱️"  label={t('dashboard_time_spent')}    value={`${Math.round((user.total_time_spent||0)/3600)}h`}      color="#06b6d4" sub={t('total')}/>
              <StatCard icon="🔥" label={t('dashboard_streak_status')}  value={`${user.streak_count||0}d`}                            color="#f97316"/>
              <StatCard icon="📈" label={t('dashboard_rank_points')}    value={(user.rank_points||0).toLocaleString()}                 color="#8b5cf6"/>
            </div>

            {streak && (
              <div style={{ background:'var(--surface)', border:'1px solid rgba(249,115,22,.3)', borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, margin:0 }}>🔥 {t('dashboard_streak_status')}</h3>
                  <Link to="/streak" style={{ fontSize:'.8rem', color:'#f97316', textDecoration:'none', fontWeight:700 }}>{t('next')} →</Link>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, textAlign:'center', marginBottom:16 }}>
                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'2rem', color:'#f97316' }}>{streak.current_streak}</div>
                    <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{t('current')}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'2rem', color:'#eab308' }}>{streak.longest_streak}</div>
                    <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{t('best')}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'2rem', color:'#06b6d4' }}>{streak.freeze_credits}</div>
                    <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{t('freezes')}</div>
                  </div>
                </div>
                {streak.next_milestone && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:'.8rem' }}>
                      <span style={{ color:'var(--text2)' }}>{t('next')}: <strong>{streak.next_milestone.label}</strong></span>
                      <span style={{ color:'#f97316', fontWeight:700 }}>{streak.current_streak}/{streak.next_milestone.days}</span>
                    </div>
                    <ProgressBar value={streak.current_streak} max={streak.next_milestone.days} color="#f97316"/>
                  </>
                )}
              </div>
            )}

            {/* Subscription */}
            <div style={{ background:'var(--surface)', border:`1px solid ${plan.color}33`, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, margin:'0 0 4px' }}>{plan.icon} {plan.label}</h3>
                  <div style={{ fontSize:'.82rem', color:'var(--text2)' }}>
                    {user.subscription_plan === 'free'
                      ? t('nav_subscription')
                      : user.subscription_end
                        ? `${new Date(user.subscription_end).toLocaleDateString()}`
                        : 'Lifetime access'}
                  </div>
                </div>
                {user.subscription_plan === 'free' && (
                  <Link to="/subscription" style={{ background:`linear-gradient(135deg,${plan.color},#8b5cf6)`, color:'#fff', borderRadius:10, padding:'10px 18px', textDecoration:'none', fontWeight:800, fontSize:'.85rem', whiteSpace:'nowrap' }}>
                    {t('nav_subscription')} ⭐
                  </Link>
                )}
              </div>
            </div>

            {/* Quick links */}
            <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'.85rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:12 }}>
              {t('nav_browse')}
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
              {[
                { icon:'🎡', label: t('nav_spin_wheel'),       sub: t('dashboard_daily_spin'), to:'/spin' },
                { icon:'🔖', label: t('nav_saved_quizzes'),    sub: t('nav_saved'),            to:'/bookmarks' },
                { icon:'🤖', label: t('nav_ai_quiz'),          sub: t('ai_generate_questions'),to:'/ai' },
                { icon:'📊', label: t('nav_leaderboard'),      sub: t('lb_rank'),              to:'/leaderboard' },
                { icon:'🏆', label: t('nav_my_quizzes'),       sub: t('nav_quiz_history'),     to:'/my-quizzes' },
                { icon:'📅', label: t('nav_streak'),           sub: t('dashboard_streak_status'), to:'/streak' },
              ].map((l, i) => (
                <Link key={i} to={l.to} className="quick-link">
                  <span style={{ fontSize:'1.5rem' }}>{l.icon}</span>
                  <div>
                    <div style={{ fontWeight:700, fontSize:'.9rem' }}>{l.label}</div>
                    <div style={{ fontSize:'.72rem', color:'var(--text3)' }}>{l.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══ BADGES ══ */}
        {activeTab === 'badges' && (
          <div className="dash-section">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
              {badges.length === 0 ? (
                <div style={{ gridColumn:'1/-1', textAlign:'center', padding:48, color:'var(--text3)' }}>
                  <div style={{ fontSize:'3rem', marginBottom:12 }}>🏅</div>
                  <div>{t('dashboard_no_badges')}</div>
                </div>
              ) : badges.map((b, i) => {
                const bm = BADGE_MAP[b.badge_id] || { emoji:'🎖️' };
                return (
                  <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'20px 16px', textAlign:'center' }}>
                    <div style={{ fontSize:'2.5rem', marginBottom:8 }}>{bm.emoji}</div>
                    <div style={{ fontWeight:800, fontSize:'.88rem', marginBottom:4 }}>{BADGE_LABELS[b.badge_id] || b.badge_id}</div>
                    <div style={{ fontSize:'.7rem', color:'var(--text3)' }}>{b.earned_at ? new Date(b.earned_at).toLocaleDateString() : ''}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {activeTab === 'history' && (
          <div className="dash-section">
            {attempts.length === 0 ? (
              <div style={{ textAlign:'center', padding:48, color:'var(--text3)' }}>
                <div style={{ fontSize:'3rem', marginBottom:12 }}>📋</div>
                <div>{t('dashboard_no_history')}</div>
                <Link to="/browse" className="btn btn-primary" style={{ display:'inline-block', marginTop:16 }}>{t('dashboard_browse_quizzes')}</Link>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {attempts.map((a, i) => {
                  const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
                  const col = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
                  return (
                    <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:48, height:48, borderRadius:12, background:`${col}22`, border:`2px solid ${col}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontFamily:'Syne,sans-serif', fontWeight:900, color:col, fontSize:'1rem' }}>{pct}%</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:'.9rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.quiz_title || 'Quiz'}</div>
                        <div style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:2 }}>
                          {a.score}/{a.total_questions} {t('quiz_correct').toLowerCase()} · {Math.round((a.time_taken||0)/60)}m · {new Date(a.completed_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontWeight:700, color:'#22c55e', fontSize:'.82rem' }}>+{a.coins_earned||0} 🪙</div>
                        <div style={{ fontSize:'.72rem', color:'var(--text3)' }}>{a.category}</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ textAlign:'center', marginTop:8 }}>
                  <Link to="/history" style={{ color:'#6366f1', fontWeight:700, fontSize:'.9rem', textDecoration:'none' }}>{t('nav_quiz_history')} →</Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ COINS ══ */}
        {activeTab === 'coins' && (
          <div className="dash-section">
            <div style={{ background:'linear-gradient(135deg,rgba(234,179,8,.15),rgba(249,115,22,.1))', border:'1px solid rgba(234,179,8,.3)', borderRadius:20, padding:'28px 24px', marginBottom:20, textAlign:'center' }}>
              <div style={{ fontSize:'3rem', marginBottom:8 }}>🪙</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:'2.5rem', fontWeight:900, color:'#eab308' }}>{coins.toLocaleString()}</div>
              <div style={{ color:'var(--text2)', fontSize:'.9rem', marginTop:4 }}>
                {t('total')}: <strong style={{ color:'#f97316' }}>{(user.total_coins_earned||0).toLocaleString()}</strong> {t('nav_coins')}
              </div>
              <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:20, flexWrap:'wrap' }}>
                <Link to="/spin" style={{ background:'linear-gradient(135deg,#f97316,#ef4444)', color:'#fff', borderRadius:12, padding:'10px 20px', textDecoration:'none', fontWeight:800, fontSize:'.88rem' }}>
                  🎡 {t('dashboard_daily_spin')}
                </Link>
                <Link to="/browse" style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:12, padding:'10px 20px', textDecoration:'none', fontWeight:700, fontSize:'.88rem' }}>
                  🎮 {t('dashboard_earn_more')}
                </Link>
              </div>
            </div>

            <h3 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'.85rem', color:'var(--text3)', textTransform:'uppercase', letterSpacing:1.5, marginBottom:14 }}>
              {t('nav_recent_transactions')}
            </h3>
            {coinTxns.length === 0 ? (
              <div style={{ textAlign:'center', padding:48, color:'var(--text3)' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:12 }}>💸</div>
                <div>{t('nav_no_transactions')}</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {coinTxns.map((txn, i) => (
                  <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'.88rem' }}>{txn.description}</div>
                      <div style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:2 }}>
                        {new Date(txn.created_at).toLocaleDateString()} · {t('nav_current_balance')}: {txn.balance_after}
                      </div>
                    </div>
                    <div style={{ fontWeight:800, color: txn.amount > 0 ? '#22c55e' : '#ef4444', fontSize:'1rem', flexShrink:0 }}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount} 🪙
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}