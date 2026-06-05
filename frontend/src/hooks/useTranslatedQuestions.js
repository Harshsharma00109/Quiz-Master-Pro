// PATH: quiz-platform/frontend/src/hooks/useTranslatedQuestions.js
// Translates quiz questions via YOUR OWN BACKEND (/api/translate)
// No REACT_APP_GROQ_API_KEY needed — uses the server Groq key securely.

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

const RAW_API = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BASE    = RAW_API.endsWith('/api') ? RAW_API : `${RAW_API}/api`;

// In-memory cache: "Português|What is..." → "O que é..."
const cache = new Map();
function cacheKey(langName, text) {
  return `${langName}|${text?.slice(0, 80) || ''}`;
}

async function backendTranslate(texts, languageName) {
  if (!texts?.length || languageName === 'English') return texts;

  const results = texts.map(t => t); // pre-fill with originals as safe fallback
  const missing = [];
  texts.forEach((text, idx) => {
    const k = cacheKey(languageName, text);
    if (cache.has(k)) results[idx] = cache.get(k);
    else missing.push({ idx, text });
  });
  if (!missing.length) return results;

  const res = await fetch(`${BASE}/translate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      texts:      missing.map(m => m.text),
      targetLang: languageName, // full name e.g. "Português" — Groq understands better than "pt"
    }),
  });

  if (!res.ok) throw new Error(`/api/translate returned ${res.status}`);
  const data       = await res.json();
  const translated = data.translated || [];

  missing.forEach((m, i) => {
    const val = translated[i] || m.text;
    results[m.idx] = val;
    cache.set(cacheKey(languageName, m.text), val);
  });

  return results;
}

export function useTranslatedQuestions(rawQuestions) {
  // language     = "pt"         — used for English check only
  // languageName = "Português"  — passed to backend/Groq for better translation
  const { language, languageName } = useLanguage();
  const [questions,   setQuestions]   = useState(rawQuestions || []);
  const [translating, setTranslating] = useState(false);
  const abortRef    = useRef(null);
  const prevLangRef = useRef(languageName);
  const prevQsRef   = useRef(rawQuestions);

  useEffect(() => {
    if (!rawQuestions?.length) { setQuestions([]); return; }

    // English — return originals instantly
    if (language === 'en') { setQuestions(rawQuestions); return; }

    // Nothing changed — skip
    if (languageName === prevLangRef.current && rawQuestions === prevQsRef.current) return;

    prevLangRef.current = languageName;
    prevQsRef.current   = rawQuestions;

    // Abort token — marks in-flight requests as stale
    const token = {};
    abortRef.current = token;
    setTranslating(true);

    // Flatten all strings into ONE backend call:
    // [q0_question, q0_opt0, q0_opt1, q0_opt2, q0_opt3, q0_explanation,
    //  q1_question, q1_opt0, ...]
    const OPTS   = 4;
    const STRIDE = 1 + OPTS + 1;
    const flat   = [];

    rawQuestions.forEach(q => {
      flat.push(q.question_text || '');
      for (let i = 0; i < OPTS; i++) flat.push(q.options?.[i] || '');
      flat.push(q.explanation   || '');
    });

    backendTranslate(flat, languageName)
      .then(translated => {
        if (abortRef.current !== token) return; // stale — discard

        const result = rawQuestions.map((q, i) => {
          const base = i * STRIDE;
          return {
            ...q,
            question_text: translated[base]                     || q.question_text,
            options:       translated.slice(base + 1, base + 1 + OPTS)
                             .map((t, oi) => t || q.options?.[oi] || ''),
            explanation:   translated[base + 1 + OPTS]          || q.explanation || '',
          };
        });

        setQuestions(result);
        setTranslating(false);
      })
      .catch(err => {
        if (abortRef.current !== token) return;
        console.warn('[useTranslatedQuestions] failed, showing originals:', err.message);
        setQuestions(rawQuestions); // graceful fallback — quiz still works
        setTranslating(false);
      });

  }, [rawQuestions, language, languageName]); // eslint-disable-line react-hooks/exhaustive-deps

  return { questions, translating };
}