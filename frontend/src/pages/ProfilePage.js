// PATH: quiz-platform/frontend/src/pages/ProfilePage.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../utils/api';
import BadgeDisplay    from '../components/BadgeDisplay';
import StreakBadge     from '../components/StreakBadge';

const PRESET_AVATARS = [
  '🧠','🦁','🐯','🦊','🐺','🦅','🐉','⚡','🌟','💎','🔥','🎯','🚀','🎓','👑',
];

const PLAN_COLORS = { free:'var(--text3)', pro:'#eab308', elite:'#8b5cf6' };
const PLAN_ICONS  = { free:'📖', pro:'⭐', elite:'💎' };

function AvatarUploadModal({ onClose, onSave }) {
  const [mode,     setMode]     = useState('preset'); // preset | upload
  const [selected, setSelected] = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [file,     setFile]     = useState(null);
  const [saving,   setSaving]   = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2*1024*1024) { alert('Image must be under 2MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'preset' && selected) {
        await api.put('/auth/profile', { avatar_preset: selected, avatar_url: null });
        onSave({ avatar_preset: selected, avatar_url: null });
      } else if (mode === 'upload' && preview) {
        // In production: upload to Supabase Storage, get URL
        // For now: store base64 preview (production: use storage bucket)
        await api.put('/auth/profile', { avatar_url: preview, avatar_preset: null });
        onSave({ avatar_url: preview, avatar_preset: null });
      }
      onClose();
    } catch (e) { alert('Failed to save avatar'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', backdropFilter:'blur(8px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:'100%', maxWidth:420 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.1rem' }}>Change Avatar</div>
          <button onClick={onClose} style={{ background:'var(--surface2)', border:'none', color:'var(--text2)', width:28, height:28, borderRadius:'50%', cursor:'pointer' }}>✕</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:20, background:'var(--surface2)', borderRadius:50, padding:4 }}>
          {[['preset','🎭 Preset'],['upload','📷 Upload']].map(([v,l]) => (
            <button key={v} onClick={() => setMode(v)}
              style={{ flex:1, padding:'8px 0', borderRadius:50, border:'none', cursor:'pointer', fontSize:'.85rem', fontWeight:600,
                background:mode===v?'var(--accent)':'transparent', color:mode===v?'#fff':'var(--text2)' }}>
              {l}
            </button>
          ))}
        </div>

        {mode === 'preset' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
            {PRESET_AVATARS.map((av, i) => (
              <button key={i} onClick={() => setSelected(av)}
                style={{ fontSize:'2rem', padding:'10px 0', borderRadius:12, border:`2px solid ${selected===av?'var(--accent)':'var(--border)'}`, background:selected===av?'rgba(108,99,255,.15)':'var(--surface2)', cursor:'pointer' }}>
                {av}
              </button>
            ))}
          </div>
        )}

        {mode === 'upload' && (
          <div style={{ marginBottom:20 }}>
            <div style={{ width:120, height:120, borderRadius:'50%', margin:'0 auto 16px', border:'2px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', cursor:'pointer', background:'var(--surface2)' }}
              onClick={() => fileRef.current.click()}>
              {preview ? <img src={preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ textAlign:'center', color:'var(--text3)', fontSize:'.8rem' }}>📷<br/>Click to upload</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
            <button className="btn btn-secondary btn-full btn-sm" onClick={() => fileRef.current.click()}>
              Choose Image (max 2MB)
            </button>
            <p style={{ fontSize:'.73rem', color:'var(--text3)', marginTop:6, textAlign:'center' }}>JPG, PNG, WebP supported</p>
          </div>
        )}

        <button className="btn btn-primary btn-full" onClick={handleSave}
          disabled={saving||(mode==='preset'&&!selected)||(mode==='upload'&&!preview)}>
          {saving ? 'Saving…' : '✓ Save Avatar'}
        </button>
      </div>
    </div>
  );
}

