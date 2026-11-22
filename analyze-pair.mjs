const BASE = 'http://localhost:4173';
const targetPair = (process.argv[2] || 'EURUSD').toUpperCase();
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
const trade = boot.trades.find((t) => t.pair === targetPair && t.charts.length);
if (!trade) throw new Error('No charted trade for ' + targetPair);
console.log('model:', boot.settings.ai_model, 'trade:', trade.id, 'charts:', trade.charts.length);
const start = Date.now();
const trigger = await api('POST', `/api/trades/${trade.id}/analyze`, {});
console.log('trigger:', trigger);
for (let i = 0; i < 100; i += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  const { trade: current } = await api('GET', `/api/trades/${trade.id}`);
  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  console.log(`[${elapsed}s]`, current.ai_status, current.ai_model || '');
  if (current.ai_status === 'complete' || current.ai_status === 'failed') {
    console.log('ANALYSIS:', JSON.stringify(current.ai_analysis, null, 2));
    break;
  }
}
