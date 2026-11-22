import {
  state, esc, icon, fmtMoney, fmtNum, fmtPct, fmtR, fmtPrice, fmtDate, fmtDateTime,
  fmtTimeAgo, greeting, initials, gradeBadge, gradeClass, resultBadge, aiStatusLabel,
  aiStatusClass, sparkline, ring, equityChart, filteredTrades, ruleEvaluation, chartUrl,
  tradePnl, fmtDate as formatDate
} from './core.js';

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'grid', href: '#/overview' },
  { id: 'journal', label: 'Trade journal', icon: 'book', href: '#/journal' },
  { id: 'risk', label: 'Risk management', icon: 'shield', href: '#/risk' },
  { id: 'analytics', label: 'Analytics', icon: 'chart', href: '#/analytics' },
  { id: 'ai', label: 'AI lab', icon: 'sparkles', href: '#/ai', badge: 'AI' },
  { id: 'insights', label: 'Insights', icon: 'bulb', href: '#/insights' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '#/settings' }
];

const MOBILE_ITEMS = ['overview', 'journal', 'analytics', 'ai', 'insights'];

export function formatPair(pair = '') {
  const clean = String(pair).toUpperCase();
  if (clean.includes('/')) return clean;
  if (clean.length === 6) return `${clean.slice(0, 3)}/${clean.slice(3)}`;
  return clean;
}

