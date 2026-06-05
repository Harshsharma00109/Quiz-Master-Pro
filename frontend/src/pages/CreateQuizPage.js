// PATH: quiz-platform/frontend/src/pages/CreateQuizPage.js
import React, { useState, useRef } from 'react';
import { useNavigate }        from 'react-router-dom';
import { useToast }           from '../context/ToastContext';
import { quizAPI }            from '../utils/api';
import { CATEGORIES }         from '../utils/helpers';
import QuestionBuilder        from '../components/QuestionBuilder';
import AIQuestionGenerator    from '../components/AIQuestionGenerator';
import styles                 from './CreateQuizPage.module.css';

const EMPTY_QUESTION = () => ({
  question_text:  '',
  options:        ['', '', '', ''],
  correct_answer: 0,
  explanation:    '',
});

export default function CreateQuizPage() {
  const navigate  = useNavigate();
  const { toast } = useToast();
  const topRef    = useRef(null);

  const [meta, setMeta] = useState({
    title:       '',
    description: '',
    category:    'General',
    difficulty:  'Medium',
    time_limit:  0,
    is_public:   true,
  });

  const [questions, setQuestions] = useState([EMPTY_QUESTION()]);
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [showAI,    setShowAI]    = useState(false);

  const updateMeta = (field, value) => setMeta(m => ({ ...m, [field]: value }));

  // ── AI Questions Handler ─────────────────────────────────
  // Called when Gemini returns questions
  const handleAIQuestions = (aiQuestions) => {
    if (!aiQuestions || aiQuestions.length === 0) {
      toast.error('No questions returned from AI');
      return;
    }

    // Convert AI questions to our format
    const formatted = aiQuestions.map(q => ({
      question_text:  q.question_text  || q.question || '',
      options:        Array.isArray(q.options) ? q.options : ['', '', '', ''],
      correct_answer: typeof q.correct_answer === 'number' ? q.correct_answer : 0,
      explanation:    q.explanation || '',
    }));

    // Replace empty questions OR append to existing
    const hasEmptyOnly = questions.length === 1 && !questions[0].question_text.trim();
    if (hasEmptyOnly) {
      setQuestions(formatted);
    } else {
      setQuestions(prev => [...prev, ...formatted]);
    }

    setShowAI(false);
    toast.success(`✅ ${formatted.length} AI questions added! Review and edit below.`);

    // Scroll to questions section
    setTimeout(() => {
      document.getElementById('questions-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const updateQuestion = (idx, updated) => {
    setQuestions(qs => { const c = [...qs]; c[idx] = updated; return c; });
  };

  const addQuestion = () => {
    setQuestions(qs => [...qs, EMPTY_QUESTION()]);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 80);
  };

  const removeQuestion = (idx) => {
    if (questions.length === 1) { toast.error('Need at least 1 question'); return; }
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  // ── Validation ───────────────────────────────────────────
  const validate = () => {
    if (!meta.title.trim())    return 'Quiz title is required.';
    if (!questions.length)     return 'Add at least one question.';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim())       return `Question ${i+1}: question text is required.`;
      if (q.options.some(o => !o.trim())) return `Question ${i+1}: all four options are required.`;
    }
    return null;
  };

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setError(err);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await quizAPI.create({ ...meta, questions });
      toast.success('Quiz published! 🎉');
      navigate(`/quiz/${data.id}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create quiz. Please try again.');
      setSaving(false);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`page-enter section-sm`} ref={topRef}>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 24 }} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h1 className={styles.pageTitle}>✦ Create New Quiz</h1>

      {error && <div className="form-error" style={{ marginBottom: 20 }}>{error}</div>}

      {/* ── QUIZ META ── */}
      <div className={`card ${styles.section}`}>
        <div className={styles.sectionTitle}>Quiz Details</div>

        <div className="form-group">
          <label className="form-label">Quiz Title *</label>
          <input
            className="form-input"
            placeholder="e.g. World Geography Challenge"
            value={meta.title}
            onChange={e => updateMeta('title', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            className="form-input"
            placeholder="Tell people what this quiz is about…"
            rows={2}
            value={meta.description}
            onChange={e => updateMeta('description', e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-input" value={meta.category} onChange={e => updateMeta('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select className="form-input" value={meta.difficulty} onChange={e => updateMeta('difficulty', e.target.value)}>
              {['Easy','Medium','Hard'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Visibility</label>
            <select className="form-input" value={meta.is_public ? 'public' : 'private'} onChange={e => updateMeta('is_public', e.target.value === 'public')}>
              <option value="public">🌐 Public</option>
              <option value="private">🔒 Private</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Time Limit (minutes, 0 = none)</label>
            <input
              className="form-input" type="number" min={0} max={120}
              value={meta.time_limit}
              onChange={e => updateMeta('time_limit', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* ── AI GENERATOR TOGGLE ── */}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`btn ${showAI ? 'btn-secondary' : 'btn-primary'}`}
          style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
          onClick={() => setShowAI(v => !v)}
        >
          {showAI ? '✕ Hide AI Generator' : '✨ Generate Questions with AI (Free)'}
        </button>
      </div>

      {/* ── AI GENERATOR PANEL ── */}
      {showAI && (
        <AIQuestionGenerator onQuestionsGenerated={handleAIQuestions} />
      )}

      {/* ── QUESTIONS ── */}
      <div id="questions-section">
        <div className={styles.qHeader}>
          <span className="section-title">Questions ({questions.length})</span>
          <button className="btn btn-secondary btn-sm" type="button" onClick={addQuestion}>
            + Add Question
          </button>
        </div>

        {questions.map((q, i) => (
          <QuestionBuilder
            key={i}
            question={q}
            index={i}
            total={questions.length}
            onChange={updateQuestion}
            onRemove={removeQuestion}
          />
        ))}
      </div>

      <button
        type="button"
        className={`btn btn-secondary btn-full ${styles.addBtn}`}
        onClick={addQuestion}
      >
        + Add Another Question
      </button>

      <div className={styles.submitRow}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1, padding: '14px 0', fontSize: '1rem' }}
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Publishing…' : '🚀 Publish Quiz'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
