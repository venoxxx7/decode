import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'decode.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    csrf TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    starting_balance REAL NOT NULL DEFAULT 10000,
    risk_per_trade REAL NOT NULL DEFAULT 1,
    daily_loss_limit REAL NOT NULL DEFAULT 3,
    max_drawdown REAL NOT NULL DEFAULT 10,
    ai_model TEXT NOT NULL DEFAULT 'qwen3-vl:4b-instruct',
    ollama_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:11434',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pair TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    direction TEXT NOT NULL,
    trend TEXT NOT NULL,
    strategy_version TEXT NOT NULL,
    entry REAL NOT NULL,
    sl REAL NOT NULL,
    tp REAL NOT NULL,
    lot_size REAL NOT NULL DEFAULT 0,
    risk_percent REAL NOT NULL DEFAULT 1,
    risk_amount REAL NOT NULL DEFAULT 0,
    planned_rr REAL NOT NULL DEFAULT 0,
    actual_rr REAL NOT NULL DEFAULT 0,
    result TEXT NOT NULL,
    news INTEGER NOT NULL DEFAULT 0,
    news_event TEXT,
    notes TEXT,
    setup_grade TEXT,
    grade_confidence REAL,
    ob_detected INTEGER NOT NULL DEFAULT 0,
    shortened_zone INTEGER NOT NULL DEFAULT 0,
    first_tap INTEGER NOT NULL DEFAULT 0,
    fvg INTEGER NOT NULL DEFAULT 0,
    wick_fvg INTEGER NOT NULL DEFAULT 0,
    imbalance INTEGER NOT NULL DEFAULT 0,
    second_tap INTEGER NOT NULL DEFAULT 0,
    choch_used INTEGER NOT NULL DEFAULT 0,
    choch_present INTEGER NOT NULL DEFAULT 0,
    ai_status TEXT NOT NULL DEFAULT 'pending',
    ai_analysis TEXT,
    ai_model TEXT,
    ai_analyzed_at TEXT,
    manual_corrections TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS charts (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, trade_date);
  CREATE INDEX IF NOT EXISTS idx_charts_trade ON charts(trade_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
`);

const get = (sql, ...args) => db.prepare(sql).get(...args);
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const round = (n, d = 2) => Number(Number(n || 0).toFixed(d));

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expected) {
  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const wanted = Buffer.from(expected, 'hex');
    return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
  } catch { return false; }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  run(
    'INSERT INTO sessions (id, user_id, token_hash, csrf, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    uid(), userId, sha256(token), csrf, Date.now() + 1000 * 60 * 60 * 24 * 30, now()
  );
  return { token, csrf };
}

function sessionCookie(token, secure = false) {
  return `decode_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure ? '; Secure' : ''}`;
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, created_at: row.created_at };
}

function defaultSettings(userId) {
  const ts = now();
  run(
    `INSERT OR IGNORE INTO settings
      (user_id, starting_balance, risk_per_trade, daily_loss_limit, max_drawdown, ai_model, ollama_url, created_at, updated_at)
     VALUES (?, 10000, 1, 3, 10, 'qwen3-vl:4b-instruct', 'http://127.0.0.1:11434', ?, ?)`,
    userId, ts, ts
  );
}

function getSettings(userId) {
  defaultSettings(userId);
  return get('SELECT * FROM settings WHERE user_id = ?', userId);
}

function tradeRowToObject(row, charts = []) {
  if (!row) return null;
  return {
    ...row,
    news: !!row.news,
    ob_detected: !!row.ob_detected,
    shortened_zone: !!row.shortened_zone,
    first_tap: !!row.first_tap,
    fvg: !!row.fvg,
    wick_fvg: !!row.wick_fvg,
    imbalance: !!row.imbalance,
    second_tap: !!row.second_tap,
    choch_used: !!row.choch_used,
    choch_present: !!row.choch_present,
    opposite_trend: (row.direction === 'BUY' && row.trend === 'DOWNTREND') || (row.direction === 'SELL' && row.trend === 'UPTREND'),
    ai_analysis: parseJson(row.ai_analysis),
    manual_corrections: parseJson(row.manual_corrections),
    charts
  };
}

function chartsForTrade(tradeId) {
  return all('SELECT id, trade_id, original_name, mime, size, created_at FROM charts WHERE trade_id = ? ORDER BY created_at', tradeId);
}

function getTrades(userId) {
  const rows = all('SELECT * FROM trades WHERE user_id = ? ORDER BY trade_date DESC, created_at DESC', userId);
  return rows.map((row) => tradeRowToObject(row, chartsForTrade(row.id)));
}

function getTrade(userId, id) {
  const row = get('SELECT * FROM trades WHERE id = ? AND user_id = ?', id, userId);
  return tradeRowToObject(row, row ? chartsForTrade(row.id) : []);
}

function pnlFor(trade) {
  return round(Number(trade.risk_amount || 0) * Number(trade.actual_rr || 0));
}

function signedR(trade) {
  if (trade.result === 'BREAKEVEN') return 0;
  const value = Math.abs(Number(trade.actual_rr || 0));
  return trade.result === 'LOSS' ? -value : value;
}

function normalizeTrade(body, existing = {}) {
  const result = String(body.result || existing.result || 'WIN').toUpperCase();
  const direction = String(body.direction || existing.direction || 'BUY').toUpperCase();
  const trend = String(body.trend || existing.trend || 'UPTREND').toUpperCase();
  const strategy = String(body.strategy_version || existing.strategy_version || 'V1').toUpperCase();
  const entry = Number(body.entry ?? existing.entry ?? 0);
  const sl = Number(body.sl ?? existing.sl ?? 0);
  const tp = Number(body.tp ?? existing.tp ?? 0);
  const riskDistance = Math.abs(entry - sl);
  const rewardDistance = Math.abs(tp - entry);
  const plannedRr = riskDistance > 0 ? rewardDistance / riskDistance : Number(body.planned_rr || 0);
  let actualRr = Math.abs(Number(body.actual_rr ?? existing.actual_rr ?? 0));
  if (result === 'LOSS') actualRr = -actualRr;
  if (result === 'BREAKEVEN') actualRr = 0;

  return {
    pair: String(body.pair || existing.pair || '').toUpperCase().trim(),
    trade_date: String(body.trade_date || existing.trade_date || now()),
    direction,
    trend,
    strategy_version: ['V1', 'V2'].includes(strategy) ? strategy : 'V1',
    entry, sl, tp,
    lot_size: Number(body.lot_size ?? existing.lot_size ?? 0),
    risk_percent: Number(body.risk_percent ?? existing.risk_percent ?? 1),
    risk_amount: Number(body.risk_amount ?? existing.risk_amount ?? 0),
    planned_rr: round(plannedRr),
    actual_rr: round(actualRr),
    result,
    news: body.news !== undefined ? (body.news ? 1 : 0) : Number(existing.news || 0),
    news_event: String(body.news_event ?? existing.news_event ?? ''),
    notes: String(body.notes ?? existing.notes ?? ''),
    setup_grade: body.setup_grade !== undefined ? String(body.setup_grade || '') : (existing.setup_grade || ''),
    grade_confidence: body.grade_confidence !== undefined ? Number(body.grade_confidence) : Number(existing.grade_confidence || 0),
    ob_detected: body.ob_detected !== undefined ? (body.ob_detected ? 1 : 0) : Number(existing.ob_detected || 0),
    shortened_zone: body.shortened_zone !== undefined ? (body.shortened_zone ? 1 : 0) : Number(existing.shortened_zone || 0),
    first_tap: body.first_tap !== undefined ? (body.first_tap ? 1 : 0) : Number(existing.first_tap || 0),
    fvg: body.fvg !== undefined ? (body.fvg ? 1 : 0) : Number(existing.fvg || 0),
    wick_fvg: body.wick_fvg !== undefined ? (body.wick_fvg ? 1 : 0) : Number(existing.wick_fvg || 0),
    imbalance: body.imbalance !== undefined ? (body.imbalance ? 1 : 0) : Number(existing.imbalance || 0),
    second_tap: body.second_tap !== undefined ? (body.second_tap ? 1 : 0) : Number(existing.second_tap || 0),
    choch_used: body.choch_used !== undefined ? (body.choch_used ? 1 : 0) : Number(existing.choch_used || 0),
    choch_present: body.choch_present !== undefined ? (body.choch_present ? 1 : 0) : Number(existing.choch_present || 0),
    manual_corrections: body.manual_corrections !== undefined
      ? (typeof body.manual_corrections === 'string' ? body.manual_corrections : JSON.stringify(body.manual_corrections))
      : existing.manual_corrections
  };
}

function groupStats(trades) {
  const list = trades.filter(Boolean);
  const wins = list.filter((t) => t.result === 'WIN').length;
  const losses = list.filter((t) => t.result === 'LOSS').length;
  const breakeven = list.filter((t) => t.result === 'BREAKEVEN').length;
  const totalR = list.reduce((sum, t) => sum + signedR(t), 0);
  const pnl = list.reduce((sum, t) => sum + pnlFor(t), 0);
  const grossWin = list.filter((t) => signedR(t) > 0).reduce((sum, t) => sum + pnlFor(t), 0);
  const grossLoss = Math.abs(list.filter((t) => signedR(t) < 0).reduce((sum, t) => sum + pnlFor(t), 0));
  return {
    trades: list.length,
    wins,
    losses,
    breakeven,
    winRate: list.length ? round((wins / list.length) * 100, 1) : 0,
    totalR: round(totalR, 2),
    avgR: list.length ? round(totalR / list.length, 2) : 0,
    pnl: round(pnl, 2),
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss, 2) : (grossWin > 0 ? null : 0),
    expectancy: list.length ? round(totalR / list.length, 2) : 0
  };
}

function computeDashboard(userId, settings, trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
  const overall = groupStats(sorted);
  const starting = Number(settings.starting_balance || 0);
  let equity = starting;
  let peak = starting;
  let maxDrawdown = 0;
  const curve = [{ date: sorted[0]?.trade_date || now(), equity: starting, pnl: 0, index: 0 }];
  sorted.forEach((trade, index) => {
    equity += pnlFor(trade);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? ((peak - equity) / peak) * 100 : 0);
    curve.push({ date: trade.trade_date, equity: round(equity), pnl: round(pnlFor(trade)), index: index + 1, pair: trade.pair });
  });
  const currentDrawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayTrades = sorted.filter((t) => String(t.trade_date).slice(0, 10) === today);
  const dailyLoss = Math.abs(todayTrades.reduce((sum, t) => sum + Math.min(0, pnlFor(t)), 0));
  const dailyPnl = todayTrades.reduce((sum, t) => sum + pnlFor(t), 0);

  const pairs = {};
  sorted.forEach((trade) => {
    if (!pairs[trade.pair]) pairs[trade.pair] = [];
    pairs[trade.pair].push(trade);
  });
  const pairStats = Object.entries(pairs).map(([pair, list]) => ({ pair, ...groupStats(list) }))
    .sort((a, b) => b.totalR - a.totalR);
  const strategies = ['V1', 'V2'].map((version) => {
    const list = sorted.filter((t) => t.strategy_version === version);
    return {
      version,
      ...groupStats(list),
      chochUsed: list.filter((t) => t.choch_used).length,
      chochPresent: list.filter((t) => t.choch_used && t.choch_present).length
    };
  });

  return {
    totalTrades: overall.trades,
    wins: overall.wins,
    losses: overall.losses,
    breakeven: overall.breakeven,
    winRate: overall.winRate,
    netPnl: overall.pnl,
    avgR: overall.avgR,
    totalR: overall.totalR,
    profitFactor: overall.profitFactor,
    expectancy: overall.expectancy,
    balance: round(equity),
    startingBalance: starting,
    returnPct: starting > 0 ? round((equity - starting) / starting * 100, 2) : 0,
    maxDrawdown: round(maxDrawdown, 2),
    currentDrawdown: round(currentDrawdown, 2),
    dailyPnl: round(dailyPnl, 2),
    dailyLoss: round(dailyLoss, 2),
    dailyLossLimit: round(Number(settings.starting_balance || 0) * Number(settings.daily_loss_limit || 0) / 100, 2),
    dailyLossLimitPct: Number(settings.daily_loss_limit || 0),
    dailyLossPct: settings.starting_balance ? round(dailyLoss / settings.starting_balance * 100, 2) : 0,
    curve,
    pairs: pairStats,
    bestPair: pairStats.filter((p) => p.trades >= 2).sort((a, b) => b.totalR - a.totalR)[0] || pairStats[0] || null,
    worstPair: pairStats.filter((p) => p.trades >= 2).sort((a, b) => a.totalR - b.totalR)[0] || null,
    strategies,
    recent: sorted.slice(-6).reverse(),
    openRisk: 0
  };
}

function comboLabel(trade) {
  const confirmations = [
    trade.fvg ? 'FVG' : null,
    trade.wick_fvg ? 'Wick FVG' : null,
    trade.imbalance ? 'Imbalance' : null
  ].filter(Boolean);
  return `${trade.strategy_version} · ${trade.trend === 'UPTREND' ? 'Up' : 'Down'} · ${confirmations[0] || 'No confirmation'}`;
}

function computeAnalytics(trades, settings) {
  const strategies = ['V1', 'V2'].map((version) => {
    const list = trades.filter((t) => t.strategy_version === version);
    const stats = groupStats(list);
    const used = list.filter((t) => t.choch_used);
    const present = list.filter((t) => t.choch_used && t.choch_present);
    return {
      version,
      ...stats,
      chochUsed: used.length,
      chochPresent: present.length,
      chochStats: groupStats(present),
      noChochStats: groupStats(list.filter((t) => !t.choch_used || !t.choch_present))
    };
  });

  const pairs = Object.entries(trades.reduce((acc, t) => {
    (acc[t.pair] ||= []).push(t);
    return acc;
  }, {})).map(([pair, list]) => ({ pair, ...groupStats(list) }))
    .sort((a, b) => b.totalR - a.totalR);

  const news = groupStats(trades.filter((t) => t.news));
  const noNews = groupStats(trades.filter((t) => !t.news));

  const confirmationKeys = [
    ['fvg', 'FVG'],
    ['wick_fvg', 'Wick FVG'],
    ['imbalance', 'Imbalance'],
    ['ob_detected', '1H Order Block'],
    ['shortened_zone', 'Shortened 50% zone'],
    ['first_tap', 'First tap'],
    ['second_tap', 'Second tap']
  ];
  const confirmations = confirmationKeys.map(([key, label]) => ({
    key, label,
    ...groupStats(trades.filter((t) => t[key]))
  }));

  const gradeOrder = ['A+', 'A', 'B', 'C'];
  const grades = gradeOrder.map((grade) => ({ grade, ...groupStats(trades.filter((t) => t.setup_grade === grade)) }));

  const trend = ['UPTREND', 'DOWNTREND'].map((value) => ({
    trend: value,
    ...groupStats(trades.filter((t) => t.trend === value))
  }));

  const direction = ['BUY', 'SELL'].map((value) => ({
    direction: value,
    ...groupStats(trades.filter((t) => t.direction === value))
  }));

  const comboMap = {};
  trades.forEach((trade) => {
    const key = comboLabel(trade);
    (comboMap[key] ||= []).push(trade);
  });
  const combos = Object.entries(comboMap).map(([label, list]) => ({ label, ...groupStats(list) }))
    .filter((c) => c.trades >= 2)
    .sort((a, b) => b.avgR - a.avgR);

  // CHoCH is a V2-only confirmation. Compare V2 trades with each other so the
  // result is not distorted by the much larger V1 sample.
  const v2Trades = trades.filter((t) => t.strategy_version === 'V2');
  const chochUsed = groupStats(v2Trades.filter((t) => t.choch_used));
  const chochNotUsed = groupStats(v2Trades.filter((t) => !t.choch_used));
  const chochPresent = groupStats(v2Trades.filter((t) => t.choch_used && t.choch_present));
  const chochAbsent = groupStats(v2Trades.filter((t) => t.choch_used && !t.choch_present));

  const dailyMap = {};
  trades.forEach((t) => {
    const day = String(t.trade_date).slice(0, 10);
    (dailyMap[day] ||= []).push(t);
  });
  const daily = Object.entries(dailyMap).map(([date, list]) => ({
    date,
    ...groupStats(list)
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    strategies,
    pairs,
    news,
    noNews,
    confirmations,
    grades,
    trend,
    direction,
    combos,
    choch: {
      used: chochUsed,
      notUsed: chochNotUsed,
      present: chochPresent,
      absent: chochAbsent,
      lift: chochUsed.avgR && chochNotUsed.avgR ? round(chochUsed.avgR - chochNotUsed.avgR, 2) : null
    },
    daily,
    totals: groupStats(trades)
  };
}

function buildInsights(trades, dashboard, analytics) {
  const insights = [];
  if (!trades.length) {
    return [{
      tone: 'neutral',
      category: 'Getting started',
      title: 'Your journal is ready to decode',
      body: 'Add your first trade and upload your annotated charts. Insights will appear only after real trade data exists.',
      metric: '0 trades'
    }];
  }
  const bestPair = analytics.pairs.filter((p) => p.trades >= 2).sort((a, b) => b.totalR - a.totalR)[0];
  if (bestPair) {
    insights.push({
      tone: bestPair.totalR >= 0 ? 'positive' : 'negative',
      category: 'Pair edge',
      title: `${bestPair.pair} is your strongest market`,
      body: `${bestPair.trades} recorded trades, ${bestPair.winRate}% win rate and ${bestPair.totalR > 0 ? '+' : ''}${bestPair.totalR}R total. This is based only on your saved outcomes.`,
      metric: `${bestPair.totalR > 0 ? '+' : ''}${bestPair.totalR}R`
    });
  }
  const v1 = analytics.strategies.find((s) => s.version === 'V1');
  const v2 = analytics.strategies.find((s) => s.version === 'V2');
  if (v1 && v2 && v1.trades && v2.trades) {
    const leader = v2.avgR > v1.avgR ? v2 : v1;
    const gap = Math.abs(round(v2.avgR - v1.avgR, 2));
    insights.push({
      tone: leader.avgR > 0 ? 'positive' : 'negative',
      category: 'Strategy',
      title: `${leader.version} is ahead by ${gap}R per trade`,
      body: `V1 averages ${v1.avgR}R across ${v1.trades} trades. V2 averages ${v2.avgR}R across ${v2.trades} trades. ${v2.trades < 8 ? 'V2 still has a small sample, so treat this as directional.' : 'The sample is large enough to monitor this edge.'}`,
      metric: `${leader.winRate}% WR`
    });
  }
  const bestConfirmation = analytics.confirmations.filter((c) => c.trades >= 2).sort((a, b) => b.avgR - a.avgR)[0];
  if (bestConfirmation) {
    insights.push({
      tone: 'positive',
      category: 'Confirmation',
      title: `${bestConfirmation.label} is your highest-quality trigger`,
      body: `Trades carrying ${bestConfirmation.label} average ${bestConfirmation.avgR}R with a ${bestConfirmation.winRate}% win rate across ${bestConfirmation.trades} trades.`,
      metric: `${bestConfirmation.avgR}R avg`
    });
  }
  const weakestTrend = [...analytics.trend].filter((t) => t.trades >= 2).sort((a, b) => a.avgR - b.avgR)[0];
  if (weakestTrend && weakestTrend.avgR < 0) {
    insights.push({
      tone: 'negative',
      category: 'Warning',
      title: `${weakestTrend.trend === 'UPTREND' ? 'Uptrend' : 'Downtrend'} entries are leaking R`,
      body: `${weakestTrend.trades} trades in ${weakestTrend.trend.toLowerCase()} conditions average ${weakestTrend.avgR}R. Review your first-tap confirmation before taking the second tap.`,
      metric: `${weakestTrend.avgR}R avg`
    });
  }
  if (analytics.choch.used.trades >= 3) {
    const lift = analytics.choch.lift;
    insights.push({
      tone: lift !== null && lift > 0 ? 'positive' : 'negative',
      category: 'V2 / CHoCH',
      title: lift !== null && lift > 0 ? '15M CHoCH is adding an edge' : '15M CHoCH is not improving results yet',
      body: `V2 trades using 15M CHoCH average ${analytics.choch.used.avgR}R versus ${analytics.choch.notUsed.avgR}R without. ${lift !== null ? `That is a ${lift > 0 ? '+' : ''}${lift}R difference.` : ''}${analytics.choch.used.trades < 5 || analytics.choch.notUsed.trades < 5 ? ' One comparison group is still small, so treat this as directional.' : ''}`,
      metric: `${analytics.choch.used.trades} used`
    });
  }
  const bestCombo = analytics.combos[0];
  if (bestCombo) {
    insights.push({
      tone: 'positive',
      category: 'Strongest combination',
      title: bestCombo.label,
      body: `${bestCombo.trades} trades, ${bestCombo.winRate}% win rate, ${bestCombo.avgR}R average and ${bestCombo.totalR}R total. This is the strongest recurring condition set in your saved journal.`,
      metric: `${bestCombo.totalR}R`
    });
  }
  const aiMistakes = {};
  trades.forEach((trade) => {
    const mistakes = trade.ai_analysis?.mistakes;
    if (Array.isArray(mistakes)) {
      mistakes.forEach((mistake) => {
        const key = String(mistake).trim();
        if (key) aiMistakes[key] = (aiMistakes[key] || 0) + 1;
      });
    }
  });
  const topMistake = Object.entries(aiMistakes).sort((a, b) => b[1] - a[1])[0];
  if (topMistake) {
    insights.push({
      tone: 'negative',
      category: 'Recurring mistake',
      title: topMistake[0],
      body: `The chart reviews flagged this issue ${topMistake[1]} time${topMistake[1] === 1 ? '' : 's'}. Correct it before the next second-tap entry.`,
      metric: `${topMistake[1]} flags`
    });
  }
  if (dashboard.dailyLoss > 0 && dashboard.dailyLossLimit) {
    const usage = Math.min(100, round(dashboard.dailyLoss / dashboard.dailyLossLimit * 100, 1));
    insights.push({
      tone: usage > 80 ? 'negative' : 'neutral',
      category: 'Risk',
      title: `Daily loss limit is ${usage}% used`,
      body: `${dashboard.dailyLoss.toFixed(2)} lost today against a ${dashboard.dailyLossLimit.toFixed(2)} limit. ${usage > 80 ? 'Stand down and protect the account.' : 'Stay within the plan.'}`,
      metric: `${usage}%`
    });
  }
  const newsBest = analytics.news.trades >= 2 ? analytics.news : null;
  if (newsBest) {
    insights.push({
      tone: analytics.news.avgR >= analytics.noNews.avgR ? 'positive' : 'negative',
      category: 'News',
      title: analytics.news.avgR >= analytics.noNews.avgR ? 'News trades are outperforming' : 'News trades are underperforming',
      body: `News-time trades average ${analytics.news.avgR}R versus ${analytics.noNews.avgR}R outside news. Compare this before taking setups through scheduled events.`,
      metric: `${analytics.news.trades} trades`
    });
  }
  return insights.slice(0, 8);
}

function getBootstrap(userId) {
  const settings = getSettings(userId);
  const trades = getTrades(userId);
  const dashboard = computeDashboard(userId, settings, trades);
  const analytics = computeAnalytics(trades, settings);
  const insights = buildInsights(trades, dashboard, analytics);
  return { settings, trades, dashboard, analytics, insights };
}

// ---------- Auth middleware ----------
function auth(req, res, next) {
  const token = parseCookies(req.headers.cookie || '').decode_session;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const session = get(
    `SELECT s.*, u.id AS user_id, u.name, u.email, u.created_at AS user_created
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    sha256(token), Date.now()
  );
  if (!session) return res.status(401).json({ error: 'Session expired' });
  req.user = { id: session.user_id, name: session.name, email: session.email, created_at: session.user_created };
  req.session = session;
  next();
}

