// PATH: quiz-platform/frontend/src/pages/BrowsePage.js
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuizzes }  from '../hooks/useQuizzes';
import QuizCard        from '../components/QuizCard';
import { useLanguage } from '../context/LanguageContext';
import { CAT_ICONS, CATEGORIES } from '../utils/helpers';
import styles from './BrowsePage.module.css';

export default function BrowsePage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search,          setSearch]          = useState(searchParams.get('search')   || '');
  const [category,        setCategory]        = useState(searchParams.get('category') || 'All');
  const [diff,            setDiff]            = useState('All');
  const [sort,            setSort]            = useState('newest');
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const DIFFS = [t('total'), t('quiz_easy'), t('quiz_medium'), t('quiz_hard')];
  // Map translated label → API value
  const diffValue = diff === t('total') ? 'All'
    : diff === t('quiz_easy')   ? 'Easy'
    : diff === t('quiz_medium') ? 'Medium'
    : diff === t('quiz_hard')   ? 'Hard'
    : diff;

  const SORTS = [
    { value:'newest',  label: t('sort') + ' — ' + t('current') },
    { value:'popular', label: t('sort') + ' — ' + t('best') },
  ];

  const params = {
    ...(debouncedSearch                   ? { search: debouncedSearch }   : {}),
    ...(category !== 'All'                ? { category }                   : {}),
    ...(diffValue !== 'All'               ? { difficulty: diffValue }      : {}),
    sort,
  };

  const { quizzes, loading, error } = useQuizzes(params);

  const updateCategory = (cat) => {
    setCategory(cat);
    setSearchParams(cat !== 'All' ? { category: cat } : {});
  };

  return (
    <div className="page-enter section">
      <div className="section-header">
        <div className="section-title">{t('nav_browse')}</div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={t('search') + '…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch('')}>✕</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        {/* Category chips */}
        <div className={styles.chipRow}>
          <span className={styles.filterLabel}>{t('filter')}:</span>
          <div className={styles.chips}>
            <span
              className={`${styles.chip} ${category === 'All' ? styles.active : ''}`}
              onClick={() => updateCategory('All')}
            >
              ✦ {t('total')}
            </span>
            {CATEGORIES.map(cat => (
              <span
                key={cat}
                className={`${styles.chip} ${category === cat ? styles.active : ''}`}
                onClick={() => updateCategory(cat)}
              >
                {CAT_ICONS[cat]} {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Difficulty + Sort */}
        <div className={styles.selects}>
          <select
            className="form-input"
            style={{ width:'auto', minWidth:120 }}
            value={diff}
            onChange={e => setDiff(e.target.value)}
          >
            {DIFFS.map(d => <option key={d}>{d}</option>)}
          </select>

          <select
            className="form-input"
            style={{ width:'auto', minWidth:140 }}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className={styles.count}>
          {quizzes.length} {t('nav_browse').toLowerCase()}
          {category !== 'All' && <> — <strong>{category}</strong></>}
          {debouncedSearch && <> "{debouncedSearch}"</>}
        </p>
      )}

      {/* Results */}
      {error ? (
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <div className="empty-text">{t('error')}</div>
        </div>
      ) : loading ? (
        <div className="quiz-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton card" style={{ height:210 }} />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">{t('search')}</div>
          <div className="empty-sub">{t('retry')}</div>
        </div>
      ) : (
        <div className="quiz-grid">
          {quizzes.map(q => <QuizCard key={q.id} quiz={q} />)}
        </div>
      )}
    </div>
  );
}