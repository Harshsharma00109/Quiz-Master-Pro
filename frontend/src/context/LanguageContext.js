// PATH: quiz-platform/frontend/src/context/LanguageContext.js
// FIXED: t() now actually works + Groq API for dynamic content

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations from '../i18n/translations';

const LanguageContext = createContext(null);

// ── Groq config ──────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama3-8b-8192';
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || '';

// ── In-memory + localStorage cache ───────────────────────
const memCache = new Map();

function cacheKey(text, lang) {
  return `gt_${lang}_${text.slice(0, 80).replace(/\W+/g, '_')}`;
}
function readCache(k) {
  if (memCache.has(k)) return memCache.get(k);
  try { const v = localStorage.getItem(k); if (v) { memCache.set(k, v); return v; } } catch {}
  return null;
}
function writeCache(k, v) {
  memCache.set(k, v);
  try { localStorage.setItem(k, v); } catch {}
}

// ── Batch translate via Groq ──────────────────────────────
async function groqBatch(texts, targetLang) {
  if (!GROQ_API_KEY || targetLang === 'en' || !texts.length) return texts;

  const results = new Array(texts.length);
  const missing = [];

  texts.forEach((text, idx) => {
    const k = cacheKey(text, targetLang);
    const c = readCache(k);
    if (c) results[idx] = c;
    else missing.push({ idx, text });
  });

  if (!missing.length) return results;

  const numbered = missing.map((m, i) => `${i + 1}. ${m.text}`).join('\n');

  const langName = translations[targetLang]?.name || targetLang;

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.1,
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Translate these numbered strings to ${langName}. Rules:
- Keep numbering format "1. text"
- Keep placeholders like {{amount}} {{date}} {{n}} unchanged
- Keep emojis unchanged
- No extra notes, ONLY numbered translations

${numbered}`,
        }],
      }),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content || '';

    raw.split('\n').forEach(line => {
      const m = line.trim().match(/^(\d+)\.\s+([\s\S]*)/);
      if (!m) return;
      const i   = parseInt(m[1], 10) - 1;
      const mis = missing[i];
      if (!mis) return;
      const val = m[2].trim();
      results[mis.idx] = val;
      writeCache(cacheKey(mis.text, targetLang), val);
    });

  } catch (err) {
    console.warn('[GroqTranslate] error:', err.message);
  }

  missing.forEach(m => { if (!results[m.idx]) results[m.idx] = m.text; });
  return results;
}

// ── Public API ─────────────────────────────────────────────
export function clearTranslationCache() {
  memCache.clear();
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('gt_'))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() =>
    localStorage.getItem('quizmaster_language') || 'en'
  );

  const currentLang = translations[language] || translations['en'];

  useEffect(() => {
    document.documentElement.setAttribute('dir', currentLang.dir || 'ltr');
    document.documentElement.setAttribute('lang', language);
    localStorage.setItem('quizmaster_language', language);
  }, [language, currentLang.dir]);

  const t = useCallback((key, params = {}) => {
    let text =
      currentLang.translations?.[key] ||
      translations['en'].translations?.[key] ||
      key;

    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    });

    return text;
  }, [currentLang]);

  const translateText = useCallback(async (text) => {
    if (!text || language === 'en') return text;
    const k = cacheKey(text, language);
    const c = readCache(k);
    if (c) return c;
    const [result] = await groqBatch([text], language);
    return result || text;
  }, [language]);

  const translateArray = useCallback(async (arr) => {
    if (!arr?.length || language === 'en') return arr;
    return groqBatch(arr, language);
  }, [language]);

  const translateObject = useCallback(async (obj, keys) => {
    if (!obj || language === 'en') return obj;
    const pickedKeys = keys || Object.keys(obj).filter(k => typeof obj[k] === 'string' && obj[k].trim());
    const texts      = pickedKeys.map(k => obj[k] || '');
    const translated = await groqBatch(texts, language);
    const result     = { ...obj };
    pickedKeys.forEach((k, i) => { result[k] = translated[i]; });
    return result;
  }, [language]);

  const changeLanguage = useCallback((code) => {
    if (translations[code]) setLanguage(code);
  }, []);

  const value = {
    language,
    changeLanguage,
    t,
    translateText,
    translateArray,
    translateObject,
    dir: currentLang.dir || 'ltr',
    languageName: currentLang.name,
    languageFlag: currentLang.flag,
    isRTL: currentLang.dir === 'rtl',
    hasGroq: Boolean(GROQ_API_KEY),
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};

export default LanguageContext;
