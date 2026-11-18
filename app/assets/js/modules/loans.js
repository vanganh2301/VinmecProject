/* Sổ vay thuốc – Nhà thuốc Y001 ↔ Kho nội trú Y003
   - Màn đầu (#/loans): nút "Tạo mã vay mới" + danh sách theo MÃ VAY (mỗi mã vay gồm nhiều thuốc).
   - Tạo mã vay (#/loans/new): quét mã thuốc → nhập số lượng → quét tiếp… → "Hoàn thành vay thuốc"
     → người vay / người cho vay → Lưu. Đang dở được giữ ở localStorage (vmhub.loanDraft.<userId>).
   - Chi tiết (#/loans/VAY-…): thông số (mã SAP, lô, HSD, ghi chú) và lịch sử truy xuất của từng thuốc, gạch sổ từng thuốc.
   Dữ liệu: mỗi thuốc là 1 dòng trong state.loans, cùng `group` = mã vay; trạng thái / gạch sổ / file điều chuyển tính theo dòng. */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, num } = VM;
  const S = () => VM.store.state;
  const ST = {
    pending: { label: 'Chờ xác nhận', cls: 'warn', ic: 'hourglass' },
    open: { label: 'Chưa gạch sổ', cls: 'info', ic: 'clock' },
    partial: { label: 'Gạch một phần', cls: 'pri', ic: 'refresh' },
    settled: { label: 'Đã gạch sổ', cls: 'ok', ic: 'check' },
    cancelled: { label: 'Đã hủy', cls: '', ic: 'x' },
  };
  const TABS = ['open', 'overdue', 'pending', 'settled', 'cancelled', 'all'];
  const f = { q: '', tab: 'open', store: '' };
  let selected = new Set();   // mã vay đang chọn ở danh sách
  let mode = 'list';          // 'list' | 'new' | 'detail'
  let detailCode = '', justCreated = '';
  let D = null, pend = null;  // D = mã vay đang tạo; pend = thuốc vừa quét, chờ nhập số lượng

  const status = VM.store.loanStatus, remaining = VM.store.loanRemaining, overdue = VM.store.loanOverdue;
  const group = VM.store.loanGroup, vOpen = VM.store.voucherOpen;
  const isOpen = l => ['pending', 'open', 'partial'].includes(status(l));
  const unitL = u => String(u || '').toLowerCase();
  const vLines = code => S().loans.filter(l => group(l) === code).sort((a, b) => (a.line || 0) - (b.line || 0));
  const voucher = code => VM.store.loanVouchers(vLines(code))[0] || null;
  const refresh = () => { if (mode === 'list') draw(); else if (mode === 'detail') drawDetail(); VM.ui.renderNav(); };
  const typing = () => /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || $('#modalRoot').children.length || (VM.tour && VM.tour.active);

  function render(view, top, arg) {
    pend = null;
    if (arg === 'new') { mode = 'new'; return renderNew(view, top); }
    if (/^VAY-/i.test(arg || '')) { mode = 'detail'; detailCode = arg.toUpperCase(); return renderDetail(view, top); }
    mode = 'list';
    return renderList(view, top, arg);
  }

  // =====================================================================
  // 1. MÀN ĐẦU: Tạo mã vay mới + danh sách mã vay
  // =====================================================================
  function renderList(view, top, arg) {
    selected = new Set();
    if (TABS.includes(arg)) f.tab = arg;
    top.innerHTML = `<button class="btn" id="lStats" title="Thuốc vay thường xuyên theo ngày / tuần / tháng, dự báo nhu cầu">${icon('trend')}<span class="label">Thống kê</span></button>
      <button class="btn" id="lPrint">${icon('printer')}<span class="label">In sổ</span></button>
      <button class="btn" id="lXls">${icon('download')}<span class="label">Xuất Excel</span></button>
      <button class="btn primary" id="lSap" title="Xuất danh sách cần điều chuyển theo cột của tool điều chuyển nội viện">${icon('sheet')}<span class="label">File điều chuyển SAP</span></button>`;
    const d = draftLoad();
    view.innerHTML = `<div class="loan-top">
        <button type="button" class="card new-loan ${d ? 'resume' : ''}" id="lNew">
          <span class="nlh-ic">${icon(d ? 'edit' : 'plus', 'l')}</span>
          <span class="nlh-t"><b>${d ? 'Tiếp tục mã vay đang tạo' : 'Tạo mã vay mới'}</b>
            <small>${d ? `${d.items.length} thuốc đã quét, chưa lưu – bấm để làm tiếp` : 'Quét mã thuốc → nhập số lượng → Hoàn thành → ghi người vay, người cho vay'}</small></span>
          <span class="nlh-code"><small>Mã sẽ tạo</small><b class="mono">${esc(VM.store.loanCode(true))}</b></span>
          <kbd class="hide-m" title="Phím tắt">N</kbd>
        </button>
        <div class="kpis compact" id="lKpis"></div>
      </div>
      <div class="card">
        <div class="toolbar">
          <div class="input-icon grow">${icon('search')}<input class="input" id="lQ" type="search" placeholder="Mã vay, thuốc, người vay, số CT SAP…" value="${esc(f.q)}"></div>
          <select class="select" id="lStore" aria-label="Lọc theo kho"><option value="">Cả 2 kho</option>${VM.store.loanStores().map(s => `<option value="${esc(s.code)}" ${f.store === s.code ? 'selected' : ''}>${esc(s.code)} – ${esc(s.name)}</option>`).join('')}</select>
        </div>
        <div class="toolbar" style="padding:10px 18px"><div class="seg" id="lTabs"></div><div id="lBulk" style="margin-left:auto"></div></div>
        <div class="table-wrap" id="lTable"></div>
      </div>`;
    $('#lNew').onclick = () => VM.ui.go('loans/new');
    $('#lQ').oninput = VM.debounce(() => { f.q = $('#lQ').value; draw(); }, 150);
    $('#lStore').onchange = e => { f.store = e.target.value; draw(); };
    $('#lSap').onclick = () => exportTransfer();
    $('#lXls').onclick = exportXls;
    $('#lPrint').onclick = printBook;
    $('#lStats').onclick = () => VM.ui.go('loanstats');
    draw();
    const key = e => { if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !typing()) { e.preventDefault(); VM.ui.go('loans/new'); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }

  function filtered() {
    let vs = VM.store.loanVouchers().filter(v => {
      if (f.tab === 'open' && !vOpen(v)) return false;
      if (f.tab === 'overdue' && !v.overdue) return false;
      if (['pending', 'settled', 'cancelled'].includes(f.tab) && v.status !== f.tab) return false;
      if (f.store && v.from !== f.store && v.to !== f.store) return false;
      return true;
    });
    if (f.q.trim()) {
      const q = VM.normalize(f.q);
      vs = vs.filter(v => [v.code, v.borrower, v.lender, ...v.lines.flatMap(l => [l.name, l.sap, l.itemCode, l.lot, l.note, ...(l.returns || []).map(r => r.ref)])].some(x => VM.normalize(x).includes(q)));
    }
    return vs;
  }

  function draw() {
    if (!$('#lTable')) return;
    const all = VM.store.loanVouchers();
    const open = all.filter(vOpen), od = open.filter(v => v.overdue), pend_ = all.filter(v => v.status === 'pending');
    const today = VM.ymd();
    const settledToday = all.filter(v => v.lines.some(l => (l.returns || []).some(r => VM.ymd(r.at) === today)));
    $('#lKpis').innerHTML = [
      ['open', 'info', 'clock', 'Mã vay chưa gạch', open.length, ''],
      ['overdue', od.length ? 'danger' : '', 'alert', `Quá ${S().settings.loanOverdueHours} giờ`, od.length, od.length ? 'color:var(--danger)' : ''],
      ['pending', 'warn', 'hourglass', 'Chờ xác nhận', pend_.length, ''],
      ['settled', '', 'checkc', 'Có gạch sổ hôm nay', settledToday.length, ''],
    ].map(([t, cls, ic, label, n, style]) => `<button type="button" class="card kpi" data-kt="${t}"><div class="kpi-ic ${cls}">${icon(ic)}</div><div><span>${label}</span><strong style="${style}">${n}</strong></div></button>`).join('');
    $$('#lKpis [data-kt]').forEach(b => b.onclick = () => { f.tab = b.dataset.kt; selected.clear(); draw(); });
    const tabs = [['open', 'Chưa gạch', open.length], ['overdue', 'Quá hạn', od.length], ['pending', 'Chờ xác nhận', pend_.length], ['settled', 'Đã gạch', all.filter(v => v.status === 'settled').length], ['cancelled', 'Đã hủy', all.filter(v => v.status === 'cancelled').length], ['all', 'Tất cả', all.length]];
    $('#lTabs').innerHTML = tabs.map(([k, l, n]) => `<button data-t="${k}" class="${f.tab === k ? 'active' : ''}">${l} <span class="cnt">${n}</span></button>`).join('');
    $$('#lTabs [data-t]').forEach(b => b.onclick = () => { f.tab = b.dataset.t; selected.clear(); draw(); });
    const list = filtered();
    selected.forEach(c => { if (!list.some(v => v.code === c && vOpen(v))) selected.delete(c); });
    $('#lBulk').innerHTML = selected.size ? `<span class="muted small" style="margin-right:8px">Đã chọn ${selected.size} mã vay</span><button class="btn primary sm" id="lBulkSettle">${icon('check', 's')} Gạch sổ đã chọn</button>` : '';
    if ($('#lBulkSettle')) $('#lBulkSettle').onclick = () => openSettle(S().loans.filter(l => selected.has(group(l)) && isOpen(l)).map(l => l.id));
    if (!list.length) {
      $('#lTable').innerHTML = VM.ui.empty(f.tab === 'open' ? 'checkc' : 'swap', f.tab === 'open' ? 'Không còn mã vay chưa gạch' : 'Không có mã vay', f.tab === 'open' ? 'Sổ vay đã được gạch hết.' : 'Thử đổi bộ lọc.');
      return;
    }
    $('#lTable').innerHTML = `<table class="t v-table"><thead><tr><th style="width:40px"><input type="checkbox" id="lAll" aria-label="Chọn tất cả"></th><th>Mã vay · chiều vay</th><th>Thuốc vay</th><th class="hide-m">Người vay ← cho vay</th><th>Trạng thái</th></tr></thead><tbody>
      ${list.map(v => {
        const st = ST[v.status], act = v.lines.filter(l => !l.cancelled), doneN = act.filter(l => status(l) === 'settled').length;
        const show = v.lines.slice(0, 3), more = v.lines.length - show.length;
        return `<tr class="clickable ${v.status === 'settled' || v.status === 'cancelled' ? 'done' : ''} ${justCreated === v.code ? 'flash' : ''}" data-code="${esc(v.code)}">
          <td onclick="event.stopPropagation()"><input type="checkbox" data-sel="${esc(v.code)}" ${selected.has(v.code) ? 'checked' : ''} ${vOpen(v) ? '' : 'disabled'} aria-label="Chọn ${esc(v.code)}"></td>
          <td style="white-space:nowrap"><span class="mono strong">${esc(v.code)}</span><div class="t-sub xd">${VM.fmtDT(v.createdAt)}</div><div class="flow" style="margin-top:5px"><span class="store">${esc(v.from)}</span>${icon('arrowr', 's')}<span class="store">${esc(v.to)}</span></div></td>
          <td><div class="v-cnt xd"><b>${v.lines.length}</b> thuốc</div>
            <ul class="v-items">${show.map(l => `<li class="${['settled', 'cancelled'].includes(status(l)) ? 'off' : ''}"><span class="nm">${esc(l.name)}</span><span class="q">${num(l.qty)} ${esc(unitL(l.unit))}</span></li>`).join('')}</ul>
            ${more > 0 ? `<div class="t-sub">+ ${more} thuốc khác</div>` : ''}
            <div class="t-sub show-m">${icon('user', 's')} ${esc(v.borrower)} ← ${esc(v.lender)}</div></td>
          <td class="hide-m"><div class="t-title">${esc(v.borrower)}</div><div class="t-sub">← ${esc(v.lender)}</div></td>
          <td onclick="event.stopPropagation()"><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${VM.ui.pill(st.cls, st.label, st.ic)}${v.overdue ? VM.ui.pill('bad', 'Quá hạn ' + VM.ago(v.createdAt).replace(' trước', ''), 'alert') : ''}</div>
            ${v.status === 'partial' ? `<div class="xd"><div class="t-sub" style="margin-top:4px">Đã gạch ${doneN}/${act.length} thuốc</div><div class="progress"><i style="width:${act.length ? doneN / act.length * 100 : 0}%"></i></div></div>` : ''}
            ${vOpen(v) ? `<div class="actions" style="margin-top:8px;justify-content:flex-start;flex-wrap:wrap">
              ${v.status === 'pending' ? `<button class="btn sm" data-confirm="${esc(v.code)}">${icon('checkc', 's')} Xác nhận</button>` : ''}
              <button class="btn tonal sm" data-settle="${esc(v.code)}" title="Đã điều chuyển trên SAP">${icon('check', 's')} Gạch sổ</button></div>` : ''}</td></tr>`;
      }).join('')}</tbody></table>`;
    $$('#lTable tr[data-code]').forEach(tr => tr.onclick = () => VM.ui.go('loans/' + tr.dataset.code));
    $$('#lTable [data-settle]').forEach(b => b.onclick = () => openSettle(vLines(b.dataset.settle).filter(isOpen).map(l => l.id)));
    $$('#lTable [data-confirm]').forEach(b => b.onclick = () => confirmVoucher(b.dataset.confirm));
    $$('#lTable [data-sel]').forEach(c => c.onchange = () => { c.checked ? selected.add(c.dataset.sel) : selected.delete(c.dataset.sel); draw(); });
    const all2 = $('#lAll');
    if (all2) { const ok = list.filter(vOpen); all2.checked = ok.length > 0 && ok.every(v => selected.has(v.code)); all2.onchange = () => { ok.forEach(v => all2.checked ? selected.add(v.code) : selected.delete(v.code)); draw(); }; }
    justCreated = '';
  }

  // =====================================================================
  // 2. TẠO MÃ VAY: quét thuốc → số lượng → … → Hoàn thành → người vay / cho vay
  // =====================================================================
  const DKEY = () => 'vmhub.loanDraft.' + ((VM.store.currentUser() || {}).id || 'guest');
  function draftLoad() { try { const d = JSON.parse(localStorage.getItem(DKEY()) || 'null'); return d && Array.isArray(d.items) && d.items.length ? d : null; } catch (_) { return null; } }
  function draftSave() { try { if (D && D.items.length) localStorage.setItem(DKEY(), JSON.stringify(D)); else localStorage.removeItem(DKEY()); } catch (_) { } }
  function draftClear() { try { localStorage.removeItem(DKEY()); } catch (_) { } }
  function defaultDir() {
    const u = VM.store.currentUser();
    const myStore = (S().staff.find(s => s.id === u.id) || {}).store || 'Y001';
    const [A, B] = VM.store.LOAN_STORES;
    const to = myStore === B ? B : A; // kho của người đang trong ca là bên nhận (vay)
    return { from: to === A ? B : A, to };
  }

  function renderNew(view, top) {
    const u = VM.store.currentUser();
    D = draftLoad() || Object.assign({ items: [], step: 'scan', borrower: u.name, lender: '', confirmed: false }, defaultDir());
    if (!VM.store.LOAN_STORES.includes(D.from) || !VM.store.LOAN_STORES.includes(D.to)) Object.assign(D, defaultDir());
    top.innerHTML = `<button class="btn" id="lBack">${icon('chevl')}<span class="label">Về sổ vay</span></button>`;
    view.innerHTML = `<div class="nl-wrap"><div class="card nl-card" id="loanForm">
        <div class="nl-head">
          <div class="nl-id"><div class="kpi-ic info">${icon('swap')}</div><div><small>Mã vay mới</small><b class="mono" id="nlCode"></b></div></div>
          <ol class="nl-steps" id="nlSteps">
            <li data-s="scan"><span class="stp">1</span><span>Quét thuốc &amp; số lượng</span></li>
            <li data-s="who"><span class="stp">2</span><span>Người vay / cho vay</span></li>
          </ol>
        </div>
        <div class="nl-body" id="nlBody"></div>
      </div></div>`;
    $('#lBack').onclick = () => VM.ui.go('loans');
    drawNew();
    const key = e => {
      if (VM.tour && VM.tour.active) return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#modalRoot').children.length) { e.preventDefault(); D.step === 'scan' ? finishScan() : saveVoucher(); return; }
      if ((e.key === 'F2' || (e.key === '/' && !typing())) && D.step === 'scan' && !pend) { e.preventDefault(); const i = $('#lItem'); if (i) i.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }

  function drawNew() {
    $('#nlCode').textContent = VM.store.loanCode(true);
    $$('#nlSteps li').forEach(li => { li.classList.toggle('on', li.dataset.s === D.step); li.classList.toggle('done', D.step === 'who' && li.dataset.s === 'scan'); });
    if (D.step === 'who') drawWho(); else drawScan();
  }

  // ---- Bước 1: quét thuốc ----
  function drawScan() {
    pend = null;
    $('#nlBody').innerHTML = `
      <div class="nl-sec nl-scan" id="nlScanBox">
        <div class="step-l">${icon('scan', 's')} Quét mã thuốc / vật tư</div>
        <div class="scan-row">
          <div class="input-icon scan-in">${icon('scan')}<input class="input" id="lItem" autocomplete="off" placeholder="Quét mã vạch / DataMatrix hoặc gõ tên thuốc"></div>
          <button class="btn icon" id="lScan" title="Quét bằng camera" aria-label="Quét bằng camera">${icon('qr')}</button>
        </div>
        <div class="muted small">Quét xong sẽ hỏi số lượng. Quét lại cùng thuốc (cùng lô) thì cộng dồn.</div>
      </div>
      <div class="nl-sec nl-qty hidden" id="nlQty" aria-live="polite"></div>
      <div class="nl-list" id="nlList">
        <div class="nl-list-h"><b>Thuốc trong mã vay</b><span class="cnt" id="nlCnt"></span></div>
        <div id="nlItems"></div>
      </div>
      <div class="nl-foot">
        <button class="btn ghost" id="nlCancel">${icon('trash', 's')} Hủy mã vay</button>
        <button class="btn primary xl" id="nlDone">${icon('checkc')} Hoàn thành vay thuốc <span class="nl-n" id="nlDoneN"></span></button>
      </div>`;
    const item = $('#lItem');
    VM.ui.suggest(item, {
      min: 1,
      items: q => VM.search(S().products, q, ['name', 'code', 'sap', 'ingredient'], 60).slice(0, 7).map(p => ({
        html: `<span class="tag ${p.category}">${VM.store.CATEGORIES[p.category].short}</span><span class="nm">${esc(p.name)}</span><span class="sub">${esc(VM.store.baseUnit(p).name)}</span>`,
        pick: () => askQty(p),
      })),
      beforeEnter: raw => handleScan(raw),
    });
    item.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.handled || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      if (item.value.trim()) askQty(null, null, item.value.trim()); // hàng ngoài danh mục
    });
    $('#lScan').onclick = () => openScanner(code => { if (!handleScan(code)) { item.value = code; item.focus(); VM.ui.toast('Không tìm thấy mã trong danh mục – sửa thành tên thuốc rồi Enter để ghi hàng ngoài danh mục', 'warn', 5000); } });
    $('#nlDone').onclick = finishScan;
    $('#nlCancel').onclick = cancelDraft;
    drawItems();
    setTimeout(() => { if ($('#lItem') && !pend) $('#lItem').focus(); }, 60);
  }

  // Mã quét được → hỏi số lượng. Trả về true nếu đã xử lý.
  function handleScan(raw) {
    const r = VM.store.matchScan(raw);
    if (r && r.product) { askQty(r.product, r.gs1); return true; }
    if (r && r.gs1) { VM.ui.toast(`Mã GTIN ${r.gs1.gtin} chưa có trong danh mục – gõ tên thuốc rồi Enter để ghi hàng ngoài danh mục`, 'warn', 6000); const i = $('#lItem'); if (i) { i.value = ''; i.focus(); } return true; }
    return false;
  }

  function askQty(p, g, manualName) {
    const lot = (g && g.lot) || (p && p.lot) || '';
    pend = { p, g, name: p ? p.name : manualName, lot, expiry: (g && g.expiry) || (p && p.expiry) || '' };
    const ex = findItem(pend);
    const base = p ? VM.store.baseUnit(p) : null;
    const big = p ? p.units.filter(x => x.factor > 1).sort((a, b) => b.factor - a.factor)[0] : null;
    $('#nlScanBox').classList.add('hidden');
    const box = $('#nlQty');
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="picked ${p ? '' : 'warn'}">${icon(p ? 'checkc' : 'alert', 's')}<div><b>${esc(pend.name)}</b>
        <small>${p ? `ĐVT theo danh mục: <b>${esc(base.name)}</b>${big ? ` (1 ${esc(unitL(big.name))} = ${num(big.factor)} ${esc(unitL(base.name))})` : ''}${g ? ' · đọc từ DataMatrix' : ''}` : 'Không có trong danh mục – nhập ĐVT. Mã SAP bổ sung sau ở trang chi tiết mã vay.'}</small>
        ${ex ? `<small class="nl-ex">${icon('info', 's')} Đã có ${num(ex.qty)} ${esc(unitL(ex.unit))} trong mã vay – số nhập sẽ cộng thêm</small>` : ''}</div></div>
      <div class="step-l">Số lượng vay <span class="req">*</span></div>
      <div class="qty-row">
        <div class="stepper big"><button type="button" id="lDec" aria-label="Giảm">${icon('minus', 's')}</button><input id="lQty" inputmode="numeric" value="1" aria-label="Số lượng"><button type="button" id="lInc" aria-label="Tăng">${icon('plus', 's')}</button></div>
        ${p ? `<div class="unit-fix"><b>${esc(base.name)}</b><small>ĐVT nhỏ nhất</small></div>` : `<input class="input" id="lUnitIn" autocomplete="off" placeholder="ĐVT, VD: Viên" aria-label="Đơn vị tính">`}
      </div>
      <div class="alert bad hidden" id="nqErr"></div>
      <div class="nl-qty-f">
        <button type="button" class="btn ghost" id="nqCancel">Bỏ thuốc này <kbd class="hide-m">Esc</kbd></button>
        <button type="button" class="btn primary lg" id="nqOk">${icon('plus', 's')} Thêm vào mã vay <kbd class="hide-m">Enter</kbd></button>
      </div>`;
    const qty = $('#lQty'), step = d => { qty.value = Math.max(1, Math.floor(VM.parseNum(qty.value) || 0) + d); };
    $('#lInc').onclick = () => step(1); $('#lDec').onclick = () => step(-1);
    qty.onfocus = () => qty.select();
    qty.onkeydown = e => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (!p && !$('#lUnitIn').value.trim() && /^\d{1,5}$/.test(qty.value.trim())) $('#lUnitIn').focus(); else commitQty(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQty(); }
    };
    if ($('#lUnitIn')) $('#lUnitIn').onkeydown = e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); commitQty(); } else if (e.key === 'Escape') { e.preventDefault(); closeQty(); } };
    $('#nqOk').onclick = commitQty;
    $('#nqCancel').onclick = closeQty;
    setTimeout(() => { qty.focus(); qty.select(); }, 20);
  }

  const findItem = x => D.items.find(it => x.p ? it.productId === x.p.id && (it.lot || '') === (x.lot || '') : !it.productId && VM.normalize(it.name) === VM.normalize(x.name));

  function commitQty() {
    if (!pend) return true;
    const raw = $('#lQty').value.trim();
    // Máy quét bắn mã vào ô số lượng (chưa bấm Enter cho thuốc trước) → thuốc trước giữ SL 1, mã mới là thuốc tiếp theo
    if (!/^\d{1,5}$/.test(raw) && raw.length >= 6) {
      const r = VM.store.matchScan(raw);
      if (r && (r.product || r.gs1)) {
        const prev = pend.name;
        if (pend.p || ($('#lUnitIn') && $('#lUnitIn').value.trim())) { addItem(pend, 1); VM.ui.toast(`Đã thêm ${prev} với số lượng 1 – sửa trong danh sách nếu cần`, 'warn', 5000); }
        closeQty(true);
        handleScan(raw);
        return false;
      }
    }
    const n = /^\d{1,5}$/.test(raw) ? +raw : NaN;
    const err = m => { const e = $('#nqErr'); e.innerHTML = icon('alert', 's') + '<span>' + esc(m) + '</span>'; e.classList.remove('hidden'); return false; };
    if (!(n > 0)) { $('#lQty').focus(); return err('Số lượng phải là số nguyên từ 1 trở lên'); }
    if (!pend.p && !$('#lUnitIn').value.trim()) { $('#lUnitIn').focus(); return err('Nhập đơn vị tính cho hàng ngoài danh mục'); }
    addItem(pend, n);
    closeQty();
    return true;
  }

  function addItem(x, n) {
    const ex = findItem(x);
    let key;
    if (ex) { ex.qty += n; key = ex.key; }
    else {
      key = VM.uid('d_');
      D.items.push({ key, productId: x.p ? x.p.id : '', itemCode: x.p ? x.p.code : '', sap: x.p ? (x.p.sap || '') : '', name: x.name, unit: x.p ? VM.store.baseUnit(x.p).name : $('#lUnitIn').value.trim(), qty: n, lot: x.lot, expiry: x.expiry, gs1: !!x.g });
    }
    draftSave();
    drawItems(key);
  }

  function closeQty(keepFocus) {
    pend = null;
    const box = $('#nlQty'); if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
    const sb = $('#nlScanBox'); if (sb) sb.classList.remove('hidden');
    const i = $('#lItem'); if (i) { i.value = ''; if (!keepFocus) i.focus(); }
  }

  function drawItems(flashKey) {
    const n = D.items.length;
    $('#nlCnt').textContent = n;
    $('#nlDone').disabled = !n;
    $('#nlDoneN').textContent = n ? `${n} thuốc` : '';
    if (!n) { $('#nlItems').innerHTML = `<div class="nl-empty">${icon('scan')}<b>Chưa có thuốc nào</b><span>Quét mã trên hộp thuốc để bắt đầu</span></div>`; return; }
    $('#nlItems').innerHTML = D.items.map((x, i) => `<div class="nl-row ${x.key === flashKey ? 'flash' : ''}" data-k="${x.key}">
        <span class="nl-i">${i + 1}</span>
        <div class="nl-nm"><b>${esc(x.name)}</b>${x.productId ? '' : '<small class="nl-warn">Ngoài danh mục</small>'}</div>
        <div class="stepper"><button type="button" data-dec aria-label="Giảm">${icon('minus', 's')}</button><input data-q value="${x.qty}" inputmode="numeric" aria-label="Số lượng ${esc(x.name)}"><button type="button" data-inc aria-label="Tăng">${icon('plus', 's')}</button></div>
        <span class="nl-u">${esc(unitL(x.unit))}</span>
        <button type="button" class="btn ghost icon sm" data-rm title="Bỏ thuốc này" aria-label="Bỏ ${esc(x.name)}">${icon('trash', 's')}</button>
      </div>`).join('');
    $$('#nlItems .nl-row').forEach(row => {
      const it = D.items.find(x => x.key === row.dataset.k), inp = row.querySelector('[data-q]');
      const setQ = q => { it.qty = Math.max(1, Math.min(99999, Math.floor(q) || 1)); inp.value = it.qty; draftSave(); };
      row.querySelector('[data-inc]').onclick = () => setQ(it.qty + 1);
      row.querySelector('[data-dec]').onclick = () => setQ(it.qty - 1);
      inp.onfocus = () => inp.select();
      inp.onchange = () => setQ(VM.parseNum(inp.value));
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); setQ(VM.parseNum(inp.value)); const i = $('#lItem'); if (i) i.focus(); } };
      row.querySelector('[data-rm]').onclick = () => { D.items = D.items.filter(x => x !== it); draftSave(); drawItems(); VM.ui.toast(`Đã bỏ ${it.name} khỏi mã vay`); };
    });
  }

  async function cancelDraft() {
    if (D.items.length) {
      const ok = await VM.ui.confirm({ title: 'Hủy mã vay đang tạo?', message: `${D.items.length} thuốc đã quét sẽ bị bỏ. Mã vay chưa được ghi vào sổ.`, ok: 'Hủy mã vay', danger: true });
      if (!ok) return;
    }
    draftClear(); D = null;
    VM.ui.go('loans');
    VM.ui.toast('Đã hủy mã vay đang tạo');
  }

  function finishScan() {
    if (D.step !== 'scan') return;
    if (pend && !commitQty()) return;
    if (!D.items.length) { VM.ui.toast('Quét ít nhất 1 thuốc trước khi hoàn thành', 'warn'); const i = $('#lItem'); if (i) i.focus(); return; }
    D.step = 'who'; draftSave();
    drawNew();
  }

  // ---- Bước 2: người vay / người cho vay ----
  function drawWho() {
    $('#nlBody').innerHTML = `
      <div class="nl-sum">
        <div class="nl-list-h"><b>${D.items.length} thuốc trong mã vay</b><button type="button" class="linkbtn" id="nwEdit">Sửa danh sách</button></div>
        <ol class="nl-sum-list">${D.items.map(x => `<li><span class="nm">${esc(x.name)}</span><b>${num(x.qty)} ${esc(unitL(x.unit))}</b></li>`).join('')}</ol>
      </div>
      <div class="nl-sec">
        <div class="step-l">Chiều vay <span class="muted small" style="font-weight:400">– bấm để đảo chiều</span></div>
        <div class="dir" id="lDir">
          <button type="button" class="dir-store" id="lFrom" data-code="${esc(D.from)}"></button>
          <button type="button" class="btn icon swap" id="lSwap" title="Đảo chiều" aria-label="Đảo chiều vay">${icon('swap')}</button>
          <button type="button" class="dir-store to" id="lTo" data-code="${esc(D.to)}"></button>
        </div>
      </div>
      <div class="who">
        <div class="field"><div class="step-l">Người vay <span class="req">*</span></div><input class="input" id="lBorrower" autocomplete="off" value="${esc(D.borrower)}"><div class="name-chips" data-for="lBorrower"></div></div>
        <div class="field"><div class="step-l">Người cho vay <span class="req">*</span></div><input class="input" id="lLender" autocomplete="off" value="${esc(D.lender)}" placeholder="Gõ 1–2 chữ hoặc chọn bên dưới"><div class="name-chips" data-for="lLender"></div></div>
      </div>
      <label class="check"><input type="checkbox" id="lConfirmed" ${D.confirmed ? 'checked' : ''}> Người cho vay đã xác nhận giao tại chỗ</label>
      <div class="alert bad hidden" id="lErr"></div>
      <div class="nl-foot">
        <button type="button" class="btn" id="nwBack">${icon('chevl', 's')} Thêm thuốc</button>
        <button type="button" class="btn primary xl" id="lSave">${icon('check')} Lưu mã vay <kbd class="hide-m">Enter</kbd></button>
      </div>`;
    const back = () => { keepWho(); D.step = 'scan'; draftSave(); drawNew(); };
    $('#nwEdit').onclick = $('#nwBack').onclick = back;
    const flip = () => { const a = D.from; D.from = D.to; D.to = a; draftSave(); drawDir(); };
    $('#lSwap').onclick = $('#lFrom').onclick = $('#lTo').onclick = flip;
    drawDir();
    personField($('#lBorrower'), () => { $('#lLender').focus(); });
    personField($('#lLender'), saveVoucher);
    ['#lBorrower', '#lLender'].forEach(s => $(s).addEventListener('input', () => { keepWho(); draftSave(); }));
    $('#lConfirmed').onchange = () => { keepWho(); draftSave(); };
    drawNameChips();
    $('#lSave').onclick = saveVoucher;
    setTimeout(() => { const l = $('#lLender'); if (l) l.focus(); }, 60);
  }
  function keepWho() { if (!$('#lBorrower')) return; D.borrower = $('#lBorrower').value.trim(); D.lender = $('#lLender').value.trim(); D.confirmed = $('#lConfirmed').checked; }
  function drawDir() {
    $('#lFrom').dataset.code = D.from; $('#lTo').dataset.code = D.to;
    ['#lFrom', '#lTo'].forEach((sel, k) => { const el = $(sel), c = el.dataset.code; el.innerHTML = `<small>${k ? 'Vay (nhận)' : 'Cho vay (xuất)'}</small><b>${esc(c)}</b><span>${esc(VM.store.storeName(c))}</span>`; el.setAttribute('aria-label', `${k ? 'Kho nhận' : 'Kho xuất'} ${c} – bấm để đảo chiều`); });
  }
  function personField(input, next) {
    VM.ui.suggest(input, {
      head: q => q.trim() ? 'Tên phù hợp' : `${icon('user', 's')} Hay ghi gần đây`,
      items: q => {
        const all = VM.store.peopleFreq();
        const list = q.trim() ? VM.search(all, q, ['name'], 55) : all;
        return list.filter(x => x.name !== input.value || q.trim()).slice(0, 6).map(x => ({
          html: `<span class="avatar" style="width:28px;height:28px;font-size:11px">${esc(VM.initials(x.name))}</span><span class="nm">${esc(x.name)}</span><span class="sub">${esc((S().staff.find(s => s.name === x.name) || {}).role || '')}</span>`,
          pick: () => { input.value = x.name; keepWho(); draftSave(); next(); },
        }));
      },
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.handled && !e.ctrlKey && !e.metaKey) { e.preventDefault(); next(); } });
  }
  function drawNameChips() {
    const me = (VM.store.currentUser() || {}).name;
    const top = VM.store.peopleFreq().slice(0, 4);
    $$('.name-chips').forEach(box => {
      const inp = $('#' + box.dataset.for);
      box.innerHTML = top.filter(x => x.name !== me || box.dataset.for === 'lBorrower').slice(0, 3).map(x => `<button type="button" class="name-chip" data-n="${esc(x.name)}">${esc(x.name.replace(/^DS\.\s*/, ''))}</button>`).join('');
      $$('[data-n]', box).forEach(b => b.onclick = () => { inp.value = b.dataset.n; keepWho(); draftSave(); (box.dataset.for === 'lBorrower' ? $('#lLender') : $('#lSave')).focus(); });
    });
  }

  function saveVoucher() {
    if (D.step !== 'who' || !$('#lBorrower')) return;
    keepWho();
    const errs = [];
    if (!D.items.length) errs.push('Mã vay chưa có thuốc nào');
    if (D.from === D.to) errs.push('Bên cho vay và bên vay phải khác nhau');
    if (!D.borrower) errs.push('Nhập người vay');
    if (!D.lender) errs.push('Nhập người cho vay');
    if (D.borrower && D.borrower === D.lender) errs.push('Người vay và người cho vay trùng nhau');
    if (errs.length) { const e = $('#lErr'); e.innerHTML = icon('alert', 's') + '<span>' + errs.map(esc).join(' · ') + '</span>'; e.classList.remove('hidden'); (!D.lender ? $('#lLender') : $('#lBorrower')).focus(); return; }
    const u = VM.store.currentUser(), code = VM.store.loanCode(), at = VM.iso(), conf = D.confirmed;
    D.items.forEach((x, i) => S().loans.push({
      id: VM.uid('l_'), group: code, line: i + 1, code: `${code}/${i + 1}`, createdAt: at, createdBy: u.name, from: D.from, to: D.to,
      productId: x.productId, itemCode: x.itemCode, sap: x.sap, name: x.name, unit: x.unit, qty: x.qty, lot: x.lot, expiry: x.expiry,
      borrower: D.borrower, lender: D.lender, note: '', confirmedBy: conf ? D.lender : '', confirmedAt: conf ? at : '', returns: [], cancelled: false,
    }));
    const n = D.items.length;
    VM.store.log('Tạo mã vay', 'Sổ vay', `${n} thuốc · ${D.from} → ${D.to} · ${D.borrower} ← ${D.lender}`, code);
    VM.store.save('loan');
    VM.ui.done(`Đã tạo mã vay ${code}`, `${n} thuốc · ${D.from} → ${D.to}${conf ? '' : ' · chờ bên cho vay xác nhận'}`, { action: { label: 'Xem chi tiết', fn: () => VM.ui.go('loans/' + code) } });
    draftClear(); D = null; justCreated = code; f.tab = 'open';
    VM.ui.go('loans');
  }

  // =====================================================================
  // 3. TRANG CHI TIẾT MÃ VAY: thông số + lịch sử truy xuất từng thuốc
  // =====================================================================
  function renderDetail(view, top) {
    top.innerHTML = `<button class="btn" id="lBack">${icon('chevl')}<span class="label">Về sổ vay</span></button>
      <button class="btn" id="dPrint">${icon('printer')}<span class="label">In phiếu</span></button>
      <button class="btn" id="dSap">${icon('sheet')}<span class="label">File điều chuyển SAP</span></button>`;
    view.innerHTML = '<div class="ld" id="ldWrap"></div>';
    $('#lBack').onclick = () => VM.ui.go('loans');
    $('#dPrint').onclick = () => printVoucher(detailCode);
    $('#dSap').onclick = () => { const l = vLines(detailCode).filter(isOpen); if (!l.length) return VM.ui.toast('Mã vay này không còn thuốc nào cần điều chuyển', 'warn'); exportTransfer(l); };
    drawDetail();
  }

  function drawDetail() {
    const wrap = $('#ldWrap'); if (!wrap) return;
    const v = voucher(detailCode);
    if (!v) {
      wrap.innerHTML = `<div class="card">${VM.ui.empty('swap', 'Không tìm thấy mã vay ' + detailCode, 'Có thể mã vay đã bị xóa khi khôi phục dữ liệu.', `<button class="btn primary" id="ldHome">${icon('chevl', 's')} Về sổ vay</button>`)}</div>`;
      $('#ldHome').onclick = () => VM.ui.go('loans');
      $('#dPrint').disabled = $('#dSap').disabled = true;
      return;
    }
    const st = ST[v.status], act = v.lines.filter(l => !l.cancelled), doneN = act.filter(l => status(l) === 'settled').length;
    const canCancel = vOpen(v) && !v.lines.some(l => (l.returns || []).length);
    const pendingN = act.filter(l => !l.confirmedAt).length;
    wrap.innerHTML = `
      <div class="card ld-head">
        <div class="ld-h1">
          <div class="kpi-ic info">${icon('swap')}</div>
          <div class="ld-h1-t"><small>Mã vay</small><h2 class="mono">${esc(v.code)}</h2></div>
          <div class="ld-pills">${VM.ui.pill(st.cls, st.label, st.ic)}${v.overdue ? VM.ui.pill('bad', 'Quá hạn ' + VM.ago(v.createdAt).replace(' trước', ''), 'alert') : ''}</div>
        </div>
        <dl class="ld-meta">
          <div><dt>Chiều vay</dt><dd><span class="flow"><span class="store">${esc(v.from)}</span>${icon('arrowr', 's')}<span class="store">${esc(v.to)}</span></span><small>${esc(VM.store.storeName(v.from))} cho ${esc(VM.store.storeName(v.to))} vay</small></dd></div>
          <div><dt>Người vay</dt><dd>${esc(v.borrower)}</dd></div>
          <div><dt>Người cho vay</dt><dd>${esc(v.lender)}<small>${pendingN ? 'Chưa xác nhận giao' : `Đã xác nhận ${VM.fmtDT(v.lines[0].confirmedAt)}`}</small></dd></div>
          <div><dt>Tạo lúc</dt><dd>${VM.fmtDT(v.createdAt)}<small>${esc(v.createdBy || '')}</small></dd></div>
          <div><dt>Tiến độ gạch sổ</dt><dd>${doneN}/${act.length} thuốc<div class="progress"><i style="width:${act.length ? doneN / act.length * 100 : 0}%"></i></div></dd></div>
        </dl>
        ${vOpen(v) ? `<div class="ld-acts">
          ${canCancel ? `<button class="btn ghost danger-t" id="ldCancel" style="margin-right:auto">${icon('x', 's')} Hủy mã vay</button>` : ''}
          ${pendingN ? `<button class="btn" id="ldConfirm">${icon('checkc', 's')} Xác nhận đã giao</button>` : ''}
          <button class="btn primary" id="ldSettle">${icon('check', 's')} Gạch sổ cả mã vay</button></div>` : ''}
      </div>
      <div class="ld-sec-h"><h3>Thuốc trong mã vay <span class="cnt">${v.lines.length}</span></h3><span class="muted small">Khi đã điều chuyển trên SAP, bấm “Gạch sổ” ở từng thuốc (gạch được từng phần)</span></div>
      ${v.lines.map((l, i) => lineCard(l, i, act.length)).join('')}`;
    const on = (sel, fn) => { const b = $(sel); if (b) b.onclick = fn; };
    on('#ldSettle', () => openSettle(v.lines.filter(isOpen).map(l => l.id)));
    on('#ldConfirm', () => confirmVoucher(v.code));
    on('#ldCancel', () => cancelVoucher(v.code));
    $$('#ldWrap [data-settle]').forEach(b => b.onclick = () => openSettle([b.dataset.settle]));
    $$('#ldWrap [data-edit]').forEach(b => b.onclick = () => editLine(b.dataset.edit));
    $$('#ldWrap [data-cancel-line]').forEach(b => b.onclick = () => cancelLine(b.dataset.cancelLine));
  }

  function lineCard(l, i, activeN) {
    const s = status(l), st = ST[s], rem = remaining(l), u = unitL(l.unit);
    const miss = t => `<span class="ld-miss">${t}</span>`;
    return `<div class="card ld-line ${s === 'settled' || s === 'cancelled' ? 'is-done' : ''}" data-id="${l.id}">
      <div class="ld-l-main">
        <div class="ld-l-top">
          <span class="nl-i">${i + 1}</span>
          <div class="ld-l-nm"><b class="${s === 'cancelled' ? 'strike' : ''}">${esc(l.name)}</b>
            <div class="ld-l-pills">${VM.ui.pill(st.cls, st.label, st.ic)}${l.sapExport && isOpen(l) ? `<span title="Đã xuất file điều chuyển ${VM.fmtDT(l.sapExport.at)} – ${esc(l.sapExport.by)}">${VM.ui.pill('', 'Đã xuất ĐC', 'sheet')}</span>` : ''}</div></div>
          <div class="ld-l-q"><span class="qty-big">${num(l.qty)}</span> <span class="muted small">${esc(u)}</span>${s === 'partial' ? `<small>Còn ${num(rem)} ${esc(u)}</small><div class="progress"><i style="width:${(l.qty - rem) / l.qty * 100}%"></i></div>` : ''}</div>
        </div>
        <dl class="ld-params">
          <div><dt>Mã SAP</dt><dd class="mono">${l.sap ? esc(l.sap) : miss('Chưa có – cần để xuất file điều chuyển')}</dd></div>
          <div><dt>Mã hàng</dt><dd class="mono">${l.itemCode ? esc(l.itemCode) : miss('Ngoài danh mục')}</dd></div>
          <div><dt>Số lô</dt><dd class="mono">${esc(l.lot || '—')}</dd></div>
          <div><dt>Hạn dùng</dt><dd>${VM.fmtDate(l.expiry) || '—'}</dd></div>
          <div class="wide"><dt>Ghi chú / lưu ý</dt><dd>${l.note ? esc(l.note) : '<span class="muted">—</span>'}</dd></div>
        </dl>
        <div class="ld-l-acts">
          ${isOpen(l) ? `<button class="btn tonal sm" data-settle="${l.id}">${icon('check', 's')} Gạch sổ</button>` : ''}
          ${!l.cancelled ? `<button class="btn ghost sm" data-edit="${l.id}">${icon('edit', 's')} Sửa thông số</button>` : ''}
          ${isOpen(l) && !(l.returns || []).length && activeN > 1 ? `<button class="btn ghost sm danger-t" data-cancel-line="${l.id}">${icon('x', 's')} Hủy thuốc này</button>` : ''}
        </div>
      </div>
      <div class="ld-l-hist"><div class="label-t">Lịch sử truy xuất</div><ul class="timeline">${timeline(l).map(x => `<li class="${x.on ? 'on' : ''} ${x.cur ? 'cur' : ''}"><span class="tdot">${x.on ? icon('check') : ''}</span><b>${x.t}</b><small>${x.d || ''}</small></li>`).join('')}</ul></div>
    </div>`;
  }

  function timeline(l) {
    const s = status(l), u = esc(unitL(l.unit));
    const ev = [{ at: l.createdAt, t: 'Ghi sổ vay', d: `${esc(l.createdBy || l.borrower)} · ${VM.fmtDT(l.createdAt)}` }];
    if (l.confirmedAt) ev.push({ at: l.confirmedAt, t: 'Bên cho vay xác nhận đã giao', d: `${esc(l.confirmedBy)} · ${VM.fmtDT(l.confirmedAt)}` });
    if (l.sapExport) ev.push({ at: l.sapExport.at, t: 'Xuất file điều chuyển SAP', d: `${esc(l.sapExport.by)} · ${VM.fmtDT(l.sapExport.at)} · SL ${num(l.sapExport.qty)} · ${l.sapExport.how === 'copy' ? 'copy' : 'Excel'}` });
    (l.edits || []).forEach(e => ev.push({ at: e.at, t: 'Sửa thông số', d: `${esc(e.by)} · ${VM.fmtDT(e.at)} · ${esc(e.what)}` }));
    (l.returns || []).forEach(r => ev.push({ at: r.at, t: `Gạch sổ ${num(r.qty)} ${u}`, d: `${esc(r.by)} · ${VM.fmtDT(r.at)}${r.ref ? ` · CT SAP <span class="mono">${esc(r.ref)}</span>` : ''}${r.note ? ' · ' + esc(r.note) : ''}` }));
    ev.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const out = ev.map(x => Object.assign({ on: true }, x));
    if (s === 'cancelled') out.push({ on: false, t: 'Đã hủy', d: `${esc(l.cancelledBy || '')} · ${VM.fmtDT(l.cancelledAt)} · ${esc(l.cancelReason || '')}` });
    else if (s === 'settled') out.push({ on: true, t: 'Hoàn tất – đã gạch sổ', d: '' });
    else if (s === 'pending') out.push({ cur: true, t: 'Chờ bên cho vay xác nhận', d: esc(l.lender) });
    else out.push({ cur: true, t: `Còn ${num(remaining(l))} ${u} chưa điều chuyển`, d: overdue(l) ? '<b style="color:var(--danger)">Quá hạn</b>' : '' });
    return out;
  }

  // =====================================================================
  // Thao tác: xác nhận, gạch sổ, sửa thông số, hủy
  // =====================================================================
  async function confirmVoucher(code) {
    const lines = vLines(code).filter(l => !l.cancelled && !l.confirmedAt);
    if (!lines.length) return;
    const h = lines[0];
    const who = await VM.ui.confirm({ title: 'Xác nhận đã giao thuốc', message: `Mã vay <b class="mono">${esc(code)}</b> · ${lines.length} thuốc<br>${esc(h.from)} → ${esc(h.to)} · người vay ${esc(h.borrower)}`, ok: 'Xác nhận đã giao', ic: 'checkc', input: { label: 'Người cho vay xác nhận', required: true, value: h.lender || VM.store.currentUser().name } });
    if (!who) return;
    const at = VM.iso();
    lines.forEach(l => { l.confirmedBy = who; l.confirmedAt = at; });
    VM.store.log('Xác nhận giao (sổ vay)', 'Sổ vay', `${who} · ${lines.length} thuốc`, code);
    VM.store.save('loan-confirm');
    refresh();
    VM.ui.done('Đã xác nhận giao thành công', `${code} · ${who}`);
  }

  function openSettle(ids) {
    const lines = ids.map(id => S().loans.find(x => x.id === id)).filter(l => l && isOpen(l));
    if (!lines.length) return;
    const single = lines.length === 1, l0 = lines[0];
    const groups = [...new Set(lines.map(group))];
    const unconfirmed = lines.some(l => !l.confirmedAt);
    VM.ui.modal({
      title: 'Gạch sổ – đã điều chuyển trên SAP', ic: 'check', size: single ? '' : 'lg',
      sub: single ? `${esc(group(l0))} · ${esc(l0.name)} · ${esc(l0.from)} → ${esc(l0.to)}` : `${lines.length} thuốc · ${groups.length} mã vay`,
      body: `${single
        ? `<div class="form-grid"><div class="field c12"><label>Số lượng đã điều chuyển <span class="req">*</span></label><input class="input num" id="sQty" inputmode="numeric" value="${remaining(l0)}"><span class="hint">Còn phải hoàn: ${num(remaining(l0))} ${esc(unitL(l0.unit))}</span></div></div>`
        : `<div class="table-wrap"><table class="t"><thead><tr><th style="width:36px"><input type="checkbox" id="sAll" checked aria-label="Chọn tất cả"></th><th>Thuốc</th><th class="num">Còn lại</th><th class="num" style="width:130px">SL gạch</th></tr></thead><tbody>
            ${lines.map(l => `<tr><td><input type="checkbox" data-on="${l.id}" checked aria-label="Gạch ${esc(l.name)}"></td><td><b>${esc(l.name)}</b><div class="t-sub mono">${esc(group(l))}</div></td><td class="num">${num(remaining(l))} <span class="muted small">${esc(unitL(l.unit))}</span></td><td class="num"><input class="input num" data-q="${l.id}" inputmode="numeric" value="${remaining(l)}" aria-label="Số lượng gạch ${esc(l.name)}"></td></tr>`).join('')}</tbody></table></div>`}
        <div class="form-grid" style="margin-top:12px">
          <div class="field c6 half"><label>Số chứng từ SAP / STO</label><input class="input mono" id="sRef" placeholder="VD: 4900012345"></div>
          <div class="field c6 half"><label>Người thực hiện</label><input class="input" id="sBy" list="lStaff2" value="${esc(VM.store.currentUser().name)}"><datalist id="lStaff2">${VM.ui.staffOptions()}</datalist></div>
          <div class="field c12"><label>Ghi chú</label><input class="input" id="sNote" placeholder="VD: Đã đếm lại, khớp"></div></div>
        ${unconfirmed ? `<div class="alert warn" style="margin-top:12px">${icon('alert', 's')}<span>Có thuốc chưa được bên cho vay xác nhận. Gạch sổ sẽ đồng thời ghi nhận xác nhận.</span></div>` : ''}`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('check', 's')} Gạch sổ</button>`,
      onMount(el, close) {
        const q = s => el.querySelector(s);
        q('[data-x]').onclick = () => close();
        if (q('#sAll')) q('#sAll').onchange = e => el.querySelectorAll('[data-on]').forEach(c => { c.checked = e.target.checked; });
        q('[data-ok]').onclick = () => {
          const picks = [];
          for (const l of lines) {
            if (!single && !q(`[data-on="${l.id}"]`).checked) continue;
            const n = Math.floor(VM.parseNum(single ? q('#sQty').value : q(`[data-q="${l.id}"]`).value));
            const rem = remaining(l);
            if (!(n > 0) || n > rem) return VM.ui.toast(`${l.name}: số lượng phải từ 1 đến ${rem}`, 'bad');
            picks.push([l, n]);
          }
          if (!picks.length) return VM.ui.toast('Chọn ít nhất 1 thuốc để gạch sổ', 'warn');
          const ref = q('#sRef').value.trim(), by = q('#sBy').value.trim(), note = q('#sNote').value.trim();
          picks.forEach(([l, n]) => settle(l, n, ref, by, note));
          VM.store.save('loan-settle'); close(); selected.clear(); refresh();
          const doneV = [...new Set(picks.map(([l]) => group(l)))].filter(c => voucher(c).status === 'settled');
          let sub;
          if (picks.length === 1) { const [l, n] = picks[0], rem = remaining(l); sub = rem ? `${l.name}: đã gạch ${num(n)} ${unitL(l.unit)}, còn ${num(rem)}` : `${l.name} · ${num(n)} ${unitL(l.unit)} – đã hoàn đủ`; }
          else sub = `${picks.length} thuốc`;
          if (doneV.length) sub += ` · ${doneV.length === 1 ? 'mã vay ' + doneV[0] : doneV.length + ' mã vay'} đã gạch xong`;
          VM.ui.done('Đã gạch sổ thành công', sub);
        };
      },
    });
  }
  function settle(l, qty, ref, by, note) {
    const u = VM.store.currentUser();
    if (!l.confirmedAt) { l.confirmedAt = VM.iso(); l.confirmedBy = l.lender; }
    l.returns.push({ id: VM.uid('r_'), at: VM.iso(), qty, ref, by: by || u.name, note });
    VM.store.log('Gạch sổ vay', 'Sổ vay', `${l.name} · ${qty} ${l.unit}${ref ? ' · CT SAP ' + ref : ''}`, l.code);
  }

  function editLine(id) {
    const l = S().loans.find(x => x.id === id); if (!l) return;
    VM.ui.modal({
      title: 'Sửa thông số', sub: `${esc(group(l))} · ${esc(l.name)}`, ic: 'edit',
      body: `<div class="form-grid">
        <div class="field c6 half"><label>Mã SAP</label><input class="input mono" id="eSap" value="${esc(l.sap || '')}"></div>
        <div class="field c6 half"><label>Số lô</label><input class="input mono" id="eLot" value="${esc(l.lot || '')}"></div>
        <div class="field c6 half"><label>Hạn dùng</label><input class="input" type="date" id="eExp" value="${esc((l.expiry || '').slice(0, 10))}"></div>
        <div class="field c12"><label>Ghi chú / lưu ý</label><input class="input" id="eNote" value="${esc(l.note || '')}" placeholder="VD: Khách cần gấp"></div></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('check', 's')} Lưu thông số</button>`,
      onMount(el, close) {
        const q = s => el.querySelector(s);
        q('[data-x]').onclick = () => close();
        q('[data-ok]').onclick = () => {
          const nv = { sap: q('#eSap').value.trim(), lot: q('#eLot').value.trim(), expiry: q('#eExp').value, note: q('#eNote').value.trim() };
          const labels = { sap: 'mã SAP', lot: 'số lô', expiry: 'hạn dùng', note: 'ghi chú' };
          const changed = Object.keys(nv).filter(k => String(l[k] || '').slice(0, k === 'expiry' ? 10 : undefined) !== nv[k]);
          if (!changed.length) { close(); return; }
          changed.forEach(k => { l[k] = nv[k]; });
          const what = changed.map(k => labels[k]).join(', '), by = VM.store.currentUser().name;
          (l.edits = l.edits || []).push({ at: VM.iso(), by, what });
          VM.store.log('Sửa thông số mã vay', 'Sổ vay', `${l.name} · ${what}`, l.code);
          VM.store.save('loan-edit'); close(); refresh();
          VM.ui.done('Đã lưu thông số', `${l.name} · ${what}`);
        };
        setTimeout(() => q(l.sap ? '#eNote' : '#eSap').focus(), 30);
      },
    });
  }

  async function cancelVoucher(code) {
    const lines = vLines(code).filter(l => !l.cancelled);
    if (lines.some(l => (l.returns || []).length)) return VM.ui.toast('Mã vay đã có thuốc được gạch sổ – chỉ hủy được từng thuốc chưa gạch', 'warn');
    const r = await VM.ui.confirm({ title: 'Hủy mã vay ' + code + '?', message: `Chỉ hủy khi ghi nhầm. ${lines.length} thuốc trong mã vay vẫn được lưu lại với trạng thái “Đã hủy”.`, ok: 'Hủy mã vay', danger: true, input: { label: 'Lý do', required: true } });
    if (!r) return;
    const by = VM.store.currentUser().name, at = VM.iso();
    lines.forEach(l => Object.assign(l, { cancelled: true, cancelledAt: at, cancelledBy: by, cancelReason: r }));
    VM.store.log('Hủy mã vay', 'Sổ vay', r, code); VM.store.save('loan-cancel'); refresh();
    VM.ui.done('Đã hủy mã vay', `${code} · ${r}`);
  }
  async function cancelLine(id) {
    const l = S().loans.find(x => x.id === id); if (!l || (l.returns || []).length) return;
    const r = await VM.ui.confirm({ title: `Hủy thuốc “${l.name}”?`, message: `Chỉ hủy khi ghi nhầm. Dòng thuốc vẫn được lưu trong mã vay ${esc(group(l))} với trạng thái “Đã hủy”.`, ok: 'Hủy thuốc này', danger: true, input: { label: 'Lý do', required: true } });
    if (!r) return;
    Object.assign(l, { cancelled: true, cancelledAt: VM.iso(), cancelledBy: VM.store.currentUser().name, cancelReason: r });
    VM.store.log('Hủy thuốc trong mã vay', 'Sổ vay', `${l.name} · ${r}`, l.code); VM.store.save('loan-cancel'); refresh();
    VM.ui.done('Đã hủy thuốc khỏi mã vay', `${l.name} · ${r}`);
  }

  // ---------- File điều chuyển SAP ----------
  // Đúng thứ tự cột của tool điều chuyển nội viện. 5 cột đầu phải chính xác; LOT/DATE lấy từ file khác (mặc định để trống);
  // plans / Funds center là giá trị cố định (Cài đặt → settings.transfer). Mỗi thuốc của mã vay là 1 dòng.
  const TRANSFER_HEAD = ['Mã SAP', 'Tên', 'Số lượng', 'Kho xuất', 'Kho nhận', 'LOT', 'DATE', 'plans', 'Funds center'];
  function transferLine(l, cfg) {
    const p = (l.productId && VM.store.product(l.productId)) || (l.sap && S().products.find(x => x.sap === l.sap)) || null;
    const sap = String(l.sap || (p && p.sap) || '').trim();
    const rem = remaining(l);
    let qty = rem, unit = l.unit, conv = '';
    if (cfg.unit === 'base') {
      const units = p ? p.units.slice().sort((a, b) => a.factor - b.factor) : [];
      const u = units.find(x => VM.normalize(x.name) === VM.normalize(l.unit));
      if (u && units.length) { qty = rem * u.factor; unit = units[0].name; if (u.factor !== 1) conv = `${num(rem)} ${l.unit} × ${u.factor}`; }
      else if (units.length && VM.normalize(units[0].name) !== VM.normalize(l.unit)) conv = '?';
    }
    const errs = [];
    if (!sap) errs.push('Thiếu mã SAP');
    if (!l.from || !l.to) errs.push('Thiếu mã kho');
    else if (l.from === l.to) errs.push('Kho xuất trùng kho nhận');
    if (!(qty > 0)) errs.push('Số lượng = 0');
    if (conv === '?') errs.push(`Không quy đổi được “${l.unit}” về ĐVT nhỏ nhất – kiểm tra danh mục`);
    const row = [sap, (p && p.name) || l.name, qty, l.from, l.to, cfg.fillLot ? (l.lot || '') : '', cfg.fillLot ? VM.fmtDate(l.expiry) : '', cfg.plant, cfg.fundsCenter];
    return { l, row, unit, conv: conv === '?' ? '' : conv, errs };
  }

  // srcLines: danh sách dòng thuốc cụ thể (trang chi tiết). Không truyền → mã vay đang chọn, hoặc tất cả dòng đang mở.
  function exportTransfer(srcLines) {
    const explicit = !!srcLines || selected.size > 0;
    const src = srcLines || (selected.size ? S().loans.filter(l => selected.has(group(l)) && isOpen(l)) : S().loans.filter(isOpen));
    if (!src.length) { VM.ui.toast('Không có thuốc nào đang mở để điều chuyển', 'warn'); return; }
    const cfg = Object.assign({}, S().settings.transfer);
    const chosen = new Set(src.filter(l => explicit || !l.sapExport).map(l => l.id));
    const nV = new Set(src.map(group)).size;
    let lines = [];
    VM.ui.modal({
      title: 'File điều chuyển SAP', ic: 'sheet', size: 'xl',
      sub: `${src.length} thuốc · ${nV} mã vay ${explicit ? 'đã chọn' : 'đang mở'} · cột đúng thứ tự của tool điều chuyển: <span class="mono">${TRANSFER_HEAD.join(' / ')}</span>`,
      body: `<div class="tr-opts">
          <div class="field"><label>Số lượng tính theo</label><div class="seg" id="trUnit"><button type="button" data-u="base">ĐVT nhỏ nhất (quy đổi)</button><button type="button" data-u="loan">ĐVT ghi trên phiếu</button></div></div>
          <div class="field"><label>plans (cố định)</label><input class="input mono" id="trPlant" value="${esc(cfg.plant)}" style="width:120px"></div>
          <div class="field"><label>Funds center (cố định)</label><input class="input mono" id="trFunds" value="${esc(cfg.fundsCenter)}" style="width:140px"></div>
          <label class="check"><input type="checkbox" id="trLot" ${cfg.fillLot ? 'checked' : ''}> Điền LOT / DATE đã ghi trên phiếu <span class="muted small">(bỏ trống nếu lấy từ file khác)</span></label>
        </div>
        <div class="table-wrap tr-table"><table class="t"><thead><tr><th style="width:36px"><input type="checkbox" id="trAll" aria-label="Chọn tất cả"></th>${TRANSFER_HEAD.map((h, i) => `<th class="${i === 2 ? 'num' : ''} ${i >= 5 ? 'tr-dim' : 'tr-key'}">${h}</th>`).join('')}<th>Mã vay</th></tr></thead><tbody id="trBody"></tbody></table></div>
        <div id="trMsg" style="margin-top:12px"></div>`,
      foot: `<span class="muted small" id="trCount" style="margin-right:auto"></span>
        <button class="btn" data-x>Đóng</button>
        <button class="btn" data-copy>${icon('copy', 's')} Copy để dán vào tool</button>
        <button class="btn primary" data-xls>${icon('download', 's')} Tải file Excel</button>`,
      onMount(el, close) {
        const q = s => el.querySelector(s);
        function drawT() {
          q('#trUnit').querySelectorAll('[data-u]').forEach(b => b.classList.toggle('active', b.dataset.u === cfg.unit));
          lines = src.map(l => transferLine(l, cfg));
          q('#trBody').innerHTML = lines.map(({ l, row, unit, conv, errs }) => {
            const on = chosen.has(l.id) && !errs.length;
            return `<tr class="${errs.length ? 'tr-bad' : on ? '' : 'done'}">
              <td><input type="checkbox" data-id="${l.id}" ${on ? 'checked' : ''} ${errs.length ? 'disabled' : ''} aria-label="Chọn ${esc(l.name)}"></td>
              <td class="mono strong">${row[0] ? esc(row[0]) : '<span style="color:var(--danger)">—</span>'}</td>
              <td>${esc(row[1])}</td>
              <td class="num"><b>${num(row[2])}</b> <span class="muted small">${esc(unitL(unit))}</span>${conv ? `<div class="t-sub">${esc(conv)}</div>` : ''}</td>
              <td class="mono strong">${esc(row[3])}</td><td class="mono strong">${esc(row[4])}</td>
              <td class="mono tr-dim">${esc(row[5]) || '<span class="muted">trống</span>'}</td><td class="tr-dim">${esc(row[6]) || '<span class="muted">trống</span>'}</td>
              <td class="mono tr-dim">${esc(row[7])}</td><td class="mono tr-dim">${esc(row[8])}</td>
              <td><span class="mono small">${esc(group(l))}</span>${l.sapExport ? `<div class="t-sub" style="color:var(--warn)">Đã xuất ${VM.fmtDT(l.sapExport.at)}</div>` : ''}${status(l) === 'pending' ? '<div class="t-sub">Chưa xác nhận giao</div>' : ''}${errs.length ? `<div class="t-sub" style="color:var(--danger)">${errs.map(esc).join(' · ')}</div>` : ''}</td></tr>`;
          }).join('');
          q('#trBody').querySelectorAll('[data-id]').forEach(c => c.onchange = () => { c.checked ? chosen.add(c.dataset.id) : chosen.delete(c.dataset.id); drawT(); });
          const ok = lines.filter(x => !x.errs.length), sel = ok.filter(x => chosen.has(x.l.id));
          const all = q('#trAll'); all.checked = ok.length > 0 && sel.length === ok.length; all.disabled = !ok.length;
          all.onchange = () => { ok.forEach(x => all.checked ? chosen.add(x.l.id) : chosen.delete(x.l.id)); drawT(); };
          const bad = lines.length - ok.length, again = sel.filter(x => x.l.sapExport).length;
          q('#trMsg').innerHTML = [
            bad ? `<div class="alert bad">${icon('alert', 's')}<span><b>${bad} thuốc không xuất được</b> (thiếu mã SAP / kho / ĐVT). Bổ sung ở trang chi tiết mã vay (“Sửa thông số”) hoặc trong Danh mục rồi mở lại.</span></div>` : '',
            again ? `<div class="alert warn" style="margin-top:8px">${icon('alert', 's')}<span><b>${again} thuốc đã từng xuất file điều chuyển.</b> Kiểm tra trên SAP để tránh điều chuyển hai lần.</span></div>` : '',
          ].join('');
          q('#trCount').textContent = `Sẽ xuất ${sel.length} dòng`;
          q('[data-xls]').disabled = q('[data-copy]').disabled = !sel.length;
        }
        const keepCfg = () => { cfg.plant = q('#trPlant').value.trim(); cfg.fundsCenter = q('#trFunds').value.trim(); cfg.fillLot = q('#trLot').checked; };
        q('#trUnit').querySelectorAll('[data-u]').forEach(b => b.onclick = () => { cfg.unit = b.dataset.u; drawT(); });
        q('#trPlant').oninput = q('#trFunds').oninput = VM.debounce(() => { keepCfg(); drawT(); }, 200);
        q('#trLot').onchange = () => { keepCfg(); drawT(); };
        q('[data-x]').onclick = () => close();
        const pickRows = () => { keepCfg(); lines = src.map(l => transferLine(l, cfg)); return lines.filter(x => !x.errs.length && chosen.has(x.l.id)); };
        const finish = (sel, how) => {
          const at = VM.iso(), by = (VM.store.currentUser() || {}).name || '';
          sel.forEach(x => { x.l.sapExport = { at, by, qty: x.row[2], how }; });
          S().settings.transfer = Object.assign({}, cfg);
          VM.store.log('Xuất file điều chuyển SAP', 'Sổ vay', `${sel.length} dòng · ${how === 'copy' ? 'copy' : 'Excel'} · SL theo ${cfg.unit === 'base' ? 'ĐVT nhỏ nhất' : 'ĐVT phiếu'}`, [...new Set(sel.map(x => group(x.l)))].join(', '));
          VM.store.save('export');
        };
        q('[data-xls]').onclick = () => {
          const sel = pickRows(); if (!sel.length) return;
          VM.xlsx.exportXlsx({ Sheet1: [TRANSFER_HEAD, ...sel.map(x => x.row)] }, `dieu_chuyen_noi_vien_${VM.fileStamp()}.xlsx`);
          finish(sel, 'xlsx'); close(); refresh();
          VM.ui.done(`Đã xuất ${sel.length} dòng điều chuyển`, 'Sau khi điều chuyển xong trên SAP, nhớ “Gạch sổ” các thuốc');
        };
        q('[data-copy]').onclick = async () => {
          const sel = pickRows(); if (!sel.length) return;
          // Mã SAP / kho / LOT giữ dạng chữ; số lượng là số; DATE là ngày thật khi dán vào Excel
          const ok = await VM.copyCells(sel.map(({ l, row }) => [{ text: row[0] }, row[1], row[2], { text: row[3] }, { text: row[4] }, { text: row[5] }, { text: row[6], date: row[6] ? (l.expiry || '').slice(0, 10) : '' }, { text: row[7] }, { text: row[8] }]));
          if (!ok) { VM.ui.toast('Trình duyệt chặn sao chép – dùng “Tải file Excel”', 'bad'); return; }
          finish(sel, 'copy'); close(); refresh();
          VM.ui.done(`Đã copy ${sel.length} dòng điều chuyển`, 'Dán vào ô đầu tiên của tool điều chuyển (không kèm tiêu đề)');
        };
        drawT();
      },
    });
  }

  function exportXls() {
    const vs = filtered(), list = vs.flatMap(v => v.lines);
    VM.xlsx.exportXlsx({
      'Mã vay': [['Mã vay', 'Ngày giờ', 'Số thuốc', 'Bên cho vay', 'Bên vay', 'Người vay', 'Người cho vay', 'Trạng thái', 'Đã gạch (thuốc)'],
        ...vs.map(v => { const act = v.lines.filter(l => !l.cancelled); return [{ text: v.code }, VM.fmtDT(v.createdAt), v.lines.length, { text: v.from }, { text: v.to }, v.borrower, v.lender, ST[v.status].label, `${act.filter(l => status(l) === 'settled').length}/${act.length}`]; })],
      'Sổ vay thuốc': [['Mã vay', 'STT', 'Ngày giờ', 'Thuốc', 'Mã hàng', 'Mã SAP', 'ĐVT', 'Số lượng', 'Đã gạch', 'Còn lại', 'Bên cho vay', 'Bên vay', 'Người vay', 'Người cho vay', 'Lô', 'Hạn dùng', 'Xác nhận bởi', 'Xác nhận lúc', 'Trạng thái', 'Xuất file điều chuyển lúc', 'Số CT SAP', 'Ghi chú'],
        ...list.map(l => [group(l), l.line || 1, VM.fmtDT(l.createdAt), l.name, l.itemCode, l.sap, l.unit, l.qty, l.qty - remaining(l), remaining(l), l.from, l.to, l.borrower, l.lender, l.lot, VM.fmtDate(l.expiry), l.confirmedBy, VM.fmtDT(l.confirmedAt), ST[status(l)].label, l.sapExport ? VM.fmtDT(l.sapExport.at) : '', (l.returns || []).map(r => r.ref).filter(Boolean).join(', '), l.note])],
      'Lịch sử gạch sổ': [['Mã vay', 'Thuốc', 'Thời gian', 'Số lượng', 'Số CT SAP', 'Người thực hiện', 'Ghi chú'], ...list.flatMap(l => (l.returns || []).map(r => [group(l), l.name, VM.fmtDT(r.at), r.qty, r.ref, r.by, r.note]))],
    }, `so_vay_thuoc_${VM.fileStamp()}.xlsx`);
  }
  function printBook() {
    const vs = filtered().slice().reverse();
    VM.ui.print(`<h2>SỔ VAY THUỐC – ${esc(S().settings.pharmacyName).toUpperCase()}</h2><div>In lúc ${VM.fmtDT(new Date())} · ${vs.length} mã vay</div>
      <table><thead><tr><th>STT</th><th>Ngày</th><th>Mã vay</th><th>Tên thuốc</th><th>ĐVT</th><th>SL</th><th>Cho vay → Vay</th><th>Người vay</th><th>Người cho vay</th><th>Trạng thái / CT SAP</th><th>Ký xác nhận</th></tr></thead><tbody>
      ${vs.map((v, i) => v.lines.map((l, k) => `<tr>${k === 0 ? `<td rowspan="${v.lines.length}">${i + 1}</td><td rowspan="${v.lines.length}">${VM.fmtDate(v.createdAt)}<br>${VM.fmtTime(v.createdAt)}</td><td rowspan="${v.lines.length}">${esc(v.code)}</td>` : ''}<td>${esc(l.name)}<br><small>Lô ${esc(l.lot || '—')}</small></td><td>${esc(l.unit)}</td><td>${l.qty}</td>${k === 0 ? `<td rowspan="${v.lines.length}">${esc(v.from)} → ${esc(v.to)}</td><td rowspan="${v.lines.length}">${esc(v.borrower)}</td><td rowspan="${v.lines.length}">${esc(v.lender)}</td>` : ''}<td>${ST[status(l)].label}<br><small>${(l.returns || []).map(r => esc(r.ref)).filter(Boolean).join(', ')}</small></td>${k === 0 ? `<td rowspan="${v.lines.length}" style="width:90px"></td>` : ''}</tr>`).join('')).join('')}
      </tbody></table>`);
  }
  function printVoucher(code) {
    const v = voucher(code); if (!v) return;
    VM.ui.print(`<h2>PHIẾU VAY THUỐC</h2><div>${esc(S().settings.pharmacyName)} · Mã vay <b>${esc(v.code)}</b> · ${VM.fmtDT(v.createdAt)}</div>
      <div>${esc(VM.store.storeName(v.from))} (${esc(v.from)}) cho ${esc(VM.store.storeName(v.to))} (${esc(v.to)}) vay · Người vay: <b>${esc(v.borrower)}</b> · Người cho vay: <b>${esc(v.lender)}</b></div>
      <table><thead><tr><th>STT</th><th>Tên thuốc</th><th>Mã SAP</th><th>Số lô</th><th>Hạn dùng</th><th>ĐVT</th><th>SL vay</th><th>Đã hoàn</th><th>Ghi chú</th></tr></thead><tbody>
      ${v.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}${l.cancelled ? ' <small>(đã hủy)</small>' : ''}</td><td>${esc(l.sap || '')}</td><td>${esc(l.lot || '')}</td><td>${VM.fmtDate(l.expiry)}</td><td>${esc(l.unit)}</td><td>${l.qty}</td><td>${l.qty - remaining(l)}</td><td>${esc(l.note || '')}</td></tr>`).join('')}
      </tbody></table>
      <div class="sign"><div>Người vay<br><small>(ký, ghi rõ họ tên)</small></div><div>Người cho vay<br><small>(ký, ghi rõ họ tên)</small></div></div>`);
  }

  // ---------- camera scanner ----------
  function openScanner(onCode) {
    const supported = 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    let stream = null, timer = null;
    VM.ui.modal({
      title: 'Quét mã QR / mã vạch', sub: 'Đưa mã trên hộp thuốc vào khung hình. Máy quét cầm tay: chỉ cần quét vào ô tìm thuốc.', ic: 'scan',
      body: supported ? `<video class="scan-video" id="scV" playsinline muted></video><div class="muted small" id="scMsg" style="margin-top:8px">Đang mở camera…</div>` : `<div class="alert info">${icon('info', 's')}<span>Trình duyệt này chưa hỗ trợ quét bằng camera (hãy dùng Chrome/Edge trên Android hoặc máy quét cầm tay). Có thể nhập mã thủ công:</span></div>`,
      foot: `<input class="input mono" id="scIn" placeholder="Nhập / quét mã" style="flex:1;min-width:160px"><button class="btn primary" id="scOk">Dùng mã</button>`,
      onClose: () => { clearInterval(timer); if (stream) stream.getTracks().forEach(t => t.stop()); },
      async onMount(el, close) {
        const done = code => { close(); onCode(code); };
        el.querySelector('#scOk').onclick = () => { const v = el.querySelector('#scIn').value.trim(); if (v) done(v); };
        el.querySelector('#scIn').onkeydown = e => { if (e.key === 'Enter') el.querySelector('#scOk').click(); };
        if (!supported) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const v = el.querySelector('#scV'); v.srcObject = stream; await v.play();
          el.querySelector('#scMsg').textContent = 'Đang quét…';
          const det = new window.BarcodeDetector();
          timer = setInterval(async () => { try { const r = await det.detect(v); if (r[0]) done(r[0].rawValue); } catch (_) { } }, 300);
        } catch (e) { el.querySelector('#scMsg').textContent = 'Không mở được camera: ' + e.message; }
      },
    });
  }

  VM.loans = { focusForm: () => VM.ui.go('loans/new'), openScanner };
  VM.ui.register({
    id: 'loans', title: 'Sổ vay thuốc', group: 'loans', icon: 'swap', render, detail: true,
    keys: [['N', 'Tạo mã vay mới'], ['Enter', 'Thêm thuốc / sang ô kế tiếp'], ['Esc', 'Bỏ thuốc vừa quét'], ['Ctrl+Enter', 'Hoàn thành / Lưu mã vay']],
    tourKey: () => mode === 'list' ? 'loans' : 'loans:' + mode,
    tour: () => mode === 'new' ? [
      { el: '#nlSteps', title: 'Tạo mã vay trong 2 bước', text: '<b>1.</b> Quét lần lượt từng thuốc và nhập số lượng. <b>2.</b> Ghi người vay, người cho vay rồi lưu.' },
      { el: '#nlScanBox', title: 'Quét mã thuốc', text: 'Quét mã vạch / DataMatrix trên hộp hoặc gõ 1–2 chữ tên thuốc. Quét xong sẽ hiện ô <b>số lượng</b> – nhập rồi bấm <kbd>Enter</kbd>. ĐVT tự lấy theo thuốc.' },
      { el: '#nlList', title: 'Danh sách thuốc', text: 'Mỗi thuốc đã quét nằm ở đây. Sửa số lượng bằng nút − / + hoặc bấm 🗑 để bỏ. Quét lại cùng thuốc thì số lượng được cộng dồn.' },
      { el: '#nlDone', title: 'Hoàn thành vay thuốc', text: 'Quét đủ thuốc thì bấm nút này (hoặc <kbd>Ctrl+Enter</kbd>) để sang bước ghi người vay / người cho vay.' },
    ] : mode === 'detail' ? [
      { el: '.ld-head', title: 'Thông tin mã vay', text: 'Chiều vay, người vay, người cho vay và tiến độ gạch sổ của cả mã vay. Có nút <b>Gạch sổ cả mã vay</b> khi đã điều chuyển hết.' },
      { el: '.ld-line .ld-params', title: 'Thông số từng thuốc', text: 'Mã SAP, số lô, hạn dùng, ghi chú chỉ hiện ở trang này. Bấm <b>Sửa thông số</b> nếu cần bổ sung (VD hàng ngoài danh mục chưa có mã SAP).' },
      { el: '.ld-line .ld-l-hist', title: 'Lịch sử truy xuất', text: 'Ghi sổ, xác nhận giao, xuất file điều chuyển, từng lần gạch sổ (số chứng từ SAP, người thực hiện).' },
      { el: '.ld-line [data-settle]', title: 'Gạch sổ từng thuốc', text: 'Khi thuốc đã được điều chuyển trên SAP, bấm <b>Gạch sổ</b> – gạch được từng phần.' },
    ] : [
      { el: '#lNew', title: 'Tạo mã vay mới', text: 'Bắt đầu từ đây (phím <kbd>N</kbd>). Một mã vay vay được <b>nhiều thuốc</b> một lần: quét mã → nhập số lượng → Hoàn thành → ghi người vay, người cho vay.' },
      { el: '#lKpis', title: 'Việc cần xử lý', text: 'Số mã vay chưa gạch, quá hạn, chờ xác nhận. Bấm vào ô để lọc nhanh.' },
      { el: '#lTabs', title: 'Lọc mã vay', text: 'Chưa gạch, quá hạn, chờ xác nhận… Số trên mỗi tab là số mã vay.' },
      { el: '#lTable', title: 'Danh sách theo mã vay', text: 'Mỗi dòng là một mã vay: vay bao nhiêu thuốc, số lượng, ai vay – ai cho vay. <b>Bấm vào dòng</b> để mở trang chi tiết (thông số, lịch sử từng thuốc). Tick nhiều mã vay để gạch sổ hàng loạt.' },
      { el: '#lSap', title: 'File điều chuyển SAP', text: 'Xem trước rồi tải Excel hoặc copy dán thẳng vào tool điều chuyển. Không chọn mã vay nào thì lấy tất cả thuốc đang mở.' },
    ],
    subs: () => {
      const all = VM.store.loanVouchers(), open = all.filter(vOpen), od = open.filter(v => v.overdue).length, pend_ = all.filter(v => v.status === 'pending').length;
      return [
        { arg: 'new', label: 'Tạo mã vay mới', icon: 'plus', hot: true },
        { arg: 'open', label: 'Chưa gạch sổ', n: open.length },
        { arg: 'overdue', label: 'Quá hạn', n: od, tone: 'bad' },
        { arg: 'pending', label: 'Chờ xác nhận', n: pend_, tone: 'warn' },
        { arg: 'settled', label: 'Đã gạch sổ' },
        { arg: 'all', label: 'Tất cả mã vay' },
      ];
    },
    badge: () => { const open = VM.store.loanVouchers().filter(vOpen), od = open.filter(v => v.overdue).length; return { n: open.length, soft: !od, title: `${open.length} mã vay chưa gạch, ${od} quá hạn` }; },
  });
})(window.VM);