function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.headers['x-csrf-token'];
  if (!token || token !== req.session?.csrf) return res.status(403).json({ error: 'Invalid security token' });
  next();
}

const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const key = req.ip || 'unknown';
  const record = loginAttempts.get(key) || { count: 0, reset: Date.now() + 15 * 60 * 1000 };
  if (Date.now() > record.reset) { record.count = 0; record.reset = Date.now() + 15 * 60 * 1000; }
  if (record.count >= 12) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  record.count += 1;
  loginAttempts.set(key, record);
  next();
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------- Auth routes ----------
app.post('/api/auth/register', rateLimitLogin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (get('SELECT id FROM users WHERE email = ?', email)) return res.status(409).json({ error: 'An account with this email already exists' });
  const { hash, salt } = hashPassword(password);
  const id = uid();
  run('INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id, name, email, hash, salt, now());
  defaultSettings(id);
  const { token, csrf } = createSession(id);
  res.setHeader('Set-Cookie', sessionCookie(token, req.secure));
  res.status(201).json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', id)), csrf });
});

app.post('/api/auth/login', rateLimitLogin, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return res.status(401).json({ error: 'Email or password is incorrect' });
  }
  const { token, csrf } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, req.secure));
  res.json({ user: publicUser(user), csrf });
});

app.post('/api/auth/demo', (req, res) => {
  let user = get('SELECT * FROM users WHERE email = ?', 'demo@decode.app');
  if (!user) {
    const id = uid();
    const { hash, salt } = hashPassword(crypto.randomBytes(18).toString('hex'));
    run('INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id, 'Alex Morgan', 'demo@decode.app', hash, salt, now());
    defaultSettings(id);
    run('UPDATE settings SET starting_balance = 25000, risk_per_trade = 1, daily_loss_limit = 3, max_drawdown = 12 WHERE user_id = ?', id);
    user = get('SELECT * FROM users WHERE id = ?', id);
    seedDemo(user.id);
  }
  const { token, csrf } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, req.secure));
  res.json({ user: publicUser(user), csrf });
});

