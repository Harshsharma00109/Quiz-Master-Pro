// PATH: quiz-platform/frontend/src/components/QuestionBuilder.js
import React from 'react';
import styles from './QuestionBuilder.module.css';

const LETTERS     = ['A','B','C','D'];
const OPT_STYLES  = [
  { bg: 'rgba(108,99,255,.18)', color: 'var(--accent)' },
  { bg: 'rgba(255,107,157,.18)', color: 'var(--accent2)' },
  { bg: 'rgba(0,212,170,.18)',   color: 'var(--accent3)' },
  { bg: 'rgba(255,209,102,.18)', color: 'var(--accent4)' },
];

export default function QuestionBuilder({ question, index, total, onChange, onRemove }) {
  const update = (field, value) => onChange(index, { ...question, [field]: value });

  const updateOption = (oi, value) => {
    const opts = [...question.options];
    opts[oi] = value;
    onChange(index, { ...question, options: opts });
  };

  return (
    <div className={styles.block}>
      {/* Header */}
      <div className={styles.blockHeader}>
        <span className={styles.qNum}>Question {index + 1} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/ {total}</span></span>
        {total > 1 && (
          <button className={styles.removeBtn} onClick={() => onRemove(index)} title="Remove question">✕</button>
        )}
      </div>

      {/* Question text */}
      <div className="form-group">
        <label className="form-label">Question Text *</label>
        <textarea
          className="form-input"
          rows={2}
          placeholder="Enter your question here…"
          value={question.question_text}
          onChange={e => update('question_text', e.target.value)}
        />
      </div>

      {/* Answer options */}
      <div className="form-label" style={{ marginBottom: 10 }}>Answer Options *</div>
      <div className={styles.optionsGrid}>
        {question.options.map((opt, oi) => (
          <div key={oi} className={styles.optionRow}>
            <span
              className={styles.optLabel}
              style={{ background: OPT_STYLES[oi].bg, color: OPT_STYLES[oi].color }}
            >
              {LETTERS[oi]}
            </span>
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder={`Option ${LETTERS[oi]}`}
              value={opt}
              onChange={e => updateOption(oi, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Correct answer */}
      <div className={styles.bottomRow}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label">Correct Answer</label>
          <select
            className="form-input"
            value={question.correct_answer}
            onChange={e => update('correct_answer', parseInt(e.target.value))}
          >
            {question.options.map((opt, oi) => (
              <option key={oi} value={oi}>
                {LETTERS[oi]}{opt ? ': ' + opt.slice(0, 35) : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
          <label className="form-label">Explanation <span style={{ color: 'var(--text3)' }}>(optional)</span></label>
          <input
            className="form-input"
            placeholder="Why is this the correct answer?"
            value={question.explanation || ''}
            onChange={e => update('explanation', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
