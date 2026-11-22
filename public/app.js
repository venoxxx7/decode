import {
  state, api, esc, icon, hydrate, loadBootstrap, initials, fmtDate, fmtMoney,
  fmtPct, fmtNum, filteredTrades, greeting
} from './js/core.js';
import {
  renderShell, renderTopbar, renderRoute, renderDashboard, renderJournal, renderJournalResults,
  renderTradeDetail, renderAILab, renderInsights, renderRisk, formatPair
} from './js/views.js';
import {
  toast, closeModal, openModal, confirmDialog, runPendingConfirm, openLightbox, closeLightbox,
  openTradeModal, addUploadFiles, removeUpload, submitTradeForm, openCorrectionModal,
  submitCorrectionForm, updatePositionCalculator
} from './js/modals.js';

const root = document.getElementById('root');

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, id] = raw.split('/');
  const valid = ['overview', 'journal', 'risk', 'analytics', 'ai', 'insights', 'settings'];
  return { name: valid.includes(name) ? name : 'overview', id: id || null };
}

function navigate(hash) {
  if (location.hash === hash) renderApp();
  else location.hash = hash;
}

async function boot() {
  try {
    await loadBootstrap();
    renderApp();
  } catch (error) {
    if (error.status === 401) renderAuth();
    else {
      root.innerHTML = `<div class="panel empty-state" style="margin:40px auto;max-width:520px">
        <div class="empty-icon">${icon('alert', 21)}</div>
        <div class="empty-title">Could not reach the journal</div>
        <div class="empty-text">${esc(error.message)}</div>
        <button class="btn" onclick="location.reload()">Retry</button>
      </div>`;
    }
  }
}

function renderApp() {
  if (!state.user) {
    renderAuth();
    return;
  }
  const route = parseRoute();
  root.innerHTML = renderShell(route);
  renderView(route);
}

function renderView(route = parseRoute()) {
  if (!state.user) return;
  const topbar = document.getElementById('topbar');
  const view = document.getElementById('view');
  if (!topbar || !view) return;
  topbar.innerHTML = renderTopbar(route);
  view.innerHTML = renderRoute(route);
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const active = href.includes(`#/${route.name}`);
    link.classList.toggle('active', active);
  });
  document.querySelectorAll('.mobile-nav a').forEach((link) => {
    link.classList.toggle('active', (link.getAttribute('href') || '').includes(`#/${route.name}`));
  });
  bindView(route);
  if (route.name === 'journal' && route.id) {
    const trade = state.trades.find((t) => t.id === route.id);
    if (trade?.ai_status === 'analyzing') startPolling(route.id);
  }
}

function bindView(route) {
  if (route.name === 'overview' || route.name === 'risk') bindEquityTooltip();
  if (route.name === 'risk') {
    updatePositionCalculator();
    ['calc-balance', 'calc-risk', 'calc-stop', 'calc-pip'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', updatePositionCalculator);
    });
  }
}

function bindEquityTooltip() {
  const svg = document.getElementById('equity-svg');
  const wrap = svg?.closest('.equity-chart');
  const tip = wrap?.querySelector('#equity-tip') || document.getElementById('equity-tip');
  const cursor = document.getElementById('equity-cursor');
  if (!svg || !wrap || !tip) return;
  let points = [];
  try { points = JSON.parse(svg.dataset.points || '[]'); } catch {}
  if (!points.length) return;
  wrap.addEventListener('mousemove', (event) => {
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;
    const ratio = x / rect.width;
    let closest = points[0];
    let best = Infinity;
    points.forEach((point) => {
      const distance = Math.abs(point.x / 620 - ratio);
      if (distance < best) { best = distance; closest = point; }
    });
    const px = closest.x / 620 * rect.width;
    const py = closest.y / 228 * rect.height;
    tip.style.left = `${px}px`;
    tip.style.top = `${py}px`;
    tip.style.opacity = '1';
    tip.innerHTML = `${esc(fmtDate(closest.date, { year: 'numeric' }))}<strong>${fmtMoney(closest.equity)}</strong>`;
    if (cursor) {
      cursor.setAttribute('x1', closest.x);
      cursor.setAttribute('x2', closest.x);
      cursor.style.opacity = '1';
    }
  });
  wrap.addEventListener('mouseleave', () => {
    tip.style.opacity = '0';
    if (cursor) cursor.style.opacity = '0';
  });
}

