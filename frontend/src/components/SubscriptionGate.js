// PATH: quiz-platform/frontend/src/components/SubscriptionGate.js
// Usage:
//   <SubscriptionGate required="pro" feature="Advanced Analytics">
//     <YourComponent />
//   </SubscriptionGate>
//
//   <PremiumFeatureLock required="elite" message="Elite events need Elite subscription" />
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';

const PLAN_CONFIG = {
  pro:   { label:'Pro',   emoji:'⭐', color:'#eab308' },
  elite: { label:'Elite', emoji:'💎', color:'#8b5cf6' },
};

// ── Full page gate — wraps children ──────────────────────
export default function SubscriptionGate({ required = 'pro', feature = 'This feature', children }) {
  const navigate      = useNavigate();
  const { isPro, isElite, isAdmin } = useAuth();

  const hasAccess = isAdmin || (required === 'elite' ? isElite : isPro);
  if (hasAccess) return children;

  const cfg = PLAN_CONFIG[required];

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'50vh', padding:24 }}>
      <div style={{ background:'var(--surface)', border:`1px solid ${cfg.color}44`, borderRadius:20, padding:'40px 32px', maxWidth:400, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:'3.5rem', marginBottom:16 }}>{cfg.emoji}</div>
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.3rem', marginBottom:8 }}>
          {cfg.label} Required
        </div>
        <div style={{ fontSize:'.9rem', color:'var(--text2)', marginBottom:20, lineHeight:1.6 }}>
          <strong>{feature}</strong> requires a {cfg.emoji} {cfg.label} subscription.
        </div>
        <div style={{ background:`${cfg.color}12`, border:`1px solid ${cfg.color}33`, borderRadius:12, padding:'14px 16px', marginBottom:24, fontSize:'.85rem', color:'var(--text2)' }}>
          Upgrade to unlock unlimited access, no ads, advanced features, and more.
        </div>
        <button className="btn btn-full"
          style={{ background:`linear-gradient(135deg,${cfg.color},${cfg.color}cc)`, border:'none', color:'#fff', padding:12, borderRadius:10, cursor:'pointer', fontFamily:'Syne', fontWeight:800, fontSize:'.95rem' }}
          onClick={() => navigate('/subscription')}>
          Upgrade to {cfg.label} →
        </button>
        <button className="btn btn-secondary btn-full" style={{ marginTop:10 }} onClick={() => navigate(-1)}>
          ← Go Back
        </button>
      </div>
    </div>
  );
}

// ── Inline lock badge — shows on locked feature buttons ──
export function PremiumFeatureLock({ required = 'pro', message, onClick }) {
  const navigate = useNavigate();
  const { isPro, isElite, isAdmin } = useAuth();
  const hasAccess = isAdmin || (required === 'elite' ? isElite : isPro);
  if (hasAccess) return null;
  const cfg = PLAN_CONFIG[required];
  return (
    <div onClick={() => onClick ? onClick() : navigate('/subscription')}
      style={{ display:'inline-flex', alignItems:'center', gap:6, background:`${cfg.color}12`, border:`1px solid ${cfg.color}33`, borderRadius:8, padding:'5px 10px', cursor:'pointer', fontSize:'.78rem', color:cfg.color, fontWeight:600 }}>
      {cfg.emoji} {message || `${cfg.label} Required`} — Upgrade →
    </div>
  );
}

// ── Navbar Event button helper ────────────────────────────
// Import and use in Navbar:
//   import { EventNavButton } from './SubscriptionGate';
//   <EventNavButton />
export function EventNavButton() {
  const navigate  = useNavigate();
  const { isAdmin } = useAuth();
  return (
    <button onClick={() => navigate('/events')}
      style={{ background:'linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.15))', border:'1px solid rgba(108,99,255,.3)', borderRadius:8, padding:'6px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:'.82rem', fontWeight:600, color:'var(--accent)', transition:'all .2s' }}
      onMouseEnter={e => { e.currentTarget.style.background='rgba(108,99,255,.25)'; }}
      onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.15))'; }}>
      🎉 Events {isAdmin && <span style={{ fontSize:'.65rem', background:'rgba(108,99,255,.3)', borderRadius:4, padding:'1px 4px' }}>Admin</span>}
    </button>
  );
}