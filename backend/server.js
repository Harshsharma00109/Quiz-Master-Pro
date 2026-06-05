// PATH: quiz-platform/backend/server.js
// QuizMaster Pro — COMPLETE FIXED SERVER v7.2
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app        = express();
const PORT       = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('❌ JWT_SECRET missing'); process.exit(1); }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const transporter = process.env.EMAIL_USER && process.env.EMAIL_PASS
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  : null;

let groq = null;
try {
  if (process.env.GROQ_API_KEY) {
    const Groq = require('groq-sdk');
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log('✅ Groq AI ready');
  }
} catch { console.log('⚠️  groq-sdk not installed, run: npm i groq-sdk'); }
// ═══════════════════════════════════════════════════════════
// PATCH 1 — RAZORPAY INIT
// WHERE: paste this block immediately after the Groq init block
// (after the line: console.log('⚠️  groq-sdk not installed, run: npm i groq-sdk'); )
// and before:  app.use(cors(...))
// ═══════════════════════════════════════════════════════════

let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay ready');
  } else {
    console.log('⚠️  Razorpay disabled — add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to .env');
  }
} catch {
  console.log('⚠️  razorpay SDK not installed, run: npm i razorpay');
}

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ─── RATE LIMITER ──────────────────────────────────────────
const rlMap = new Map();
function rl(key, max, ms) {
  const now = Date.now();
  const r   = rlMap.get(key) || { c: 0, reset: now + ms };
  if (now > r.reset) { r.c = 0; r.reset = now + ms; }
  r.c++;
  rlMap.set(key, r);
  return r.c <= max;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of rlMap) if (n > v.reset) rlMap.delete(k); }, 300000);
app.use('/api', (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.ip || '?';
  if (!rl(`api:${ip}`, 300, 60000)) return res.status(429).json({ error: 'Too many requests.' });
  next();
});

// ─── AUTH HELPERS ──────────────────────────────────────────
const signToken = u => jwt.sign(
  { id: u.id, username: u.username, email: u.email, is_admin: u.is_admin || false, role: u.role || 'user', plan: u.subscription_plan || 'free' },
  JWT_SECRET, { expiresIn: '7d' }
);

const am  = (req, _, next) => {
  const t = req.headers.authorization?.split(' ')[1];
  try { req.user = t ? jwt.verify(t, JWT_SECRET) : null; } catch { req.user = null; }
  next();
};
const ra  = (req, res, next) => {
  const t = req.headers.authorization?.split(' ')[1];
  if (!t) return res.status(401).json({ error: 'Auth required.' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token.' }); }
};
const rad = (req, res, next) => {
  const t = req.headers.authorization?.split(' ')[1];
  if (!t) return res.status(401).json({ error: 'Auth required.' });
  try {
    req.user = jwt.verify(t, JWT_SECRET);
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin required.' });
    next();
  } catch { res.status(401).json({ error: 'Invalid token.' }); }
};
app.use(am);

const OTP_TTL  = 10 * 60 * 1000;
const regStore = new Map(), resetStore = new Map(), failMap = new Map();
setInterval(() => {
  const n = Date.now();
  for (const [k, v] of regStore)   if (n > v.expires) regStore.delete(k);
  for (const [k, v] of resetStore) if (n > v.expires) resetStore.delete(k);
}, 60000);
// ═══════════════════════════════════════════════════════════
// PATCH 2 — RAZORPAY ROUTES
// WHERE: paste this entire block inside server.js, in the
//        SUBSCRIPTIONS section — right after the line:
//        app.get('/api/referrals', ra, async (req, res) => { ... });
//        and before the LEADERBOARD section.
// ═══════════════════════════════════════════════════════════

// ─── POST /api/razorpay/create-order ───────────────────────
// Body:  { amount: <paise>, plan: 'pro'|'elite'|'lifetime', billing_cycle: 'monthly'|'yearly' }
// Returns: { order_id, amount, currency }
app.post('/api/razorpay/create-order', ra, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: 'Razorpay not configured. Add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to .env and run: npm i razorpay' });
    }

    const { amount, plan, billing_cycle = 'monthly' } = req.body;

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount < 100) {
      return res.status(400).json({ error: 'Invalid amount. Minimum is 100 paise (₹1).' });
    }

    // Validate plan
    if (!['pro', 'elite', 'lifetime'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be pro, elite, or lifetime.' });
    }

    const options = {
      amount:   Math.round(amount),  // must be integer paise
      currency: 'INR',
      receipt:  `qm_${req.user.id}_${plan}_${Date.now()}`,
      notes: {
        user_id:       String(req.user.id),
        username:      req.user.username,
        plan,
        billing_cycle,
      },
    };

    const order = await razorpay.orders.create(options);

    console.log(`[Razorpay] Order created: ${order.id} | user: ${req.user.username} | plan: ${plan} | ₹${amount / 100}`);

    return res.status(200).json({
      order_id: order.id,
      amount:   order.amount,
      currency: order.currency,
    });

  } catch (err) {
    console.error('[Razorpay] create-order error:', err);
    if (err.statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay auth failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
    }
    return res.status(500).json({
      error:   'Failed to create Razorpay order.',
      details: err.error?.description || err.message,
    });
  }
});

// ─── POST /api/razorpay/verify-payment ────────────────────
// Body:  { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billing_cycle, amount }
// On success: activates subscription exactly like /api/subscription/activate does.
// Returns: { success: true, token, plan, message }
app.post('/api/razorpay/verify-payment', ra, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({ error: 'Razorpay not configured.' });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      billing_cycle = 'monthly',
      amount,
    } = req.body;

    // 1. Validate all fields present
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        error: 'Missing fields: razorpay_order_id, razorpay_payment_id, razorpay_signature all required.',
      });
    }

    if (!['pro', 'elite', 'lifetime'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan.' });
    }

    // 2. HMAC-SHA256 signature verification — the critical security step
    const body              = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn(`[Razorpay] ❌ Signature mismatch for order: ${razorpay_order_id} | user: ${req.user.id}`);
      return res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    }

    // 3. ✅ Signature valid — activate subscription (mirrors /api/subscription/activate)
    const { data: ps } = await supabase
      .from('plan_settings')
      .select('*')
      .eq('plan_id', plan)
      .single();

    const limits    = ps?.limits ? (typeof ps.limits === 'string' ? JSON.parse(ps.limits) : ps.limits) : {};
    const daysMap   = { monthly: 30, yearly: 365, lifetime: 36500, quarterly: 90 };
    const days      = daysMap[billing_cycle] || 30;
    const expires   = billing_cycle === 'lifetime' ? null : new Date(Date.now() + days * 86400000).toISOString();

    // Update user plan
    await supabase
      .from('users')
      .update({
        subscription_plan: plan,
        subscription_end:  expires,
        freeze_credits:    limits.freeze_monthly || 2,
      })
      .eq('id', req.user.id);

    // Insert subscription record
    await supabase.from('subscriptions').insert({
      user_id:        req.user.id,
      plan,
      billing_cycle,
      status:         'active',
      amount:         amount ? Number(amount) / 100 : 0,  // store in rupees
      currency:       'INR',
      upi_ref:        razorpay_payment_id,  // Razorpay payment ID as reference
      transaction_id: razorpay_order_id,
      started_at:     new Date().toISOString(),
      expires_at:     expires,
      approved_at:    new Date().toISOString(),
    });

    // Revenue log
    await supabase.from('revenue_log').insert({
      user_id:        req.user.id,
      plan,
      amount:         amount ? Number(amount) / 100 : 0,
      upi_ref:        razorpay_payment_id,
      transaction_id: razorpay_order_id,
      status:         'success',
    });

    // Badge
    await awardBadge(req.user.id, plan === 'elite' || plan === 'lifetime' ? 'elite_member' : 'pro_member');

    // In-app notification
    await notif(
      req.user.id,
      'subscription',
      `${plan === 'elite' ? '💎' : plan === 'lifetime' ? '♾️' : '⭐'} ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated!`,
      'All premium features are now unlocked via Razorpay!'
    );

    // Email
    const { data: u } = await supabase
      .from('users')
      .select('email,username')
      .eq('id', req.user.id)
      .single();

    if (u) {
      sendEmail(
        u.email,
        `✅ ${plan} Subscription Activated!`,
        baseEmail(
          `<h2 style="color:#8b5cf6">Payment Successful! 🎉</h2>
           <p>Hi <strong>${u.username}</strong>, your <strong>${plan}</strong> plan is now active!</p>
           <div style="background:#1a1a2e;border-radius:12px;padding:16px;margin:16px 0;font-size:.85rem;color:#9898b8">
             <div>Payment ID: <code>${razorpay_payment_id}</code></div>
             <div>Order ID: <code>${razorpay_order_id}</code></div>
           </div>
           <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}"
              style="background:#8b5cf6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">
             Start Exploring →
           </a>`
        )
      ).catch(() => {});
    }

    // Fresh token with updated plan
    const { data: freshUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    console.log(`[Razorpay] ✅ Payment verified | user: ${req.user.username} | plan: ${plan} | payment: ${razorpay_payment_id}`);

    return res.status(200).json({
      success:    true,
      payment_id: razorpay_payment_id,
      order_id:   razorpay_order_id,
      plan,
      expires_at: expires,
      token:      signToken(freshUser),   // fresh JWT with updated plan claim
      message:    `${plan} plan activated successfully!`,
    });

  } catch (err) {
    console.error('[Razorpay] verify-payment error:', err);
    return res.status(500).json({ error: 'Internal error during payment verification.' });
  }
});
// ─── UTILITY HELPERS ───────────────────────────────────────
function parseDevice(ua = '') {
  const u = ua.toLowerCase();
  let d = 'Desktop', b = 'Unknown';
  if (u.includes('mobile') || u.includes('android')) d = 'Mobile';
  else if (u.includes('tablet') || u.includes('ipad')) d = 'Tablet';
  if (u.includes('chrome') && !u.includes('edg')) b = 'Chrome';
  else if (u.includes('firefox')) b = 'Firefox';
  else if (u.includes('safari') && !u.includes('chrome')) b = 'Safari';
  else if (u.includes('edg')) b = 'Edge';
  return { d, b };
}

async function sendEmail(to, subject, html) {
  if (transporter) await transporter.sendMail({ from: `"QuizMaster Pro" <${process.env.EMAIL_USER}>`, to, subject, html });
  else console.log(`[DEV EMAIL] To:${to} | Subject:${subject}`);
}

async function notif(uid, type, title, msg, url = '') {
  if (!uid) return;
  try { await supabase.from('notifications').insert({ user_id: uid, type, title, message: msg, action_url: url || null }); } catch {}
}

async function getSetting(key) {
  try {
    const { data } = await supabase.from('app_settings').select('value').eq('key', key).single();
    if (!data) return null;
    return typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
  } catch { return null; }
}

async function addCoins(userId, amount, type, description, ref = '') {
  if (!userId || amount === 0) return 0;
  const { data: u } = await supabase.from('users').select('coins,total_coins_earned').eq('id', userId).single();
  if (!u) return 0;
  const newBal  = Math.max(0, (u.coins || 0) + amount);
  const newEarn = amount > 0 ? (u.total_coins_earned || 0) + amount : (u.total_coins_earned || 0);
  await supabase.from('users').update({ coins: newBal, total_coins_earned: newEarn }).eq('id', userId);
  await supabase.from('coin_transactions').insert({ user_id: userId, amount, type, description, reference: ref || null, balance_after: newBal });
  return newBal;
}

async function addXP(userId, xp) {
  if (!userId || !xp) return;
  const { data: u } = await supabase.from('users').select('xp_points').eq('id', userId).single();
  if (!u) return;
  const newXP = (u.xp_points || 0) + xp;
  await supabase.from('users').update({ xp_points: newXP, level: Math.floor(newXP / 500) + 1 }).eq('id', userId);
}

const BADGES = {
  first_quiz:    { id: 'first_quiz',    label: 'First Quiz',     emoji: '🎯', desc: 'Completed first quiz' },
  perfect_score: { id: 'perfect_score', label: 'Perfect Score',  emoji: '💯', desc: '100% on a quiz' },
  speed_demon:   { id: 'speed_demon',   label: 'Speed Demon',    emoji: '⚡', desc: 'Finished quiz under 60s' },
  century:       { id: 'century',       label: 'Century Club',   emoji: '💪', desc: '100 quizzes completed' },
  quiz_creator:  { id: 'quiz_creator',  label: 'Quiz Creator',   emoji: '✏️', desc: 'Created first quiz' },
  social_star:   { id: 'social_star',   label: 'Social Star',    emoji: '⚔️', desc: 'Challenged a friend' },
  bookworm:      { id: 'bookworm',      label: 'Bookworm',       emoji: '🔖', desc: 'Saved 5 quizzes' },
  event_hero:    { id: 'event_hero',    label: 'Event Hero',     emoji: '🎉', desc: 'Joined event quiz' },
  streak_3:      { id: 'streak_3',      label: 'On Fire',        emoji: '🔥', desc: '3-day streak' },
  streak_7:      { id: 'streak_7',      label: 'Week Warrior',   emoji: '📅', desc: '7-day streak' },
  streak_30:     { id: 'streak_30',     label: 'Monthly Master', emoji: '🏆', desc: '30-day streak' },
  pro_member:    { id: 'pro_member',    label: 'Pro Member',     emoji: '⭐', desc: 'Pro subscriber' },
  elite_member:  { id: 'elite_member',  label: 'Elite Member',   emoji: '💎', desc: 'Elite subscriber' },
};

async function awardBadge(uid, bid) {
  if (!uid || !bid) return null;
  const { error } = await supabase.from('user_badges').insert({ user_id: uid, badge_id: bid });
  if (!error) { await addXP(uid, 25); await addCoins(uid, 20, 'reward', `Badge: ${bid}`); }
  return error ? null : bid;
}

async function logAct(uid, action, meta = {}, req = null) {
  try {
    await supabase.from('user_activity').insert({
      user_id: uid, action, metadata: JSON.stringify(meta),
      ip_address: req?.headers?.['x-forwarded-for'] || req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
    });
  } catch {}
}

// ─── STREAK MILESTONES ─────────────────────────────────────
const SM = [
  { days: 3,  key: 'beginner_learner',  label: 'Beginner Learner',  emoji: '📚', xp: 50,   coins: 50 },
  { days: 7,  key: 'quiz_explorer',     label: 'Quiz Explorer',     emoji: '🔭', xp: 100,  coins: 100 },
  { days: 10, key: 'knowledge_warrior', label: 'Knowledge Warrior', emoji: '⚔️', xp: 200,  coins: 200 },
  { days: 20, key: 'quiz_master',       label: 'Quiz Master',       emoji: '🎓', xp: 500,  coins: 500 },
  { days: 30, key: 'legend_scholar',    label: 'Legend Scholar',    emoji: '📜', xp: 1000, coins: 1000 },
  { days: 60, key: 'grand_champion',    label: 'Grand Champion',    emoji: '👑', xp: 3000, coins: 3000 },
];
const getTitle = n => [...SM].reverse().find(m => n >= m.days) || null;

