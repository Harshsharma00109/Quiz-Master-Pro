// PATH: quiz-platform/frontend/src/pages/HomePage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStats, useQuizzes } from '../hooks/useQuizzes';
import { useAuth } from '../context/AuthContext';
import QuizCard  from '../components/QuizCard';
import { CAT_ICONS, CATEGORIES } from '../utils/helpers';
import styles from './HomePage.module.css';

export default function HomePage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const { stats }  = useStats();
  const { quizzes: featured, loading } = useQuizzes({ sort: 'popular', limit: 6 });

  return (
    <div className={`page-enter ${styles.page}`}>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.orb1} /><div className={styles.orb2} /><div className={styles.orb3} />
        <div className={styles.badge}>✦ The Ultimate Quiz Platform</div>
        <h1 className={styles.h1}>Create. Share.<br /><span className={styles.grad}>Challenge the World.</span></h1>
        <p className={styles.sub}>
          Build custom quizzes, challenge friends, and discover thousands of topics.
          Powered by AI — generate any quiz in seconds.
        </p>
        <div className={styles.ctas}>
          <button className="btn btn-primary" onClick={() => navigate('/create')} style={{ padding:'14px 32px', fontSize:'1rem' }}>✦ Create a Quiz</button>
          <button className="btn btn-secondary" onClick={() => navigate('/browse')} style={{ padding:'14px 32px', fontSize:'1rem' }}>Browse All →</button>
          <button className="btn btn-secondary" onClick={() => navigate('/ai')}
            style={{ padding:'14px 32px', fontSize:'1rem', borderColor:'rgba(108,99,255,.4)', color:'var(--accent)' }}>
            🤖 AI Generator
          </button>
        </div>

        {/* ✅ Stats — always show Quizzes Available, hide user-specific ones when not logged in */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <div className={styles.statNum}>{stats.totalQuizzes.toLocaleString()}</div>
            <div className={styles.statLabel}>Quizzes Available</div>
          </div>
          <div className={styles.statItem}>
            {/* ✅ Show "Quizzes Completed" only when logged in, else show categories */}
            <div className={styles.statNum}>
              {user ? stats.totalAttempts.toLocaleString() : `${CATEGORIES.length}+`}
            </div>
            <div className={styles.statLabel}>
              {user ? 'Quizzes Completed' : 'Categories'}
            </div>
          </div>
          <div className={styles.statItem}>
            {/* ✅ Never show user count — show AI badge instead */}
            <div className={styles.statNum}>🤖</div>
            <div className={styles.statLabel}>AI Powered</div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">Browse by Category</div>
        </div>
        <div className={styles.catGrid}>
          {CATEGORIES.map(cat => (
            <div key={cat} className={styles.catCard} onClick={() => navigate(`/browse?category=${cat}`)}>
              <div className={styles.catIcon}>{CAT_ICONS[cat]}</div>
              <div className={styles.catName}>{cat}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED QUIZZES */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">🔥 Most Popular</div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/browse')}>View All →</button>
        </div>
        {loading ? (
          <div className="quiz-grid">{[1,2,3].map(i => <div key={i} className="skeleton card" style={{ height:200 }} />)}</div>
        ) : (
          <div className="quiz-grid">{featured.map(q => <QuizCard key={q.id} quiz={q} />)}</div>
        )}
      </div>

      {/* AI BANNER */}
      <div className="section" style={{ paddingBottom:80 }}>
        <div className={styles.aiBanner}>
          <div style={{ fontSize:'2.8rem', marginBottom:16 }}>🤖</div>
          <h2 className={styles.aiBannerTitle}>AI-Powered Quiz Generator</h2>
          <p className={styles.aiBannerSub}>
            Tell our AI what you want to be quizzed on — from quantum physics to cricket —
            and it'll generate a personalized quiz in seconds using Google Gemini.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/ai')} style={{ marginTop:24 }}>
            Try AI Quiz Generator →
          </button>
        </div>
      </div>
    </div>
  );
}
