/* Sao lưu & khôi phục + Nhật ký thao tác + Vùng nguy hiểm */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, num } = VM;
  const S = () => VM.store.state;
  const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const countsTxt = c => `${num(c.sales || 0)} đơn · ${num(c.loans || 0)} dòng vay · ${num(c.invoices || 0)} HĐ · ${num(c.products || 0)} mặt hàng`;
  let auditQ = '';

  function render(view, top) {
    top.innerHTML = `<button class="btn primary" id="bDl">${icon('download')}<span class="label">Tải bản sao lưu</span></button>`;
    view.innerHTML = `
      <div id="bkStatus"></div>
      <div class="form-grid" style="gap:18px;margin-top:18px">
        <div class="card c6"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('shield')}</div><div><h3>Sao lưu &amp; khôi phục</h3><div class="sub">Dữ liệu lưu ngay trên máy này. Hãy giữ thêm 1 bản bên ngoài trình duyệt.</div></div></div>
          <div class="card-b" style="display:grid;gap:10px">
            <button class="btn primary lg block" id="bDl2">${icon('download')} Tải bản sao lưu (.json)</button>
            <label class="btn lg block" for="bFile" style="cursor:pointer">${icon('upload')} Khôi phục từ file sao lưu…</label><input type="file" id="bFile" accept=".json,application/json" hidden>
            <button class="btn block" id="bSnap">${icon('history')} Tạo điểm khôi phục ngay</button>
            <button class="btn block" id="bXls">${icon('sheet')} Xuất toàn bộ sổ ra Excel</button>
            <div class="muted small">Mẹo: cuối mỗi ca, bấm “Tải bản sao lưu” và chép file vào ổ mạng / USB của khoa.</div>
          </div></div>
        <div class="card c6"><div class="card-h"><div class="kpi-ic info" style="width:38px;height:38px">${icon('folder')}</div><div><h3>Tự động lưu vào thư mục</h3><div class="sub">Mỗi lần tạo điểm khôi phục, ứng dụng ghi đè file của ngày vào thư mục bạn chọn (ổ mạng, OneDrive…)</div></div></div>
          <div class="card-b" id="bFolder"></div></div>
        <div class="card c12"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('database')}</div><div><h3>Điểm khôi phục trong trình duyệt</h3><div class="sub">Tự tạo mỗi ${S().settings.snapshotMinutes} phút khi có thay đổi, khi mở ứng dụng và trước mỗi lần khôi phục / nhập file. Giữ 30 bản gần nhất.</div></div></div>
          <div class="snap-list" id="bSnaps"><div class="card-b muted">Đang tải…</div></div></div>
        <div class="card c12"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('eye')}</div><div style="flex:1"><h3>Nhật ký thao tác</h3><div class="sub">Ai làm gì, lúc nào – không thể sửa từ giao diện</div></div><button class="btn sm" id="bAuditX">${icon('download', 's')} Xuất Excel</button></div>
          <div class="toolbar"><div class="input-icon grow">${icon('search')}<input class="input" id="bAuditQ" type="search" placeholder="Tìm người, thao tác, mã phiếu…" value="${esc(auditQ)}"></div></div>
          <div class="table-wrap" id="bAudit" style="max-height:440px;overflow:auto"></div></div>
        <div class="card c12 danger-zone"><div class="card-h"><div class="kpi-ic danger" style="width:38px;height:38px">${icon('alert')}</div><div><h3>Vùng nguy hiểm</h3><div class="sub">Luôn tạo điểm khôi phục trước khi thực hiện. Chỉ quản lý mới dùng.</div></div></div>
          <div class="card-b" style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn danger" id="bClearDemo">${icon('trash', 's')} Xóa dữ liệu mẫu</button>
            <button class="btn danger" id="bReset">${icon('refresh', 's')} Đặt lại ứng dụng</button>
          </div></div>
      </div>`;
    $('#bDl').onclick = $('#bDl2').onclick = () => { VM.backup.downloadFile(); VM.ui.done('Đã tải bản sao lưu', 'Hãy chép file sang ổ mạng / USB'); drawStatus(); };
    $('#bFile').onchange = e => { const file = e.target.files[0]; e.target.value = ''; if (file) previewRestore(file); };
    $('#bSnap').onclick = async () => { const s = await VM.backup.snapshot('Thủ công'); VM.ui.toast(s ? 'Đã tạo điểm khôi phục' : 'Không tạo được (trình duyệt chặn IndexedDB?)', s ? 'ok' : 'bad'); drawSnaps(); };
    $('#bXls').onclick = exportAll;
    $('#bAuditQ').oninput = VM.debounce(() => { auditQ = $('#bAuditQ').value; drawAudit(); }, 150);
    $('#bAuditX').onclick = () => VM.xlsx.exportXlsx({ 'Nhật ký': [['Thời gian', 'Người dùng', 'Thao tác', 'Đối tượng', 'Mã', 'Chi tiết'], ...auditList().map(a => [VM.fmtDT(a.at), a.user, a.action, a.entity, a.ref, a.detail])] }, `nhat_ky_${VM.fileStamp()}.xlsx`);
    $('#bClearDemo').onclick = clearDemo;
    $('#bReset').onclick = resetAll;
    drawStatus(); drawSnaps(); drawAudit();
  }

  function drawStatus() {
    if (!$('#bkStatus')) return;
    const st = VM.backup.status();
    const card = (cls, ic, label, val, sub) => `<div class="card kpi"><div class="kpi-ic ${cls}">${icon(ic)}</div><div><span>${label}</span><strong style="font-size:18px">${val}</strong><div class="muted small">${sub}</div></div></div>`;
    const fd = st.folder;
    $('#bkStatus').innerHTML = `
      ${st.level !== 'ok' ? `<div class="alert ${st.level === 'bad' ? 'bad' : 'warn'}" style="margin-bottom:14px">${icon('alert', 's')}<span>${st.level === 'bad' ? 'Chưa có bản sao lưu nào. ' : 'Đã hơn 24 giờ chưa có bản sao lưu nằm ngoài trình duyệt. '}Nếu xóa lịch sử trình duyệt hoặc hỏng máy, dữ liệu có thể mất. <b>Hãy tải bản sao lưu ngay.</b></span></div>` : ''}
      ${!st.available ? `<div class="alert warn" style="margin-bottom:14px">${icon('info', 's')}<span>Trình duyệt đang chặn IndexedDB (chế độ ẩn danh?) nên không tạo được điểm khôi phục tự động. Vẫn có thể tải file sao lưu.</span></div>` : ''}
      <div class="kpis" style="margin:0">
        ${card(st.lastSnapAt ? '' : 'danger', 'history', 'Điểm khôi phục gần nhất', st.lastSnapAt ? VM.ago(st.lastSnapAt) : 'Chưa có', st.lastSnapAt ? VM.fmtDT(st.lastSnapAt) : 'Trong trình duyệt')}
        ${card(st.lastDownloadAt && VM.hoursSince(st.lastDownloadAt) < 24 ? '' : 'warn', 'download', 'File tải về gần nhất', st.lastDownloadAt ? VM.ago(st.lastDownloadAt) : 'Chưa tải', st.lastDownloadAt ? VM.fmtDT(st.lastDownloadAt) : 'Nên tải mỗi cuối ca')}
        ${card(fd.state === 'granted' ? '' : fd.handle || fd.name ? 'warn' : 'info', 'folder', 'Thư mục tự động', fd.state === 'granted' ? esc(fd.name) : fd.name ? 'Cần cấp lại quyền' : 'Chưa bật', fd.lastWrite ? 'Ghi lúc ' + VM.fmtDT(fd.lastWrite) : fd.supported ? 'Chrome / Edge hỗ trợ' : 'Trình duyệt không hỗ trợ')}
        ${card('', 'database', 'Dữ liệu hiện tại', 'Bản #' + num(S().meta.rev), countsTxt(VM.backup.counts(S())))}
      </div>`;
    const f = $('#bFolder');
    if (!fd.supported) f.innerHTML = `<div class="alert info">${icon('info', 's')}<span>Trình duyệt này chưa hỗ trợ ghi thư mục. Dùng <b>Chrome</b> hoặc <b>Edge</b> trên máy tính, hoặc tải file sao lưu thủ công.</span></div>`;
    else if (fd.state === 'granted') f.innerHTML = `<div class="alert ok">${icon('checkc', 's')}<span>Đang tự lưu vào <b>${esc(fd.name)}</b>${fd.lastWrite ? ' · lần cuối ' + VM.fmtDT(fd.lastWrite) : ''}</span></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" id="fWrite">${icon('refresh', 's')} Ghi ngay</button><button class="btn" id="fPick">${icon('folder', 's')} Đổi thư mục</button><button class="btn ghost" id="fForget">Tắt</button></div>`;
    else if (fd.name) f.innerHTML = `<div class="alert warn">${icon('alert', 's')}<span>Trình duyệt cần bạn cấp lại quyền ghi vào <b>${esc(fd.name)}</b> (mỗi lần mở lại trình duyệt).</span></div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" id="fGrant">${icon('check', 's')} Cấp quyền</button><button class="btn" id="fPick">${icon('folder', 's')} Chọn thư mục khác</button><button class="btn ghost" id="fForget">Tắt</button></div>`;
    else f.innerHTML = `<p class="muted" style="margin-top:0">Chọn một thư mục an toàn (VD: ổ mạng khoa Dược). File <span class="mono">vinmec-pharmacy-backup_YYYY-MM-DD.json</span> sẽ được cập nhật tự động.</p><button class="btn primary" id="fPick">${icon('folder', 's')} Chọn thư mục sao lưu</button>`;
    const on = (id, fn) => { const b = $('#' + id); if (b) b.onclick = async () => { try { await fn(); drawStatus(); } catch (e) { if (e.name !== 'AbortError') VM.ui.toast('Không thực hiện được: ' + e.message, 'bad'); } }; };
    on('fPick', async () => { await VM.backup.chooseFolder(); VM.ui.done('Đã bật tự động lưu vào thư mục'); });
    on('fGrant', () => VM.backup.grantFolder());
    on('fForget', () => VM.backup.forgetFolder());
    on('fWrite', async () => { await VM.backup.snapshot('Thủ công'); VM.ui.done('Đã ghi bản sao lưu vào thư mục'); drawSnaps(); });
  }

  async function drawSnaps() {
    const box = $('#bSnaps'); if (!box) return;
    let snaps = [];
    try { snaps = await VM.backup.list(); } catch (e) { box.innerHTML = `<div class="card-b muted">Không đọc được điểm khôi phục: ${esc(e.message)}</div>`; return; }
    if (!$('#bSnaps')) return;
    if (!snaps.length) { box.innerHTML = VM.ui.empty('history', 'Chưa có điểm khôi phục', 'Bấm “Tạo điểm khôi phục ngay”.'); return; }
    box.innerHTML = snaps.map((s, k) => `<div class="snap"><div class="kpi-ic ${k === 0 ? '' : 'info'}" style="width:36px;height:36px">${icon('history', 's')}</div>
      <div style="flex:1;min-width:0"><b>${VM.fmtDT(s.at)}</b> <span class="muted small">· ${esc(s.reason)}${s.by ? ' · ' + esc(s.by) : ''}</span><div class="muted small">${countsTxt(s.counts || {})} · ${fmtSize(s.size || 0)} · bản #${s.rev}</div></div>
      <div class="actions"><button class="btn sm" data-r="${s.id}">${icon('undo', 's')} Khôi phục</button><button class="btn ghost icon sm" data-d="${s.id}" title="Tải file" aria-label="Tải file">${icon('download', 's')}</button><button class="btn ghost icon sm" data-x="${s.id}" title="Xóa" aria-label="Xóa">${icon('trash', 's')}</button></div></div>`).join('');
    $$('#bSnaps [data-r]').forEach(b => b.onclick = async () => {
      const s = await VM.backup.getSnap(b.dataset.r);
      const ok = await VM.ui.confirm({ title: 'Khôi phục về ' + VM.fmtDT(s.at) + '?', message: `Dữ liệu hiện tại (${countsTxt(VM.backup.counts(S()))}) sẽ được thay bằng điểm khôi phục (${countsTxt(s.counts)}).<br><br>Trạng thái hiện tại được tự lưu thành một điểm khôi phục mới nên vẫn có thể quay lại.`, ok: 'Khôi phục', danger: true, ic: 'undo' });
      if (!ok) return;
      await VM.backup.restore(JSON.parse(s.data), 'Điểm khôi phục ' + VM.fmtDT(s.at));
      VM.ui.done('Khôi phục dữ liệu thành công');
    });
    $$('#bSnaps [data-d]').forEach(b => b.onclick = async () => { const s = await VM.backup.getSnap(b.dataset.d); VM.download(new Blob([s.data], { type: 'application/json' }), `vinmec-pharmacy-snapshot_${s.at.replace(/[:T]/g, '-').slice(0, 16)}.json`); });
    $$('#bSnaps [data-x]').forEach(b => b.onclick = async () => { if (await VM.ui.confirm({ title: 'Xóa điểm khôi phục này?', ok: 'Xóa', danger: true })) { await VM.backup.removeSnap(b.dataset.x); drawSnaps(); } });
  }

  async function previewRestore(file) {
    let parsed;
    try { parsed = await VM.backup.parseFile(file); } catch (e) { VM.ui.toast(e.message, 'bad', 6000); return; }
    const { info, data } = parsed, cur = VM.backup.counts(S()), c = info.counts;
    const row = (label, a, b) => `<tr><td>${label}</td><td class="num">${num(a)}</td><td class="num"><b>${num(b)}</b></td></tr>`;
    VM.ui.modal({
      title: 'Khôi phục từ file', sub: esc(file.name), ic: 'upload', size: 'lg', icCls: '',
      body: `${info.checksumOk === true ? `<div class="alert ok">${icon('checkc', 's')}<span>File nguyên vẹn (checksum khớp).</span></div>` : info.checksumOk === false ? `<div class="alert bad">${icon('alert', 's')}<span>Checksum không khớp – file có thể đã bị sửa hoặc hỏng. Chỉ khôi phục nếu chắc chắn.</span></div>` : `<div class="alert warn">${icon('info', 's')}<span>File không có checksum (bản cũ / điểm khôi phục). Không kiểm tra được tính nguyên vẹn.</span></div>`}
        <dl class="kv" style="margin:14px 0"><dt>Thời điểm sao lưu</dt><dd>${info.exportedAt ? VM.fmtDT(info.exportedAt) : '—'}</dd><dt>Người sao lưu</dt><dd>${esc(info.exportedBy || '—')}</dd></dl>
        <div class="table-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="t"><thead><tr><th>Dữ liệu</th><th class="num">Hiện tại</th><th class="num">Trong file</th></tr></thead><tbody>
          ${row('Đơn bán lẻ', cur.sales, c.sales)}${row('Sổ vay (dòng thuốc)', cur.loans, c.loans)}${row('Hóa đơn', cur.invoices, c.invoices)}${row('Mặt hàng', cur.products, c.products)}${row('Nhật ký', cur.audit, c.audit)}</tbody></table></div>
        <div class="alert info" style="margin-top:14px">${icon('shield', 's')}<span>Dữ liệu hiện tại sẽ được lưu thành điểm khôi phục trước khi thay thế.</span></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn danger solid" data-ok>${icon('undo', 's')} Thay thế bằng dữ liệu trong file</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = async () => { close(); await VM.backup.restore(data, 'File ' + file.name); VM.ui.done('Khôi phục dữ liệu thành công', 'Từ file ' + file.name); };
      },
    });
  }

  const auditList = () => { const q = VM.normalize(auditQ); return S().audit.filter(a => !q || VM.normalize([a.user, a.action, a.entity, a.ref, a.detail].join(' ')).includes(q)); };
  function drawAudit() {
    const box = $('#bAudit'); if (!box) return;
    const l = auditList();
    if (!l.length) { box.innerHTML = VM.ui.empty('eye', 'Chưa có thao tác', ''); return; }
    box.innerHTML = `<table class="t"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Thao tác</th><th class="hide-m">Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>
      ${l.slice(0, 300).map(a => `<tr><td style="white-space:nowrap">${VM.fmtDT(a.at)}</td><td>${esc(a.user)}</td><td><b>${esc(a.action)}</b></td><td class="hide-m">${esc(a.entity)}${a.ref ? `<div class="t-sub mono">${esc(a.ref)}</div>` : ''}</td><td class="muted small">${esc(a.detail)}</td></tr>`).join('')}</tbody></table>
      ${l.length > 300 ? `<div class="muted small" style="padding:10px 18px">Hiển thị 300/${num(l.length)} dòng – xuất Excel để xem đầy đủ.</div>` : ''}`;
  }

  function exportAll() {
    const s = S(), ST = { pending: 'Chờ xác nhận', open: 'Chưa gạch', partial: 'Gạch một phần', settled: 'Đã gạch', cancelled: 'Đã hủy' };
    VM.xlsx.exportXlsx({
      'Đơn bán lẻ': [['Mã đơn', 'Thời gian', 'Người bán', 'Khách hàng', 'PID', 'Thanh toán', 'Tổng tiền', 'Trạng thái', 'Đối soát'], ...s.sales.map(o => [o.code, VM.fmtDT(o.createdAt), o.sellerName, o.customer, o.pid, o.payment === 'qr' ? 'QR' : 'Tiền mặt', o.total, o.status === 'cancelled' ? 'Đã hủy' : 'Đã thanh toán', o.recon === 'done' ? 'Đã nhập OH/SAP' : 'Chờ nhập'])],
      'Chi tiết bán': [['Mã đơn', 'Mã hàng', 'Mã SAP', 'Tên', 'Lô', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'], ...s.sales.flatMap(o => o.items.map(i => [o.code, i.code, i.sap, i.name, i.lot, i.unit, i.qty, i.price, i.total]))],
      'Sổ vay': [['Mã vay', 'Ngày giờ', 'Thuốc', 'Mã SAP', 'ĐVT', 'SL', 'Còn lại', 'Cho vay', 'Vay', 'Người vay', 'Người cho vay', 'Trạng thái'], ...s.loans.map(l => [VM.store.loanGroup(l), VM.fmtDT(l.createdAt), l.name, l.sap, l.unit, l.qty, VM.store.loanRemaining(l), l.from, l.to, l.borrower, l.lender, ST[VM.store.loanStatus(l)]])],
      'Sổ hóa đơn': [['Sổ', 'Ngày về', 'NCC', 'Số HĐ', 'Số MH', 'Tổng tiền', 'NVD nhận', 'Trạng thái'], ...s.invoices.map(i => [i.book, VM.fmtDate(i.receivedAt), i.supplier, i.invoiceNo, i.itemCount, i.total, i.nvdReceiver, VM.store.INVOICE_STATUS[i.status].label])],
      'Danh mục': [['Mã', 'Mã SAP', 'Tên', 'Nhóm', 'Tồn (ĐV nhỏ nhất)', 'Lô', 'HSD'], ...s.products.map(p => [p.code, p.sap, p.name, VM.store.CATEGORIES[p.category].label, p.stock, p.lot, VM.fmtDate(p.expiry)])],
      'Nhật ký': [['Thời gian', 'Người dùng', 'Thao tác', 'Đối tượng', 'Mã', 'Chi tiết'], ...s.audit.map(a => [VM.fmtDT(a.at), a.user, a.action, a.entity, a.ref, a.detail])],
    }, `vinmec_pharmacy_toan_bo_${VM.fileStamp()}.xlsx`);
  }

  const typed = v => VM.normalize(v) === 'xoa';
  async function clearDemo() {
    const s = S(), n = ['sales', 'loans', 'invoices'].reduce((a, k) => a + s[k].filter(x => x.demo).length, 0);
    const v = await VM.ui.confirm({ title: 'Xóa dữ liệu mẫu?', danger: true, ok: 'Xóa dữ liệu mẫu', message: `Sẽ xóa <b>${n}</b> đơn bán / phiếu vay / hóa đơn mẫu (được tạo khi cài đặt lần đầu). Danh mục hàng mẫu được giữ lại để bạn sửa hoặc thay bằng file Excel.<br><br>Gõ <b>XOA</b> để xác nhận.`, input: { label: 'Gõ XOA', required: true } });
    if (!v) return;
    if (!typed(v)) return VM.ui.toast('Chưa gõ đúng “XOA” – đã hủy', 'warn');
    await VM.backup.snapshot('Trước khi xóa dữ liệu mẫu');
    ['sales', 'loans', 'invoices'].forEach(k => { s[k] = s[k].filter(x => !x.demo); });
    s.meta.demo = false;
    VM.store.log('Xóa dữ liệu mẫu', 'Hệ thống', `${n} bản ghi`);
    VM.store.save('restore');
    VM.ui.done('Đã xóa dữ liệu mẫu', `${n} bản ghi`);
  }
  async function resetAll() {
    if (!VM.store.isAdmin()) return VM.ui.toast('Chỉ quản lý mới được đặt lại ứng dụng', 'bad');
    const v = await VM.ui.confirm({ title: 'Đặt lại toàn bộ ứng dụng?', danger: true, ok: 'Đặt lại', message: 'Toàn bộ đơn bán, sổ vay, sổ hóa đơn, danh mục và cài đặt sẽ trở về trạng thái cài đặt ban đầu (có dữ liệu mẫu). Một điểm khôi phục sẽ được tạo trước.<br><br>Gõ <b>XOA</b> để xác nhận.', input: { label: 'Gõ XOA', required: true } });
    if (!v) return;
    if (!typed(v)) return VM.ui.toast('Chưa gõ đúng “XOA” – đã hủy', 'warn');
    await VM.backup.snapshot('Trước khi đặt lại');
    VM.store.replace(VM.store.seedState(), 'restore');
    VM.store.log('Đặt lại ứng dụng', 'Hệ thống'); VM.store.save('restore');
    VM.ui.done('Đã đặt lại ứng dụng');
  }

  VM.backup.onChange(() => { if (VM.ui.current === 'backup') { drawStatus(); drawSnaps(); } });
  VM.ui.register({ id: 'backup', title: 'Sao lưu & khôi phục', group: 'system', icon: 'shield', render,
    badge: () => { const l = VM.backup.status().level; return l === 'ok' ? null : { n: '!', soft: l === 'warn', title: 'Cần sao lưu' }; } });
})(window.VM);