app.post('/api/auth/logout', auth, (req, res) => {
  run('DELETE FROM sessions WHERE id = ?', req.session.id);
  res.setHeader('Set-Cookie', 'decode_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/api/bootstrap', auth, async (req, res) => {
  const data = getBootstrap(req.user.id);
  res.json({
    user: req.user,
    csrf: req.session.csrf,
    ...data,
    ai: await getAiStatus(data.settings)
  });
});

// ---------- Trades ----------
app.get('/api/trades', auth, (req, res) => {
  res.json({ trades: getTrades(req.user.id) });
});

app.get('/api/trades/:id', auth, (req, res) => {
  const trade = getTrade(req.user.id, req.params.id);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  res.json({ trade });
});

app.post('/api/trades', auth, requireCsrf, (req, res) => {
  const data = normalizeTrade(req.body || {});
  if (!data.pair) return res.status(400).json({ error: 'Pair is required' });
  if (!data.entry || !data.sl || !data.tp) return res.status(400).json({ error: 'Entry, stop loss and take profit are required' });
  const id = uid();
  const ts = now();
  run(`INSERT INTO trades
    (id, user_id, pair, trade_date, direction, trend, strategy_version, entry, sl, tp, lot_size,
     risk_percent, risk_amount, planned_rr, actual_rr, result, news, news_event, notes, setup_grade,
     grade_confidence, ob_detected, shortened_zone, first_tap, fvg, wick_fvg, imbalance, second_tap,
     choch_used, choch_present, ai_status, manual_corrections, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    id, req.user.id, data.pair, data.trade_date, data.direction, data.trend, data.strategy_version,
    data.entry, data.sl, data.tp, data.lot_size, data.risk_percent, data.risk_amount, data.planned_rr,
    data.actual_rr, data.result, data.news, data.news_event, data.notes, data.setup_grade,
    data.grade_confidence, data.ob_detected, data.shortened_zone, data.first_tap, data.fvg,
    data.wick_fvg, data.imbalance, data.second_tap, data.choch_used, data.choch_present,
    data.manual_corrections, ts, ts);
  const saved = saveCharts(req.user.id, id, req.body.charts);
  res.status(201).json({ trade: getTrade(req.user.id, id), chartsSaved: saved });
});

app.put('/api/trades/:id', auth, requireCsrf, (req, res) => {
  const existing = get('SELECT * FROM trades WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Trade not found' });
  const data = normalizeTrade(req.body || {}, existing);
  run(`UPDATE trades SET
    pair = ?, trade_date = ?, direction = ?, trend = ?, strategy_version = ?, entry = ?, sl = ?, tp = ?,
    lot_size = ?, risk_percent = ?, risk_amount = ?, planned_rr = ?, actual_rr = ?, result = ?, news = ?,
    news_event = ?, notes = ?, setup_grade = ?, grade_confidence = ?, ob_detected = ?, shortened_zone = ?,
    first_tap = ?, fvg = ?, wick_fvg = ?, imbalance = ?, second_tap = ?, choch_used = ?, choch_present = ?,
    manual_corrections = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    data.pair, data.trade_date, data.direction, data.trend, data.strategy_version, data.entry, data.sl,
    data.tp, data.lot_size, data.risk_percent, data.risk_amount, data.planned_rr, data.actual_rr,
    data.result, data.news, data.news_event, data.notes, data.setup_grade, data.grade_confidence,
    data.ob_detected, data.shortened_zone, data.first_tap, data.fvg, data.wick_fvg, data.imbalance,
    data.second_tap, data.choch_used, data.choch_present, data.manual_corrections, now(),
    req.params.id, req.user.id);
  const saved = saveCharts(req.user.id, req.params.id, req.body.charts);
  res.json({ trade: getTrade(req.user.id, req.params.id), chartsSaved: saved });
});

app.delete('/api/trades/:id', auth, requireCsrf, (req, res) => {
  const charts = all('SELECT path FROM charts WHERE trade_id = ? AND user_id = ?', req.params.id, req.user.id);
  const result = run('DELETE FROM trades WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Trade not found' });
  charts.forEach((chart) => { try { fs.unlinkSync(chart.path); } catch {} });
  res.json({ ok: true });
});

// ---------- Charts ----------
function saveCharts(userId, tradeId, charts) {
  if (!Array.isArray(charts) || !charts.length) return 0;
  let saved = 0;
  for (const chart of charts.slice(0, 10)) {
    const match = String(chart?.dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) continue;
    const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 8 * 1024 * 1024) continue;
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const filename = `${uid()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    run('INSERT INTO charts (id, trade_id, user_id, filename, original_name, mime, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      uid(), tradeId, userId, filename, String(chart.name || 'chart').slice(0, 180), mime, buffer.length, filePath, now());
    saved += 1;
  }
  if (saved > 0) {
    run("UPDATE trades SET ai_status = 'pending', updated_at = ? WHERE id = ? AND user_id = ?", now(), tradeId, userId);
  }
  return saved;
}

app.post('/api/trades/:id/charts', auth, requireCsrf, (req, res) => {
  const trade = get('SELECT id FROM trades WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  const saved = saveCharts(req.user.id, req.params.id, req.body.charts);
  res.json({ saved, charts: chartsForTrade(req.params.id) });
});

app.get('/api/charts/:id/file', auth, (req, res) => {
  const chart = get('SELECT * FROM charts WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!chart) return res.status(404).json({ error: 'Chart not found' });
  res.type(chart.mime);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(chart.path);
});

app.delete('/api/charts/:id', auth, requireCsrf, (req, res) => {
  const chart = get('SELECT * FROM charts WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!chart) return res.status(404).json({ error: 'Chart not found' });
  run('DELETE FROM charts WHERE id = ?', chart.id);
  try { fs.unlinkSync(chart.path); } catch {}
  res.json({ ok: true });
});

// ---------- Settings ----------
app.put('/api/settings', auth, requireCsrf, (req, res) => {
  const current = getSettings(req.user.id);
  const next = {
    starting_balance: Math.max(0, Number(req.body.starting_balance ?? current.starting_balance)),
    risk_per_trade: clamp(Number(req.body.risk_per_trade ?? current.risk_per_trade), 0.01, 100),
    daily_loss_limit: clamp(Number(req.body.daily_loss_limit ?? current.daily_loss_limit), 0.1, 100),
    max_drawdown: clamp(Number(req.body.max_drawdown ?? current.max_drawdown), 0.1, 100),
    ai_model: String(req.body.ai_model ?? current.ai_model).slice(0, 120),
    ollama_url: String(req.body.ollama_url ?? current.ollama_url).replace(/\/$/, '').slice(0, 300)
  };
  run(`UPDATE settings SET starting_balance = ?, risk_per_trade = ?, daily_loss_limit = ?, max_drawdown = ?,
       ai_model = ?, ollama_url = ?, updated_at = ? WHERE user_id = ?`,
    next.starting_balance, next.risk_per_trade, next.daily_loss_limit, next.max_drawdown,
    next.ai_model, next.ollama_url, now(), req.user.id);
  aiStatusCache.delete(req.user.id);
  res.json({ settings: getSettings(req.user.id) });
});

// ---------- AI ----------
let aiStatusCache = new Map();
async function getAiStatus(settings) {
  const key = `${settings.ollama_url}|${settings.ai_model}`;
  const cached = aiStatusCache.get(key);
  if (cached && Date.now() - cached.at < 15000) return cached.value;
  const value = await checkOllama(settings);
  aiStatusCache.set(key, { at: Date.now(), value });
  return value;
}

async function checkOllama(settings) {
  try {
    const response = await fetch(`${settings.ollama_url}/api/tags`, { signal: AbortSignal.timeout(2200) });
    if (!response.ok) throw new Error('offline');
    const data = await response.json();
    const models = (data.models || []).map((m) => ({ name: m.name, vision: m.capabilities?.includes('vision') || false, size: m.size }));
    const model = models.find((m) => m.name === settings.ai_model) || models.find((m) => m.vision) || models[0];
    return { online: true, model: model?.name || settings.ai_model, models, configuredModel: settings.ai_model };
  } catch (error) {
    return { online: false, model: settings.ai_model, models: [], error: error.message };
  }
}

app.get('/api/ai/status', auth, async (req, res) => {
  const settings = getSettings(req.user.id);
  const status = await getAiStatus(settings);
  res.json(status);
});

const analysesInFlight = new Set();

app.post('/api/trades/:id/analyze', auth, requireCsrf, async (req, res) => {
  const trade = getTrade(req.user.id, req.params.id);
  if (!trade) return res.status(404).json({ error: 'Trade not found' });
  if (!trade.charts.length) return res.status(400).json({ error: 'Upload at least one annotated chart before running analysis' });
  if (analysesInFlight.has(trade.id)) return res.status(202).json({ status: 'analyzing' });
  run('UPDATE trades SET ai_status = ?, updated_at = ? WHERE id = ? AND user_id = ?', 'analyzing', now(), trade.id, req.user.id);
  analysesInFlight.add(trade.id);
  res.status(202).json({ status: 'analyzing' });
  analyzeTrade(req.user.id, trade.id).finally(() => analysesInFlight.delete(trade.id));
});

app.post('/api/ai/narrative', auth, requireCsrf, async (req, res) => {
  const settings = getSettings(req.user.id);
  const trades = getTrades(req.user.id);
  if (!trades.length) return res.status(400).json({ error: 'Add trades before generating insights' });
  const dashboard = computeDashboard(req.user.id, settings, trades);
  const analytics = computeAnalytics(trades, settings);
  const summary = {
    totals: analytics.totals,
    strategies: analytics.strategies.map(({ version, trades, wins, losses, winRate, avgR, totalR, profitFactor }) => ({ version, trades, wins, losses, winRate, avgR, totalR, profitFactor })),
    pairs: analytics.pairs.slice(0, 8),
    news: { news: analytics.news, nonNews: analytics.noNews },
    choch: { used: analytics.choch.used, notUsed: analytics.choch.notUsed, present: analytics.choch.present, absent: analytics.choch.absent },
    confirmations: analytics.confirmations,
    grades: analytics.grades,
    trend: analytics.trend,
    combos: analytics.combos.slice(0, 5),
    risk: { netPnl: dashboard.netPnl, maxDrawdown: dashboard.maxDrawdown, currentDrawdown: dashboard.currentDrawdown, dailyLoss: dashboard.dailyLoss }
  };
  const prompt = `You are the analysis engine inside a forex trading journal. Write a concise, premium-quality performance review using ONLY the JSON statistics supplied. Never invent trades, pairs, percentages, chart details or outcomes. If a sample is too small, say so. Return strict JSON with this shape: {"headline": string, "paragraphs": [string, string], "actions": [string, string, string]}. Keep it under 180 words. Data: ${JSON.stringify(summary)}`;
  try {
    const status = await getAiStatus(settings);
    const model = status.model || settings.ai_model;
    const response = await fetch(`${settings.ollama_url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: 'You are a precise quantitative trading journal analyst. You only use supplied data and never fabricate.' },
          { role: 'user', content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    const content = data.message?.content || '';
    const parsed = parseJson(content);
    if (!parsed) throw new Error('AI returned an unreadable response');
    res.json({ narrative: parsed });
  } catch (error) {
    res.status(503).json({ error: 'AI narrative is unavailable. Check that Ollama is running and the selected vision model is installed.', detail: error.message });
  }
});

