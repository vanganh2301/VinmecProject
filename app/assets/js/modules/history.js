/* Lịch sử bán – tra cứu, chi tiết, hủy đơn, đối soát OH/SAP, xuất Excel */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money, num } = VM;
  const S = () => VM.store.state;
  const f = { q: '', from: '', to: '', seller: '', pay: '', recon: '', status: 'paid' };
  let limit = 100, selected = new Set();

  function filtered() {
    const from = f.from ? new Date(f.from + 'T00:00:00') : null, to = f.to ? new Date(f.to + 'T23:59:59') : null;
    let list = S().sales.filter(s => (!f.status || s.status === f.status) && (!f.seller || s.sellerId === f.seller) && (!f.pay || s.payment === f.pay) && (!f.recon || (s.recon || 'pending') === f.recon)
      && (!from || new Date(s.paidAt) >= from) && (!to || new Date(s.paidAt) <= to));
    if (f.q.trim()) {
      const q = VM.normalize(f.q);
      list = list.filter(s => [s.code, s.customer, s.pid, s.sellerName, ...s.items.flatMap(i => [i.name, i.code, i.sap])].some(x => VM.normalize(x).includes(q)) ||
        s.items.some(i => VM.fuzzyScore(f.q, i.name) >= 80));
    }
    return list.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }

  function render(view, top) {
    selected = new Set(); limit = 100;
    top.innerHTML = `<button class="btn" id="reconBtn" disabled>${icon('check')}<span class="label">Đánh dấu đã nhập OH/SAP</span></button>
      <button class="btn primary" id="xlsBtn">${icon('download')}<span class="label">Xuất Excel</span></button>`;
    const sellers = S().staff;
    view.innerHTML = `<div class="card">
      <div class="toolbar">
        <div class="input-icon grow">${icon('search')}<input class="input" id="hQ" type="search" placeholder="Tìm kiếm" value="${esc(f.q)}"></div>
        <input class="input xd" type="date" id="hFrom" value="${f.from}" style="width:auto" aria-label="Từ ngày" title="Từ ngày">
        <input class="input xd" type="date" id="hTo" value="${f.to}" style="width:auto" aria-label="Đến ngày" title="Đến ngày">
        <select class="select xd" id="hSeller" aria-label="Dược sĩ"><option value="">Tất cả dược sĩ</option>${sellers.map(s => `<option value="${s.id}" ${f.seller === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        <select class="select xd" id="hPay" aria-label="Thanh toán"><option value="">Mọi hình thức</option><option value="qr" ${f.pay === 'qr' ? 'selected' : ''}>QR</option><option value="cash" ${f.pay === 'cash' ? 'selected' : ''}>Tiền mặt</option></select>
        <select class="select xd" id="hRecon" aria-label="Đối soát"><option value="">Mọi trạng thái đối soát</option><option value="pending" ${f.recon === 'pending' ? 'selected' : ''}>Chưa nhập OH/SAP</option><option value="done" ${f.recon === 'done' ? 'selected' : ''}>Đã nhập OH/SAP</option></select>
        <select class="select" id="hStatus" aria-label="Trạng thái đơn"><option value="paid" ${f.status === 'paid' ? 'selected' : ''}>Đơn hoàn tất</option><option value="cancelled" ${f.status === 'cancelled' ? 'selected' : ''}>Đơn đã hủy</option><option value="" ${f.status === '' ? 'selected' : ''}>Tất cả đơn</option></select>
        <div class="seg" id="hQuick"><button data-d="0">Hôm nay</button><button data-d="6">7 ngày</button><button data-d="29">30 ngày</button></div>
      </div>
      <div class="toolbar" style="padding:10px 18px" id="hSum"></div>
      <div class="table-wrap" id="hTable"></div>
    </div>`;
    const bind = (id, k) => { const el = $(id); el.oninput = el.onchange = VM.debounce(() => { f[k] = el.value; limit = 100; draw(); }, 150); };
    bind('#hQ', 'q'); bind('#hFrom', 'from'); bind('#hTo', 'to'); bind('#hSeller', 'seller'); bind('#hPay', 'pay'); bind('#hRecon', 'recon'); bind('#hStatus', 'status');
    $$('#hQuick [data-d]').forEach(b => b.onclick = () => { const d = new Date(); d.setDate(d.getDate() - +b.dataset.d); f.from = VM.ymd(d); f.to = VM.ymd(); $('#hFrom').value = f.from; $('#hTo').value = f.to; draw(); });
    $('#xlsBtn').onclick = () => exportXls();
    $('#reconBtn').onclick = () => markRecon([...selected]);
    draw();
  }

  function draw() {
    const list = filtered();
    $('#hSum').innerHTML = `<span><b>${num(list.length)}</b> đơn · Tổng <b>${money(VM.sum(list, s => s.total))}</b></span>
      <span class="muted small xd">QR ${money(VM.sum(list.filter(s => s.payment === 'qr'), s => s.total))} · Tiền mặt ${money(VM.sum(list.filter(s => s.payment === 'cash'), s => s.total))}</span>
      ${selected.size ? `<span class="pill pri" style="margin-left:auto">Đã chọn ${selected.size}</span>` : ''}`;
    $('#reconBtn').disabled = !selected.size;
    if (!list.length) { $('#hTable').innerHTML = VM.ui.empty('receipt', 'Không có đơn phù hợp', 'Thử thay đổi bộ lọc hoặc khoảng thời gian.'); return; }
    const rows = list.slice(0, limit);
    const today = VM.ymd();
    const when = d => VM.ymd(d) === today ? VM.fmtTime(d) : `${VM.fmtDate(d).slice(0, 5)} ${VM.fmtTime(d)}`;
    const short = c => String(c).split('-').slice(-2).join('-');
    $('#hTable').innerHTML = `<table class="t ht"><thead><tr>
      <th class="h-c"><input type="checkbox" id="hAll" aria-label="Chọn tất cả"></th><th class="h-code">Mã đơn</th><th class="h-time">Thời gian</th><th class="h-items">Mặt hàng</th><th class="h-who hide-m">Dược sĩ</th><th class="h-cus xd">Khách / PID</th><th class="h-pay">Thanh toán</th><th class="h-tot num">Tổng tiền</th><th class="h-rec">Đối soát</th></tr></thead><tbody>
      ${rows.map(s => `<tr class="clickable ${s.status === 'cancelled' ? 'done' : ''}" data-id="${s.id}">
        <td onclick="event.stopPropagation()"><input type="checkbox" data-sel="${s.id}" ${selected.has(s.id) ? 'checked' : ''} ${s.status !== 'paid' ? 'disabled' : ''} aria-label="Chọn ${esc(s.code)}"></td>
        <td class="mono strike" title="${esc(s.code)}">${esc(short(s.code))}${s.status === 'cancelled' ? ' ' + VM.ui.pill('bad', 'Hủy') : ''}</td>
        <td class="h-time" title="${esc(VM.fmtDT(s.paidAt))}">${when(s.paidAt)}</td>
        <td class="h-items">${s.items.map(i => `<div title="${esc(i.name)}"><span class="h-nm">${esc(i.name)}</span><span class="h-q">× ${num(i.qty)} ${esc(String(i.unit || '').toLowerCase())}</span></div>`).join('')}</td>
        <td class="hide-m" title="${esc(s.sellerName)}">${esc(s.sellerName)}</td>
        <td class="xd" title="${esc([s.customer, s.pid].filter(Boolean).join(' · '))}">${esc(s.customer || '—')}${s.pid ? ` · <span class="mono">${esc(s.pid)}</span>` : ''}</td>
        <td class="h-pay">${s.payment === 'qr' ? VM.ui.pill('info', 'QR', 'qr') : VM.ui.pill('', 'Tiền mặt', 'cash')}</td>
        <td class="num strong">${money(s.total)}</td>
        <td class="h-rec">${s.status !== 'paid' ? '' : s.recon === 'done' ? VM.ui.pill('ok', 'Đã nhập', 'check') : VM.ui.pill('warn', 'Chờ nhập', 'clock')}</td></tr>`).join('')}
      </tbody></table>
      ${list.length > limit ? `<div style="padding:14px;text-align:center"><button class="btn" id="hMore">Xem thêm ${Math.min(100, list.length - limit)} đơn</button></div>` : ''}`;
    $$('#hTable tr[data-id]').forEach(tr => tr.onclick = () => openDetail(tr.dataset.id));
    $$('#hTable [data-sel]').forEach(c => c.onchange = () => { c.checked ? selected.add(c.dataset.sel) : selected.delete(c.dataset.sel); draw(); });
    const all = $('#hAll'); if (all) all.onchange = () => { rows.filter(s => s.status === 'paid').forEach(s => all.checked ? selected.add(s.id) : selected.delete(s.id)); draw(); };
    const more = $('#hMore'); if (more) more.onclick = () => { limit += 100; draw(); };
  }

  function markRecon(ids) {
    const n = ids.length;
    ids.forEach(id => { const s = S().sales.find(x => x.id === id); if (s && s.status === 'paid') { s.recon = 'done'; s.reconAt = VM.iso(); s.reconBy = VM.store.currentUser().name; } });
    VM.store.log('Đánh dấu đã nhập OH/SAP', 'Bán lẻ', `${n} đơn`);
    VM.store.save('recon');
    selected.clear(); draw();
    VM.ui.done('Đã đối soát', `${n} đơn đã nhập OH/SAP`);
  }

  function openDetail(id) {
    const s = S().sales.find(x => x.id === id);
    if (!s) return;
    const u = VM.store.currentUser();
    const canCancel = s.status === 'paid' && (u.admin || (s.sellerId === u.id && VM.ymd(s.paidAt) === VM.ymd()));
    VM.ui.modal({
      title: 'Đơn ' + s.code, sub: `${VM.fmtDT(s.paidAt)} · ${esc(s.sellerName)}`, ic: 'receipt', size: 'lg',
      body: `${s.status === 'cancelled' ? `<div class="alert bad" style="margin-bottom:12px">${icon('x', 's')}<span>Đơn đã hủy lúc ${VM.fmtDT(s.cancelledAt)} bởi ${esc(s.cancelledBy)}. Lý do: ${esc(s.cancelReason)}</span></div>` : ''}
        <dl class="kv" style="margin-bottom:14px"><dt>Khách hàng</dt><dd>${esc(s.customer || '—')} ${s.pid ? '· PID ' + esc(s.pid) : ''}</dd>
          <dt>Thanh toán</dt><dd>${s.payment === 'qr' ? 'Chuyển khoản QR' : 'Tiền mặt'}${s.given ? ` · khách đưa ${money(s.given)}, thối ${money(s.given - s.total)}` : ''}</dd>
          <dt>Đối soát OH/SAP</dt><dd>${s.recon === 'done' ? `Đã nhập (${esc(s.reconBy || '')} · ${VM.fmtDT(s.reconAt)})` : 'Chưa nhập'}</dd></dl>
        <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Mặt hàng</th><th>Lô</th><th>ĐVT</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">Thành tiền</th></tr></thead><tbody>
        ${s.items.map(i => `<tr><td><div class="t-title">${esc(i.name)}</div><div class="t-sub mono">${esc(i.code)}${i.sap ? ' · SAP ' + esc(i.sap) : ''}${i.special ? ' · Người bán: ' + esc(i.seller) : ''}</div></td><td class="mono">${esc(i.lot || '—')}</td><td>${esc(i.unit)}</td><td class="num">${i.qty}</td>
          <td class="num">${money(i.price)}${i.price !== i.listPrice ? `<div class="t-sub">Giá DM ${money(i.listPrice)}</div>` : ''}</td><td class="num strong">${money(i.total)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="5" class="num strong">Tổng cộng</td><td class="num strong" style="color:var(--primary-700);font-size:16px">${money(s.total)}</td></tr></tfoot></table></div></div>`,
      foot: `${canCancel ? `<button class="btn danger" data-cancel style="margin-right:auto">${icon('undo', 's')} Hủy đơn</button>` : ''}
        ${s.status === 'paid' && s.recon !== 'done' ? `<button class="btn" data-recon>${icon('check', 's')} Đã nhập OH/SAP</button>` : ''}
        <button class="btn primary" data-print>${icon('printer', 's')} In phiếu</button>`,
      onMount(el, close) {
        el.querySelector('[data-print]').onclick = () => VM.pos.printReceipt(s);
        const r = el.querySelector('[data-recon]'); if (r) r.onclick = () => { markRecon([s.id]); close(); };
        const c = el.querySelector('[data-cancel]');
        if (c) c.onclick = async () => {
          const reason = await VM.ui.confirm({ title: 'Hủy đơn ' + s.code + '?', message: 'Số lượng sẽ được <b>hoàn lại tồn kho</b>. Đơn vẫn được lưu trong lịch sử với trạng thái “Đã hủy”.', ok: 'Hủy đơn', danger: true, input: { label: 'Lý do hủy', required: true, placeholder: 'VD: Khách đổi ý, nhập nhầm…' } });
          if (!reason) return;
          s.status = 'cancelled'; s.cancelledAt = VM.iso(); s.cancelledBy = u.name; s.cancelReason = reason;
          s.items.forEach(i => { const p = !i.special && VM.store.product(i.productId); if (p) p.stock += i.qty * i.factor; });
          VM.store.log('Hủy đơn', 'Bán lẻ', reason, s.code);
          VM.store.save('cancel');
          close(); draw(); VM.ui.done('Đã hủy đơn', 'Tồn kho đã được hoàn lại');
        };
      },
    });
  }

  function exportXls(list = filtered(), prefix = 'vinmec_lich_su_ban') {
    const pay = s => s.payment === 'qr' ? 'QR' : 'Tiền mặt';
    const summary = [['Mã đơn', 'Thời gian', 'Mã DS', 'Dược sĩ', 'Khách hàng', 'PID', 'Thanh toán', 'Số mặt hàng', 'Tổng tiền', 'Trạng thái', 'Đối soát OH/SAP', 'Lý do hủy'],
      ...list.map(s => [s.code, VM.fmtDT(s.paidAt), s.sellerId, s.sellerName, s.customer, s.pid, pay(s), s.items.length, s.total, s.status === 'paid' ? 'Hoàn tất' : 'Đã hủy', s.recon === 'done' ? 'Đã nhập' : 'Chưa nhập', s.cancelReason || ''])];
    const details = [['Mã đơn', 'Ngày', 'Giờ', 'Dược sĩ', 'Mã hàng', 'Mã SAP', 'Tên hàng', 'Kho', 'Lô', 'ĐVT', 'Số lượng', 'Hệ số quy đổi', 'SL quy đổi (ĐV nhỏ nhất)', 'Đơn giá', 'Giá danh mục', 'Thành tiền', 'Hàng đặc biệt – người bán', 'Trạng thái'],
      ...list.flatMap(s => s.items.map(i => [s.code, VM.fmtDate(s.paidAt), VM.fmtTime(s.paidAt), s.sellerName, i.code, i.sap, i.name, i.store, i.lot, i.unit, i.qty, i.factor, i.qty * i.factor, i.price, i.listPrice, i.total, i.special ? i.seller : '', s.status === 'paid' ? 'Hoàn tất' : 'Đã hủy']))];
    const recon = [['Mã SAP', 'Mã hàng', 'Tên hàng', 'Kho', 'Lô', 'SL xuất (ĐV nhỏ nhất)', 'Số đơn', 'Mã đơn'],
      ...Object.values(list.filter(s => s.status === 'paid' && s.recon !== 'done').flatMap(s => s.items.filter(i => !i.special).map(i => ({ s, i }))).reduce((m, { s, i }) => {
        const k = i.code + '|' + i.lot; m[k] = m[k] || [i.sap, i.code, i.name, i.store, i.lot, 0, 0, []]; m[k][5] += i.qty * i.factor; m[k][6]++; m[k][7].push(s.code); return m;
      }, {})).map(r => { r[7] = r[7].join(', '); return r; })];
    VM.xlsx.exportXlsx({ 'Tổng hợp đơn': summary, 'Chi tiết mặt hàng': details, 'Chờ nhập OH-SAP': recon }, `${prefix}_${VM.fileStamp()}.xlsx`);
    VM.store.log('Xuất Excel lịch sử bán', 'Bán lẻ', `${list.length} đơn`); VM.store.save('export');
  }

  VM.ui.register({ id: 'history', title: 'Lịch sử bán', group: 'retail', icon: 'receipt', render, detail: true,
    badge: () => { const n = S().sales.filter(s => s.status === 'paid' && s.recon !== 'done').length; return { n, soft: true, title: n + ' đơn chưa nhập OH/SAP' }; } });
  VM.history = { exportSales: exportXls };
})(window.VM);
