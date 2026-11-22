import { state, api, esc, icon, fmtMoney, fmtNum, toLocalInput } from './core.js';
import { formatPair as pairLabel } from './views.js';

let pendingConfirm = null;

export function toast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check';
  el.innerHTML = `${icon(iconName, 14)}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'all .2s ease';
    setTimeout(() => el.remove(), 220);
  }, 3800);
}

export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  state.uploadFiles = [];
  state.editingId = null;
}

export function openModal(content, size = '') {
  document.getElementById('modal-root').innerHTML = `<div class="modal-backdrop" data-modal-backdrop>
    <div class="modal ${size}" role="dialog" aria-modal="true">${content}</div>
  </div>`;
}

export function confirmDialog({ title, text, confirmText = 'Delete', danger = true, onConfirm }) {
  pendingConfirm = onConfirm;
  openModal(`<div class="modal-head">
    <div><div class="modal-title">${esc(title)}</div><div class="modal-sub">This action is applied to your saved journal.</div></div>
    <button class="btn btn-icon btn-ghost modal-close" data-action="close-modal">${icon('x', 15)}</button>
  </div>
  <div class="modal-body"><div class="ai-offline" style="border-color:${danger ? 'rgba(255,127,127,.16)' : 'var(--line)'};background:${danger ? 'rgba(255,127,127,.04)' : 'rgba(255,255,255,.02)'}">
    ${icon(danger ? 'alert' : 'info', 17)}<p><strong>${esc(title)}</strong>${esc(text)}</p>
  </div></div>
  <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><div class="right"><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-action">${esc(confirmText)}</button></div></div>`, 'narrow');
}

export function runPendingConfirm() {
  const action = pendingConfirm;
  pendingConfirm = null;
  closeModal();
  if (typeof action === 'function') action();
}

export function openLightbox(src, label) {
  document.getElementById('lightbox-root').innerHTML = `<div class="lightbox" data-action="close-lightbox">
    <button class="btn btn-icon lightbox-close" data-action="close-lightbox">${icon('x', 17)}</button>
    <img src="${src}" alt="${esc(label || 'Annotated chart')}">
    <div class="lightbox-label">${esc(label || 'Original chart')} · preserved source image</div>
  </div>`;
}

export function closeLightbox() {
  document.getElementById('lightbox-root').innerHTML = '';
}

