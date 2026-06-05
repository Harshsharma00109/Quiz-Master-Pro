// PATH: quiz-platform/frontend/src/components/AIQuestionGenerator.js
import React, { useState } from 'react';
import axios from 'axios';

const QUICK_TOPICS = [
  '🔬 Science',    '📜 History',    '💻 Technology',
  '🏏 Cricket',    '🌍 Geography',  '🎵 Music',
  '🎬 Movies',     '🧮 Math',       '🚀 Space',
  '🧬 Biology',    '⚗️ Chemistry',  '🏆 Sports',
  '🌐 Politics',   '🎨 Art',        '📚 Literature',
];

export default function AIQuestionGenerator({ onQuestionsGenerated }) {
  const [topic,      setTopic]      = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [count,      setCount]      = useState(5);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  // Strip emojis before sending to API
  const cleanTopic = (t) => t.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').replace(/[^\w\s]/gu, '').trim();

  const generate = async () => {
    const topicClean = cleanTopic(topic);
    if (!topicClean) { setError('Please enter or select a topic'); return; }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const { data } = await axios.post(`${baseURL}/ai/generate-questions`, {
        topic:      topicClean,
        difficulty,
        count,
      });

      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions were generated. Try a different topic.');
      }

      onQuestionsGenerated(data.questions);
      setSuccess(`✅ ${data.count} questions generated about "${data.topic}"!`);
      setTopic('');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate. Check GROQ_API_KEY in backend .env';
      setError(msg);
      console.error('AI generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,212,170,0.06))',
      border: '1px solid rgba(108,99,255,0.25)',
      borderRadius: 16, padding: 24, marginBottom: 28,
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
        }}>✨</div>
        <div>
          <h3 style={{
            fontFamily: 'Syne, sans-serif', fontSize: '1.05rem',
            marginBottom: 2, color: 'var(--text)',
          }}>
            AI Question Generator
          </h3>
          {/* ✅ UPDATED: Groq branding */}
          <p style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
            Powered by Groq + Llama 3.3 — completely free ⚡
          </p>
        </div>
        {/* ✅ UPDATED: badge */}
        <span style={{
          marginLeft: 'auto', padding: '3px 12px', borderRadius: 50,
          background: 'rgba(0,212,170,0.15)', color: 'var(--accent3)',
          border: '1px solid rgba(0,212,170,0.3)',
          fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
        }}>FREE ⚡</span>
      </div>

      {/* ── Topic Input ── */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Topic / Subject</label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && generate()}
          placeholder="e.g. World War 2, Photosynthesis, IPL Cricket..."
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#7c3aed'}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* ── Quick Topic Buttons ── */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Quick Select</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {QUICK_TOPICS.map(t => {
            const isActive = topic === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(prev => prev === t ? '' : t)}
                style={{
                  padding: '5px 13px', borderRadius: 100, fontSize: '0.78rem',
                  background: isActive ? 'rgba(108,99,255,0.2)' : 'var(--surface2)',
                  border: `1px solid ${isActive ? '#7c3aed' : 'var(--border)'}`,
                  color:  isActive ? '#a78bfa' : 'var(--text2)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >{t}</button>
            );
          })}
        </div>
      </div>

      {/* ── Difficulty + Count ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

        {/* Difficulty */}
        <div>
          <label style={labelStyle}>Difficulty</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { val: 'easy',   emoji: '😊', label: 'Easy'   },
              { val: 'medium', emoji: '🤔', label: 'Medium' },
              { val: 'hard',   emoji: '🔥', label: 'Hard'   },
            ].map(({ val, emoji, label }) => {
              const isActive = difficulty === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDifficulty(val)}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10, fontSize: '0.78rem',
                    background: isActive ? '#7c3aed' : 'var(--surface2)',
                    border: `1px solid ${isActive ? '#7c3aed' : 'var(--border)'}`,
                    color:  isActive ? 'white' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >{emoji} {label}</button>
              );
            })}
          </div>
        </div>

        {/* Count */}
        <div>
          <label style={labelStyle}>Number of Questions</label>
          <select
            value={count}
            onChange={e => setCount(parseInt(e.target.value))}
            style={inputStyle}
          >
            <option value={3}>3 questions</option>
            <option value={5}>5 questions</option>
            <option value={10}>10 questions</option>
            <option value={15}>15 questions</option>
            <option value={20}>20 questions</option>
          </select>
        </div>
      </div>

      {/* ── Error / Success Messages ── */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', fontSize: '0.85rem',
        }}>⚠️ {error}</div>
      )}
      {success && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          color: '#10b981', fontSize: '0.85rem',
        }}>{success}</div>
      )}

      {/* ── Generate Button ── */}
      <button
        type="button"
        onClick={generate}
        disabled={loading || !topic.trim()}
        style={{
          width: '100%', padding: '14px', borderRadius: 11,
          cursor: loading || !topic.trim() ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          border: 'none', color: 'white',
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem',
          opacity: loading || !topic.trim() ? 0.65 : 1,
          transition: 'opacity 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block', flexShrink: 0,
            }} />
            Generating {count} questions on "{cleanTopic(topic)}"…
          </>
        ) : '✨ Generate Questions Free'}
      </button>

      {/* ✅ UPDATED: footer note — Groq limits */}
      <p style={{
        textAlign: 'center', fontSize: '0.74rem',
        color: 'var(--text3)', marginTop: 10,
      }}>
        ⚡ Groq Llama 3.3 70B — 14,400 requests/day free · ~1s response time
      </p>
    </div>
  );
}

// ── Shared styles ──
const labelStyle = {
  display: 'block', fontSize: '0.76rem', fontWeight: 700,
  color: 'var(--text2)', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const inputStyle = {
  width: '100%', padding: '11px 14px',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)',
  fontFamily: 'DM Sans, sans-serif', fontSize: '0.93rem',
  outline: 'none', transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};