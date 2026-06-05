// PATH: quiz-platform/frontend/src/pages/TakeQuizPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate }   from 'react-router-dom';
import { useAuth }                  from '../context/AuthContext';
import { useToast }                 from '../context/ToastContext';
import { useQuiz }                  from '../hooks/useQuizzes';
import useProctoring                from '../hooks/useProctoring';
import ProctoringWarning, { ProctoringAutoSubmit } from '../components/ProctoringWarning';
import CameraMonitor                from '../components/CameraMonitor';
import HintButton                   from '../components/HintButton';
import api                          from '../utils/api';
import { formatTime }               from '../utils/helpers';
import { useLanguage }              from '../context/LanguageContext';
// CHANGE 1: import the batch hook (replaces the old per-question hook below)
import { useTranslatedQuestions }   from '../hooks/useTranslatedQuestions';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function useTimer(totalSeconds, onExpire) {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const ref = useRef(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!totalSeconds) return;
    setTimeLeft(totalSeconds);
    ref.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(ref.current); onExpireRef.current?.(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [totalSeconds]);
  return timeLeft;
}

// CHANGE 2: deleted the old useTranslatedQuestion function that was here.
// It made one Groq call per question (10 calls for a 10-question quiz).
// useTranslatedQuestions (imported above) batches all questions into ONE call.

