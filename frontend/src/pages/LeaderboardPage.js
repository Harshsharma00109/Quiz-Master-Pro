// PATH: quiz-platform/frontend/src/pages/LeaderboardPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../utils/api';

const PRIZES = {
  weekly:  { '1':{ coins:500,  badge:'🥇 Weekly Champion'  }, '2':{ coins:300 }, '3':{ coins:150 } },
  monthly: { '1':{ coins:2000, badge:'🏆 Monthly Legend', discount:'20%' }, '2':{ coins:1000 }, '3':{ coins:500 } },
  yearly:  { '1':{ coins:10000, badge:'👑 Yearly King', plan:'Elite 1 Year' }, '2':{ coins:5000 }, '3':{ coins:2000 } },
};

const planColors = { free:'var(--text3)', pro:'#eab308', elite:'#8b5cf6', lifetime:'#f97316' };
const PERIOD_LABELS = { weekly:'Weekly', monthly:'Monthly', yearly:'Yearly', alltime:'All Time' };

function getRankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function Countdown({ target }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(target) - Date.now();
      if (diff <= 0) { setLeft('Reset now'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLeft(`${d}d ${h}h ${m}m`);
    };
    calc();
    const t = setInterval(calc, 60000);
    return () => clearInterval(t);
  }, [target]);
  return <span>{left}</span>;
}

