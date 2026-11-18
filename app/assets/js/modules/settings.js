/* Cài đặt: nhà thuốc, QR thanh toán, kho (plans / Funds center), nhân viên, nhà cung cấp, ngưỡng cảnh báo */
'use strict';
(function (VM) {
  const { $, $$, esc, icon } = VM;
  const S = () => VM.store.state;
  const BANKS = [['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'], ['970407', 'Techcombank'], ['970422', 'MB Bank'], ['970416', 'ACB'], ['970432', 'VPBank'], ['970423', 'TPBank'], ['970403', 'Sacombank'], ['970441', 'VIB'], ['970437', 'HDBank'], ['970443', 'SHB']];
  const ROLES = ['Dược sĩ nhà thuốc', 'Dược sĩ kho nội trú', 'Nghiệp vụ dược', 'Quản lý / Trưởng khoa', 'Thu ngân'];
  let draft = null, dirty = false;

  function render(view, top) {
    draft = JSON.parse(JSON.stringify({ settings: S().settings, staff: S().staff }));
    dirty = false;
    const admin = VM.store.isAdmin();
    top.innerHTML = `<button class="btn" id="stXls" title="Xuất danh sách kho, nhân viên, nhà cung cấp, ngưỡng cảnh báo">${icon('download')}<span class="label">Xuất Excel</span></button><button class="btn ghost" id="stUndo" disabled>${icon('undo')}<span class="label">Hoàn tác</span></button><button class="btn primary" id="stSave" disabled>${icon('check')}<span class="label">Lưu cài đặt</span></button>`;
    const st = draft.settings, v = x => esc(x == null ? '' : x);
    const provOpts = cur => Object.entries(VM.ai.PROVIDERS).map(([k, l]) => `<option value="${k}" ${(cur || 'auto') === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
    // Độ chính xác đo tại khoa, tách theo nhà cung cấp / mô hình (aiStats.by) để so sánh khi dùng thật
    const byProvider = () => {
      const rows = Object.entries(S().aiStats.by || {}).sort((a, b) => a[0].localeCompare(b[0]));
      if (!rows.length) return '';
      return `<div class="c12 table-wrap"><table class="t"><thead><tr><th>Loại</th><th>Nhà cung cấp / mô hình</th><th class="num">Số lần</th><th class="num">Chính xác</th></tr></thead><tbody>${rows.map(([k, x]) => {
        const [kind, tag] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)], ocr = kind === 'ocr';
        return `<tr><td>${ocr ? 'OCR' : 'Giọng nói'}</td><td class="mono">${esc(tag)}</td><td class="num">${ocr ? `${x.docs} HĐ · ${x.fields} ô` : x.n}</td><td class="num"><b>${ocr ? VM.ai.pct(x.kept, x.fields) : VM.ai.pct(x.top1, x.n)}</b></td></tr>`;
      }).join('')}</tbody></table></div>`;
    };
    view.innerHTML = `${admin ? '' : `<div class="alert warn" style="margin-bottom:16px">${icon('info', 's')}<span>Chỉ <b>Quản lý</b> được thay đổi cài đặt. Bạn đang xem ở chế độ chỉ đọc.</span></div>`}
      <fieldset id="stForm" ${admin ? '' : 'disabled'} style="border:0;padding:0;margin:0"><div class="form-grid" style="gap:18px">
        <div class="card c6"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('cross')}</div><div><h3>Nhà thuốc</h3><div class="sub">Hiển thị trên hóa đơn bán lẻ và sổ in</div></div></div>
          <div class="card-b form-grid">
            <div class="field c8"><label>Tên nhà thuốc</label><input class="input" data-s="pharmacyName" value="${v(st.pharmacyName)}"></div>
            <div class="field c4"><label>Mã quầy</label><input class="input mono" data-s="counter" value="${v(st.counter)}" maxlength="4"><span class="hint">Dùng trong mã đơn ORD-…-<b>${v(st.counter)}</b>-0001. Mỗi máy 1 mã khác nhau.</span></div>
          </div></div>
        <div class="card c6"><div class="card-h"><div class="kpi-ic info" style="width:38px;height:38px">${icon('qr')}</div><div><h3>Tài khoản nhận QR (VietQR)</h3><div class="sub">Mã QR tự sinh kèm số tiền &amp; mã đơn – cần Internet để hiển thị</div></div></div>
          <div class="card-b form-grid">
            <div class="field c6"><label>Ngân hàng</label><select class="select" data-b="bin"><option value="">— Chưa chọn —</option>${BANKS.map(([b, n]) => `<option value="${b}" ${st.bank.bin === b ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <div class="field c6"><label>Số tài khoản</label><input class="input mono" data-b="account" value="${v(st.bank.account)}" inputmode="numeric"></div>
            <div class="field c12"><label>Chủ tài khoản</label><input class="input" data-b="owner" value="${v(st.bank.owner)}" placeholder="VD: BENH VIEN DA KHOA QUOC TE VINMEC"></div>
          </div></div>
        <div class="card c12"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('package')}</div><div style="flex:1"><h3>Kho &amp; mã SAP</h3><div class="sub">plans / Funds center dùng khi xuất file cho tool điều chuyển nội viện (cần Khoa Dược xác nhận)</div></div><button class="btn sm" id="stAddStore">${icon('plus', 's')} Thêm kho</button></div>
          <div class="table-wrap"><table class="t lines-tbl"><thead><tr><th>Mã kho</th><th>Tên kho</th><th>plans</th><th>Funds center</th><th></th></tr></thead><tbody id="stStores"></tbody></table></div></div>
        <div class="card c12"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('user')}</div><div style="flex:1"><h3>Nhân viên</h3><div class="sub">Danh sách chọn khi đăng nhập / ghi sổ. Quản lý được hủy đơn, sửa cài đặt, đặt lại dữ liệu.</div></div><button class="btn sm" id="stAddStaff">${icon('plus', 's')} Thêm nhân viên</button></div>
          <div class="table-wrap"><table class="t lines-tbl"><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Vai trò</th><th>Kho</th><th>Quản lý</th><th></th></tr></thead><tbody id="stStaff"></tbody></table></div><datalist id="stRoles">${ROLES.map(r => `<option value="${r}">`).join('')}</datalist></div>
        <div class="card c6"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('truck')}</div><div><h3>Nhà cung cấp</h3><div class="sub">Mỗi dòng một nhà cung cấp – gợi ý khi ghi hóa đơn</div></div></div>
          <div class="card-b"><textarea class="textarea" id="stSup" style="min-height:160px">${esc(st.suppliers.join('\n'))}</textarea></div></div>
        <div class="card c6"><div class="card-h"><div class="kpi-ic warn" style="width:38px;height:38px">${icon('alert')}</div><div><h3>Ngưỡng cảnh báo</h3><div class="sub">Áp dụng cho badge menu, bảng điều khiển và các sổ</div></div></div>
          <div class="card-b form-grid">
            ${num('loanOverdueHours', 'Phiếu vay quá hạn sau (giờ)', st.loanOverdueHours)}
            ${num('invoiceAlertDays', 'Hóa đơn tồn đọng sau (ngày)', st.invoiceAlertDays)}
            ${num('expiryWarnDays', 'Cảnh báo hạn dùng trước (ngày)', st.expiryWarnDays)}
            ${num('priceDiffPct', 'Chênh lệch giá nhập cần hỏi QLD (%)', st.priceDiffPct)}
            ${num('snapshotMinutes', 'Tạo điểm khôi phục mỗi (phút)', st.snapshotMinutes)}
          </div></div>
        <div class="card c12" id="aiCard"><div class="card-h"><div class="kpi-ic" style="width:38px;height:38px">${icon('shield')}</div><div style="flex:1"><h3>AI – giọng nói &amp; OCR hóa đơn</h3><div class="sub">${VM.isHosted() ? 'Có máy chủ AI của app: mặc định dùng AI của app (OpenAI / Gemini / Qwen) – âm thanh / ảnh hóa đơn được gửi tới nhà cung cấp đã chọn.' : 'Mặc định không gửi âm thanh / ảnh hóa đơn ra Internet. Chỉ gọi máy chủ trong mạng nội bộ bệnh viện.'}</div></div></div>
          <div class="card-b form-grid">
            <div class="field c6"><label>Nhập bằng giọng nói (Bán hàng)</label><select class="select" data-ai="stt">${Object.entries(VM.ai.MODES).map(([k, m]) => `<option value="${k}" ${st.ai.stt === k ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
              <span class="hint" id="aiSttHint"></span></div>
            <div class="field c6"><label>Đọc ảnh hóa đơn (OCR)</label><select class="select" data-ai="ocr">${Object.entries(VM.ai.OCR_MODES).map(([k, m]) => `<option value="${k}" ${st.ai.ocr === k ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
              <span class="hint" id="aiAppHint"></span></div>
            <div class="field c6 ai-prov"><label>Nhà cung cấp OCR (AI của app)</label><select class="select" data-ai="ocrProvider">${provOpts(st.ai.ocrProvider)}</select></div>
            <div class="field c6 ai-prov"><label>Nhà cung cấp giọng nói (AI của app)</label><select class="select" data-ai="sttProvider">${provOpts(st.ai.sttProvider)}</select></div>
            <div class="field c6"><label>Máy chủ giọng nói nội bộ (Whisper / PhoWhisper)</label><input class="input mono" data-ai="sttUrl" value="${v(st.ai.sttUrl)}" placeholder="http://192.168.1.20:8080/inference"><span class="hint">whisper.cpp server: <span class="mono">/inference</span> · máy chủ kiểu OpenAI: <span class="mono">/v1/audio/transcriptions</span></span></div>
            <div class="field c6"><label>Máy chủ OCR nội bộ (API kiểu OpenAI – Ollama / vLLM)</label><input class="input mono" data-ai="ocrUrl" value="${v(st.ai.ocrUrl)}" placeholder="http://192.168.1.20:11434/v1/chat/completions"></div>
            <div class="field c3"><label>Tên mô hình OCR</label><input class="input mono" data-ai="ocrModel" value="${v(st.ai.ocrModel)}" placeholder="qwen2.5vl:7b"></div>
            <div class="field c3"><label>&nbsp;</label><button type="button" class="btn" id="aiPing">${icon('refresh', 's')} Kiểm tra kết nối</button></div>
            <label class="check c12"><input type="checkbox" data-ai="allowPublic" ${st.ai.allowPublic ? 'checked' : ''}> Cho phép gửi tới máy chủ <b>ngoài</b> mạng nội bộ (không khuyến nghị – hóa đơn / giọng nói có thể chứa thông tin mật)</label>
            <div class="c12 ai-stats">
              <div><span>Độ chính xác OCR thực tế</span><b>${VM.ai.pct(S().aiStats.ocr.kept, S().aiStats.ocr.fields)}</b><small>${S().aiStats.ocr.fields} ô máy đọc · ${S().aiStats.ocr.docs} hóa đơn · tính theo số ô dược sĩ giữ nguyên khi lưu</small></div>
              <div><span>Giọng nói: chọn đúng ngay gợi ý đầu</span><b>${VM.ai.pct(S().aiStats.voice.top1, S().aiStats.voice.n)}</b><small>${S().aiStats.voice.n} lần thêm hàng bằng giọng nói</small></div>
            </div>
            ${byProvider()}
          </div></div>
      </div></fieldset>`;
    drawStores(); drawStaff();
    const form = $('#stForm');
    form.addEventListener('input', touch); form.addEventListener('change', touch);
    $$('[data-s]', form).forEach(i => i.oninput = () => { st[i.dataset.s] = i.value.trim(); touch(); });
    $$('[data-b]', form).forEach(i => i.oninput = i.onchange = () => { st.bank[i.dataset.b] = i.value.trim(); touch(); });
    $$('[data-n]', form).forEach(i => i.oninput = () => { st[i.dataset.n] = Math.max(1, Math.floor(VM.parseNum(i.value))); touch(); });
    // Trạng thái máy chủ AI của app: nhà cung cấp nào đã có khóa, mô hình nào. Đọc bản nháp st (chưa lưu), không đọc cài đặt đã lưu
    const usesApp = () => st.ai.stt === 'app' || st.ai.ocr === 'app';
    const pname = id => VM.ai.PROVIDERS[id] || id;
    const showProv = () => $$('.ai-prov', form).forEach((f, i) => { f.hidden = !(i === 0 ? st.ai.ocr === 'app' : st.ai.stt === 'app'); });
    const markProv = r => $$('[data-ai=ocrProvider],[data-ai=sttProvider]', form).forEach(sel => {
      const kind = sel.dataset.ai === 'ocrProvider' ? 'ocr' : 'stt';
      [...sel.options].forEach(o => {
        if (o.value === 'auto') { o.textContent = `${VM.ai.PROVIDERS.auto}${r.defaults && r.defaults[kind] ? ' – ' + pname(r.defaults[kind]) : ''}`; return; }
        const p = (r.providers || {})[o.value], ok = p && p.ready && p[kind].length;
        o.disabled = !ok; o.textContent = `${pname(o.value)}${ok ? ' · ' + p[kind][0] : p && p.ready ? ' · chưa đặt mô hình' : ' · chưa có khóa'}`;
      });
    });
    const appHint = async () => {
      const h = $('#aiAppHint'); if (!h) return;
      showProv();
      if (!usesApp()) { h.textContent = st.ai.ocr === 'lan' ? 'Ảnh gửi tới máy chủ OCR nội bộ điền bên dưới.' : ''; return; }
      h.textContent = 'Đang kiểm tra máy chủ AI của app…';
      try {
        const r = await VM.ai.health(); if (!$('#aiAppHint')) return;
        markProv(r);
        const ready = Object.entries(r.providers || {}).filter(([, p]) => p.ready).map(([id]) => pname(id));
        h.innerHTML = r.ready ? `<b style="color:var(--success)">Sẵn sàng</b> · ${esc(ready.join(', '))}` : '<b style="color:var(--danger)">Máy chủ chưa có khóa AI nào</b> – điền khóa vào .env (npm run dev) hoặc biến môi trường trên Vercel rồi deploy lại.';
      } catch (e) { if ($('#aiAppHint')) h.innerHTML = `<b style="color:var(--danger)">${esc(e.message)}</b>`; }
    };
    appHint();
    const sttHint = () => { const h = $('#aiSttHint'), m = st.ai.stt; h.innerHTML = m === 'app' ? '<b style="color:var(--warning)">Ghi âm tối đa 10 giây rồi gửi tới nhà cung cấp AI đã chọn</b> qua máy chủ của app (kèm tên thuốc trong danh mục để nhận đúng tên).' : m === 'cloud' ? '<b style="color:var(--danger)">Âm thanh được gửi tới máy chủ của nhà cung cấp trình duyệt.</b> Chỉ dùng khi đã được phép.' : m === 'local' ? 'Chạy ngay trên máy (Chrome/Edge có nhận giọng nói on-device). Máy chưa có gói tiếng Việt thì dùng máy chủ nội bộ.' : m === 'server' ? 'Ghi âm tối đa 10 giây rồi gửi tới máy chủ nội bộ.' : 'Nút micro sẽ bị tắt.'; };
    sttHint();
    $$('[data-ai]', form).forEach(i => i.oninput = i.onchange = () => { st.ai[i.dataset.ai] = i.type === 'checkbox' ? i.checked : i.value.trim(); if (i.dataset.ai === 'stt') sttHint(); if (i.dataset.ai === 'stt' || i.dataset.ai === 'ocr') appHint(); touch(); });
    showProv();
    $('#aiPing').onclick = async () => {
      if (usesApp()) {
        try { const r = await VM.ai.health(); VM.ui.toast(r.ready ? 'AI của app: sẵn sàng' : 'AI của app: máy chủ chưa có khóa AI nào', r.ready ? undefined : 'bad', 5000); }
        catch (e) { VM.ui.toast(e.message, 'bad', 6000); }
        appHint();
      }
      for (const [k, label] of [['ocrUrl', 'OCR'], ['sttUrl', 'Giọng nói']]) {
        const url = st.ai[k];
        if (!url || (k === 'ocrUrl' ? st.ai.ocr === 'app' : st.ai.stt !== 'server')) continue;
        if (!VM.isLocalUrl(url) && !st.ai.allowPublic) { VM.ui.toast(`${label}: ${url} không thuộc mạng nội bộ – bị chặn`, 'bad', 5000); continue; }
        try { await fetch(new URL(url).origin + '/', { mode: 'no-cors', cache: 'no-store' }); VM.ui.toast(`${label}: máy chủ ${new URL(url).origin} đang chạy`); }
        catch (e) { VM.ui.toast(`${label}: không kết nối được ${new URL(url).origin}`, 'warn', 5000); }
      }
    };
    $('#stSup').oninput = () => { st.suppliers = $('#stSup').value.split('\n').map(x => x.trim()).filter(Boolean); touch(); };
    $('#stAddStore').onclick = () => { st.stores.push({ code: '', name: '', plant: '', fundsCenter: '' }); drawStores(); touch(); $('#stStores tr:last-child input').focus(); };
    $('#stAddStaff').onclick = () => { draft.staff.push({ id: '', name: '', role: ROLES[0], store: st.stores[0] ? st.stores[0].code : '', admin: false, _new: true }); drawStaff(); touch(); $('#stStaff tr:last-child input').focus(); };
    $('#stSave').onclick = save;
    $('#stXls').onclick = exportXls;
    $('#stUndo').onclick = () => VM.ui.rerender();
    const beforeLeave = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeLeave);
    return () => { window.removeEventListener('beforeunload', beforeLeave); if (dirty) VM.ui.toast('Cài đặt chưa lưu đã bị bỏ qua', 'warn'); };
  }
  const num = (k, label, val) => `<div class="field c6"><label>${label}</label><input class="input num" data-n="${k}" inputmode="numeric" value="${esc(val)}"></div>`;
  function exportXls() {
    const st = S().settings, tr = st.transfer || {};
    VM.xlsx.exportXlsx({
      'Kho': [['Mã kho', 'Tên kho', 'plans', 'Funds center'], ...st.stores.map(x => [x.code, x.name, x.plant || '', x.fundsCenter || ''])],
      'Nhân viên': [['Mã NV', 'Họ tên', 'Vai trò', 'Kho', 'Quản lý'], ...S().staff.map(x => [x.id, x.name, x.role, x.store, x.admin ? 'Có' : ''])],
      'Nhà cung cấp': [['Nhà cung cấp'], ...st.suppliers.map(x => [x])],
      'Thông số': [['Thông số', 'Giá trị'], ['Tên nhà thuốc', st.pharmacyName], ['Mã quầy', st.counter],
        ['Phiếu vay quá hạn sau (giờ)', st.loanOverdueHours], ['Hóa đơn tồn đọng sau (ngày)', st.invoiceAlertDays], ['Cảnh báo hạn dùng trước (ngày)', st.expiryWarnDays],
        ['Chênh lệch giá nhập cần hỏi (%)', st.priceDiffPct], ['Tạo điểm khôi phục mỗi (phút)', st.snapshotMinutes],
        ['File điều chuyển – plans', tr.plant || ''], ['File điều chuyển – Funds center', tr.fundsCenter || ''], ['File điều chuyển – số lượng theo', tr.unit === 'loan' ? 'ĐVT ghi trên phiếu' : 'ĐVT nhỏ nhất'],
        ['Giọng nói', (VM.ai.MODES[st.ai.stt] || {}).label || st.ai.stt], ['OCR hóa đơn', (VM.ai.OCR_MODES[st.ai.ocr] || {}).label || st.ai.ocr], ['Nhà cung cấp OCR', VM.ai.PROVIDERS[st.ai.ocrProvider || 'auto']], ['Nhà cung cấp giọng nói', VM.ai.PROVIDERS[st.ai.sttProvider || 'auto']], ['Máy chủ OCR', st.ai.ocrUrl], ['Mô hình OCR', st.ai.ocrModel]],
    }, `vinmec_cai_dat_${VM.fileStamp()}.xlsx`);
  }
  function touch() { dirty = true; $('#stSave').disabled = false; $('#stUndo').disabled = false; }

  function drawStores() {
    const st = draft.settings;
    $('#stStores').innerHTML = st.stores.map((s, i) => `<tr data-i="${i}">
      <td><input class="input mono" data-k="code" value="${esc(s.code)}" style="width:90px"></td><td><input class="input" data-k="name" value="${esc(s.name)}"></td>
      <td><input class="input mono" data-k="plant" value="${esc(s.plant)}" placeholder="VD: 1100" style="width:120px"></td><td><input class="input mono" data-k="fundsCenter" value="${esc(s.fundsCenter)}" style="width:160px"></td>
      <td><button class="btn ghost icon sm" data-del aria-label="Xóa kho">${icon('trash', 's')}</button></td></tr>`).join('');
    $$('#stStores tr').forEach(tr => {
      const s = st.stores[+tr.dataset.i];
      $$('[data-k]', tr).forEach(inp => inp.oninput = () => { s[inp.dataset.k] = inp.dataset.k === 'code' ? inp.value.trim().toUpperCase() : inp.value.trim(); });
      tr.querySelector('[data-del]').onclick = () => {
        const used = S().loans.some(l => l.from === s.code || l.to === s.code);
        if (used) return VM.ui.toast(`Kho ${s.code} đã có trong sổ vay – không thể xóa`, 'warn');
        st.stores.splice(+tr.dataset.i, 1); drawStores(); touch();
      };
    });
  }
  function drawStaff() {
    const st = draft.settings, me = VM.store.currentUser() || {};
    $('#stStaff').innerHTML = draft.staff.map((s, i) => `<tr data-i="${i}">
      <td><input class="input mono" data-k="id" value="${esc(s.id)}" style="width:80px" ${s._new ? '' : 'readonly title="Không đổi mã NV đã dùng"'}></td>
      <td><input class="input" data-k="name" value="${esc(s.name)}"></td>
      <td><input class="input" data-k="role" value="${esc(s.role)}" list="stRoles"></td>
      <td><select class="select" data-k="store" style="min-height:36px">${st.stores.map(x => `<option ${x.code === s.store ? 'selected' : ''}>${esc(x.code)}</option>`).join('')}</select></td>
      <td><input type="checkbox" data-k="admin" ${s.admin ? 'checked' : ''} ${s.id === me.id ? 'disabled title="Không tự bỏ quyền của mình"' : ''} style="width:20px;height:20px;accent-color:var(--primary)"></td>
      <td>${s.id === me.id ? '<span class="muted small">Bạn</span>' : `<button class="btn ghost icon sm" data-del aria-label="Xóa nhân viên">${icon('trash', 's')}</button>`}</td></tr>`).join('');
    $$('#stStaff tr').forEach(tr => {
      const s = draft.staff[+tr.dataset.i];
      $$('[data-k]', tr).forEach(inp => inp.oninput = inp.onchange = () => { s[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.dataset.k === 'id' ? inp.value.trim().toUpperCase() : inp.value.trim(); });
      const del = tr.querySelector('[data-del]');
      if (del) del.onclick = () => { draft.staff.splice(+tr.dataset.i, 1); drawStaff(); touch(); };
    });
  }

  function save() {
    const st = draft.settings, errs = [];
    const codes = st.stores.map(s => s.code);
    if (!st.pharmacyName) errs.push('Nhập tên nhà thuốc');
    if (!/^[A-Za-z0-9]{1,4}$/.test(st.counter || '')) errs.push('Mã quầy 1–4 ký tự chữ/số');
    if (codes.some(c => !c)) errs.push('Mã kho không được trống');
    if (new Set(codes).size !== codes.length) errs.push('Mã kho bị trùng');
    if (st.stores.length < 2) errs.push('Cần ít nhất 2 kho để ghi sổ vay');
    const ids = draft.staff.map(s => s.id);
    if (draft.staff.some(s => !s.id || !s.name)) errs.push('Nhân viên cần đủ mã và họ tên');
    if (new Set(ids).size !== ids.length) errs.push('Mã nhân viên bị trùng');
    if (!draft.staff.some(s => s.admin)) errs.push('Cần ít nhất 1 quản lý');
    if (st.bank.bin && !/^\d{6,20}$/.test(st.bank.account || '')) errs.push('Số tài khoản ngân hàng chỉ gồm chữ số');
    ['sttUrl', 'ocrUrl'].forEach(k => { const u = st.ai[k]; if (u && !/^https?:\/\//.test(u)) errs.push('Địa chỉ máy chủ AI phải bắt đầu bằng http:// hoặc https://'); });
    if (errs.length) return VM.ui.toast(errs.join(' · '), 'bad', 6000);
    draft.staff.forEach(s => delete s._new);
    S().settings = Object.assign(S().settings, st);
    S().staff = draft.staff;
    const me = VM.store.currentUser(), mine = draft.staff.find(s => s.id === (me || {}).id);
    if (mine) { VM.store.setUser(Object.assign({}, me, { name: mine.name, role: mine.role, admin: mine.admin })); VM.ui.renderMe(); }
    VM.store.log('Sửa cài đặt', 'Hệ thống', `AI: giọng nói=${st.ai.stt}/${st.ai.sttProvider || 'auto'}, OCR=${st.ai.ocr}/${st.ai.ocrProvider || 'auto'}, máy chủ ngoài=${st.ai.allowPublic ? 'CHO PHÉP' : 'chặn'}`);
    VM.store.save('settings');
    dirty = false; $('#stSave').disabled = true; $('#stUndo').disabled = true;
    VM.ui.done('Đã lưu cài đặt');
  }

  VM.ui.register({ id: 'settings', title: 'Cài đặt', group: 'system', icon: 'sliders', render });
})(window.VM);