async function updateStreak(userId) {
  if (!userId) return { newBadges: [], streakReward: null };
  try {
    const { data: u } = await supabase.from('users')
      .select('streak_count,longest_streak,last_played_date,freeze_credits,freeze_used,freeze_reset_month,subscription_plan')
      .eq('id', userId).single();
    if (!u) return { newBadges: [], streakReward: null };
    const today = new Date().toISOString().split('T')[0];
    const yest  = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const two   = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    if (u.last_played_date === today) return { newBadges: [], streakReward: null };
    const planFreeze = { free: 2, pro: 5, elite: 10, lifetime: 999 };
    let ns = u.streak_count || 0;
    if (u.last_played_date === yest) {
      ns += 1;
    } else if (u.last_played_date === two && (u.freeze_credits || 0) > 0) {
      ns += 1;
      const month = new Date().getMonth();
      let fc = (u.freeze_credits || 0) - 1;
      let fu = (u.freeze_used || 0) + 1;
      if (u.freeze_reset_month !== month) { fc = planFreeze[u.subscription_plan || 'free'] - 1; fu = 1; }
      await supabase.from('users').update({ freeze_credits: fc, freeze_used: fu, freeze_reset_month: month }).eq('id', userId);
      await supabase.from('freeze_history').insert({ user_id: userId, date_used: yest });
      await supabase.from('streak_history').upsert({ user_id: userId, date: yest, action: 'freeze_used' });
    } else {
      ns = 1;
    }
    const nl = Math.max(ns, u.longest_streak || 0);
    const t  = getTitle(ns);
    await supabase.from('users').update({ streak_count: ns, longest_streak: nl, last_played_date: today, streak_title: t?.label || null }).eq('id', userId);
    await supabase.from('streak_history').upsert({ user_id: userId, date: today, action: 'quiz_completed' });
    await addXP(userId, 10);
    await addCoins(userId, 5, 'daily', 'Streak bonus');
    const nb = [];
    if (ns >= 3)  nb.push(await awardBadge(userId, 'streak_3'));
    if (ns >= 7)  nb.push(await awardBadge(userId, 'streak_7'));
    if (ns >= 30) nb.push(await awardBadge(userId, 'streak_30'));
    let sr = null;
    for (const m of SM) {
      if (ns === m.days) {
        const { error } = await supabase.from('streak_rewards').insert({ user_id: userId, reward_key: m.key, reward_label: m.label, streak_days: m.days });
        if (!error) { sr = m; await addXP(userId, m.xp); await addCoins(userId, m.coins, 'reward', `Streak milestone: ${m.label}`); }
      }
    }
    return { newBadges: nb.filter(Boolean), streakReward: sr, newStreak: ns };
  } catch (e) { console.error('streak:', e.message); return { newBadges: [], streakReward: null }; }
}

// ─── EMAIL TEMPLATES ───────────────────────────────────────
const baseEmail = (content) =>
  `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d0d1a;color:#f0f0ff;border-radius:18px;overflow:hidden;border:1px solid rgba(108,99,255,.2)">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 32px;border-bottom:1px solid rgba(108,99,255,.2)">
      <span style="font-size:1.2rem;font-weight:900;color:#8b5cf6">✦ QuizMaster Pro</span>
    </div>
    <div style="padding:28px 32px">${content}</div>
    <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,.05);text-align:center">
      <p style="color:#3a3a5a;font-size:.75rem;margin:0">QuizMaster Pro · Automated Security Email</p>
    </div>
  </div>`;

// ─── CRON: STREAK REMINDERS ────────────────────────────────
const doStreakReminders = async () => {
  try {
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const { data } = await supabase.from('users')
      .select('id,username,email,streak_count')
      .eq('last_played_date', yest).gt('streak_count', 0).eq('is_banned', false).limit(200);
    for (const u of (data || [])) {
      await notif(u.id, 'streak_warning', '⚠️ Streak at risk!', `Your ${u.streak_count}-day streak needs you! Play a quiz today to save it.`);
      sendEmail(u.email, '⚠️ Save Your Streak!', baseEmail(
        `<h2 style="color:#f97316">⚠️ Your streak is on life support!</h2>
         <p>Hey <strong>${u.username}</strong>!</p>
         <div style="background:#1a1a2e;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
           <div style="font-size:3rem">🔥</div>
           <div style="font-size:2rem;font-weight:900;color:#f97316">${u.streak_count} Day Streak</div>
           <p style="color:#9898b8">Don't let it burn out now!</p>
         </div>
         <p style="color:#ef4444;font-weight:700">Login now to save your streak!</p>
         <a href="${process.env.FRONTEND_URL}/browse" style="background:#f97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Save My Streak 🔥</a>`
      )).catch(() => {});
    }
    console.log(`[Streak Reminders] Sent to ${(data || []).length} users`);
  } catch (e) { console.error('streak reminders:', e.message); }
};
setInterval(() => { if (new Date().getUTCHours() === 18) doStreakReminders(); }, 3600000);

// ─── CRON: TIME REWARDS ────────────────────────────────────
const checkTimeRewards = async () => {
  try {
    const rawMs = await getSetting('time_milestones');
    const milestones = rawMs ? JSON.parse(rawMs) : [];
    const { data: users } = await supabase.from('users')
      .select('id,username,email,total_time_spent,time_reward_notified_at')
      .gt('total_time_spent', 0).limit(500);
    for (const u of (users || [])) {
      const hrs = Math.floor((u.total_time_spent || 0) / 3600);
      const notified = u.time_reward_notified_at || 0;
      for (const m of milestones) {
        if (hrs >= m.hours && notified < m.hours) {
          await addCoins(u.id, m.coins, 'time_reward', `${m.hours}h milestone!`);
          await notif(u.id, 'time_reward', `🕐 ${m.hours}h Milestone!`, `+${m.coins} coins${m.discount ? ` + ${m.discount}% subscription discount` : ''}!`);
          await supabase.from('users').update({ time_reward_notified_at: m.hours }).eq('id', u.id);
          break;
        }
      }
    }
  } catch (e) { console.error('time rewards:', e.message); }
};
setInterval(checkTimeRewards, 6 * 3600000);

// ═══════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════

app.get('/api/auth/check-username/:u', async (req, res) => {
  const u = req.params.u?.trim();
  if (!u || u.length < 3 || u.length > 20 || !/^[a-zA-Z0-9_]+$/.test(u)) return res.json({ available: false });
  const { data } = await supabase.from('users').select('id').eq('username', u).maybeSingle();
  res.json({ available: !data });
});

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { username, email, password, referral_code } = req.body;
    const u = username?.trim(), e = email?.toLowerCase().trim(), p = password;
    if (!u || u.length < 3 || !/^[a-zA-Z0-9_]+$/.test(u)) return res.status(400).json({ error: 'Username: 3-20 chars, letters/numbers/underscores.' });
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: 'Invalid email.' });
    if (!p || p.length < 6) return res.status(400).json({ error: 'Password min 6 chars.' });
    const { data: ex } = await supabase.from('users').select('id').or(`email.eq.${e},username.eq.${u}`).maybeSingle();
    if (ex) return res.status(409).json({ error: 'Email or username already registered.' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const exp = Date.now() + OTP_TTL;
    regStore.set(e, { otp, expires: exp, u, p, referral_code: referral_code || null });
    failMap.delete(e);
    await sendEmail(e, '✉️ Verify Your QuizMaster Account', baseEmail(
      `<h2 style="color:#8b5cf6">Verify Your Email</h2>
       <p>Use this code to complete registration:</p>
       <div style="background:#1a1a2e;border-radius:14px;padding:28px;text-align:center;margin:20px 0">
         <div style="font-size:2.8rem;letter-spacing:14px;color:#a855f7;font-weight:900;font-family:monospace">${otp}</div>
         <p style="color:#5a5a7a;margin-top:10px">⏱ Expires in 10 minutes</p>
       </div>`
    ));
    res.json({ message: 'Verification code sent!', expires_at: exp });
  } catch (e) { console.error('send-otp:', e.message); res.status(500).json({ error: 'Failed to send code.' }); }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const e = email?.toLowerCase().trim();
    const fr = failMap.get(e) || { c: 0 };
    if (fr.c >= 5) return res.status(429).json({ error: 'Too many attempts. Request new code.', too_many: true });
    const s = regStore.get(e);
    if (!s) return res.status(400).json({ error: 'Code not found. Request new.', not_found: true });
    if (Date.now() > s.expires) { regStore.delete(e); return res.status(400).json({ error: 'Code expired.', expired: true }); }
    if (s.otp !== otp?.toString().trim()) {
      fr.c += 1; failMap.set(e, fr);
      return res.status(400).json({ error: `Wrong code. ${5 - fr.c} left.`, incorrect: true, attempts_left: 5 - fr.c, expires_at: s.expires });
    }
    const h = await bcrypt.hash(s.p, 12);
    let refBy = null;
    if (s.referral_code) {
      const { data: ru } = await supabase.from('users').select('id').eq('referral_code', s.referral_code).maybeSingle();
      if (ru) refBy = ru.id;
    }
    const { data: nu, error } = await supabase.from('users')
      .insert({ username: s.u, email: e, password: h, freeze_credits: 2, subscription_plan: 'free', referred_by: refBy })
      .select('id,username,email,is_admin,role,subscription_plan').single();
    if (error) { if (error.code === '23505') return res.status(409).json({ error: 'Already exists.' }); throw error; }
    regStore.delete(e); failMap.delete(e);
    if (refBy) {
      const rc = parseInt(await getSetting('referral_coins') || '100');
      await supabase.from('referrals').insert({ referrer_id: refBy, referee_id: nu.id, status: 'rewarded', coins_given: rc });
      await addCoins(refBy, rc, 'referral', `Referral: ${nu.username} joined`);
      const { data: ru2 } = await supabase.from('users').select('referral_count').eq('id', refBy).single();
      await supabase.from('users').update({ referral_count: (ru2?.referral_count || 0) + 1 }).eq('id', refBy);
      await notif(refBy, 'referral', '🎁 Referral Reward!', `${nu.username} joined! +${rc} coins`);
    }
    await notif(nu.id, 'welcome', '🎉 Welcome to QuizMaster Pro!', `Hey ${nu.username}! Your account is ready. Start exploring!`);
    sendEmail(e, '🎉 Welcome to QuizMaster Pro!', baseEmail(
      `<h2 style="color:#8b5cf6">🎉 Welcome, ${nu.username}!</h2>
       <p>Your account is all set. Let's start quizzing!</p>
       <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="background:#8b5cf6;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Start Playing →</a>`
    )).catch(() => {});
    await logAct(nu.id, 'register', {}, req);
    res.status(201).json({ token: signToken(nu), user: { id: nu.id, username: nu.username, email: nu.email, is_admin: false, role: 'user', plan: 'free' } });
  } catch (e) { console.error('verify-otp:', e.message); res.status(500).json({ error: 'Verification failed.' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'Email required.' });
    const { data: u } = await supabase.from('users').select('*').eq('email', email.toLowerCase().trim()).single();
    if (!u) return res.status(401).json({ error: 'Invalid credentials.' });
    if (u.is_banned && !u.is_admin) return res.status(403).json({ error: `Account suspended: ${u.ban_reason || 'Contact support'}` });
    if (!await bcrypt.compare(password, u.password)) return res.status(401).json({ error: 'Invalid credentials.' });
    const ua = req.headers['user-agent'] || '';
    const { d: device, b: browser } = parseDevice(ua);
    const ip = req.headers['x-forwarded-for'] || req.ip || 'Unknown';
    const sessionId = crypto.randomBytes(20).toString('hex');
    const terminateLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/terminate-session?token=${sessionId}&uid=${u.id}`;
    try {
      await supabase.from('session_tokens').insert({
        user_id: u.id, token_hash: sessionId, device_info: device,
        ip_address: ip, browser, is_active: true,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    } catch {}
    let isNew = false;
    try {
      const { data: prev } = await supabase.from('login_alerts')
        .select('device_info,browser').eq('user_id', u.id)
        .order('created_at', { ascending: false }).limit(10);
      if (prev && prev.length > 0) {
        const known = new Set(prev.map(l => `${l.device_info}|${l.browser}`));
        isNew = !known.has(`${device}|${browser}`);
      }
      await supabase.from('login_alerts').insert({ user_id: u.id, ip_address: ip, location: 'India', device_info: device, browser, is_new_device: isNew, session_token: sessionId });
    } catch {}
    if (isNew) {
      const lt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      sendEmail(u.email, '🔐 New Device Login — QuizMaster Pro', baseEmail(
        `<h3 style="color:#ef4444">🔐 New Device Detected</h3>
         <p>Hi <strong>${u.username}</strong>, a login from a new device was detected.</p>
         <div style="background:#1a1a2e;border-radius:12px;overflow:hidden;margin:20px 0">
           <table style="width:100%;border-collapse:collapse">
             <tr style="border-bottom:1px solid rgba(255,255,255,.05)"><td style="padding:10px 16px;color:#6b7280">🌐 IP</td><td style="padding:10px 16px;color:#f0f0ff;font-weight:600">${ip}</td></tr>
             <tr style="border-bottom:1px solid rgba(255,255,255,.05)"><td style="padding:10px 16px;color:#6b7280">💻 Device</td><td style="padding:10px 16px;color:#f0f0ff;font-weight:600">${device}</td></tr>
             <tr style="border-bottom:1px solid rgba(255,255,255,.05)"><td style="padding:10px 16px;color:#6b7280">🌍 Browser</td><td style="padding:10px 16px;color:#f0f0ff;font-weight:600">${browser}</td></tr>
             <tr><td style="padding:10px 16px;color:#6b7280">🕐 Time</td><td style="padding:10px 16px;color:#f0f0ff;font-weight:600">${lt}</td></tr>
           </table>
         </div>
         <div style="text-align:center;margin:20px 0">
           <a href="${terminateLink}" style="background:#ef4444;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">🚫 Terminate This Session</a>
         </div>`
      )).catch(() => {});
      await notif(u.id, 'new_device', '⚠️ New Device Login', `Login from new device (${device}, ${browser}). If not you, change your password.`);
    }
    const today = new Date().toISOString().split('T')[0];
    if (u.last_login?.split('T')[0] !== today) {
      const dc = parseInt(await getSetting('daily_login_coins') || '10');
      await addCoins(u.id, dc, 'daily', 'Daily login bonus');
      await notif(u.id, 'daily_reward', '🎁 Daily Login Bonus!', `+${dc} coins for logging in today!`);
    }
    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', u.id);
    await logAct(u.id, 'login', { ip, device, browser, is_new_device: isNew }, req);
    res.json({ token: signToken(u), user: { id: u.id, username: u.username, email: u.email, is_admin: u.is_admin || false, role: u.role || 'user', plan: u.subscription_plan || 'free' }, is_new_device: isNew, device_info: device, browser, ip });
  } catch (e) { console.error('login:', e.message); res.status(500).json({ error: 'Server error.' }); }
});

app.post('/api/auth/terminate-session', async (req, res) => {
  try {
    const { token, uid } = req.body;
    if (!token || !uid) return res.status(400).json({ error: 'Required.' });
    await supabase.from('session_tokens').update({ is_active: false, terminated_at: new Date().toISOString() }).eq('token_hash', token).eq('user_id', uid);
    res.json({ message: 'Session terminated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', ra, async (req, res) => {
  const { data } = await supabase.from('users')
    .select('id,username,email,bio,avatar_url,avatar_preset,unique_display_id,role,streak_count,longest_streak,last_played_date,freeze_credits,freeze_used,streak_title,xp_points,level,coins,total_coins_earned,subscription_plan,subscription_end,ai_quota_used,is_admin,is_creator,creator_verified,total_quizzes,total_correct,total_questions_answered,total_time_spent,total_wins,rank_points,followers_count,following_count,is_public,referral_code,referral_count,last_spin_date,preferred_language,theme,created_at,last_login')
    .eq('id', req.user.id).single();
  if (!data) return res.status(404).json({ error: 'Not found.' });
  res.json(data);
});

app.put('/api/auth/profile', ra, async (req, res) => {
  const allowed = ['bio', 'avatar_url', 'avatar_preset', 'is_public', 'preferred_language', 'theme'];
  const upd = {};
  for (const k of allowed) if (req.body[k] !== undefined) upd[k] = req.body[k];
  upd.updated_at = new Date().toISOString();
  await supabase.from('users').update(upd).eq('id', req.user.id);
  res.json({ message: 'Updated.' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const e = req.body.email?.toLowerCase().trim();
    if (!e) return res.status(400).json({ error: 'Email required.' });
    const { data: u } = await supabase.from('users').select('id,email,username').eq('email', e).single();
    if (!u) return res.status(404).json({ error: 'No account found.' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const exp = Date.now() + OTP_TTL;
    resetStore.set(e, { otp, expires: exp, userId: u.id });
    failMap.delete(`r_${e}`);
    await sendEmail(e, '🔐 Reset Your Password', baseEmail(
      `<h2 style="color:#8b5cf6">Password Reset</h2>
       <div style="background:#1a1a2e;border-radius:14px;padding:28px;text-align:center;margin:20px 0">
         <div style="font-size:2.8rem;letter-spacing:14px;color:#a855f7;font-weight:900;font-family:monospace">${otp}</div>
         <p style="color:#5a5a7a">Expires in 10 minutes</p>
       </div>
       <p style="color:#5a5a7a;font-size:.85rem">Ignore if you didn't request this.</p>`
    ));
    res.json({ message: 'Reset code sent!', expires_at: exp });
  } catch { res.status(500).json({ error: 'Failed.' }); }
});

