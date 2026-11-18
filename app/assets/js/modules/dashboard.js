/* Tổng quan – KPI, lượt khách theo giờ, bán chạy, việc cần chú ý */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money, num } = VM;
  const S = () => VM.store.state;
  let range = 'today', topRange = 'week';

  const paid = () => S().sales.filter(s => s.status === 'paid');
  const inDays = (s, days) => { const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1)); return new Date(s.paidAt) >= from; };

  function render(view, top) {
    top.innerHTML = `<button class="btn" id="dbXls">${icon('download')}<span class="label">Xuất Excel</span></button><button class="btn primary" data-go="pos">${icon('cart')}<span class="label">Bán hàng</span></button>`;
    top.querySelector('[data-go]').onclick = () => VM.ui.go('pos');
    top.querySelector('#dbXls').onclick = exportXls;
    const st = S();
    const today = paid().filter(s => inDays(s, 1));
    const yest = paid().filter(s => { const d = new Date(); d.setDate(d.getDate() - 1); return VM.ymd(s.paidAt) === VM.ymd(d); });
    const openLoans = VM.store.loanVouchers().filter(VM.store.voucherOpen);
    const overdue = openLoans.filter(v => v.overdue);
    const invPending = st.invoices.filter(i => i.status !== 'entered' && i.status !== 'cancelled');
    const noInv = invPending.filter(i => i.status === 'no_invoice');
    const diff = today.length - yest.length;

    view.innerHTML = `
      <div class="kpis">
        <button class="card kpi" data-go="history"><div class="kpi-ic">${icon('receipt')}</div><div><span>Đơn bán hôm nay</span><strong>${num(today.length)}</strong><small>${diff >= 0 ? '+' : ''}${diff} so với hôm qua</small></div></button>
        <button class="card kpi" data-go="history"><div class="kpi-ic info">${icon('trend')}</div><div><span>Doanh thu hôm nay</span><strong>${money(VM.sum(today, s => s.total))}</strong><small>QR ${today.filter(s => s.payment === 'qr').length} · Tiền mặt ${today.filter(s => s.payment === 'cash').length}</small></div></button>
        <button class="card kpi" data-go="loans"><div class="kpi-ic ${overdue.length ? 'danger' : 'warn'}">${icon('swap')}</div><div><span>Mã vay chưa gạch</span><strong>${openLoans.length}</strong><small>${overdue.length ? `<b style="color:var(--danger)">${overdue.length} quá hạn</b>` : 'Không có phiếu quá hạn'}</small></div></button>
        <button class="card kpi" data-go="invoices"><div class="kpi-ic ${noInv.length ? 'danger' : 'warn'}">${icon('file')}</div><div><span>Hóa đơn chờ xử lý</span><strong>${invPending.length}</strong><small>${noInv.length} lô hàng chưa có HĐ</small></div></button>
      </div>
      <div class="dash">
        <div class="grid">
          <div class="card">
            <div class="card-h"><div><h3>Lượt khách mua lẻ theo giờ</h3><div class="sub">Tính theo số đơn đã thanh toán · vùng cam = giờ cao điểm 11h–13h</div></div>
              <div class="right"><div class="seg" id="rangeSeg"><button data-r="today">Hôm nay</button><button data-r="7">7 ngày</button><button data-r="30">30 ngày</button></div></div></div>
            <div class="chart-wrap" id="chart"></div>
          </div>
          <div class="card">
            <div class="card-h"><div><h3>Mặt hàng bán chạy</h3><div class="sub">Theo số lượng quy về đơn vị bán mặc định</div></div>
              <div class="right"><div class="seg" id="topSeg"><button data-t="week">7 ngày</button><button data-t="month">30 ngày</button></div></div></div>
            <div class="card-b" id="topList" style="padding-top:6px"></div>
          </div>
        </div>
        <div class="grid" style="align-content:start">
          <div class="card"><div class="card-h"><h3>Cần chú ý</h3><span class="right muted small">Cập nhật ${VM.fmtTime(new Date())}</span></div><div class="attn" id="attn"></div></div>
          <div class="card"><div class="card-h"><h3>Thao tác nhanh</h3></div><div class="card-b quick">
            <button class="btn" data-go="pos">${icon('cart')} Tạo đơn bán</button>
            <button class="btn" data-act="loan">${icon('swap')} Ghi phiếu vay</button>
            <button class="btn" data-act="invoice">${icon('file')} Ghi sổ hóa đơn</button>
            <button class="btn" data-act="backup">${icon('download')} Tải sao lưu</button>
          </div></div>
        </div>
      </div>`;
    $$('[data-go]', view).forEach(b => b.onclick = () => VM.ui.go(b.dataset.go));
    view.querySelector('[data-act="loan"]').onclick = () => { VM.ui.go('loans/new'); };
    view.querySelector('[data-act="invoice"]').onclick = () => { VM.ui.go('invoices'); setTimeout(() => VM.invoices && VM.invoices.openEditor(), 60); };
    view.querySelector('[data-act="backup"]').onclick = () => VM.backup.downloadFile();
    $$('#rangeSeg [data-r]').forEach(b => b.onclick = () => { range = b.dataset.r; drawChart(); });
    $$('#topSeg [data-t]').forEach(b => b.onclick = () => { topRange = b.dataset.t; drawTop(); });
    drawChart(); drawTop(); drawAttn(openLoans, overdue, noInv, invPending);
  }

  function drawChart() {
    $$('#rangeSeg [data-r]').forEach(b => b.classList.toggle('active', b.dataset.r === range));
    const days = range === 'today' ? 1 : +range;
    const H0 = 7, H1 = 21;
    const counts = Array.from({ length: H1 - H0 + 1 }, () => 0);
    paid().filter(s => inDays(s, days)).forEach(s => { const h = new Date(s.paidAt).getHours(); if (h >= H0 && h <= H1) counts[h - H0]++; });
    const max = Math.max(4, ...counts);
    const step = max <= 8 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
    const yMax = Math.ceil(max / step) * step;
    const W = 680, Hh = 250, L = 34, R = 8, T = 14, B = 28, cw = (W - L - R) / counts.length, bw = Math.min(28, cw * .58);
    const y = v => T + (Hh - T - B) * (1 - v / yMax);
    let g = '';
    const px = h => L + (h - H0) * cw;
    g += `<rect class="peakband" x="${px(11)}" y="${T}" width="${cw * 3}" height="${Hh - T - B}" rx="6"/>`;
    g += `<text class="ax" x="${px(11) + cw * 1.5}" y="${T + 12}" text-anchor="middle" style="fill:var(--warning);font-weight:600">Cao điểm</text>`;
    for (let v = 0; v <= yMax; v += step) g += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    counts.forEach((c, i) => {
      const x = L + i * cw + (cw - bw) / 2, top = y(c), h = Hh - B - top, r = Math.min(4, h);
      if (c > 0) g += `<path class="bar ${i + H0 >= 11 && i + H0 <= 13 ? 'peak' : ''}" d="M${x},${Hh - B} V${top + r} q0,-${r} ${r},-${r} h${bw - 2 * r} q${r},0 ${r},${r} V${Hh - B} Z"/>`;
      g += `<rect x="${L + i * cw}" y="${T}" width="${cw}" height="${Hh - T - B}" fill="transparent" data-i="${i}"/>`;
      g += `<text class="ax" x="${L + i * cw + cw / 2}" y="${Hh - 9}" text-anchor="middle">${i + H0}h</text>`;
    });
    const tot = VM.sum(counts);
    const el = $('#chart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Biểu đồ lượt khách theo giờ, tổng ${tot} lượt">${g}</svg><div class="chart-tip" id="tip"></div>
      <div class="muted small" style="display:flex;justify-content:space-between;margin-top:6px"><span>Tổng: <b style="color:var(--ink)">${tot} lượt</b>${days > 1 ? ` · TB ${(tot / days).toFixed(1)} lượt/ngày` : ''}</span><span>Giờ đông nhất: <b style="color:var(--ink)">${tot ? counts.indexOf(Math.max(...counts)) + H0 + 'h' : '—'}</b></span></div>`;
    const tip = $('#tip'), svg = el.querySelector('svg'), bars = el.querySelectorAll('.bar');
    el.querySelectorAll('rect[data-i]').forEach(r => {
      r.onmouseenter = () => {
        const i = +r.dataset.i, box = svg.getBoundingClientRect(), sc = box.width / W;
        tip.innerHTML = `<b>${i + H0}:00 – ${i + H0}:59</b><br>${counts[i]} lượt khách`;
        tip.style.left = (L + i * cw + cw / 2) * sc + 18 + 'px'; tip.style.top = y(counts[i]) * sc + 8 + 'px';
        tip.classList.add('show');
      };
      r.onmouseleave = () => tip.classList.remove('show');
    });
    void bars;
  }

  function drawTop() {
    $$('#topSeg [data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === topRange));
    const days = topRange === 'week' ? 7 : 30;
    const agg = new Map();
    paid().filter(s => inDays(s, days)).forEach(s => s.items.forEach(i => {
      const key = i.productId || i.name;
      const p = i.productId && VM.store.product(i.productId);
      const du = p ? (p.units.find(u => u.name === p.defaultUnit) || p.units[0]) : { name: i.unit, factor: i.factor };
      const a = agg.get(key) || { name: i.name, qty: 0, unit: du.name, rev: 0 };
      a.qty += i.qty * i.factor / du.factor; a.rev += i.total;
      agg.set(key, a);
    }));
    const list = [...agg.values()].sort((a, b) => b.qty - a.qty).slice(0, 7);
    const max = list[0] ? list[0].qty : 1;
    $('#topList').innerHTML = list.length ? list.map((a, i) => `<div class="hbar" title="${esc(a.name)}: ${num(Math.round(a.qty * 10) / 10)} ${esc(a.unit)} · ${money(a.rev)}">
      <span class="rk">${i + 1}</span><span class="nm">${esc(a.name)}</span><span class="vl">${num(Math.round(a.qty * 10) / 10)} <span class="muted small">${esc(a.unit.toLowerCase())}</span></span>
      <div class="track"><div class="fill" style="width:${Math.max(3, a.qty / max * 100)}%"></div></div></div>`).join('')
      : VM.ui.empty('trend', 'Chưa có dữ liệu', 'Chưa có đơn bán trong khoảng thời gian này.');
  }

  function exportXls() {
    const st = S(), days = [], pay = paid();
    for (let k = 29; k >= 0; k--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - k);
      const y = VM.ymd(d), l = pay.filter(s => VM.ymd(s.paidAt) === y);
      days.push([VM.fmtDate(y), l.length, VM.sum(l, s => s.total), VM.sum(l.filter(s => s.payment === 'qr'), s => s.total), VM.sum(l.filter(s => s.payment !== 'qr'), s => s.total)]);
    }
    const agg = new Map();
    pay.filter(s => inDays(s, 30)).forEach(s => s.items.forEach(i => {
      const k = i.productId || i.name, a = agg.get(k) || [i.code || '', i.sap || '', i.name, 0, 0, 0];
      a[3] += i.qty * (i.factor || 1); a[4] += i.total; a[5]++; agg.set(k, a);
    }));
    const loansOpen = VM.store.loanVouchers().filter(VM.store.voucherOpen);
    const invPending = st.invoices.filter(i => i.status !== 'entered' && i.status !== 'cancelled');
    const p = st.products.filter(x => x.active);
    VM.xlsx.exportXlsx({
      'Chỉ số': [['Chỉ số', 'Giá trị'],
        ['Doanh thu hôm nay', days[29][2]], ['Số đơn hôm nay', days[29][1]], ['Doanh thu 7 ngày', VM.sum(days.slice(-7), d => d[2])], ['Doanh thu 30 ngày', VM.sum(days, d => d[2])],
        ['Mã vay đang mở', loansOpen.length], ['Mã vay quá hạn', loansOpen.filter(v => v.overdue).length],
        ['Hóa đơn chưa xong', invPending.length], ['Hàng về chưa có HĐ', invPending.filter(i => i.status === 'no_invoice').length],
        ['Mặt hàng hết', p.filter(x => x.stock <= 0).length], ['Mặt hàng sắp hết', p.filter(x => x.stock > 0 && x.stock <= (x.minStock || 0)).length],
        ['Mặt hàng cận hạn (≤ ' + st.settings.expiryWarnDays + ' ngày)', p.filter(x => VM.daysUntil(x.expiry) <= st.settings.expiryWarnDays).length],
        ['Đơn chưa nhập OH/SAP', pay.filter(s => s.recon !== 'done').length], ['Thời điểm xuất', VM.fmtDT(new Date())]],
      'Doanh thu 30 ngày': [['Ngày', 'Số đơn', 'Doanh thu', 'QR', 'Tiền mặt'], ...days],
      'Bán chạy 30 ngày': [['Mã hàng', 'Mã SAP', 'Tên hàng', 'SL (ĐV nhỏ nhất)', 'Doanh thu', 'Số lần bán'], ...[...agg.values()].sort((a, b) => b[4] - a[4])],
      'Tồn kho cần chú ý': [['Mã hàng', 'Tên hàng', 'Tồn (ĐV nhỏ nhất)', 'Tồn tối thiểu', 'Lô', 'Hạn dùng', 'Vấn đề'],
        ...p.filter(x => x.stock <= (x.minStock || 0) || VM.daysUntil(x.expiry) <= st.settings.expiryWarnDays)
          .map(x => [x.code, x.name, x.stock, x.minStock || 0, x.lot, VM.fmtDate(x.expiry), [x.stock <= 0 ? 'Hết hàng' : x.stock <= (x.minStock || 0) ? 'Sắp hết' : '', VM.daysUntil(x.expiry) <= st.settings.expiryWarnDays ? 'Cận hạn' : ''].filter(Boolean).join(', ')])],
    }, `vinmec_tong_quan_${VM.fileStamp()}.xlsx`);
  }

  function drawAttn(openLoans, overdue, noInv, invPending) {
    const st = S();
    const lowStock = st.products.filter(p => p.active && p.stock > 0 && p.stock <= (p.minStock || 0));
    const out = st.products.filter(p => p.active && p.stock <= 0);
    const exp = st.products.filter(p => p.active && VM.daysUntil(p.expiry) <= st.settings.expiryWarnDays);
    const invLate = invPending.filter(VM.store.invoiceOverdue);
    const recon = paid().filter(s => s.recon !== 'done');
    const bk = VM.backup.status();
    const items = [];
    if (overdue.length) items.push(['danger', 'swap', `${overdue.length} mã vay quá ${st.settings.loanOverdueHours}h chưa gạch sổ`, overdue.slice(0, 2).map(v => `${v.code} (${v.lines.length} thuốc)`).join(', '), 'loans/overdue']);
    if (invLate.length) items.push(['danger', 'file', `${invLate.length} hóa đơn tồn quá ${st.settings.invoiceAlertDays} ngày`, 'Chưa bàn giao NVD / chưa có hóa đơn', 'invoices']);
    if (noInv.length && !invLate.length) items.push(['warn', 'file', `${noInv.length} lô hàng về chưa có hóa đơn`, 'Theo dõi để tránh thừa thuốc trên kệ', 'invoices']);
    if (out.length) items.push(['danger', 'package', `${out.length} mặt hàng đã hết`, out.slice(0, 3).map(p => p.name).join(', '), 'catalog']);
    if (lowStock.length) items.push(['warn', 'package', `${lowStock.length} mặt hàng sắp hết`, lowStock.slice(0, 3).map(p => p.name).join(', '), 'catalog']);
    if (exp.length) items.push(['warn', 'calendar', `${exp.length} mặt hàng cận hạn / hết hạn`, exp.slice(0, 3).map(p => `${p.name} (${VM.fmtDate(p.expiry)})`).join(', '), 'catalog']);
    if (recon.length) items.push(['info', 'refresh', `${recon.length} đơn chưa nhập OH/SAP`, 'Xuất Excel đối soát ở Lịch sử bán', 'history']);
    if (bk.level !== 'ok') items.push([bk.level === 'bad' ? 'danger' : 'warn', 'shield', 'Nên tải bản sao lưu ra ngoài', 'Lần gần nhất: ' + VM.ago(bk.lastDownloadAt), 'backup']);
    $('#attn').innerHTML = items.length ? items.map(([c, ic, t, s, go]) => `<button class="attn-item" data-go="${go}"><div class="kpi-ic ${c}">${icon(ic, 's')}</div><div style="min-width:0"><b>${esc(t)}</b><small>${esc(s)}</small></div><span class="chev">${icon('chevr', 's')}</span></button>`).join('')
      : VM.ui.empty('checkc', 'Mọi thứ đều ổn', 'Không có việc tồn đọng.');
    $$('#attn [data-go]').forEach(b => b.onclick = () => VM.ui.go(b.dataset.go));
  }

  VM.ui.register({ id: 'dashboard', title: 'Tổng quan', group: 'system', icon: 'grid', crumb: 'Hoạt động nhà thuốc hôm nay', render });
})(window.VM);
