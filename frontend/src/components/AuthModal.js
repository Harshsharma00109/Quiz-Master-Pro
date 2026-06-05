// PATH: quiz-platform/frontend/src/components/AuthModal.js
import React, { useState, useRef, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api          from '../utils/api';
import styles       from './Modal.module.css';

function getStrength(pw) {
  if (!pw) return null;
  const checks = [pw.length>=8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[!@#$%^&*]/.test(pw), pw.length>=12];
  const score  = checks.filter(Boolean).length;
  const hints  = [];
  if (!checks[0]) hints.push('At least 8 characters');
  if (!checks[1]) hints.push('One uppercase letter');
  if (!checks[2]) hints.push('One number');
  if (!checks[3]) hints.push('One special character');
  const levels = [
    { label:'Very Weak',  color:'#ef4444', pct:20  },
    { label:'Weak',       color:'#f97316', pct:40  },
    { label:'Fair',       color:'#eab308', pct:60  },
    { label:'Strong',     color:'#22c55e', pct:80  },
    { label:'Very Strong',color:'#00d4aa', pct:100 },
  ];
  return { score, hints, level:levels[Math.min(score,4)] };
}

function StrengthMeter({ pw }) {
  const s = getStrength(pw);
  if (!s || !pw) return null;
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ height:4, background:'rgba(255,255,255,.1)', borderRadius:2, overflow:'hidden', marginBottom:5 }}>
        <div style={{ height:'100%', width:`${s.level.pct}%`, background:s.level.color, borderRadius:2, transition:'width .3s' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:'.73rem', color:s.level.color, fontWeight:600 }}>{s.level.label}</span>
        <span style={{ fontSize:'.73rem', color:'#475569' }}>{s.score}/5</span>
      </div>
      {s.hints.map((h,i) => (
        <div key={i} style={{ fontSize:'.72rem', color:'#475569', display:'flex', gap:5, marginBottom:2 }}>
          <span style={{ color:'#ef4444' }}>✕</span>{h}
        </div>
      ))}
      {!s.hints.length && <div style={{ fontSize:'.72rem', color:'#00d4aa' }}>✓ Strong password!</div>}
    </div>
  );
}

function ErrBox({ error }) {
  if (!error) return null;
  return (
    <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'.85rem', color:'#ef4444', display:'flex', gap:8, alignItems:'flex-start' }}>
      <span style={{ flexShrink:0 }}>⚠️</span><span>{error}</span>
    </div>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

function PwInput({ value, onChange, placeholder='••••••••', autoFocus, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:'relative' }}>
      <input className="form-input" type={show?'text':'password'} placeholder={placeholder} value={value}
        autoComplete={autoComplete} autoFocus={autoFocus} style={{ paddingRight:44 }} onChange={onChange} />
      <button type="button" tabIndex={-1} onClick={() => setShow(v => !v)}
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'1rem', padding:0 }}>
        {show ? '🙈' : '👁'}
      </button>
    </div>
  );
}