async function refreshAndRender() {
  await loadBootstrap();
  renderApp();
}

// ---------- Auth ----------
function authChart() {
  const candles = [
    [22, 34, 47, 18], [38, 48, 55, 31], [52, 46, 60, 40], [60, 58, 72, 50], [72, 78, 86, 65],
    [86, 82, 96, 74], [96, 104, 112, 88], [112, 100, 118, 94], [100, 108, 116, 92], [108, 118, 128, 100],
    [118, 126, 138, 112], [126, 120, 136, 110], [120, 132, 146, 116], [132, 142, 154, 124]
  ];
  const width = 500;
  const height = 118;
  const step = width / (candles.length + 1);
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <defs><linearGradient id="auth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9ff57" stop-opacity=".18"/><stop offset="1" stop-color="#d9ff57" stop-opacity="0"/></linearGradient></defs>
    ${[0, 1, 2, 3].map((i) => `<line x1="0" y1="${12 + i * 29}" x2="${width}" y2="${12 + i * 29}" stroke="rgba(255,255,255,.05)" stroke-dasharray="2 5"/>`).join('')}
    <rect x="${step * 7}" y="22" width="${step * 3.2}" height="42" fill="rgba(217,255,87,.07)" stroke="rgba(217,255,87,.18)" stroke-dasharray="3 3" rx="3"/>
    ${candles.map(([open, close, high, low], index) => {
      const x = step * (index + 0.8);
      const scale = 1.55;
      const y = (value) => height - 8 - value * scale;
      const up = close >= open;
      return `<line x1="${x}" y1="${y(high)}" x2="${x}" y2="${y(low)}" stroke="${up ? 'rgba(130,232,166,.7)' : 'rgba(255,127,127,.65)'}" stroke-width="1"/>
        <rect x="${x - 4}" y="${y(Math.max(open, close))}" width="8" height="${Math.max(2, Math.abs(close - open) * scale)}" rx="1.5" fill="${up ? 'rgba(130,232,166,.7)' : 'rgba(255,127,127,.65)'}"/>`;
    }).join('')}
    <path d="M0,90 C70,84 90,64 160,66 C230,68 250,42 320,48 C390,54 420,30 500,24" fill="none" stroke="#d9ff57" stroke-width="1.6" opacity=".9"/>
    <circle cx="446" cy="31" r="3" fill="#d9ff57"/>
    <circle cx="446" cy="31" r="7" fill="none" stroke="rgba(217,255,87,.25)"/>
    <text x="${step * 7 + 7}" y="35" fill="#d9ff57" font-size="7" font-family="Manrope, sans-serif" letter-spacing="1">OB ZONE</text>
  </svg>`;
}

function renderAuth() {
  const isRegister = state.authMode === 'register';
  root.innerHTML = `<div class="auth-shell">
    <section class="auth-visual">
      <a href="#/overview" class="logo"><span class="logo-mark">D</span><span class="logo-text">DECODE<span class="logo-sub">AI TRADING JOURNAL</span></span></a>
      <div class="auth-hero">
        <div class="auth-kicker"><span class="dot"></span>Evidence-first trading journal</div>
        <h1 class="auth-h1">Decode your edge.<br><em>Trade the proof.</em></h1>
        <p class="auth-sub">A private journal built around one disciplined playbook. Log the two taps, preserve the chart, and let actual outcomes tell you what is working.</p>
        <div class="auth-points">
          <div class="auth-point"><span class="auth-point-icon">${icon('check', 10)}</span>V1 and V2 only. No strategy drift.</div>
          <div class="auth-point"><span class="auth-point-icon">${icon('check', 10)}</span>AI reads your actual annotated chart screenshots.</div>
          <div class="auth-point"><span class="auth-point-icon">${icon('check', 10)}</span>Every statistic calculated from saved trades.</div>
        </div>
        <div class="auth-chart">
          <div class="auth-chart-label">EUR/USD · 1H</div>
          <div class="auth-chart-badge">+4.2R</div>
          ${authChart()}
        </div>
      </div>
      <div class="auth-foot"><span>© ${new Date().getFullYear()} Decode</span><span>Local-first · private by design</span></div>
    </section>
    <section class="auth-form-wrap">
      <div class="auth-form">
        <a href="#/overview" class="logo"><span class="logo-mark">D</span><span class="logo-text">DECODE<span class="logo-sub">AI TRADING JOURNAL</span></span></a>
        <h2 class="auth-form-title">${isRegister ? 'Create your private journal' : 'Welcome back.'}</h2>
        <p class="auth-form-sub">${isRegister ? 'Start with a clean workspace. Only your own saved trades will feed the statistics.' : 'Sign in to your workspace, chart reviews and performance analytics.'}</p>
        <div class="auth-tabs">
          <button class="auth-tab ${!isRegister ? 'active' : ''}" data-action="auth-tab" data-mode="login">Sign in</button>
          <button class="auth-tab ${isRegister ? 'active' : ''}" data-action="auth-tab" data-mode="register">Create account</button>
        </div>
        <form id="auth-form">
          <div class="auth-fields">
            ${isRegister ? `<div class="field"><label>Your name</label><input name="name" autocomplete="name" placeholder="Alex Morgan" required minlength="2"></div>` : ''}
            <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div>
            <div class="field"><label>Password</label><input name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'At least 8 characters' : 'Your password'}" required minlength="8"></div>
          </div>
          <div class="auth-error" id="auth-error"></div>
          <button class="btn btn-primary auth-submit" type="submit" id="auth-submit">${isRegister ? 'Create private journal' : 'Sign in'} ${icon('arrowRight', 13)}</button>
        </form>
        <div class="auth-divider">or explore with sample data</div>
        <button class="btn demo-btn" data-action="demo-login">${icon('sparkles', 14)}Enter live demo workspace</button>
        <p class="auth-note">The demo is populated with 38 illustrative trades. Create a private account for a clean journal with only your own data.<br>Passwords are hashed with scrypt. Sessions are HttpOnly.</p>
      </div>
    </section>
  </div>`;
}

function showAuthError(message) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
}

async function handleAuthSubmit(form) {
  const fd = new FormData(form);
  const isRegister = state.authMode === 'register';
  const button = document.getElementById('auth-submit');
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="spin"></span>${isRegister ? 'Creating…' : 'Signing in…'}`;
  try {
    const payload = {
      email: String(fd.get('email') || '').trim(),
      password: String(fd.get('password') || '')
    };
    if (isRegister) payload.name = String(fd.get('name') || '').trim();
    const data = await api(isRegister ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: payload, csrf: false });
    state.csrf = data.csrf;
    await loadBootstrap();
    renderApp();
    toast(isRegister ? 'Private journal created.' : `Welcome back, ${state.user.name.split(' ')[0]}.`, 'success');
  } catch (error) {
    showAuthError(error.message);
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function demoLogin() {
  try {
    const data = await api('/api/auth/demo', { method: 'POST', body: {}, csrf: false });
    state.csrf = data.csrf;
    await loadBootstrap();
    renderApp();
    toast('Demo workspace loaded. All 38 trades are sample data.', 'info');
  } catch (error) {
    showAuthError(error.message);
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  state.user = null;
  state.csrf = null;
  state.narrative = null;
  state.trades = [];
  state.dashboard = null;
  state.analytics = null;
  state.insights = [];
  state.ai = null;
  clearTimeout(state.poll);
  closeModal();
  renderAuth();
}

// ---------- Actions ----------
async function analyzeTrade(id) {
  try {
    await api(`/api/trades/${id}/analyze`, { method: 'POST' });
    const trade = state.trades.find((t) => t.id === id);
    if (trade) trade.ai_status = 'analyzing';
    toast('Chart review started. This can take a few minutes.', 'info');
    renderView();
    startPolling(id);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function startPolling(tradeId) {
  clearTimeout(state.poll);
  let attempts = 0;
  const poll = async () => {
    attempts += 1;
    try {
      const { trade } = await api(`/api/trades/${tradeId}`);
      const index = state.trades.findIndex((t) => t.id === tradeId);
      if (index >= 0) state.trades[index] = trade;
      if (parseRoute().id === tradeId) renderView();
      if (trade.ai_status === 'analyzing' && attempts < 260) {
        state.poll = setTimeout(poll, 3500);
      } else {
        await loadBootstrap();
        renderApp();
        if (trade.ai_status === 'complete') toast('AI chart review saved.', 'success');
        if (trade.ai_status === 'failed') toast('AI review failed. You can retry or correct manually.', 'error');
      }
    } catch {
      if (attempts < 10) state.poll = setTimeout(poll, 5000);
    }
  };
  state.poll = setTimeout(poll, 2500);
}

async function deleteTrade(id) {
  try {
    await api(`/api/trades/${id}`, { method: 'DELETE' });
    toast('Trade deleted.', 'success');
    if (parseRoute().id === id) navigate('#/journal');
    await refreshAndRender();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteChart(chartId, tradeId) {
  try {
    await api(`/api/charts/${chartId}`, { method: 'DELETE' });
    toast('Chart removed. The trade record is unchanged.', 'success');
    await refreshAndRender();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function uploadChartsToTrade(tradeId, files) {
  const valid = [...files].filter((file) => /^image\/(png|jpeg|webp)$/.test(file.type) && file.size <= 8 * 1024 * 1024);
  if (!valid.length) {
    toast('Use PNG, JPG or WEBP images under 8 MB.', 'error');
    return;
  }
  try {
    const charts = [];
    for (const file of valid.slice(0, 10)) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      charts.push({ name: file.name, dataUrl });
    }
    await api(`/api/trades/${tradeId}/charts`, { method: 'POST', body: { charts } });
    toast(`${charts.length} chart${charts.length === 1 ? '' : 's'} uploaded.`, 'success');
    if (state.ai?.online) {
      api(`/api/trades/${tradeId}/analyze`, { method: 'POST' }).catch(() => {});
      toast('AI review queued for the new chart.', 'info');
    }
    await refreshAndRender();
    startPolling(tradeId);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function triggerChartUpload(tradeId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.multiple = true;
  input.onchange = () => uploadChartsToTrade(tradeId, input.files);
  input.click();
}

async function exportJournal() {
  try {
    const response = await fetch('/api/export');
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `decode-journal-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Journal exported as JSON.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function generateNarrative() {
  const button = document.querySelector('[data-action="generate-narrative"]');
  if (button) {
    button.disabled = true;
    button.innerHTML = `<span class="spin"></span>Generating…`;
  }
  try {
    const data = await api('/api/ai/narrative', { method: 'POST' });
    state.narrative = data.narrative;
    renderView();
    toast('AI performance review generated from saved statistics.', 'success');
  } catch (error) {
    toast(error.message, 'error');
    if (button) {
      button.disabled = false;
      button.innerHTML = `${icon('sparkles', 14)}Generate AI review`;
    }
  }
}

async function refreshAIStatus() {
  try {
    const ai = await api('/api/ai/status');
    state.ai = ai;
    toast(ai.online ? `Vision engine online · ${ai.model}` : 'Vision engine is offline.', ai.online ? 'success' : 'error');
    renderView();
  } catch (error) {
    toast(error.message, 'error');
  }
}

// ---------- Event wiring ----------
document.addEventListener('click', async (event) => {
  const backdrop = event.target.closest('[data-modal-backdrop]');
  if (backdrop && event.target === backdrop) { closeModal(); return; }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  try {
    switch (action) {
      case 'auth-tab':
        state.authMode = target.dataset.mode;
        renderAuth();
        break;
      case 'demo-login':
        await demoLogin();
        break;
      case 'add-trade':
        openTradeModal();
        break;
      case 'edit-trade': {
        const trade = state.trades.find((t) => t.id === id);
        if (trade) openTradeModal(trade);
        break;
      }
      case 'open-trade':
        navigate(`#/journal/${id}`);
        break;
      case 'go-settings':
        navigate('#/settings');
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'confirm-action':
        runPendingConfirm();
        break;
      case 'open-lightbox':
        openLightbox(target.dataset.src, target.dataset.label);
        break;
      case 'close-lightbox':
        closeLightbox();
        break;
      case 'remove-upload':
        removeUpload(Number(target.dataset.index));
        break;
      case 'analyze-trade':
        await analyzeTrade(id);
        break;
      case 'delete-trade':
        confirmDialog({
          title: 'Delete this trade?',
          text: 'The saved trade, its AI review and every uploaded chart will be permanently removed. This cannot be undone.',
          confirmText: 'Delete trade',
          onConfirm: () => deleteTrade(id)
        });
        break;
      case 'upload-chart':
        triggerChartUpload(id);
        break;
      case 'delete-chart':
        confirmDialog({
          title: 'Remove this chart?',
          text: 'The original screenshot will be deleted from storage. The trade record and any AI review remain saved.',
          confirmText: 'Remove chart',
          onConfirm: () => deleteChart(target.dataset.chartId, id)
        });
        break;
      case 'manual-correction': {
        const trade = state.trades.find((t) => t.id === id);
        if (trade) openCorrectionModal(trade);
        break;
      }
      case 'chart-range':
        state.chartRange = target.dataset.range;
        renderView();
        break;
      case 'ai-filter':
        state.aiFilter = target.dataset.filter;
        renderView();
        break;
      case 'clear-filters':
        state.journalFilters = { search: '', result: 'all', strategy: 'all', pair: 'all' };
        renderView();
        break;
      case 'refresh-ai':
        await refreshAIStatus();
        break;
      case 'generate-narrative':
        await generateNarrative();
        break;
      case 'export':
        await exportJournal();
        break;
      case 'logout':
        await logout();
        break;
      default:
        break;
    }
  } catch (error) {
    toast(error.message || 'Something went wrong.', 'error');
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (form.id === 'auth-form') {
    event.preventDefault();
    await handleAuthSubmit(form);
    return;
  }
  if (form.id === 'trade-form') {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.innerHTML = '<span class="spin"></span>Saving…'; }
    try {
      const saved = await submitTradeForm(form);
      await refreshAndRender();
      navigate(`#/journal/${saved.id}`);
    } catch (error) {
      toast(error.message, 'error');
      if (button) { button.disabled = false; button.innerHTML = `${icon('check', 13)}Save trade`; }
    }
    return;
  }
  if (form.id === 'risk-settings-form') {
    event.preventDefault();
    const fd = new FormData(form);
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: {
          starting_balance: Number(fd.get('starting_balance')),
          risk_per_trade: Number(fd.get('risk_per_trade')),
          daily_loss_limit: Number(fd.get('daily_loss_limit')),
          max_drawdown: Number(fd.get('max_drawdown'))
        }
      });
      await refreshAndRender();
      toast('Risk parameters saved.', 'success');
    } catch (error) { toast(error.message, 'error'); }
    return;
  }
  if (form.id === 'ai-settings-form') {
    event.preventDefault();
    const fd = new FormData(form);
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: { ollama_url: fd.get('ollama_url'), ai_model: fd.get('ai_model') }
      });
      await refreshAndRender();
      toast('AI engine settings saved.', 'success');
    } catch (error) { toast(error.message, 'error'); }
    return;
  }
  if (form.id === 'correction-form') {
    event.preventDefault();
    try {
      await submitCorrectionForm(form);
      await refreshAndRender();
    } catch (error) { toast(error.message, 'error'); }
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'journal-search') {
    state.journalFilters.search = event.target.value;
    updateJournalResults();
  }
});

document.addEventListener('change', (event) => {
  const id = event.target.id;
  if (['filter-result', 'filter-strategy', 'filter-pair'].includes(id)) {
    const key = id === 'filter-result' ? 'result' : id === 'filter-strategy' ? 'strategy' : 'pair';
    state.journalFilters[key] = event.target.value;
    updateJournalResults();
  }
});

function updateJournalResults() {
  const trades = filteredTrades();
  const container = document.getElementById('journal-results');
  const count = document.getElementById('filter-count');
  if (container) container.innerHTML = renderJournalResults(trades);
  if (count) count.textContent = `${trades.length} of ${state.trades.length}`;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
    closeLightbox();
  }
});

window.addEventListener('hashchange', () => {
  if (!state.user) return;
  renderApp();
});

window.addEventListener('error', (event) => {
  console.error(event.error || event.message);
});

boot();
