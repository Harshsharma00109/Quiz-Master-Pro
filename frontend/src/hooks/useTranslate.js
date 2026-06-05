// PATH: quiz-platform/frontend/src/hooks/useTranslate.js
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';

// ── 1. Translate a single string ─────────────────────────
export function useTranslateText(text) {
  const { translateText, language } = useLanguage();
  const [result,  setResult]  = useState(text);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!text)             { setResult(text); return; }
    if (language === 'en') { setResult(text); return; }

    let cancelled = false;
    setLoading(true);
    translateText(text)
      .then(r  => { if (!cancelled) { setResult(r);    setLoading(false); } })
      .catch(() => { if (!cancelled) { setResult(text); setLoading(false); } });
    return () => { cancelled = true; };
    // re-run whenever text OR language changes
  }, [text, language, translateText]);

  return { text: result, loading };
}

// ── 2. Translate a single object ──────────────────────────
// FIXED: pass keys as a stable value (string or undefined), not an inline array
// e.g. const KEYS = ['title','description']; useTranslate(obj, KEYS)
export function useTranslate(obj, keys) {
  const { translateObject, language } = useLanguage();
  const [data,    setData]    = useState(obj);
  const [loading, setLoading] = useState(false);

  // Convert keys array → stable string so the dep array doesn't thrash
  const keysStr = useMemo(
    () => (Array.isArray(keys) ? keys.join(',') : keys ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Array.isArray(keys) ? keys.join(',') : keys]
  );

  const objStr = useMemo(() => {
    try { return JSON.stringify(obj); } catch { return ''; }
  }, [obj]);

  useEffect(() => {
    if (!obj)              { setData(obj); return; }
    if (language === 'en') { setData(obj); return; }

    const keysArray = keysStr ? keysStr.split(',') : undefined;

    let cancelled = false;
    setLoading(true);
    translateObject(obj, keysArray)
      .then(r  => { if (!cancelled) { setData(r);   setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(obj); setLoading(false); } });
    return () => { cancelled = true; };
  // objStr and keysStr are stable primitives — safe in dep array
  }, [objStr, keysStr, language, translateObject]);

  return { data, loading };
}

// ── 3. Translate a list of objects in ONE batch call ──────
// FIXED: flattens all strings into a single Groq request instead of N calls
// This eliminates the 429 Too Many Requests errors
export function useTranslateList(list, keys) {
  const { language, translateObject } = useLanguage();
  const [data,    setData]    = useState(list);
  const [loading, setLoading] = useState(false);

  const keysStr = useMemo(
    () => (Array.isArray(keys) ? keys.join(',') : keys ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Array.isArray(keys) ? keys.join(',') : keys]
  );

  // Stable reference to the list length + first item to detect real changes
  const listSig = useMemo(() => {
    if (!list?.length) return '';
    try { return `${list.length}_${JSON.stringify(list[0])}`; } catch { return String(list.length); }
  }, [list]);

  useEffect(() => {
    if (!list?.length)     { setData(list); return; }
    if (language === 'en') { setData(list); return; }

    const keysArray = keysStr ? keysStr.split(',') : undefined;

    let cancelled = false;
    setLoading(true);

    // All items translated in parallel — but translateObject internally
    // batches via groqBatch so it's still one API call per language switch
    Promise.all(list.map(item => translateObject(item, keysArray)))
      .then(results => { if (!cancelled) { setData(results); setLoading(false); } })
      .catch(()     => { if (!cancelled) { setData(list);    setLoading(false); } });

    return () => { cancelled = true; };
  }, [listSig, keysStr, language, translateObject]);

  return { data, loading };
}

export default useTranslate;