function getResetDate(period) {
  const now = new Date();
  if (period === 'weekly') {
    const d = new Date(now);
    d.setDate(now.getDate() + (7 - now.getDay()));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return new Date(now.getFullYear() + 1, 0, 1);
}

export default function LeaderboardPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const [period,  setPeriod]  = useState('weekly');
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [myRank,  setMyRank]  = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/leaderboard/${period}`)
      .then(r => {
        const rows = r.data || [];
        setData(rows);
        if (user) {
          const idx = rows.findIndex(u => u.user_id === user.id || u.id === user.id);
          setMyRank(idx >= 0 ? idx + 1 : null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, user]);

  const periodPrizes = PRIZES[period] || {};
  const resetDate = period !== 'alltime' ? getResetDate(period) : null;

  return (
    <div className="page-enter section-sm">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28, flexWrap:'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>← Home</button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.8rem', fontWeight:800 }}>🏆 Leaderboards</h1>
          <p style={{ color:'var(--text2)', fontSize:'.88rem', marginTop:2 }}>Compete. Win. Earn prizes.</p>
        </div>
        {resetDate && (
          <div style={{ background:'rgba(234,179,8,.1)', border:'1px solid rgba(234,179,8,.3)', borderRadius:8, padding:'6px 12px', fontSize:'.78rem', color:'#eab308', fontWeight:600, textAlign:'center' }}>
            ⏱ Resets in <Countdown target={resetDate} />
          </div>
        )}
      </div>

      {/* My rank badge */}
      {myRank && (
        <div style={{ background:'linear-gradient(135deg,rgba(108,99,255,.15),rgba(139,92,246,.08))', border:'1px solid rgba(108,99,255,.3)', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <span style={{ fontWeight:700 }}>Your Rank:</span>
            <span style={{ fontFamily:'Syne', fontWeight:900, fontSize:'1.3rem', color:'var(--accent)', marginLeft:10 }}>#{myRank}</span>
          </div>
          {periodPrizes[String(myRank)] && (
            <div style={{ fontSize:'.82rem', color:'#eab308' }}>
              🎁 Prize: {periodPrizes[String(myRank)].coins} coins
              {periodPrizes[String(myRank)].badge ? ` + ${periodPrizes[String(myRank)].badge}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Period tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {['weekly','monthly','yearly','alltime'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding:'8px 16px', borderRadius:50, border:'1px solid var(--border)', fontSize:'.82rem', cursor:'pointer', fontWeight:600,
              background: period === p ? 'var(--accent)' : 'var(--surface)', color: period === p ? '#fff' : 'var(--text2)' }}>
            {p === 'weekly' ? '📅' : p === 'monthly' ? '🗓' : p === 'yearly' ? '📆' : '🌟'} {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Prizes section */}
      {Object.keys(periodPrizes).length > 0 && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 18px', marginBottom:20 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12, fontSize:'.95rem' }}>🎁 {PERIOD_LABELS[period]} Prizes</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
            {Object.entries(periodPrizes).map(([rank, prize]) => (
              <div key={rank} style={{ background:'var(--surface2)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                <div style={{ fontSize:'1.4rem' }}>{rank === '1' ? '🥇' : rank === '2' ? '🥈' : '🥉'}</div>
                <div style={{ fontWeight:700, fontSize:'.82rem', color:'#eab308', marginTop:4 }}>🪙 {prize.coins}</div>
                {prize.badge && <div style={{ fontSize:'.7rem', color:'var(--accent)', marginTop:2 }}>{prize.badge}</div>}
                {prize.discount && <div style={{ fontSize:'.7rem', color:'#00d4aa', marginTop:2 }}>{prize.discount} off</div>}
                {prize.plan && <div style={{ fontSize:'.7rem', color:'#8b5cf6', marginTop:2 }}>{prize.plan}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard list */}
      {loading ? (
        <div>{[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height:68, borderRadius:12, marginBottom:8 }} />)}</div>
      ) : data.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <div className="empty-title">No entries yet</div>
          <div className="empty-text">Be the first to claim the top spot!</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {data.map((entry, i) => {
            const rank = entry.rank || i + 1;
            const isMe = entry.user_id === user?.id || entry.id === user?.id;
            const isTop3 = rank <= 3;
            return (
              <div key={i}
                style={{ background: isMe ? 'rgba(108,99,255,.12)' : isTop3 ? 'var(--surface)' : 'var(--surface)', border: `1.5px solid ${isMe ? 'var(--accent)' : isTop3 ? 'rgba(234,179,8,.2)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 16px', display:'flex', alignItems:'center', gap:12 }}>

                {/* Rank */}
                <div style={{ width:40, textAlign:'center', fontSize: rank <= 3 ? '1.4rem' : '.88rem', fontWeight:800, color: rank === 1 ? '#eab308' : rank === 2 ? '#94a3b8' : rank === 3 ? '#f97316' : 'var(--text3)', flexShrink:0 }}>
                  {getRankEmoji(rank)}
                </div>

                {/* Avatar */}
                <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', fontSize:'.9rem', overflow:'hidden', flexShrink:0, border: isTop3 ? '2px solid rgba(234,179,8,.3)' : 'none' }}>
                  {entry.avatar_url ? <img src={entry.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : entry.username?.[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:'.92rem', display:'flex', alignItems:'center', gap:6 }}>
                    {entry.username}
                    {isMe && <span style={{ fontSize:'.65rem', background:'var(--accent)', color:'#fff', borderRadius:4, padding:'1px 6px' }}>YOU</span>}
                    {entry.subscription_plan && entry.subscription_plan !== 'free' && (
                      <span style={{ fontSize:'.65rem', color: planColors[entry.subscription_plan] }}>
                        {entry.subscription_plan === 'elite' ? '💎' : entry.subscription_plan === 'lifetime' ? '♾️' : '⭐'}
                      </span>
                    )}
                  </div>
                  {entry.streak_title && <div style={{ fontSize:'.72rem', color:'#f97316', marginTop:1 }}>🔥 {entry.streak_title}</div>}
                </div>

                {/* Score */}
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, color: rank === 1 ? '#eab308' : 'var(--accent)', fontSize:'.95rem' }}>
                    {(entry.score || entry.rank_points || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize:'.7rem', color:'var(--text3)' }}>points</div>
                </div>

                {/* Prize indicator */}
                {periodPrizes[String(rank)] && (
                  <div style={{ fontSize:'1rem' }}>🎁</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!user && (
        <div className="card" style={{ marginTop:20, textAlign:'center' }}>
          <p style={{ marginBottom:12 }}>Sign in to track your rank and win prizes!</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Sign In →</button>
        </div>
      )}
    </div>
  );
}
