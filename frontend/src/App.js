// PATH: quiz-platform/frontend/src/App.js
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider }    from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider }   from './context/ToastContext';
import { useAuth }         from './context/AuthContext';
import Navbar              from './components/Navbar';
import ToastContainer      from './components/ToastContainer';
import ProtectedRoute      from './components/ProtectedRoute';
import SupportWidget       from './components/SupportWidget';
import { WelcomeToast, NewDevicePopup } from './components/NotificationCenter';
import StreakRewardPopup   from './components/StreakRewardPopup';

import LeaderboardPage       from './pages/LeaderboardPage';
import StreakDashboard        from './pages/StreakDashboard';
import EventsPage             from './pages/EventsPage';
import TerminateSessionPage   from './pages/TerminateSessionPage';
import HomePage               from './pages/HomePage';
import BrowsePage             from './pages/BrowsePage';
import QuizPreviewPage        from './pages/QuizPreviewPage';
import TakeQuizPage           from './pages/TakeQuizPage';
import ResultsPage            from './pages/ResultsPage';      // ← was MISSING from routes!
import CreateQuizPage         from './pages/CreateQuizPage';
import EditQuizPage           from './pages/EditQuizPage';
import AIQuizPage             from './pages/AIQuizPage';
import ProfilePage            from './pages/ProfilePage';
import PublicProfilePage      from './pages/PublicProfilePage';
import MyQuizzesPage          from './pages/MyQuizzesPage';
import HistoryPage            from './pages/HistoryPage';
import BookmarksPage          from './pages/BookmarksPage';
import CreatorDashboard       from './pages/CreatorDashboard';
import ChallengePage          from './pages/ChallengePage';
import AdminDashboard         from './pages/AdminDashboard';
import AdminProctoringPage    from './pages/AdminProctoringPage'; // ← NEW
import SubscriptionPage       from './pages/SubscriptionPage';
import SpinWheelPage          from './components/SpinWheel';
import UserDashboard          from './pages/UserDashboard';

// ── Streak milestones ─────────────────────────────────────────
const STREAK_MILESTONES = [
  { days: 3,   key: 'streak_3',   label: 'On Fire',        emoji: '🔥', xp: 50   },
  { days: 7,   key: 'streak_7',   label: 'Week Warrior',   emoji: '📅', xp: 100  },
  { days: 14,  key: 'streak_14',  label: 'Fortnight Fire', emoji: '💪', xp: 200  },
  { days: 30,  key: 'streak_30',  label: 'Monthly Master', emoji: '🏆', xp: 500  },
  { days: 60,  key: 'streak_60',  label: 'Unstoppable',    emoji: '⚡', xp: 800  },
  { days: 100, key: 'streak_100', label: 'Century Legend', emoji: '💯', xp: 1500 },
];

function getMilestone(streakCount) {
  return STREAK_MILESTONES.find(m => m.days === streakCount) || null;
}

function LoginTracker() {
  const location = useLocation();
  useEffect(() => {
    if (location.state?.just_logged_in) sessionStorage.setItem('qm_just_logged_in', '1');
  }, [location]);
  return null;
}

// ── AppInner ──────────────────────────────────────────────────
function AppInner() {
  const { user } = useAuth();
  const [streakReward, setStreakReward] = useState(null);

  useEffect(() => {
    if (!user?.streak_count) return;
    const milestone = getMilestone(user.streak_count);
    if (!milestone) return;
    const seenKey = `qm_streak_seen_${milestone.key}`;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, '1');
    setStreakReward(milestone);
  }, [user?.streak_count]);

  return (
    <>
      <LoginTracker />
      <Navbar />
      <main style={{ paddingTop: 64, minHeight: '100vh' }}>
        <Routes>
          {/* ── Public routes ───────────────────────────────── */}
          <Route path="/"                  element={<HomePage />} />
          <Route path="/browse"            element={<BrowsePage />} />
          <Route path="/quiz/:id"          element={<QuizPreviewPage />} />
          <Route path="/quiz/:id/take"     element={<TakeQuizPage />} />

          {/* ✅ THIS WAS THE MISSING ROUTE — causes "No results" bug */}
          <Route path="/results"           element={<ResultsPage />} />

          <Route path="/ai"                element={<AIQuizPage />} />
          <Route path="/challenge/:token"  element={<ChallengePage />} />
          <Route path="/u/:username"       element={<PublicProfilePage />} />
          <Route path="/events"            element={<EventsPage />} />
          <Route path="/terminate-session" element={<TerminateSessionPage />} />
          <Route path="/leaderboard"       element={<LeaderboardPage />} />

          {/* ── Protected routes ────────────────────────────── */}
          <Route path="/streak"       element={<ProtectedRoute><StreakDashboard /></ProtectedRoute>} />
          <Route path="/spin"         element={<ProtectedRoute><SpinWheelPage /></ProtectedRoute>} />
          <Route path="/dashboard"    element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/create"       element={<ProtectedRoute><CreateQuizPage /></ProtectedRoute>} />
          <Route path="/edit/:id"     element={<ProtectedRoute><EditQuizPage /></ProtectedRoute>} />
          <Route path="/profile"      element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/my-quizzes"   element={<ProtectedRoute><MyQuizzesPage /></ProtectedRoute>} />
          <Route path="/history"      element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/bookmarks"    element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
          <Route path="/creator"      element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />

          {/* ── Admin routes ─────────────────────────────────── */}
          <Route path="/admin"               element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          {/* ✅ NEW — Proctoring evidence center */}
          <Route path="/admin/proctoring"    element={<ProtectedRoute><AdminProctoringPage /></ProtectedRoute>} />

          {/* ── Fallback ─────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <ToastContainer />
      <SupportWidget />
      <WelcomeToast />
      <NewDevicePopup />
      <StreakRewardPopup
        reward={streakReward}
        onClose={() => setStreakReward(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}