// PATH: quiz-platform/frontend/src/components/AITopicSearch.js
// Usage: <AITopicSearch onSearch={(topic, difficulty) => startQuiz(topic, difficulty)} loading={false} />
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const SUGGESTIONS = [
  'JavaScript','Python','React','Machine Learning','World History',
  'IPL Cricket','Marvel Universe','Bollywood Movies','Space Science',
  'Geography of India','Ancient Civilizations','Football / Soccer',
  'Harry Potter','Biology','Mathematics','Chemistry','Physics',
  'Mughal Empire','Coding Basics','Web Development','AI & Robotics',
  'Cricket World Cup','Indian Politics','Stock Market','Yoga & Health',
];

const DIFFICULTY_CONFIG = [
  { id:'easy',   label:'Easy',   color:'#00d4aa', icon:'😊' },
  { id:'medium', label:'Medium', color:'#eab308', icon:'🤔' },
  { id:'hard',   label:'Hard',   color:'#ef4444', icon:'😤' },
];

export default function AITopicSearch({ onSearch, loading }) {
  const { user }          = useAuth();
  const [topic,           setTopic]           = useState('');
  const [difficulty,      setDifficulty]      = useState('medium');
  const [recent,          setRecent]          = useState([]);
  const [popular,         setPopular]         = useState([]);
  const [showDropdown,    setShowDropdown]    = useState(false);
  const [filtered,        setFiltered]        = useState([]);
  const [quota,           setQuota]           = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (user) {
      api.get('/ai/search-history').then(r=>setRecent(r.data||[])).catch(()=>{});
      api.get('/ai/quota').then(r=>setQuota(r.data)).catch(()=>{});
    }
    api.get('/ai/popular-topics').then(r=>setPopular(r.data||[])).catch(()=>{});
  }, [user]);

  useEffect(() => {
    if (!topic.trim()) { setFiltered([]); return; }
    const t = topic.toLowerCase();
    setFiltered(SUGGESTIONS.filter(s=>s.toLowerCase().includes(t)).slice(0,6));
  }, [topic]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()||loading) return;
    setShowDropdown(false);
    onSearch(topic.trim(), difficulty);
  };

  const pick = (t) => {
    setTopic(t);
    setShowDropdown(false);
    setTimeout(()=>inputRef.current?.focus(),50);
  };

  const showSuggestions = showDropdown && (filtered.length>0 || (!topic&&(recent.length>0||popular.length>0)));
  const diffConfig = DIFFICULTY_CONFIG.find(d=>d.id===difficulty);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.4rem', fontWeight:800, marginBottom:6 }}>
          🤖 AI Quiz Generator
        </div>
        <p style={{ fontSize:'.88rem', color:'var(--text2)' }}>
          Type any topic and AI generates a custom quiz instantly
        </p>
      </div>

      {/* Quota warning */}
      {quota&&!quota.allowed&&(
        <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <span style={{ fontSize:'.85rem', color:'#ef4444' }}>🚫 Daily AI limit reached ({quota.limit}/day on Free plan)</span>
          <a href="/subscription" style={{ fontSize:'.8rem', color:'var(--accent)', fontWeight:600 }}>Upgrade for unlimited →</a>
        </div>
      )}
      {quota&&quota.allowed&&quota.limit<999&&(
        <div style={{ background:'rgba(108,99,255,.06)', border:'1px solid rgba(108,99,255,.2)', borderRadius:10, padding:'8px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:'.8rem', color:'var(--text3)' }}>🤖 AI Quota: {quota.remaining}/{quota.limit} remaining today</span>
          <div style={{ width:80, height:5, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${(quota.remaining/quota.limit)*100}%`, background:'var(--accent)', borderRadius:3 }} />
          </div>
        </div>
      )}

      {/* Search form */}
      <form onSubmit={handleSubmit}>
        {/* Input */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:'1.1rem', pointerEvents:'none' }}>🔍</span>
            <input
              ref={inputRef}
              className="form-input"
              placeholder="e.g. JavaScript, IPL Cricket, Marvel, Ancient India…"
              value={topic}
              onChange={e=>{ setTopic(e.target.value); setShowDropdown(true); }}
              onFocus={()=>setShowDropdown(true)}
              onBlur={()=>setTimeout(()=>setShowDropdown(false),180)}
              style={{ paddingLeft:44, paddingRight:topic?44:16, fontSize:'1rem' }}
              autoComplete="off"
              disabled={loading}
            />
            {topic && (
              <button type="button" onClick={()=>setTopic('')}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'1rem', padding:0 }}>
                ✕
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showSuggestions&&(
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, zIndex:200, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.4)' }}>
              {/* Recent */}
              {!topic&&recent.length>0&&(
                <>
                  <div style={{ padding:'8px 14px 4px', fontSize:'.7rem', color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Recent Searches</div>
                  {recent.slice(0,4).map((r,i)=>(
                    <div key={i} onMouseDown={()=>pick(r.topic)}
                      style={{ padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:'.88rem' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{ color:'var(--text3)',fontSize:'.9rem' }}>🕒</span>
                      <span>{r.topic}</span>
                      <span style={{ marginLeft:'auto', fontSize:'.72rem', color:'var(--text3)', textTransform:'capitalize' }}>{r.difficulty}</span>
                    </div>
                  ))}
                  {popular.length>0&&<div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />}
                </>
              )}
              {/* Suggestions */}
              {filtered.length>0&&(
                <>
                  <div style={{ padding:'8px 14px 4px', fontSize:'.7rem', color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Suggestions</div>
                  {filtered.map((s,i)=>(
                    <div key={i} onMouseDown={()=>pick(s)}
                      style={{ padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:'.88rem' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{ color:'var(--text3)',fontSize:'.9rem' }}>🔍</span>{s}
                    </div>
                  ))}
                </>
              )}
              {/* Popular */}
              {!topic&&popular.length>0&&(
                <>
                  <div style={{ padding:'8px 14px 4px', fontSize:'.7rem', color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>Trending</div>
                  {popular.slice(0,4).map((p,i)=>(
                    <div key={i} onMouseDown={()=>pick(p.topic)}
                      style={{ padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:'.88rem' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{ fontSize:'.9rem' }}>🔥</span>
                      <span>{p.topic}</span>
                      <span style={{ marginLeft:'auto', fontSize:'.72rem', color:'var(--text3)' }}>×{p.count}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Difficulty + Submit */}
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:6 }}>
            {DIFFICULTY_CONFIG.map(d=>(
              <button key={d.id} type="button" onClick={()=>setDifficulty(d.id)}
                style={{ padding:'8px 14px', borderRadius:50, border:`1px solid ${difficulty===d.id?d.color+'66':'var(--border)'}`, fontSize:'.82rem', cursor:'pointer', fontWeight:600,
                  background:difficulty===d.id?`${d.color}18`:'transparent', color:difficulty===d.id?d.color:'var(--text2)', transition:'all .2s' }}>
                {d.icon} {d.label}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" type="submit"
            disabled={!topic.trim()||loading||(quota&&!quota.allowed)}
            style={{ flex:1, minWidth:140, padding:'10px 20px', fontSize:'.95rem' }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <span style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block' }} />
                Generating…
              </span>
            ) : `⚡ Generate ${diffConfig?.label} Quiz`}
          </button>
        </div>
      </form>

      {/* Popular topics chips */}
      {popular.length>0&&!topic&&(
        <div style={{ marginTop:20 }}>
          <div style={{ fontSize:'.75rem', color:'var(--text3)', fontWeight:600, marginBottom:10, textTransform:'uppercase', letterSpacing:.8 }}>🔥 Trending Topics</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {popular.slice(0,8).map((p,i)=>(
              <button key={i} onClick={()=>pick(p.topic)}
                style={{ padding:'6px 14px', borderRadius:50, border:'1px solid var(--border)', background:'var(--surface)', fontSize:'.78rem', cursor:'pointer', color:'var(--text2)', transition:'all .2s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(108,99,255,.4)'; e.currentTarget.style.color='var(--text)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)'; }}>
                {p.topic} <span style={{ color:'var(--text3)',fontSize:'.7rem' }}>×{p.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}