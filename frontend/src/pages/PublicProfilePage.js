// PATH: quiz-platform/frontend/src/pages/PublicProfilePage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const PLAN_ICONS = { free:'📖', pro:'⭐', elite:'💎' };

function Avatar({ user, size=80 }) {
  const s = { width:size, height:size, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0, border:'2px solid var(--border)' };
  if (user?.avatar_url) return <div style={s}><img src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>;
  if (user?.avatar_preset) return <div style={{ ...s, background:'var(--surface2)', fontSize:size*0.45 }}>{user.avatar_preset}</div>;
  return <div style={{ ...s, background:'var(--accent)', fontSize:size*0.4, fontWeight:700, color:'#fff' }}>{user?.username?.[0]?.toUpperCase()||'?'}</div>;
}

export default function PublicProfilePage() {
  const { username }  = useParams();
  const navigate      = useNavigate();
  const { user }      = useAuth();
  const [profile,     setProfile]    = useState(null);
  const [following,   setFollowing]  = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState('');

  useEffect(() => {
    api.get(`/users/${username}/profile`)
      .then(r => { setProfile(r.data); })
      .catch(e => setError(e.response?.data?.error||'Profile not found.'))
      .finally(()=>setLoading(false));
  }, [username]);

  useEffect(() => {
    if (!user || !profile) return;
    if (user.username === username) return;
    api.get(`/users/${profile.id}/follow-status`)
      .then(r => setFollowing(r.data.following))
      .catch(()=>{});
  }, [user, profile, username]);

  const handleFollow = async () => {
    if (!user) { navigate('/'); return; }
    setFollowLoading(true);
    try {
      const { data } = await api.post(`/users/${profile.id}/follow`);
      setFollowing(data.following);
      setProfile(prev => ({ ...prev, followers_count: prev.followers_count + (data.following?1:-1) }));
    } catch {}
    finally { setFollowLoading(false); }
  };

  if (loading) return <div className="section-sm">{[1,2].map(i=><div key={i} className="skeleton" style={{ height:80,borderRadius:12,marginBottom:12 }} />)}</div>;

  if (error) return (
    <div style={{ textAlign:'center', paddingTop:80 }}>
      <div style={{ fontSize:'3rem', marginBottom:16 }}>👤</div>
      <p style={{ color:'var(--text2)', marginBottom:20 }}>{error}</p>
      <button className="btn btn-primary" onClick={()=>navigate('/browse')}>Browse Quizzes</button>
    </div>
  );

  const isOwnProfile = user?.username === username;
  const avgScore = profile?.total_questions_answered
    ? Math.round((profile.total_correct/profile.total_questions_answered)*100) : 0;

  return (
    <div className="page-enter section-sm">
      <button className="btn btn-secondary btn-sm" style={{ marginBottom:20 }} onClick={()=>navigate(-1)}>← Back</button>

      {/* Profile card */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-start' }}>
          <Avatar user={profile} size={90} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
              <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.4rem', fontWeight:800 }}>{profile.username}</h1>
              {profile.subscription_plan!=='free' && (
                <span style={{ fontSize:'.75rem', padding:'2px 8px', borderRadius:50, background:'rgba(139,92,246,.15)', color:'#8b5cf6', fontWeight:700 }}>
                  {PLAN_ICONS[profile.subscription_plan]} {profile.subscription_plan.toUpperCase()}
                </span>
              )}
            </div>
            {profile.unique_display_id && <div style={{ fontSize:'.75rem', color:'var(--text3)', marginBottom:4 }}>ID: {profile.unique_display_id}</div>}
            {profile.streak_title && <div style={{ fontSize:'.82rem', color:'#f97316', fontWeight:600, marginBottom:6 }}>🔥 {profile.streak_title}</div>}
            {profile.bio && <p style={{ fontSize:'.88rem', color:'var(--text2)', marginBottom:8, lineHeight:1.5 }}>{profile.bio}</p>}
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:'.78rem', color:'var(--text3)', marginBottom:10 }}>
              <span>{profile.followers_count||0} followers</span>
              <span>{profile.following_count||0} following</span>
              <span>Joined {new Date(profile.created_at).toLocaleDateString('en-IN',{ month:'long', year:'numeric' })}</span>
            </div>
            {!isOwnProfile && user && (
              <button className={`btn btn-sm ${following?'btn-secondary':'btn-primary'}`}
                onClick={handleFollow} disabled={followLoading}>
                {followLoading?'…':following?'✓ Following':'+ Follow'}
              </button>
            )}
            {isOwnProfile && (
              <button className="btn btn-secondary btn-sm" onClick={()=>navigate('/profile')}>Edit Profile</button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:10, marginBottom:24 }}>
        {[
          { val:profile.total_quizzes||0,  label:'Quizzes',      color:'var(--accent)'  },
          { val:`${avgScore}%`,            label:'Avg Score',    color:'#00d4aa'        },
          { val:profile.streak_count||0,  label:'Streak',       color:'#f97316'        },
          { val:profile.longest_streak||0,label:'Best Streak',  color:'#eab308'        },
          { val:`Lv.${profile.level||1}`, label:'Level',        color:'var(--accent3)' },
        ].map((s,i)=>(
          <div key={i} className="card" style={{ textAlign:'center', padding:12 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.1rem', fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:'.68rem', color:'var(--text3)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      {profile.badges?.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12 }}>🎖️ Badges ({profile.badges.length})</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {profile.badges.map((b,i)=>(
              <div key={i} title={b.desc} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:6, fontSize:'.82rem' }}>
                <span style={{ fontSize:'1.1rem' }}>{b.emoji}</span>{b.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent rewards */}
      {profile.recent_rewards?.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12 }}>🏆 Recent Rewards</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {profile.recent_rewards.map((r,i)=>(
              <div key={i} style={{ background:'rgba(249,115,22,.08)', border:'1px solid rgba(249,115,22,.25)', borderRadius:10, padding:'8px 12px', fontSize:'.82rem', color:'#f97316', fontWeight:600 }}>
                🔥 {r.reward_label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent quiz activity */}
      {profile.recent_attempts?.length > 0 && (
        <div>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:12 }}>📋 Recent Activity</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {profile.recent_attempts.map((a,i)=>{
              const pct=Math.round((a.score/a.total_questions)*100);
              return (
                <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', display:'flex', justifyContent:'space-between', fontSize:'.85rem' }}>
                  <span style={{ color:'var(--text2)' }}>{a.quizzes?.title||'Quiz'}</span>
                  <span style={{ color:pct>=60?'#00d4aa':'#ff6b9d', fontWeight:600 }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}