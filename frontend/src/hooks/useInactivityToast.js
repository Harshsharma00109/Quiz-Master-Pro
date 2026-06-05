// PATH: quiz-platform/frontend/src/hooks/useInactivityToast.js
// Drop this hook into your App.js:
//   import { useInactivityToast } from './hooks/useInactivityToast';
//   function App() { useInactivityToast(); ... }

import { useEffect } from 'react';
import { useToast }  from '../context/ToastContext';

export function useInactivityToast() {
  const { toast } = useToast();

  useEffect(() => {
    const handler = () => {
      toast.warning('You were logged out due to 30 minutes of inactivity.');
    };
    window.addEventListener('auth:inactivity-logout', handler);
    return () => window.removeEventListener('auth:inactivity-logout', handler);
  }, [toast]);
}