export function renderShell(route) {
  const user = state.user || {};
  const isDemo = user.email === 'demo@decode.app';
  return `<div class="app-shell">
    <aside class="sidebar">
      <a href="#/overview" class="logo">
        <span class="logo-mark">D</span>
        <span class="logo-text">DECODE<span class="logo-sub">AI TRADING JOURNAL</span></span>
      </a>
      <div class="side-label">Workspace</div>
      <nav class="nav">
        ${NAV_ITEMS.map((item) => `<a class="nav-link ${route.name === item.id ? 'active' : ''}" href="${item.href}">
          ${icon(item.icon, 17)}<span>${item.label}</span>${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
        </a>`).join('')}
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="side-card">
        <div class="side-card-label">V1 / V2 playbook</div>
        <div class="side-card-title">Two taps. One confirmation. Minimum 1:4.</div>
        <div class="side-card-row"><span><span class="side-card-dot"></span>Rules locked</span><span>${state.trades.length} trades</span></div>
      </div>
      <div class="side-user" data-action="go-settings">
        <span class="avatar">${esc(initials(user.name))}</span>
        <div style="min-width:0"><div class="side-user-name">${esc(user.name || 'Trader')}</div><div class="side-user-role">${isDemo ? 'Demo workspace' : 'Private journal'}</div></div>
        <span class="side-user-more">${icon('settings', 14)}</span>
      </div>
    </aside>
    <div class="main-wrap">
      <header class="topbar" id="topbar">${renderTopbar(route)}</header>
      <main class="content" id="view"></main>
    </div>
    <nav class="mobile-nav">
      ${MOBILE_ITEMS.map((id) => {
        const item = NAV_ITEMS.find((nav) => nav.id === id);
        return `<a href="${item.href}" class="${route.name === item.id ? 'active' : ''}">${icon(item.icon, 17)}<span>${item.label.replace('Trade journal', 'Journal').replace('Risk management', 'Risk')}</span></a>`;
      }).join('')}
    </nav>
  </div>`;
}

export function renderTopbar(route) {
  const isDemo = state.user?.email === 'demo@decode.app';
  const labels = {
    overview: 'Overview', journal: 'Trade journal', risk: 'Risk management', analytics: 'Analytics',
    ai: 'AI lab', insights: 'Insights', settings: 'Settings'
  };
  let crumb = labels[route.name] || 'Overview';
  if (route.name === 'journal' && route.id) {
    const trade = state.trades.find((t) => t.id === route.id);
    crumb = trade ? formatPair(trade.pair) : 'Trade detail';
  }
  return `<div class="topbar-crumb"><span>Workspace</span><span class="slash">/</span><strong>${esc(crumb)}</strong></div>
    ${isDemo ? '<span class="demo-pill">DEMO</span>' : ''}
    <div class="topbar-spacer"></div>
    <span class="topbar-date">${new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()}</span>
    <span class="topbar-divider"></span>
    <button class="btn btn-primary" data-action="add-trade">${icon('plus', 14)}<span>New trade</span></button>`;
}

export function renderRoute(route) {
  switch (route.name) {
    case 'journal':
      return route.id ? renderTradeDetail(route.id) : renderJournal();
    case 'risk': return renderRisk();
    case 'analytics': return renderAnalytics();
    case 'ai': return renderAILab();
    case 'insights': return renderInsights();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}

function pageHead({ eyebrow, title, sub, actions = '', badge = '' }) {
  return `<div class="page-head">
    <div>
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <h1 class="page-title">${title}</h1>
      ${sub ? `<p class="page-sub">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="page-actions">${badge}${actions}</div>` : ''}
  </div>`;
}

function metricCard({ label, value, foot, iconName, spark, delta, deltaTone = 'up', extra = '' }) {
  return `<div class="panel metric-card">
    <div class="metric-top"><span class="metric-label">${esc(label)}</span><span class="metric-icon">${icon(iconName, 13)}</span></div>
    <div class="metric-value">${value}</div>
    <div class="metric-bottom">
      <div class="metric-foot">${delta ? `<span class="delta ${deltaTone}">${icon(deltaTone === 'down' ? 'arrowDownRight' : 'arrowUpRight', 10)}${delta}</span>` : ''}<span>${foot}</span></div>
      ${spark || ''}
    </div>
    ${extra}
  </div>`;
}

function rangeCurve(curve) {
  if (!curve?.length) return curve;
  if (state.chartRange === 'ALL') return curve;
  const days = state.chartRange === '1M' ? 30 : 90;
  const cutoff = Date.now() - days * 86400000;
  const filtered = curve.filter((point) => new Date(point.date).getTime() >= cutoff);
  if (filtered.length < 2) return curve.slice(-Math.min(curve.length, state.chartRange === '1M' ? 10 : 24));
  return filtered;
}

export function renderDashboard() {
  const d = state.dashboard;
  const trades = state.trades;
  const bestPair = d.bestPair;
  const strategies = d.strategies || [];
  const v1 = strategies.find((s) => s.version === 'V1') || {};
  const v2 = strategies.find((s) => s.version === 'V2') || {};
  const lastPnl = trades.slice(0, 12).reverse().map((t) => t.actual_rr || 0);
  const cumulative = [];
  let running = 0;
  lastPnl.forEach((value) => { running += value; cumulative.push(running); });
  const pairRows = [...(d.pairs || [])].sort((a, b) => b.totalR - a.totalR).slice(0, 5);
  const maxPair = Math.max(1, ...pairRows.map((p) => Math.abs(p.totalR)));
  const recent = trades.slice(0, 5);
  const topInsight = state.insights[0];
  const analyzed = trades.filter((t) => t.ai_status === 'complete').length;
  const curve = rangeCurve(d.curve);
  const isEmpty = trades.length === 0;

  return `<div class="fade-up">
    ${pageHead({
      eyebrow: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()),
      title: `${greeting()}, <em>${esc((state.user?.name || 'Trader').split(' ')[0])}.</em>`,
      sub: isEmpty
        ? 'Your edge, decoded. Start by logging a trade and uploading the annotated chart behind it.'
        : `${d.totalTrades} closed trades across ${d.pairs?.length || 0} pairs. Your journal is up ${fmtPct(d.returnPct)} from the starting balance.`,
      actions: `<button class="btn" data-action="export">${icon('download', 14)}Export</button><button class="btn btn-primary" data-action="add-trade">${icon('plus', 14)}New trade</button>`
    })}
    <div class="metric-grid">
      ${metricCard({
        label: 'Net profit / loss', iconName: 'dollar',
        value: `<span class="${d.netPnl >= 0 ? 'text-green' : 'text-red'}">${d.netPnl >= 0 ? '+' : '−'}${fmtMoney(Math.abs(d.netPnl))}</span>`,
        foot: `<strong>${fmtR(d.totalR)}</strong> total`,
        delta: `${d.returnPct >= 0 ? '+' : ''}${fmtPct(d.returnPct)}`,
        deltaTone: d.returnPct >= 0 ? 'up' : 'down',
        spark: sparkline(cumulative.length ? cumulative : [0, 0], d.netPnl >= 0 ? 'var(--accent)' : 'var(--red)')
      })}
      ${metricCard({
        label: 'Win rate', iconName: 'target',
        value: `${fmtNum(d.winRate, 1)}<small>%</small>`,
        foot: `<strong>${d.wins}W</strong> · ${d.losses}L${d.breakeven ? ` · ${d.breakeven}BE` : ''}`,
        delta: `${d.totalTrades} closed`,
        deltaTone: 'neutral',
        spark: `<span style="display:flex;align-items:center;gap:5px"><span style="font-size:9px;color:var(--dim)">WR</span>${ring(d.winRate, 30, 3)}</span>`
      })}
      ${metricCard({
        label: 'Average R', iconName: 'trendingUp',
        value: `<span class="${d.avgR >= 0 ? 'text-green' : 'text-red'}">${d.avgR > 0 ? '+' : ''}${fmtNum(d.avgR, 2)}<small>R</small></span>`,
        foot: `<strong>PF ${d.profitFactor === null ? '∞' : fmtNum(d.profitFactor, 2)}</strong> · expectancy ${fmtNum(d.expectancy, 2)}R`,
        delta: d.expectancy >= 0 ? 'positive edge' : 'negative edge',
        deltaTone: d.expectancy >= 0 ? 'up' : 'down',
        spark: sparkline(trades.slice(0, 10).reverse().map((t) => t.actual_rr || 0), 'var(--green)')
      })}
      ${metricCard({
        label: 'Total trades', iconName: 'layers',
        value: `${d.totalTrades}`,
        foot: bestPair ? `<strong>${formatPair(bestPair.pair)}</strong> best pair` : 'No trades logged',
        delta: analyzed ? `${analyzed} AI reviewed` : 'Charts pending',
        deltaTone: analyzed ? 'up' : 'neutral',
        spark: `<span style="font-size:9px;color:var(--dim);text-align:right">${d.pairs?.length || 0} pairs<br><span style="color:var(--text-soft)">${d.startingBalance ? fmtMoney(d.balance) : '—'}</span></span>`
      })}
    </div>

    <div class="dash-main">
      <section class="panel equity-panel">
        <div class="panel-head">
          <div><div class="section-title">Equity curve</div><div class="section-sub">Account growth from closed trades · ${curve.length > 1 ? curve.length - 1 : 0} outcomes</div></div>
          <div class="chart-range">
            ${['1M', '3M', 'ALL'].map((range) => `<button class="${state.chartRange === range ? 'active' : ''}" data-action="chart-range" data-range="${range}">${range}</button>`).join('')}
          </div>
        </div>
        <div class="equity-chart" id="equity-chart-wrap">
          ${equityChart(curve)}
          <div class="chart-tooltip" id="equity-tip"></div>
        </div>
        <div class="equity-footer">
          <span class="legend"><span class="legend-dot"></span>Equity</span>
          <span class="divider"></span>
          <span class="small-stat">Net <strong class="${d.netPnl >= 0 ? 'text-green' : 'text-red'}">${d.netPnl >= 0 ? '+' : '−'}${fmtMoney(Math.abs(d.netPnl))}</strong></span>
          <span class="small-stat">Max DD <strong class="text-red">${fmtPct(d.maxDrawdown)}</strong></span>
          <span class="small-stat">Balance <strong>${fmtMoney(d.balance)}</strong></span>
          <span class="spacer"></span>
          <span class="small-stat">Start <strong>${fmtMoney(d.startingBalance)}</strong></span>
        </div>
      </section>

      <section class="panel strategy-panel">
        <div class="panel-head">
          <div><div class="section-title">Strategy performance</div><div class="section-sub">V1 vs V2 · actual outcomes</div></div>
          <a class="panel-link" href="#/analytics">Compare ${icon('arrowUpRight', 12)}</a>
        </div>
        <div class="strategy-stack">
          <div class="strategy-row">
            <span class="strategy-badge v1">V1</span>
            <div><div class="strategy-name">Primary strategy</div><div class="strategy-detail">${v1.trades || 0} trades · ${v1.wins || 0} wins</div></div>
            <div class="strategy-stats"><div class="strategy-r ${Number(v1.totalR) >= 0 ? 'text-green' : 'text-red'}">${v1.totalR > 0 ? '+' : ''}${fmtNum(v1.totalR || 0, 1)}R</div><div class="strategy-wr">${fmtPct(v1.winRate || 0)} win rate</div></div>
          </div>
          <div class="strategy-row">
            <span class="strategy-badge v2">V2</span>
            <div><div class="strategy-name">CHoCH confirmation</div><div class="strategy-detail">${v2.trades || 0} trades · ${v2.chochUsed || 0} CHoCH used</div></div>
            <div class="strategy-stats"><div class="strategy-r ${Number(v2.totalR) >= 0 ? 'text-green' : 'text-red'}">${v2.totalR > 0 ? '+' : ''}${fmtNum(v2.totalR || 0, 1)}R</div><div class="strategy-wr">${fmtPct(v2.winRate || 0)} win rate</div></div>
          </div>
        </div>
        <div class="strategy-foot">
          <span>Avg R · <strong>${fmtNum(v1.avgR || 0, 2)}R</strong> V1 / <strong>${fmtNum(v2.avgR || 0, 2)}R</strong> V2</span>
          ${state.analytics?.choch?.lift !== null && state.analytics?.choch?.lift !== undefined
            ? `<span class="choch-lift">${icon(state.analytics.choch.lift >= 0 ? 'trendingUp' : 'trendingDown', 11)}${state.analytics.choch.lift > 0 ? '+' : ''}${fmtNum(state.analytics.choch.lift, 2)}R CHoCH lift</span>`
            : '<span class="text-dim" style="font-size:9px">CHoCH sample building</span>'}
        </div>
      </section>
    </div>

    <div class="dash-lower">
      <section class="panel">
        <div class="panel-head">
          <div><div class="section-title">Pair performance</div><div class="section-sub">Ranked by total R saved in your journal</div></div>
          <a class="panel-link" href="#/analytics">All pairs ${icon('arrowUpRight', 12)}</a>
        </div>
        <div class="pairs-list">
          ${pairRows.length ? pairRows.map((pair) => `<div class="pair-row">
            <div class="pair-name"><span class="pair-dot ${pair.totalR < 0 ? 'neg' : ''}"></span>${formatPair(pair.pair)}</div>
            <div class="pair-bar ${pair.totalR < 0 ? 'neg' : ''}"><span style="width:${Math.max(4, Math.abs(pair.totalR) / maxPair * 100)}%"></span></div>
            <div class="pair-trades">${pair.trades} trades</div>
            <div class="pair-r ${pair.totalR >= 0 ? 'text-green' : 'text-red'}">${pair.totalR > 0 ? '+' : ''}${fmtNum(pair.totalR, 1)}R</div>
          </div>`).join('') : `<div class="empty-state" style="padding:32px 20px"><div class="empty-text" style="margin:0">Pair performance appears after your first closed trade.</div></div>`}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div><div class="section-title">Recent trades</div><div class="section-sub">Latest saved outcomes</div></div>
          <a class="panel-link" href="#/journal">Journal ${icon('arrowUpRight', 12)}</a>
        </div>
        <div class="recent-list">
          ${recent.length ? recent.map((trade) => `<div class="recent-row" data-action="open-trade" data-id="${trade.id}">
            <span class="recent-dir ${trade.direction === 'BUY' ? 'buy' : 'sell'}">${icon(trade.direction === 'BUY' ? 'arrowUpRight' : 'arrowDownRight', 12)}</span>
            <div><div class="recent-pair">${formatPair(trade.pair)} <span class="badge ${trade.strategy_version === 'V1' ? 'v1' : 'v2'}" style="margin-left:3px">${trade.strategy_version}</span></div><div class="recent-meta">${fmtDate(trade.trade_date)} · ${trade.result === 'BREAKEVEN' ? 'Breakeven' : trade.result.toLowerCase()} · ${trade.charts?.length || 0} chart${trade.charts?.length === 1 ? '' : 's'}</div></div>
            <div class="recent-r ${trade.actual_rr > 0 ? 'pos' : trade.actual_rr < 0 ? 'neg' : ''}">${fmtR(trade.actual_rr)}</div>
            <div class="recent-time">${fmtTimeAgo(trade.trade_date)}</div>
          </div>`).join('') : `<div class="empty-state" style="padding:32px 20px"><div class="empty-text" style="margin:0 0 12px">Your latest setups will appear here.</div><button class="btn btn-sm" data-action="add-trade">${icon('plus', 12)}Log first trade</button></div>`}
        </div>
      </section>
    </div>

    <div class="ai-banner">
      <span class="ai-orb">${icon('sparkles', 17)}</span>
      <div class="ai-banner-text">
        <div class="ai-banner-label">Decode intelligence</div>
        <div class="ai-banner-title">${topInsight ? esc(topInsight.title) : 'Upload annotated charts to unlock AI review'}</div>
        <div class="ai-banner-desc">${topInsight ? esc(topInsight.body) : 'The vision model audits Order Blocks, taps, FVGs and entry quality against your V1/V2 rules.'}</div>
      </div>
      <a class="btn" href="${analyzed ? '#/insights' : '#/ai'}">${analyzed ? 'Open insights' : 'Open AI lab'} ${icon('arrowRight', 13)}</a>
    </div>
  </div>`;
}

export function renderJournal() {
  const all = state.trades;
  const trades = filteredTrades();
  const pairs = [...new Set(all.map((t) => t.pair))].sort();
  const filters = state.journalFilters;
  return `<div class="fade-up">
    ${pageHead({
      eyebrow: 'Trade journal',
      title: 'Every setup, <em>accounted for.</em>',
      sub: `${all.length} saved trade${all.length === 1 ? '' : 's'} · ${all.reduce((sum, t) => sum + (t.charts?.length || 0), 0)} annotated charts preserved.`,
      actions: `<button class="btn" data-action="export">${icon('download', 14)}Export</button><button class="btn btn-primary" data-action="add-trade">${icon('plus', 14)}New trade</button>`
    })}
    <div class="filters">
      <div class="search-wrap">${icon('search', 14)}<input class="search-input" id="journal-search" placeholder="Search pair, notes, news event…" value="${esc(filters.search)}" autocomplete="off"></div>
      <select class="select-sm" id="filter-result">
        <option value="all" ${filters.result === 'all' ? 'selected' : ''}>All results</option>
        <option value="WIN" ${filters.result === 'WIN' ? 'selected' : ''}>Wins</option>
        <option value="LOSS" ${filters.result === 'LOSS' ? 'selected' : ''}>Losses</option>
        <option value="BREAKEVEN" ${filters.result === 'BREAKEVEN' ? 'selected' : ''}>Breakeven</option>
      </select>
      <select class="select-sm" id="filter-strategy">
        <option value="all" ${filters.strategy === 'all' ? 'selected' : ''}>V1 + V2</option>
        <option value="V1" ${filters.strategy === 'V1' ? 'selected' : ''}>V1 only</option>
        <option value="V2" ${filters.strategy === 'V2' ? 'selected' : ''}>V2 only</option>
      </select>
      <select class="select-sm" id="filter-pair">
        <option value="all" ${filters.pair === 'all' ? 'selected' : ''}>All pairs</option>
        ${pairs.map((pair) => `<option value="${esc(pair)}" ${filters.pair === pair ? 'selected' : ''}>${formatPair(pair)}</option>`).join('')}
      </select>
      <span class="filter-count" id="filter-count">${trades.length} of ${all.length}</span>
    </div>
    <div id="journal-results">${renderJournalResults(trades)}</div>
  </div>`;
}

export function renderJournalResults(trades) {
  if (!state.trades.length) {
    return `<div class="panel journal-panel"><div class="empty-state">
      <div class="empty-icon">${icon('book', 21)}</div>
      <div class="empty-title">Your journal is empty</div>
      <div class="empty-text">Log a trade, record the V1/V2 checklist and attach your annotated chart screenshots. Decode will calculate every statistic from those saved outcomes.</div>
      <div class="empty-steps"><span class="empty-step"><strong>01</strong> Log setup</span><span class="empty-step"><strong>02</strong> Upload charts</span><span class="empty-step"><strong>03</strong> Review with AI</span></div>
      <button class="btn btn-primary" data-action="add-trade">${icon('plus', 14)}Log your first trade</button>
    </div></div>`;
  }
  if (!trades.length) {
    return `<div class="panel journal-panel"><div class="empty-state">
      <div class="empty-icon">${icon('filter', 21)}</div>
      <div class="empty-title">No trades match those filters</div>
      <div class="empty-text">Adjust the result, strategy or pair filter to see more of your journal.</div>
      <button class="btn btn-sm" data-action="clear-filters">Clear filters</button>
    </div></div>`;
  }
  return `<div class="panel journal-panel">
    <div class="table-wrap">
      <table class="trade-table">
        <thead><tr><th>Pair</th><th>Date</th><th>Direction</th><th>Strategy</th><th>Setup</th><th>Entry / SL / TP</th><th>Actual R</th><th>Result</th><th>Charts</th><th>AI</th></tr></thead>
        <tbody>
          ${trades.map((trade) => `<tr data-action="open-trade" data-id="${trade.id}">
            <td><div class="trade-pair">${formatPair(trade.pair)}${trade.news ? ' <span class="badge news">NEWS</span>' : ''}<small>${trade.trend === 'UPTREND' ? 'Uptrend' : 'Downtrend'} · ${fmtDate(trade.trade_date)}</small></div></td>
            <td class="text-muted nowrap">${fmtDate(trade.trade_date, { year: 'numeric' })}</td>
            <td><span class="badge ${trade.direction === 'BUY' ? 'buy' : 'sell'}">${trade.direction}</span></td>
            <td><span class="badge ${trade.strategy_version === 'V1' ? 'v1' : 'v2'}">${trade.strategy_version}${trade.choch_used ? ' · CHoCH' : ''}</span></td>
            <td>${gradeBadge(trade.setup_grade)}</td>
            <td><span class="mono text-muted" style="font-size:9.5px">${fmtPrice(trade.entry)} / ${fmtPrice(trade.sl)} / ${fmtPrice(trade.tp)}</span></td>
            <td><span class="r-value ${trade.actual_rr > 0 ? 'pos' : trade.actual_rr < 0 ? 'neg' : ''}">${fmtR(trade.actual_rr)}</span></td>
            <td>${resultBadge(trade.result)}</td>
            <td><span class="chart-count">${icon('camera', 12)}${trade.charts?.length || 0}</span></td>
            <td><span class="ai-state ${aiStatusClass(trade.ai_status)}"><span class="dot"></span>${aiStatusLabel(trade.ai_status)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="journal-cards">
      ${trades.map((trade) => `<div class="mobile-trade-card" data-action="open-trade" data-id="${trade.id}">
        <div class="mobile-trade-top">
          <span class="badge ${trade.direction === 'BUY' ? 'buy' : 'sell'}">${trade.direction}</span>
          <span class="trade-pair">${formatPair(trade.pair)}</span>
          ${gradeBadge(trade.setup_grade, true)}
          <span class="r-value ${trade.actual_rr > 0 ? 'pos' : trade.actual_rr < 0 ? 'neg' : ''}">${fmtR(trade.actual_rr)}</span>
        </div>
        <div class="mobile-trade-mid">
          <span class="badge ${trade.strategy_version === 'V1' ? 'v1' : 'v2'}">${trade.strategy_version}</span>
          ${resultBadge(trade.result)}
          ${trade.news ? '<span class="badge news">NEWS</span>' : ''}
          <span class="ai-state ${aiStatusClass(trade.ai_status)}"><span class="dot"></span>${aiStatusLabel(trade.ai_status)}</span>
        </div>
        <div class="mobile-trade-bottom"><span>${fmtDateTime(trade.trade_date)}</span><span>${trade.charts?.length || 0} chart${trade.charts?.length === 1 ? '' : 's'}</span></div>
      </div>`).join('')}
    </div>
  </div>`;
}

const OBSERVATION_LABELS = {
  order_block: '1H Order Block', shortened_zone: 'Shortened 50% zone', first_tap: 'First tap',
  fvg: 'FVG', wick_fvg: 'Wick FVG', imbalance: 'Imbalance', second_tap: 'Second tap',
  entry: 'Entry placement', sl: 'Stop loss', tp: 'Take profit', choch_15m: '15M CHoCH (V2)'
};

function statusIcon(status) {
  if (status === 'pass') return icon('check', 9);
  if (status === 'fail') return icon('x', 9);
  return icon('alert', 9);
}

export function renderTradeDetail(id) {
  const trade = state.trades.find((t) => t.id === id);
  if (!trade) {
    return `<div class="panel empty-state"><div class="empty-icon">${icon('alert', 21)}</div><div class="empty-title">Trade not found</div><div class="empty-text">This trade may have been deleted or belongs to another workspace.</div><a class="btn" href="#/journal">Back to journal</a></div>`;
  }
  const rule = ruleEvaluation(trade);
  const analysis = trade.ai_analysis && !trade.ai_analysis.error ? trade.ai_analysis : null;
  const analysisError = trade.ai_analysis?.error;
  const isComplete = trade.ai_status === 'complete' && analysis;
  const charts = trade.charts || [];
  const pnl = tradePnl(trade);
  const setupItems = [
    ['1H Order Block', trade.ob_detected],
    ['Shortened 50% zone', trade.shortened_zone],
    ['First tap', trade.first_tap],
    ['FVG', trade.fvg],
    ['Wick FVG', trade.wick_fvg],
    ['Imbalance candle', trade.imbalance],
    ['Second tap entry', trade.second_tap],
    ['15M CHoCH used', trade.choch_used],
    ['15M CHoCH present', trade.choch_present]
  ];
  return `<div class="fade-up">
    <a class="back-link" href="#/journal">${icon('chevronLeft', 12)}Back to journal</a>
    <div class="detail-head">
      <div>
        <div class="detail-title-row">
          <h1 class="detail-title">${formatPair(trade.pair)}</h1>
          <span class="badge ${trade.direction === 'BUY' ? 'buy' : 'sell'}">${trade.direction}</span>
          <span class="badge ${trade.strategy_version === 'V1' ? 'v1' : 'v2'}">${trade.strategy_version}</span>
          ${resultBadge(trade.result)}
          ${gradeBadge(trade.setup_grade)}
        </div>
        <div class="detail-meta">
          <span>${fmtDateTime(trade.trade_date)}</span><span class="dot-sep"></span>
          <span>${trade.trend === 'UPTREND' ? 'Uptrend' : 'Downtrend'}</span><span class="dot-sep"></span>
          <span>${trade.news ? `News · ${esc(trade.news_event || 'Event trade')}` : 'No news event'}</span><span class="dot-sep"></span>
          <span>${charts.length} original chart${charts.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn" data-action="edit-trade" data-id="${trade.id}">${icon('edit', 13)}Edit</button>
        <button class="btn" data-action="delete-trade" data-id="${trade.id}">${icon('trash', 13)}Delete</button>
        <button class="btn btn-primary" data-action="analyze-trade" data-id="${trade.id}" ${!charts.length || trade.ai_status === 'analyzing' ? 'disabled' : ''}>
          ${trade.ai_status === 'analyzing' ? '<span class="spin"></span>Analyzing' : `${icon('sparkles', 13)}${isComplete ? 'Re-analyze' : 'Analyze charts'}`}
        </button>
      </div>
    </div>

    <div class="detail-layout">
      <div class="detail-col">
        <section class="panel">
          <div class="panel-head">
            <div><div class="section-title">Annotated charts</div><div class="section-sub">Original screenshots are preserved exactly as uploaded</div></div>
            <button class="btn btn-sm" data-action="upload-chart" data-id="${trade.id}">${icon('upload', 12)}Add chart</button>
          </div>
          ${charts.length ? `<div class="chart-gallery">
            ${charts.map((chart, index) => `<div class="chart-thumb" data-action="open-lightbox" data-src="${chartUrl(chart)}" data-label="${esc(chart.original_name || 'Chart ' + (index + 1))}">
              <img src="${chartUrl(chart)}" alt="${esc(chart.original_name || 'Annotated chart')}" loading="lazy">
              <span class="thumb-original">Original</span>
              <span class="thumb-label">Chart ${String(index + 1).padStart(2, '0')}</span>
              <button class="chart-remove" data-action="delete-chart" data-chart-id="${chart.id}" data-id="${trade.id}" title="Remove chart">${icon('trash', 11)}</button>
            </div>`).join('')}
          </div>` : `<div class="upload-empty">
            <div class="empty-icon">${icon('camera', 20)}</div>
            <div class="empty-title" style="font-size:13px">No chart uploaded yet</div>
            <p>Attach one or more annotated screenshots. Decode will read the Order Block, shortened zone, taps, FVG and entry context from the actual image.</p>
            <button class="btn btn-sm btn-primary" data-action="upload-chart" data-id="${trade.id}">${icon('upload', 12)}Upload chart</button>
          </div>`}
        </section>

        <section class="panel">
          <div class="analysis-hero">
            <span class="analysis-orb">${icon('sparkles', 18)}</span>
            <div>
              <div class="analysis-title">AI chart review</div>
              <div class="analysis-sub">${isComplete ? `${esc(analysis.strategy_followed || 'Uncertain')} interpretation · ${esc(trade.ai_model || state.ai?.model || 'vision model')}` : trade.ai_status === 'analyzing' ? 'Reading your uploaded screenshots…' : 'Evidence-based review of your uploaded charts'}</div>
            </div>
            ${isComplete ? `<div class="analysis-grade">${gradeBadge(analysis.setup_grade)}<small>AI grade</small></div>` : ''}
          </div>
          <div class="analysis-body">
            ${isComplete ? renderAIAnalysis(analysis, trade) : trade.ai_status === 'analyzing' ? `<div class="ai-offline" style="border-color:rgba(217,255,87,.14);background:rgba(217,255,87,.03)">
              <span style="width:17px;height:17px;border:2px solid var(--accent);border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite;flex:none"></span>
              <p><strong>Analyzing actual chart images</strong>The local vision model is inspecting your screenshots against the V1/V2 checklist. Smaller models finish in seconds; large CPU-only models can take several minutes. You can leave this page — the result is saved to the trade.</p>
            </div>` : trade.ai_status === 'failed' ? `<div class="ai-offline">
              ${icon('alert', 17)}
              <p><strong>Chart review could not complete</strong>${esc(analysisError || 'The local vision model did not return a usable response.')} Check the AI engine in Settings, then retry. Manual corrections are always available.</p>
            </div>` : `<div class="ai-offline">
              ${icon('sparkles', 17)}
              <p><strong>Ready for an evidence-based review</strong>Upload at least one annotated chart, then run analysis. The AI is instructed to mark anything it cannot see as uncertain and never invent chart details.</p>
            </div>`}
            <div class="analysis-actions">
              ${isComplete ? `<button class="btn btn-sm" data-action="manual-correction" data-id="${trade.id}">${icon('edit', 12)}Correct interpretation</button>` : ''}
              <button class="btn btn-sm ${!charts.length ? '' : 'btn-primary'}" data-action="analyze-trade" data-id="${trade.id}" ${!charts.length || trade.ai_status === 'analyzing' ? 'disabled' : ''}>${icon('refresh', 12)}${isComplete ? 'Re-run' : 'Run review'}</button>
              <span class="small-note" style="margin-left:auto;align-self:center">${charts.length ? `${charts.length} source image${charts.length === 1 ? '' : 's'}` : 'No source images'}</span>
            </div>
            ${trade.manual_corrections ? `<div class="modal-note" style="margin-top:12px">${icon('edit', 12)}<div><strong>Manual correction saved</strong>${trade.manual_corrections.note ? ` — ${esc(trade.manual_corrections.note)}` : ''}<div style="color:var(--dim);margin-top:2px">${trade.manual_corrections.corrected_at ? `${fmtDateTime(trade.manual_corrections.corrected_at)} · ` : ''}The recorded setup below is the source of truth.</div></div></div>` : ''}
          </div>
        </section>
      </div>

      <div class="detail-col">
        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Execution</div><div class="section-sub">Saved trade parameters</div></div>${resultBadge(trade.result)}</div>
          <div class="panel-body" style="padding-top:14px">
            <div class="detail-stats">
              <div class="detail-stat"><div class="detail-stat-label">Entry</div><div class="detail-stat-value">${fmtPrice(trade.entry)}</div></div>
              <div class="detail-stat"><div class="detail-stat-label">Actual R</div><div class="detail-stat-value ${trade.actual_rr > 0 ? 'pos' : trade.actual_rr < 0 ? 'neg' : ''}">${fmtR(trade.actual_rr)}</div></div>
              <div class="detail-stat"><div class="detail-stat-label">Stop loss</div><div class="detail-stat-value">${fmtPrice(trade.sl)}</div></div>
              <div class="detail-stat"><div class="detail-stat-label">Planned RR</div><div class="detail-stat-value">${fmtNum(trade.planned_rr, 1)}:1</div></div>
              <div class="detail-stat"><div class="detail-stat-label">Take profit</div><div class="detail-stat-value">${fmtPrice(trade.tp)}</div></div>
              <div class="detail-stat"><div class="detail-stat-label">P&amp;L</div><div class="detail-stat-value ${pnl >= 0 ? 'pos' : 'neg'}">${pnl >= 0 ? '+' : '−'}${fmtMoney(Math.abs(pnl))}</div></div>
              <div class="detail-stat"><div class="detail-stat-label">Lot size</div><div class="detail-stat-value">${fmtNum(trade.lot_size, 2)}</div></div>
              <div class="detail-stat"><div class="detail-stat-label">Risk</div><div class="detail-stat-value">${fmtPct(trade.risk_percent)} · ${fmtMoney(trade.risk_amount)}</div></div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Recorded setup</div><div class="section-sub">Your V1/V2 checklist</div></div>${gradeBadge(rule.grade)}</div>
          <div class="checklist-mini">
            ${setupItems.map(([label, value]) => `<div class="checklist-mini-row ${value ? 'yes' : 'no'}"><span class="mini-dot"></span>${label}<span style="margin-left:auto;font-size:8px;color:var(--dim)">${value ? 'Yes' : '—'}</span></div>`).join('')}
          </div>
          <div style="padding:0 18px 17px"><div class="modal-note">${icon('info', 12)}The grade shown here is the rules-engine check on recorded fields. The AI grade is based only on visible evidence in the uploaded charts.</div></div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Risk &amp; context</div><div class="section-sub">Position and event context</div></div></div>
          <div class="panel-body" style="padding-top:13px">
            <div class="risk-strip">
              <div><div class="k">Risk %</div><div class="v">${fmtPct(trade.risk_percent)}</div></div>
              <div><div class="k">Risk $</div><div class="v">${fmtMoney(trade.risk_amount)}</div></div>
              <div><div class="k">News</div><div class="v" style="color:${trade.news ? 'var(--blue)' : 'var(--muted)'}">${trade.news ? 'Yes' : 'No'}</div></div>
            </div>
            ${trade.news ? `<div class="modal-note" style="margin-top:10px">${icon('news', 12)}${esc(trade.news_event || 'News-time trade')}</div>` : ''}
            <div style="margin-top:14px">
              <div class="eyebrow" style="margin-bottom:6px">Notes</div>
              <div class="notes-box" style="padding:0;color:var(--muted)">${trade.notes ? esc(trade.notes) : 'No notes saved for this trade.'}</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Rules engine</div><div class="section-sub">Deterministic check · no image assumptions</div></div><span class="badge ${rule.grade === 'A+' ? 'win' : rule.grade === 'C' ? 'loss' : 'neutral'}">${rule.grade}</span></div>
          <div class="checklist-mini">
            ${rule.items.map((item) => `<div class="checklist-mini-row ${item.status === 'pass' ? 'yes' : 'no'}" title="${esc(item.note)}">
              <span class="mini-dot" style="background:${item.status === 'pass' ? 'var(--green)' : item.status === 'fail' ? 'var(--red)' : 'var(--amber)'}"></span>${esc(item.label)}
              <span style="margin-left:auto;font-size:8px;color:var(--dim);text-transform:uppercase">${item.status}</span>
            </div>`).join('')}
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

function renderAIAnalysis(analysis, trade) {
  const observations = analysis.observations || {};
  const observationRows = Object.entries(OBSERVATION_LABELS).map(([key, label]) => {
    const value = observations[key] || { status: 'uncertain', note: '' };
    return `<div class="check-row">
      <span class="check-icon ${value.status}">${statusIcon(value.status)}</span>
      <div><div class="check-label">${label}</div>${value.note ? `<div class="check-note">${esc(value.note)}</div>` : ''}</div>
    </div>`;
  }).join('');
  const flags = [
    ...(analysis.missing_confirmations || []).map((item) => ({ type: 'missing', text: item })),
    ...(analysis.incorrect_entries || []).map((item) => ({ type: 'incorrect', text: item })),
    ...(analysis.mistakes || []).map((item) => ({ type: 'mistake', text: item }))
  ];
  const confidence = Math.round(Number(analysis.confidence || 0) * 100);
  return `<div class="analysis-summary">${esc(analysis.summary || 'The model returned a structured review without a written summary.')}</div>
    <div class="confidence-row"><span class="confidence-label">Confidence</span><span class="confidence-track"><span style="width:${confidence}%"></span></span><span class="confidence-value">${confidence}%</span></div>
    <div class="checklist">${observationRows}</div>
    ${flags.length ? `<div class="analysis-flags">
      ${flags.map((flag) => `<div class="flag-row ${flag.type === 'missing' ? 'neutral' : ''}">${icon(flag.type === 'missing' ? 'alert' : 'x', 12)}<span>${esc(flag.text)}</span></div>`).join('')}
    </div>` : ''}
    <div class="analysis-flags" style="margin-top:12px">
      <div class="flag-row ${analysis.opposite_trend_entry ? '' : 'neutral'}">${icon(analysis.opposite_trend_entry ? 'alert' : 'check', 12)}<span>${analysis.opposite_trend_entry ? 'The AI identified an opposite-trend entry.' : 'No opposite-trend entry identified by the AI.'}</span></div>
      <div class="flag-row neutral">${icon('info', 12)}<span>AI interpretation can be uncertain. Use manual correction if the chart was misread.</span></div>
    </div>`;
}

export function renderRisk() {
  const d = state.dashboard;
  const s = state.settings;
  const dailyUsage = d.dailyLossLimit ? Math.min(100, d.dailyLoss / d.dailyLossLimit * 100) : 0;
  const drawdownUsage = s.max_drawdown ? Math.min(100, d.currentDrawdown / s.max_drawdown * 100) : 0;
  const heatDays = buildHeatmap();
  const daily = state.analytics?.daily || [];
  const recentDaily = daily.slice(-7).reverse();
  return `<div class="fade-up">
    ${pageHead({
      eyebrow: 'Risk management',
      title: 'Protect the account, <em>then compound.</em>',
      sub: 'Every limit, lot size and drawdown figure is derived from your saved trades and account settings.',
      actions: `<a class="btn" href="#/settings">${icon('settings', 14)}Account settings</a>`
    })}
    <div class="risk-cards">
      <div class="risk-card"><div class="k">Account equity</div><div class="v">${fmtMoney(d.balance)}</div><div class="sub">${d.netPnl >= 0 ? '+' : ''}${fmtMoney(d.netPnl)} from ${fmtMoney(d.startingBalance)} start</div></div>
      <div class="risk-card"><div class="k">Risk per trade</div><div class="v">${fmtPct(s.risk_per_trade)}</div><div class="sub">${fmtMoney(d.balance * s.risk_per_trade / 100)} at current equity</div></div>
      <div class="risk-card"><div class="k">Daily loss</div><div class="v ${d.dailyLoss > 0 ? 'text-red' : ''}">${fmtMoney(d.dailyLoss)}</div><div class="sub">${fmtPct(dailyUsage)} of ${fmtMoney(d.dailyLossLimit)} limit</div><div class="progress ${dailyUsage > 80 ? 'danger' : dailyUsage > 50 ? 'warn' : ''}"><span style="width:${dailyUsage}%"></span></div></div>
      <div class="risk-card"><div class="k">Current drawdown</div><div class="v ${d.currentDrawdown > 0 ? 'text-red' : ''}">${fmtPct(d.currentDrawdown)}</div><div class="sub">Max ${fmtPct(d.maxDrawdown)} · ${fmtPct(drawdownUsage)} of limit</div><div class="progress ${drawdownUsage > 80 ? 'danger' : drawdownUsage > 50 ? 'warn' : ''}"><span style="width:${drawdownUsage}%"></span></div></div>
    </div>

    <div class="risk-layout">
      <div class="stack-12">
        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Risk parameters</div><div class="section-sub">Used by the position calculator and all risk stats</div></div></div>
          <form id="risk-settings-form" class="settings-form">
            <div class="form-grid">
              <div class="field"><label>Starting balance</label><div class="field-suffix"><input name="starting_balance" type="number" min="0" step="1" value="${Number(s.starting_balance)}"><span>USD</span></div></div>
              <div class="field"><label>Risk per trade</label><div class="field-suffix"><input name="risk_per_trade" type="number" min="0.01" max="100" step="0.01" value="${Number(s.risk_per_trade)}"><span>%</span></div></div>
              <div class="field"><label>Daily loss limit</label><div class="field-suffix"><input name="daily_loss_limit" type="number" min="0.1" max="100" step="0.1" value="${Number(s.daily_loss_limit)}"><span>%</span></div><div class="field-hint">Monetary limit updates with equity.</div></div>
              <div class="field"><label>Max drawdown</label><div class="field-suffix"><input name="max_drawdown" type="number" min="0.1" max="100" step="0.1" value="${Number(s.max_drawdown)}"><span>%</span></div><div class="field-hint">Used as the risk guard threshold.</div></div>
            </div>
            <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', 13)}Save parameters</button></div>
          </form>
        </section>

        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Daily P&amp;L heatmap</div><div class="section-sub">Last 42 days of saved outcomes</div></div></div>
          <div class="heatmap">
            ${heatDays.map((day) => `<div class="heat-cell ${day.cls}" data-tip="${esc(day.tip)}"></div>`).join('')}
          </div>
          <div class="heat-legend"><span style="background:rgba(255,127,127,.78)"></span><span style="background:rgba(255,127,127,.3)"></span><span style="background:rgba(255,255,255,.06)"></span><span style="background:rgba(130,232,166,.35)"></span><span style="background:rgba(130,232,166,.8)"></span><span style="margin-left:4px">Loss → profit</span></div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Recent daily results</div><div class="section-sub">Latest trading days in the journal</div></div><a class="panel-link" href="#/analytics">Full breakdown ${icon('arrowUpRight', 12)}</a></div>
          <div class="pairs-list">
            ${recentDaily.length ? recentDaily.map((day) => `<div class="pair-row" style="grid-template-columns:95px 1fr 70px 65px">
              <div class="pair-name">${fmtDate(day.date)}</div>
              <div class="pair-bar ${day.pnl < 0 ? 'neg' : ''}"><span style="width:${Math.min(100, Math.max(3, Math.abs(day.pnl) / Math.max(1, ...recentDaily.map((x) => Math.abs(x.pnl))) * 100))}%"></span></div>
              <div class="pair-trades">${day.trades} trades</div>
              <div class="pair-r ${day.pnl >= 0 ? 'text-green' : 'text-red'}">${day.pnl >= 0 ? '+' : '−'}${fmtMoney(Math.abs(day.pnl))}</div>
            </div>`).join('') : `<div class="empty-state" style="padding:28px 20px"><div class="empty-text" style="margin:0">Daily results will appear after your first closed trade.</div></div>`}
          </div>
        </section>
      </div>

      <div class="stack-12">
        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Position size calculator</div><div class="section-sub">Plan the next entry without guessing</div></div></div>
          <div class="settings-form">
            <div class="form-grid">
              <div class="field"><label>Account balance</label><div class="field-suffix"><input id="calc-balance" type="number" min="0" step="1" value="${Number(d.balance || s.starting_balance)}"><span>USD</span></div></div>
              <div class="field"><label>Risk</label><div class="field-suffix"><input id="calc-risk" type="number" min="0.01" step="0.01" value="${Number(s.risk_per_trade)}"><span>%</span></div></div>
              <div class="field"><label>Stop distance</label><div class="field-suffix"><input id="calc-stop" type="number" min="0.1" step="0.1" value="25"><span>pips</span></div></div>
              <div class="field"><label>Pip value per lot</label><div class="field-suffix"><input id="calc-pip" type="number" min="0.01" step="0.01" value="10"><span>USD</span></div><div class="field-hint">$10 for most USD-quoted FX pairs.</div></div>
            </div>
            <div class="calc-result">
              <div class="calc-result-label">Suggested lot size</div>
              <div class="calc-result-value" id="calc-lot">0.40</div>
              <div class="calc-result-row"><span>Monetary risk</span><strong id="calc-money">$100.00</strong></div>
              <div class="calc-result-row"><span>Stop distance</span><strong id="calc-stop-out">25 pips</strong></div>
            </div>
            <div class="modal-note" style="margin-top:10px">${icon('info', 12)}This calculator is an estimate. Always verify contract size and pip value with your broker.</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Risk guard</div><div class="section-sub">Rules generated from current limits</div></div></div>
          <div class="risk-rules">
            <div class="risk-rule">${icon('check', 13)}<span>Maximum risk per trade is <strong>${fmtPct(s.risk_per_trade)}</strong> (${fmtMoney(d.balance * s.risk_per_trade / 100)}).</span></div>
            <div class="risk-rule">${icon(d.dailyLoss >= d.dailyLossLimit ? 'alert' : 'check', 13)}<span>Daily loss guard is <strong>${fmtMoney(d.dailyLossLimit)}</strong>. ${d.dailyLoss >= d.dailyLossLimit ? 'Limit reached — stand down.' : `${fmtMoney(Math.max(0, d.dailyLossLimit - d.dailyLoss))} remaining today.`}</span></div>
            <div class="risk-rule">${icon(d.currentDrawdown >= s.max_drawdown ? 'alert' : 'check', 13)}<span>Drawdown guard is <strong>${fmtPct(s.max_drawdown)}</strong>. Current drawdown is ${fmtPct(d.currentDrawdown)}.</span></div>
            <div class="risk-rule">${icon('target', 13)}<span>Every V1/V2 entry must have a planned reward of at least <strong>1:4</strong>.</span></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Drawdown profile</div><div class="section-sub">Peak-to-trough from saved equity</div></div></div>
          <div class="equity-chart" style="min-height:170px;padding-top:0">${equityChart(rangeCurve(d.curve))}</div>
        </section>
      </div>
    </div>
  </div>`;
}

function buildHeatmap() {
  const map = {};
  (state.analytics?.daily || []).forEach((day) => { map[day.date] = day; });
  const cells = [];
  const today = new Date();
  for (let i = 41; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const day = map[key];
    let cls = '';
    let tip = `${fmtDate(key)} · no trades`;
    if (day) {
      const magnitude = Math.abs(day.pnl);
      const scale = magnitude > 400 ? 3 : magnitude > 150 ? 2 : 1;
      cls = day.pnl > 0 ? `pos-${scale}` : day.pnl < 0 ? `neg-${scale}` : '';
      tip = `${fmtDate(key)} · ${day.trades} trades · ${day.pnl >= 0 ? '+' : '−'}${fmtMoney(Math.abs(day.pnl))}`;
    }
    cells.push({ cls, tip });
  }
  return cells;
}

export function renderAnalytics() {
  const a = state.analytics;
  const d = state.dashboard;
  if (!state.trades.length) {
    return `<div class="fade-up">${pageHead({ eyebrow: 'Analytics', title: 'Your edge, <em>measured.</em>', sub: 'Statistics only appear when there are saved trades to calculate.' })}
      <div class="panel empty-state"><div class="empty-icon">${icon('chart', 21)}</div><div class="empty-title">No performance data yet</div><div class="empty-text">Log your first V1 or V2 trade. Strategy comparison, pair rankings, news splits and confirmation analysis will build automatically from actual outcomes.</div><button class="btn btn-primary" data-action="add-trade">${icon('plus', 14)}Log first trade</button></div></div>`;
  }
  const v1 = a.strategies.find((s) => s.version === 'V1') || {};
  const v2 = a.strategies.find((s) => s.version === 'V2') || {};
  const bestPair = a.pairs.filter((p) => p.trades >= 2).sort((x, y) => y.totalR - x.totalR)[0];
  const worstPair = a.pairs.filter((p) => p.trades >= 2).sort((x, y) => x.totalR - y.totalR)[0];
  const maxPairR = Math.max(1, ...a.pairs.map((p) => Math.abs(p.totalR)));
  const bestConfirm = a.confirmations.filter((c) => c.trades >= 2).sort((x, y) => y.avgR - x.avgR)[0];
  const maxChoch = Math.max(1, Math.abs(a.choch.used.avgR || 0), Math.abs(a.choch.notUsed.avgR || 0), Math.abs(a.choch.present.avgR || 0), Math.abs(a.choch.absent.avgR || 0));
  const newsPnl = a.news.pnl;
  const noNewsPnl = a.noNews.pnl;
  const bestCombo = a.combos[0];
  const worstCombo = [...a.combos].sort((x, y) => x.avgR - y.avgR)[0];
  return `<div class="fade-up">
    ${pageHead({
      eyebrow: 'Strategy analytics',
      title: 'Compare the edge, <em>not the story.</em>',
      sub: `${a.totals.trades} trades · ${fmtR(a.totals.totalR)} total · every figure is calculated from your saved outcomes.`,
      actions: `<a class="btn" href="#/journal">${icon('book', 14)}Open journal</a>`
    })}
    <div class="analytics-grid">
      <section class="panel span-2">
        <div class="panel-head"><div><div class="section-title">V1 vs V2</div><div class="section-sub">Actual results by strategy version · CHoCH is optional in V2</div></div><span class="badge ${v2.avgR > v1.avgR ? 'v2' : 'v1'}">${v2.avgR > v1.avgR ? 'V2 ahead' : 'V1 ahead'}</span></div>
        <div class="compare-cards">
          ${[['V1', v1, 'Primary strategy', 'v1'], ['V2', v2, 'Optional 15M CHoCH', 'v2']].map(([version, s, subtitle, cls]) => `<div class="compare-card ${cls}">
            <div class="compare-top"><div><div class="compare-title"><span class="strategy-badge ${cls}" style="width:25px;height:25px;border-radius:7px;font-size:8px">${version}</span>${subtitle}</div><div class="compare-sub">${s.trades || 0} trades · ${s.wins || 0}W ${s.losses || 0}L</div></div><span class="badge ${s.avgR >= 0 ? 'win' : 'loss'}">${fmtR(s.avgR || 0)} avg</span></div>
            <div class="compare-metrics">
              <div class="compare-metric"><div class="k">Win rate</div><div class="v">${fmtPct(s.winRate || 0)}</div></div>
              <div class="compare-metric"><div class="k">Total R</div><div class="v ${s.totalR >= 0 ? 'text-green' : 'text-red'}">${s.totalR > 0 ? '+' : ''}${fmtNum(s.totalR || 0, 1)}</div></div>
              <div class="compare-metric"><div class="k">Profit factor</div><div class="v">${s.profitFactor === null ? '∞' : fmtNum(s.profitFactor || 0, 2)}</div></div>
            </div>
            <div class="compare-bar"><span style="width:${Math.min(100, Math.max(3, (s.winRate || 0)))}%"></span></div>
            <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:8.5px;color:var(--dim)"><span>CHoCH used: ${s.chochUsed || 0}</span><span>CHoCH present: ${s.chochPresent || 0}</span></div>
          </div>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><div class="section-title">15M CHoCH impact</div><div class="section-sub">V2 trades only · does optional confirmation improve outcomes?</div></div></div>
        <div class="choch-card">
          <div class="choch-visual">
            ${[['CHoCH used', a.choch.used.avgR || 0], ['No CHoCH', a.choch.notUsed.avgR || 0], ['CHoCH present', a.choch.present.avgR || 0], ['Absent', a.choch.absent.avgR || 0]].map(([label, value]) => `<div class="choch-bar-wrap">
              <div class="choch-bar ${value < 0 ? 'muted' : ''}" style="height:${Math.max(5, Math.abs(value) / maxChoch * 75)}px"></div>
              <div class="choch-bar-label">${label}<br><strong style="color:${value >= 0 ? 'var(--green)' : 'var(--red)'}">${value > 0 ? '+' : ''}${fmtNum(value, 2)}R</strong></div>
            </div>`).join('')}
          </div>
          <div class="choch-summary">${a.choch.lift === null ? 'Both V2 groups need at least one trade before a CHoCH comparison can be made.' : `V2 trades with CHoCH average <strong>${fmtNum(a.choch.used.avgR, 2)}R</strong> versus <strong>${fmtNum(a.choch.notUsed.avgR, 2)}R</strong> without. ${a.choch.lift > 0 ? `The confirmation is adding <strong>${fmtNum(a.choch.lift, 2)}R</strong> per trade in this sample.` : `The confirmation is currently <strong>${fmtNum(Math.abs(a.choch.lift), 2)}R</strong> behind the unconfirmed sample.`}${a.choch.used.trades < 5 || a.choch.notUsed.trades < 5 ? ' One comparison group has fewer than five trades, so treat this as directional.' : ''}`}</div>
          <div class="choch-kpis">
            <div class="choch-kpi"><div class="k">Used</div><div class="v">${a.choch.used.trades}</div></div>
            <div class="choch-kpi"><div class="k">Without</div><div class="v">${a.choch.notUsed.trades}</div></div>
            <div class="choch-kpi"><div class="k">Present</div><div class="v">${a.choch.present.trades}</div></div>
            <div class="choch-kpi"><div class="k">Present WR</div><div class="v">${fmtPct(a.choch.present.winRate)}</div></div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><div class="section-title">News vs non-news</div><div class="section-sub">Performance split by event-time exposure</div></div></div>
        <div class="news-compare">
          <div class="news-card highlight"><div class="news-card-label">${icon('news', 12)}News-time trades</div><div class="big ${newsPnl >= 0 ? 'text-green' : 'text-red'}">${newsPnl >= 0 ? '+' : '−'}${fmtMoney(Math.abs(newsPnl))}</div><div class="sub">${a.news.trades} trades · ${fmtPct(a.news.winRate)} win rate</div><div class="row"><span>Avg R</span><strong>${fmtR(a.news.avgR)}</strong></div><div class="row"><span>Total R</span><strong>${fmtR(a.news.totalR)}</strong></div></div>
          <div class="news-card"><div class="news-card-label">${icon('clock', 12)}Non-news trades</div><div class="big ${noNewsPnl >= 0 ? 'text-green' : 'text-red'}">${noNewsPnl >= 0 ? '+' : '−'}${fmtMoney(Math.abs(noNewsPnl))}</div><div class="sub">${a.noNews.trades} trades · ${fmtPct(a.noNews.winRate)} win rate</div><div class="row"><span>Avg R</span><strong>${fmtR(a.noNews.avgR)}</strong></div><div class="row"><span>Total R</span><strong>${fmtR(a.noNews.totalR)}</strong></div></div>
        </div>
      </section>

      <section class="panel span-2">
        <div class="panel-head"><div><div class="section-title">Pair analytics</div><div class="section-sub">Ranked by total R · minimum 1 trade</div></div><span class="small-note">Best ${bestPair ? formatPair(bestPair.pair) : '—'} · Worst ${worstPair ? formatPair(worstPair.pair) : '—'}</span></div>
        <div style="overflow-x:auto">
          <table class="pair-table">
            <thead><tr><th>#</th><th>Pair</th><th>Trades</th><th>Win rate</th><th>Avg R</th><th>Total R</th><th class="bar-cell">Relative edge</th></tr></thead>
            <tbody>
              ${a.pairs.map((pair, index) => `<tr>
                <td class="pair-rank ${index === 0 ? 'top' : ''}">${String(index + 1).padStart(2, '0')}</td>
                <td><div class="pair-name"><span class="pair-dot ${pair.totalR < 0 ? 'neg' : ''}"></span>${formatPair(pair.pair)}</div></td>
                <td class="text-muted">${pair.trades}</td>
                <td>${fmtPct(pair.winRate)}</td>
                <td class="${pair.avgR >= 0 ? 'text-green' : 'text-red'}">${fmtR(pair.avgR)}</td>
                <td class="${pair.totalR >= 0 ? 'text-green' : 'text-red'}">${fmtR(pair.totalR)}</td>
                <td class="bar-cell"><div class="mini-bar ${pair.totalR < 0 ? 'neg' : ''}"><span style="width:${Math.max(4, Math.abs(pair.totalR) / maxPairR * 100)}%"></span></div></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><div class="section-title">Confirmation performance</div><div class="section-sub">Which trigger is actually working?</div></div>${bestConfirm ? `<span class="badge win">${bestConfirm.label}</span>` : ''}</div>
        <div class="confirm-list">
          ${a.confirmations.map((c) => `<div class="confirm-row">
            <div class="confirm-name">${c.label}</div>
            <div class="confirm-track"><span style="width:${Math.min(100, Math.max(2, c.winRate))}%"></span></div>
            <div class="confirm-wr">${fmtPct(c.winRate)}</div>
            <div class="confirm-r ${c.avgR >= 0 ? 'text-green' : 'text-red'}">${fmtR(c.avgR)}</div>
          </div>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><div class="section-title">Setup quality</div><div class="section-sub">Outcomes by AI / manual grade</div></div></div>
        <div class="grades-row">
          ${a.grades.map((g) => `<div class="grade-card">${gradeBadge(g.grade)}<div class="g-trades">${g.trades} trades</div><div class="g-wr ${g.winRate >= 50 ? 'text-green' : 'text-red'}">${fmtPct(g.winRate)}</div><div class="g-r">${fmtR(g.avgR)} avg</div></div>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><div class="section-title">Trend &amp; direction</div><div class="section-sub">Where the R is being made</div></div></div>
        <div class="confirm-list">
          ${[...a.trend.map((t) => ({ ...t, label: t.trend === 'UPTREND' ? 'Uptrend' : 'Downtrend' })), ...a.direction.map((t) => ({ ...t, label: t.direction === 'BUY' ? 'Buy direction' : 'Sell direction' }))].map((t) => `<div class="confirm-row">
            <div class="confirm-name">${t.label}</div>
            <div class="confirm-track"><span style="width:${Math.min(100, Math.max(2, t.winRate))}%"></span></div>
            <div class="confirm-wr">${fmtPct(t.winRate)}</div>
            <div class="confirm-r ${t.avgR >= 0 ? 'text-green' : 'text-red'}">${fmtR(t.avgR)}</div>
          </div>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><div class="section-title">Strongest combinations</div><div class="section-sub">Minimum 2 trades per combination</div></div></div>
        <div class="combo-list">
          ${a.combos.length ? a.combos.slice(0, 5).map((combo, index) => `<div class="combo-row">
            <span class="pair-rank ${index === 0 ? 'top' : ''}">${String(index + 1).padStart(2, '0')}</span>
            <div><div class="combo-name">${esc(combo.label)}</div><div class="combo-meta">${combo.trades} trades · ${fmtPct(combo.winRate)} win rate</div></div>
            <div class="combo-r ${combo.avgR < 0 ? 'neg' : ''}">${fmtR(combo.avgR)} avg</div>
          </div>`).join('') : `<div class="small-note" style="padding:6px 0">Not enough repeated condition sets yet.</div>`}
        </div>
      </section>
    </div>
    <div class="ai-banner" style="margin-top:12px">
      <span class="ai-orb">${icon('bulb', 17)}</span>
      <div class="ai-banner-text"><div class="ai-banner-label">Evidence note</div><div class="ai-banner-title">Every number above is computed from ${a.totals.trades} saved trades.</div><div class="ai-banner-desc">Small samples are directional, not proof. Use AI chart reviews and manual corrections to keep the underlying data honest.</div></div>
      <a class="btn" href="#/insights">Open insights ${icon('arrowRight', 13)}</a>
    </div>
  </div>`;
}

export function renderAILab() {
  const ai = state.ai || {};
  const trades = [...state.trades].sort((a, b) => {
    const rank = { analyzing: 0, complete: 1, failed: 2, pending: 3 };
    return (rank[a.ai_status] ?? 4) - (rank[b.ai_status] ?? 4) || new Date(b.trade_date) - new Date(a.trade_date);
  });
  const filtered = trades.filter((trade) => {
    if (state.aiFilter === 'reviewed') return trade.ai_status === 'complete';
    if (state.aiFilter === 'pending') return trade.ai_status !== 'complete';
    return true;
  });
  const analyzed = state.trades.filter((t) => t.ai_status === 'complete');
  const visionModels = (ai.models || []).filter((model) => model.vision);
  const avgConfidence = analyzed.length
    ? Math.round(analyzed.reduce((sum, t) => sum + Number(t.ai_analysis?.confidence || 0), 0) / analyzed.length * 100)
    : 0;
  return `<div class="fade-up">
    ${pageHead({
      eyebrow: 'AI chart analysis',
      title: 'See what the chart <em>actually shows.</em>',
      sub: 'The vision model reviews your original screenshots against the exact V1/V2 rules. Uncertain observations are marked, and you can correct any interpretation.',
      actions: `<button class="btn" data-action="refresh-ai">${icon('refresh', 14)}Refresh engine</button><a class="btn btn-primary" href="#/settings">${icon('settings', 14)}AI settings</a>`
    })}
    <div class="ai-status-card">
      <span class="ai-status-orb">${icon('sparkles', 16)}</span>
      <div><div class="ai-status-title">Local vision engine</div><div class="ai-status-sub">${ai.online ? `${esc(ai.model || state.settings?.ai_model)} · running locally · ${visionModels.length} vision model${visionModels.length === 1 ? '' : 's'} available` : 'Ollama is not reachable. Start the local engine to analyze uploaded charts.'}</div></div>
      <span class="ai-status-badge ${ai.online ? 'online' : 'offline'}"><span class="dot"></span>${ai.online ? 'Online' : 'Offline'}</span>
    </div>
    <div class="ai-summary-row">
      <div class="panel ai-summary"><div class="k">Charts reviewed</div><div class="v">${analyzed.length}</div><div class="s">of ${state.trades.length} saved trades</div></div>
      <div class="panel ai-summary"><div class="k">Average confidence</div><div class="v">${avgConfidence}%</div><div class="s">across completed reviews</div></div>
      <div class="panel ai-summary"><div class="k">Awaiting review</div><div class="v">${state.trades.filter((t) => t.ai_status !== 'complete').length}</div><div class="s">upload charts to unlock</div></div>
    </div>
    <div class="filters" style="margin-bottom:12px">
      <div class="segmented">
        ${[['all', 'All trades'], ['reviewed', 'Reviewed'], ['pending', 'Pending']].map(([value, label]) => `<button class="${state.aiFilter === value ? 'active' : ''}" data-action="ai-filter" data-filter="${value}">${label}</button>`).join('')}
      </div>
      <span class="spacer"></span>
      <span class="small-note">${filtered.length} shown</span>
    </div>
    <div class="ai-lab-grid">
      ${filtered.length ? filtered.map((trade) => {
        const analysis = trade.ai_analysis && !trade.ai_analysis.error ? trade.ai_analysis : null;
        const confidence = Math.round(Number(analysis?.confidence || 0) * 100);
        return `<div class="panel ai-trade-card" data-action="open-trade" data-id="${trade.id}">
          <div class="ai-card-top">
            <div><div class="ai-card-pair">${formatPair(trade.pair)} <span class="badge ${trade.strategy_version === 'V1' ? 'v1' : 'v2'}" style="margin-left:2px">${trade.strategy_version}</span></div><div class="ai-card-meta">${fmtDate(trade.trade_date)} · ${trade.charts?.length || 0} chart${trade.charts?.length === 1 ? '' : 's'} · ${trade.result}</div></div>
            <div class="ai-card-grade">${gradeBadge(trade.setup_grade)}</div>
          </div>
          <div class="ai-card-body">
            <span class="ai-card-status ${aiStatusClass(trade.ai_status)}"><span class="dot"></span>${aiStatusLabel(trade.ai_status)}</span>
            <span class="ai-card-confidence">${analysis ? `${confidence}% confidence` : trade.ai_status === 'failed' ? 'Manual review needed' : 'Open to review'}</span>
          </div>
        </div>`;
      }).join('') : `<div class="panel empty-state ai-lab-empty">
        <div class="empty-icon">${icon('camera', 21)}</div>
        <div class="empty-title">${state.trades.length ? 'No trades in this view' : 'No charts to analyze yet'}</div>
        <div class="empty-text">${state.trades.length ? 'Switch the filter to see your saved trades.' : 'Add a trade and upload annotated chart screenshots. The vision model will inspect Order Blocks, taps, FVG, Wick FVG, imbalance and entry placement.'}</div>
        <button class="btn btn-primary" data-action="add-trade">${icon('plus', 14)}Add a trade</button>
      </div>`}
    </div>
    <div class="ai-banner" style="margin-top:12px">
      <span class="ai-orb">${icon('lock', 17)}</span>
      <div class="ai-banner-text"><div class="ai-banner-label">Evidence-first AI</div><div class="ai-banner-title">The model is instructed to say “uncertain” when a chart cannot prove a condition.</div><div class="ai-banner-desc">No invented order blocks, no guessed entries. Your original screenshots stay untouched, and manual corrections override the AI grade.</div></div>
      <a class="btn" href="#/settings">Configure engine ${icon('arrowRight', 13)}</a>
    </div>
  </div>`;
}

export function renderInsights() {
  const insights = state.insights || [];
  const top = insights[0];
  return `<div class="fade-up">
    ${pageHead({
      eyebrow: 'AI insights',
      title: 'Your edge, <em>decoded.</em>',
      sub: `Grounded in ${state.trades.length} saved trades${state.trades.some((t) => t.ai_status === 'complete') ? ' and completed chart reviews' : ''}. Nothing here is generated without underlying trade data.`,
      actions: `<span class="grounded-badge">${icon('check', 10)}Grounded in journal</span><button class="btn" data-action="generate-narrative" ${state.trades.length ? '' : 'disabled'}>${icon('sparkles', 14)}${state.narrative ? 'Regenerate review' : 'Generate AI review'}</button>`
    })}
    ${state.narrative ? `<section class="panel narrative-card">
      <div class="narrative-head"><span class="analysis-orb">${icon('sparkles', 14)}</span><div><div class="narrative-title">${esc(state.narrative.headline || 'Performance review')}</div><div class="narrative-sub">Generated from your saved statistics · no chart details invented</div></div></div>
      <div class="narrative-body">
        ${(state.narrative.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}
        ${(state.narrative.actions || []).length ? `<div class="narrative-actions">${state.narrative.actions.map((action) => `<div class="narrative-action">${icon('arrowRight', 12)}<span>${esc(action)}</span></div>`).join('')}</div>` : ''}
      </div>
    </section>` : ''}
    ${top ? `<section class="panel insight-feature">
      <div class="insight-feature-label">${icon('sparkles', 13)}Priority insight</div>
      <h2>${esc(top.title)}</h2>
      <p>${esc(top.body)}</p>
      <div class="insight-feature-actions"><span class="badge ${top.tone === 'positive' ? 'win' : top.tone === 'negative' ? 'loss' : 'neutral'}">${esc(top.metric)}</span><span class="grounded-badge">${icon('check', 10)}Calculated from saved trades</span></div>
    </section>` : ''}
    <div class="insights-grid">
      ${insights.slice(1).map((insight) => `<section class="panel insight-card">
        <div class="insight-card-top"><span class="insight-category">${esc(insight.category)}</span><span class="insight-metric">${esc(insight.metric)}</span></div>
        <h3>${esc(insight.title)}</h3>
        <p>${esc(insight.body)}</p>
        <span class="insight-tone ${insight.tone}">${icon(insight.tone === 'positive' ? 'trendingUp' : insight.tone === 'negative' ? 'alert' : 'info', 11)}${insight.tone === 'positive' ? 'Working' : insight.tone === 'negative' ? 'Needs attention' : 'Watch'}</span>
      </section>`).join('')}
    </div>
    ${!insights.length ? `<div class="panel empty-state"><div class="empty-icon">${icon('bulb', 21)}</div><div class="empty-title">Insights are waiting for data</div><div class="empty-text">Log trades and upload charts. Decode only surfaces patterns that are supported by your actual saved outcomes.</div><button class="btn btn-primary" data-action="add-trade">${icon('plus', 14)}Log a trade</button></div>` : ''}
    <div class="ai-banner" style="margin-top:12px">
      <span class="ai-orb">${icon('brain', 17)}</span>
      <div class="ai-banner-text"><div class="ai-banner-label">How this works</div><div class="ai-banner-title">Deterministic statistics first. AI narrative second.</div><div class="ai-banner-desc">Every metric is computed server-side from saved trades. The optional AI review is given only those numbers and told never to invent outcomes.</div></div>
      <a class="btn" href="#/analytics">View evidence ${icon('arrowRight', 13)}</a>
    </div>
  </div>`;
}

export function renderSettings() {
  const s = state.settings;
  const ai = state.ai || {};
  const isDemo = state.user?.email === 'demo@decode.app';
  return `<div class="fade-up">
    ${pageHead({
      eyebrow: 'Settings',
      title: 'Your workspace, <em>your rules.</em>',
      sub: 'Account, risk defaults and the local AI engine used for chart analysis.'
    })}
    <div class="settings-layout">
      <div class="stack-12">
        <section class="panel">
          <div class="settings-section">
            <div class="profile-card">
              <span class="avatar">${esc(initials(state.user?.name))}</span>
              <div><div class="profile-name">${esc(state.user?.name || 'Trader')}</div><div class="profile-email">${esc(state.user?.email || '')}</div></div>
              ${isDemo ? '<span class="demo-pill" style="margin-left:auto">DEMO</span>' : '<span class="badge win" style="margin-left:auto">Private</span>'}
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">AI vision engine</div>
            <div class="settings-section-sub">Ollama runs locally. Decode sends uploaded images only to the configured endpoint.</div>
            <form id="ai-settings-form" class="settings-form" style="padding-left:0;padding-right:0;padding-bottom:0">
              <div class="form-grid">
                <div class="field full"><label>Ollama endpoint</label><input name="ollama_url" value="${esc(s.ollama_url)}" placeholder="http://127.0.0.1:11434"></div>
                <div class="field"><label>Vision model</label><input name="ai_model" value="${esc(s.ai_model)}" placeholder="qwen3-vl:4b-instruct" list="ai-model-list"><datalist id="ai-model-list">${(ai.models || []).filter((m) => m.vision).map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist></div>
                <div class="field"><label>Engine status</label><div class="ai-status-card" style="margin:0;padding:8px 11px;border-radius:8px"><span class="ai-status-badge ${ai.online ? 'online' : 'offline'}" style="margin:0"><span class="dot"></span>${ai.online ? 'Online' : 'Offline'}</span><span class="small-note" style="margin-left:auto">${esc(ai.model || s.ai_model)}</span></div></div>
              </div>
              <div class="form-actions"><button class="btn btn-primary" type="submit">${icon('check', 13)}Save AI engine</button></div>
            </form>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">Data &amp; privacy</div>
            <div class="settings-section-sub">Export everything as JSON, including trades, analyses and chart metadata. Original screenshot files stay in the local uploads directory.</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px">
              <button class="btn" data-action="export">${icon('download', 13)}Export journal</button>
              <button class="btn" data-action="refresh-ai">${icon('refresh', 13)}Recheck AI engine</button>
            </div>
          </div>
          <div class="settings-section danger-zone">
            <div class="settings-section-title">Session</div>
            <div class="settings-section-sub">Signing out removes the session cookie. Your trades and screenshots remain saved.</div>
            <button class="btn btn-danger" style="margin-top:13px" data-action="logout">${icon('logout', 13)}Sign out</button>
          </div>
        </section>
      </div>
      <div class="stack-12">
        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Strategy contract</div><div class="section-sub">Locked to two versions only</div></div><span class="badge v1">V1 + V2</span></div>
          <div class="risk-rules">
            <div class="risk-rule">${icon('check', 13)}<span><strong>V1:</strong> 1H trend + Order Block, shortened 50% zone, first tap confirmation (FVG / Wick FVG / imbalance), second tap entry.</span></div>
            <div class="risk-rule">${icon('check', 13)}<span><strong>V2:</strong> Same V1 sequence with an optional 15M CHoCH check during the second tap. Used occasionally.</span></div>
            <div class="risk-rule">${icon('target', 13)}<span>Minimum planned RR is <strong>1:4</strong>. Buy uptrends, sell downtrends.</span></div>
            <div class="risk-rule">${icon('lock', 13)}<span>No other strategy versions or unrelated strategies are supported.</span></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><div class="section-title">Data source</div><div class="section-sub">How Decode calculates</div></div></div>
          <div class="risk-rules">
            <div class="risk-rule">${icon('chart', 13)}<span>All performance stats are calculated server-side from saved trades. No demo numbers are mixed into a private account.</span></div>
            <div class="risk-rule">${icon('camera', 13)}<span>AI reviews use the actual uploaded image bytes. Chart interpretation is stored per trade and can be manually corrected.</span></div>
            <div class="risk-rule">${icon('shield', 13)}<span>Passwords use scrypt hashing. Sessions are HttpOnly cookies with CSRF protection on every mutation.</span></div>
          </div>
        </section>
        ${isDemo ? `<section class="panel" style="border-color:rgba(242,198,109,.16);background:rgba(242,198,109,.03)">
          <div class="panel-body">
            <div class="eyebrow" style="color:var(--amber)">Demo workspace</div>
            <div style="font-size:12px;font-weight:600;margin-top:6px">You are exploring sample data</div>
            <p class="small-note" style="margin-top:5px;line-height:1.6">This account contains 38 illustrative trades so every view can be explored. Create a private account to start a clean journal with only your own data.</p>
            <button class="btn btn-sm" style="margin-top:12px" data-action="logout">${icon('arrowRight', 12)}Create private account</button>
          </div>
        </section>` : ''}
      </div>
    </div>
  </div>`;
}