app.post('/api/auth/verify-reset-otp', (req, res) => {
  const e = req.body.email?.toLowerCase().trim(), otp = req.body.otp?.toString().trim();
  const fk = `r_${e}`, fr = failMap.get(fk) || { c: 0 };
  if (fr.c >= 5) return res.status(429).json({ error: 'Too many attempts.', too_many: true });
  const s = resetStore.get(e);
  if (!s) return res.status(400).json({ error: 'Code not found.', not_found: true });
  if (Date.now() > s.expires) { resetStore.delete(e); return res.status(400).json({ error: 'Expired.', expired: true }); }
  if (s.otp !== otp) {
    fr.c += 1; failMap.set(fk, fr);
    return res.status(400).json({ error: `Wrong. ${5 - fr.c} left.`, incorrect: true, attempts_left: 5 - fr.c, expires_at: s.expires });
  }
  failMap.delete(fk);
  res.json({ valid: true });
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const e = req.body.email?.toLowerCase().trim(), { otp, password } = req.body;
    if (!e || !otp || !password || password.length < 6) return res.status(400).json({ error: 'All required, min 6 chars.' });
    const s = resetStore.get(e);
    if (!s || Date.now() > s.expires) { resetStore.delete(e); return res.status(400).json({ error: 'Session expired.' }); }
    if (s.otp !== otp.trim()) return res.status(400).json({ error: 'Invalid code.' });
    await supabase.from('users').update({ password: await bcrypt.hash(password, 12) }).eq('id', s.userId);
    try { await supabase.from('session_tokens').update({ is_active: false, terminated_at: new Date().toISOString() }).eq('user_id', s.userId).eq('is_active', true); } catch {}
    resetStore.delete(e);
    res.json({ message: 'Password updated. All sessions terminated.' });
  } catch { res.status(500).json({ error: 'Failed.' }); }
});

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

app.get('/api/notifications', ra, async (req, res) => {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ notifications: data || [], unread: (data || []).filter(n => !n.is_read).length });
});
app.put('/api/notifications/read', ra, async (req, res) => {
  const { id } = req.body;
  let q = supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.id);
  if (id) q = q.eq('id', parseInt(id, 10));
  await q;
  res.json({ message: 'Done.' });
});
app.get('/api/notifications/unread-count', ra, async (req, res) => {
  const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('is_read', false);
  res.json({ count: count || 0 });
});
app.delete('/api/notifications/:id', ra, async (req, res) => {
  await supabase.from('notifications').delete().eq('id', parseInt(req.params.id, 10)).eq('user_id', req.user.id);
  res.json({ message: 'Deleted.' });
});
app.post('/api/internal/streak-reminders', async (req, res) => {
  if (req.headers['x-internal-key'] !== process.env.INTERNAL_KEY) return res.status(401).json({ error: 'Unauthorized.' });
  await doStreakReminders();
  res.json({ message: 'Done.' });
});

// ═══════════════════════════════════════════════════════════
// QUIZ ROUTES
// ═══════════════════════════════════════════════════════════

