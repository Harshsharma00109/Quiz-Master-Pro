// PATH: quiz-platform/frontend/src/pages/EditQuizPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast }    from '../context/ToastContext';
import { useAuth }     from '../context/AuthContext';
import { useQuiz }     from '../hooks/useQuizzes';
import { quizAPI }     from '../utils/api';
import { CATEGORIES }  from '../utils/helpers';
import QuestionBuilder from '../components/QuestionBuilder';
import styles          from './CreateQuizPage.module.css'; // reuse same CSS

const EMPTY_QUESTION = () => ({
  question_text: '',
  options: ['', '', '', ''],
  correct_answer: 0,
  explanation: '',
});

export default function EditQuizPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { user }  = useAuth();
  const topRef    = useRef(null);

  const { quiz, loading } = useQuiz(id);

  const [meta, setMeta] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);

  // Populate form when quiz loads
  useEffect(() => {
    if (!quiz) return;

    // Ownership check
    if (user && quiz.creator_id !== user.id) {
      toast.error('You can only edit your own quizzes');
      navigate('/my-quizzes');
      return;
    }

    setMeta({
      title:       quiz.title,
      description: quiz.description || '',
      category:    quiz.category,
      difficulty:  quiz.difficulty,
      time_limit:  quiz.time_limit || 0,
      is_public:   Boolean(quiz.is_public),
    });

    setQuestions(quiz.questions.map(q => ({
      question_text:  q.question_text,
      options:        [...q.options],
      correct_answer: q.correct_answer,
      explanation:    q.explanation || '',
    })));
  }, [quiz]); // eslint-disable-line

  const updateMeta     = (field, value) => setMeta(m => ({ ...m, [field]: value }));
  const updateQuestion = (idx, updated) => setQuestions(qs => { const c = [...qs]; c[idx] = updated; return c; });
  const addQuestion    = () => { setQuestions(qs => [...qs, EMPTY_QUESTION()]); setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 80); };
  const removeQuestion = (idx) => setQuestions(qs => qs.filter((_, i) => i !== idx));

  const validate = () => {
    if (!meta.title.trim()) return 'Quiz title is required.';
    if (!questions.length)  return 'Add at least one question.';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim())        return `Question ${i + 1}: question text required.`;
      if (q.options.some(o => !o.trim())) return `Question ${i + 1}: all four options required.`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); topRef.current?.scrollIntoView({ behavior: 'smooth' }); return; }
    setSaving(true); setError('');
    try {
      await quizAPI.update(id, { ...meta, questions });
      toast.success('Quiz updated! ✅');
      navigate(`/quiz/${id}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update quiz.');
      setSaving(false);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading || !meta) return (
    <div className="section-sm">
      <div className="skeleton" style={{ height: 48, marginBottom: 14, borderRadius: 12 }} />
      <div className="skeleton card" style={{ height: 320 }} />
    </div>
  );

  return (
    <div className={`page-enter section-sm`} ref={topRef}>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 24 }} onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h1 className={styles.pageTitle}>✏️ Edit Quiz</h1>

      {error && <div className="form-error" style={{ marginBottom: 20 }}>{error}</div>}

      {/* META */}
      <div className={`card ${styles.section}`}>
        <div className={styles.sectionTitle}>Quiz Details</div>

        <div className="form-group">
          <label className="form-label">Quiz Title *</label>
          <input className="form-input" value={meta.title} onChange={e => updateMeta('title', e.target.value)} placeholder="Quiz title" />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={2} value={meta.description} onChange={e => updateMeta('description', e.target.value)} placeholder="Description…" />
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
            <label className="form-label">Time Limit (min, 0 = none)</label>
            <input className="form-input" type="number" min={0} max={120} value={meta.time_limit} onChange={e => updateMeta('time_limit', parseInt(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      {/* QUESTIONS */}
      <div className={styles.qHeader}>
        <span className="section-title">Questions ({questions.length})</span>
        <button className="btn btn-secondary btn-sm" onClick={addQuestion}>+ Add Question</button>
      </div>

      {questions.map((q, i) => (
        <QuestionBuilder key={i} question={q} index={i} total={questions.length} onChange={updateQuestion} onRemove={removeQuestion} />
      ))}

      <button className={`btn btn-secondary btn-full ${styles.addBtn}`} onClick={addQuestion}>
        + Add Another Question
      </button>

      <div className={styles.submitRow}>
        <button className="btn btn-primary" style={{ flex: 1, padding: '14px 0', fontSize: '1rem' }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : '💾 Save Changes'}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate(-1)} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}
