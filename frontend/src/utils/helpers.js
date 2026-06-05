// PATH: quiz-platform/frontend/src/utils/helpers.js

export const CAT_ICONS = {
  General:       '🌐',
  Science:       '🔬',
  History:       '📜',
  Geography:     '🗺️',
  Technology:    '💻',
  Sports:        '⚽',
  Entertainment: '🎬',
  Mathematics:   '📐',
  Literature:    '📚',
  Art:           '🎨',
};

export const CATEGORIES = Object.keys(CAT_ICONS);

export const RANDOM_TOPICS = [
  'Space Exploration','Dinosaurs','Ancient Rome','Artificial Intelligence',
  'The Human Body','World Capitals','Famous Inventors','Ocean Life',
  'Climate Change','Music Theory','Ancient Egypt','The Solar System',
  'World War II','Greek Mythology','Famous Artists','Quantum Physics',
  'The Renaissance','Astronomy','Marine Biology','Philosophy',
  'Cryptocurrency','Human Psychology','The Amazon Rainforest',
  'Volcanoes','Shakespeare','The Olympics','Chess','Time Zones',
];

export function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days  = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getScoreColor(pct) {
  if (pct >= 80) return 'var(--accent3)';
  if (pct >= 60) return 'var(--accent)';
  if (pct >= 40) return 'var(--accent4)';
  return 'var(--accent2)';
}

export function getScoreMessage(pct) {
  if (pct >= 95) return { emoji: '🏆', text: 'Perfect!',        sub: 'Absolutely flawless! You\'re a genius!' };
  if (pct >= 80) return { emoji: '🎉', text: 'Excellent!',       sub: 'Outstanding performance! Keep it up.' };
  if (pct >= 60) return { emoji: '😊', text: 'Well done!',       sub: 'You clearly know your stuff.' };
  if (pct >= 40) return { emoji: '🙂', text: 'Not bad!',         sub: 'You\'re getting there — try again!' };
  return              { emoji: '😅', text: 'Keep practicing!', sub: 'Every quiz makes you smarter.' };
}

export function diffBadgeClass(diff) {
  const map = { Easy: 'badge-easy', Medium: 'badge-medium', Hard: 'badge-hard' };
  return map[diff] || 'badge-medium';
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
