// PATH: quiz-platform/frontend/src/components/ProctoringWarning.js
import React, { useEffect, useState } from 'react';

const VIOLATION_INFO = {
  tab_switch:         { icon: '🪟', label: 'You switched tabs',        desc: 'Switching tabs during a proctored quiz is not allowed.' },
  window_blur:        { icon: '💨', label: 'You left the window',      desc: 'Leaving the quiz window was detected.' },
  copy_attempt:       { icon: '📋', label: 'Copy/paste attempt',       desc: 'Copying or pasting during a quiz is not allowed.' },
  right_click:        { icon: '🖱',  label: 'Right-click detected',    desc: 'Right-clicking or using DevTools is not allowed.' },
  face_not_visible:   { icon: '👁',  label: 'Face not visible',        desc: 'Please stay in front of your camera.' },
  camera_covered:     { icon: '📷', label: 'Camera covered',           desc: 'Do not cover or block your camera.' },
  excessive_movement: { icon: '🏃', label: 'Excessive movement',       desc: 'Too much movement was detected. Please stay still.' },
  unknown:            { icon: '⚠️', label: 'Violation detected',       desc: 'A proctoring violation was recorded.' },
};

// ── Warning overlay (shown on 1st and 2nd violation) ─────────
export default function ProctoringWarning({ warningCount, onDismiss, lastViolationType }) {
  const [countdown, setCountdown] = useState(8);

  const info = VIOLATION_INFO[lastViolationType] || VIOLATION_INFO.unknown;
  const isFinal = warningCount >= 2;

  useEffect(() => {
    setCountdown(8);
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); onDismiss?.(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [warningCount]); // eslint-disable-line

  return (
    <div style={{
      position:   'fixed',
      inset:       0,
      zIndex:      99998,
      display:     'flex',
      alignItems:  'center',
      justifyContent: 'center',
      background:  'rgba(0,0,0,.75)',
      backdropFilter: 'blur(6px)',
      animation:   'fadeIn .2s ease',
    }}>
      <div style={{
        background:   'var(--surface,#1a1a2e)',
        border:       `2px solid ${isFinal ? '#ef4444' : '#f97316'}`,
        borderRadius: 16,
        padding:      '32px 28px',
        maxWidth:     420,
        width:        '90%',
        textAlign:    'center',
        boxShadow:    `0 0 40px ${isFinal ? 'rgba(239,68,68,.3)' : 'rgba(249,115,22,.25)'}`,
        animation:    'slideUp .25s ease',
      }}>
        {/* Icon */}
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{info.icon}</div>

        {/* Warning number badge */}
        <div style={{
          display:      'inline-block',
          fontSize:     '.72rem',
          fontWeight:   800,
          padding:      '4px 14px',
          borderRadius: 99,
          marginBottom: 14,
          background:   isFinal ? 'rgba(239,68,68,.15)' : 'rgba(249,115,22,.15)',
          color:        isFinal ? '#ef4444' : '#f97316',
          border:       `1px solid ${isFinal ? 'rgba(239,68,68,.35)' : 'rgba(249,115,22,.35)'}`,
          letterSpacing: '.06em',
        }}>
          WARNING {warningCount} OF 2
        </div>

        <h2 style={{
          fontFamily:   'Syne,sans-serif',
          fontWeight:   800,
          fontSize:     '1.2rem',
          color:        isFinal ? '#ef4444' : '#f97316',
          marginBottom: 8,
        }}>
          {info.label}
        </h2>

        <p style={{ fontSize: '.88rem', color: 'rgba(200,200,220,.75)', marginBottom: 16, lineHeight: 1.6 }}>
          {info.desc}
        </p>

        {/* Final warning message */}
        {isFinal && (
          <div style={{
            background:   'rgba(239,68,68,.1)',
            border:       '1px solid rgba(239,68,68,.25)',
            borderRadius: 10,
            padding:      '10px 14px',
            marginBottom: 16,
            fontSize:     '.82rem',
            color:        '#ef4444',
            fontWeight:   600,
          }}>
            🚨 This is your FINAL warning.<br />
            One more violation will auto-submit your quiz.
          </div>
        )}

        {/* Warning bar */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
          {[1, 2].map(n => (
            <div key={n} style={{
              flex:         1, maxWidth: 80, height: 6, borderRadius: 99,
              background:   warningCount >= n ? '#f97316' : 'rgba(255,255,255,.1)',
              transition:   'background .3s',
            }} />
          ))}
        </div>

        <button
          onClick={onDismiss}
          style={{
            width:        '100%',
            padding:      '12px',
            borderRadius: 10,
            border:       'none',
            background:   isFinal ? '#ef4444' : '#f97316',
            color:        '#fff',
            fontWeight:   700,
            fontSize:     '.9rem',
            cursor:       'pointer',
            fontFamily:   'DM Sans,sans-serif',
          }}
        >
          I Understand — Continue Quiz ({countdown}s)
        </button>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

// ── Auto-submit overlay (shown when quiz is force-submitted) ──
export function ProctoringAutoSubmit() {
  return (
    <div style={{
      position:   'fixed',
      inset:       0,
      zIndex:      99999,
      display:     'flex',
      alignItems:  'center',
      justifyContent: 'center',
      background:  'rgba(0,0,0,.88)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background:   'var(--surface,#1a1a2e)',
        border:       '2px solid #ef4444',
        borderRadius: 16,
        padding:      '36px 28px',
        maxWidth:     400,
        width:        '90%',
        textAlign:    'center',
        boxShadow:    '0 0 60px rgba(239,68,68,.4)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚫</div>
        <h2 style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: '1.3rem', color: '#ef4444', marginBottom: 10 }}>
          Quiz Auto-Submitted
        </h2>
        <p style={{ fontSize: '.88rem', color: 'rgba(200,200,220,.7)', lineHeight: 1.6, marginBottom: 16 }}>
          You received 3 proctoring violations. Your quiz has been automatically submitted and your answers have been recorded.
        </p>
        <div style={{ fontSize: '.75rem', color: 'rgba(200,200,220,.4)' }}>
          Calculating your results…
        </div>
        {/* Spinner */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    </div>
  );
}