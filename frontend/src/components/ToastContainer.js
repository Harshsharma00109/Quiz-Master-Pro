// PATH: quiz-platform/frontend/src/components/ToastContainer.js
import React from 'react';
import { useToast } from '../context/ToastContext';
import styles from './ToastContainer.module.css';

const ICONS  = { success: '✓', error: '✕', info: '✦' };
const COLORS = { success: 'var(--accent3)', error: '#ef4444', info: 'var(--accent)' };

export default function ToastContainer() {
  const { toasts } = useToast();
  if (!toasts.length) return null;

  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <span className={styles.icon} style={{ color: COLORS[t.type] }}>
            {ICONS[t.type]}
          </span>
          <span className={styles.msg}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
