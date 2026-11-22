export const state = {
  user: null,
  csrf: null,
  settings: null,
  trades: [],
  dashboard: null,
  analytics: null,
  insights: [],
  ai: null,
  authMode: 'login',
  chartRange: 'ALL',
  journalFilters: { search: '', result: 'all', strategy: 'all', pair: 'all' },
  uploadFiles: [],
  editingId: null,
  narrative: null,
  poll: null,
  aiFilter: 'all'
};

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function api(path, { method = 'GET', body, csrf = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrf && state.csrf && method !== 'GET') headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function hydrate(data) {
  state.user = data.user;
  state.csrf = data.csrf || state.csrf;
  state.settings = data.settings;
  state.trades = data.trades || [];
  state.dashboard = data.dashboard;
  state.analytics = data.analytics;
  state.insights = data.insights || [];
  state.ai = data.ai || null;
}

export async function loadBootstrap() {
  const data = await api('/api/bootstrap');
  hydrate(data);
  return data;
}

export const fmtMoney = (value, digits = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));

export const fmtNum = (value, digits = 2) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));

export const fmtPct = (value, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;
export const fmtR = (value, digits = 2) => `${Number(value || 0) > 0 ? '+' : ''}${Number(value || 0).toFixed(digits)}R`;
export const fmtPrice = (value) => {
  const n = Number(value || 0);
  if (n >= 100) return n.toFixed(2);
  return n.toFixed(n >= 10 ? 3 : 4);
};

export function fmtDate(value, opts = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...opts }).format(date);
}

export function fmtDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function fmtTimeAgo(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return fmtDate(value);
}

export function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'D';
}

export function gradeClass(grade) {
  if (grade === 'A+') return 'aplus';
  if (grade === 'A') return 'a';
  if (grade === 'B') return 'b';
  if (grade === 'C') return 'c';
  return 'none';
}

export function gradeBadge(grade, small = false) {
  const value = grade || '—';
  return `<span class="grade ${gradeClass(grade)}" ${small ? 'style="width:23px;height:23px;font-size:8px"' : ''}>${esc(value)}</span>`;
}

