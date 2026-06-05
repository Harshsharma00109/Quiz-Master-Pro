// PATH: quiz-platform/frontend/src/pages/AdminDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../utils/api';

// ── Mini bar chart (pure SVG, no dependencies) ────────────
function BarChart({ data, color = 'var(--accent)', height = 80 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * (height - 20), 2);
        const x = i * W + W * 0.1;
        const y = height - barH - 14;
        return (
          <g key={i}>
            <rect x={x} y={y} width={W * 0.8} height={barH} rx={2} fill={color} opacity={0.85} />
            <text x={x + W * 0.4} y={height - 2} textAnchor="middle" fontSize={5} fill="var(--text3)">{d.date?.slice(-2) || d.label || ''}</text>
            {d.count > 0 && <text x={x + W * 0.4} y={y - 2} textAnchor="middle" fontSize={5} fill={color} fontWeight={700}>{d.count}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ── Pie / Donut chart ──────────────────────────────────────
function DonutChart({ segments, size = 120 }) {
  if (!segments || !segments.length) return null;
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.38, innerR = size * 0.24;
  let cumAngle = -Math.PI / 2;
  const arcs = segments.map(seg => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle), y2 = cy + r * Math.sin(cumAngle);
    const ix1 = cx + innerR * Math.cos(cumAngle - angle), iy1 = cy + innerR * Math.sin(cumAngle - angle);
    const ix2 = cx + innerR * Math.cos(cumAngle), iy2 = cy + innerR * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...seg, d: `M${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} L${ix2},${iy2} A${innerR},${innerR},0,${large},0,${ix1},${iy1} Z` };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={800} fill="var(--text)">{total}</text>
    </svg>
  );
}

// ── Stat card ──────────────────────────────────────────────
function StatCard({ val, label, icon, color = 'var(--accent)', trend, sub }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: '1.5rem' }}>{icon}</div>
        {trend != null && (
          <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 50, fontWeight: 700,
            background: trend >= 0 ? 'rgba(0,212,170,.12)' : 'rgba(239,68,68,.1)',
            color: trend >= 0 ? '#00d4aa' : '#ef4444' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.8rem', fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: '.78rem', color: 'var(--text3)', marginTop: 5 }}>{label}</div>
      {sub && <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const TABS = [
  { id: 'overview',  label: '📊 Overview'   },
  { id: 'users',     label: '👥 Users'      },
  { id: 'tickets',   label: '🎫 Tickets'    },
  { id: 'analytics', label: '📈 Analytics'  },
  { id: 'events',    label: '🎉 Events'     },
  { id: 'revenue',   label: '💰 Revenue'    },
  { id: 'comments',  label: '💬 Comments'   },
];

const priorityColor = p => ({ urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#00d4aa' }[p] || 'var(--text3)');

export default function AdminDashboard() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [tab,      setTab]       = useState('overview');
  const [stats,    setStats]     = useState(null);
  const [users,    setUsers]     = useState([]);
  const [uTotal,   setUTotal]    = useState(0);
  const [uPage,    setUPage]     = useState(1);
  const [uSearch,  setUSearch]   = useState('');
  const [uPlan,    setUPlan]     = useState('all');
  const [tickets,  setTickets]   = useState([]);
  const [tStatus,  setTStatus]   = useState('open');
  const [qStats,   setQStats]    = useState(null);
  const [events,   setEvents]    = useState([]);
  const [revenue,  setRevenue]   = useState(null);
  const [reported, setReported]  = useState([]);
  const [selUser,  setSelUser]   = useState(null);
  const [selData,  setSelData]   = useState(null);
  const [selLoading,setSelLoading]= useState(false);
  const [replies,  setReplies]   = useState({});
  const [creating, setCreating]  = useState(false);
  const [evForm,   setEvForm]    = useState({ title:'',description:'',start_date:'',end_date:'',banner_color:'#6366f1',emoji:'🎉',bonus_xp:0,is_elite_only:false,quiz_id:'' });

  useEffect(() => { if (user && !user.is_admin) navigate('/'); }, [user, navigate]);

  const loadStats    = useCallback(() => api.get('/admin/stats').then(r=>setStats(r.data)).catch(()=>{}), []);
  const loadUsers    = useCallback(() => api.get(`/admin/users?page=${uPage}&search=${uSearch}&plan=${uPlan}`).then(r=>{ setUsers(r.data.users||[]); setUTotal(r.data.total||0); }).catch(()=>{}), [uPage,uSearch,uPlan]);
  const loadTickets  = useCallback(() => api.get(`/admin/tickets?status=${tStatus}`).then(r=>setTickets(r.data||[])).catch(()=>{}), [tStatus]);
  const loadQStats   = useCallback(() => api.get('/admin/quiz-analytics').then(r=>setQStats(r.data)).catch(()=>{}), []);
  const loadEvents   = useCallback(() => api.get('/events/all').then(r=>setEvents(r.data||[])).catch(()=>{}), []);
  const loadRevenue  = useCallback(() => api.get('/admin/revenue').then(r=>setRevenue(r.data)).catch(()=>{}), []);
  const loadReported = useCallback(() => api.get('/admin/comments/reported').then(r=>setReported(r.data||[])).catch(()=>{}), []);

  useEffect(()=>{ loadStats(); },[loadStats]);
  useEffect(()=>{ if(tab==='users')     loadUsers();    },[tab,uPage,uSearch,uPlan,loadUsers]);
  useEffect(()=>{ if(tab==='tickets')   loadTickets();  },[tab,tStatus,loadTickets]);
  useEffect(()=>{ if(tab==='analytics') loadQStats();   },[tab,loadQStats]);
  useEffect(()=>{ if(tab==='events')    loadEvents();   },[tab,loadEvents]);
  useEffect(()=>{ if(tab==='revenue')   loadRevenue();  },[tab,loadRevenue]);
  useEffect(()=>{ if(tab==='comments')  loadReported(); },[tab,loadReported]);

  const openUser = async uid => {
    setSelUser(uid); setSelLoading(true);
    try { const r = await api.get(`/admin/users/${uid}`); setSelData(r.data); } catch {}
    finally { setSelLoading(false); }
  };
  const handleBan = async (uid, banned) => {
    const reason = banned ? (window.prompt('Ban reason:','Policy violation') || '') : '';
    if (banned && reason === null) return;
    await api.post(`/admin/users/${uid}/ban`,{ banned, reason });
    loadUsers();
    if (selData) setSelData(p=>({...p,user:{...p.user,is_banned:banned}}));
  };
  const handleTicket = async (id,status) => {
    await api.put(`/admin/tickets/${id}`,{ status, admin_reply:replies[id]||'' });
    setReplies(p=>({...p,[id]:''})); loadTickets();
  };
  const createEvent = async () => {
    if (!evForm.title||!evForm.start_date||!evForm.end_date) return alert('Title, start and end date required.');
    setCreating(true);
    try { await api.post('/events',{ ...evForm, bonus_xp:parseInt(evForm.bonus_xp)||0, quiz_id:evForm.quiz_id?parseInt(evForm.quiz_id):null }); loadEvents(); setEvForm({ title:'',description:'',start_date:'',end_date:'',banner_color:'#6366f1',emoji:'🎉',bonus_xp:0,is_elite_only:false,quiz_id:'' }); }
    catch(e) { alert(e.response?.data?.error||'Failed'); }
    finally { setCreating(false); }
  };

  if (!user?.is_admin) return null;

  // Chart data
  const planData = stats ? [
    { label:'Free',  value:(stats.total_users||0)-(stats.pro_subscribers||0)-(stats.elite_subscribers||0), color:'rgba(255,255,255,.2)' },
    { label:'Pro',   value:stats.pro_subscribers||0, color:'#eab308' },
    { label:'Elite', value:stats.elite_subscribers||0, color:'#8b5cf6' },
  ] : [];
  const convRate = stats && stats.total_users ? Math.round(((stats.pro_subscribers+stats.elite_subscribers)/stats.total_users)*100) : 0;

  return (
    <div className="page-enter section-sm">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24, flexWrap:'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={()=>navigate('/')}>← Home</button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.8rem', fontWeight:800 }}>⚙️ Admin Dashboard</h1>
          <p style={{ color:'var(--text2)', fontSize:'.85rem', marginTop:2 }}>QuizMaster Pro Control Panel</p>
        </div>
        {stats?.urgent_tickets > 0 && (
          <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'6px 12px', fontSize:'.82rem', color:'#ef4444', fontWeight:700 }}>
            🚨 {stats.urgent_tickets} urgent
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:24, overflowX:'auto', paddingBottom:4, flexWrap:'wrap' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'8px 14px', borderRadius:50, border:'1px solid var(--border)', fontSize:'.8rem', cursor:'pointer', whiteSpace:'nowrap', fontWeight:600,
              background:tab===t.id?'var(--accent)':'var(--surface)', color:tab===t.id?'#fff':'var(--text2)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab==='overview'&&(
        <div>
          {!stats ? <div className="skeleton" style={{ height:300,borderRadius:12 }} /> : (
            <>
              {/* Stat cards grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:28 }}>
                <StatCard val={stats.total_users.toLocaleString()}      label="Total Users"        icon="👥" color="var(--accent)"   />
                <StatCard val={stats.active_today.toLocaleString()}     label="Active Today"       icon="🟢" color="#00d4aa"         sub="Logged in today" />
                <StatCard val={stats.new_users_week.toLocaleString()}   label="New This Week"      icon="📈" color="var(--accent4)"  />
                <StatCard val={stats.new_users_month.toLocaleString()}  label="New This Month"     icon="📅" color="var(--accent3)"  />
                <StatCard val={(stats.pro_subscribers||0).toLocaleString()} label="Pro Subscribers"  icon="⭐" color="#eab308"     />
                <StatCard val={(stats.elite_subscribers||0).toLocaleString()} label="Elite Subscribers" icon="💎" color="#8b5cf6" />
                <StatCard val={stats.total_attempts.toLocaleString()}   label="Quiz Attempts"      icon="🎯" color="#f97316"         />
                <StatCard val={`${stats.avg_score}%`}                   label="Avg Quiz Score"     icon="💯" color="#00d4aa"         />
                <StatCard val={`${convRate}%`}                          label="Conversion Rate"    icon="💰" color="#eab308"         sub="Free → Paid" />
                <StatCard val={`₹${(stats.mrr||0).toLocaleString()}`}  label="MRR (30 days)"      icon="💰" color="#00d4aa"         />
                <StatCard val={(stats.open_tickets||0).toString()}      label="Open Tickets"       icon="🎫" color={stats.open_tickets>0?'#f97316':'var(--text3)'} />
                <StatCard val={stats.total_quizzes.toLocaleString()}    label="Total Quizzes"      icon="📝" color="var(--accent)"   />
              </div>

              {/* Charts row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
                {/* Daily new users bar chart */}
                <div className="card">
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12, fontSize:'.95rem' }}>📈 New Users (Last 7 Days)</div>
                  <BarChart data={stats.daily_new_users||[]} color="var(--accent)" height={90} />
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:'.72rem', color:'var(--text3)' }}>
                    <span>7 days ago</span><span>Today</span>
                  </div>
                </div>

                {/* Subscription pie/donut */}
                <div className="card" style={{ display:'flex', gap:20, alignItems:'center' }}>
                  <DonutChart segments={planData} size={110} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12, fontSize:'.95rem' }}>👥 Subscription Split</div>
                    {planData.map((p,i)=>(
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:'.82rem' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:10, height:10, borderRadius:2, background:p.color, display:'inline-block' }} />
                          {p.label}
                        </span>
                        <span style={{ color:p.color, fontWeight:700 }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top streak users */}
              {stats.top_streak_users?.length > 0 && (
                <div className="card">
                  <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:14 }}>🔥 Top Streak Users</div>
                  {stats.top_streak_users.map((u,i)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ width:24, textAlign:'center', fontSize:'.82rem', color:'var(--text3)', fontWeight:600 }}>#{i+1}</div>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', fontSize:'.82rem', overflow:'hidden', flexShrink:0 }}>
                        {u.avatar_url ? <img src={u.avatar_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} /> : u.username?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:'.88rem' }}>{u.username}</div>
                        {u.streak_title && <div style={{ fontSize:'.72rem', color:'#f97316' }}>{u.streak_title}</div>}
                      </div>
                      <div style={{ fontFamily:'Syne', fontWeight:800, color:'#f97316', fontSize:'.95rem' }}>🔥{u.streak_count}</div>
                      <span style={{ fontSize:'.7rem', padding:'2px 8px', borderRadius:50, background:`rgba(${u.subscription_plan==='elite'?'139,92,246':u.subscription_plan==='pro'?'234,179,8':'255,255,255'},.1)`, color:u.subscription_plan==='elite'?'#8b5cf6':u.subscription_plan==='pro'?'#eab308':'var(--text3)' }}>
                        {u.subscription_plan}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {tab==='users'&&(
        <div>
          {selUser ? (
            <div>
              <button className="btn btn-secondary btn-sm" style={{ marginBottom:16 }} onClick={()=>{ setSelUser(null); setSelData(null); }}>← Back</button>
              {selLoading ? <div className="skeleton" style={{ height:220,borderRadius:12 }} /> : selData&&(
                <div>
                  <div className="card" style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
                      <div style={{ width:60, height:60, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', fontWeight:700, color:'#fff', overflow:'hidden', flexShrink:0 }}>
                        {selData.user?.avatar_url ? <img src={selData.user.avatar_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} /> : selData.user?.username?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:'1.1rem' }}>{selData.user?.username}</div>
                        <div style={{ fontSize:'.8rem', color:'var(--text3)' }}>{selData.user?.email}</div>
                        {selData.user?.streak_title && <div style={{ fontSize:'.75rem', color:'#f97316', marginTop:2 }}>🔥 {selData.user.streak_title}</div>}
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={()=>api.post(`/admin/users/${selData.user.id}/make-admin`,{ is_admin:!selData.user.is_admin }).then(()=>setSelData(p=>({...p,user:{...p.user,is_admin:!p.user.is_admin}})))}>
                          {selData.user?.is_admin?'Remove Admin':'Make Admin'}
                        </button>
                        {selData.user?.is_banned
                          ? <button className="btn btn-secondary btn-sm" onClick={()=>handleBan(selData.user.id,false)}>Unban</button>
                          : <button style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(239,68,68,.4)', background:'rgba(239,68,68,.1)', color:'#ef4444', cursor:'pointer', fontSize:'.82rem' }} onClick={()=>handleBan(selData.user.id,true)}>🚫 Ban</button>
                        }
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      {[
                        {l:'Joined',     v:new Date(selData.user?.created_at||Date.now()).toLocaleDateString()},
                        {l:'Last Login', v:selData.user?.last_login?new Date(selData.user.last_login).toLocaleDateString():'Never'},
                        {l:'Plan',       v:selData.user?.subscription_plan||'free'},
                        {l:'Streak',     v:`🔥 ${selData.user?.streak_count||0} days`},
                        {l:'Total Quizzes',v:selData.attempts?.length||0},
                        {l:'Status',     v:selData.user?.is_banned?'🚫 Banned':'✅ Active'},
                      ].map((d,i)=>(
                        <div key={i} style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 12px' }}>
                          <div style={{ fontSize:'.7rem', color:'var(--text3)', marginBottom:2 }}>{d.l}</div>
                          <div style={{ fontWeight:600, fontSize:'.88rem' }}>{d.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selData.attempts?.slice(0,8).length > 0 && (
                    <div className="card" style={{ marginBottom:14 }}>
                      <div style={{ fontWeight:700, marginBottom:10 }}>Recent Attempts</div>
                      {selData.attempts.slice(0,8).map((a,i)=>(
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'.82rem' }}>
                          <span style={{ color:'var(--text2)' }}>{a.quizzes?.title||`Quiz #${a.quiz_id}`}</span>
                          <span style={{ color:'#00d4aa', fontWeight:600 }}>{Math.round((a.score/a.total_questions)*100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selData.ai_history?.length > 0 && (
                    <div className="card" style={{ marginBottom:14 }}>
                      <div style={{ fontWeight:700, marginBottom:10 }}>AI Search History</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {selData.ai_history.map((a,i)=>(
                          <span key={i} style={{ padding:'3px 10px', borderRadius:50, background:'var(--surface2)', fontSize:'.75rem', color:'var(--text2)' }}>{a.topic}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selData.subscriptions?.length > 0 && (
                    <div className="card">
                      <div style={{ fontWeight:700, marginBottom:10 }}>Subscription History</div>
                      {selData.subscriptions.map((s,i)=>(
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:'.82rem', flexWrap:'wrap', gap:6 }}>
                          <span style={{ fontWeight:600 }}>{s.plan} · ₹{s.amount}</span>
                          <span style={{ color:'var(--text3)' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                          <span style={{ color:'#00d4aa' }}>{s.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                <input className="form-input" placeholder="Search…" value={uSearch} style={{ flex:1, minWidth:160 }} onChange={e=>{ setUSearch(e.target.value); setUPage(1); }} />
                <select className="form-input" value={uPlan} onChange={e=>setUPlan(e.target.value)} style={{ width:'auto' }}>
                  <option value="all">All Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                </select>
                <button className="btn btn-secondary btn-sm" onClick={loadUsers}>Search</button>
              </div>
              <div style={{ fontSize:'.8rem', color:'var(--text3)', marginBottom:12 }}>{uTotal} users</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {users.map((u,i)=>(
                  <div key={i} onClick={()=>openUser(u.id)}
                    style={{ background:'var(--surface)', border:`1px solid ${u.is_banned?'rgba(239,68,68,.25)':'var(--border)'}`, borderRadius:10, padding:'11px 15px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='rgba(108,99,255,.3)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=u.is_banned?'rgba(239,68,68,.25)':'var(--border)'}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', fontSize:'.85rem', overflow:'hidden', flexShrink:0 }}>
                      {u.avatar_url?<img src={u.avatar_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />:u.username?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:'.9rem' }}>{u.username} {u.is_admin&&<span style={{ fontSize:'.6rem', background:'rgba(108,99,255,.2)', color:'var(--accent)', borderRadius:4, padding:'1px 5px', marginLeft:4 }}>ADMIN</span>}</div>
                      <div style={{ fontSize:'.74rem', color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                      {u.streak_count>0&&<span style={{ fontSize:'.78rem', color:'#f97316', fontWeight:600 }}>🔥{u.streak_count}</span>}
                      <span style={{ fontSize:'.7rem', padding:'2px 8px', borderRadius:50, background:`rgba(${u.subscription_plan==='elite'?'139,92,246':u.subscription_plan==='pro'?'234,179,8':'255,255,255'},.1)`, color:u.subscription_plan==='elite'?'#8b5cf6':u.subscription_plan==='pro'?'#eab308':'var(--text3)' }}>{u.subscription_plan}</span>
                      {u.is_banned&&<span style={{ fontSize:'.7rem', color:'#ef4444', fontWeight:600 }}>Banned</span>}
                    </div>
                    <span style={{ color:'var(--text3)' }}>→</span>
                  </div>
                ))}
              </div>
              {uTotal>20&&(
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16 }}>
                  <button className="btn btn-secondary btn-sm" disabled={uPage===1} onClick={()=>setUPage(p=>p-1)}>← Prev</button>
                  <span style={{ padding:'6px 12px', fontSize:'.82rem', color:'var(--text2)' }}>Page {uPage} / {Math.ceil(uTotal/20)}</span>
                  <button className="btn btn-secondary btn-sm" disabled={uPage*20>=uTotal} onClick={()=>setUPage(p=>p+1)}>Next →</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TICKETS ── */}
      {tab==='tickets'&&(
        <div>
          <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
            {['open','in_progress','resolved','all'].map(s=>(
              <button key={s} onClick={()=>setTStatus(s)}
                style={{ padding:'6px 14px', borderRadius:50, border:'1px solid var(--border)', fontSize:'.78rem', cursor:'pointer', background:tStatus===s?'var(--accent)':'transparent', color:tStatus===s?'#fff':'var(--text2)' }}>
                {s.replace('_',' ')}
              </button>
            ))}
          </div>
          {tickets.length===0 ? <div className="empty-state"><div className="empty-text">No {tStatus} tickets</div></div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {tickets.map((t,i)=>(
                <div key={i} className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'.9rem' }}>{t.subject}</div>
                      <div style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:2 }}>{t.username||t.email} · {new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:'.7rem', padding:'2px 8px', borderRadius:50, background:`rgba(255,255,255,.05)`, color:priorityColor(t.priority), fontWeight:600, border:`1px solid ${priorityColor(t.priority)}33` }}>{t.priority}</span>
                      <span style={{ fontSize:'.7rem', padding:'2px 8px', borderRadius:50, background:'var(--surface2)', color:'var(--text2)' }}>{t.status}</span>
                    </div>
                  </div>
                  <p style={{ fontSize:'.85rem', color:'var(--text2)', marginBottom:12, lineHeight:1.5 }}>{t.message}</p>
                  {t.admin_reply&&<div style={{ background:'rgba(108,99,255,.08)', border:'1px solid rgba(108,99,255,.2)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontSize:'.82rem' }}><span style={{ color:'var(--accent)', fontWeight:600 }}>Admin: </span>{t.admin_reply}</div>}
                  {t.status!=='resolved'&&(
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <textarea className="form-input" rows={2} placeholder="Reply…" value={replies[t.id]||''} onChange={e=>setReplies(p=>({...p,[t.id]:e.target.value}))} style={{ flex:1,minWidth:160,resize:'vertical' }} />
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        <button className="btn btn-primary btn-sm" onClick={()=>handleTicket(t.id,'in_progress')}>Reply</button>
                        <button className="btn btn-secondary btn-sm" onClick={()=>handleTicket(t.id,'resolved')}>✓ Resolve</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {tab==='analytics'&&qStats&&(
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:24 }}>
            <StatCard val={qStats.total_attempts.toLocaleString()} label="Total Attempts" icon="🎯" />
            <StatCard val={`${qStats.avg_score}%`} label="Avg Score" icon="💯" color="#00d4aa" />
            <StatCard val={`${Math.floor((qStats.avg_time||0)/60)}m ${(qStats.avg_time||0)%60}s`} label="Avg Time" icon="⏱" color="#eab308" />
          </div>
          {qStats.top_ai_topics?.length > 0 && (
            <div className="card">
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:14 }}>🤖 Top AI Topics</div>
              {qStats.top_ai_topics.map((t,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                  <div style={{ width:24, fontSize:'.78rem', color:'var(--text3)', fontWeight:600 }}>#{i+1}</div>
                  <div style={{ flex:1, fontSize:'.88rem' }}>{t.topic}</div>
                  <div style={{ fontSize:'.82rem', color:'var(--accent3)', fontWeight:600 }}>{t.count}</div>
                  <div style={{ width:80, height:6, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.round((t.count/(qStats.top_ai_topics[0]?.count||1))*100)}%`, background:'var(--accent)', borderRadius:3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EVENTS ── */}
      {tab==='events'&&(
        <div>
          <div className="card" style={{ marginBottom:24 }}>
            <div style={{ fontWeight:700, marginBottom:16 }}>➕ Create Event</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Title</label>
                <input className="form-input" placeholder="e.g. Diwali Quiz 2025" value={evForm.title} onChange={e=>setEvForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={2} value={evForm.description} onChange={e=>setEvForm(f=>({...f,description:e.target.value}))} />
              </div>
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="datetime-local" value={evForm.start_date} onChange={e=>setEvForm(f=>({...f,start_date:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="datetime-local" value={evForm.end_date} onChange={e=>setEvForm(f=>({...f,end_date:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Banner Color</label><input type="color" value={evForm.banner_color} onChange={e=>setEvForm(f=>({...f,banner_color:e.target.value}))} style={{ width:'100%',height:40,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer' }} /></div>
              <div className="form-group"><label className="form-label">Emoji</label><input className="form-input" value={evForm.emoji} onChange={e=>setEvForm(f=>({...f,emoji:e.target.value}))} placeholder="🎉" /></div>
              <div className="form-group"><label className="form-label">Bonus XP</label><input className="form-input" type="number" value={evForm.bonus_xp} onChange={e=>setEvForm(f=>({...f,bonus_xp:e.target.value}))} /></div>
              <div className="form-group"><label className="form-label">Quiz ID (optional)</label><input className="form-input" type="number" placeholder="Quiz ID to link" value={evForm.quiz_id} onChange={e=>setEvForm(f=>({...f,quiz_id:e.target.value}))} /></div>
              <div className="form-group" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="checkbox" checked={evForm.is_elite_only} onChange={e=>setEvForm(f=>({...f,is_elite_only:e.target.checked}))} style={{ width:16,height:16,accentColor:'var(--accent)' }} />
                <label style={{ fontSize:'.85rem' }}>Elite only</label>
              </div>
            </div>
            <button className="btn btn-primary" onClick={createEvent} disabled={creating}>{creating?'Creating…':'🎉 Create Event'}</button>
          </div>
          {events.length===0 ? <div className="empty-state"><div className="empty-text">No events</div></div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {events.map((ev,i)=>{
                const now2=new Date(), active=now2>=new Date(ev.start_date)&&now2<=new Date(ev.end_date);
                return (
                  <div key={i} style={{ background:'var(--surface)', border:`2px solid ${ev.banner_color}44`, borderRadius:12, overflow:'hidden' }}>
                    <div style={{ background:`${ev.banner_color}22`, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${ev.banner_color}33` }}>
                      <div style={{ fontWeight:700, color:ev.banner_color }}>{ev.emoji} {ev.title}</div>
                      <span style={{ fontSize:'.72rem', padding:'2px 8px', borderRadius:50, background:active?'rgba(0,212,170,.15)':'var(--surface2)', color:active?'#00d4aa':'var(--text3)', fontWeight:600 }}>{active?'🟢 Live':'⚫ Inactive'}</span>
                    </div>
                    <div style={{ padding:'12px 16px', fontSize:'.82rem', color:'var(--text2)' }}>
                      <div style={{ display:'flex', gap:16, fontSize:'.75rem', color:'var(--text3)', flexWrap:'wrap' }}>
                        <span>📅 {new Date(ev.start_date).toLocaleDateString()} → {new Date(ev.end_date).toLocaleDateString()}</span>
                        {ev.bonus_xp>0&&<span>⭐ +{ev.bonus_xp} XP</span>}
                        {ev.quiz_id&&<span>📝 Quiz #{ev.quiz_id}</span>}
                        {ev.is_elite_only&&<span style={{ color:'#8b5cf6' }}>💎 Elite only</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── REVENUE ── */}
      {tab==='revenue'&&revenue&&(
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
            <StatCard val={`₹${(revenue.mrr||0).toLocaleString()}`} label="MRR (30 days)" icon="💰" color="#00d4aa" />
            <StatCard val={`₹${(revenue.arr||0).toLocaleString()}`} label="ARR (1 year)"  icon="📈" color="#eab308" />
          </div>
          {revenue.recent_transactions?.length>0&&(
            <div className="card">
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:14 }}>Recent Transactions</div>
              {revenue.recent_transactions.map((t,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:'.85rem', flexWrap:'wrap', gap:6 }}>
                  <span style={{ fontWeight:600, textTransform:'capitalize' }}>{t.plan}</span>
                  <span style={{ color:'var(--text3)', fontSize:'.75rem' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                  <span style={{ color:'#00d4aa', fontWeight:700 }}>₹{t.amount}</span>
                  {t.upi_ref&&<span style={{ color:'var(--text3)', fontSize:'.72rem' }}>UTR: {t.upi_ref}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── COMMENTS ── */}
      {tab==='comments'&&(
        <div>
          <div style={{ fontWeight:700, marginBottom:16 }}>Reported Comments ({reported.length})</div>
          {reported.length===0 ? (
            <div className="empty-state"><div className="empty-icon">✅</div><div className="empty-text">No reported comments</div></div>
          ) : reported.map((c,i)=>(
            <div key={i} className="card" style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, flexWrap:'wrap', gap:8 }}>
                <div style={{ fontWeight:600, fontSize:'.88rem' }}>{c.username}</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-sm" style={{ background:'rgba(99,102,241,.1)',color:'var(--accent)',border:'1px solid rgba(99,102,241,.2)',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:'.75rem' }} onClick={()=>api.post(`/admin/comments/${c.id}/pin`,{ pinned:!c.is_pinned }).then(loadReported)}>{c.is_pinned?'Unpin':'📌 Pin'}</button>
                  <button style={{ background:'rgba(239,68,68,.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,.2)',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:'.75rem' }} onClick={()=>api.delete(`/admin/comments/${c.id}`).then(()=>setReported(p=>p.filter(x=>x.id!==c.id)))}>🗑 Remove</button>
                </div>
              </div>
              <p style={{ fontSize:'.85rem', color:'var(--text2)' }}>{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}