async function analyzeTrade(userId, tradeId) {
  const settings = getSettings(userId);
  const trade = getTrade(userId, tradeId);
  if (!trade) return;
  let model = settings.ai_model;
  try {
    const chartRows = all('SELECT * FROM charts WHERE trade_id = ? ORDER BY created_at', tradeId);
    const images = chartRows.slice(0, 6).map((chart) => fs.readFileSync(chart.path).toString('base64'));
    const prompt = `Audit this forex trade against the Decode strategy.

STRATEGY V1:
- Identify trend and Order Block on the 1H timeframe.
- Use the shortened 50% portion of the Order Block zone.
- Wait for the first tap into the zone.
- The first tap must show at least one of: FVG, Wick FVG or imbalance-candle confirmation.
- The second tap into the zone is the entry.
- BUY in an uptrend, SELL in a downtrend.
- Minimum planned RR is 1:4.

STRATEGY V2:
- Same as V1, with an optional 15M Change of Character (CHoCH) check during the second tap.
- Only evaluate CHoCH when the trade record says choch_used is true.

TRADE RECORD:
${JSON.stringify({
  pair: trade.pair, date: trade.trade_date, direction: trade.direction, trend: trade.trend,
  strategy: trade.strategy_version, entry: trade.entry, sl: trade.sl, tp: trade.tp,
  planned_rr: trade.planned_rr, result: trade.result, actual_rr: trade.actual_rr,
  recorded_checklist: {
    order_block: trade.ob_detected, shortened_zone: trade.shortened_zone, first_tap: trade.first_tap,
    fvg: trade.fvg, wick_fvg: trade.wick_fvg, imbalance: trade.imbalance, second_tap: trade.second_tap,
    choch_used: trade.choch_used, choch_present: trade.choch_present
  }, notes: trade.notes
})}

Analyze the actual uploaded chart screenshots. Report only what is visibly supported by the images. Mark anything not visible as "uncertain" and explain. Compare the chart with the recorded data. If the chart is unreadable or does not show enough information, say so rather than inventing.

GRADING RULES:
- The first tap needs only ONE of FVG, Wick FVG or imbalance. Do not call the other two "missing" when one is visible or recorded.
- 15M CHoCH is optional. If the chart has no 15M panel, mark choch_15m uncertain and do not treat it as a failed requirement.
- missing_confirmations must list only required V1/V2 conditions that are absent or contradicted by the chart. Leave it empty when the required sequence is present.
- Grade the setup against the rules, not against the win/loss outcome. Do not invent prices; read them from labels or the price axis.

Return strict JSON only:
{
  "observations": {
    "order_block": {"status": "pass" | "fail" | "uncertain", "note": string},
    "shortened_zone": {"status": "pass" | "fail" | "uncertain", "note": string},
    "first_tap": {"status": "pass" | "fail" | "uncertain", "note": string},
    "fvg": {"status": "pass" | "fail" | "uncertain", "note": string},
    "wick_fvg": {"status": "pass" | "fail" | "uncertain", "note": string},
    "imbalance": {"status": "pass" | "fail" | "uncertain", "note": string},
    "second_tap": {"status": "pass" | "fail" | "uncertain", "note": string},
    "entry": {"status": "pass" | "fail" | "uncertain", "note": string},
    "sl": {"status": "pass" | "fail" | "uncertain", "note": string},
    "tp": {"status": "pass" | "fail" | "uncertain", "note": string},
    "choch_15m": {"status": "pass" | "fail" | "uncertain", "note": string}
  },
  "strategy_followed": "V1" | "V2" | "neither" | "uncertain",
  "opposite_trend_entry": boolean,
  "missing_confirmations": [string],
  "incorrect_entries": [string],
  "setup_grade": "A+" | "A" | "B" | "C",
  "confidence": number,
  "summary": string,
  "mistakes": [string],
  "corrections_needed": [string]
}`;

    const status = await getAiStatus(settings);
    model = status.model || settings.ai_model;
    const response = await fetch(`${settings.ollama_url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0.1, num_ctx: 8192 },
        messages: [
          { role: 'system', content: 'You are a forensic forex chart auditor. You only report visible evidence from the supplied images. Never fabricate chart features, prices, or outcomes. Output valid JSON only.' },
          { role: 'user', content: prompt, images }
        ]
      }),
      signal: AbortSignal.timeout(900000)
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const data = await response.json();
    const content = data.message?.content || '';
    const parsed = parseJson(content);
    if (!parsed) throw new Error('AI returned an unreadable response');
    const normalized = normalizeAnalysis(parsed);
    const grade = ['A+', 'A', 'B', 'C'].includes(normalized.setup_grade) ? normalized.setup_grade : null;
    const confidence = clamp(Number(normalized.confidence || 0), 0, 1);
    run(`UPDATE trades SET ai_status = 'complete', ai_analysis = ?, ai_model = ?, ai_analyzed_at = ?,
         setup_grade = COALESCE(?, setup_grade), grade_confidence = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      JSON.stringify(normalized), model, now(), grade, confidence, now(), tradeId, userId);
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || /timeout|aborted/i.test(String(error?.message || ''));
    const message = timedOut
      ? 'The local vision model took too long to respond. Try again, or choose a smaller vision model in Settings.'
      : String(error?.message || 'The chart review could not complete.');
    run(`UPDATE trades SET ai_status = 'failed', ai_analysis = ?, ai_model = ?, ai_analyzed_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      JSON.stringify({ error: message, failed_at: now() }), model, now(), now(), tradeId, userId);
  }
}

function normalizeAnalysis(input) {
  const statuses = new Set(['pass', 'fail', 'uncertain']);
  const observations = {};
  for (const key of ['order_block', 'shortened_zone', 'first_tap', 'fvg', 'wick_fvg', 'imbalance', 'second_tap', 'entry', 'sl', 'tp', 'choch_15m']) {
    const value = input?.observations?.[key];
    observations[key] = {
      status: statuses.has(value?.status) ? value.status : 'uncertain',
      note: String(value?.note || '').slice(0, 500)
    };
  }
  return {
    observations,
    strategy_followed: ['V1', 'V2', 'neither', 'uncertain'].includes(input?.strategy_followed) ? input.strategy_followed : 'uncertain',
    opposite_trend_entry: !!input?.opposite_trend_entry,
    missing_confirmations: Array.isArray(input?.missing_confirmations) ? input.missing_confirmations.map(String).slice(0, 10) : [],
    incorrect_entries: Array.isArray(input?.incorrect_entries) ? input.incorrect_entries.map(String).slice(0, 10) : [],
    setup_grade: ['A+', 'A', 'B', 'C'].includes(input?.setup_grade) ? input.setup_grade : 'C',
    confidence: clamp(Number(input?.confidence || 0), 0, 1),
    summary: String(input?.summary || '').slice(0, 1600),
    mistakes: Array.isArray(input?.mistakes) ? input.mistakes.map(String).slice(0, 10) : [],
    corrections_needed: Array.isArray(input?.corrections_needed) ? input.corrections_needed.map(String).slice(0, 10) : [],
    analyzed_at: now()
  };
}

// ---------- Export ----------
app.get('/api/export', auth, (req, res) => {
  const data = getBootstrap(req.user.id);
  res.setHeader('Content-Disposition', 'attachment; filename="decode-journal.json"');
  res.json({ exported_at: now(), user: req.user, ...data });
});

// ---------- Demo seed ----------
function seedDemo(userId) {
  let seed = 424242;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(random() * arr.length)];
  const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURJPY', 'GBPJPY'];
  const notes = [
    'Clean second tap after London open. First tap left a clear FVG.',
    'Waited for the shortened 50% zone. Entry was patient and structured.',
    'Slight hesitation at the zone, but the imbalance held.',
    'News volatility made the tap messy. Reduced size.',
    'Textbook V1 sequence. First tap rejected from the zone with a wick FVG.',
    'Entry was early — second tap had not fully formed.',
    'Held to full target. Structure stayed aligned with the 1H trend.',
    'Partial management after 2R. Closed the rest at target.',
    'CHoCH on 15M gave extra confidence for the second tap.',
    'Trend was extended; should have waited for a fresh order block.'
  ];
  const events = ['US CPI', 'NFP', 'FOMC', 'ECB Press Conference', 'UK GDP', 'BoJ Rate Decision'];
  const nowDate = new Date();
  const start = new Date(nowDate);
  start.setDate(start.getDate() - 112);
  const count = 38;
  for (let i = 0; i < count; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + Math.floor((i / count) * 108) + Math.floor(random() * 2));
    date.setHours(7 + Math.floor(random() * 10), Math.floor(random() * 60));
    const pair = pick(pairs);
    const direction = random() > 0.48 ? 'BUY' : 'SELL';
    const opposite = random() < 0.1;
    const trend = opposite
      ? (direction === 'BUY' ? 'DOWNTREND' : 'UPTREND')
      : (direction === 'BUY' ? 'UPTREND' : 'DOWNTREND');
    const version = random() < 0.66 ? 'V1' : 'V2';
    const chochUsed = version === 'V2' && random() < 0.64;
    const chochPresent = chochUsed && random() < 0.58;
    const fvg = random() < 0.46;
    const wickFvg = !fvg && random() < 0.5;
    const imbalance = !fvg && !wickFvg && random() < 0.62;
    const goodSetup = !opposite && (fvg || wickFvg || imbalance);
    const grade = opposite ? 'C' : goodSetup ? (random() < 0.2 ? 'A+' : random() < 0.62 ? 'A' : 'B') : (random() < 0.65 ? 'B' : 'C');
    const winChance = grade === 'A+' ? 0.7 : grade === 'A' ? 0.59 : grade === 'B' ? 0.45 : 0.22;
    const win = random() < winChance;
    const result = !win && random() < 0.06 ? 'BREAKEVEN' : win ? 'WIN' : 'LOSS';
    const actualRr = result === 'WIN' ? round(1.3 + random() * 3.7, 1) : result === 'LOSS' ? -1 : 0;
    const riskAmount = 250;
    const priceBase = pair.includes('JPY') ? 145 + random() * 20 : pair === 'GBPUSD' ? 1.25 + random() * 0.1 : 1.02 + random() * 0.12;
    const entry = Number(priceBase.toFixed(pair.includes('JPY') ? 2 : 4));
    const slDistance = pair.includes('JPY') ? 0.25 : 0.0025;
    const sl = Number((entry + (direction === 'BUY' ? -slDistance : slDistance)).toFixed(pair.includes('JPY') ? 2 : 4));
    const tp = Number((entry + (direction === 'BUY' ? slDistance * 4.6 : -slDistance * 4.6)).toFixed(pair.includes('JPY') ? 2 : 4));
    const news = random() < 0.22;
    const tradeId = uid();
    const ts = date.toISOString();
    run(`INSERT INTO trades
      (id, user_id, pair, trade_date, direction, trend, strategy_version, entry, sl, tp, lot_size,
       risk_percent, risk_amount, planned_rr, actual_rr, result, news, news_event, notes, setup_grade,
       grade_confidence, ob_detected, shortened_zone, first_tap, fvg, wick_fvg, imbalance, second_tap,
       choch_used, choch_present, ai_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tradeId, userId, pair, ts, direction, trend, version, entry, sl, tp,
      Number((riskAmount / (slDistance * (pair.includes('JPY') ? 1000 : 100000))).toFixed(2)),
      1, riskAmount, 4.6, actualRr, result, news ? 1 : 0, news ? pick(events) : '', pick(notes), grade,
      round(0.62 + random() * 0.3, 2), 1, 1, 1, fvg ? 1 : 0, wickFvg ? 1 : 0, imbalance ? 1 : 0, 1,
      chochUsed ? 1 : 0, chochPresent ? 1 : 0, 'pending', ts, ts);
  }
}

// Seed the demo workspace once.
if (!get('SELECT id FROM users WHERE email = ?', 'demo@decode.app')) {
  const id = uid();
  const { hash, salt } = hashPassword(crypto.randomBytes(18).toString('hex'));
  run('INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id, 'Alex Morgan', 'demo@decode.app', hash, salt, now());
  defaultSettings(id);
  run('UPDATE settings SET starting_balance = 25000, risk_per_trade = 1, daily_loss_limit = 3, max_drawdown = 12 WHERE user_id = ?', id);
  seedDemo(id);
}

// Clean expired sessions periodically.
setInterval(() => {
  try { run('DELETE FROM sessions WHERE expires_at < ?', Date.now()); } catch {}
}, 1000 * 60 * 60 * 6).unref();

app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = Number(process.env.PORT || 4173);
app.listen(PORT, () => {
  console.log(`Decode running at http://localhost:${PORT}`);
});