export default function TakeQuizPage() {
  const { id }          = useParams();
  const navigate        = useNavigate();
  const { user, token } = useAuth();
  const { toast }       = useToast();
  const { quiz, loading, error } = useQuiz(id);
  // CHANGE 3: removed translateObject from destructure — no longer needed here
  const { t, language } = useLanguage();

  const [currentQ,      setCurrentQ]      = useState(0);
  const [answers,       setAnswers]       = useState([]);
  const [selectedOpt,   setSelectedOpt]   = useState(null);
  const [revealed,      setRevealed]      = useState(false);
  const [submitted,     setSubmitted]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [startTime,     setStartTime]     = useState(null);
  const [questionTimes, setQuestionTimes] = useState([]);
  const [qStartTime,    setQStartTime]    = useState(null);
  const [coins,         setCoins]         = useState(user?.coins || 0);
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  const answersRef       = useRef(answers);
  const selectedOptRef   = useRef(selectedOpt);
  const currentQRef      = useRef(currentQ);
  const startTimeRef     = useRef(startTime);
  const questionTimesRef = useRef(questionTimes);
  const submittingRef    = useRef(submitting);
  const submittedRef     = useRef(submitted);
  const autoSubmittingRef= useRef(autoSubmitting);

  useEffect(() => { answersRef.current       = answers;       }, [answers]);
  useEffect(() => { selectedOptRef.current   = selectedOpt;   }, [selectedOpt]);
  useEffect(() => { currentQRef.current      = currentQ;      }, [currentQ]);
  useEffect(() => { startTimeRef.current     = startTime;     }, [startTime]);
  useEffect(() => { questionTimesRef.current = questionTimes; }, [questionTimes]);
  useEffect(() => { submittingRef.current    = submitting;    }, [submitting]);
  useEffect(() => { submittedRef.current     = submitted;     }, [submitted]);
  useEffect(() => { autoSubmittingRef.current= autoSubmitting;}, [autoSubmitting]);

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
    if (!quiz) return;
    setAnswers(new Array(quiz.questions.length).fill(null));
    setStartTime(Date.now());
    setQStartTime(Date.now());
    setCurrentQ(0);
    setSelectedOpt(null);
    setRevealed(false);
    setSubmitted(false);
    setSubmitting(false);
    setAutoSubmitting(false);
    startSession(quiz.id);
    return () => { endSession(null, false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id]);

  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (submittingRef.current || submittedRef.current) return;
    setSubmitting(true);

    const fa = [...answersRef.current];
    const cq = currentQRef.current;
    const so = selectedOptRef.current;
    if (so !== null && fa[cq] === null) fa[cq] = so;

    const timeTaken = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;

    const questions = quiz?.questions || [];
    const score = fa.reduce((acc, ans, i) => {
      const q = questions[i];
      return acc + (q && ans === q.correct_answer ? 1 : 0);
    }, 0);

    endSession(null, isAutoSubmit).catch(() => {});

    try {
      const { data } = await api.post(
        `/quizzes/${id}/attempt`,
        { score, total_questions: questions.length, time_taken: timeTaken, answers: fa, question_times: questionTimesRef.current },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      setSubmitted(true);
      navigate('/results', {
        state: {
          score, total: questions.length, timeTaken,
          quizTitle: quiz.title, quizId: quiz.id,
          attemptId: data?.attempt_id,
          newBadges: data?.new_badges || [], streakReward: data?.streak_reward || null,
          coinsEarned: data?.coins_earned || 0, xpEarned: data?.xp_earned || 0,
          scorePct: data?.score_pct || 0,
          answers: fa, questions, showAnswers: quiz.show_answers !== false,
          autoSubmitted: isAutoSubmit,
        },
      });
    } catch (e) {
      toast.error(e?.response?.data?.error || t('error'));
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz, id, token, t]);

  useEffect(() => {
    if (warningCount >= 3 && !autoSubmittingRef.current && !submittedRef.current) {
      setAutoSubmitting(true);
      setTimeout(() => handleSubmit(true), 2200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warningCount]);

  const timerMode     = quiz?.timer_mode || 'none';
  const perQSeconds   = quiz?.per_question_seconds || 30;
  const totalTimerSec = timerMode === 'total' ? (quiz?.time_limit || 0) * 60 : 0;

  const handleTimerExpire = useCallback(() => {
    if (timerMode === 'per_question') {
      const cq = currentQRef.current;
      const total = quiz?.questions?.length || 0;
      if (cq < total - 1) {
        setCurrentQ(q => q + 1); setSelectedOpt(null); setRevealed(false); setQStartTime(Date.now());
      } else { handleSubmit(false); }
    } else if (timerMode === 'total') { handleSubmit(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerMode, quiz?.questions?.length, handleSubmit]);

  const timeLeft = useTimer(
    timerMode === 'per_question' ? perQSeconds : totalTimerSec,
    handleTimerExpire
  );

  // Raw questions array — used for correct_answer checking and submit logic
  const questions      = quiz?.questions || [];
  const totalQuestions = questions.length;
  const rawQ           = questions[currentQ];

  // CHANGE 4: replace the old per-question hook with the batch hook.
  // displayQuestions = translated version for rendering only.
  // questions (raw) is still used everywhere for correct_answer and submission.
  const { questions: displayQuestions } = useTranslatedQuestions(questions);
  const q = displayQuestions[currentQ];

  const handleSelect = (optIdx) => {
    if (revealed || submitted) return;
    setSelectedOpt(optIdx);
    const showAns = quiz?.show_answers !== false;
    const a = [...answersRef.current];
    a[currentQRef.current] = optIdx;
    setAnswers(a);
    if (showAns) {
      setRevealed(true);
      const qt = qStartTime ? Math.floor((Date.now() - qStartTime) / 1000) : 0;
      setQuestionTimes(prev => [...prev, qt]);
    }
  };

  const handleNext = () => {
    setCurrentQ(q => q + 1); setSelectedOpt(null); setRevealed(false); setQStartTime(Date.now());
  };

  const handlePrev = () => {
    if (currentQ > 0) {
      const prevIdx = currentQ - 1;
      setCurrentQ(prevIdx);
      setSelectedOpt(answers[prevIdx] ?? null);
      setRevealed(quiz?.show_answers !== false && answers[prevIdx] !== null);
      setQStartTime(Date.now());
    }
  };

  // ── Loading / error ──
  if (loading) return (
    <div className="page-enter section-sm" style={{ textAlign:'center', paddingTop:80 }}>
      <div className="spinner" />
      <p style={{ color:'var(--text2)', marginTop:16 }}>{t('loading')}</p>
    </div>
  );
  if (error) return (
    <div className="page-enter section-sm" style={{ textAlign:'center', paddingTop:80 }}>
      <div style={{ fontSize:'2rem', marginBottom:12 }}>⚠️</div>
      <p style={{ color:'var(--text2)' }}>{error}</p>
      <button className="btn btn-primary" onClick={() => navigate('/browse')} style={{ marginTop:16 }}>
        {t('nav_browse')}
      </button>
    </div>
  );
  if (!quiz) return null;

  const isLast      = currentQ === totalQuestions - 1;
  const showAnswers = quiz.show_answers !== false;

  return (
    <>
      {showWarningOverlay && !autoSubmitting && (
        <ProctoringWarning
          warningCount={warningCount} onDismiss={dismissWarning}
          autoSubmitting={autoSubmitting} lastViolationType={lastViolationType}
        />
      )}
      {autoSubmitting && <ProctoringAutoSubmit />}
      <CameraMonitor
        videoRef={videoRef} cameraReady={cameraReady} motionLevel={motionLevel}
        faceStatus={faceStatus} warningCount={warningCount} isActive={proctoringActive}
      />

      <div className="page-enter section-sm">
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:'1.05rem', marginBottom:2 }}>{quiz.title}</div>
            <div style={{ fontSize:'.78rem', color:'var(--text3)' }}>{quiz.category} · {quiz.difficulty}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {proctoringActive && (
              <div style={{
                display:'flex', alignItems:'center', gap:5, fontSize:'.72rem',
                color: warningCount >= 2 ? '#ef4444' : warningCount === 1 ? '#f97316' : '#22c55e',
                padding:'3px 8px', borderRadius:99,
                border:`1px solid ${warningCount >= 2 ? 'rgba(239,68,68,.3)' : warningCount === 1 ? 'rgba(249,115,22,.3)' : 'rgba(34,197,94,.25)'}`,
                background: warningCount >= 2 ? 'rgba(239,68,68,.07)' : warningCount === 1 ? 'rgba(249,115,22,.07)' : 'rgba(34,197,94,.06)',
              }}>
                <span style={{ width:6, height:6, borderRadius:'50%', display:'inline-block', flexShrink:0,
                  background: warningCount >= 2 ? '#ef4444' : warningCount === 1 ? '#f97316' : '#22c55e' }} />
                {warningCount === 0 ? 'Proctored' : `⚠ ${warningCount}/2 ${t('nav_streak')}`}
              </div>
            )}
            {timerMode !== 'none' && (
              <div style={{ fontFamily:'monospace', fontSize:'.9rem', fontWeight:700, color: timeLeft < 30 ? '#ef4444' : 'var(--text)', padding:'4px 10px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
                ⏱ {formatTime(timeLeft)}
              </div>
            )}
            <span style={{ fontSize:'.82rem', color:'var(--text2)' }}>{currentQ + 1} / {totalQuestions}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="progress-bar" style={{ marginBottom:24 }}>
          <div className="progress-fill" style={{ width:`${(currentQ / totalQuestions) * 100}%` }} />
        </div>

        {/* Question card */}
        {q && (
          <div className="card" style={{ padding:28, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8 }}>
              <span style={{ fontSize:'.72rem', fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                {t('quiz_question')} {currentQ + 1}
              </span>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {user && !revealed && (
                  <HintButton
                    questionId={rawQ?.id} quizId={quiz.id}
                    questionText={rawQ?.question_text} options={rawQ?.options}
                    isAi={false} userCoins={coins}
                    onCoinsUpdated={(newBal) => {
                      setCoins(newBal);
                      window.dispatchEvent(new CustomEvent('coinsUpdated', { detail: { coins: newBal } }));
                    }}
                  />
                )}
                <span className={`badge badge-${quiz.difficulty?.toLowerCase() || 'medium'}`}>{quiz.difficulty}</span>
              </div>
            </div>

            {rawQ?.image_url && (
              <img src={rawQ.image_url} alt={t('quiz_question')} style={{ width:'100%', maxHeight:260, objectFit:'cover', borderRadius:10, marginBottom:16 }} />
            )}

            {/* Translated question text */}
            <p style={{ fontFamily:'DM Sans,sans-serif', fontSize:'1.05rem', fontWeight:500, lineHeight:1.55, marginBottom:20, color:'var(--text)' }}>
              {q.question_text}
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(q.options || []).map((opt, oi) => {
                // Always use rawQ.correct_answer for correctness — it's an index, never translates
                const isCorrect  = oi === rawQ?.correct_answer;
                const isSelected = oi === selectedOpt;
                let bg = 'var(--surface2)', bd = 'var(--border)', lbBg = 'var(--surface3)', lbColor = 'var(--text2)';
                if (revealed && showAnswers) {
                  if (isCorrect)       { bg='rgba(0,212,170,.13)'; bd='var(--accent3)'; lbBg='var(--accent3)'; lbColor='#fff'; }
                  else if (isSelected) { bg='rgba(255,107,157,.1)'; bd='var(--accent2)'; lbBg='var(--accent2)'; lbColor='#fff'; }
                } else if (isSelected) { bg='rgba(108,99,255,.12)'; bd='var(--accent)'; lbBg='var(--accent)'; lbColor='#fff'; }

                return (
                  <button key={oi} disabled={revealed || submitted} onClick={() => handleSelect(oi)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:bg, border:`1px solid ${bd}`, cursor:revealed||submitted?'default':'pointer', fontFamily:'DM Sans,sans-serif', fontSize:'.9rem', textAlign:'left', width:'100%', color:'var(--text)', transition:'all .18s' }}>
                    <span style={{ width:28, height:28, borderRadius:'50%', background:lbBg, color:lbColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.75rem', fontWeight:700, flexShrink:0, transition:'all .18s' }}>
                      {OPTION_LETTERS[oi]}
                    </span>
                    {/* Translated option text */}
                    <span style={{ flex:1 }}>{opt}</span>
                    {revealed && showAnswers && isCorrect  && <span style={{ color:'var(--accent3)', fontWeight:700 }}>✓</span>}
                    {revealed && showAnswers && isSelected && !isCorrect && <span style={{ color:'var(--accent2)', fontWeight:700 }}>✕</span>}
                  </button>
                );
              })}
            </div>

            {/* Translated explanation */}
            {revealed && showAnswers && q.explanation && (
              <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(108,99,255,.07)', border:'1px solid rgba(108,99,255,.2)', borderRadius:10, fontSize:'.85rem', color:'var(--text2)', lineHeight:1.6 }}>
                <strong style={{ color:'var(--accent)' }}>💡 </strong>{q.explanation}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <button className="btn btn-secondary" onClick={handlePrev} disabled={currentQ === 0}>← {t('quiz_prev')}</button>
          {isLast
            ? <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={submitting || submitted} style={{ minWidth:160 }}>
                {submitting ? `${t('loading')}` : `${t('quiz_finish')} ✓`}
              </button>
            : <button className="btn btn-primary" onClick={handleNext} style={{ minWidth:120 }}>{t('quiz_next')} →</button>
          }
        </div>

        {/* Dot nav */}
        <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:24, flexWrap:'wrap' }}>
          {questions.map((_, i) => (
            <div key={i}
              onClick={() => {
                setCurrentQ(i); setSelectedOpt(answers[i] ?? null);
                setRevealed(showAnswers && answers[i] !== null); setQStartTime(Date.now());
              }}
              style={{ width:8, height:8, borderRadius:'50%', cursor:'pointer', transition:'background .25s',
                background: i === currentQ ? 'var(--accent)' : answers[i] !== null ? 'var(--accent3)' : 'var(--surface3)' }}
            />
          ))}
        </div>
      </div>
    </>
  );
}