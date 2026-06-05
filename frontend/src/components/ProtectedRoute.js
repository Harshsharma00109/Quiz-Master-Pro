// PATH: quiz-platform/frontend/src/components/ProtectedRoute.js
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import AuthModal    from './AuthModal';

export default function ProtectedRoute({ children }) {
  const { user }  = useAuth();
  const [mode, setMode] = useState('login');

  if (user) return children;

  // Show auth modal over a redirect hint
  return (
    <>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: 16,
        color: 'var(--text2)', textAlign: 'center', padding: 24,
      }}>
        <div style={{ fontSize: '3rem', opacity: .5 }}>🔒</div>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>
          Sign in required
        </div>
        <p>You need an account to access this page.</p>
      </div>
      <AuthModal
        mode={mode}
        onClose={() => { /* stay on page */ }}
        onSwitch={setMode}
      />
    </>
  );
}
