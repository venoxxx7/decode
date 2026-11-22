const BASE = 'http://localhost:4173';
let cookie = '', csrf = '';
async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf && method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const sc = res.headers.getSetCookie?.() || [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text.slice(0, 500)}`);
  return data;
}
const login = await api('POST', '/api/auth/demo', {});
csrf = login.csrf;
const boot = await api('GET', '/api/bootstrap');
const s = boot.settings;
console.log('before:', s.ai_model);
const updated = await api('PUT', '/api/settings', {
  starting_balance: s.starting_balance,
  risk_per_trade: s.risk_per_trade,
  daily_loss_limit: s.daily_loss_limit,
  max_drawdown: s.max_drawdown,
  ollama_url: s.ollama_url,
  ai_model: 'qwen3-vl:4b-instruct'
});
console.log('after:', updated.settings.ai_model);

const trade = boot.trades.find((t) => t.pair === 'EURUSD' && t.charts.length);
console.log('trade:', trade.id, 'charts:', trade.charts.length);
const start = Date.now();
const trigger = await api('POST', `/api/trades/${trade.id}/analyze`, {});
console.log('trigger:', trigger);
for (let i = 0; i < 100; i += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  const { trade: current } = await api('GET', `/api/trades/${trade.id}`);
  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  console.log(`[${elapsed}s]`, current.ai_status, current.ai_model || '');
  if (current.ai_status === 'complete' || current.ai_status === 'failed') {
    console.log('ANALYSIS:', JSON.stringify(current.ai_analysis, null, 2).slice(0, 4000));
    break;
  }
}
