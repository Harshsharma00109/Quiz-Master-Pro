// PATH: quiz-platform/frontend/src/pages/SubscriptionPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import api             from '../utils/api';
import SubscriptionPaymentModal from '../components/SubscriptionPaymentModal';

const PLANS = [
  {
    id:'free', name:'Free', icon:'📖', color:'var(--text3)', bg:'var(--surface)',
    features:['5 AI quizzes/day','Basic streak tracking','2 streak freezes/month','Public quiz access'],
    missing:['Unlimited AI quizzes','No ads','Advanced analytics','Pro badge'],
  },
  {
    id:'pro', name:'Pro', icon:'⭐', color:'#eab308', bg:'rgba(234,179,8,.06)',
    monthly:299, yearly:2390, badge:'🔥 POPULAR',
    features:['Unlimited AI quizzes','No ads','Advanced analytics','5 streak freezes/month','⭐ Pro badge'],
    missing:['Elite events','XP multiplier'],
  },
  {
    id:'elite', name:'Elite', icon:'💎', color:'#8b5cf6', bg:'rgba(139,92,246,.06)',
    monthly:599, yearly:4790, badge:'💎 BEST',
    features:['All Pro features','Exclusive event quizzes','10 streak freezes/month','💎 Elite badge + XP 2×','AI study roadmap','Priority support'],
    missing:[],
  },
];