function Avatar({ user, size=80, onClick }) {
  const s = { width:size, height:size, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0, cursor:onClick?'pointer':'default', border:'2px solid var(--border)' };
  if (user?.avatar_url) return <div style={s} onClick={onClick}><img src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>;
  if (user?.avatar_preset) return <div style={{ ...s, background:'var(--surface2)', fontSize:size*0.45 }} onClick={onClick}>{user.avatar_preset}</div>;
  return <div style={{ ...s, background:'var(--accent)', fontSize:size*0.4, fontWeight:700, color:'#fff' }} onClick={onClick}>{user?.username?.[0]?.toUpperCase()||'?'}</div>;
}

export default function ProfilePage() {
  const navigate     = useNavigate();
  const { user, logout } = useAuth();
  const [profile,    setProfile]    = useState(null);
  const [analytics,  setAnalytics]  = useState(null);
  const [streak,     setStreak]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [showAvatar, setShowAvatar] = useState(false);
  const [editBio,    setEditBio]    = useState(false);
  const [bio,        setBio]        = useState('');
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      api.get('/auth/me'),
      api.get(`/users/${user.id}/analytics`).catch(()=>({ data:null })),
      api.get(`/users/${user.id}/streak`).catch(()=>({ data:null })),
    ]).then(([p, a, s]) => {
      setProfile(p.data);
      setBio(p.data?.bio||'');
      setAnalytics(a.data);
      setStreak(s.data);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, [user?.id]);

  const handleAvatarSave = (updates) => setProfile(prev => ({...prev,...updates}));

  const handleBioSave = async () => {
    setSaving(true);
    try { await api.put('/auth/profile',{ bio }); setProfile(prev=>({...prev,bio})); setEditBio(false); }
    catch { alert('Failed to save bio'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="section-sm">{[1,2,3].map(i=><div key={i} className="skeleton" style={{ height:80,borderRadius:12,marginBottom:12 }} />)}</div>
  );

  const plan = profile?.subscription_plan || 'free';
  const avgScore = profile?.total_questions_answered
    ? Math.round((profile.total_correct/profile.total_questions_answered)*100) : 0;

  return (
    <div className="page-enter section-sm">
      {showAvatar && <AvatarUploadModal onClose={()=>setShowAvatar(false)} onSave={handleAvatarSave} />}

      {/* ── Profile card ── */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-start' }}>
          {/* Avatar */}
          <div style={{ position:'relative' }}>
            <Avatar user={profile} size={90} onClick={()=>setShowAvatar(true)} />
            <button onClick={()=>setShowAvatar(true)}
              style={{ position:'absolute', bottom:0, right:0, width:28, height:28, borderRadius:'50%', background:'var(--accent)', border:'2px solid var(--surface)', color:'#fff', cursor:'pointer', fontSize:'.75rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
              ✏️
            </button>
          </div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
              <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.5rem', fontWeight:800 }}>{profile?.username}</h1>
              <span style={{ fontSize:'.72rem', padding:'2px 10px', borderRadius:50, background:`${PLAN_COLORS[plan]}20`, color:PLAN_COLORS[plan], fontWeight:700, border:`1px solid ${PLAN_COLORS[plan]}40` }}>
                {PLAN_ICONS[plan]} {plan.toUpperCase()}
              </span>
            </div>
            {profile?.unique_display_id && (
              <div style={{ fontSize:'.78rem', color:'var(--text3)', marginBottom:4 }}>ID: {profile.unique_display_id}</div>
            )}
            {profile?.streak_title && (
              <div style={{ fontSize:'.82rem', color:'#f97316', fontWeight:600, marginBottom:6 }}>🔥 {profile.streak_title}</div>
            )}

            {/* Bio */}
            {editBio ? (
              <div style={{ marginBottom:8 }}>
                <textarea className="form-input" rows={2} value={bio} onChange={e=>setBio(e.target.value)} maxLength={200} style={{ resize:'none', fontSize:'.88rem' }} autoFocus />
                <div style={{ display:'flex', gap:6, marginTop:6 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleBioSave} disabled={saving}>{saving?'Saving…':'Save'}</button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>{ setEditBio(false); setBio(profile?.bio||''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', gap:6, alignItems:'flex-start' }}>
                <p style={{ fontSize:'.88rem', color:'var(--text2)', flex:1 }}>{profile?.bio||'No bio yet.'}</p>
                <button onClick={()=>setEditBio(true)} style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'.78rem', flexShrink:0 }}>✏️ Edit</button>
              </div>
            )}

            <div style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:6 }}>
              Joined {new Date(profile?.created_at||Date.now()).toLocaleDateString('en-IN',{ month:'long', year:'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Streak ── */}
      {(profile?.streak_count > 0 || profile?.longest_streak > 0) && (
        <div style={{ marginBottom:20 }}>
          <StreakBadge streak={profile?.streak_count||0} />
        </div>
      )}

      {/* ── Stats grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { val:profile?.total_quizzes||0,  label:'Quizzes Taken', color:'var(--accent)'  },
          { val:`${avgScore}%`,              label:'Avg Score',     color:'#00d4aa'        },
          { val:profile?.streak_count||0,   label:'Current Streak',color:'#f97316'        },
          { val:profile?.longest_streak||0, label:'Best Streak',   color:'#eab308'        },
          { val:profile?.xp_points||0,      label:'XP Points',     color:'var(--accent4)' },
          { val:`Lv.${profile?.level||1}`,  label:'Level',         color:'var(--accent3)' },
        ].map((s,i)=>(
          <div key={i} className="card" style={{ textAlign:'center', padding:14 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.2rem', fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:'.7rem', color:'var(--text3)', marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Quick nav ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10, marginBottom:24 }}>
        {[
          { icon:'🔥', label:'Streak Dashboard', path:'/streak' },
          { icon:'📊', label:'Quiz History',     path:'/history' },
          { icon:'🔖', label:'Saved Quizzes',    path:'/bookmarks' },
          { icon:'✏️', label:'My Quizzes',        path:'/my-quizzes' },
          { icon:'📈', label:'Creator Dashboard', path:'/dashboard' },
          ...(profile?.is_admin?[{ icon:'⚙️', label:'Admin Panel', path:'/admin' }]:[]),
        ].map((item,i)=>(
          <button key={i} onClick={()=>navigate(item.path)} className="card"
            style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', cursor:'pointer', textAlign:'left', border:'1px solid var(--border)', background:'var(--surface)' }}>
            <span style={{ fontSize:'1.3rem' }}>{item.icon}</span>
            <span style={{ fontWeight:600, fontSize:'.83rem', color:'var(--text)' }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Subscription ── */}
      <div style={{ background:`linear-gradient(135deg,${PLAN_COLORS[plan]}18,${PLAN_COLORS[plan]}08)`, border:`1px solid ${PLAN_COLORS[plan]}30`, borderRadius:14, padding:'18px 20px', marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, marginBottom:4 }}>
              {PLAN_ICONS[plan]} {plan.charAt(0).toUpperCase()+plan.slice(1)} Plan
            </div>
            {plan==='free' ? (
              <div style={{ fontSize:'.82rem', color:'var(--text3)' }}>5 AI quizzes/day · Basic features</div>
            ) : (
              <div style={{ fontSize:'.82rem', color:'var(--text3)' }}>
                Expires: {profile?.subscription_end?new Date(profile.subscription_end).toLocaleDateString('en-IN'):'Never'}
              </div>
            )}
          </div>
          {plan==='free' && (
            <button className="btn btn-primary btn-sm" onClick={()=>navigate('/subscription')}>⬆️ Upgrade</button>
          )}
        </div>
      </div>

      {/* ── Badges ── */}
      <BadgeDisplay userId={user?.id} />

      {/* ── Logout ── */}
      <div style={{ marginTop:24, borderTop:'1px solid var(--border)', paddingTop:20 }}>
        <button className="btn btn-secondary btn-sm" onClick={logout} style={{ color:'#ef4444', borderColor:'rgba(239,68,68,.3)' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}