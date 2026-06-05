// PATH: quiz-platform/frontend/src/pages/AIQuizPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate }    from 'react-router-dom';
import { useAuth }        from '../context/AuthContext';
import { useToast }       from '../context/ToastContext';
import { useLanguage }    from '../context/LanguageContext';
import ScoreRing          from '../components/ScoreRing';
import HintButton         from '../components/HintButton';
import useProctoring      from '../hooks/useProctoring';
import ProctoringWarning, { ProctoringAutoSubmit } from '../components/ProctoringWarning';
import CameraMonitor      from '../components/CameraMonitor';
import { formatTime, getScoreMessage, shuffle, RANDOM_TOPICS } from '../utils/helpers';
import styles from './AIQuizPage.module.css';

const OPTION_LETTERS = ['A','B','C','D'];
const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;
const STATUS_MSGS = ['Connecting to AI…','Analyzing your topic…','Crafting unique questions…','Writing answer options…','Adding explanations…','Personalizing for you…','Almost ready…'];

// ── Translate all questions via backend /api/translate ─────────────────────
// Uses the server's Groq key — no REACT_APP_GROQ_API_KEY needed in frontend.
// languageName = full name like "Português", "हिन्दी" — Groq understands these.
async function translateAllQuestions(questions, languageName) {
  if (!questions?.length || !languageName || languageName === 'English') return questions;

  try {
    const OPTS   = 4;
    const STRIDE = 1 + OPTS + 1; // question_text + 4 options + explanation
    const flat   = [];

    questions.forEach(q => {
      flat.push(q.question_text || '');
      for (let i = 0; i < OPTS; i++) flat.push(q.options?.[i] || '');
      flat.push(q.explanation || '');
    });

    const res = await fetch(`${BASE}/translate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ texts: flat, targetLang: languageName }),
    });

    if (!res.ok) throw new Error(`Translate API ${res.status}`);
    const data = await res.json();
    const translated = data.translated || flat;

    return questions.map((q, i) => {
      const base = i * STRIDE;
      return {
        ...q,
        question_text: translated[base]                     || q.question_text,
        options:       translated.slice(base + 1, base + 1 + OPTS).map((t, oi) => t || q.options?.[oi] || ''),
        explanation:   translated[base + 1 + OPTS]          || q.explanation || '',
      };
    });

  } catch (err) {
    console.warn('[translateAllQuestions] failed, showing original:', err.message);
    return questions; // graceful fallback — quiz still works in English
  }
}

export default function AIQuizPage() {
  const navigate        = useNavigate();
  const { user, token } = useAuth();
  const { toast }       = useToast();
  // languageName = "Português", "हिन्दी" etc — used for translation
  // language     = "pt", "hi" etc — used for English check
  const { t, language, languageName } = useLanguage();

  const [coins,          setCoins]          = useState(user?.coins || 0);
  const [phase,          setPhase]          = useState('setup');
  const [topic,          setTopic]          = useState('');
  const [count,          setCount]          = useState(5);
  const [diff,           setDiff]           = useState('medium');
  const [profile,        setProfile]        = useState({});
  const [profileStep,    setProfileStep]    = useState(0);
  const [statusIdx,      setStatusIdx]      = useState(0);
  const [quiz,           setQuiz]           = useState(null);
  const [translatedQuiz, setTranslatedQuiz] = useState(null);
  const [errorMsg,       setErrorMsg]       = useState('');
  const [currentQ,       setCurrentQ]       = useState(0);
  const [answers,        setAnswers]        = useState([]);
  const [selected,       setSelected]       = useState(null);
  const [revealed,       setRevealed]       = useState(false);
  const [startTime,      setStartTime]      = useState(null);
  const [resultData,     setResultData]     = useState(null);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [translating,    setTranslating]    = useState(false);

  const answersRef       = useRef(answers);
  const selectedRef      = useRef(selected);
  const currentQRef      = useRef(currentQ);
  const startTimeRef     = useRef(startTime);
  const quizRef          = useRef(quiz);
  const diffRef          = useRef(diff);
  const autoSubmittingRef= useRef(autoSubmitting);

  useEffect(() => { answersRef.current       = answers;       }, [answers]);
  useEffect(() => { selectedRef.current      = selected;      }, [selected]);
  useEffect(() => { currentQRef.current      = currentQ;      }, [currentQ]);
  useEffect(() => { startTimeRef.current     = startTime;     }, [startTime]);
  useEffect(() => { quizRef.current          = quiz;          }, [quiz]);
  useEffect(() => { diffRef.current          = diff;          }, [diff]);
  useEffect(() => { autoSubmittingRef.current= autoSubmitting;}, [autoSubmitting]);

  // ── Re-translate questions when language changes ────────────────────────
  useEffect(() => {
    if (!quiz?.questions?.length) return;
    if (language === 'en') { setTranslatedQuiz(quiz); return; }

    let cancelled = false;
    setTranslating(true);

    // Pass full language name so Groq understands it ("Português" not "pt")
    translateAllQuestions(quiz.questions, languageName).then(translated => {
      if (!cancelled) {
        setTranslatedQuiz({ ...quiz, questions: translated });
        setTranslating(false);
      }
    });

    return () => { cancelled = true; };
  }, [quiz, language, languageName]); // eslint-disable-line

  const {
    startSession, endSession,
    warningCount, showWarningOverlay, dismissWarning,
    isActive: proctoringActive,
    cameraReady, motionLevel, faceStatus, lastViolationType,
    videoRef,
  } = useProctoring();

  useEffect(() => { if (user?.coins != null) setCoins(user.coins); }, [user?.coins]);
  useEffect(() => {
    const h = (e) => { if (e.detail?.coins != null) setCoins(e.detail.coins); };
    window.addEventListener('coinsUpdated', h);
    return () => window.removeEventListener('coinsUpdated', h);
  }, []);

  useEffect(() => {
    if (phase === 'taking' && quiz) {
      startSession(0);
      setAutoSubmitting(false);
    }
    return () => { if (phase === 'taking') endSession(null, false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, quiz?.title]);

  const PROFILE_QUESTIONS = [
    { id:'age_group', text: t('quiz_question') + ' 1', options:['Under 18','18–25','26–35','36–50','50+'] },
    { id:'expertise', text: t('quiz_difficulty'),       options:[t('quiz_easy'), t('quiz_medium'), t('quiz_hard'), 'Expert'] },
    { id:'interests', text: t('ai_topic_search'),       options:['Science & Tech','History & Culture','Sports & Entertainment','Arts & Literature'] },
    { id:'pace',      text: t('quiz_difficulty'),       options:[t('quiz_easy'), t('quiz_medium'), t('quiz_hard'), 'Mix'] },
  ];

  const triggerFinish = useCallback(async (isAutoSubmit = false) => {
    const currentAnswers = [...answersRef.current];
    const cq             = currentQRef.current;
    const sel            = selectedRef.current;
    const currentQuiz    = quizRef.current;
    const currentDiff    = diffRef.current;
    if (!currentQuiz) return;
    if (sel !== null && currentAnswers[cq] === null) currentAnswers[cq] = sel;
    // Always score against raw quiz.questions (correct_answer is an index — never translates)
    const score = currentAnswers.reduce((acc, ans, i) => acc + (ans === currentQuiz.questions?.[i]?.correct_answer ? 1 : 0), 0);
    const timeTaken = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    endSession(null, isAutoSubmit).catch(() => {});
    setResultData({ score, total: currentQuiz.questions.length, timeTaken, finalAnswers: currentAnswers, autoSubmitted: isAutoSubmit });
    setPhase('results');
    if (user) {
      // Always save raw English questions to backend — not translated ones
      fetch(`${BASE}/ai/save-attempt`, {
        method:'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token || localStorage.getItem('qm_token')}` },
        body: JSON.stringify({ title:currentQuiz.title, category:currentQuiz.category||'General', difficulty:currentDiff, questions:currentQuiz.questions, score, total_questions:currentQuiz.questions.length, time_taken:timeTaken, answers:currentAnswers }),
      }).catch(e => console.error('save AI attempt:', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  useEffect(() => {
    if (warningCount >= 3 && !autoSubmittingRef.current && phase === 'taking') {
      setAutoSubmitting(true);
      setTimeout(() => triggerFinish(true), 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warningCount]);

  const handleStart = (topicVal, countVal, diffVal) => {
    if (!topicVal.trim()) { toast.error(t('ai_topic_search')); return; }
    setTopic(topicVal.trim()); setCount(parseInt(countVal)||5); setDiff(diffVal);
    setProfile({}); setProfileStep(0); setErrorMsg(''); setPhase('profile');
  };

  const handleProfileAnswer = (val) => {
    const q = PROFILE_QUESTIONS[profileStep];
    const p = { ...profile, [q.id]: val };
    setProfile(p);
    if (profileStep + 1 >= PROFILE_QUESTIONS.length) {
      setPhase('generating');
      generateQuiz(p);
    } else {
      setProfileStep(s => s + 1);
    }
  };

  const generateQuiz = async (prof) => {
    const iv = setInterval(() => setStatusIdx(i => i + 1), 1000);
    try {
      const res = await fetch(`${BASE}/ai/generate-questions`, {
        method:'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ topic, difficulty: diff, count }),
      });
      clearInterval(iv);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || `Server error ${res.status}`); }
      const data = await res.json();
      if (!data.questions?.length) throw new Error(t('error'));
      const newQuiz = { title:`${data.topic} Quiz`, category:'General', difficulty:diff, questions:data.questions };
      setQuiz(newQuiz);
      setTranslatedQuiz(newQuiz); // will be overwritten by the language useEffect if not English
      setAnswers(new Array(data.questions.length).fill(null));
      setCurrentQ(0); setSelected(null); setRevealed(false);
      setStartTime(Date.now()); setResultData(null);
      setPhase('taking');
    } catch (err) {
      clearInterval(iv);
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const handleSelect = (oi) => {
    if (revealed) return;
    setSelected(oi);
    setRevealed(true);
    setAnswers(prev => { const a = [...prev]; a[currentQ] = oi; return a; });
  };

  const handleNext    = () => { setSelected(null); setRevealed(false); setCurrentQ(q => q + 1); };
  const handleFinish  = () => triggerFinish(false);

  const handleSave = async () => {
    if (!user) { toast.info(t('auth_login_title')); return; }
    try {
      const r = await fetch(`${BASE}/quizzes`, {
        method:'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        // Save raw English questions to DB
        body: JSON.stringify({ title:quiz.title, description:`AI quiz about ${topic}`, category:'General', difficulty:diff, is_public:true, questions:quiz.questions }),
      });
      const d = await r.json();
      if (d.id) { toast.success(`${t('done')} 🎉`); navigate(`/quiz/${d.id}`); }
    } catch { toast.error(t('error')); }
  };

  // displayQuiz = translated for rendering; quiz = raw for scoring/saving
  const displayQuiz = translatedQuiz || quiz;

  // ── ERROR ──
  if (phase === 'error') return (
    <div className="page-enter section-xs">
      <div className="card" style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:'3rem', marginBottom:16 }}>⚠️</div>
        <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.2rem', fontWeight:700, marginBottom:8 }}>{t('error')}</div>
        <div style={{ color:'var(--text2)', marginBottom:20, fontSize:'.9rem' }}>{errorMsg}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button className="btn btn-primary" onClick={() => { setPhase('setup'); setErrorMsg(''); }}>↺ {t('retry')}</button>
          <button className="btn btn-secondary" onClick={() => navigate('/browse')}>{t('nav_browse')}</button>
        </div>
      </div>
    </div>
  );

  // ── SETUP ──
  if (phase === 'setup') {
    const topics = shuffle(RANDOM_TOPICS).slice(0, 12);
    return (
      <div className="page-enter section-xs">
        <div className={styles.aiBadge}>✦ AI POWERED</div>
        <h1 className={styles.aiTitle}>{t('ai_generate_questions')}</h1>
        <p className={styles.aiSub}>{t('ai_tutor_placeholder')}</p>
        <div className="card" style={{ marginTop:24 }}>
          <div className="form-group">
            <label className="form-label">{t('ai_topic_search')} *</label>
            <input className="form-input" placeholder={t('ai_topic_search') + '…'}
              value={topic} onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && topic.trim() && handleStart(topic, count, diff)} />
          </div>
          <div className={styles.topicChips}>
            <span className={styles.chipLabel}>{t('quiz_select_topic')}:</span>
            {topics.map(tp => <span key={tp} className={styles.chip} onClick={() => setTopic(tp)}>{tp}</span>)}
          </div>
          <div className="form-row" style={{ marginTop:18 }}>
            <div className="form-group">
              <label className="form-label">{t('quiz_question')}s</label>
              <select className="form-input" value={count} onChange={e => setCount(parseInt(e.target.value))}>
                {[5,8,10,15].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('quiz_difficulty')}</label>
              <select className="form-input" value={diff} onChange={e => setDiff(e.target.value)}>
                <option value="easy">{t('quiz_easy')}</option>
                <option value="medium">{t('quiz_medium')}</option>
                <option value="hard">{t('quiz_hard')}</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-full" style={{ padding:'14px', fontSize:'1rem', marginTop:4 }}
            onClick={() => handleStart(topic, count, diff)} disabled={!topic.trim()}>
            ✦ {t('quiz_generate')} →
          </button>
        </div>
      </div>
    );
  }

  // ── PROFILE ──
  if (phase === 'profile') {
    const q = PROFILE_QUESTIONS[profileStep];
    return (
      <div className="page-enter section-xs">
        <div style={{ marginBottom:10, fontSize:'.82rem', color:'var(--text3)' }}>
          {profileStep + 1} / {PROFILE_QUESTIONS.length}
        </div>
        <div className="progress-bar" style={{ marginBottom:28 }}>
          <div className="progress-fill" style={{ width:`${(profileStep / PROFILE_QUESTIONS.length) * 100}%` }} />
        </div>
        <div className={`card ${styles.profileCard}`}>
          <div className={styles.aiBadge} style={{ marginBottom:16 }}>✦ AI</div>
          <p className={styles.profileQ}>{q.text}</p>
          <div className={styles.profileOptions}>
            {q.options.map(opt => (
              <button key={opt} className={styles.profileOpt} onClick={() => handleProfileAnswer(opt)}>{opt}</button>
            ))}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop:16 }} onClick={() => setPhase('setup')}>
          ← {t('back')}
        </button>
      </div>
    );
  }

  // ── GENERATING ──
  if (phase === 'generating') return (
    <div className="page-enter section-xs">
      <div className={styles.generating}>
        <div className="spinner" />
        <div className={styles.genTitle}>{t('ai_loading')}</div>
        <div className={styles.genStatus}>{STATUS_MSGS[statusIdx % STATUS_MSGS.length]}</div>
        <div style={{ color:'var(--text3)', fontSize:'.82rem', maxWidth:300, textAlign:'center', lineHeight:1.6 }}>
          {t('ai_topic_search')}: <strong style={{ color:'var(--accent)' }}>"{topic}"</strong>
        </div>
      </div>
    </div>
  );

  // ── TAKING ──
  if (phase === 'taking' && displayQuiz) {
    const q      = displayQuiz.questions[currentQ];   // translated — for display
    const rawQ   = quiz.questions[currentQ];           // original  — for correct_answer
    const total  = displayQuiz.questions.length;
    const isLast = currentQ === total - 1;

    return (
      <>
        {showWarningOverlay && !autoSubmitting && (
          <ProctoringWarning warningCount={warningCount} onDismiss={dismissWarning} autoSubmitting={autoSubmitting} lastViolationType={lastViolationType} />
        )}
        {autoSubmitting && <ProctoringAutoSubmit />}
        <CameraMonitor videoRef={videoRef} cameraReady={cameraReady} motionLevel={motionLevel} faceStatus={faceStatus} warningCount={warningCount} isActive={proctoringActive} />

        <div className={`page-enter ${styles.takingWrap}`}>
          {/* Translation in-progress indicator */}
          {translating && (
            <div style={{ textAlign:'center', padding:'8px', fontSize:'.78rem', color:'var(--accent)', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              <div className="spinner" style={{ width:12, height:12 }} />
              🌐 {t('loading')}
            </div>
          )}

          <div className={styles.takingHeader}>
            <div>
              <div className={styles.aiBadge}>✦ AI QUIZ</div>
              <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text2)' }}>{displayQuiz.title}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {proctoringActive && (
                <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'.7rem', color: warningCount >= 2 ? '#ef4444' : warningCount === 1 ? '#f97316' : '#22c55e', padding:'2px 7px', borderRadius:99, border:`1px solid ${warningCount >= 2 ? 'rgba(239,68,68,.3)' : warningCount === 1 ? 'rgba(249,115,22,.3)' : 'rgba(34,197,94,.25)'}`, background: warningCount >= 2 ? 'rgba(239,68,68,.07)' : warningCount === 1 ? 'rgba(249,115,22,.07)' : 'rgba(34,197,94,.06)' }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', display:'inline-block', flexShrink:0, background: warningCount >= 2 ? '#ef4444' : warningCount === 1 ? '#f97316' : '#22c55e' }} />
                  {warningCount === 0 ? 'Proctored' : `⚠ ${warningCount}/2`}
                </div>
              )}
              <span style={{ fontSize:'.82rem', color:'var(--text3)' }}>{currentQ + 1}/{total}</span>
            </div>
          </div>

          <div className="progress-bar" style={{ marginBottom:24 }}>
            <div className="progress-fill" style={{ width:`${(currentQ / total) * 100}%` }} />
          </div>

          <div className="card" style={{ marginBottom:16, padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <span className={styles.qBadge}>{t('quiz_question')} {currentQ + 1}</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {user && !revealed && (
                  <HintButton
                    questionId={null} quizId={null}
                    questionText={rawQ.question_text} options={rawQ.options}
                    isAi={true} userCoins={coins}
                    onCoinsUpdated={(newBal) => {
                      setCoins(newBal);
                      window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: newBal } }));
                    }}
                  />
                )}
                <span className={`badge ${diff === 'easy' ? 'badge-easy' : diff === 'hard' ? 'badge-hard' : 'badge-medium'}`}>
                  {t(`quiz_${diff}`)}
                </span>
              </div>
            </div>

            {/* Translated question text */}
            <p className={styles.qText}>{q.question_text}</p>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {q.options.map((opt, oi) => {
                // Correctness always from rawQ — index never changes with translation
                const ic = oi === rawQ.correct_answer;
                const is = oi === selected;
                let bg = 'var(--surface2)', bd = 'var(--border)', lb = 'var(--surface3)', lc = 'var(--text2)';
                if (revealed) {
                  if (ic)      { bg='rgba(0,212,170,.14)'; bd='var(--accent3)'; lb='var(--accent3)'; lc='#fff'; }
                  else if (is) { bg='rgba(255,107,157,.1)'; bd='var(--accent2)'; lb='var(--accent2)'; lc='#fff'; }
                } else if (is) { bg='rgba(108,99,255,.12)'; bd='var(--accent)'; lb='var(--accent)'; lc='#fff'; }
                return (
                  <button key={oi} disabled={revealed} onClick={() => handleSelect(oi)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:bg, border:`1px solid ${bd}`, cursor:revealed?'default':'pointer', fontFamily:'DM Sans', fontSize:'.9rem', textAlign:'left', width:'100%', color:'var(--text)', transition:'all .18s' }}>
                    <span style={{ width:28, height:28, borderRadius:'50%', background:lb, color:lc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.75rem', fontWeight:700, flexShrink:0 }}>
                      {OPTION_LETTERS[oi]}
                    </span>
                    {/* Translated option text */}
                    <span style={{ flex:1 }}>{opt}</span>
                    {revealed && ic  && <span style={{ color:'var(--accent3)', fontWeight:700 }}>✓</span>}
                    {revealed && is && !ic && <span style={{ color:'var(--accent2)', fontWeight:700 }}>✕</span>}
                  </button>
                );
              })}
            </div>

            {/* Translated explanation */}
            {revealed && q.explanation && (
              <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(108,99,255,.07)', border:'1px solid rgba(108,99,255,.2)', borderRadius:10, fontSize:'.85rem', color:'var(--text2)', lineHeight:1.6 }}>
                <strong style={{ color:'var(--accent)' }}>💡 </strong>{q.explanation}
              </div>
            )}
          </div>

          {revealed && (
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              {isLast
                ? <button className="btn btn-primary" style={{ minWidth:160 }} onClick={handleFinish}>{t('quiz_result')} 🎉</button>
                : <button className="btn btn-primary" style={{ minWidth:160 }} onClick={handleNext}>{t('quiz_next')} →</button>
              }
            </div>
          )}

          <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:24, flexWrap:'wrap' }}>
            {displayQuiz.questions.map((_, i) => (
              <div key={i} style={{ width:8, height:8, borderRadius:'50%', transition:'background .3s',
                background: i < currentQ ? (answers[i] === quiz.questions[i].correct_answer ? 'var(--accent3)' : 'var(--accent2)') : i === currentQ ? 'var(--accent)' : 'var(--surface3)' }} />
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── RESULTS ──
  if (phase === 'results' && resultData && quiz) {
    const { score, total, timeTaken, finalAnswers, autoSubmitted } = resultData;
    const pct = Math.round((score / total) * 100);
    const msg = getScoreMessage(pct);

    // Use translated questions for display in review; raw for correct_answer index
    const reviewQuestions = translatedQuiz?.questions || quiz.questions;

    return (
      <div className="page-enter section-xs">
        <div style={{ textAlign:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'36px 24px', marginBottom:20 }}>
          <div className={styles.aiBadge} style={{ marginBottom:12 }}>✦ AI {t('quiz_result').toUpperCase()}</div>

          {autoSubmitted && (
            <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'.82rem', color:'#ef4444' }}>
              ⚠️ {t('error')}
            </div>
          )}

          <ScoreRing score={score} total={total} size={148} />
          <div style={{ fontSize:'2.2rem', margin:'14px 0 6px' }}>{msg.emoji}</div>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-.4px', marginBottom:6 }}>{msg.text}</div>
          <div style={{ color:'var(--text2)', fontSize:'.9rem', marginBottom:24 }}>{msg.sub}</div>
          {user && <div style={{ fontSize:'.78rem', color:'var(--accent3)', marginBottom:20 }}>✓ {t('done')}</div>}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, maxWidth:320, margin:'0 auto 24px' }}>
            {[
              { v: score,                 l: t('quiz_correct'),   c: 'var(--accent3)' },
              { v: total - score,         l: t('quiz_wrong'),     c: 'var(--accent2)' },
              { v: formatTime(timeTaken), l: t('quiz_time_left'), c: 'var(--accent4)' },
            ].map((s, i) => (
              <div key={i} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 8px', textAlign:'center' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:'1.3rem', fontWeight:700, color:s.c }}>{s.v}</div>
                <div style={{ fontSize:'.72rem', color:'var(--text3)' }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <button className="btn btn-primary" onClick={() => { setPhase('setup'); setAutoSubmitting(false); setResultData(null); setQuiz(null); setTranslatedQuiz(null); }}>
              ↺ {t('retry')}
            </button>
            <button className="btn btn-secondary" onClick={handleSave}>💾 {t('save')}</button>
            {user && <button className="btn btn-secondary" onClick={() => navigate('/history')}>📊 {t('dashboard_history')}</button>}
            <button className="btn btn-secondary" onClick={() => navigate('/browse')}>{t('nav_browse')}</button>
          </div>
        </div>

        <div className="section-title" style={{ marginBottom:14 }}>📋 {t('dashboard_history')}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {reviewQuestions.map((q, i) => {
            const ua = finalAnswers[i];
            // Always use raw quiz.questions[i].correct_answer for scoring
            const ic = ua === quiz.questions[i].correct_answer;
            return (
              <div key={i} style={{ background:'var(--surface)', borderRadius:10, padding:16, border:`1px solid ${ic ? 'rgba(0,212,170,.25)' : 'rgba(255,107,157,.18)'}` }}>
                <div style={{ display:'flex', gap:10, marginBottom:8, fontWeight:500, fontSize:'.9rem', alignItems:'flex-start' }}>
                  <span style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.7rem', fontWeight:700,
                    background: ic ? 'rgba(0,212,170,.2)' : 'rgba(255,107,157,.2)',
                    color:      ic ? 'var(--accent3)' : 'var(--accent2)' }}>
                    {ic ? '✓' : '✕'}
                  </span>
                  {i + 1}. {q.question_text}
                </div>
                <div style={{ paddingLeft:32, fontSize:'.83rem', color:'var(--text2)', display:'flex', flexDirection:'column', gap:3 }}>
                  {!ic && (
                    <div>{t('quiz_wrong')}: <strong style={{ color:'var(--accent2)' }}>
                      {ua != null ? `${OPTION_LETTERS[ua]}) ${q.options[ua]}` : t('quiz_submit')}
                    </strong></div>
                  )}
                  <div>{t('quiz_correct')}: <strong style={{ color:'var(--accent3)' }}>
                    {/* Show translated option text but use raw index for correctness */}
                    {OPTION_LETTERS[quiz.questions[i].correct_answer]}) {q.options[quiz.questions[i].correct_answer]}
                  </strong></div>
                  {q.explanation && <div style={{ color:'var(--text3)', marginTop:3 }}>💡 {q.explanation}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}