// PATH: quiz-platform/frontend/src/hooks/useTimer.js
import { useState, useEffect, useRef } from 'react';

export function useTimer(active = true) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const startRef    = useRef(Date.now());

  useEffect(() => {
    if (!active) { clearInterval(intervalRef.current); return; }
    startRef.current  = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [active]); // eslint-disable-line

  const reset = () => {
    setElapsed(0);
    startRef.current = Date.now();
  };

  return { elapsed, reset };
}

export function useCountdown(seconds, onExpire) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!seconds) return;
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [seconds]); // eslint-disable-line

  return remaining;
}
