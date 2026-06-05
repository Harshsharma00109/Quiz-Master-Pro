// PATH: quiz-platform/frontend/src/components/EventBanner.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function EventBanner() {
  const navigate   = useNavigate();
  const [events,   setEvents]   = useState([]);
  const [dismissed,setDismissed]= useState(()=>{
    try { return new Set(JSON.parse(localStorage.getItem('dismissed_events')||'[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    api.get('/events').then(r=>setEvents(r.data||[])).catch(()=>{});
  }, []);

  const dismiss = (id) => {
    const next = new Set([...dismissed,id]);
    setDismissed(next);
    localStorage.setItem('dismissed_events',JSON.stringify([...next]));
  };

  const active = events.filter(e=>!dismissed.has(e.id));
  if (!active.length) return null;

  return (
    <div style={{ marginBottom:20 }}>
      {active.map(ev=>{
        const daysLeft = Math.ceil((new Date(ev.end_date)-Date.now())/86400000);
        return (
          <div key={ev.id} style={{ background:`linear-gradient(135deg,${ev.banner_color}22,${ev.banner_color}0f)`, border:`1px solid ${ev.banner_color}44`, borderRadius:14, padding:'14px 18px', marginBottom:10, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', animation:'_efade .4s ease' }}>
            <style>{`@keyframes _efade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div style={{ fontSize:'2.2rem' }}>{ev.emoji||'🎉'}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1rem', color:ev.banner_color, marginBottom:2 }}>{ev.title}</div>
              {ev.description&&<div style={{ fontSize:'.82rem', color:'var(--text2)', marginBottom:4 }}>{ev.description}</div>}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:'.73rem', color:'var(--text3)' }}>
                <span>⏳ {daysLeft>0?`${daysLeft} day${daysLeft!==1?'s':''} left`:'Ends today!'}</span>
                {ev.bonus_xp>0&&<span style={{ color:ev.banner_color, fontWeight:600 }}>⭐ +{ev.bonus_xp} Bonus XP</span>}
                {ev.is_elite_only&&<span style={{ color:'#8b5cf6' }}>💎 Elite Only</span>}
              </div>
            </div>
            {ev.quiz_id&&(
              <button className="btn btn-primary btn-sm"
                style={{ background:ev.banner_color, border:'none', flexShrink:0 }}
                onClick={()=>navigate(`/quiz/${ev.quiz_id}`)}>
                Play Now →
              </button>
            )}
            <button onClick={()=>dismiss(ev.id)}
              style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'1rem', padding:4, flexShrink:0 }}
              title="Dismiss">
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}