// PATH: quiz-platform/frontend/src/hooks/useQuizzes.js
import { useState, useEffect, useCallback } from 'react';
import { quizAPI, miscAPI, userAPI } from '../utils/api';

export function useQuizzes(params = {}) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const key = JSON.stringify(params);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await quizAPI.getAll(JSON.parse(key));
      setQuizzes(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load quizzes');
    } finally { setLoading(false); }
  }, [key]);

  useEffect(() => { fetch(); }, [fetch]);
  return { quizzes, loading, error, refetch: fetch };
}

export function useQuiz(id) {
  const [quiz,    setQuiz]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError(null);
    quizAPI.getById(id)
      .then(r  => setQuiz(r.data))
      .catch(e => setError(e.response?.data?.error || 'Quiz not found'))
      .finally(() => setLoading(false));
  }, [id]);

  return { quiz, loading, error, setQuiz };
}

export function useMyQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await quizAPI.getMine();
      setQuizzes(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load quizzes');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { quizzes, loading, error, refetch: fetch };
}

export function useLeaderboard(quizId) {
  const [board,   setBoard]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!quizId) return;
    quizAPI.leaderboard(quizId)
      .then(r  => setBoard(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [quizId]);

  return { board, loading };
}

export function useStats() {
  const [stats,   setStats]   = useState({ totalQuizzes: 0, totalAttempts: 0, totalUsers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    miscAPI.stats()
      .then(r  => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}

export function useUserAttempts(userId) {
  const [attempts, setAttempts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetch = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Pass user ID to get their attempts
      const { data } = await userAPI.attempts(userId);
      setAttempts(data || []);
    } catch (e) {
      console.error('Failed to fetch attempts:', e.message);
      setError(e.response?.data?.error || 'Failed to load history');
      setAttempts([]);
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { attempts, loading, error, refetch: fetch };
}