app.get('/api/quizzes', async (req, res) => {
  try {
    const { category, difficulty, type, search, sort = 'newest', limit = 20, offset = 0, premium } = req.query;
    let q = supabase.from('quizzes').select('*,questions(count)').eq('is_public', true).eq('is_active', true).eq('is_hidden', false);
    if (category && category !== 'All') q = q.eq('category', category);
    if (difficulty && difficulty !== 'All') q = q.eq('difficulty', difficulty);
    if (type && type !== 'All') q = q.eq('quiz_type', type);
    if (premium === 'true') q = q.eq('is_premium', true);
    if (search) q = q.ilike('title', `%${search}%`);
    q = sort === 'popular' ? q.order('plays', { ascending: false }) : q.order('created_at', { ascending: false });
    q = q.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    const { data, error } = await q; if (error) throw error;
    res.json((data || []).map(r => ({ ...r, question_count: r.questions?.[0]?.count ?? 0, questions: undefined })).filter(r => r.question_count > 0));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/quizzes/my', ra, async (req, res) => {
  const { data } = await supabase.from('quizzes').select('*,questions(count)').eq('creator_id', req.user.id).order('created_at', { ascending: false });
  res.json((data || []).map(r => ({ ...r, question_count: r.questions?.[0]?.count ?? 0, questions: undefined })));
});

app.get('/api/quizzes/:id', am, async (req, res) => {
  try {
    const qid = parseInt(req.params.id, 10);
    if (isNaN(qid)) return res.status(400).json({ error: 'Invalid ID.' });
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', qid).single();
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (quiz.is_premium && !req.user) return res.status(403).json({ error: 'Sign in required.', requires_login: true });
    if (quiz.is_premium && req.user && req.user.plan === 'free' && !req.user.is_admin) return res.status(403).json({ error: 'Premium subscription required.', requires_upgrade: true });
    const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', qid).order('order_index', { ascending: true });
    res.json({ ...quiz, questions: quiz.randomize_questions !== false ? (qs || []).sort(() => Math.random() - 0.5) : (qs || []) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quizzes', ra, async (req, res) => {
  try {
    const { title, description, category, difficulty, quiz_type, time_limit, timer_mode, per_question_seconds, is_public, is_premium, questions, tags, coins_reward, xp_reward, language, allow_retries, show_answers, randomize_questions } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required.' });
    if (!questions?.length) return res.status(400).json({ error: 'Questions required.' });
    const { data: quiz, error } = await supabase.from('quizzes').insert({
      title: title.trim(), description: description?.trim() || '', category: category || 'General',
      difficulty: difficulty || 'Medium', quiz_type: quiz_type || 'basic',
      creator_id: req.user.id, creator_name: req.user.username,
      time_limit: time_limit || 0, timer_mode: timer_mode || 'none',
      per_question_seconds: per_question_seconds || 30, is_public: is_public !== false,
      is_premium: is_premium || false, plays: 0, tags: tags || [],
      coins_reward: coins_reward || 10, xp_reward: xp_reward || 50, language: language || 'en',
      allow_retries: allow_retries !== false, show_answers: show_answers !== false,
      randomize_questions: randomize_questions !== false,
    }).select('id').single();
    if (error) throw error;
    await supabase.from('questions').insert(questions.map((q, i) => ({
      quiz_id: quiz.id, question_text: q.question_text?.trim() || '', options: q.options,
      correct_answer: q.correct_answer, explanation: q.explanation?.trim() || '',
      hint: q.hint?.trim() || '', image_url: q.image_url || null, order_index: i,
    })));
    await awardBadge(req.user.id, 'quiz_creator');
    res.status(201).json({ id: quiz.id, message: 'Quiz created!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/quizzes/:id', ra, async (req, res) => {
  try {
    const qid = parseInt(req.params.id, 10);
    const { data: quiz } = await supabase.from('quizzes').select('creator_id').eq('id', qid).single();
    if (!quiz) return res.status(404).json({ error: 'Not found.' });
    if (String(quiz.creator_id) !== String(req.user.id) && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden.' });
    const fields = ['title','description','category','difficulty','quiz_type','time_limit','timer_mode','per_question_seconds','is_public','is_premium','is_active','is_hidden','tags','coins_reward','xp_reward','allow_retries','show_answers','randomize_questions'];
    const upd = {};
    for (const f of fields) if (req.body[f] !== undefined) upd[f] = req.body[f];
    upd.updated_at = new Date().toISOString();
    await supabase.from('quizzes').update(upd).eq('id', qid);
    if (req.body.questions?.length) {
      await supabase.from('questions').delete().eq('quiz_id', qid);
      await supabase.from('questions').insert(req.body.questions.map((q, i) => ({
        quiz_id: qid, question_text: q.question_text?.trim() || '', options: q.options,
        correct_answer: q.correct_answer, explanation: q.explanation?.trim() || '',
        hint: q.hint?.trim() || '', image_url: q.image_url || null, order_index: i,
      })));
    }
    res.json({ message: 'Updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/quizzes/:id', ra, async (req, res) => {
  try {
    const qid = parseInt(req.params.id, 10);
    const { data: quiz } = await supabase.from('quizzes').select('creator_id').eq('id', qid).single();
    if (!quiz) return res.status(404).json({ error: 'Not found.' });
    if (String(quiz.creator_id) !== String(req.user.id) && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden.' });
    await supabase.from('quizzes').delete().eq('id', qid);
    res.json({ message: 'Deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quizzes/:id/toggle-visibility', ra, async (req, res) => {
  try {
    const qid = parseInt(req.params.id, 10);
    const { data: quiz } = await supabase.from('quizzes').select('creator_id,is_hidden').eq('id', qid).single();
    if (!quiz) return res.status(404).json({ error: 'Not found.' });
    if (String(quiz.creator_id) !== String(req.user.id) && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden.' });
    const newHidden = !quiz.is_hidden;
    await supabase.from('quizzes').update({ is_hidden: newHidden }).eq('id', qid);
    res.json({ message: newHidden ? 'Quiz hidden.' : 'Quiz visible.', is_hidden: newHidden });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/quizzes/bulk', rad, async (req, res) => {
  try {
    const { quizzes } = req.body;
    if (!Array.isArray(quizzes) || !quizzes.length) return res.status(400).json({ error: 'quizzes array required.' });
    const { data: job } = await supabase.from('bulk_upload_jobs').insert({ user_id: req.user.id, total: quizzes.length, status: 'processing' }).select('id').single();
    let processed = 0, failed = 0, errors = [];
    for (const qd of quizzes) {
      try {
        if (!qd.title || !qd.questions?.length) { errors.push({ title: qd.title || 'unknown', error: 'Missing title or questions' }); failed++; continue; }
        const { data: quiz, error: e1 } = await supabase.from('quizzes').insert({ title: qd.title.trim(), description: qd.description || '', category: qd.category || 'General', difficulty: qd.difficulty || 'Medium', quiz_type: qd.quiz_type || 'basic', creator_id: req.user.id, creator_name: req.user.username, is_public: qd.is_public !== false, plays: 0, tags: qd.tags || [], coins_reward: qd.coins_reward || 10, xp_reward: qd.xp_reward || 50 }).select('id').single();
        if (e1) throw e1;
        await supabase.from('questions').insert(qd.questions.map((q, i) => ({ quiz_id: quiz.id, question_text: q.question_text?.trim() || '', options: q.options, correct_answer: q.correct_answer, explanation: q.explanation || '', order_index: i })));
        processed++;
      } catch (err) { errors.push({ title: qd.title || 'unknown', error: err.message }); failed++; }
    }
    await supabase.from('bulk_upload_jobs').update({ processed, failed, errors: JSON.stringify(errors), status: 'completed' }).eq('id', job?.id);
    res.json({ job_id: job?.id, processed, failed, errors, message: `${processed} uploaded, ${failed} failed.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// ATTEMPTS
// ═══════════════════════════════════════════════════════════

app.post('/api/quizzes/:id/attempt', am, async (req, res) => {
  try {
    const { score, total_questions, time_taken, answers, question_times = [] } = req.body;
    const qid = parseInt(req.params.id, 10);
    if (isNaN(qid) || score === undefined || !total_questions) return res.status(400).json({ error: 'Invalid data.' });
    const { data: qz } = await supabase.from('quizzes').select('plays,coins_reward,xp_reward').eq('id', qid).single();
    await supabase.from('quizzes').update({ plays: (qz?.plays || 0) + 1 }).eq('id', qid);
    const pct = total_questions > 0 ? Math.round((score / total_questions) * 100) : 0;
    let coinsE = 0, xpE = 0;
    if (req.user?.id) {
      coinsE = pct >= 60 ? Math.round((qz?.coins_reward || 10) * (pct / 100)) : 3;
      xpE    = Math.round((qz?.xp_reward || 50) * (pct / 100));
    }
    const { data, error } = await supabase.from('quiz_attempts').insert({
      quiz_id: qid, user_id: req.user?.id || null, user_name: req.user?.username || 'Guest',
      score: Number(score), total_questions: Number(total_questions),
      time_taken: Number(time_taken) || 0, answers: answers || [], question_times,
      coins_earned: coinsE, xp_earned: xpE,
    }).select('id').single();
    if (error) throw error;
    const nb = []; let sr = null;
    if (req.user?.id) {
      const res2 = await updateStreak(req.user.id);
      nb.push(...(res2.newBadges || [])); sr = res2.streakReward;
      if (sr) await notif(req.user.id, 'streak_reward', `🔥 ${sr.label}!`, `${sr.days}-day streak! +${sr.xp} XP, +${sr.coins} coins`);
      const { count } = await supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
      if (count === 1) nb.push(await awardBadge(req.user.id, 'first_quiz'));
      if (count === 100) nb.push(await awardBadge(req.user.id, 'century'));
      if (pct === 100) nb.push(await awardBadge(req.user.id, 'perfect_score'));
      if ((Number(time_taken) || 0) < 60 && Number(total_questions) >= 5) nb.push(await awardBadge(req.user.id, 'speed_demon'));
      await addCoins(req.user.id, coinsE, 'earn', `Quiz: ${pct}%`);
      if (pct === 100) await addCoins(req.user.id, parseInt(await getSetting('perfect_score_coins') || '50'), 'earn', 'Perfect score bonus!');
      await addXP(req.user.id, xpE);
      const { data: uu } = await supabase.from('users').select('total_quizzes,total_correct,total_questions_answered,total_time_spent,total_wins,rank_points').eq('id', req.user.id).single();
      if (uu) {
        await supabase.from('users').update({
          total_quizzes:            (uu.total_quizzes || 0) + 1,
          total_correct:            (uu.total_correct || 0) + Number(score),
          total_questions_answered: (uu.total_questions_answered || 0) + Number(total_questions),
          total_time_spent:         (uu.total_time_spent || 0) + (Number(time_taken) || 0),
          total_wins:               pct >= 60 ? (uu.total_wins || 0) + 1 : (uu.total_wins || 0),
          rank_points:              (uu.rank_points || 0) + Math.round(pct / 10),
        }).eq('id', req.user.id);
      }
      await logAct(req.user.id, 'quiz_attempt', { quiz_id: qid, score, pct }, req);
    }
    res.status(201).json({ attempt_id: data.id, new_badges: nb.filter(Boolean), streak_reward: sr, coins_earned: coinsE, xp_earned: xpE, score_pct: pct });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/save-attempt', am, async (req, res) => {
  try {
    const { title, category, difficulty, topic, questions, score, total_questions, time_taken, answers, question_times = [] } = req.body;
    const { data: quiz, error: e1 } = await supabase.from('quizzes').insert({
      title: title || 'AI Quiz', description: 'AI-generated', category: category || 'General',
      difficulty: difficulty || 'Medium', quiz_type: 'ai',
      creator_id: req.user?.id || null, creator_name: req.user?.username || 'AI',
      is_public: false, plays: 1, is_ai_generated: true,
    }).select('id').single();
    if (e1) throw e1;
    if (questions?.length) {
      await supabase.from('questions').insert(questions.map((q, i) => ({
        quiz_id: quiz.id, question_text: q.question_text, options: q.options,
        correct_answer: q.correct_answer, explanation: q.explanation || '', order_index: i, is_ai_generated: true,
      })));
    }
    const { data: attempt, error: e2 } = await supabase.from('quiz_attempts').insert({
      quiz_id: quiz.id, user_id: req.user?.id || null, user_name: req.user?.username || 'Guest',
      score: Number(score), total_questions: Number(total_questions),
      time_taken: Number(time_taken) || 0, answers: answers || [], question_times,
    }).select('id').single();
    if (e2) throw e2;
    if (req.user?.id && topic) {
      await supabase.from('ai_search_history').insert({ user_id: req.user.id, topic, difficulty: difficulty || 'medium', quiz_id: quiz.id });
      const { data: uq } = await supabase.from('users').select('ai_quota_used').eq('id', req.user.id).single();
      if (uq) await supabase.from('users').update({ ai_quota_used: (uq.ai_quota_used || 0) + 1 }).eq('id', req.user.id);
    }
    const result = req.user?.id ? await updateStreak(req.user.id) : { newBadges: [], streakReward: null };
    if (req.user?.id) {
      const pct = total_questions > 0 ? Math.round((score / total_questions) * 100) : 0;
      if (pct === 100) result.newBadges.push(await awardBadge(req.user.id, 'perfect_score'));
      const { data: uq2 } = await supabase.from('users').select('total_quizzes').eq('id', req.user.id).single();
      if (uq2) await supabase.from('users').update({ total_quizzes: (uq2.total_quizzes || 0) + 1 }).eq('id', req.user.id);
    }
    res.status(201).json({ quiz_id: quiz.id, attempt_id: attempt.id, new_badges: (result.newBadges || []).filter(Boolean), streak_reward: result.streakReward });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/quizzes/:id/leaderboard', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    let q = supabase.from('quiz_attempts')
      .select('user_name,score,total_questions,time_taken,completed_at')
      .eq('quiz_id', parseInt(req.params.id, 10)).not('user_name', 'eq', 'Guest')
      .order('score', { ascending: false }).order('time_taken', { ascending: true }).limit(20);
    if (period === 'week') q = q.gte('completed_at', new Date(Date.now() - 7 * 86400000).toISOString());
    const { data } = await q;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/attempts', ra, async (req, res) => {
  try {
    const { data, error } = await supabase.from('quiz_attempts')
      .select('*,quizzes(title,category,difficulty)').eq('user_id', req.user.id)
      .order('completed_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json((data || []).map(a => ({
      ...a, quiz_title: a.quizzes?.title || 'AI Quiz',
      category: a.quizzes?.category || 'General', quizzes: undefined,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// STREAK
// ═══════════════════════════════════════════════════════════

app.get('/api/users/:id/streak', ra, async (req, res) => {
  try {
    const { data: u } = await supabase.from('users')
      .select('streak_count,longest_streak,last_played_date,freeze_credits,freeze_used,streak_title,xp_points,level')
      .eq('id', req.user.id).single();
    const { data: h } = await supabase.from('streak_history').select('date,action').eq('user_id', req.user.id).order('date', { ascending: false }).limit(90);
    const { data: r } = await supabase.from('streak_rewards').select('*').eq('user_id', req.user.id);
    const { data: fr } = await supabase.from('freeze_history').select('*').eq('user_id', req.user.id).limit(20);
    const cur = u?.streak_count || 0;
    const next = SM.find(m => m.days > cur);
    res.json({ current_streak: cur, longest_streak: u?.longest_streak || 0, last_played: u?.last_played_date, freeze_credits: u?.freeze_credits || 0, freeze_used: u?.freeze_used || 0, streak_title: u?.streak_title || null, xp_points: u?.xp_points || 0, level: u?.level || 1, streak_history: h || [], rewards: r || [], freeze_history: fr || [], milestones: SM, next_milestone: next || null, progress_to_next: next ? Math.round((cur / next.days) * 100) : 100 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════

app.get('/api/quizzes/:id/comments', async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (isNaN(quizId)) return res.status(400).json({ error: 'Invalid quiz ID.' });
    const { sort = 'newest', parent_id } = req.query;
    let q = supabase.from('comments')
      .select('id,quiz_id,user_id,username,avatar_url,body,parent_id,likes_count,is_pinned,is_removed,created_at')
      .eq('quiz_id', quizId).eq('is_removed', false);
    if (parent_id && parent_id !== 'null' && parent_id !== 'undefined') {
      q = q.eq('parent_id', parseInt(parent_id, 10));
    } else {
      q = q.is('parent_id', null);
    }
    q = sort === 'top'
      ? q.order('likes_count', { ascending: false })
      : q.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    q = q.limit(50);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quizzes/:id/comments', ra, async (req, res) => {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (isNaN(quizId)) return res.status(400).json({ error: 'Invalid quiz ID.' });
    const body = req.body.body?.trim();
    const parent_id = req.body.parent_id ? parseInt(req.body.parent_id, 10) : null;
    if (!body || body.length < 2) return res.status(400).json({ error: 'Comment too short.' });
    if (body.length > 500) return res.status(400).json({ error: 'Comment too long (max 500).' });
    const { data: u } = await supabase.from('users').select('avatar_url').eq('id', req.user.id).single();
    const { data, error } = await supabase.from('comments').insert({
      quiz_id: quizId, user_id: req.user.id, username: req.user.username,
      avatar_url: u?.avatar_url || null, body, parent_id: parent_id || null,
      likes_count: 0, is_pinned: false, is_reported: false, is_removed: false,
    }).select('id,quiz_id,user_id,username,avatar_url,body,parent_id,likes_count,is_pinned,created_at').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/comments/:id/like', ra, async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) return res.status(400).json({ error: 'Invalid comment ID.' });
    const { data: ex } = await supabase.from('comment_likes').select('id').eq('comment_id', cid).eq('user_id', req.user.id).maybeSingle();
    if (ex) {
      await supabase.from('comment_likes').delete().eq('id', ex.id);
      const { data: cm } = await supabase.from('comments').select('likes_count').eq('id', cid).single();
      await supabase.from('comments').update({ likes_count: Math.max((cm?.likes_count || 0) - 1, 0) }).eq('id', cid);
      return res.json({ liked: false });
    }
    await supabase.from('comment_likes').insert({ comment_id: cid, user_id: req.user.id });
    const { data: cm } = await supabase.from('comments').select('likes_count').eq('id', cid).single();
    await supabase.from('comments').update({ likes_count: (cm?.likes_count || 0) + 1 }).eq('id', cid);
    res.json({ liked: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/comments/:id/report', ra, async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) return res.status(400).json({ error: 'Invalid comment ID.' });
    const { reason = 'inappropriate' } = req.body;
    await supabase.from('comment_reports').upsert({ comment_id: cid, user_id: req.user.id, reason });
    await supabase.from('comments').update({ is_reported: true }).eq('id', cid);
    res.json({ message: 'Reported.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/comments/:id', ra, async (req, res) => {
  try {
    const cid = parseInt(req.params.id, 10);
    if (isNaN(cid)) return res.status(400).json({ error: 'Invalid comment ID.' });
    const { data: c } = await supabase.from('comments').select('user_id').eq('id', cid).single();
    if (!c) return res.status(404).json({ error: 'Not found.' });
    if (String(c.user_id) !== String(req.user.id) && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden.' });
    await supabase.from('comments').update({ is_removed: true, body: '[deleted]' }).eq('id', cid);
    res.json({ message: 'Deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// PUBLIC PROFILES & FOLLOWS
// ═══════════════════════════════════════════════════════════

app.get('/api/users/:username/profile', async (req, res) => {
  try {
    const { data: user, error } = await supabase.from('users')
      .select('id,username,unique_display_id,bio,avatar_url,streak_count,longest_streak,streak_title,xp_points,level,subscription_plan,total_quizzes,total_correct,followers_count,following_count,is_public,created_at')
      .eq('username', req.params.username).single();
    if (error || !user) return res.status(404).json({ error: 'User not found.' });
    if (!user.is_public) return res.status(403).json({ error: 'This profile is private.' });
    const { data: badges }         = await supabase.from('user_badges').select('badge_id,earned_at').eq('user_id', user.id);
    const { data: rewards }        = await supabase.from('streak_rewards').select('*').eq('user_id', user.id).order('earned_at', { ascending: false }).limit(5);
    const { data: recentAttempts } = await supabase.from('quiz_attempts').select('score,total_questions,completed_at,quizzes(title,category)').eq('user_id', user.id).order('completed_at', { ascending: false }).limit(5);
    res.json({
      ...user,
      badges: (badges || []).map(b => ({ ...BADGES[b.badge_id], earned_at: b.earned_at })).filter(x => x?.id),
      recent_rewards: rewards || [], recent_attempts: recentAttempts || [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:id/follow', ra, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) return res.status(400).json({ error: "Can't follow yourself." });
    const { data: ex } = await supabase.from('follows').select('id').eq('follower_id', req.user.id).eq('following_id', targetId).maybeSingle();
    if (ex) {
      await supabase.from('follows').delete().eq('id', ex.id);
      const [{ data: me }, { data: them }] = await Promise.all([
        supabase.from('users').select('following_count').eq('id', req.user.id).single(),
        supabase.from('users').select('followers_count').eq('id', targetId).single(),
      ]);
      await supabase.from('users').update({ following_count: Math.max((me?.following_count || 0) - 1, 0) }).eq('id', req.user.id);
      await supabase.from('users').update({ followers_count: Math.max((them?.followers_count || 0) - 1, 0) }).eq('id', targetId);
      return res.json({ following: false });
    }
    await supabase.from('follows').insert({ follower_id: req.user.id, following_id: targetId });
    const [{ data: me }, { data: them }] = await Promise.all([
      supabase.from('users').select('following_count').eq('id', req.user.id).single(),
      supabase.from('users').select('followers_count').eq('id', targetId).single(),
    ]);
    await supabase.from('users').update({ following_count: (me?.following_count || 0) + 1 }).eq('id', req.user.id);
    await supabase.from('users').update({ followers_count: (them?.followers_count || 0) + 1 }).eq('id', targetId);
    res.json({ following: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:id/follow-status', ra, async (req, res) => {
  const { data } = await supabase.from('follows').select('id').eq('follower_id', req.user.id).eq('following_id', req.params.id).maybeSingle();
  res.json({ following: !!data });
});

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

app.get('/api/users/:id/analytics', ra, async (req, res) => {
  try {
    const { data: attempts } = await supabase.from('quiz_attempts')
      .select('score,total_questions,quizzes(category)').eq('user_id', req.user.id).limit(200);
    const catMap = {};
    for (const a of (attempts || [])) {
      const cat = a.quizzes?.category || 'General';
      if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0, attempts: 0 };
      catMap[cat].correct += a.score; catMap[cat].total += a.total_questions; catMap[cat].attempts += 1;
    }
    res.json({
      categories: Object.entries(catMap).map(([name, v]) => ({
        name, correct: v.correct, total: v.total, attempts: v.attempts,
        pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      })).sort((a, b) => a.pct - b.pct),
      total_attempts: (attempts || []).length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/recommendations', ra, async (req, res) => {
  try {
    const { data: attempts } = await supabase.from('quiz_attempts')
      .select('score,total_questions,quiz_id,quizzes(category)').eq('user_id', req.user.id).limit(50);
    const attemptedIds = new Set((attempts || []).map(a => a.quiz_id));
    const catMap = {};
    for (const a of (attempts || [])) {
      const cat = a.quizzes?.category || 'General';
      if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 };
      catMap[cat].correct += a.score; catMap[cat].total += a.total_questions;
    }
    const weakCat = Object.entries(catMap)
      .map(([n, v]) => ({ name: n, pct: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)[0]?.name;
    let recs = [];
    if (weakCat) {
      const { data } = await supabase.from('quizzes')
        .select('id,title,category,difficulty,plays,creator_name')
        .eq('is_public', true).eq('category', weakCat).order('plays', { ascending: false }).limit(6);
      recs = (data || []).filter(q => !attemptedIds.has(q.id));
    }
    if (recs.length < 4) {
      const { data } = await supabase.from('quizzes')
        .select('id,title,category,difficulty,plays,creator_name')
        .eq('is_public', true).order('plays', { ascending: false }).limit(10);
      recs = [...recs, ...(data || []).filter(q => !attemptedIds.has(q.id) && !recs.find(r => r.id === q.id))].slice(0, 6);
    }
    res.json({ recommendations: recs, weak_category: weakCat || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// BADGES
// ═══════════════════════════════════════════════════════════

app.get('/api/users/:id/badges', async (req, res) => {
  try {
    const { data } = await supabase.from('user_badges').select('badge_id,earned_at').eq('user_id', req.params.id);
    const badges = (data || []).map(b => ({ ...BADGES[b.badge_id], earned_at: b.earned_at })).filter(b => b?.id);
    res.json({ badges, all_badges: Object.values(BADGES) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════════════════

app.post('/api/bookmarks/toggle', ra, async (req, res) => {
  try {
    const qid = parseInt(req.body.quiz_id, 10);
    if (!qid || isNaN(qid)) return res.status(400).json({ error: 'quiz_id required.' });
    const { data: ex } = await supabase.from('bookmarks').select('id').eq('user_id', req.user.id).eq('quiz_id', qid).maybeSingle();
    if (ex) {
      await supabase.from('bookmarks').delete().eq('id', ex.id);
      return res.json({ bookmarked: false });
    }
    await supabase.from('bookmarks').insert({ user_id: req.user.id, quiz_id: qid });
    const { count } = await supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
    const badge = (count || 0) >= 5 ? await awardBadge(req.user.id, 'bookworm') : null;
    await notif(req.user.id, 'bookmark', '🔖 Quiz Saved!', 'Quiz added to your saved collection.');
    res.json({ bookmarked: true, new_badge: badge });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/bookmarks', ra, async (req, res) => {
  try {
    const { data: bm, error: e1 } = await supabase.from('bookmarks').select('quiz_id,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (e1) throw e1;
    if (!bm?.length) return res.json([]);
    const ids = bm.map(b => parseInt(b.quiz_id, 10)).filter(id => !isNaN(id));
    if (!ids.length) return res.json([]);
    const { data: quizzes, error: e2 } = await supabase.from('quizzes').select('id,title,description,category,difficulty,creator_name,plays,created_at').in('id', ids);
    if (e2) throw e2;
    const m = {}; for (const q of (quizzes || [])) m[q.id] = q;
    res.json(bm.map(b => { const q = m[parseInt(b.quiz_id, 10)]; return q ? { ...q, bookmarked_at: b.created_at } : null; }).filter(Boolean));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/bookmarks/check/:quizId', ra, async (req, res) => {
  try {
    const qid = parseInt(req.params.quizId, 10);
    if (isNaN(qid)) return res.json({ bookmarked: false });
    const { data } = await supabase.from('bookmarks').select('id').eq('user_id', req.user.id).eq('quiz_id', qid).maybeSingle();
    res.json({ bookmarked: !!data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// SPIN WHEEL
// ═══════════════════════════════════════════════════════════

app.get('/api/spin-prizes', ra, async (req, res) => {
  try {
    const rawPrizes = await getSetting('spin_prizes');
    const prizes = rawPrizes ? JSON.parse(rawPrizes) : [];
    res.json(prizes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/spin-wheel', ra, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: u, error: uErr } = await supabase
      .from('users')
      .select('last_spin_date, coins, freeze_credits')
      .eq('id', req.user.id)
      .single();

    if (uErr) return res.status(500).json({ error: 'Failed to fetch user.' });

    if (u?.last_spin_date === today) {
      return res.status(429).json({
        error: 'Already spun today! Come back tomorrow.',
        already_spun: true,
      });
    }

    const rawPrizes = await getSetting('spin_prizes');
    const prizes = rawPrizes ? JSON.parse(rawPrizes) : [];
    if (!prizes.length) {
      return res.status(400).json({ error: 'Spin wheel not configured.' });
    }

    const total = prizes.reduce((a, p) => a + (p.probability || 10), 0);
    let rand = Math.random() * total;
    let cumul = 0;
    let won = prizes[prizes.length - 1];
    for (const p of prizes) {
      cumul += p.probability || 10;
      if (rand <= cumul) { won = p; break; }
    }

    const { error: spinSaveErr } = await supabase
      .from('users')
      .update({ last_spin_date: today })
      .eq('id', req.user.id);

    if (spinSaveErr) {
      console.error('Failed to save spin date:', spinSaveErr.message);
      return res.status(500).json({ error: 'Failed to record spin. Please try again.' });
    }

    let reward = {};

    if (won.value?.endsWith('c')) {
      const coinAmount = parseInt(won.value, 10);
      if (!isNaN(coinAmount) && coinAmount > 0) {
        await addCoins(req.user.id, coinAmount, 'spin', `Spin: ${won.label}`);
        reward = { type: 'coins', amount: coinAmount };
      }
    } else if (won.value?.startsWith('pro')) {
      const days = parseInt(won.value.replace('pro', ''), 10) || 3;
      await supabase.from('users').update({
        subscription_plan: 'pro',
        subscription_end:  new Date(Date.now() + days * 86400000).toISOString(),
      }).eq('id', req.user.id);
      reward = { type: 'plan', plan: 'pro', days };
    } else if (won.value === 'restore') {
      const currentCredits = u?.freeze_credits || 0;
      await supabase.from('users')
        .update({ freeze_credits: currentCredits + 1 })
        .eq('id', req.user.id);
      reward = { type: 'restore' };
    }

    await notif(req.user.id, 'spin', '🎡 You spun the wheel!', `You won: ${won.label}`);

    return res.json({
      won,
      reward,
      message: `You won: ${won.label}!`,
    });

  } catch (e) {
    console.error('spin-wheel error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// HINTS
// ═══════════════════════════════════════════════════════════

app.get('/api/hints/cost', ra, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: rows } = await supabase
      .from('hint_usage')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('usage_date', today);
    const hintsUsedToday = (rows || []).length;
    const cost           = 60 * Math.pow(2, hintsUsedToday);
    res.json({ cost, hints_used_today: hintsUsedToday, next_hint_number: hintsUsedToday + 1 });
  } catch (e) {
    console.error('hints/cost error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/hints/use', ra, async (req, res) => {
  try {
    const { question_id, quiz_id, question_text, options = [], is_ai = false } = req.body;
    if (!question_text?.trim()) return res.status(400).json({ error: 'question_text is required.' });

    const today = new Date().toISOString().split('T')[0];
    const { data: usageRows } = await supabase.from('hint_usage').select('id').eq('user_id', req.user.id).eq('usage_date', today);
    const hintsUsedToday = (usageRows || []).length;
    const hintNumber     = hintsUsedToday + 1;
    const cost           = 60 * Math.pow(2, hintsUsedToday);

    const { data: userData } = await supabase.from('users').select('coins').eq('id', req.user.id).single();
    if (!userData || userData.coins < cost) {
      return res.status(402).json({
        error:    'insufficient_coins',
        message:  `You need ${cost} coins for this hint. You have ${userData?.coins || 0}.`,
        required: cost,
        balance:  userData?.coins || 0,
        redirect: '/dashboard',
      });
    }

    let hintText = '';
    if (!is_ai && question_id) {
      const { data: qRow } = await supabase.from('questions').select('hint').eq('id', question_id).single();
      if (qRow?.hint?.trim()) hintText = qRow.hint.trim();
    }

    if (!hintText) {
      if (!groq) {
        return res.status(503).json({ error: 'AI not configured. Add GROQ_API_KEY to your .env to enable AI-generated hints.' });
      }
      const optionsText = options.length
        ? `\nOptions:\n${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}`
        : '';
      const prompt = `You are a helpful quiz tutor. Give a SHORT hint (1-2 sentences max) for this quiz question WITHOUT revealing the answer directly. Just guide the student's thinking.\n\nQuestion: ${question_text.trim()}${optionsText}\n\nHint (do NOT reveal the correct answer):`;
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 120,
      });
      hintText = completion.choices[0]?.message?.content?.trim() || 'Think carefully about the key concept behind this question.';
      if (!is_ai && question_id && hintText) {
        await supabase.from('questions').update({ hint: hintText }).eq('id', question_id);
      }
    }

    const newBalance = await addCoins(req.user.id, -cost, 'hint', `Hint #${hintNumber} today (${question_text.slice(0, 40)}…)`);
    await supabase.from('hint_usage').insert({
      user_id: req.user.id, question_id: question_id || null, quiz_id: quiz_id || null,
      hint_text: hintText, coins_charged: cost, hint_number: hintNumber, usage_date: today,
    });

    res.json({ hint: hintText, coins_charged: cost, new_balance: newBalance, hints_used_today: hintNumber, next_hint_cost: cost * 2 });
  } catch (e) {
    console.error('hints/use error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/hints/history', ra, async (req, res) => {
  try {
    const { data } = await supabase.from('hint_usage')
      .select('id,hint_text,coins_charged,hint_number,usage_date,created_at,quiz_id')
      .eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(20);
    res.json(data || []);
  } catch (e) {
    console.error('hints/history error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// COINS
// ═══════════════════════════════════════════════════════════

app.get('/api/coins/balance', ra, async (req, res) => {
  const { data } = await supabase.from('users').select('coins,total_coins_earned').eq('id', req.user.id).single();
  res.json({ balance: data?.coins || 0, total_earned: data?.total_coins_earned || 0 });
});
app.get('/api/coins/history', ra, async (req, res) => {
  const { data } = await supabase.from('coin_transactions').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
  res.json(data || []);
});
app.post('/api/coins/spend', ra, async (req, res) => {
  try {
    const { amount, description, item } = req.body;
    const { data: u } = await supabase.from('users').select('coins').eq('id', req.user.id).single();
    if ((u?.coins || 0) < amount) return res.status(400).json({ error: 'Insufficient coins.' });
    const newBal = await addCoins(req.user.id, -amount, 'spend', description || `Spent on ${item}`);
    res.json({ message: 'Coins spent.', balance: newBal });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// REFERRALS
// ═══════════════════════════════════════════════════════════

app.get('/api/referrals', ra, async (req, res) => {
  try {
    const { data: u } = await supabase.from('users').select('referral_code,referral_count').eq('id', req.user.id).single();
    const { data: refs } = await supabase.from('referrals').select('*,users!referrals_referee_id_fkey(username,created_at)').eq('referrer_id', req.user.id).order('created_at', { ascending: false });
    res.json({ referral_code: u?.referral_code, total_referrals: u?.referral_count || 0, referrals: refs || [], link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup?ref=${u?.referral_code}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════

app.get('/api/leaderboard/:period', async (req, res) => {
  try {
    const { period } = req.params;
    if (!['weekly', 'monthly', 'yearly', 'alltime'].includes(period)) return res.status(400).json({ error: 'Invalid period.' });
    if (period === 'alltime') {
      const { data } = await supabase.from('users')
        .select('id,username,avatar_url,rank_points,xp_points,streak_count,subscription_plan,streak_title,total_quizzes,total_wins')
        .order('rank_points', { ascending: false }).limit(100);
      return res.json(data || []);
    }
    const { data } = await supabase.from('leaderboard_snapshots')
      .select('*,users(username,avatar_url,subscription_plan,streak_title)')
      .eq('period', period).order('rank', { ascending: true }).limit(100);
    res.json((data || []).map(r => ({ ...r, username: r.users?.username, avatar_url: r.users?.avatar_url, subscription_plan: r.users?.subscription_plan, streak_title: r.users?.streak_title, users: undefined })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════

app.get('/api/events', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase.from('events').select('*').eq('is_active', true).lte('start_date', now).gte('end_date', now).order('start_date', { ascending: false });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/events/upcoming', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase.from('events').select('*').eq('is_active', true).gte('end_date', now).order('start_date', { ascending: true }).limit(10);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/events/all', async (_, res) => {
  try {
    const { data } = await supabase.from('events').select('*').order('start_date', { ascending: false });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/events/:id/quiz', async (req, res) => {
  try {
    const eid = parseInt(req.params.id, 10);
    if (isNaN(eid)) return res.status(400).json({ error: 'Invalid event ID.' });
    const { data: ev } = await supabase.from('events').select('*').eq('id', eid).single();
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    const now = new Date();
    if (!ev.is_active || new Date(ev.start_date) > now || new Date(ev.end_date) < now) {
      return res.status(410).json({ error: 'This event is not currently active.' });
    }
    if (!ev.quiz_id) return res.status(404).json({ error: 'No quiz attached to this event.' });
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', ev.quiz_id).single();
    if (!quiz) return res.status(404).json({ error: 'Event quiz not found.' });
    const { data: qs } = await supabase.from('questions').select('*').eq('quiz_id', ev.quiz_id).order('order_index', { ascending: true });
    res.json({
      event: { id: ev.id, title: ev.title, bonus_xp: ev.bonus_xp, bonus_coins: ev.bonus_coins, bonus_badge: ev.bonus_badge, emoji: ev.emoji, is_elite_only: ev.is_elite_only },
      quiz: { ...quiz, questions: (qs || []).sort(() => Math.random() - 0.5) },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/events', rad, async (req, res) => {
  try {
    const { title, description, banner_url, banner_color, emoji, quiz_id, start_date, end_date, bonus_xp, bonus_coins, bonus_badge, is_elite_only } = req.body;
    if (!title || !start_date || !end_date) return res.status(400).json({ error: 'title, start_date, end_date required.' });
    const { data, error } = await supabase.from('events').insert({
      title, description: description || '', banner_url: banner_url || null,
      banner_color: banner_color || '#6366f1', emoji: emoji || '🎉',
      quiz_id: quiz_id ? parseInt(quiz_id, 10) : null, start_date, end_date,
      bonus_xp: bonus_xp || 0, bonus_coins: bonus_coins || 0,
      bonus_badge: bonus_badge || null, is_elite_only: is_elite_only || false, created_by: req.user.id,
    }).select('id').single();
    if (error) throw error;
    res.status(201).json({ id: data.id, message: 'Event created!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/events/:id', rad, async (req, res) => {
  try {
    await supabase.from('events').update(req.body).eq('id', req.params.id);
    res.json({ message: 'Updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/events/:id/join', ra, async (req, res) => {
  try {
    const { score, total } = req.body;
    const { data: ev } = await supabase.from('events').select('is_elite_only,bonus_xp,bonus_coins,bonus_badge').eq('id', req.params.id).single();
    if (ev?.is_elite_only && req.user.plan !== 'elite' && req.user.plan !== 'lifetime' && !req.user.is_admin) {
      return res.status(403).json({ error: 'Elite subscription required.', requires_upgrade: true, redirect: '/subscription' });
    }
    await supabase.from('event_participants').upsert({ event_id: parseInt(req.params.id, 10), user_id: req.user.id, score: score || 0, total: total || 0 });
    if (ev?.bonus_xp) await addXP(req.user.id, ev.bonus_xp);
    if (ev?.bonus_coins) await addCoins(req.user.id, ev.bonus_coins, 'event', 'Event participation bonus');
    if (ev?.bonus_badge) await awardBadge(req.user.id, ev.bonus_badge);
    await awardBadge(req.user.id, 'event_hero');
    res.json({ message: 'Joined!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/events/:id/leaderboard', async (req, res) => {
  try {
    const { data } = await supabase.from('event_participants')
      .select('score,total,joined_at,users(username,avatar_url,streak_title)')
      .eq('event_id', req.params.id).order('score', { ascending: false }).limit(20);
    res.json((data || []).map(p => ({ ...p, username: p.users?.username, avatar_url: p.users?.avatar_url, streak_title: p.users?.streak_title, users: undefined })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════

app.get('/api/subscription/plans', async (_, res) => {
  try {
    const { data } = await supabase.from('plan_settings').select('*').eq('is_active', true).order('price_monthly', { ascending: true });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/subscription/activate', ra, async (req, res) => {
  try {
    const { plan, billing_cycle = 'monthly', amount, upi_ref, transaction_id } = req.body;
    if (!['pro', 'elite', 'lifetime'].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' });
    const { data: ps } = await supabase.from('plan_settings').select('*').eq('plan_id', plan).single();
    if (!ps) return res.status(400).json({ error: 'Plan not found.' });
    const limits = typeof ps.limits === 'string' ? JSON.parse(ps.limits) : ps.limits || {};
    const expected = billing_cycle === 'yearly' ? ps.price_yearly : billing_cycle === 'lifetime' ? ps.price_lifetime : billing_cycle === 'quarterly' ? ps.price_quarterly : ps.price_monthly;
    if (Number(amount) < expected * 0.9) return res.status(400).json({ error: `Amount mismatch. Expected ₹${expected}.` });
    const daysMap = { monthly: 30, yearly: 365, lifetime: 36500, quarterly: 90 };
    const days = daysMap[billing_cycle] || 30;
    const expires = billing_cycle === 'lifetime' ? null : new Date(Date.now() + days * 86400000).toISOString();
    await supabase.from('users').update({ subscription_plan: plan, subscription_end: expires, freeze_credits: limits.freeze_monthly || 2 }).eq('id', req.user.id);
    await supabase.from('subscriptions').insert({ user_id: req.user.id, plan, billing_cycle, status: 'active', amount: Number(amount), currency: 'INR', upi_ref: upi_ref || null, transaction_id: transaction_id || null, started_at: new Date().toISOString(), expires_at: expires, approved_at: new Date().toISOString() });
    await supabase.from('revenue_log').insert({ user_id: req.user.id, plan, amount: Number(amount), upi_ref: upi_ref || null, transaction_id: transaction_id || null, status: 'success' });
    await awardBadge(req.user.id, plan === 'elite' || plan === 'lifetime' ? 'elite_member' : 'pro_member');
    await notif(req.user.id, 'subscription', `${plan === 'elite' ? '💎' : plan === 'lifetime' ? '♾️' : '⭐'} ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated!`, 'All premium features are now unlocked!');
    const { data: u } = await supabase.from('users').select('email,username').eq('id', req.user.id).single();
    if (u) sendEmail(u.email, `✅ ${plan} Subscription Activated!`, baseEmail(`<h2 style="color:#8b5cf6">Subscription Activated! 🎉</h2><p>Hi <strong>${u.username}</strong>, your <strong>${plan}</strong> plan is now active!</p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="background:#8b5cf6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">Start Exploring →</a>`)).catch(() => {});
    const { data: freshU } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    res.json({ message: `${plan} plan activated!`, token: signToken(freshU), expires_at: expires, plan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/subscription/manual', ra, async (req, res) => {
  try {
    const { plan, billing_cycle = 'monthly', amount, upi_ref, screenshot_url } = req.body;
    if (!['pro', 'elite', 'lifetime'].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' });
    const { data, error } = await supabase.from('subscriptions').insert({ user_id: req.user.id, plan, billing_cycle, status: 'manual_pending', amount: Number(amount) || 0, currency: 'INR', upi_ref: upi_ref || null, screenshot_url: screenshot_url || null }).select('id').single();
    if (error) throw error;
    await notif(req.user.id, 'payment_pending', '⏳ Payment Under Review', 'Typically approved within 2 hours.');
    res.status(201).json({ submission_id: data.id, message: 'Payment submitted! Admin will review within 2 hours.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ai/quota', ra, async (req, res) => {
  try {
    const { data: u } = await supabase.from('users').select('ai_quota_used,ai_quota_reset_date,subscription_plan').eq('id', req.user.id).single();
    const today = new Date().toISOString().split('T')[0];
    let used = u?.ai_quota_used || 0;
    if (u?.ai_quota_reset_date !== today) { await supabase.from('users').update({ ai_quota_used: 0, ai_quota_reset_date: today }).eq('id', req.user.id); used = 0; }
    const { data: ps } = await supabase.from('plan_settings').select('limits').eq('plan_id', u?.subscription_plan || 'free').single();
    const limits = typeof ps?.limits === 'string' ? JSON.parse(ps.limits) : ps?.limits || {};
    const limit = limits.ai_daily || 5;
    res.json({ allowed: used < limit || req.user.is_admin, used, limit, remaining: Math.max(0, limit - used), plan: u?.subscription_plan || 'free' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// PROMO CODES
// ═══════════════════════════════════════════════════════════

app.post('/api/promo/apply', ra, async (req, res) => {
  try {
    const { code } = req.body;
    const { data: promo } = await supabase.from('promo_codes').select('*').eq('code', code?.toUpperCase().trim()).eq('is_active', true).single();
    if (!promo) return res.status(404).json({ error: 'Invalid or expired promo code.' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return res.status(400).json({ error: 'Promo code expired.' });
    if (promo.used_count >= promo.max_uses) return res.status(400).json({ error: 'Promo code fully used.' });
    await supabase.from('promo_codes').update({ used_count: promo.used_count + 1 }).eq('id', promo.id);
    if (promo.discount_type === 'free_plan' && promo.free_plan && promo.free_days > 0) {
      const exp = new Date(Date.now() + promo.free_days * 86400000).toISOString();
      await supabase.from('users').update({ subscription_plan: promo.free_plan, subscription_end: exp }).eq('id', req.user.id);
      await notif(req.user.id, 'promo', '🎁 Promo Applied!', `${promo.free_plan} plan activated for ${promo.free_days} days!`);
    }
    res.json({ message: 'Promo applied!', promo: { type: promo.discount_type, value: promo.discount_value, free_plan: promo.free_plan, free_days: promo.free_days } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// CHALLENGES
// ═══════════════════════════════════════════════════════════

app.post('/api/challenges/create', ra, async (req, res) => {
  try {
    const { quiz_id, score, total } = req.body;
    const qid = parseInt(quiz_id, 10);
    if (isNaN(qid)) return res.status(400).json({ error: 'Invalid quiz_id.' });
    const token = crypto.randomBytes(16).toString('hex');
    const { data, error } = await supabase.from('challenges').insert({
      quiz_id: qid, challenger_id: req.user.id, challenger_name: req.user.username,
      challenger_score: Number(score) || 0, challenger_total: Number(total) || 0,
      token, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).select('id,token').single();
    if (error) throw error;
    await awardBadge(req.user.id, 'social_star');
    res.status(201).json({ token: data.token, link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/challenge/${data.token}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/challenges/:token', async (req, res) => {
  try {
    const { data, error } = await supabase.from('challenges').select('*,quizzes(id,title,category,difficulty)').eq('token', req.params.token).single();
    if (error || !data) return res.status(404).json({ error: 'Challenge not found.' });
    if (new Date(data.expires_at) < new Date()) return res.status(410).json({ error: 'Challenge expired.' });
    res.json({ ...data, quiz: data.quizzes, quizzes: undefined });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/challenges/:token/complete', am, async (req, res) => {
  try {
    const { score, total } = req.body;
    const { data: challenge, error } = await supabase.from('challenges').select('*').eq('token', req.params.token).single();
    if (error || !challenge) return res.status(404).json({ error: 'Not found.' });
    if (new Date(challenge.expires_at) < new Date()) return res.status(410).json({ error: 'Expired.' });
    if (challenge.completed) return res.status(409).json({ error: 'Already completed.' });
    await supabase.from('challenges').update({
      completed: true, opponent_id: req.user?.id || null,
      opponent_name: req.user?.username || 'Guest', opponent_score: score,
    }).eq('token', req.params.token);
    const won = score > challenge.challenger_score, tied = score === challenge.challenger_score;
    res.json({ result: won ? 'win' : tied ? 'tie' : 'loss', your_score: score, challenger_score: challenge.challenger_score, challenger_name: challenge.challenger_name, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// AI ROUTES
// ═══════════════════════════════════════════════════════════

const aiRL = (req, res, next) => {
  const uid = req.user?.id || req.ip;
  if (!rl(`ai:${uid}`, 10, 60000)) return res.status(429).json({ error: 'AI rate limit. Wait 1 min.' });
  next();
};

app.post('/api/ai/quiz-session', aiRL, am, async (req, res) => {
  if (!groq) return res.status(503).json({ error: 'AI not configured.' });
  const { topic = 'General Knowledge', difficulty = 'medium', count = 10, used_questions = [] } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic required.' });
  if (req.user?.id && !req.user.is_admin) {
    const { data: u } = await supabase.from('users').select('ai_quota_used,ai_quota_reset_date,subscription_plan').eq('id', req.user.id).single();
    const today = new Date().toISOString().split('T')[0];
    let used = u?.ai_quota_used || 0;
    if (u?.ai_quota_reset_date !== today) { await supabase.from('users').update({ ai_quota_used: 0, ai_quota_reset_date: today }).eq('id', req.user.id); used = 0; }
    const { data: ps } = await supabase.from('plan_settings').select('limits').eq('plan_id', u?.subscription_plan || 'free').single();
    const limits = typeof ps?.limits === 'string' ? JSON.parse(ps.limits) : ps?.limits || {};
    const limit = limits.ai_daily || 5;
    if (used >= limit) return res.status(429).json({ error: `Daily limit reached (${limit}/day). Upgrade for unlimited.`, quota: { used, limit } });
  }
  try {
    const excl = used_questions.length > 0 ? `\nAVOID:\n${used_questions.slice(0, 10).map((q, i) => `${i + 1}. ${q}`).join('\n')}` : '';
    const prompt = `Generate exactly ${Math.min(count, 20)} unique multiple choice questions about "${topic.trim()}". Difficulty: ${difficulty}${excl}\nReturn ONLY valid JSON array:\n[{"question_text":"?","options":["A","B","C","D"],"correct_answer":0,"explanation":"..."}]\nVary correct_answer positions 0-3.`;
    const c = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.9, max_tokens: 2048 });
    const text = c.choices[0]?.message?.content || '';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let raw; try { raw = JSON.parse(clean); } catch { const m = clean.match(/\[[\s\S]*\]/); if (!m) throw new Error('Parse fail'); raw = JSON.parse(m[0]); }
    if (!Array.isArray(raw)) throw new Error('Invalid format');
    const questions = raw.map(q => ({
      id: `ai_${Math.random().toString(36).substr(2, 9)}`,
      question_text: String(q.question_text || '').trim(),
      options: (q.options || []).map(o => String(o).trim()),
      correct_answer: parseInt(q.correct_answer) || 0,
      explanation: String(q.explanation || '').trim(),
      is_ai_generated: true,
    })).filter(q => q.question_text && q.options.length === 4);
    const usedL = used_questions.map(q => q.toLowerCase().trim());
    const deduped = questions.filter(q => !usedL.some(u => u === q.question_text.toLowerCase().trim()));
    if (req.user?.id) {
      const { data: uq } = await supabase.from('users').select('ai_quota_used').eq('id', req.user.id).single();
      if (uq) await supabase.from('users').update({ ai_quota_used: (uq.ai_quota_used || 0) + 1 }).eq('id', req.user.id);
    }
    res.json({ questions: deduped, topic, difficulty, count: deduped.length, generated: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message || 'AI generation failed.' }); }
});

app.post('/api/ai/generate-questions', aiRL, am, async (req, res) => {
  if (!groq) return res.status(503).json({ error: 'AI not configured.' });
  const { topic, difficulty = 'medium', count = 5 } = req.body;
  if (!topic?.trim()) return res.status(400).json({ error: 'Topic required.' });
  try {
    const prompt = `Generate ${Math.min(count, 20)} multiple choice quiz questions about "${topic.trim()}". Difficulty: ${difficulty}\nReturn ONLY valid JSON:\n[{"question_text":"?","options":["A","B","C","D"],"correct_answer":0,"explanation":"..."}]\nVary correct_answer 0-3.`;
    const c = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 2048 });
    const text = c.choices[0]?.message?.content || '';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let raw; try { raw = JSON.parse(clean); } catch { const m = clean.match(/\[[\s\S]*\]/); if (!m) throw new Error('Parse fail'); raw = JSON.parse(m[0]); }
    if (!Array.isArray(raw)) throw new Error('Invalid format');
    const questions = raw.map(q => ({ question_text: String(q.question_text || '').trim(), options: (q.options || []).map(o => String(o).trim()), correct_answer: parseInt(q.correct_answer) || 0, explanation: String(q.explanation || '').trim(), is_ai_generated: false })).filter(q => q.question_text && q.options.length === 4);
    res.json({ questions, topic, difficulty, count: questions.length });
  } catch (e) { res.status(500).json({ error: e.message || 'AI generation failed.' }); }
});

app.post('/api/ai/tutor', am, async (req, res) => {
  if (!groq) return res.status(503).json({ error: 'AI not configured.' });
  try {
    const { question, user_answer, correct_answer, options, topic } = req.body;
    const prompt = `A student answered incorrectly.\n\nQuestion: ${question}\nStudent's answer: ${options?.[user_answer] || user_answer}\nCorrect answer: ${options?.[correct_answer] || correct_answer}\nTopic: ${topic || 'General'}\n\nRespond ONLY in JSON:\n{"why_wrong":"...","correct_explanation":"...","key_concept":"...","quick_tip":"...","practice_suggestion":"..."}`;
    const c = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.4, max_tokens: 600 });
    const text = c.choices[0]?.message?.content || '';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed; try { parsed = JSON.parse(clean); } catch { parsed = { why_wrong: 'Your answer was incorrect.', correct_explanation: `The correct answer is: ${options?.[correct_answer] || correct_answer}`, key_concept: 'Review this topic.', quick_tip: 'Practice similar questions.', practice_suggestion: 'Look for more questions on this topic.' }; }
    res.json(parsed);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/ai/generate-event-quiz', rad, async (req, res) => {
  if (!groq) return res.status(503).json({ error: 'AI not configured.' });
  try {
    const { event_theme, difficulty = 'medium', count = 10, language = 'en' } = req.body;
    if (!event_theme) return res.status(400).json({ error: 'event_theme required.' });
    const prompt = `Generate ${Math.min(count, 20)} engaging quiz questions about "${event_theme}" for a special event quiz. Difficulty: ${difficulty}. Language: ${language}.\nReturn ONLY valid JSON:\n[{"question_text":"?","options":["A","B","C","D"],"correct_answer":0,"explanation":"..."}]`;
    const c = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 2048 });
    const text = c.choices[0]?.message?.content || '';
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let raw; try { raw = JSON.parse(clean); } catch { const m = clean.match(/\[[\s\S]*\]/); if (!m) throw new Error('Parse fail'); raw = JSON.parse(m[0]); }
    const questions = (Array.isArray(raw) ? raw : []).map(q => ({ question_text: String(q.question_text || '').trim(), options: (q.options || []).map(o => String(o).trim()), correct_answer: parseInt(q.correct_answer) || 0, explanation: String(q.explanation || '').trim(), is_ai_generated: true })).filter(q => q.question_text && q.options.length === 4);
    res.json({ questions, event_theme, difficulty, count: questions.length, suggested_title: `${event_theme} Quiz`, generated: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ai/search-history', ra, async (req, res) => {
  try {
    const { data } = await supabase.from('ai_search_history').select('topic,difficulty,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(20);
    const seen = new Set(), u = [];
    for (const r of (data || [])) { if (!seen.has(r.topic)) { seen.add(r.topic); u.push(r); } }
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ai/popular-topics', async (_, res) => {
  try {
    const { data } = await supabase.from('ai_search_history').select('topic').limit(500);
    const f = {}; for (const r of (data || [])) f[r.topic] = (f[r.topic] || 0) + 1;
    res.json(Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([topic, count]) => ({ topic, count })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// SUPPORT
// ═══════════════════════════════════════════════════════════

app.post('/api/support/ticket', am, async (req, res) => {
  try {
    const { subject, message, email, priority = 'medium' } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message required.' });
    const { data, error } = await supabase.from('support_tickets').insert({ user_id: req.user?.id || null, username: req.user?.username || null, email: email || req.user?.email || 'unknown', subject, message, priority }).select('id').single();
    if (error) throw error;
    res.status(201).json({ ticket_id: data.id, message: 'Ticket submitted! Response within 24 hours.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/support/my-tickets', ra, async (req, res) => {
  try {
    const { data } = await supabase.from('support_tickets').select('id,subject,status,priority,admin_reply,created_at,resolved_at').eq('user_id', req.user.id).order('created_at', { ascending: false });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// CREATOR DASHBOARD
// ═══════════════════════════════════════════════════════════

app.get('/api/creator/dashboard', ra, async (req, res) => {
  try {
    const { data: quizzes, error } = await supabase.from('quizzes').select('id,title,category,plays,created_at,is_public').eq('creator_id', req.user.id);
    if (error) throw error;
    const quizIds = (quizzes || []).map(q => q.id);
    if (!quizIds.length) return res.json({ quizzes: [], total_plays: 0, total_quizzes: 0, avg_score: 0 });
    const { data: attempts } = await supabase.from('quiz_attempts').select('quiz_id,score,total_questions').in('quiz_id', quizIds);
    const sm = {};
    for (const a of (attempts || [])) {
      if (!sm[a.quiz_id]) sm[a.quiz_id] = { count: 0, ts: 0, tq: 0 };
      sm[a.quiz_id].count += 1; sm[a.quiz_id].ts += a.score; sm[a.quiz_id].tq += a.total_questions;
    }
    const enriched = (quizzes || []).map(q => ({
      ...q, attempt_count: sm[q.id]?.count || 0,
      avg_score: sm[q.id]?.tq ? Math.round((sm[q.id].ts / sm[q.id].tq) * 100) : null,
    }));
    res.json({
      quizzes: enriched,
      total_plays: enriched.reduce((s, q) => s + q.plays, 0),
      total_quizzes: quizIds.length,
      avg_score: Math.round(enriched.filter(q => q.avg_score !== null).reduce((s, q) => s + q.avg_score, 0) / Math.max(enriched.filter(q => q.avg_score !== null).length, 1)),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════

app.get('/api/admin/stats', rad, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [tU, tQ, tA, nW, nM, aT, oT, pS, eS, lS, pend] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('is_public', true),
      supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_login', `${today}T00:00:00`),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_plan', 'pro'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_plan', 'elite'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('subscription_plan', 'lifetime'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'manual_pending'),
    ]);
    const { data: topS } = await supabase.from('users').select('id,username,avatar_url,streak_count,streak_title,subscription_plan').gt('streak_count', 0).order('streak_count', { ascending: false }).limit(10);
    const { data: rev } = await supabase.from('revenue_log').select('amount').gte('created_at', monthAgo);
    const mrr = rev?.reduce((s, r) => s + Number(r.amount), 0) || 0;
    const { data: att } = await supabase.from('quiz_attempts').select('score,total_questions').limit(2000);
    const avg = att?.length ? Math.round(att.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / att.length) : 0;
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000), ds = d.toISOString().split('T')[0];
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', `${ds}T00:00:00`).lt('created_at', `${ds}T23:59:59`);
      daily.push({ date: ds, count: count || 0 });
    }
    res.json({ total_users: tU.count || 0, total_quizzes: tQ.count || 0, total_attempts: tA.count || 0, new_users_week: nW.count || 0, new_users_month: nM.count || 0, active_today: aT.count || 0, open_tickets: oT.count || 0, pro_subscribers: pS.count || 0, elite_subscribers: eS.count || 0, lifetime_subscribers: lS.count || 0, pending_payments: pend.count || 0, avg_score: avg, mrr, top_streak_users: topS || [], daily_new_users: daily, conv_rate: tU.count ? Math.round(((pS.count + eS.count + lS.count) / tU.count) * 100) : 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users', rad, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', sort = 'newest', plan = 'all' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let q = supabase.from('users').select('id,username,email,avatar_url,streak_count,streak_title,subscription_plan,is_banned,is_admin,role,coins,total_quizzes,referral_count,created_at,last_login', { count: 'exact' });
    if (search) q = q.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    if (plan !== 'all') q = q.eq('subscription_plan', plan);
    q = sort === 'streak' ? q.order('streak_count', { ascending: false }) : sort === 'coins' ? q.order('coins', { ascending: false }) : q.order('created_at', { ascending: false });
    q = q.range(offset, offset + parseInt(limit) - 1);
    const { data, count, error } = await q; if (error) throw error;
    res.json({ users: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users/:id', rad, async (req, res) => {
  try {
    const uid = req.params.id;
    const [{ data: user }, { data: attempts }, { data: badges }, { data: subs }, { data: activity }, { data: tickets }, { data: aiH }, { data: coins }, { data: streak }] = await Promise.all([
      supabase.from('users').select('*').eq('id', uid).single(),
      supabase.from('quiz_attempts').select('*,quizzes(title,category)').eq('user_id', uid).order('completed_at', { ascending: false }).limit(20),
      supabase.from('user_badges').select('*').eq('user_id', uid),
      supabase.from('subscriptions').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('user_activity').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('support_tickets').select('*').eq('user_id', uid),
      supabase.from('ai_search_history').select('*').eq('user_id', uid).limit(20),
      supabase.from('coin_transactions').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('streak_history').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(60),
    ]);
    res.json({ user, attempts: attempts || [], badges: badges || [], subscriptions: subs || [], activity: activity || [], tickets: tickets || [], ai_history: aiH || [], coin_history: coins || [], streak_history: streak || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/:id/ban', rad, async (req, res) => {
  const { reason = 'Policy violation', banned, ban_expires = null } = req.body;
  await supabase.from('users').update({ is_banned: banned !== false, ban_reason: banned !== false ? reason : null, ban_expires: ban_expires || null }).eq('id', req.params.id);
  if (banned !== false) await notif(parseInt(req.params.id, 10), 'ban', '🚫 Account Action', `Your account has been restricted: ${reason}`);
  res.json({ message: banned !== false ? 'Banned.' : 'Unbanned.' });
});

app.post('/api/admin/users/:id/make-admin', rad, async (req, res) => {
  await supabase.from('users').update({ is_admin: req.body.is_admin !== false, role: req.body.is_admin !== false ? 'admin' : 'user' }).eq('id', req.params.id);
  res.json({ message: 'Updated.' });
});

app.post('/api/admin/users/:id/give-subscription', rad, async (req, res) => {
  try {
    const { plan, days = 30, reason = 'Admin grant' } = req.body;
    const expires = days >= 36500 ? null : new Date(Date.now() + days * 86400000).toISOString();
    await supabase.from('users').update({ subscription_plan: plan, subscription_end: expires }).eq('id', req.params.id);
    await supabase.from('subscriptions').insert({ user_id: parseInt(req.params.id, 10), plan, status: 'active', amount: 0, currency: 'INR', started_at: new Date().toISOString(), expires_at: expires, admin_notes: reason, approved_by: req.user.id, approved_at: new Date().toISOString() });
    await notif(parseInt(req.params.id, 10), 'subscription', '🎁 Subscription Gift!', `Admin granted ${plan} plan for ${days} days!`);
    res.json({ message: 'Granted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/:id/give-coins', rad, async (req, res) => {
  const { amount, reason = 'Admin gift' } = req.body;
  await addCoins(parseInt(req.params.id, 10), amount, 'admin', reason);
  await notif(parseInt(req.params.id, 10), 'coins', '🪙 Coins Received!', `Admin gifted ${amount} coins: ${reason}`);
  res.json({ message: 'Coins given.' });
});

app.post('/api/admin/users/:id/reset-password', rad, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Min 6 chars.' });
  await supabase.from('users').update({ password: await bcrypt.hash(new_password, 12) }).eq('id', req.params.id);
  res.json({ message: 'Password reset.' });
});

app.get('/api/admin/payments/pending', rad, async (req, res) => {
  const { data } = await supabase.from('subscriptions').select('*,users(username,email,avatar_url)').eq('status', 'manual_pending').order('created_at', { ascending: false });
  res.json(data || []);
});

app.post('/api/admin/payments/:id/approve', rad, async (req, res) => {
  try {
    const { notes = '' } = req.body;
    const { data: sub } = await supabase.from('subscriptions').select('*').eq('id', req.params.id).single();
    if (!sub) return res.status(404).json({ error: 'Not found.' });
    const daysMap = { monthly: 30, yearly: 365, lifetime: 36500, quarterly: 90 };
    const expires = sub.billing_cycle === 'lifetime' ? null : new Date(Date.now() + (daysMap[sub.billing_cycle] || 30) * 86400000).toISOString();
    await supabase.from('subscriptions').update({ status: 'active', admin_notes: notes, approved_by: req.user.id, approved_at: new Date().toISOString(), started_at: new Date().toISOString(), expires_at: expires }).eq('id', req.params.id);
    await supabase.from('users').update({ subscription_plan: sub.plan, subscription_end: expires }).eq('id', sub.user_id);
    await supabase.from('revenue_log').insert({ user_id: sub.user_id, plan: sub.plan, amount: sub.amount, status: 'success' });
    await notif(sub.user_id, 'subscription', '✅ Payment Approved!', `Your ${sub.plan} plan is now active!`);
    const { data: u } = await supabase.from('users').select('email,username').eq('id', sub.user_id).single();
    if (u) sendEmail(u.email, `✅ ${sub.plan} Plan Activated!`, baseEmail(`<h2 style="color:#22c55e">Payment Approved! 🎉</h2><p>Hi <strong>${u.username}</strong>, your ${sub.plan} subscription is now active!${notes ? `<br>Note: ${notes}` : ''}</p><a href="${process.env.FRONTEND_URL}" style="background:#8b5cf6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">Start Exploring →</a>`)).catch(() => {});
    res.json({ message: 'Approved!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/payments/:id/reject', rad, async (req, res) => {
  try {
    const { reason = 'Invalid payment details' } = req.body;
    const { data: sub } = await supabase.from('subscriptions').select('*').eq('id', req.params.id).single();
    if (!sub) return res.status(404).json({ error: 'Not found.' });
    await supabase.from('subscriptions').update({ status: 'failed', admin_notes: reason }).eq('id', req.params.id);
    await notif(sub.user_id, 'payment_failed', '❌ Payment Rejected', `Reason: ${reason}. Please try again.`);
    const { data: u } = await supabase.from('users').select('email,username').eq('id', sub.user_id).single();
    if (u) sendEmail(u.email, '❌ Payment Issue', baseEmail(`<h2 style="color:#ef4444">Payment Issue</h2><p>Hi <strong>${u.username}</strong>, your ${sub.plan} payment was rejected.</p><p><strong>Reason:</strong> ${reason}</p>`)).catch(() => {});
    res.json({ message: 'Rejected.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/promo-codes', rad, async (_, res) => {
  const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});
app.post('/api/admin/promo-codes', rad, async (req, res) => {
  const { code, discount_type, discount_value, free_plan, free_days, max_uses, expires_at } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required.' });
  const { data, error } = await supabase.from('promo_codes').insert({ code: code.toUpperCase().trim(), discount_type: discount_type || 'percent', discount_value: discount_value || 0, free_plan: free_plan || null, free_days: free_days || 0, max_uses: max_uses || 100, expires_at: expires_at || null, created_by: req.user.id }).select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ id: data.id, message: 'Created.' });
});
app.delete('/api/admin/promo-codes/:id', rad, async (req, res) => {
  await supabase.from('promo_codes').delete().eq('id', req.params.id);
  res.json({ message: 'Deleted.' });
});

app.get('/api/admin/plan-settings', rad, async (_, res) => {
  const { data } = await supabase.from('plan_settings').select('*');
  res.json(data || []);
});
app.put('/api/admin/plan-settings/:id', rad, async (req, res) => {
  const { price_monthly, price_yearly, price_quarterly, price_lifetime, is_active, features, limits, name, color, icon } = req.body;
  await supabase.from('plan_settings').update({ price_monthly, price_yearly, price_quarterly, price_lifetime, is_active, features: typeof features === 'string' ? features : JSON.stringify(features), limits: typeof limits === 'string' ? limits : JSON.stringify(limits), name, color, icon, updated_at: new Date().toISOString() }).eq('plan_id', req.params.id);
  res.json({ message: 'Updated.' });
});

app.get('/api/admin/settings', rad, async (_, res) => {
  const { data } = await supabase.from('app_settings').select('*');
  const s = {}; for (const r of (data || [])) s[r.key] = r.value;
  res.json(s);
});
app.put('/api/admin/settings', rad, async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    await supabase.from('app_settings').upsert({ key, value: typeof value === 'string' ? value : JSON.stringify(value), updated_at: new Date().toISOString() });
  }
  res.json({ message: 'Settings updated.' });
});

app.post('/api/admin/notify-all', rad, async (req, res) => {
  const { title, message, type = 'admin', plan = 'all' } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title + message required.' });
  let q = supabase.from('users').select('id').eq('is_banned', false);
  if (plan !== 'all') q = q.eq('subscription_plan', plan);
  const { data: users } = await q;
  for (const u of (users || [])) await supabase.from('notifications').insert({ user_id: u.id, type, title, message });
  res.json({ message: `Sent to ${(users || []).length} users.`, count: (users || []).length });
});

app.post('/api/admin/bulk-email', rad, async (req, res) => {
  const { subject, html, plan = 'all' } = req.body;
  if (!subject || !html) return res.status(400).json({ error: 'subject + html required.' });
  let q = supabase.from('users').select('email,username').eq('is_banned', false);
  if (plan !== 'all') q = q.eq('subscription_plan', plan);
  const { data: users } = await q;
  let sent = 0;
  for (const u of (users || [])) { sendEmail(u.email, subject, html.replace('{{username}}', u.username)).catch(() => {}); sent++; }
  res.json({ message: `Queued for ${sent} users.`, count: sent });
});

app.get('/api/admin/tickets', rad, async (req, res) => {
  const { status = 'open', limit = 50 } = req.query;
  let q = supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(parseInt(limit));
  if (status !== 'all') q = q.eq('status', status);
  const { data } = await q;
  res.json(data || []);
});
app.put('/api/admin/tickets/:id', rad, async (req, res) => {
  const { status, admin_reply } = req.body;
  const upd = { status };
  if (admin_reply) upd.admin_reply = admin_reply;
  if (status === 'resolved') upd.resolved_at = new Date().toISOString();
  await supabase.from('support_tickets').update(upd).eq('id', req.params.id);
  res.json({ message: 'Updated.' });
});

app.get('/api/admin/categories', rad, async (_, res) => {
  const { data } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  res.json(data || []);
});
app.post('/api/admin/categories', rad, async (req, res) => {
  const { name, slug, icon, color, description, sort_order } = req.body;
  const { data, error } = await supabase.from('categories').insert({ name, slug, icon: icon || '📚', color: color || '#6366f1', description: description || '', sort_order: sort_order || 0 }).select('id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ id: data.id });
});
app.put('/api/admin/categories/:id', rad, async (req, res) => {
  await supabase.from('categories').update(req.body).eq('id', req.params.id);
  res.json({ message: 'Updated.' });
});
app.delete('/api/admin/categories/:id', rad, async (req, res) => {
  await supabase.from('categories').delete().eq('id', req.params.id);
  res.json({ message: 'Deleted.' });
});

app.get('/api/admin/comments/reported', rad, async (_, res) => {
  const { data } = await supabase.from('comments').select('*').eq('is_reported', true).eq('is_removed', false).order('created_at', { ascending: false }).limit(50);
  res.json(data || []);
});
app.post('/api/admin/comments/:id/pin', rad, async (req, res) => {
  await supabase.from('comments').update({ is_pinned: req.body.pinned !== false }).eq('id', req.params.id);
  res.json({ message: 'Done.' });
});
app.delete('/api/admin/comments/:id', rad, async (req, res) => {
  await supabase.from('comments').update({ is_removed: true, body: '[Removed by admin]' }).eq('id', req.params.id);
  res.json({ message: 'Removed.' });
});

app.get('/api/admin/quiz-analytics', rad, async (_, res) => {
  try {
    const { data: att } = await supabase.from('quiz_attempts').select('score,total_questions,time_taken,completed_at').limit(5000);
    const { data: aiTopics } = await supabase.from('ai_search_history').select('topic').limit(1000);
    const freq = {}; for (const r of (aiTopics || [])) freq[r.topic] = (freq[r.topic] || 0) + 1;
    const topTopics = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([topic, count]) => ({ topic, count }));
    const totalA = att?.length || 0;
    const avgScore = totalA ? Math.round(att.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / totalA) : 0;
    const avgTime  = totalA ? Math.round(att.reduce((s, a) => s + (a.time_taken || 0), 0) / totalA) : 0;
    res.json({ total_attempts: totalA, avg_score: avgScore, avg_time: avgTime, top_ai_topics: topTopics });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/revenue', rad, async (_, res) => {
  try {
    const m = new Date(Date.now() - 30 * 86400000).toISOString();
    const y = new Date(Date.now() - 365 * 86400000).toISOString();
    const [{ data: mrr }, { data: arr }, { data: rec }] = await Promise.all([
      supabase.from('revenue_log').select('amount').gte('created_at', m).eq('status', 'success'),
      supabase.from('revenue_log').select('amount').gte('created_at', y).eq('status', 'success'),
      supabase.from('revenue_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    res.json({ mrr: mrr?.reduce((s, r) => s + Number(r.amount), 0) || 0, arr: arr?.reduce((s, r) => s + Number(r.amount), 0) || 0, recent_transactions: rec || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// MISC / GENERAL
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATION ROUTE — add this to server.js in the MISC / GENERAL section
// (around line where you have app.get('/api/categories') and app.get('/api/stats'))
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/translate
// Called by frontend useTranslatedQuestions hook.
// Translates an array of strings via Groq (uses server's GROQ_API_KEY — never exposed to browser).
// Public route (no auth) — rate limited by existing IP rate limiter.
app.post('/api/translate', async (req, res) => {
  try {
    const { texts, targetLang } = req.body;

    // Validate
    if (!Array.isArray(texts) || !texts.length) {
      return res.status(400).json({ error: 'texts array required.' });
    }
    if (!targetLang || typeof targetLang !== 'string') {
      return res.status(400).json({ error: 'targetLang required.' });
    }
    // Accept both code ('en') and full name ('English') — frontend sends full name
    if (targetLang === 'en' || targetLang === 'English') {
      return res.json({ translated: texts }); // nothing to do
    }
    if (texts.length > 100) {
      return res.status(400).json({ error: 'Max 100 strings per request.' });
    }

    // Groq not configured — return originals gracefully
    if (!groq) {
      return res.json({ translated: texts });
    }

    // Build numbered list for Groq
    const numbered = texts
      .map((t, i) => `${i + 1}. ${t || ''}`)
      .join('\n');

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content:
          `Translate the following numbered strings to ${targetLang}.\n` +
          `Rules:\n` +
          `- Return ONLY the numbered list, same format "1. translated text"\n` +
          `- Keep numbering exactly as-is\n` +
          `- Keep percentages, numbers, and symbols unchanged (e.g. 10-20%, 30-40%)\n` +
          `- Keep placeholders like {{amount}} {{n}} unchanged\n` +
          `- Keep emojis unchanged\n` +
          `- No extra notes or explanation\n\n` +
          `${numbered}`,
      }],
    });

    const raw = completion.choices[0]?.message?.content || '';

    // Parse "1. text" lines back into array
    const out = texts.map(t => t); // pre-fill with originals as fallback
    raw.split('\n').forEach(line => {
      const m = line.trim().match(/^(\d+)\.\s+([\s\S]*)/);
      if (!m) return;
      const idx = parseInt(m[1], 10) - 1;
      if (idx >= 0 && idx < texts.length) {
        out[idx] = m[2].trim();
      }
    });

    res.json({ translated: out });

  } catch (e) {
    console.error('[/api/translate] error:', e.message);
    // Always return originals on error — never crash the quiz
    res.json({ translated: req.body.texts || [] });
  }
});
app.get('/api/categories', async (_, res) => {
  try {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stats', async (_, res) => {
  try {
    const [q, a, u] = await Promise.all([
      supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('is_public', true),
      supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
    ]);
    res.json({ totalQuizzes: q.count || 0, totalAttempts: a.count || 0, totalUsers: u.count || 0 });
  } catch { res.json({ totalQuizzes: 0, totalAttempts: 0, totalUsers: 0 }); }
});

// ═══════════════════════════════════════════════════════════
// AI PROCTORING ROUTES
// Add these routes to server.js after the ATTEMPTS section
// and before the STREAK section.
// ═══════════════════════════════════════════════════════════

// ── Supabase table required ─────────────────────────────────
// CREATE TABLE proctoring_sessions (
//   id              bigserial PRIMARY KEY,
//   quiz_id         int          NOT NULL,
//   user_id         int,
//   user_name       text,
//   attempt_id      int,
//   warning_count   int          DEFAULT 0,
//   violations      jsonb        DEFAULT '[]',
//   recording_url   text,
//   auto_submitted  boolean      DEFAULT false,
//   started_at      timestamptz  DEFAULT now(),
//   ended_at        timestamptz,
//   created_at      timestamptz  DEFAULT now()
// );

// POST /api/proctoring/start
// Called when a quiz begins — creates a proctoring session record.
app.post('/api/proctoring/start', am, async (req, res) => {
  try {
    const { quiz_id, attempt_id } = req.body;
    const qid = parseInt(quiz_id, 10);
    if (isNaN(qid)) return res.status(400).json({ error: 'quiz_id required.' });

    const { data, error } = await supabase
      .from('proctoring_sessions')
      .insert({
        quiz_id:       qid,
        user_id:       req.user?.id   || null,
        user_name:     req.user?.username || 'Guest',
        attempt_id:    attempt_id     || null,
        warning_count: 0,
        violations:    [],
        auto_submitted: false,
      })
      .select('id')
      .single();

    if (error) throw error;
    res.status(201).json({ session_id: data.id });
  } catch (e) {
    console.error('proctoring/start:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/proctoring/violation
// Called on each detected violation. Increments warning count.
// On the 3rd violation it sets auto_submitted = true and returns { auto_submit: true }.
app.post('/api/proctoring/violation', am, async (req, res) => {
  try {
    const { session_id, type, evidence_url, snapshot_data } = req.body;
    const sid = parseInt(session_id, 10);
    if (isNaN(sid)) return res.status(400).json({ error: 'session_id required.' });

    // Fetch current session
    const { data: session, error: fetchErr } = await supabase
      .from('proctoring_sessions')
      .select('id, warning_count, violations, user_id, quiz_id, auto_submitted')
      .eq('id', sid)
      .single();

    if (fetchErr || !session) return res.status(404).json({ error: 'Session not found.' });
    if (session.auto_submitted) return res.json({ auto_submit: true, warning_count: session.warning_count });

    const newWarningCount = (session.warning_count || 0) + 1;
    const autoSubmit      = newWarningCount >= 3;

    const violation = {
      type:          type        || 'unknown',
      timestamp:     new Date().toISOString(),
      evidence_url:  evidence_url || null,
      snapshot_data: newWarningCount >= 2 ? (snapshot_data || null) : null, // store evidence from warning 2+
      warning_number: newWarningCount,
    };

    const updatedViolations = [...(session.violations || []), violation];

    const { error: updateErr } = await supabase
      .from('proctoring_sessions')
      .update({
        warning_count:  newWarningCount,
        violations:     updatedViolations,
        auto_submitted: autoSubmit,
        ended_at:       autoSubmit ? new Date().toISOString() : null,
      })
      .eq('id', sid);

    if (updateErr) throw updateErr;

    // Notify admin via notifications table when auto-submitted
    if (autoSubmit && session.user_id) {
      await notif(
        session.user_id,
        'proctoring',
        '⚠️ Quiz Auto-Submitted',
        `Your quiz (ID: ${session.quiz_id}) was auto-submitted due to repeated violations.`
      );
    }

    await logAct(
      session.user_id,
      'proctoring_violation',
      { session_id: sid, type, warning_count: newWarningCount, auto_submit: autoSubmit },
      req
    );

    res.json({
      warning_count: newWarningCount,
      auto_submit:   autoSubmit,
      message:       autoSubmit
        ? 'Quiz auto-submitted due to repeated violations.'
        : `Warning ${newWarningCount} recorded.`,
    });
  } catch (e) {
    console.error('proctoring/violation:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/proctoring/end
// Called when quiz ends (normal or auto-submit). Saves recording URL and closes session.
app.post('/api/proctoring/end', am, async (req, res) => {
  try {
    const { session_id, recording_url, auto_submitted } = req.body;
    const sid = parseInt(session_id, 10);
    if (isNaN(sid)) return res.status(400).json({ error: 'session_id required.' });

    await supabase
      .from('proctoring_sessions')
      .update({
        recording_url:  recording_url  || null,
        auto_submitted: auto_submitted || false,
        ended_at:       new Date().toISOString(),
      })
      .eq('id', sid);

    res.json({ message: 'Session ended.' });
  } catch (e) {
    console.error('proctoring/end:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/proctoring
// Admin view of all proctoring sessions with violations.
app.get('/api/admin/proctoring', rad, async (req, res) => {
  try {
    const { quiz_id, limit = 50, offset = 0 } = req.query;
    let q = supabase
      .from('proctoring_sessions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (quiz_id) q = q.eq('quiz_id', parseInt(quiz_id, 10));

    const { data, count, error } = await q;
    if (error) throw error;
    res.json({ sessions: data || [], total: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/proctoring/:id
// Admin: full detail of one proctoring session.
app.get('/api/admin/proctoring/:id', rad, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proctoring_sessions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Not found.' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// ═══════════════════════════════════════════════════════════
// CPX RESEARCH REWARD WALL
// ═══════════════════════════════════════════════════════════

const CPX_APP_ID     = process.env.CPX_APP_ID          || '';
const CPX_HASH_KEY   = process.env.CPX_SECURE_HASH_KEY || '';
const COINS_PER_CENT = parseFloat(process.env.CPX_COINS_PER_CENT || '5');
const XP_PER_CENT    = parseFloat(process.env.CPX_XP_PER_CENT    || '10');
const CPX_MIN_COINS  = 10;
const CPX_MIN_XP     = 20;

function verifyCPXHash(userId, receivedHash) {
  if (!CPX_HASH_KEY) { console.warn('[CPX] No CPX_SECURE_HASH_KEY set — skipping hash check (unsafe!)'); return true; }
  const expected = crypto.createHash('md5').update(`${userId}-${CPX_HASH_KEY}`).digest('hex');
  return expected === receivedHash;
}

// GET /api/rewards/cpx/postback — called by CPX server on survey completion
app.get('/api/rewards/cpx/postback', async (req, res) => {
  const { status, trans_id, user_id, amount_local, ip_click, hash } = req.query;
  console.log(`[CPX Postback] status=${status} trans_id=${trans_id} user_id=${user_id} amount=${amount_local}`);
  if (!hash || !verifyCPXHash(user_id, hash)) { console.warn('[CPX] ❌ Hash mismatch. user_id:', user_id); return res.status(200).send('0'); }
  if (status !== '1') {
    if (status === '2') {
      try {
        const { data: txn } = await supabase.from('cpx_transactions').select('user_id,coins_awarded,xp_awarded').eq('trans_id', trans_id).maybeSingle();
        if (txn) {
          await addCoins(txn.user_id, -txn.coins_awarded, 'reward', `CPX Survey reversed (${trans_id})`, `cpx_rev_${trans_id}`);
          await addXP(txn.user_id, -txn.xp_awarded);
          await supabase.from('cpx_transactions').update({ status: 'reversed' }).eq('trans_id', trans_id);
          await supabase.from('notifications').insert({ user_id: txn.user_id, type: 'warning', title: '⚠️ Survey Reversed', message: `A survey reward was reversed. ${txn.coins_awarded} coins and ${txn.xp_awarded} XP were deducted.` });
          console.log(`[CPX] Survey reversed for user ${txn.user_id}`);
        }
      } catch (e) { console.error('[CPX] reversal error:', e.message); }
    }
    return res.status(200).send('1');
  }
  const userId = parseInt(user_id, 10);
  if (!userId || isNaN(userId)) { console.warn('[CPX] Invalid user_id:', user_id); return res.status(200).send('0'); }
  try {
    const { data: existing } = await supabase.from('cpx_transactions').select('id').eq('trans_id', trans_id).maybeSingle();
    if (existing) { console.log(`[CPX] Duplicate trans_id=${trans_id} — ignoring`); return res.status(200).send('1'); }
  } catch (e) { console.error('[CPX] idempotency check error:', e.message); }
  const { data: user } = await supabase.from('users').select('id,username,is_banned').eq('id', userId).maybeSingle();
  if (!user) { console.warn('[CPX] User not found:', userId); return res.status(200).send('0'); }
  if (user.is_banned) { console.warn('[CPX] Banned user attempted reward:', userId); return res.status(200).send('0'); }
  const cents       = parseFloat(amount_local || '0');
  const coinsEarned = Math.max(CPX_MIN_COINS, Math.round(cents * COINS_PER_CENT));
  const xpEarned    = Math.max(CPX_MIN_XP,    Math.round(cents * XP_PER_CENT));
  try {
    await supabase.from('cpx_transactions').insert({ user_id: userId, trans_id, amount_local: cents, coins_awarded: coinsEarned, xp_awarded: xpEarned, ip_address: ip_click || null, status: 'completed' });
  } catch (e) {
    if (e.code === '23505' || e.message?.includes('duplicate')) { console.log('[CPX] Duplicate caught at insert:', trans_id); return res.status(200).send('1'); }
    console.error('[CPX] Failed to record transaction:', e.message); return res.status(200).send('0');
  }
  const newCoinBal = await addCoins(userId, coinsEarned, 'reward', `CPX Survey completed (+${coinsEarned} coins)`, `cpx_${trans_id}`);
  await addXP(userId, xpEarned);
  try { await supabase.from('notifications').insert({ user_id: userId, type: 'reward', title: '🎉 Survey Completed!', message: `You earned +${coinsEarned} 🪙 coins and +${xpEarned} ⚡ XP! New balance: ${newCoinBal} coins.` }); } catch {}
  console.log(`[CPX] ✅ Credited ${coinsEarned} coins + ${xpEarned} XP to user ${userId} (${user.username}). Balance: ${newCoinBal}`);
  return res.status(200).send('1');
});

// GET /api/rewards/cpx/config — returns iframe URL for frontend
app.get('/api/rewards/cpx/config', ra, async (req, res) => {
  if (!CPX_APP_ID) return res.status(503).json({ error: 'CPX not configured. Add CPX_APP_ID to .env' });
  const userId     = req.user.id;
  const secureHash = CPX_HASH_KEY ? crypto.createHash('md5').update(`${userId}-${CPX_HASH_KEY}`).digest('hex') : '';
  res.json({ app_id: CPX_APP_ID, user_id: userId, secure_hash: secureHash, iframe_url: `https://offers.cpx-research.com/index.php?app_id=${CPX_APP_ID}&user_id=${userId}&secure_hash=${secureHash}&output_method=iframe` });
});

// GET /api/rewards/cpx/history
app.get('/api/rewards/cpx/history', ra, async (req, res) => {
  const { data } = await supabase.from('cpx_transactions').select('trans_id,coins_awarded,xp_awarded,amount_local,status,created_at').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(25);
  res.json(data || []);
});

// GET /api/rewards/cpx/stats (admin only)
app.get('/api/rewards/cpx/stats', rad, async (req, res) => {
  const [total, week, rev] = await Promise.all([
    supabase.from('cpx_transactions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('cpx_transactions').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from('cpx_transactions').select('coins_awarded,xp_awarded').eq('status', 'completed'),
  ]);
  const totalCoins = (rev.data || []).reduce((s, r) => s + (r.coins_awarded || 0), 0);
  const totalXP    = (rev.data || []).reduce((s, r) => s + (r.xp_awarded    || 0), 0);
  res.json({ total_completions: total.count || 0, completions_this_week: week.count || 0, total_coins_awarded: totalCoins, total_xp_awarded: totalXP });
});

app.get('/api/health', (_, res) => res.json({
  status: 'ok', db: 'supabase', ai: groq ? 'groq' : 'disabled',
  email: transporter ? 'gmail' : 'dev', ts: new Date().toISOString(),
}));

app.use((_, res) => res.status(404).json({ error: 'Route not found.' }));

app.listen(PORT, () => {
  console.log(`\n🚀 QuizMaster Pro v7.2 → http://localhost:${PORT}`);
  console.log(`🤖 Groq AI  → ${groq ? '✅ Ready' : '❌ Add GROQ_API_KEY'}`);
  console.log(`📧 Email    → ${transporter ? '✅ Gmail' : '⚠️  Dev mode'}`);
  console.log(`✅ All systems ready!\n`);
});
