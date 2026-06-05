// PATH: quiz-platform/frontend/src/components/AITutorModal.js
// Shows after user answers wrong - explains why, teaches concept, suggests practice
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function AITutorModal({ question, userAnswer, correctAnswer, options, topic, onClose, onNext }) {
  const [explanation, setExplanation] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    api.post('/ai/tutor', { question, user_answer: userAnswer, correct_answer: correctAnswer, options, topic })
      .then(r => setExplanation(r.data))
      .catch(() => setError('AI tutor unavailable. Check your internet connection.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', backdropFilter:'blur(12px)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--surface)', border:'1px solid rgba(108,99,255,.3)', borderRadius:20, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
        
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,rgba(108,99,255,.2),rgba(139,92,246,.1))', padding:'18px 22px', borderBottom:'1px solid rgba(108,99,255,.2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'1.5rem' }}>🤖</span>
            <div>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:'.95rem' }}>AI Tutor</div>
              <div style={{ fontSize:'.72rem', color:'var(--text3)' }}>Learning from mistakes</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:'1.1rem' }}>✕</button>
        </div>

        <div style={{ padding:22 }}>
          {/* The question */}
          <div style={{ background:'var(--surface2)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
            <div style={{ fontSize:'.72rem', color:'var(--text3)', fontWeight:600, marginBottom:5, textTransform:'uppercase', letterSpacing:.5 }}>Question</div>
            <div style={{ fontSize:'.88rem', color:'var(--text)', lineHeight:1.5 }}>{question}</div>
          </div>

          {/* Answer comparison */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
            <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ fontSize:'.7rem', color:'#ef4444', fontWeight:600, marginBottom:4 }}>❌ Your Answer</div>
              <div style={{ fontSize:'.85rem', fontWeight:600 }}>{options?.[userAnswer] || `Option ${userAnswer}`}</div>
            </div>
            <div style={{ background:'rgba(0,212,170,.1)', border:'1px solid rgba(0,212,170,.25)', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ fontSize:'.7rem', color:'#00d4aa', fontWeight:600, marginBottom:4 }}>✅ Correct Answer</div>
              <div style={{ fontSize:'.85rem', fontWeight:600 }}>{options?.[correctAnswer] || `Option ${correctAnswer}`}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ width:40, height:40, border:'3px solid rgba(108,99,255,.2)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 12px' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontSize:'.88rem', color:'var(--text3)' }}>AI is preparing your explanation…</div>
            </div>
          ) : error ? (
            <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:10, padding:16, textAlign:'center', color:'#ef4444', fontSize:'.85rem' }}>
              ⚠️ {error}
            </div>
          ) : explanation ? (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Why wrong */}
              <div style={{ background:'rgba(239,68,68,.06)', border:'1px solid rgba(239,68,68,.15)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:'1rem' }}>❌</span>
                  <span style={{ fontWeight:700, fontSize:'.85rem', color:'#ef4444' }}>Why You Were Wrong</span>
                </div>
                <p style={{ fontSize:'.85rem', color:'var(--text2)', lineHeight:1.6, margin:0 }}>{explanation.why_wrong}</p>
              </div>

              {/* Correct explanation */}
              <div style={{ background:'rgba(0,212,170,.06)', border:'1px solid rgba(0,212,170,.15)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:'1rem' }}>✅</span>
                  <span style={{ fontWeight:700, fontSize:'.85rem', color:'#00d4aa' }}>The Correct Explanation</span>
                </div>
                <p style={{ fontSize:'.85rem', color:'var(--text2)', lineHeight:1.6, margin:0 }}>{explanation.correct_explanation}</p>
              </div>

              {/* Key concept */}
              <div style={{ background:'rgba(108,99,255,.08)', border:'1px solid rgba(108,99,255,.2)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:'1rem' }}>💡</span>
                  <span style={{ fontWeight:700, fontSize:'.85rem', color:'var(--accent)' }}>Key Concept</span>
                </div>
                <p style={{ fontSize:'.85rem', color:'var(--text2)', lineHeight:1.6, margin:0 }}>{explanation.key_concept}</p>
              </div>

              {/* Quick tip */}
              {explanation.quick_tip && (
                <div style={{ background:'rgba(234,179,8,.08)', border:'1px solid rgba(234,179,8,.2)', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <span style={{ fontSize:'1rem' }}>⚡</span>
                    <span style={{ fontWeight:700, fontSize:'.85rem', color:'#eab308' }}>Quick Tip</span>
                  </div>
                  <p style={{ fontSize:'.85rem', color:'var(--text2)', lineHeight:1.6, margin:0 }}>{explanation.quick_tip}</p>
                </div>
              )}

              {/* Practice suggestion */}
              {explanation.practice_suggestion && (
                <div style={{ background:'var(--surface2)', borderRadius:10, padding:'10px 14px', fontSize:'.82rem', color:'var(--text3)', display:'flex', gap:8 }}>
                  <span>📚</span><span>{explanation.practice_suggestion}</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Buttons */}
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            <button className="btn btn-secondary" style={{ flex:1 }} onClick={onClose}>
              Got It ✓
            </button>
            {onNext && (
              <button className="btn btn-primary" style={{ flex:1 }} onClick={onNext}>
                Next Question →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
