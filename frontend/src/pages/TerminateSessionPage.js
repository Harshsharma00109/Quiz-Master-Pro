// PATH: quiz-platform/frontend/src/pages/TerminateSessionPage.js
// Route: /terminate-session?token=xxx&uid=yyy
// This page is opened when user clicks "Terminate This Session" in email
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function PwInput({ value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <input className="form-input" type={show?'text':'password'} placeholder={placeholder||'••••••••'} value={value} autoFocus={autoFocus} onChange={onChange} style={{ paddingRight:44 }} />
      <button type="button" tabIndex={-1} onClick={()=>setShow(v=>!v)}
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'1rem' }}>
        {show?'🙈':'👁'}
      </button>
    </div>
  );
}

export default function TerminateSessionPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { logout } = useAuth();
  const token      = params.get('token');
  const uid        = params.get('uid');

  const [step,       setStep]       = useState('terminate'); // terminate → otp → reset → done
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [email,      setEmail]      = useState('');
  const [otp,        setOtp]        = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [resendKey,  setResendKey]  = useState(0);
  const [countdown,  setCountdown]  = useState(120);

  // Countdown timer for OTP
  useEffect(() => {
    if (step !== 'otp') return;
    setCountdown(120);
    const t = setInterval(() => setCountdown(c => { if(c<=1){ clearInterval(t); return 0; } return c-1; }), 1000);
    return () => clearInterval(t);
  }, [step, resendKey]);

  // Step 1: Terminate session
  const handleTerminate = async () => {
    if (!email.trim()) { setError('Enter your email to confirm.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/terminate-session', { token, uid });
      // Send OTP for password reset
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setStep('otp');
    } catch(e) {
      setError(e.response?.data?.error || 'Failed to terminate. The link may have expired.');
    } finally { setLoading(false); }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/verify-reset-otp', { email: email.trim().toLowerCase(), otp });
      setStep('reset');
    } catch(e) {
      setError(e.response?.data?.error || 'Invalid or expired code.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setResendKey(k => k+1);
      setError('');
    } catch(e) { setError('Failed to resend.'); }
  };

  // Step 3: Reset password
  const handleReset = async () => {
    if (!newPw || newPw.length < 6) { setError('Password min 6 characters.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { email:email.trim().toLowerCase(), otp, password:newPw });
      logout('security');
      setStep('done');
    } catch(e) {
      setError(e.response?.data?.error || 'Failed to reset password.');
    } finally { setLoading(false); }
  };

  const fmt = (n) => `${Math.floor(n/60)}:${(n%60).toString().padStart(2,'0')}`;

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'var(--bg)' }}>
      <div style={{ background:'var(--surface)', border:'1px solid rgba(239,68,68,.3)', borderRadius:20, padding:'40px 32px', width:'100%', maxWidth:440 }}>

        {/* ── STEP: TERMINATE ── */}
        {step === 'terminate' && (
          <>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:'3.5rem', marginBottom:12 }}>🚫</div>
              <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:'1.5rem', fontWeight:800, color:'#ef4444', marginBottom:8 }}>Terminate Session</h1>
              <p style={{ color:'var(--text2)', fontSize:'.9rem', lineHeight:1.6 }}>
                You clicked the "Terminate Session" link from a login alert email. This will immediately invalidate the suspicious session and require a password reset.
              </p>
            </div>

            {error && <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'.85rem', color:'#ef4444' }}>⚠️ {error}</div>}

            <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.2)', borderRadius:12, padding:'16px', marginBottom:20 }}>
              <div style={{ fontSize:'.82rem', color:'var(--text2)', lineHeight:1.6 }}>
                <div style={{ marginBottom:6 }}>✓ Session will be immediately invalidated</div>
                <div style={{ marginBottom:6 }}>✓ You'll receive a verification code</div>
                <div>✓ Set a new secure password</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Your Email Address (to confirm)</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={email} autoFocus onChange={e=>{ setEmail(e.target.value); setError(''); }} />
            </div>

            <button className="btn btn-full" style={{ background:'#ef4444', border:'none', color:'#fff', fontWeight:700, padding:13, borderRadius:10, cursor:'pointer', fontSize:'.95rem' }}
              onClick={handleTerminate} disabled={loading}>
              {loading ? 'Terminating…' : '🚫 Terminate & Secure Account'}
            </button>

            <button className="btn btn-secondary btn-full" style={{ marginTop:10 }} onClick={()=>navigate('/')}>
              Cancel (It was me)
            </button>
          </>
        )}

        {/* ── STEP: OTP ── */}
        {step === 'otp' && (
          <>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:'3rem', marginBottom:8 }}>📧</div>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.3rem', marginBottom:6 }}>Check Your Email</h2>
              <p style={{ color:'var(--text2)', fontSize:'.88rem' }}>
                Verification code sent to <strong style={{ color:'var(--accent)' }}>{email}</strong>
              </p>
            </div>

            {error && <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'.85rem', color:'#ef4444' }}>⚠️ {error}</div>}

            <div className="form-group">
              <label className="form-label">6-Digit Verification Code</label>
              <input className="form-input" type="text" inputMode="numeric" maxLength={6} value={otp} autoFocus placeholder="000000"
                onChange={e => { setOtp(e.target.value.replace(/\D/g,'')); setError(''); }}
                style={{ fontSize:'2rem', letterSpacing:12, textAlign:'center', fontFamily:'monospace', fontWeight:800 }} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:'.77rem' }}>
                <span style={{ color:countdown<30?'#ef4444':'var(--text3)' }}>
                  {countdown > 0 ? `⏱ Expires in ${fmt(countdown)}` : '❌ Code expired'}
                </span>
                <span style={{ color:'var(--accent)', cursor:'pointer', fontWeight:500 }} onClick={handleResend}>Resend code</span>
              </div>
            </div>

            <button className="btn btn-primary btn-full" onClick={handleVerifyOtp} disabled={loading || otp.length!==6}>
              {loading ? 'Verifying…' : 'Verify Code →'}
            </button>
          </>
        )}

        {/* ── STEP: RESET ── */}
        {step === 'reset' && (
          <>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:'3rem', marginBottom:8 }}>🔑</div>
              <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.3rem', marginBottom:6 }}>Set New Password</h2>
              <p style={{ color:'var(--text2)', fontSize:'.88rem' }}>Create a strong password for your account.</p>
            </div>

            {error && <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'.85rem', color:'#ef4444' }}>⚠️ {error}</div>}

            <div className="form-group">
              <label className="form-label">New Password</label>
              <PwInput value={newPw} autoFocus placeholder="At least 6 characters" onChange={e=>{ setNewPw(e.target.value); setError(''); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <PwInput value={confirmPw} placeholder="Re-enter password" onChange={e=>{ setConfirmPw(e.target.value); setError(''); }} />
              {confirmPw && <div style={{ fontSize:'.73rem', marginTop:4, color:newPw===confirmPw?'#00d4aa':'#ef4444' }}>{newPw===confirmPw?'✓ Passwords match':'⚠️ Do not match'}</div>}
            </div>

            <button className="btn btn-primary btn-full" onClick={handleReset} disabled={loading || newPw !== confirmPw}>
              {loading ? 'Updating…' : '🔐 Set New Password'}
            </button>
          </>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{ fontSize:'4rem', marginBottom:16 }}>✅</div>
            <h2 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'1.4rem', marginBottom:8, color:'#00d4aa' }}>Account Secured!</h2>
            <p style={{ color:'var(--text2)', fontSize:'.9rem', marginBottom:8, lineHeight:1.6 }}>
              The suspicious session has been terminated and your password has been updated.
            </p>
            <p style={{ color:'var(--text3)', fontSize:'.82rem', marginBottom:24 }}>
              All other sessions have been logged out for your security.
            </p>
            <button className="btn btn-primary btn-full" onClick={()=>navigate('/')}>
              Sign In Again →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}