export function resultBadge(result) {
  const map = { WIN: ['win', 'Win'], LOSS: ['loss', 'Loss'], BREAKEVEN: ['be', 'BE'] };
  const [cls, label] = map[result] || ['neutral', result || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

export function aiStatusLabel(status) {
  const map = {
    complete: 'AI reviewed',
    analyzing: 'Analyzing',
    failed: 'Review failed',
    pending: 'Not analyzed'
  };
  return map[status] || 'Not analyzed';
}

export function aiStatusClass(status) {
  return ['complete', 'analyzing', 'failed'].includes(status) ? status : '';
}

export function icon(name, size = 16) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h5"/>',
    chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    sparkles: '<path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3Z"/><path d="M5 15l-.7 2.3L2 18l2.3.7L5 21l.7-2.3L8 18l-2.3-.7L5 15Z"/><path d="M19 14l-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8L19 14Z"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.6 15.2 14 16 14 18h-4c0-2-.6-2.8-1.5-3.5Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10.03 3.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.05 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.37 9v.01a1.7 1.7 0 0 0 1.53 1.02H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
    arrowDownRight: '<path d="m7 7 10 10M17 7v10H7"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    trendingUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    trendingDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    camera: '<path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z"/><circle cx="12" cy="13" r="4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V6"/><path d="M10 6h8M10 10h8M10 14h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    wand: '<path d="m15 4 5 5M13 6l5 5M3 21 17 7M6 3v3M4.5 4.5h3M18 17v3M16.5 18.5h3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    zap: '<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
    brain: '<path d="M9.5 4A3.5 3.5 0 0 0 6 7.5 3 3 0 0 0 4.5 13a3.5 3.5 0 0 0 2.2 5.8A3.5 3.5 0 0 0 12 21V3a3 3 0 0 0-2.5 1Z"/><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5 3 3 0 0 1 19.5 13a3.5 3.5 0 0 1-2.2 5.8A3.5 3.5 0 0 1 12 21"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-1.8-5.2-3.8-7.1C13.7 6.8 13 4.3 13 2c-2.3 1.7-3.2 3.8-3.2 5.5 0 1 .2 1.9.6 2.7-1.2-.4-2.2-1.4-2.9-2.7C5.8 9.5 5 11.7 5 14.3 5 18.5 8 22 12 22Z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.dot}</svg>`;
}

export function sparkline(values, color = 'var(--accent)', width = 74, height = 26) {
  const data = values.length ? values : [0, 0];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((value, index) => {
    const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
    const y = height - 3 - ((value - min) / span) * (height - 7);
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `sg-${Math.random().toString(36).slice(2, 8)}`;
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".45"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path class="area" d="${area}" fill="url(#${id})"/>
    <path class="line" d="${line}" stroke="${color}"/>
  </svg>`;
}

export function ring(value, size = 42, stroke = 3.5, color = 'var(--accent)') {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
  </svg>`;
}

export function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mid = (x0 + x1) / 2;
    d += ` C${mid},${y0} ${mid},${y1} ${x1},${y1}`;
  }
  return d;
}

export function equityChart(curve) {
  if (!curve || curve.length < 2) {
    return `<div class="empty-state" style="padding:70px 20px">
      <div class="empty-icon">${icon('chart', 21)}</div>
      <div class="empty-title">Your equity curve starts here</div>
      <div class="empty-text">Log closed trades to build a real performance curve. Every point is calculated from saved outcomes.</div>
    </div>`;
  }
  const width = 620;
  const height = 228;
  const pad = { left: 6, right: 52, top: 14, bottom: 20 };
  const values = curve.map((point) => point.equity);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const padding = (max - min) * 0.16;
  min -= padding;
  max += padding;
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const xFor = (index) => pad.left + (index / (curve.length - 1)) * chartW;
  const yFor = (value) => pad.top + (1 - (value - min) / (max - min)) * chartH;
  const points = curve.map((point, index) => [xFor(index), yFor(point.equity)]);
  const line = smoothPath(points);
  const area = `${line} L${points.at(-1)[0]},${pad.top + chartH} L${points[0][0]},${pad.top + chartH} Z`;
  const grid = [0, 1, 2, 3].map((i) => {
    const y = pad.top + (i / 3) * chartH;
    const value = max - (i / 3) * (max - min);
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(255,255,255,.055)" stroke-dasharray="2 4"/>
      <text x="${width - pad.right + 7}" y="${y + 3}" fill="#5d646e" font-size="7.5" font-family="Manrope, sans-serif">${fmtMoney(value)}</text>`;
  }).join('');
  const last = points.at(-1);
  const first = points[0];
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" id="equity-svg" data-points='${JSON.stringify(curve.map((p, i) => ({ x: xFor(i), y: yFor(p.equity), date: p.date, equity: p.equity, pair: p.pair || '' })))}'>
    <defs>
      <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d9ff57" stop-opacity=".22"/>
        <stop offset="65%" stop-color="#d9ff57" stop-opacity=".045"/>
        <stop offset="100%" stop-color="#d9ff57" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="equity-stroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#93ad3c"/>
        <stop offset="100%" stop-color="#d9ff57"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    ${grid}
    <path d="${area}" fill="url(#equity-fill)"/>
    <path d="${line}" fill="none" stroke="url(#equity-stroke)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    <line x1="${first[0]}" y1="${first[1]}" x2="${last[0]}" y2="${last[1]}" stroke="rgba(217,255,87,.14)" stroke-width="1"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3.2" fill="#d9ff57" stroke="#0d0f12" stroke-width="2"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="8" fill="none" stroke="rgba(217,255,87,.18)" stroke-width="1"/>
    <line id="equity-cursor" x1="0" y1="${pad.top}" x2="0" y2="${pad.top + chartH}" stroke="rgba(255,255,255,.16)" stroke-width="1" stroke-dasharray="3 4" style="opacity:0"/>
  </svg>`;
}

export function filteredTrades() {
  const { search, result, strategy, pair } = state.journalFilters;
  const term = search.trim().toLowerCase();
  return state.trades.filter((trade) => {
    if (result !== 'all' && trade.result !== result) return false;
    if (strategy !== 'all' && trade.strategy_version !== strategy) return false;
    if (pair !== 'all' && trade.pair !== pair) return false;
    if (term) {
      const haystack = `${trade.pair} ${trade.notes || ''} ${trade.news_event || ''} ${trade.setup_grade || ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export function ruleEvaluation(trade) {
  const confirmation = trade.fvg || trade.wick_fvg || trade.imbalance;
  const opposite = trade.opposite_trend;
  const rrPass = Number(trade.planned_rr) >= 4;
  const items = [
    { key: 'trend', label: 'Direction aligned with 1H trend', status: opposite ? 'fail' : 'pass', note: opposite ? `Trade direction is against the recorded ${trade.trend.toLowerCase()}.` : 'Direction matches the recorded 1H trend.' },
    { key: 'ob', label: '1H Order Block identified', status: trade.ob_detected ? 'pass' : 'uncertain', note: trade.ob_detected ? 'Recorded as identified.' : 'Not recorded on this trade.' },
    { key: 'zone', label: 'Shortened 50% zone used', status: trade.shortened_zone ? 'pass' : 'uncertain', note: trade.shortened_zone ? 'Recorded as used.' : 'Not recorded on this trade.' },
    { key: 'firstTap', label: 'First tap into the zone', status: trade.first_tap ? 'pass' : 'uncertain', note: trade.first_tap ? 'Recorded as the first tap.' : 'Not recorded on this trade.' },
    { key: 'confirmation', label: 'FVG / Wick FVG / Imbalance at first tap', status: confirmation ? 'pass' : 'fail', note: confirmation ? [trade.fvg && 'FVG', trade.wick_fvg && 'Wick FVG', trade.imbalance && 'Imbalance'].filter(Boolean).join(' · ') : 'No first-tap confirmation recorded.' },
    { key: 'secondTap', label: 'Entry on second tap', status: trade.second_tap ? 'pass' : 'fail', note: trade.second_tap ? 'Recorded as the second tap.' : 'Second tap was not confirmed.' },
    { key: 'rr', label: 'Planned RR ≥ 1:4', status: rrPass ? 'pass' : 'fail', note: `Planned RR is ${fmtNum(trade.planned_rr, 1)}:1.` }
  ];
  if (trade.strategy_version === 'V2') {
    items.push({
      key: 'choch',
      label: '15M CHoCH check (optional)',
      status: trade.choch_used ? (trade.choch_present ? 'pass' : 'uncertain') : 'uncertain',
      note: trade.choch_used ? (trade.choch_present ? 'CHoCH was present and used as confirmation.' : 'CHoCH was checked but not present.') : 'V2 CHoCH was not used on this trade.'
    });
  }
  const fails = items.filter((item) => item.status === 'fail').length;
  const uncertain = items.filter((item) => item.status === 'uncertain').length;
  const passes = items.filter((item) => item.status === 'pass').length;
  let grade = 'A+';
  if (opposite) grade = 'C';
  else if (fails >= 2) grade = 'C';
  else if (fails === 1 || uncertain >= 2) grade = 'B';
  else if (uncertain === 1) grade = 'A';
  else if (passes === items.length) grade = 'A+';
  const confidence = Math.round((passes / items.length) * 100);
  return { items, grade, confidence, fails, uncertain, passes, confirmation };
}

export function tradePnl(trade) {
  return Number(trade.risk_amount || 0) * Number(trade.actual_rr || 0);
}

export function chartUrl(chart) {
  return `/api/charts/${chart.id}/file`;
}
