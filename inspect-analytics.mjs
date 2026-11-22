const BASE = 'http://localhost:4173';
let cookie = '';
async function api(method, url, body) {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.getSetCookie?.() || [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  return res.json();
}
const login = await api('POST', '/api/auth/demo', {});
const boot = await api('GET', '/api/bootstrap');
const a = boot.analytics;
console.log('strategies', a.strategies.map(({ version, trades, wins, losses, winRate, avgR, totalR, chochUsed, chochPresent }) => ({ version, trades, wins, losses, winRate, avgR, totalR, chochUsed, chochPresent })));
console.log('choch', Object.fromEntries(Object.entries(a.choch).map(([k, v]) => [k, k === 'lift' ? v : { trades: v.trades, wins: v.wins, losses: v.losses, avgR: v.avgR, totalR: v.totalR }])));
const v2 = boot.trades.filter(t => t.strategy_version === 'V2');
console.log('v2 trades', v2.map(t => ({ pair: t.pair, choch_used: t.choch_used, choch_present: t.choch_present, result: t.result, actual_rr: t.actual_rr, grade: t.setup_grade })));