export function openTradeModal(trade = null) {
  state.editingId = trade?.id || null;
  state.uploadFiles = [];
  const isEdit = !!trade;
  const s = state.settings || {};
  const balance = state.dashboard?.balance || s.starting_balance || 10000;
  const riskPct = trade?.risk_percent ?? s.risk_per_trade ?? 1;
  const riskAmount = trade?.risk_amount ?? Number((balance * riskPct / 100).toFixed(2));
  const result = trade?.result || 'WIN';
  const direction = trade?.direction || 'BUY';
  const trend = trade?.trend || 'UPTREND';
  const version = trade?.strategy_version || 'V1';
  const existingCharts = trade?.charts || [];
  const checks = {
    ob_detected: trade?.ob_detected ?? true,
    shortened_zone: trade?.shortened_zone ?? true,
    first_tap: trade?.first_tap ?? true,
    fvg: trade?.fvg ?? false,
    wick_fvg: trade?.wick_fvg ?? false,
    imbalance: trade?.imbalance ?? false,
    second_tap: trade?.second_tap ?? true,
    choch_used: trade?.choch_used ?? false,
    choch_present: trade?.choch_present ?? false
  };
  openModal(`<form id="trade-form" novalidate>
    <div class="modal-head">
      <div><div class="modal-title">${isEdit ? 'Edit trade' : 'Log a trade'}</div><div class="modal-sub">${isEdit ? 'Update the saved record and attach new chart evidence.' : 'Record the execution, the V1/V2 checklist and the original annotated charts.'}</div></div>
      <button class="btn btn-icon btn-ghost modal-close" type="button" data-action="close-modal">${icon('x', 15)}</button>
    </div>
    <div class="modal-body">
      <div class="form-section">
        <div class="form-section-head"><span class="form-section-num">01</span><span class="form-section-title">Market &amp; setup</span></div>
        <div class="form-grid">
          <div class="field"><label>Pair</label><input name="pair" list="pair-list" required value="${esc(trade?.pair || '')}" placeholder="EURUSD" autocomplete="off"><datalist id="pair-list">${['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','NZDUSD','EURJPY','GBPJPY','EURGBP','AUDJPY','CHFJPY','XAUUSD'].map((p) => `<option value="${p}">`).join('')}</datalist></div>
          <div class="field"><label>Trade date &amp; time</label><input name="trade_date" type="datetime-local" required value="${toLocalInput(trade?.trade_date || new Date().toISOString())}"></div>
          <div class="seg-field"><label>Direction</label><div class="seg-options">
            <label class="seg-option"><input type="radio" name="direction" value="BUY" ${direction === 'BUY' ? 'checked' : ''}><span class="buy">${icon('arrowUpRight', 12)}BUY</span></label>
            <label class="seg-option"><input type="radio" name="direction" value="SELL" ${direction === 'SELL' ? 'checked' : ''}><span class="sell">${icon('arrowDownRight', 12)}SELL</span></label>
          </div></div>
          <div class="seg-field"><label>1H trend</label><div class="seg-options">
            <label class="seg-option"><input type="radio" name="trend" value="UPTREND" ${trend === 'UPTREND' ? 'checked' : ''}><span>Uptrend</span></label>
            <label class="seg-option"><input type="radio" name="trend" value="DOWNTREND" ${trend === 'DOWNTREND' ? 'checked' : ''}><span>Downtrend</span></label>
          </div></div>
          <div class="seg-field full"><label>Strategy version</label><div class="seg-options">
            <label class="seg-option"><input type="radio" name="strategy_version" value="V1" ${version === 'V1' ? 'checked' : ''}><span class="v1">V1 · Primary</span></label>
            <label class="seg-option"><input type="radio" name="strategy_version" value="V2" ${version === 'V2' ? 'checked' : ''}><span class="v2">V2 · Optional CHoCH</span></label>
          </div></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-head"><span class="form-section-num">02</span><span class="form-section-title">Execution &amp; outcome</span><span class="form-section-sub" id="rr-preview">Planned RR —</span></div>
        <div class="form-grid">
          <div class="field"><label>Entry</label><input name="entry" type="number" step="any" required value="${trade?.entry ?? ''}" placeholder="1.0850"></div>
          <div class="field"><label>Stop loss</label><input name="sl" type="number" step="any" required value="${trade?.sl ?? ''}" placeholder="1.0825"></div>
          <div class="field"><label>Take profit</label><input name="tp" type="number" step="any" required value="${trade?.tp ?? ''}" placeholder="1.0975"></div>
          <div class="field"><label>Lot size</label><input name="lot_size" type="number" step="0.01" min="0" value="${trade?.lot_size ?? ''}" placeholder="1.00"></div>
          <div class="field"><label>Risk percent</label><div class="field-suffix"><input name="risk_percent" type="number" step="0.01" min="0" value="${Number(riskPct)}"><span>%</span></div></div>
          <div class="field"><label>Risk amount</label><div class="field-suffix"><input name="risk_amount" type="number" step="0.01" min="0" value="${Number(riskAmount)}"><span>USD</span></div></div>
          <div class="field"><label>Actual R</label><input name="actual_rr" type="number" step="0.01" value="${Math.abs(Number(trade?.actual_rr || 0))}" placeholder="4.20"><div class="field-hint">Enter positive R. The result selector applies the sign.</div></div>
          <div class="seg-field"><label>Result</label><div class="seg-options">
            <label class="seg-option"><input type="radio" name="result" value="WIN" ${result === 'WIN' ? 'checked' : ''}><span class="win">Win</span></label>
            <label class="seg-option"><input type="radio" name="result" value="LOSS" ${result === 'LOSS' ? 'checked' : ''}><span class="loss">Loss</span></label>
            <label class="seg-option"><input type="radio" name="result" value="BREAKEVEN" ${result === 'BREAKEVEN' ? 'checked' : ''}><span class="be">BE</span></label>
          </div></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-head"><span class="form-section-num">03</span><span class="form-section-title">V1 / V2 checklist</span><span class="form-section-sub">Recorded evidence</span></div>
        <div class="check-grid">
          <label class="check-toggle"><input type="checkbox" name="ob_detected" ${checks.ob_detected ? 'checked' : ''}>1H Order Block identified</label>
          <label class="check-toggle"><input type="checkbox" name="shortened_zone" ${checks.shortened_zone ? 'checked' : ''}>Shortened 50% zone used</label>
          <label class="check-toggle"><input type="checkbox" name="first_tap" ${checks.first_tap ? 'checked' : ''}>First tap into zone</label>
          <label class="check-toggle"><input type="checkbox" name="second_tap" ${checks.second_tap ? 'checked' : ''}>Second tap entry</label>
          <label class="check-toggle"><input type="checkbox" name="fvg" ${checks.fvg ? 'checked' : ''}>FVG confirmation</label>
          <label class="check-toggle"><input type="checkbox" name="wick_fvg" ${checks.wick_fvg ? 'checked' : ''}>Wick FVG confirmation</label>
          <label class="check-toggle"><input type="checkbox" name="imbalance" ${checks.imbalance ? 'checked' : ''}>Imbalance candle</label>
          <label class="check-toggle"><input type="checkbox" name="news" ${trade?.news ? 'checked' : ''}>News-time trade</label>
        </div>
        <div class="field" style="margin-top:10px"><label>News event (optional)</label><input name="news_event" value="${esc(trade?.news_event || '')}" placeholder="US CPI, NFP, FOMC…"></div>
      </div>

      <div class="form-section" id="v2-section">
        <div class="form-section-head"><span class="form-section-num">04</span><span class="form-section-title">V2 · optional 15M CHoCH</span><span class="form-section-sub">Used occasionally, not every trade</span></div>
        <div class="check-grid">
          <label class="check-toggle v2-check"><input type="checkbox" name="choch_used" ${checks.choch_used ? 'checked' : ''}>15M CHoCH was checked</label>
          <label class="check-toggle v2-check"><input type="checkbox" name="choch_present" ${checks.choch_present ? 'checked' : ''}>15M CHoCH was present</label>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-head"><span class="form-section-num">05</span><span class="form-section-title">Annotated charts</span><span class="form-section-sub">Multiple images supported</span></div>
        ${existingCharts.length ? `<div class="modal-note" style="margin-bottom:9px">${icon('camera', 12)}${existingCharts.length} existing chart${existingCharts.length === 1 ? '' : 's'} already attached and preserved. Add more below if needed.</div>` : ''}
        <div class="dropzone" id="trade-dropzone">
          ${icon('upload', 21)}
          <div class="dropzone-title">Drop annotated screenshots here</div>
          <div class="dropzone-sub">PNG, JPG or WEBP · up to 8 MB each · originals preserved</div>
          <input type="file" id="trade-chart-input" accept="image/png,image/jpeg,image/webp" multiple hidden>
        </div>
        <div class="upload-previews" id="trade-upload-previews"></div>
      </div>

      <div class="form-section">
        <div class="form-section-head"><span class="form-section-num">06</span><span class="form-section-title">Review &amp; notes</span></div>
        <div class="form-grid">
          <div class="field"><label>Setup grade (optional)</label><select name="setup_grade"><option value="">Auto / ungraded</option>${['A+','A','B','C'].map((g) => `<option value="${g}" ${trade?.setup_grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="field"><label>Manual confidence</label><div class="field-suffix"><input name="grade_confidence" type="number" min="0" max="100" step="1" value="${Math.round(Number(trade?.grade_confidence || 0) * 100)}"><span>%</span></div></div>
          <div class="field full"><label>Notes</label><textarea name="notes" placeholder="What did the chart show? Was the first tap clean? Did you wait for the second tap?">${esc(trade?.notes || '')}</textarea></div>
        </div>
        <div class="modal-note" style="margin-top:10px">${icon('lock', 12)}Uploaded files are stored as original screenshots. AI analysis runs separately and never alters the source image.</div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="small-note" id="trade-save-note">${isEdit ? 'Changes update the saved record.' : 'Statistics update automatically after saving.'}</span>
      <div class="right"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('check', 13)}${isEdit ? 'Save changes' : 'Save trade'}</button></div>
    </div>
  </form>`, 'wide');
  bindTradeModal(trade);
}

function bindTradeModal(trade) {
  const dropzone = document.getElementById('trade-dropzone');
  const input = document.getElementById('trade-chart-input');
  if (!dropzone || !input) return;
  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    addUploadFiles(event.dataTransfer.files);
  });
  input.addEventListener('change', () => addUploadFiles(input.files));
  renderUploadPreviews();

  const form = document.getElementById('trade-form');
  if (!form) return;
  const recalc = () => {
    const entry = Number(form.elements.entry?.value);
    const sl = Number(form.elements.sl?.value);
    const tp = Number(form.elements.tp?.value);
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const preview = document.getElementById('rr-preview');
    if (preview) preview.textContent = risk > 0 && reward > 0 ? `Planned RR ${fmtNum(reward / risk, 2)}:1` : 'Planned RR —';
    const riskPct = Number(form.elements.risk_percent?.value);
    const balance = Number(state.dashboard?.balance || state.settings?.starting_balance || 0);
    const amount = form.elements.risk_amount;
    if (amount && !amount.dataset.touched && riskPct > 0) amount.value = (balance * riskPct / 100).toFixed(2);
    const v2 = form.querySelector('input[name="strategy_version"]:checked')?.value === 'V2';
    const v2Section = document.getElementById('v2-section');
    if (v2Section) v2Section.style.opacity = v2 ? '1' : '.55';
  };
  ['entry','sl','tp','risk_percent'].forEach((name) => form.elements[name]?.addEventListener('input', recalc));
  form.querySelectorAll('input[name="strategy_version"]').forEach((el) => el.addEventListener('change', recalc));
  form.elements.risk_amount?.addEventListener('input', (event) => { event.target.dataset.touched = 'true'; });
  recalc();
}

export async function addUploadFiles(files) {
  const valid = [...files].filter((file) => /^image\/(png|jpeg|webp)$/.test(file.type) && file.size <= 8 * 1024 * 1024);
  if (!valid.length) {
    toast('Use PNG, JPG or WEBP images under 8 MB.', 'error');
    return;
  }
  for (const file of valid.slice(0, 10 - state.uploadFiles.length)) {
    const dataUrl = await fileToDataUrl(file);
    state.uploadFiles.push({ name: file.name, dataUrl, size: file.size });
  }
  renderUploadPreviews();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function renderUploadPreviews() {
  const root = document.getElementById('trade-upload-previews');
  if (!root) return;
  root.innerHTML = state.uploadFiles.map((file, index) => `<div class="upload-preview">
    <img src="${file.dataUrl}" alt="${esc(file.name)}">
    <button type="button" data-action="remove-upload" data-index="${index}" title="Remove">${icon('x', 10)}</button>
    <span>${esc(file.name)}</span>
  </div>`).join('');
}

export function removeUpload(index) {
  state.uploadFiles.splice(index, 1);
  renderUploadPreviews();
}

export async function submitTradeForm(form) {
  const fd = new FormData(form);
  const pair = String(fd.get('pair') || '').trim().toUpperCase();
  if (!pair) throw new Error('Pair is required');
  if (!fd.get('entry') || !fd.get('sl') || !fd.get('tp')) throw new Error('Entry, stop loss and take profit are required');
  const tradeDate = fd.get('trade_date');
  const body = {
    pair,
    trade_date: tradeDate ? new Date(tradeDate).toISOString() : new Date().toISOString(),
    direction: fd.get('direction'),
    trend: fd.get('trend'),
    strategy_version: fd.get('strategy_version'),
    entry: Number(fd.get('entry')),
    sl: Number(fd.get('sl')),
    tp: Number(fd.get('tp')),
    lot_size: Number(fd.get('lot_size') || 0),
    risk_percent: Number(fd.get('risk_percent') || 0),
    risk_amount: Number(fd.get('risk_amount') || 0),
    actual_rr: Number(fd.get('actual_rr') || 0),
    result: fd.get('result'),
    news: form.elements.news?.checked || false,
    news_event: fd.get('news_event') || '',
    notes: fd.get('notes') || '',
    setup_grade: fd.get('setup_grade') || '',
    grade_confidence: Number(fd.get('grade_confidence') || 0) / 100,
    ob_detected: form.elements.ob_detected?.checked || false,
    shortened_zone: form.elements.shortened_zone?.checked || false,
    first_tap: form.elements.first_tap?.checked || false,
    fvg: form.elements.fvg?.checked || false,
    wick_fvg: form.elements.wick_fvg?.checked || false,
    imbalance: form.elements.imbalance?.checked || false,
    second_tap: form.elements.second_tap?.checked || false,
    choch_used: form.elements.choch_used?.checked || false,
    choch_present: form.elements.choch_present?.checked || false,
    charts: state.uploadFiles.map((file) => ({ name: file.name, dataUrl: file.dataUrl }))
  };
  const editing = state.editingId;
  const response = editing
    ? await api(`/api/trades/${editing}`, { method: 'PUT', body })
    : await api('/api/trades', { method: 'POST', body });
  const saved = response.trade;
  const chartCount = body.charts.length;
  closeModal();
  toast(editing ? 'Trade updated.' : 'Trade saved to your journal.', 'success');
  if (chartCount && state.ai?.online) {
    api(`/api/trades/${saved.id}/analyze`, { method: 'POST' }).catch(() => {});
    toast('AI chart review queued.', 'info');
  }
  return saved;
}

export function openCorrectionModal(trade) {
  openModal(`<form id="correction-form" data-trade-id="${trade.id}">
    <div class="modal-head">
      <div><div class="modal-title">Correct chart interpretation</div><div class="modal-sub">${pairLabel(trade.pair)} · manual corrections override the AI grade</div></div>
      <button class="btn btn-icon btn-ghost modal-close" type="button" data-action="close-modal">${icon('x', 15)}</button>
    </div>
    <div class="modal-body">
      <div class="modal-note" style="margin-bottom:14px">${icon('info', 12)}Only change a field when you can verify it on the original chart. The AI review is kept as a historical record; this correction becomes the journal's source of truth.</div>
      <div class="form-section" style="padding-top:0">
        <div class="form-section-head"><span class="form-section-title">Verified setup</span></div>
        <div class="check-grid">
          <label class="check-toggle"><input type="checkbox" name="ob_detected" ${trade.ob_detected ? 'checked' : ''}>1H Order Block</label>
          <label class="check-toggle"><input type="checkbox" name="shortened_zone" ${trade.shortened_zone ? 'checked' : ''}>Shortened 50% zone</label>
          <label class="check-toggle"><input type="checkbox" name="first_tap" ${trade.first_tap ? 'checked' : ''}>First tap</label>
          <label class="check-toggle"><input type="checkbox" name="second_tap" ${trade.second_tap ? 'checked' : ''}>Second tap entry</label>
          <label class="check-toggle"><input type="checkbox" name="fvg" ${trade.fvg ? 'checked' : ''}>FVG</label>
          <label class="check-toggle"><input type="checkbox" name="wick_fvg" ${trade.wick_fvg ? 'checked' : ''}>Wick FVG</label>
          <label class="check-toggle"><input type="checkbox" name="imbalance" ${trade.imbalance ? 'checked' : ''}>Imbalance</label>
          <label class="check-toggle v2-check"><input type="checkbox" name="choch_used" ${trade.choch_used ? 'checked' : ''}>15M CHoCH used</label>
          <label class="check-toggle v2-check"><input type="checkbox" name="choch_present" ${trade.choch_present ? 'checked' : ''}>15M CHoCH present</label>
        </div>
      </div>
      <div class="form-section">
        <div class="form-grid">
          <div class="field"><label>Corrected grade</label><select name="setup_grade"><option value="">Keep current</option>${['A+','A','B','C'].map((g) => `<option value="${g}" ${trade.setup_grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="field"><label>Confidence</label><div class="field-suffix"><input name="grade_confidence" type="number" min="0" max="100" value="${Math.round(Number(trade.grade_confidence || 0) * 100)}"><span>%</span></div></div>
          <div class="field full"><label>Correction note</label><textarea name="correction_note" placeholder="What did the AI misread? What does the chart actually show?"></textarea></div>
        </div>
      </div>
    </div>
    <div class="modal-foot"><span class="small-note">The original AI analysis stays attached to the trade.</span><div class="right"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${icon('check', 13)}Save correction</button></div></div>
  </form>`, 'narrow');
}

export async function submitCorrectionForm(form) {
  const tradeId = form.dataset.tradeId;
  const fd = new FormData(form);
  const trade = state.trades.find((t) => t.id === tradeId);
  if (!trade) throw new Error('Trade not found');
  const correction = {
    note: String(fd.get('correction_note') || ''),
    corrected_at: new Date().toISOString(),
    corrected_by: 'manual'
  };
  await api(`/api/trades/${tradeId}`, {
    method: 'PUT',
    body: {
      ob_detected: form.elements.ob_detected?.checked || false,
      shortened_zone: form.elements.shortened_zone?.checked || false,
      first_tap: form.elements.first_tap?.checked || false,
      second_tap: form.elements.second_tap?.checked || false,
      fvg: form.elements.fvg?.checked || false,
      wick_fvg: form.elements.wick_fvg?.checked || false,
      imbalance: form.elements.imbalance?.checked || false,
      choch_used: form.elements.choch_used?.checked || false,
      choch_present: form.elements.choch_present?.checked || false,
      setup_grade: fd.get('setup_grade') || trade.setup_grade,
      grade_confidence: Number(fd.get('grade_confidence') || 0) / 100,
      manual_corrections: correction
    }
  });
  closeModal();
  toast('Manual correction saved.', 'success');
}

export function updatePositionCalculator() {
  const balance = Number(document.getElementById('calc-balance')?.value || 0);
  const riskPct = Number(document.getElementById('calc-risk')?.value || 0);
  const stop = Number(document.getElementById('calc-stop')?.value || 0);
  const pip = Number(document.getElementById('calc-pip')?.value || 10);
  const money = balance * riskPct / 100;
  const lots = stop > 0 && pip > 0 ? money / (stop * pip) : 0;
  const lotEl = document.getElementById('calc-lot');
  const moneyEl = document.getElementById('calc-money');
  const stopEl = document.getElementById('calc-stop-out');
  if (lotEl) lotEl.textContent = lots > 0 ? lots.toFixed(2) : '0.00';
  if (moneyEl) moneyEl.textContent = fmtMoney(money, 2);
  if (stopEl) stopEl.textContent = `${fmtNum(stop, 1)} pips`;
}
