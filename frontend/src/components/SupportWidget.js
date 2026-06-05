// PATH: quiz-platform/frontend/src/components/SupportWidget.js
// Add to App.js inside AppInner: <SupportWidget />
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function SupportWidget() {
  const { user }     = useAuth();
  const [open,       setOpen]       = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [myTickets,  setMyTickets]  = useState(null);
  const [view,       setView]       = useState('form'); // form | tickets
  const [form,       setForm]       = useState({ subject:'', message:'', email:'', priority:'medium' });

  const openWidget = async () => {
    setOpen(v=>!v);
    if (!open && user) {
      api.get('/support/my-tickets').then(r=>setMyTickets(r.data||[])).catch(()=>{});
    }
  };

  const handleSubmit = async () => {
    if (!form.subject.trim()||!form.message.trim()) { setError('Subject and message required.'); return; }
    if (!user&&!form.email.trim()) { setError('Email required.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/support/ticket', { ...form, email:form.email||user?.email||'' });
      setSubmitted(true);
    } catch(e) { setError(e.response?.data?.error||'Failed to submit. Try again.'); }
    finally { setLoading(false); }
  };

  const reset = () => { setSubmitted(false); setForm({ subject:'',message:'',email:'',priority:'medium' }); setError(''); };
  const close = () => { setOpen(false); reset(); setView('form'); };

  const statusColors = { open:'#f97316', in_progress:'#6366f1', resolved:'#00d4aa', closed:'var(--text3)' };

  return (
    <>
      {/* Floating button */}
      <button onClick={openWidget}
        style={{ position:'fixed', bottom:28, right:28, width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', cursor:'pointer', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', boxShadow:'0 6px 24px rgba(108,99,255,.5)', transition:'all .25s' }}
        title="Customer Support"
        onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.1)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(108,99,255,.7)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 6px 24px rgba(108,99,255,.5)'; }}>
        {open?'✕':'💬'}
      </button>

      {/* Widget panel */}
      {open&&(
        <div style={{ position:'fixed', bottom:96, right:24, width:340, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:18, zIndex:1001, overflow:'hidden', boxShadow:'0 16px 48px rgba(0,0,0,.5)', animation:'_swopen .25s ease' }}>
          <style>{`@keyframes _swopen{from{transform:scale(.9) translateY(10px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}`}</style>

          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', padding:'16px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontWeight:800, color:'#fff', fontSize:'1rem' }}>💬 Customer Support</div>
              <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.7)', marginTop:2 }}>We typically respond within 24 hours</div>
            </div>
            <button onClick={close} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:'50%', width:28, height:28, cursor:'pointer', fontSize:'.85rem' }}>✕</button>
          </div>

          {/* Tab bar */}
          {user&&(
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
              {['form','tickets'].map(v=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{ flex:1, padding:'10px 0', border:'none', background:view===v?'var(--surface2)':'var(--surface)', cursor:'pointer', fontSize:'.82rem', fontWeight:600, color:view===v?'var(--text)':'var(--text3)', borderBottom:view===v?'2px solid var(--accent)':'2px solid transparent' }}>
                  {v==='form'?'New Ticket':'My Tickets'}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding:18, maxHeight:380, overflowY:'auto' }}>

            {view==='form'&&(
              submitted ? (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <div style={{ fontSize:'3rem', marginBottom:10 }}>✅</div>
                  <div style={{ fontWeight:700, marginBottom:6 }}>Ticket Submitted!</div>
                  <div style={{ fontSize:'.82rem', color:'var(--text3)', marginBottom:16 }}>Our team will respond within 24 hours.</div>
                  <button className="btn btn-secondary btn-sm" onClick={reset}>Submit Another</button>
                </div>
              ) : (
                <>
                  {error&&<div style={{ fontSize:'.78rem',color:'#ef4444',background:'rgba(239,68,68,.1)',borderRadius:8,padding:'8px 10px',marginBottom:12 }}>⚠️ {error}</div>}
                  {!user&&(
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize:'.78rem' }}>Your Email</label>
                      <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={{ fontSize:'.85rem' }} />
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize:'.78rem' }}>Subject</label>
                    <input className="form-input" placeholder="What's the issue?" value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} style={{ fontSize:'.85rem' }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize:'.78rem' }}>Priority</label>
                    <select className="form-input" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{ fontSize:'.85rem' }}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize:'.78rem' }}>Message</label>
                    <textarea className="form-input" rows={3} placeholder="Describe your issue in detail…" value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} style={{ fontSize:'.85rem',resize:'vertical' }} />
                  </div>
                  <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={loading}>
                    {loading?'Submitting…':'📤 Submit Ticket'}
                  </button>
                </>
              )
            )}

            {view==='tickets'&&(
              <div>
                {!myTickets ? (
                  <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text3)' }}>Loading…</div>
                ) : myTickets.length===0 ? (
                  <div style={{ textAlign:'center', padding:'20px 0' }}>
                    <div style={{ fontSize:'2rem', marginBottom:8 }}>🎫</div>
                    <div style={{ color:'var(--text3)', fontSize:'.85rem' }}>No tickets yet</div>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop:10 }} onClick={()=>setView('form')}>Create Ticket</button>
                  </div>
                ) : myTickets.map((t,i)=>(
                  <div key={i} style={{ background:'var(--surface2)', borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <div style={{ fontWeight:600, fontSize:'.85rem' }}>{t.subject}</div>
                      <span style={{ fontSize:'.7rem', padding:'2px 8px', borderRadius:50, background:`${statusColors[t.status]}20`, color:statusColors[t.status]||'var(--text3)', fontWeight:600 }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize:'.75rem', color:'var(--text3)', marginBottom:4 }}>{new Date(t.created_at).toLocaleDateString()}</div>
                    {t.admin_reply&&(
                      <div style={{ background:'rgba(108,99,255,.1)', borderRadius:6, padding:'8px 10px', marginTop:8, fontSize:'.8rem' }}>
                        <span style={{ color:'var(--accent)', fontWeight:600 }}>Reply: </span>{t.admin_reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}