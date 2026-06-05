// PATH: src/services/groqTranslationService.js

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-8b-8192';

const memCache = new Map();

// ✅ Strong cache key (no collision)
function cacheKey(text, targetLang) {
  const hash = btoa(unescape(encodeURIComponent(text))).slice(0, 50);
  return `gtrans_${targetLang}_${hash}`;
}

function readCache(key) {
  if (memCache.has(key)) return memCache.get(key);
  try {
    const v = localStorage.getItem(key);
    if (v) {
      memCache.set(key, v);
      return v;
    }
  } catch {}
  return null;
}

function writeCache(key, value) {
  memCache.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// ✅ Retry logic
async function fetchWithRetry(url, options, retries = 2) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return res;
  } catch (err) {
    if (retries === 0) throw err;
    return fetchWithRetry(url, options, retries - 1);
  }
}

// ✅ MAIN FUNCTION
export async function translateBatch(texts, targetLang, apiKey) {
  console.log("🚀 translateBatch called", { targetLang, apiKey });

  if (!apiKey) {
    console.warn("❌ Missing API Key");
    return texts;
  }

  if (!texts || texts.length === 0) return [];
  if (targetLang === 'en') return texts;

  const results = new Array(texts.length);
  const missing = [];

  texts.forEach((text, idx) => {
    if (!text || !text.trim()) {
      results[idx] = text;
      return;
    }

    const key = cacheKey(text, targetLang);
    const cached = readCache(key);

    if (cached) {
      results[idx] = cached;
    } else {
      missing.push({ idx, text });
    }
  });

  if (missing.length === 0) return results;

  const numbered = missing.map((m, i) => `${i + 1}. ${m.text}`).join('\n');

  const prompt = `Translate the following numbered strings to ${targetLang}.

Rules:
- Return EXACTLY in this format:
1. ...
2. ...
- Do not skip numbers
- Do not merge lines
- Preserve {{variables}}, numbers, and emojis
- No explanations

Strings:
${numbered}`;

  try {
    console.log("📡 Calling Groq API...");

    const res = await fetchWithRetry(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';

    console.log("📩 RAW RESPONSE:", raw);

    // ✅ Strong parser (handles 1. / 1) / 1 -)
    const matches =
      raw.match(/\d+[\.\)\-]\s*(.*?)(?=\n\d+[\.\)\-]|\n?$)/gs) || [];

    matches.forEach((line, index) => {
      const text = line.replace(/^\d+[\.\)\-]\s*/, '').trim();
      const m = missing[index];
      if (!m) return;

      results[m.idx] = text;
      writeCache(cacheKey(m.text, targetLang), text);
    });

    // fallback
    missing.forEach((m) => {
      if (!results[m.idx]) results[m.idx] = m.text;
    });

  } catch (err) {
    console.error("❌ API ERROR:", err.message);
    missing.forEach((m) => {
      results[m.idx] = m.text;
    });
  }

  return results;
}

// ✅ Single translate
export async function translateOne(text, targetLang, apiKey) {
  if (!text || !text.trim() || targetLang === 'en') return text;

  const key = cacheKey(text, targetLang);
  const cached = readCache(key);
  if (cached) return cached;

  const [res] = await translateBatch([text], targetLang, apiKey);
  return res || text;
}

// ✅ Clear cache
export function clearTranslationCache() {
  memCache.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('gtrans_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}