function OtpTimer({ onExpire, onResend }) {
  const [secs, setSecs] = useState(120);
  useEffect(() => { setSecs(120); }, [onResend]);
  useEffect(() => {
    if (secs <= 0) { onExpire?.(); return; }
    const t = setInterval(() => setSecs(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [secs]); // eslint-disable-line
  const m = Math.floor(secs/60), s = (secs%60).toString().padStart(2,'0');
  return (
    <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
      <span style={{ fontSize:'.77rem', color:secs<30?'#ef4444':'#475569', fontWeight:secs<30?600:400 }}>
        {secs > 0 ? `⏱ ${m}:${s}` : '❌ Expired'}
      </span>
      <span style={{ fontSize:'.77rem', color:'#6366f1', cursor:'pointer', fontWeight:500 }} onClick={onResend}>Resend code</span>
    </div>
  );
}

function useUsernameCheck(username, isLogin) {
  const [status, setStatus] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    if (isLogin || !username || username.length < 3) { setStatus(null); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setStatus('invalid'); return; }
    setStatus('checking');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/auth/check-username/${username}`);
        setStatus(data.available ? 'available' : 'taken');
      } catch { setStatus(null); }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [username, isLogin]);
  return status;
}

export default function AuthModal({ mode, onClose, onSwitch }) {
  const { login, loginWithToken } = useAuth();
  const { toast }  = useToast();
  const isLogin    = mode === 'login';

  const [step,        setStep]        = useState('form');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [expired,     setExpired]     = useState(false);
  const [resendKey,   setResendKey]   = useState(0);
  const [regPw,       setRegPw]       = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [rememberMe,  setRememberMe]  = useState(false);
  const [loginEmail,  setLoginEmail]  = useState('');
  const [loginPw,     setLoginPw]     = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail,    setRegEmail]    = useState('');

  const savedReg    = useRef({ username:'', email:'', password:'' });
  const savedForgot = useRef({ email:'', otp:'' });
  const clearErr    = () => setError('');
  const usernameStatus = useUsernameCheck(regUsername, isLogin);

  // ── LOGIN ──────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault(); clearErr();
    if (!loginEmail.trim()) { setError('Email is required.'); return; }
    if (!loginPw)           { setError('Password is required.'); return; }
    setLoading(true);
    const r = await login(loginEmail.trim(), loginPw, rememberMe);
    setLoading(false);
    if (r.ok) {
      toast.success('Welcome back! 👋');
      onClose();
      // NewDevicePopup fires automatically via AuthContext → rendered in App.js
    } else {
      setError(r.error || 'Login failed. Please try again.');
    }
  };

  // ── REGISTER: send OTP ─────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault(); clearErr();
    const u = regUsername.trim(), em = regEmail.trim().toLowerCase(), pw = regPw;
    if (!u || u.length < 3)          { setError('Username must be at least 3 characters.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) { setError('Username: letters, numbers, underscores only.'); return; }
    if (usernameStatus === 'taken')  { setError('This username is already taken.'); return; }
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError('Enter a valid email address.'); return; }
    if (!pw || pw.length < 6)        { setError('Password must be at least 6 characters.'); return; }
    savedReg.current = { username:u, email:em, password:pw };
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { username:u, email:em, password:pw });
      setOtp(''); setExpired(false); setResendKey(0); setStep('otp');
      toast.success('Verification code sent to your email! 📧');
    } catch(ex) { setError(ex.response?.data?.error || 'Failed to send code.'); }
    finally { setLoading(false); }
  };

  const handleResendRegOtp = async () => {
    clearErr(); setOtp(''); setLoading(true);
    try { await api.post('/auth/send-otp', savedReg.current); setExpired(false); setResendKey(k=>k+1); toast.success('New code sent!'); }
    catch(ex) { setError(ex.response?.data?.error || 'Failed to resend.'); }
    finally { setLoading(false); }
  };

  // ── REGISTER: verify OTP → enter app ──────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault(); clearErr();
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    if (expired)                  { setError('Code expired. Click Resend.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email:savedReg.current.email, otp });
      // ✅ loginWithToken sets user in context instantly — no second API call needed
      loginWithToken(data.token, data.user, rememberMe);
      toast.success('Account created! Welcome 🎉');
      onClose();
    } catch(ex) {
      setError(ex.response?.data?.error || 'Invalid or expired code.');
    } finally { setLoading(false); }
  };

  // ── FORGOT: send OTP ───────────────────────────────────
  const handleForgotSend = async (e) => {
    e.preventDefault(); clearErr();
    const em = forgotEmail.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError('Enter a valid email address.'); return; }
    savedForgot.current.email = em;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email:em });
      setOtp(''); setExpired(false); setResendKey(0); setStep('forgot-otp');
      toast.success('Reset code sent! 📧');
    } catch(ex) { setError(ex.response?.data?.error || 'Failed to send reset code.'); }
    finally { setLoading(false); }
  };

  const handleResendForgotOtp = async () => {
    clearErr(); setOtp(''); setLoading(true);
    try { await api.post('/auth/forgot-password', { email:savedForgot.current.email }); setExpired(false); setResendKey(k=>k+1); toast.success('New code sent!'); }
    catch(ex) { setError(ex.response?.data?.error || 'Failed to resend.'); }
    finally { setLoading(false); }
  };

  const handleForgotVerify = async (e) => {
    e.preventDefault(); clearErr();
    if (!otp || otp.length !== 6) { setError('Enter the 6-digit code.'); return; }
    if (expired)                  { setError('Code expired. Click Resend.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/verify-reset-otp', { email:savedForgot.current.email, otp });
      savedForgot.current.otp = otp; setNewPw(''); setConfirmPw(''); setStep('reset');
    } catch(ex) { setError(ex.response?.data?.error || 'Invalid code.'); }
    finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault(); clearErr();
    if (!newPw || newPw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw)        { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email:savedForgot.current.email, otp:savedForgot.current.otp, password:newPw });
      setStep('success');
    } catch(ex) { setError(ex.response?.data?.error || 'Failed to reset password.'); }
    finally { setLoading(false); }
  };

  if (step === 'success') return (
    <Overlay onClose={onClose}>
      <div className={styles.modal} style={{ textAlign:'center' }}>
        <div style={{ fontSize:'4rem', marginBottom:12 }}>✅</div>
        <div className={styles.title}>Password Changed!</div>
        <div className={styles.sub} style={{ marginBottom:24 }}>You can now sign in with your new password.</div>
        <button className="btn btn-primary btn-full" onClick={() => { setStep('form'); onSwitch('login'); }}>Sign In Now →</button>
      </div>
    </Overlay>
  );

  if (step === 'reset') return (
    <Overlay onClose={onClose}><div className={styles.modal}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div style={{ fontSize:'2rem', marginBottom:8 }}>🔑</div>
      <div className={styles.title}>Set New Password</div>
      <ErrBox error={error} />
      <form onSubmit={handleReset}>
        <div className="form-group"><label className="form-label">New Password</label>
          <PwInput value={newPw} autoFocus autoComplete="new-password" placeholder="At least 6 characters" onChange={e=>{ setNewPw(e.target.value); clearErr(); }} />
          <StrengthMeter pw={newPw} /></div>
        <div className="form-group"><label className="form-label">Confirm Password</label>
          <PwInput value={confirmPw} autoComplete="new-password" placeholder="Re-enter password" onChange={e=>{ setConfirmPw(e.target.value); clearErr(); }} />
          {confirmPw && <div style={{ fontSize:'.73rem', marginTop:4, color:newPw===confirmPw?'#00d4aa':'#ef4444' }}>{newPw===confirmPw?'✓ Passwords match':'⚠️ Do not match'}</div>}
        </div>
        <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading?'Updating…':'🔐 Update Password'}</button>
      </form>
    </div></Overlay>
  );

  if (step === 'forgot-otp') return (
    <Overlay onClose={onClose}><div className={styles.modal}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div style={{ fontSize:'2rem', marginBottom:8 }}>📧</div>
      <div className={styles.title}>Enter Reset Code</div>
      <div className={styles.sub}>Sent to <strong style={{ color:'#6366f1' }}>{savedForgot.current.email}</strong></div>
      <ErrBox error={error} />
      <form onSubmit={handleForgotVerify}>
        <div className="form-group"><label className="form-label">6-Digit Code</label>
          <input className="form-input" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} autoFocus
            onChange={e=>{ setOtp(e.target.value.replace(/\D/g,'')); clearErr(); }}
            style={{ fontSize:'2rem', letterSpacing:12, textAlign:'center', fontFamily:'monospace', fontWeight:800 }} />
          <OtpTimer key={resendKey} onExpire={()=>setExpired(true)} onResend={handleResendForgotOtp} />
        </div>
        <button className="btn btn-primary btn-full" type="submit" disabled={loading||expired}>{loading?'Verifying…':'Verify Code →'}</button>
      </form>
      <button className="btn btn-secondary btn-full" style={{ marginTop:10 }} onClick={()=>{ setStep('forgot'); clearErr(); }}>← Change Email</button>
    </div></Overlay>
  );

  if (step === 'forgot') return (
    <Overlay onClose={onClose}><div className={styles.modal}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div style={{ fontSize:'2rem', marginBottom:8 }}>🔒</div>
      <div className={styles.title}>Forgot Password?</div>
      <div className={styles.sub}>Enter your registered email.</div>
      <ErrBox error={error} />
      <form onSubmit={handleForgotSend}>
        <div className="form-group"><label className="form-label">Email Address</label>
          <input className="form-input" type="email" placeholder="you@example.com" value={forgotEmail} autoFocus autoComplete="email"
            onChange={e=>{ setForgotEmail(e.target.value); clearErr(); }} />
        </div>
        <button className="btn btn-primary btn-full" type="submit" disabled={loading}>{loading?'Sending…':'📧 Send Reset Code'}</button>
      </form>
      <button className="btn btn-secondary btn-full" style={{ marginTop:10 }} onClick={()=>{ setStep('form'); clearErr(); onSwitch('login'); }}>← Back to Sign In</button>
    </div></Overlay>
  );

  if (!isLogin && step === 'otp') return (
    <Overlay onClose={onClose}><div className={styles.modal}>
      <button className={styles.close} onClick={onClose}>✕</button>
      <div style={{ fontSize:'2rem', marginBottom:8 }}>📧</div>
      <div className={styles.title}>Verify Your Email</div>
      <div className={styles.sub}>Code sent to <strong style={{ color:'#6366f1' }}>{savedReg.current.email}</strong><br/>
        <span style={{ fontSize:'.75rem', color:'#475569' }}>Check spam if not received</span></div>
      <ErrBox error={error} />
      <form onSubmit={handleVerifyOtp}>
        <div className="form-group"><label className="form-label">Enter 6-Digit Code</label>
          <input className="form-input" type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} autoFocus
            onChange={e=>{ setOtp(e.target.value.replace(/\D/g,'')); clearErr(); }}
            style={{ fontSize:'2rem', letterSpacing:12, textAlign:'center', fontFamily:'monospace', fontWeight:800 }} />
          <OtpTimer key={resendKey} onExpire={()=>setExpired(true)} onResend={handleResendRegOtp} />
        </div>
        <button className="btn btn-primary btn-full" type="submit" disabled={loading||expired}>{loading?'Creating account…':'✓ Verify & Create Account'}</button>
      </form>
      <button className="btn btn-secondary btn-full" style={{ marginTop:10 }} onClick={()=>{ setStep('form'); clearErr(); setOtp(''); }}>← Change Details</button>
    </div></Overlay>
  );

  return (
    <Overlay onClose={onClose}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose}>✕</button>
        <div className={styles.title}>{isLogin ? 'Welcome back 👋' : 'Create your account'}</div>
        <div className={styles.sub}>{isLogin ? 'Sign in to access your quizzes and history' : "Join QuizMaster Pro — it's free"}</div>
        <ErrBox error={error} />

        {isLogin && (
          <form onSubmit={handleLogin} noValidate autoComplete="on">
            <div className="form-group"><label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={loginEmail} autoFocus autoComplete="email"
                onChange={e=>{ setLoginEmail(e.target.value); clearErr(); }} />
            </div>
            <div className="form-group">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                <label className="form-label" style={{ marginBottom:0 }}>Password</label>
                <span style={{ fontSize:'.78rem', color:'#6366f1', cursor:'pointer', fontWeight:500 }} onClick={()=>{ setStep('forgot'); clearErr(); }}>Forgot password?</span>
              </div>
              <PwInput value={loginPw} autoComplete="current-password" onChange={e=>{ setLoginPw(e.target.value); clearErr(); }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, margin:'10px 0 16px' }}>
              <input id="rm" type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} style={{ width:15, height:15, accentColor:'#6366f1', cursor:'pointer' }} />
              <label htmlFor="rm" style={{ fontSize:'.83rem', color:'#94a3b8', cursor:'pointer' }}>Remember me</label>
              <span style={{ fontSize:'.73rem', color:'#475569', marginLeft:'auto' }}>{rememberMe?'✓ Stays logged in':'Session only'}</span>
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite', display:'inline-block' }} />Signing in…</span> : 'Sign In →'}
            </button>
          </form>
        )}

        {!isLogin && step === 'form' && (
          <form onSubmit={handleSendOtp} noValidate autoComplete="on">
            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={{ position:'relative' }}>
                <input className="form-input" type="text" placeholder="Letters, numbers, underscores" value={regUsername} autoFocus autoComplete="username" style={{ paddingRight:36 }}
                  onChange={e=>{ setRegUsername(e.target.value); clearErr(); }} />
                {usernameStatus && <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:'.9rem' }}>
                  {usernameStatus==='checking'&&'⏳'}{usernameStatus==='available'&&'✅'}{usernameStatus==='taken'&&'❌'}{usernameStatus==='invalid'&&'⚠️'}
                </span>}
              </div>
              {usernameStatus==='available'&&<div style={{ fontSize:'.72rem', color:'#00d4aa', marginTop:3 }}>✓ Username available</div>}
              {usernameStatus==='taken'&&<div style={{ fontSize:'.72rem', color:'#ef4444', marginTop:3 }}>✕ Username already taken</div>}
              {usernameStatus==='invalid'&&<div style={{ fontSize:'.72rem', color:'#ef4444', marginTop:3 }}>Only letters, numbers and underscores</div>}
            </div>
            <div className="form-group"><label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={regEmail} autoComplete="email"
                onChange={e=>{ setRegEmail(e.target.value); clearErr(); }} />
            </div>
            <div className="form-group"><label className="form-label">Password</label>
              <PwInput value={regPw} autoComplete="new-password" placeholder="At least 6 characters" onChange={e=>{ setRegPw(e.target.value); clearErr(); }} />
              <StrengthMeter pw={regPw} />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading||usernameStatus==='taken'} style={{ marginTop:8 }}>
              {loading?'Sending code…':'📧 Continue with Email Verification →'}
            </button>
            <p style={{ textAlign:'center', fontSize:'.73rem', color:'#475569', marginTop:8 }}>A 6-digit code (valid 2 min) will be sent to your email</p>
          </form>
        )}

        <div className="divider">or</div>
        <p style={{ textAlign:'center', fontSize:'.85rem', color:'#94a3b8' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span style={{ color:'#6366f1', cursor:'pointer', fontWeight:600 }}
            onClick={()=>{ onSwitch(isLogin?'register':'login'); clearErr(); setStep('form'); setRegPw(''); setLoginEmail(''); setLoginPw(''); }}>
            {isLogin ? 'Create one free' : 'Sign in'}
          </span>
        </p>
      </div>
    </Overlay>
  );
}