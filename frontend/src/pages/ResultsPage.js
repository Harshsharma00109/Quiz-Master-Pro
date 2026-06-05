// PATH: quiz-platform/frontend/src/pages/ResultsPage.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate }   from 'react-router-dom';
import ScoreRing        from '../components/ScoreRing';
import ProgressChart    from '../components/ProgressChart';
import BadgeToast       from '../components/BadgeToast';
import StreakRewardPopup from '../components/StreakRewardPopup';
import { formatTime, getScoreMessage, getScoreColor } from '../utils/helpers';
import { useAuth }     from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api             from '../utils/api';
import styles          from './ResultsPage.module.css';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Translate all questions in the review section in one batch
async function translateQuestions(questions, language, translateObject) {
  if (language === 'en' || !questions?.length) return questions;
  return Promise.all(questions.map(async (q) => {
    const payload = {
      question_text: q.question_text || '',
      explanation:   q.explanation   || '',
      opt0: q.options?.[0] || '', opt1: q.options?.[1] || '',
      opt2: q.options?.[2] || '', opt3: q.options?.[3] || '',
      opt4: q.options?.[4] || '',
    };
    try {
      const r = await translateObject(payload,
        ['question_text','explanation','opt0','opt1','opt2','opt3','opt4']);
      return {
        ...q,
        question_text: r.question_text,
        explanation:   r.explanation,
        options: [r.opt0,r.opt1,r.opt2,r.opt3,r.opt4]
          .filter((_, i) => i < (q.options?.length || 0)),
      };
    } catch { return q; }
  }));
}

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, translateObject } = useLanguage();
  const state = location.state;

  const [history,          setHistory]          = useState([]);
  const [newBadges,        setNewBadges]        = useState([]);
  const [challengeLink,    setChallengeLink]    = useState('');
  const [copied,           setCopied]           = useState(false);
  const [chalLoading,      setChalLoading]      = useState(false);
  const [chalError,        setChalError]        = useState('');
  // Translated questions for answer review
  const [displayQuestions, setDisplayQuestions] = useState([]);
  const [translating,      setTranslating]      = useState(false);

  // Normalise state — TakeQuizPage sends flat fields
  const score       = state?.score      ?? 0;
  const total       = state?.total      ?? state?.totalQuestions ?? 0;
  const timeTaken   = state?.timeTaken  ?? 0;
  const answers     = state?.answers    ?? [];
  const questions   = state?.questions  ?? state?.quiz?.questions ?? [];
  const quizId      = state?.quizId     ?? state?.quiz?.id        ?? null;
  const quizTitle   = state?.quizTitle  ?? state?.quiz?.title     ?? 'Quiz';
  const showAnswers = state?.showAnswers ?? true;
  const autoSubmitted = state?.autoSubmitted ?? false;
  const streakReward  = state?.streak_reward  ?? state?.streakReward  ?? null;
  const coinsEarned   = state?.coins_earned   ?? state?.coinsEarned   ?? 0;
  const xpEarned      = state?.xp_earned      ?? state?.xpEarned      ?? 0;

  // Translate questions for review when language changes
  useEffect(() => {
    if (!questions?.length) { setDisplayQuestions(questions); return; }
    if (language === 'en') { setDisplayQuestions(questions); return; }
    let cancelled = false;
    setTranslating(true);
    translateQuestions(questions, language, translateObject).then(translated => {
      if (!cancelled) { setDisplayQuestions(translated); setTranslating(false); }
    });
    return () => { cancelled = true; };
  }, [questions, language]); // eslint-disable-line

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/users/${user.id}/attempts`)
      .then(r => setHistory(r.data || [])).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const badges = state?.new_badges ?? state?.newBadges ?? [];
    if (badges.length) setNewBadges(badges);
  }, []); // eslint-disable-line

  if (!state || total === 0) {
    return (
      <div className="section-xs" style={{ textAlign:'center', paddingTop:80 }}>
        <div style={{ fontSize:'3rem', marginBottom:16 }}>🤔</div>
        <p style={{ color:'var(--text2)', marginBottom:20 }}>{t('dashboard_no_history')}</p>
        <button className="btn btn-primary" onClick={() => navigate('/browse')}>{t('nav_browse')}</button>
      </div>
    );
  }

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const msg = getScoreMessage(pct);
  const col = getScoreColor(pct);

  const chartData = [
    ...history.filter(a => String(a.quiz_id) !== String(quizId)),
    { quiz_title: quizTitle, score, total_questions: total, completed_at: new Date().toISOString() },
  ];

  const handleCreateChallenge = async () => {
    if (!user) { alert(t('auth_login_title')); return; }
    if (!quizId) { setChalError(t('error')); return; }
    setChalLoading(true); setChalError('');
    try {
      const { data } = await api.post('/challenges/create', {
        quiz_id: parseInt(quizId, 10), score, total,
      });
      setChallengeLink(data.link);
    } catch (e) {
      setChalError(e.response?.data?.error || t('error'));
    } finally { setChalLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(challengeLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Use translated questions for display, fall back to originals
  const reviewQuestions = displayQuestions.length ? displayQuestions : questions;

  return (
    <div className="page-enter section-xs">
      <BadgeToast badges={newBadges} onDone={() => setNewBadges([])} />
      <StreakRewardPopup reward={streakReward} onClose={() => {}} />

      {/* Auto-submitted warning */}
      {autoSubmitted && (
        <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:'.82rem', color:'#ef4444', textAlign:'center' }}>
          ⚠️ {t('error')}
        </div>
      )}

      {/* Score header */}
      <div className={styles.header}>
        <ScoreRing score={score} total={total} size={160} />
        <div style={{ fontSize:'2.4rem', marginTop:16, marginBottom:8 }}>{msg.emoji}</div>
        <h1 className={styles.resultTitle}>{msg.text}</h1>
        <p className={styles.resultSub}>{msg.sub}</p>

        <div className={styles.statRow}>
          <div className={styles.statPill}>
            <span className={styles.statVal} style={{ color:'var(--accent3)' }}>{score}</span>
            <span className={styles.statLabel}>{t('quiz_correct')}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statVal} style={{ color:'var(--accent2)' }}>{total - score}</span>
            <span className={styles.statLabel}>{t('quiz_wrong')}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statVal} style={{ color:'var(--accent4)' }}>{formatTime(timeTaken)}</span>
            <span className={styles.statLabel}>{t('quiz_time_left')}</span>
          </div>
          <div className={styles.statPill}>
            <span className={styles.statVal} style={{ color:col }}>{pct}%</span>
            <span className={styles.statLabel}>{t('quiz_score')}</span>
          </div>
        </div>

        {(coinsEarned > 0 || xpEarned > 0) && (
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:12, flexWrap:'wrap' }}>
            {coinsEarned > 0 && (
              <div style={{ fontSize:'.8rem', fontWeight:600, padding:'4px 12px', borderRadius:99, background:'rgba(234,179,8,.12)', color:'#eab308', border:'1px solid rgba(234,179,8,.25)' }}>
                🪙 +{coinsEarned} {t('nav_coins')}
              </div>
            )}
            {xpEarned > 0 && (
              <div style={{ fontSize:'.8rem', fontWeight:600, padding:'4px 12px', borderRadius:99, background:'rgba(108,99,255,.12)', color:'var(--accent)', border:'1px solid rgba(108,99,255,.25)' }}>
                ⚡ +{xpEarned} XP
              </div>
            )}
          </div>
        )}
      </div>

      {/* Challenge a friend */}
      {user && quizId && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'16px 20px', marginBottom:20 }}>
          <div style={{ fontWeight:700, marginBottom:4, fontSize:'.95rem' }}>⚔️ {t('quiz_share')}</div>
          <p style={{ fontSize:'.78rem', color:'var(--text3)', marginBottom:12 }}>
            {t('quiz_score')}: <strong style={{ color:col }}>{pct}%</strong>
          </p>
          {chalError && (
            <div style={{ fontSize:'.78rem', color:'#ef4444', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
              ⚠️ {chalError}
            </div>
          )}
          {!challengeLink ? (
            <button className="btn btn-primary btn-sm" onClick={handleCreateChallenge} disabled={chalLoading}>
              {chalLoading ? t('loading') : `🔗 ${t('quiz_share')}`}
            </button>
          ) : (
            <div style={{ display:'flex', gap:8 }}>
              <input className="form-input" readOnly value={challengeLink}
                style={{ flex:1, fontSize:'.78rem' }} onClick={e => e.target.select()} />
              <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                {copied ? `✓ ${t('done')}` : t('save')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress chart */}
      {user && chartData.length > 1 && (
        <ProgressChart attempts={chartData} title={`📈 ${t('dashboard_history')}`} maxPoints={10} />
      )}

      {/* Action buttons */}
      <div className={styles.actions}>
        {quizId && (
          <button className="btn btn-primary" onClick={() => navigate(`/quiz/${quizId}/take`)}>
            ↺ {t('quiz_try_again')}
          </button>
        )}
        {quizId && (
          <button className="btn btn-secondary" onClick={() => navigate(`/quiz/${quizId}`)}>
            {t('nav_browse')}
          </button>
        )}
        {!quizId && (
          <button className="btn btn-primary" onClick={() => navigate('/ai')}>
            ↺ {t('nav_ai_quiz')}
          </button>
        )}
        {user && (
          <button className="btn btn-secondary" onClick={() => navigate('/history')}>
            📊 {t('dashboard_history')}
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => navigate('/browse')}>
          {t('nav_browse')}
        </button>
      </div>

      {/* Answer review */}
      {showAnswers && questions.length > 0 && (
        <div className={styles.reviewSection}>
          <div className="section-title" style={{ marginBottom:16 }}>
            📋 {t('dashboard_history')}
            {translating && (
              <span style={{ fontSize:'.72rem', color:'var(--text3)', marginLeft:8 }}>
                🌐 {t('loading')}
              </span>
            )}
          </div>
          <div className={styles.answerList}>
            {reviewQuestions.map((q, i) => {
              // Always use original question for correctness check
              const origQ     = questions[i];
              const userAns   = answers?.[i];
              const isCorrect = userAns === origQ.correct_answer;
              return (
                <div key={i} className={`${styles.answerItem} ${isCorrect ? styles.correct : styles.wrong}`}>
                  <div className={styles.answerQ}>
                    <span className={`${styles.answerBadge} ${isCorrect ? styles.badgeCorrect : styles.badgeWrong}`}>
                      {isCorrect ? '✓' : '✕'}
                    </span>
                    <span>{i + 1}. {q.question_text}</span>
                  </div>
                  <div className={styles.answerDetail}>
                    {!isCorrect && (
                      <div className={styles.userAnswer}>
                        {t('quiz_wrong')}:{' '}
                        <strong style={{ color:'var(--accent2)' }}>
                          {userAns !== null && userAns !== undefined
                            ? `${OPTION_LETTERS[userAns]}) ${q.options?.[userAns] ?? '?'}`
                            : t('quiz_submit')}
                        </strong>
                      </div>
                    )}
                    <div className={styles.correctAnswer}>
                      {isCorrect ? `✓ ${t('quiz_correct')} ` : `${t('quiz_correct')}: `}
                      <strong style={{ color:'var(--accent3)' }}>
                        {OPTION_LETTERS[origQ.correct_answer]}) {q.options?.[origQ.correct_answer] ?? '?'}
                      </strong>
                    </div>
                    {q.explanation && (
                      <div className={styles.explanation}>💡 {q.explanation}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}