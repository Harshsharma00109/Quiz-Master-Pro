// src/components/LanguageSwitcher.js
import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getLanguageGroups } from '../i18n/translations';

const groups = getLanguageGroups();

export default function LanguageSwitcher() {
  const { language, changeLanguage, languageFlag, languageName } = useLanguage();
  const [open, setOpen] = useState(false);
  const btnRef  = useRef(null);
  const dropRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (code) => {
    changeLanguage(code);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <style>{`
        @keyframes langDropIn {
          from { opacity:0; transform:translateY(-6px) scale(.97); }
          to   { opacity:1; transform:translateY(0)   scale(1);    }
        }
        .lang-drop  { animation: langDropIn .17s cubic-bezier(.25,.8,.25,1); }
        .lang-opt:hover { background: var(--surface2) !important; }
        .lang-btn:hover { background: rgba(108,99,255,.15) !important; }
      `}</style>

      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="lang-btn"
        title={`Language: ${languageName}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 8,
          background: open ? 'rgba(108,99,255,.18)' : 'rgba(108,99,255,.08)',
          border: `1px solid ${open ? 'rgba(108,99,255,.5)' : 'rgba(108,99,255,.2)'}`,
          fontSize: '.78rem', fontWeight: 700, color: 'var(--accent)',
          cursor: 'pointer', transition: 'all .15s',
        }}>
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>{languageFlag}</span>
        <span style={{ maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {languageName}
        </span>
        <span style={{ fontSize: '.6rem', opacity: .7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropRef}
          className="lang-drop"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 240, maxHeight: 380, overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid rgba(108,99,255,.2)',
            borderRadius: 14, zIndex: 500,
            boxShadow: '0 12px 40px rgba(0,0,0,.45)',
          }}>

          {Object.entries(groups).map(([category, langs]) => (
            <div key={category}>
              {/* Category header */}
              <div style={{
                padding: '8px 14px 4px',
                fontSize: '.65rem', fontWeight: 800,
                color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.4,
                borderTop: '1px solid var(--border)',
              }}>
                {category}
              </div>

              {/* Language options */}
              {langs.map(({ code, name, flag }) => (
                <button
                  key={code}
                  onClick={() => select(code)}
                  className="lang-opt"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', border: 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'background .12s',
                    borderLeft: code === language ? '3px solid var(--accent)' : '3px solid transparent',
                    background: code === language ? 'rgba(108,99,255,.08)' : 'none',  // ✅ single background key
                  }}>
                  <span style={{ fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }}>{flag}</span>
                  <span style={{
                    fontSize: '.83rem', fontWeight: code === language ? 700 : 500,
                    color: code === language ? 'var(--accent)' : 'var(--text)',
                  }}>
                    {name}
                  </span>
                  {code === language && (
                    <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: '.75rem' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