export default function SubscriptionPage() {
  const navigate        = useNavigate();
  const { user, refreshUser } = useAuth();
  const [current,       setCurrent]     = useState('free');
  const [billing,       setBilling]     = useState('monthly');
  const [selectedPlan,  setSelectedPlan]= useState(null); // triggers modal
  const [quota,         setQuota]       = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get('/auth/me').then(r => setCurrent(r.data?.subscription_plan||'free')).catch(()=>{});
    api.get('/ai/quota').then(r => setQuota(r.data)).catch(()=>{});
  }, [user]);

  const getPrice = plan => {
    if (!plan.monthly) return 'Free';
    return `₹${billing==='yearly'?plan.yearly:plan.monthly}`;
  };
  const getSaving = plan => {
    if (!plan.monthly || billing!=='yearly') return null;
    return `₹${Math.round(plan.monthly*12 - plan.yearly)} saved`;
  };

  const handleSuccess = async () => {
    await refreshUser();
    api.get('/auth/me').then(r => setCurrent(r.data?.subscription_plan||'free')).catch(()=>{});
    api.get('/ai/quota').then(r => setQuota(r.data)).catch(()=>{});
  };

  return (
    <div className="page-enter section-sm">
      {selectedPlan && (
        <SubscriptionPaymentModal
          plan={selectedPlan}
          billing={billing}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => { handleSuccess(); setSelectedPlan(null); }}
        />
      )}

      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:28 }}>
        <button className="btn btn-secondary btn-sm" onClick={()=>navigate('/profile')}>← Profile</button>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.8rem', fontWeight:800 }}>💎 Subscription Plans</h1>
          <p style={{ color:'var(--text2)', fontSize:'.88rem', marginTop:2 }}>Unlock the full QuizMaster Pro experience</p>
        </div>
      </div>

      {/* AI quota warning */}
      {quota && !quota.allowed && current==='free' && (
        <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <span style={{ fontSize:'.88rem' }}>🚫 Daily AI limit reached ({quota.limit}/day on Free plan)</span>
          <span style={{ fontSize:'.78rem', color:'#ef4444', fontWeight:600 }}>Upgrade for unlimited →</span>
        </div>
      )}

      {/* Billing toggle */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:28 }}>
        <div style={{ display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:50, padding:4 }}>
          {['monthly','yearly'].map(b=>(
            <button key={b} onClick={()=>setBilling(b)}
              style={{ padding:'8px 24px', borderRadius:50, border:'none', cursor:'pointer', fontSize:'.88rem', fontWeight:600,
                background:billing===b?'var(--accent)':'transparent', color:billing===b?'#fff':'var(--text2)' }}>
              {b.charAt(0).toUpperCase()+b.slice(1)}
              {b==='yearly'&&<span style={{ marginLeft:5, fontSize:'.68rem', color:billing==='yearly'?'#00d4aa':'#00d4aa', fontWeight:700 }}>-20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16, marginBottom:36 }}>
        {PLANS.map(plan=>{
          const isCurrent = current===plan.id;
          return (
            <div key={plan.id} style={{ background:plan.bg, border:`2px solid ${isCurrent?plan.color:plan.id==='elite'?'rgba(139,92,246,.3)':plan.id==='pro'?'rgba(234,179,8,.25)':'var(--border)'}`, borderRadius:18, padding:'22px 20px', display:'flex', flexDirection:'column', position:'relative' }}>
              {plan.badge&&<div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:plan.color, color:'#fff', fontSize:'.68rem', fontWeight:800, padding:'3px 14px', borderRadius:50, whiteSpace:'nowrap' }}>{plan.badge}</div>}
              {isCurrent&&<div style={{ position:'absolute', top:14, right:14, background:'rgba(0,212,170,.15)', border:'1px solid rgba(0,212,170,.3)', borderRadius:50, padding:'2px 10px', fontSize:'.65rem', color:'#00d4aa', fontWeight:700 }}>✓ CURRENT</div>}

              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:'1.8rem', marginBottom:6 }}>{plan.icon}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.1rem', color:plan.color }}>{plan.name}</div>
                <div style={{ fontFamily:'Syne,sans-serif', fontWeight:900, fontSize:'2rem', color:'var(--text)', marginTop:4 }}>{getPrice(plan)}</div>
                {billing==='monthly'&&plan.monthly&&<div style={{ fontSize:'.72rem', color:'var(--text3)', marginTop:2 }}>/month</div>}
                {billing==='yearly'&&plan.yearly&&<div style={{ fontSize:'.72rem', color:'#00d4aa', marginTop:2 }}>≈ ₹{Math.round(plan.yearly/12)}/mo · {getSaving(plan)}</div>}
              </div>

              <div style={{ flex:1, marginBottom:16 }}>
                {plan.features.map((f,i)=>(
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:7, fontSize:'.83rem' }}><span style={{ color:'#00d4aa', flexShrink:0 }}>✓</span>{f}</div>
                ))}
                {plan.missing?.map((f,i)=>(
                  <div key={i} style={{ display:'flex', gap:8, marginBottom:7, fontSize:'.83rem', opacity:.4 }}><span style={{ flexShrink:0 }}>✕</span>{f}</div>
                ))}
              </div>

              <button
                className="btn btn-full"
                style={{ padding:12, fontSize:'.9rem', fontWeight:700, borderRadius:10, cursor:isCurrent?'default':'pointer', border:'none',
                  background:isCurrent?'rgba(255,255,255,.05)':`linear-gradient(135deg,${plan.color},${plan.color}cc)`,
                  color:isCurrent?'var(--text3)':'#fff' }}
                disabled={isCurrent}
                onClick={() => plan.monthly && !isCurrent && setSelectedPlan(plan.id)}>
                {isCurrent ? '✓ Current Plan' : plan.monthly ? `Upgrade to ${plan.name} →` : 'Free Plan'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, marginBottom:16 }}>❓ FAQ</div>
        {[
          ['How do I pay?', `Scan the UPI QR code or use UPI ID: ${/* imported from modal */  '7015097910@ybl'} via PhonePe, Google Pay, Paytm.`],
          ['When will my plan activate?', 'Immediately after you submit your UPI transaction reference number.'],
          ['Can I cancel anytime?', 'Yes — your plan stays active until the billing period ends.'],
          ['Do I lose my data if I downgrade?', 'No — all quiz history, badges, and streaks are kept forever.'],
        ].map(([q,a],i)=>(
          <div key={i} style={{ marginBottom:i<3?16:0 }}>
            <div style={{ fontWeight:600, fontSize:'.88rem', marginBottom:4 }}>{q}</div>
            <div style={{ fontSize:'.82rem', color:'var(--text3)', lineHeight:1.6 }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}