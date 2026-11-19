/* POS – bán lẻ thuốc không kê đơn, TPCN, vật tư y tế */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money, num } = VM;
  const S = () => VM.store.state;
  const CAT = VM.store.CATEGORIES;

  let draft, busy = false, keyHandler = null, voice = null, voicePending = null, bar = null, cat = '';
  const draftKey = () => 'vmhub.draft.' + ((VM.store.currentUser() || {}).id || 'x');
  function loadDraft() {
    try { draft = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch { draft = null; }
    if (!draft) draft = { items: [], customer: '', pid: '' };
    // Không còn sửa giá tại quầy: giỏ dở từ bản cũ (đã sửa giá) quay về giá danh mục
    draft.items.forEach(i => { if (!i.special && i.listPrice != null) i.price = i.listPrice; });
  }
  const saveDraft = () => localStorage.setItem(draftKey(), JSON.stringify(draft));

  const total = () => VM.sum(draft.items, i => i.qty * i.price);
  function usedBase(productId, exceptKey) { return VM.sum(draft.items.filter(i => i.productId === productId && i.key !== exceptKey), i => i.qty * i.factor); }
  function lineIssue(it) {
    if (it.special) return null;
    const p = VM.store.product(it.productId);
    if (!p) return 'Mặt hàng không còn trong danh mục';
    if (!VM.store.sellable(p)) return VM.store.productIssue(p).text + ' – không thể bán';
    const need = usedBase(p.id);
    if (need > p.stock) return `Vượt tồn: còn ${VM.store.stockText(p)}`;
    return null;
  }
  const cartIssue = () => !draft.items.length ? 'Giỏ hàng trống' : draft.items.map(lineIssue).find(Boolean) || null;
  const defUnit = p => p.units.find(x => x.name === p.defaultUnit) || p.units[0];

  // ---------- rendering ----------
  // Bố cục: trái = phân loại + ô tìm + danh sách hàng (luôn hiện) · phải = giỏ hàng + tổng tiền + thanh toán
  function render(view, top) {
    loadDraft(); hl = 0; moved = false;
    const ai = S().settings.ai, mode = VM.ai.MODES[ai.stt] || VM.ai.MODES.off;
    top.innerHTML = `
      <button class="btn" id="addSpecial" title="Thêm hàng chưa có trong danh mục vào đơn">${icon('plus')}<span class="label">Thêm hàng mới</span></button>
      <button class="btn hide-m" id="posXls" title="Xuất Excel các đơn bán trong ngày">${icon('download')}<span class="label">Báo cáo trong ngày</span></button>
      <button class="btn" id="newOrderBtn" title="Đơn mới (F9)">${icon('cart')}<span class="label">Đơn mới</span> <span class="kbd hide-m">F9</span></button>`;
    view.innerHTML = `
      <div class="pos">
        <section class="pos-left" aria-label="Chọn hàng">
          <div id="catBar"></div>
          <div class="pos-search" id="posSearchBox">
            ${icon('search')}
            <input id="posSearch" type="search" autocomplete="off" placeholder="Tìm kiếm" aria-label="Tìm kiếm" aria-controls="posRes">
            <button type="button" class="mic-tip" id="micTip" title="Mẹo tìm thuốc bằng giọng nói" aria-label="Mẹo tìm thuốc bằng giọng nói">${icon('help', 's')}</button>
            <button class="mic-btn" id="micBtn" title="Nhập bằng giọng nói (F3) – ${esc(mode.label)}" aria-label="Nhập bằng giọng nói" ${ai.stt === 'off' ? 'disabled' : ''}>${icon('mic')}</button>
          </div>
          <div class="voice-live hidden" id="voiceLive"></div>
          <div class="card pos-res" id="posRes" role="listbox" aria-label="Danh sách hàng"></div>
        </section>
        <aside class="card cart" aria-label="Giỏ hàng">
          <div class="cart-h"><h3>Giỏ hàng</h3><span class="pill pri" id="cartCount"></span><span class="order-code xd" id="orderCode" title="Mã đơn"></span>
            <button type="button" class="pill warn low-btn hidden" id="bankBtn" title="Chưa có tài khoản nhận chuyển khoản – bấm để nhập">${icon('qr', 's')} Chưa có TK QR</button>
            <button type="button" class="pill warn low-btn hidden" id="lowBtn"></button>
            <button class="btn ghost icon sm cart-clear" id="clearCart" title="Xóa giỏ" aria-label="Xóa giỏ">${icon('trash', 's')}</button></div>
          <div class="cart-items" id="cartItems"></div>
          <div class="cart-foot">
            <details class="cust" id="custBox" ${draft.customer || draft.pid ? 'open' : ''}><summary>${icon('user', 's')} Khách hàng / PID</summary>
              <div class="cust-f"><input class="input" id="cusName" placeholder="Tên khách / SĐT" value="${esc(draft.customer)}" aria-label="Khách hàng">
              <input class="input mono" id="cusPid" placeholder="PID" value="${esc(draft.pid)}" aria-label="PID"></div></details>
            <div class="sum-total"><span>Tổng tiền</span><strong id="sumTotal">0 đ</strong></div>
            <div id="cartIssue"></div>
            <div class="pay-btns">
              <button class="btn primary xl" id="payQr"><span>${icon('qr')} QR</span><span class="kbd">F4</span></button>
              <button class="btn tonal xl" id="payCash"><span>${icon('cash')} Tiền mặt</span><span class="kbd">F8</span></button>
            </div>
          </div>
        </aside>
      </div>`;

    $('#cusName').oninput = e => { draft.customer = e.target.value; saveDraft(); };
    $('#cusPid').oninput = e => { draft.pid = e.target.value; saveDraft(); };
    const si = $('#posSearch');
    si.addEventListener('input', () => { voicePending = null; $('#voiceLive').classList.add('hidden'); hl = 0; moved = false; drawRes(); });
    si.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!resList.length) return; hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + resList.length) % resList.length; moved = true; markHl(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (si.value.trim() && !voicePending && scanEnter(si.value)) return;
        if ((si.value.trim() || moved || voicePending) && resList[hl]) pick(hl);
      } else if (e.key === 'Escape' && (si.value || voicePending)) { e.preventDefault(); clearSearch(); }
    });
    $('#newOrderBtn').onclick = newOrder;
    $('#posXls').onclick = () => {
      const today = VM.ymd(), list = S().sales.filter(s => VM.ymd(s.paidAt || s.createdAt) === today);
      if (!list.length) { VM.ui.toast('Hôm nay chưa có đơn bán nào', 'warn'); return; }
      VM.history.exportSales(list, 'vinmec_bao_cao_ban_hang_trong_ngay');
    };
    $('#micBtn').onclick = toggleVoice;
    $('#micTip').onclick = openVoiceTips;
    $('#addSpecial').onclick = openSpecial;
    $('#clearCart').onclick = async () => { if (!draft.items.length) return; if (await VM.ui.confirm({ title: 'Xóa toàn bộ giỏ hàng?', message: 'Các mặt hàng đã chọn sẽ bị xóa khỏi đơn đang tạo.', ok: 'Xóa giỏ', danger: true })) { draft.items = []; saveDraft(); renderCart(); } };
    $('#payQr').onclick = () => openPay('qr');
    $('#payCash').onclick = () => openPay('cash');
    $('#lowBtn').onclick = openLow;
    $('#bankBtn').onclick = () => openBank(drawBankBtn);
    drawBankBtn();

    keyHandler = e => {
      if (document.querySelector('.overlay')) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (e.key === 'F2' || (e.key === '/' && !typing)) { e.preventDefault(); si.focus(); si.select(); }
      else if (e.key === 'F3') { e.preventDefault(); toggleVoice(); }
      else if (e.key === 'F4') { e.preventDefault(); openPay('qr'); }
      else if (e.key === 'F8') { e.preventDefault(); openPay('cash'); }
      else if (e.key === 'F9') { e.preventDefault(); newOrder(); }
    };
    document.addEventListener('keydown', keyHandler);

    renderBar(); drawRes(); renderCart();
    if (window.innerWidth > 1024) setTimeout(() => si.focus(), 50);
    return () => { document.removeEventListener('keydown', keyHandler); if (voice) voice.stop(); voice = null; };
  }

  // "2 para", "para x3", "para *3" → { qty, q }
  function splitQty(raw) {
    let q = raw.trim(), qty = 1, m;
    if ((m = q.match(/^(\d{1,3})\s*[x*]?\s+(.+)$/i))) { qty = +m[1]; q = m[2]; }
    else if ((m = q.match(/^(.+?)\s*[x*]\s*(\d{1,3})$/i))) { q = m[1]; qty = +m[2]; }
    return { qty: Math.max(1, qty), q };
  }
  // Chưa gõ gì: cả nhóm đang chọn (hàng bán được trước, hàng bán nhiều trước). Có gõ: độ khớp chữ + điểm bán nhiều 60 ngày
  function ranked(q, n = 8, c = '') {
    const f = VM.store.productFreq(), maxF = Math.max(1, ...Object.values(f));
    const act = S().products.filter(p => p.active && (!c || p.category === c));
    if (!q.trim()) return act.sort((a, b) => (VM.store.sellable(b) - VM.store.sellable(a)) || ((f[b.id] || 0) - (f[a.id] || 0)) || a.name.localeCompare(b.name, 'vi')).slice(0, n);
    return act.map(p => {
      const s = Math.max(...['name', 'ingredient', 'code', 'sap', 'strength'].map(k => VM.fuzzyScore(q, p[k])));
      return { p, s: s + (f[p.id] ? 6 + 10 * f[p.id] / maxF : 0) - (VM.store.sellable(p) ? 0 : 25) };
    }).filter(x => x.s >= (q.trim().length <= 2 ? 80 : 60)).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.p);
  }

  // Danh sách hàng bên trái: mỗi mặt hàng 1 dòng (nhóm · tên · giá); mã + tồn chỉ hiện khi "Hiển thị tất cả"
  let resList = [], hl = 0, moved = false;
  function drawRes() {
    const el = $('#posRes'), si = $('#posSearch');
    if (!el || !si) return;
    const { qty, q } = voicePending || splitQty(si.value);
    const list = ranked(q, q.trim() ? 40 : 200, voicePending ? '' : cat);
    resList = list.map(p => ({ p, qty, u: (voicePending && voicePending.unit && p.units.find(x => VM.normalize(x.name) === voicePending.unit)) || defUnit(p) }));
    if (hl >= resList.length) hl = 0;
    el.innerHTML = resList.length ? resList.map(({ p, u }, i) => {
      const iss = VM.store.productIssue(p), ok = VM.store.sellable(p);
      return `<button type="button" class="pr-i ${i === hl ? 'hl' : ''} ${ok ? '' : 'off'}" data-i="${i}" role="option" aria-selected="${i === hl}">
        <span class="tag ${p.category}">${esc(VM.store.catOf(p).short)}</span>
        <span class="pr-nm"><b>${esc(p.name)}</b>${iss ? `<small class="pr-iss ${iss.level}">${esc(iss.text)}</small>` : ''}<small class="xd">${esc(p.code)} · tồn ${esc(VM.store.stockText(p))}</small></span>
        ${qty > 1 ? `<span class="qtyb">×${qty}</span>` : ''}
        <span class="pr-pr">${money(u.price)}<small>/${esc(u.name.toLowerCase())}</small></span></button>`;
    }).join('') : `<div class="pr-empty">${icon('search', 'l')}<b>Không tìm thấy “${esc(q)}”</b>Thử gõ không dấu, tên hoạt chất hoặc mã SAP${cat ? ', hoặc chọn “Tất cả”' : ''}.</div>`;
    $$('[data-i]', el).forEach(b => b.onclick = () => pick(+b.dataset.i));
  }
  function markHl() {
    $$('#posRes [data-i]').forEach(b => { const on = +b.dataset.i === hl; b.classList.toggle('hl', on); b.setAttribute('aria-selected', on); if (on) b.scrollIntoView({ block: 'nearest' }); });
  }
  function pick(i) {
    const r = resList[i]; if (!r) return;
    if (voicePending) VM.ai.track('voice', i === 0);
    addProduct(r.p.id, r.u.name, r.qty);
    clearSearch();
  }
  function clearSearch() { const si = $('#posSearch'); if (!si) return; si.value = ''; voicePending = null; $('#voiceLive').classList.add('hidden'); hl = 0; moved = false; drawRes(); si.focus(); }
  // Máy quét mã vạch gõ mã + Enter: khớp chính xác mã hàng / SAP / GTIN / GS1 thì thêm ngay
  function scanEnter(raw) {
    const r = VM.store.matchScan(raw);
    if (!r || !r.product) return false;
    addProduct(r.product.id);
    VM.ui.toast('Đã thêm ' + r.product.name);
    clearSearch();
    return true;
  }

  // Thanh phân loại: Tất cả / Thuốc / TPCN / Vật tư / Khác → lọc danh sách bên dưới
  function renderBar() {
    const counts = () => { const c = { '': 0 }; S().products.forEach(p => { if (!p.active) return; c[''] += 1; c[p.category] = (c[p.category] || 0) + 1; }); return c; };
    bar = VM.ui.catBar($('#catBar'), { cat, counts, onCat: k => { cat = k; hl = 0; moved = false; drawRes(); $('#posSearch').focus(); } });
  }

  function addProduct(pid, unitName, qty = 1) {
    const p = VM.store.product(pid);
    if (!p) return;
    if (!VM.store.sellable(p)) { VM.ui.toast(`${p.name}: ${VM.store.productIssue(p).text}`, 'bad'); return; }
    const u = p.units.find(x => x.name === unitName) || defUnit(p);
    const ex = draft.items.find(i => i.productId === pid && i.unit === u.name);
    if (ex) ex.qty += qty;
    else draft.items.push({ key: VM.uid('c'), productId: p.id, code: p.code, sap: p.sap, name: p.name, lot: p.lot, store: p.store, unit: u.name, factor: u.factor, qty, price: u.price, listPrice: u.price });
    saveDraft(); renderCart();
    const row = $(`#cartItems [data-key="${(ex || draft.items[draft.items.length - 1]).key}"]`);
    if (row) { row.scrollIntoView({ block: 'nearest' }); row.animate([{ background: 'var(--primary-100)' }, { background: 'transparent' }], { duration: 900 }); }
  }

  // Giỏ hàng (cột phải): mỗi mặt hàng 1 dòng gọn – tên + ĐVT/đơn giá chữ nhỏ · số lượng · thành tiền
  function renderCart() {
    $('#orderCode').textContent = VM.store.orderCode(true);
    const el = $('#cartItems');
    $('#cartCount').textContent = draft.items.length;
    if (!draft.items.length) {
      el.innerHTML = `<div class="cart-empty">${icon('cart', 'l')}<b>Chưa có mặt hàng</b>Chọn hàng ở danh sách bên trái hoặc quét mã vạch.</div>`;
    } else {
      el.innerHTML = draft.items.map(it => {
        const p = it.special ? null : VM.store.product(it.productId);
        const iss = lineIssue(it);
        const more = it.special ? `Ngoài danh mục · người bán ${it.seller || '—'}` : `${it.code} · Lô ${it.lot || '—'}${p ? ' · HSD ' + VM.fmtDate(p.expiry) + ' · tồn ' + VM.store.stockText(p) : ''}`;
        const unitSel = p && p.units.length > 1 ? `<select class="unit-sel" data-unit="${it.key}" aria-label="Đơn vị tính">${p.units.map(u => `<option ${u.name === it.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : `<span class="unit-txt">${esc(it.unit)}</span>`;
        // Đơn giá lấy theo danh mục, không sửa tại quầy (đổi giá: Danh mục hàng → Sửa, có ghi nhật ký)
        return `<div class="crow ${iss ? 'bad' : ''}" data-key="${it.key}">
          <div class="cr-name" title="${esc(it.name)} – ${esc(more)}">
            <b>${it.special ? '<span class="spc">MỚI</span>' : ''}${esc(it.name)}</b>
            <small>${unitSel}<span class="cr-price">${num(it.price)}đ</span><span class="xd">· ${esc(more)}</span></small>
            ${iss ? `<small class="cr-iss">⚠ ${esc(iss)}</small>` : ''}
          </div>
          <div class="stepper"><button data-dec="${it.key}" aria-label="Giảm">${icon('minus', 's')}</button><input inputmode="numeric" value="${it.qty}" data-qty="${it.key}" aria-label="Số lượng"><button data-inc="${it.key}" aria-label="Tăng">${icon('plus', 's')}</button></div>
          <span class="cr-total">${money(it.qty * it.price)}</span>
          <button class="btn ghost icon sm c-del" data-del="${it.key}" aria-label="Xóa ${esc(it.name)}">${icon('x', 's')}</button>
        </div>`;
      }).join('');
    }
    const find = k => draft.items.find(i => i.key === k);
    $$('[data-del]', el).forEach(b => b.onclick = () => { draft.items = draft.items.filter(i => i.key !== b.dataset.del); saveDraft(); renderCart(); });
    $$('[data-inc]', el).forEach(b => b.onclick = () => { find(b.dataset.inc).qty++; saveDraft(); renderCart(); });
    $$('[data-dec]', el).forEach(b => b.onclick = () => { const it = find(b.dataset.dec); if (it.qty > 1) { it.qty--; saveDraft(); renderCart(); } });
    $$('[data-qty]', el).forEach(i => {
      i.onfocus = () => i.select();
      i.onchange = () => { const v = Math.floor(VM.parseNum(i.value)); const it = find(i.dataset.qty); if (v > 0) it.qty = v; saveDraft(); renderCart(); };
      i.onkeydown = e => { if (e.key === 'Enter') { i.blur(); $('#posSearch').focus(); } };
    });
    $$('[data-unit]', el).forEach(s => s.onchange = () => {
      const it = find(s.dataset.unit), p = VM.store.product(it.productId), u = p.units.find(x => x.name === s.value);
      it.unit = u.name; it.factor = u.factor; it.price = u.price; it.listPrice = u.price; saveDraft(); renderCart();
    });
    $('#sumTotal').textContent = money(total());
    const issue = draft.items.length ? cartIssue() : null;
    $('#cartIssue').innerHTML = issue ? `<div class="alert bad">${icon('alert', 's')}<span>${esc(issue)}</span></div>` : '';
    $('#payQr').disabled = $('#payCash').disabled = !draft.items.length || !!issue;
    renderLow();
  }

  // Cảnh báo tồn thấp: pill nhỏ trên đầu giỏ (không chiếm chỗ dòng hàng), bấm xem danh sách → Danh mục "Cần chú ý"
  const lowStock = () => S().products.filter(p => p.active && p.stock <= (p.minStock || 0))
    .sort((a, b) => (a.stock / Math.max(1, a.minStock || 0)) - (b.stock / Math.max(1, b.minStock || 0)) || a.name.localeCompare(b.name, 'vi'));
  function renderLow() {
    const b = $('#lowBtn'); if (!b) return;
    const l = lowStock();
    b.classList.toggle('hidden', !l.length);
    b.innerHTML = `${icon('alert', 's')}${l.length} tồn thấp`;
    b.title = 'Tồn thấp: ' + l.slice(0, 6).map(p => `${p.name} (${p.stock <= 0 ? 'hết hàng' : 'còn ' + VM.store.stockText(p)})`).join(', ') + (l.length > 6 ? '…' : '');
  }
  function openLow() {
    const l = lowStock();
    VM.ui.modal({
      title: 'Cảnh báo tồn thấp', sub: `${l.length} mặt hàng đang bán có tồn ≤ mức tối thiểu`, ic: 'alert',
      body: l.length ? `<table class="t"><thead><tr><th>Mặt hàng</th><th class="num">Tồn</th><th class="num">Tối thiểu</th></tr></thead><tbody>
        ${l.map(p => `<tr><td><span class="tag ${p.category}">${esc(VM.store.catOf(p).short)}</span> <b>${esc(p.name)}</b></td>
          <td class="num">${p.stock <= 0 ? `<span class="qchip bad">${icon('x', 's')}Hết hàng</span>` : `<span class="qchip warn">${esc(VM.store.stockText(p))}</span>`}</td>
          <td class="num muted">${esc(VM.store.stockText({ ...p, stock: p.minStock || 0 }))}</td></tr>`).join('')}</tbody></table>`
        : VM.ui.empty('check', 'Không có mặt hàng tồn thấp', ''),
      foot: `<button class="btn" data-x>Đóng</button><button class="btn primary" data-cat>${icon('package', 's')} Mở Danh mục</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-cat]').onclick = () => { close(); VM.ui.go('catalog/alert'); };
      },
    });
  }

  function openSpecial() {
    const u = VM.store.currentUser();
    VM.ui.modal({
      title: 'Thêm hàng mới', sub: 'Hàng chưa có trong danh mục (theo nhu cầu khách). Ghi rõ người bán để đối soát.', ic: 'package',
      body: `<div class="form-grid">
        <div class="field c12"><label>Tên hàng <span class="req">*</span></label><input class="input" name="name" placeholder="VD: Băng thun cổ tay size M"></div>
        <div class="field c6 half"><label>Đơn vị tính</label>${VM.ui.unitPick('Viên', 'name="unit"')}</div>
        <div class="field c6 half"><label>Số lượng <span class="req">*</span></label><input class="input" name="qty" inputmode="numeric" value="1"></div>
        <div class="field c6"><label>Đơn giá (đ) <span class="req">*</span></label><input class="input" name="price" inputmode="numeric"></div>
        <div class="field c6"><label>Tên người bán</label><input class="input" name="seller" list="staffList" value="${esc(u.name)}"><datalist id="staffList">${VM.ui.staffOptions()}</datalist></div>
      </div><div class="err hidden" id="spErr" style="margin-top:10px"></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('plus', 's')} Thêm vào giỏ</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        setTimeout(() => el.querySelector('[name=name]').focus(), 30);
        el.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-ok]').click(); } }));
        el.querySelector('[data-ok]').onclick = () => {
          const d = VM.ui.formData(el), qty = Math.floor(VM.parseNum(d.qty)), price = Math.round(VM.parseNum(d.price));
          const err = !d.name ? 'Nhập tên hàng' : qty <= 0 ? 'Số lượng phải > 0' : !(price > 0) ? 'Nhập đơn giá' : '';
          const err2 = err || (!d.unit ? 'Chọn hoặc gõ đơn vị tính' : '');
          if (err2) { const e = el.querySelector('#spErr'); e.textContent = err2; e.classList.remove('hidden'); return; }
          draft.items.push({ key: VM.uid('c'), special: true, productId: '', code: 'DACBIET', sap: '', name: d.name, lot: '', store: '', unit: d.unit, factor: 1, qty, price, listPrice: price, seller: d.seller });
          saveDraft(); renderCart(); close();
        };
      },
    });
  }

  async function newOrder() {
    if (draft.items.length && !(await VM.ui.confirm({ title: 'Tạo đơn mới?', message: 'Giỏ hàng hiện tại chưa thanh toán sẽ bị xóa.', ok: 'Tạo đơn mới', danger: true }))) return;
    draft = { items: [], customer: '', pid: '' }; saveDraft();
    $('#cusName').value = ''; $('#cusPid').value = '';
    $('#custBox').open = false; renderCart(); $('#posSearch').focus();
  }

  // ---------- tài khoản nhận chuyển khoản (VietQR) ----------
  // Gộp từ bản POS của nhánh main: sửa tài khoản ngay tại quầy, chép nội dung CK, nội dung CK không dấu "-", báo mất mạng
  const bankOk = () => { const b = S().settings.bank || {}; return !!(b.bin && b.account); };
  const qrSrc = (b, amount, memo) => `https://img.vietqr.io/image/${encodeURIComponent(b.bin)}-${encodeURIComponent(b.account)}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(b.owner || '')}`;
  function drawBankBtn() { const b = $('#bankBtn'); if (b) b.classList.toggle('hidden', bankOk()); }

  // Chỉ Quản lý được đổi (đổi tài khoản = đổi nơi nhận tiền của khách), mọi lần đổi ghi nhật ký
  function openBank(onSaved) {
    const admin = VM.store.isAdmin(), b = S().settings.bank || {};
    VM.ui.modal({
      title: 'Tài khoản nhận chuyển khoản', sub: 'Dùng để tạo mã VietQR kèm số tiền và mã đơn', ic: 'qr',
      body: `${admin ? '' : `<div class="alert warn" style="margin-bottom:14px">${icon('info', 's')}<span>Chỉ <b>Quản lý</b> được đổi tài khoản nhận tiền. Nhờ quản lý vào ca để nhập, trong lúc chờ hãy thu tiền mặt.</span></div>`}
        <fieldset ${admin ? '' : 'disabled'} style="border:0;padding:0;margin:0"><div class="form-grid">
          <div class="field c6"><label for="bkBin">Ngân hàng <span class="req">*</span></label><select class="select" id="bkBin" name="bin"><option value="">— Chọn ngân hàng —</option>${VM.store.BANKS.map(([v, n]) => `<option value="${v}" ${b.bin === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
          <div class="field c6"><label for="bkAcc">Số tài khoản <span class="req">*</span></label><input class="input mono" id="bkAcc" name="account" inputmode="numeric" autocomplete="off" value="${esc(b.account || '')}" placeholder="VD: 1122334455"></div>
          <div class="field c12"><label for="bkOwn">Chủ tài khoản <span class="req">*</span></label><input class="input" id="bkOwn" name="owner" autocomplete="off" value="${esc(b.owner || '')}" placeholder="BENH VIEN DA KHOA QUOC TE VINMEC"><span class="hint">Tự chuyển thành in hoa không dấu, giống tên hiện trên ứng dụng ngân hàng của khách.</span></div>
        </div></fieldset><div class="err hidden" id="bkErr" style="margin-top:10px"></div>`,
      foot: admin ? `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('check')} Lưu tài khoản</button>` : '<button class="btn" data-x>Đóng</button>',
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        const ok = el.querySelector('[data-ok]');
        if (!ok) return;
        const own = el.querySelector('#bkOwn');
        own.onblur = () => { own.value = VM.store.bankOwner(own.value); };
        el.querySelectorAll('input').forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } }; });
        ok.onclick = () => {
          const d = VM.ui.formData(el), nb = { bin: d.bin, account: d.account.replace(/[\s.-]/g, ''), owner: VM.store.bankOwner(d.owner) };
          const err = !nb.bin ? 'Chọn ngân hàng' : !/^\d{6,20}$/.test(nb.account) ? 'Số tài khoản gồm 6–20 chữ số' : !nb.owner ? 'Nhập tên chủ tài khoản' : '';
          const e = el.querySelector('#bkErr');
          if (err) { e.textContent = err; e.classList.remove('hidden'); return; }
          const old = S().settings.bank || {}, name = x => x.account ? `${VM.store.bankName(x.bin)} ${x.account}` : '(chưa có)';
          S().settings.bank = nb;
          VM.store.log('Đổi tài khoản nhận CK', 'Cài đặt', `${name(old)} → ${name(nb)} · ${nb.owner}`);
          VM.store.save('settings');
          close();
          VM.ui.done('Đã lưu tài khoản nhận tiền', `${VM.store.bankName(nb.bin)} · ${nb.account}`);
          if (onSaved) onSaved();
        };
      },
    });
  }

  // ---------- payment ----------
  function openPay(mode) {
    const issue = cartIssue();
    if (issue) { VM.ui.toast(issue, 'warn'); return; }
    const t = total(), code = VM.store.orderCode(true), memo = VM.store.payMemo(code), admin = VM.store.isAdmin();
    let hasBank = bankOk(), unbind = null;
    const cashQuick = [...new Set([t, Math.ceil(t / 10000) * 10000, Math.ceil(t / 50000) * 50000, Math.ceil(t / 100000) * 100000, Math.ceil(t / 200000) * 200000, Math.ceil(t / 500000) * 500000])].filter(v => v >= t).slice(0, 4);
    VM.ui.modal({
      title: 'Thanh toán', sub: `Đơn <b class="mono">${esc(code)}</b> · ${draft.items.length} mặt hàng`, ic: mode === 'qr' ? 'qr' : 'cash', size: 'lg',
      onClose: () => { if (unbind) unbind(); },
      body: `<div class="seg" style="margin-bottom:16px"><button data-m="qr" class="${mode === 'qr' ? 'active' : ''}">${icon('qr', 's')} Chuyển khoản QR</button><button data-m="cash" class="${mode === 'cash' ? 'active' : ''}">${icon('cash', 's')} Tiền mặt</button></div>
        <div data-pane="qr" id="qrPane" class="${mode === 'qr' ? '' : 'hidden'}"></div>
        <div data-pane="cash" class="${mode === 'cash' ? '' : 'hidden'}">
          <div class="muted small">Tổng cần thu</div><div class="amount-big" style="margin-bottom:14px">${money(t)}</div>
          <div class="field"><label for="given">Khách đưa (đ)</label><input class="input" id="given" inputmode="numeric" placeholder="${num(t)}" style="font-size:20px;min-height:54px;font-weight:700"></div>
          <div class="quick-cash" style="margin:10px 0 14px">${cashQuick.map(v => `<button class="btn" data-cash="${v}">${num(v)}</button>`).join('')}</div>
          <div class="change" id="changeBox"><span>Tiền thối lại</span><strong id="changeVal">0 đ</strong></div>
        </div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="printAfter"> In phiếu bán hàng sau khi hoàn tất</label>`,
      foot: `<button class="btn" data-x>Quay lại</button><button class="btn primary lg" id="completeBtn">${icon('check')} <span id="completeLbl">Hoàn tất</span></button>`,
      onMount(el, close) {
        let m = mode;
        const btn = el.querySelector('#completeBtn');
        const given = el.querySelector('#given');
        const upd = () => {
          el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('active', b.dataset.m === m));
          el.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== m));
          if (m === 'qr') { btn.disabled = !hasBank; el.querySelector('#completeLbl').textContent = 'Đã nhận tiền – Hoàn tất'; }
          else {
            const g = given.value ? VM.parseNum(given.value) : t, ch = g - t;
            el.querySelector('#changeVal').textContent = money(Math.max(0, ch));
            el.querySelector('#changeBox').classList.toggle('neg', ch < 0);
            el.querySelector('#changeBox span').textContent = ch < 0 ? 'Còn thiếu' : 'Tiền thối lại';
            if (ch < 0) el.querySelector('#changeVal').textContent = money(-ch);
            btn.disabled = ch < 0;
            el.querySelector('#completeLbl').textContent = 'Đã thu tiền – Hoàn tất';
          }
        };
        // Mã QR là ảnh của img.vietqr.io nên cần Internet. Mất mạng: báo ngay, có mạng lại thì tự tải lại
        const loadQr = () => {
          const box = el.querySelector('#qrBox');
          if (!box) return;
          const fail = msg => { box.innerHTML = `<div class="qr-fail">${icon('alert')}<b>${msg}</b><span>Khách chuyển khoản thủ công theo thông tin bên cạnh, hoặc thu tiền mặt.</span><button type="button" class="btn sm" data-retry>${icon('refresh', 's')} Thử lại</button></div>`; box.querySelector('[data-retry]').onclick = loadQr; };
          if (navigator.onLine === false) { fail('Đang mất mạng – chưa tạo được mã QR'); return; }
          box.innerHTML = '<span class="muted small">Đang tải mã QR…</span>';
          const img = new Image(); img.alt = 'Mã VietQR thanh toán ' + money(t);
          img.onload = () => { if (box.isConnected) { box.innerHTML = ''; box.appendChild(img); } };
          img.onerror = () => { if (box.isConnected) fail('Không tải được mã QR'); };
          img.src = qrSrc(S().settings.bank, t, memo);
        };
        const drawQr = () => {
          const pane = el.querySelector('#qrPane'), b = S().settings.bank || {};
          hasBank = bankOk();
          pane.innerHTML = !hasBank
            ? `<div class="alert warn">${icon('alert', 's')}<span>Chưa có tài khoản nhận chuyển khoản nên chưa tạo được mã QR. ${admin ? 'Nhập tài khoản ngay tại đây' : 'Nhờ <b>Quản lý</b> nhập tài khoản'}, hoặc chọn <b>Tiền mặt</b>.</span></div>
              ${admin ? `<button type="button" class="btn primary" data-bank style="margin-top:12px">${icon('qr', 's')} Nhập tài khoản nhận tiền</button>` : ''}`
            : `<div class="pay-panel"><div class="qr-box" id="qrBox"></div>
              <div><div class="muted small">Số tiền cần chuyển</div><div class="amount-big">${money(t)}</div>
              <dl class="kv pay-kv"><dt>Ngân hàng</dt><dd>${esc(VM.store.bankName(b.bin))}</dd>
                <dt>Số tài khoản</dt><dd><span class="mono">${esc(b.account)}</span><button type="button" class="btn ghost sm" data-copy="${esc(b.account)}" title="Chép số tài khoản">${icon('copy', 's')} Chép</button></dd>
                <dt>Chủ TK</dt><dd>${esc(b.owner || '')}</dd>
                <dt>Nội dung CK</dt><dd><span class="mono memo">${esc(memo)}</span><button type="button" class="btn ghost sm" data-copy="${esc(memo)}" title="Chép nội dung chuyển khoản">${icon('copy', 's')} Chép</button></dd></dl>
              <div class="alert info" style="margin-top:12px">${icon('info', 's')}<span>Chỉ bấm hoàn tất <b>sau khi đã kiểm tra biến động số dư</b>: đúng số tiền, đúng nội dung CK.</span></div>
              ${admin ? `<button type="button" class="btn ghost sm" data-bank style="margin-top:8px">${icon('edit', 's')} Đổi tài khoản nhận tiền</button>` : ''}</div></div>`;
          pane.querySelectorAll('[data-bank]').forEach(x => { x.onclick = () => openBank(() => { drawQr(); upd(); drawBankBtn(); }); });
          pane.querySelectorAll('[data-copy]').forEach(x => {
            x.onclick = async () => { const v = x.dataset.copy, ok = await VM.copyText(v); VM.ui.toast(ok ? 'Đã chép: ' + v : 'Không chép được, đọc cho khách: ' + v, ok ? 'ok' : 'warn'); };
          });
          if (hasBank) loadQr();
        };
        const onOnline = () => { const box = el.querySelector('#qrBox'); if (box && !box.querySelector('img')) loadQr(); };
        window.addEventListener('online', onOnline);
        unbind = () => window.removeEventListener('online', onOnline);
        drawQr();
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { m = b.dataset.m; upd(); if (m === 'cash') given.focus(); });
        el.querySelectorAll('[data-cash]').forEach(b => b.onclick = () => { given.value = num(+b.dataset.cash); upd(); });
        given.oninput = upd;
        given.onkeydown = e => { if (e.key === 'Enter' && !btn.disabled) btn.click(); };
        el.querySelector('[data-x]').onclick = () => close();
        btn.onclick = () => {
          if (busy || btn.disabled) return;
          busy = true; btn.disabled = true;
          try {
            const sale = complete(m, m === 'cash' ? (given.value ? VM.parseNum(given.value) : t) : t);
            close();
            if (el.querySelector('#printAfter').checked) printReceipt(sale);
            VM.ui.done('Thanh toán thành công', `${sale.code} · ${money(sale.total)}`, { action: { label: 'In phiếu', fn: () => printReceipt(sale) } });
          } finally { busy = false; }
        };
        upd();
      },
    });
  }

  function complete(payment, given) {
    const u = VM.store.currentUser();
    const st = S();
    const code = VM.store.orderCode(false);
    const items = draft.items.map(i => ({ productId: i.productId, code: i.code, sap: i.sap, name: i.name, lot: i.lot, store: i.store, unit: i.unit, factor: i.factor, qty: i.qty, price: i.price, listPrice: i.listPrice, total: i.qty * i.price, special: !!i.special, seller: i.seller || '' }));
    const sale = { id: VM.uid('s_'), code, createdAt: VM.iso(), paidAt: VM.iso(), sellerId: u.id, sellerName: u.name, customer: draft.customer.trim(), pid: draft.pid.trim(), items, total: VM.sum(items, i => i.total), payment, given: payment === 'cash' ? given : null, status: 'paid', recon: 'pending' };
    items.forEach(i => {
      if (i.special) return;
      const p = VM.store.product(i.productId);
      if (p) { p.stock = Math.max(0, p.stock - i.qty * i.factor); p.updatedAt = VM.iso(); }
      if (i.price !== i.listPrice) VM.store.log('Sửa giá khi bán', 'Bán lẻ', `${i.name}: ${money(i.listPrice)} → ${money(i.price)}/${i.unit}`, code);
    });
    st.sales.push(sale);
    VM.store.log('Bán hàng', 'Bán lẻ', `${items.length} mặt hàng · ${money(sale.total)} · ${payment === 'qr' ? 'QR' : 'Tiền mặt'}`, code);
    VM.store.save('sale');
    draft = { items: [], customer: '', pid: '' }; saveDraft();
    if ($('#cusName')) { $('#cusName').value = ''; $('#cusPid').value = ''; renderCart(); drawRes(); }
    return sale;
  }

  function receiptHtml(s) {
    const st = S().settings;
    return `<div class="receipt"><h2 style="text-align:center">${esc(st.pharmacyName)}</h2>
      <div style="text-align:center">PHIẾU BÁN HÀNG</div>
      <div>Mã đơn: <b>${esc(s.code)}</b><br>Thời gian: ${VM.fmtDT(s.paidAt)}<br>Dược sĩ: ${esc(s.sellerName)}${s.customer ? '<br>Khách: ' + esc(s.customer) : ''}${s.pid ? ' · PID: ' + esc(s.pid) : ''}</div>
      <table><thead><tr><th>Mặt hàng</th><th class="r">SL</th><th class="r">T.Tiền</th></tr></thead><tbody>
      ${s.items.map(i => `<tr><td>${esc(i.name)}<br><small>${num(i.price)} đ/${esc(i.unit)}</small></td><td class="r">${i.qty}</td><td class="r">${num(i.total)}</td></tr>`).join('')}
      </tbody></table>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:14px"><b>TỔNG CỘNG</b><b>${money(s.total)}</b></div>
      <div>Thanh toán: ${s.payment === 'qr' ? 'Chuyển khoản QR' : 'Tiền mặt'}${s.given ? ` · Khách đưa ${money(s.given)} · Thối ${money(s.given - s.total)}` : ''}</div>
      ${s.status === 'cancelled' ? '<div style="text-align:center;font-weight:bold;margin-top:6px">*** ĐƠN ĐÃ HỦY ***</div>' : ''}
      <div style="text-align:center;margin-top:10px">Cảm ơn quý khách!</div></div>`;
  }
  const printReceipt = s => VM.ui.print(receiptHtml(s));

  // ---------- voice ----------
  // "Paracetamol hai vỉ và vitamin C một hộp" → [{qty:2, unit:'vi', q:'paracetamol'}, {qty:1, unit:'hop', q:'vitamin c'}]
  const NUMW = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10, chuc: 10 };
  function parseVoice(text) {
    const tokens = text.toLowerCase().replace(/[,.!?]/g, ' ').split(/\s+/).filter(Boolean);
    const units = new Set(S().products.flatMap(p => p.units.map(u => VM.normalize(u.name))));
    let qty = 1, unit = '';
    const numOf = t => { const v = VM.normalize(t); return /^\d+$/.test(v) ? +v : NUMW[v]; };
    for (let i = 0; i < tokens.length - 1; i++) {
      let n = numOf(tokens[i]), span = 1;
      if (n === 10 && numOf(tokens[i + 1]) && numOf(tokens[i + 1]) < 10) { n += numOf(tokens[i + 1]); span = 2; } // "mười hai"
      if (n && units.has(VM.normalize(tokens[i + span]))) { qty = n; unit = VM.normalize(tokens[i + span]); tokens.splice(i, span + 1); break; }
    }
    if (!unit && tokens.length > 1 && numOf(tokens[tokens.length - 1])) qty = numOf(tokens.pop());
    if (!unit && tokens.length > 1 && numOf(tokens[0])) qty = numOf(tokens.shift());
    const q = tokens.join(' ').replace(/^(cho (toi|tôi|em|anh|chi|chị)|thêm|them|bán|ban|lấy|lay|một|mot)\s+/i, '').trim();
    return { qty, unit, q, matches: q ? ranked(q, 3).filter(VM.store.sellable) : [] };
  }
  const splitVoice = t => t.split(/\s*(?:,|;|\bvà\b|\bva\b|\brồi\b|\bvới\b|\bthêm\b)\s*/i).map(x => x.trim()).filter(x => x.length > 1);

  // Mẹo dùng micro: cách nói, sau khi nói thì làm gì, khi nghe sai thì sửa thế nào
  function openVoiceTips() {
    const ai = S().settings.ai, off = ai.stt === 'off', admin = VM.store.isAdmin();
    const tip = (ic, t, d) => `<li><span class="vt-ic">${icon(ic, 's')}</span><div><b>${t}</b><span>${d}</span></div></li>`;
    VM.ui.modal({
      title: 'Mẹo tìm thuốc bằng giọng nói', sub: 'Nói tên thuốc thay vì gõ – app lọc danh sách, dược sĩ chọn đúng dòng', ic: 'mic',
      body: `${off ? `<div class="alert warn" style="margin-bottom:12px">${icon('alert', 's')}<span>Giọng nói đang <b>tắt</b>. ${admin ? 'Bật ở Khác → Cài đặt → thẻ AI.' : 'Nhờ Quản lý bật ở Khác → Cài đặt → thẻ AI.'}</span></div>` : ''}
        <ol class="voice-tips">
          ${tip('mic', 'Bấm micro hoặc phím F3 rồi nói', 'Nút micro chuyển đỏ là đang nghe. Nói xong bấm lại micro (hoặc F3) để dừng; tối đa khoảng 10 giây.')}
          ${tip('pill', 'Tên thuốc + số lượng + đơn vị', 'VD: <q>Paracetamol hai vỉ</q>, <q>Smecta 3 gói</q>. Nói tên biệt dược hoặc hoạt chất, thêm hàm lượng nếu có nhiều loại: <q>Omeprazole 20</q>.')}
          ${tip('layers', 'Nhiều mặt hàng một lần', 'Ngăn cách bằng <q>và</q>, <q>rồi</q>, <q>với</q>: <q>Smecta ba gói và Vitamin C một hộp</q> → app mở hộp xác nhận từng dòng.')}
          ${tip('check', 'Kiểm tra trước khi thêm', 'Một mặt hàng: danh sách bên dưới đã lọc sẵn, dòng tô màu là gợi ý đầu – bấm dòng đúng hoặc Enter. Không có gì vào giỏ nếu chưa chọn.')}
          ${tip('x', 'Nghe sai?', 'Bấm <kbd>Esc</kbd> để xóa rồi nói lại, hoặc gõ vài chữ đầu tên thuốc. Gõ không dấu cũng được.')}
          ${tip('info', 'Nói cho dễ nghe', 'Nói rõ, cách micro 20–30 cm, tránh lúc quầy ồn. Lần đầu trình duyệt hỏi quyền micro – chọn Cho phép.')}
        </ol>`,
      foot: `<button class="btn" data-x>Đóng</button>${off ? '' : `<button class="btn primary" data-go>${icon('mic', 's')} Bắt đầu nói <span class="kbd">F3</span></button>`}`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        const g = el.querySelector('[data-go]');
        if (g) g.onclick = () => { close(); setTimeout(toggleVoice, 50); };
      },
    });
  }

  async function toggleVoice() {
    const btn = $('#micBtn'), live = $('#voiceLive');
    if (!btn || btn.disabled) return;
    if (voice) { voice.stop(); return; }
    const setState = s => {
      btn.classList.toggle('on', s === 'listening'); btn.classList.toggle('busy', s === 'processing' || s === 'installing');
      live.classList.toggle('hidden', s === 'idle' && !voicePending);
      if (s === 'listening') live.innerHTML = `${icon('mic', 's')} Đang nghe… nói <b>tên thuốc + số lượng + ĐVT</b>, VD: <b>“Paracetamol hai vỉ và Vitamin C một hộp”</b>. Nói xong bấm micro / F3 để dừng.`;
      if (s === 'processing') live.innerHTML = S().settings.ai.stt === 'app' ? 'Đang chuyển giọng nói thành chữ…' : 'Đang chuyển giọng nói thành chữ trên máy chủ nội bộ…';
      if (s === 'installing') live.innerHTML = 'Đang tải gói tiếng Việt về máy (chỉ lần đầu)…';
      if (s === 'idle') voice = null;
    };
    try {
      voice = { stop() { } };
      voice = await VM.ai.listen({
        onState: setState,
        onPartial: t => { live.innerHTML = `${icon('mic', 's')} <b>${esc(t)}</b>`; },
        onFinal: applyVoice,
        onError: m => VM.ui.toast(m, 'warn', 6000),
      });
    } catch (e) { voice = null; setState('idle'); VM.ui.toast(e.message, 'warn', 7000, { label: 'Cài đặt', fn: () => VM.ui.go('settings') }); }
  }
  function applyVoice(text) {
    const segs = splitVoice(text), live = $('#voiceLive');
    live.classList.remove('hidden');
    live.innerHTML = `${icon('mic', 's')} Nghe được: <b>“${esc(text)}”</b> <span class="muted">– bấm dòng đúng hoặc Enter; nghe sai thì Esc rồi nói lại</span>`;
    VM.store.log('Nhập bằng giọng nói', 'Bán lẻ', `“${text}”`);
    if (segs.length <= 1) {
      // Một mặt hàng: đưa vào ô tìm kiếm, dược sĩ chọn đúng dòng rồi Enter
      const r = parseVoice(text), si = $('#posSearch');
      voicePending = { qty: r.qty, unit: r.unit, q: r.q };
      si.value = r.q; si.focus(); hl = 0; moved = false; drawRes();
      return;
    }
    openVoiceConfirm(text, segs.map(parseVoice));
  }
  function openVoiceConfirm(text, rows) {
    VM.ui.modal({
      title: 'Xác nhận mặt hàng nghe được', sub: `“${esc(text)}” – kiểm tra từng dòng trước khi thêm vào giỏ.`, ic: 'mic',
      body: `<div class="voice-rows">${rows.map((r, i) => r.matches.length ? `<div class="voice-row" data-r="${i}">
          <input type="checkbox" checked data-on aria-label="Chọn">
          <div style="min-width:0"><select class="select" data-p>${r.matches.map(p => `<option value="${p.id}">${esc(p.name)} – ${money(((r.unit && p.units.find(u => VM.normalize(u.name) === r.unit)) || defUnit(p)).price)}</option>`).join('')}</select><div class="heard">Nghe: “${esc(r.q)}”</div></div>
          <div class="stepper"><button type="button" data-d>${icon('minus', 's')}</button><input data-q inputmode="numeric" value="${r.qty}"><button type="button" data-i>${icon('plus', 's')}</button></div></div>`
        : `<div class="voice-row miss"><span>${icon('alert', 's')}</span><div>Không khớp mặt hàng nào với “${esc(r.q)}”</div><span></span></div>`).join('')}</div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('plus', 's')} Thêm vào giỏ <span class="kbd">Enter</span></button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelectorAll('.voice-row[data-r]').forEach(row => {
          const q = row.querySelector('[data-q]');
          row.querySelector('[data-d]').onclick = () => { q.value = Math.max(1, (+q.value || 1) - 1); };
          row.querySelector('[data-i]').onclick = () => { q.value = (+q.value || 0) + 1; };
        });
        const ok = () => {
          let n = 0;
          el.querySelectorAll('.voice-row[data-r]').forEach(row => {
            if (!row.querySelector('[data-on]').checked) return;
            const r = rows[+row.dataset.r], pid = row.querySelector('[data-p]').value, p = VM.store.product(pid);
            const u = (r.unit && p.units.find(x => VM.normalize(x.name) === r.unit)) || defUnit(p);
            VM.ai.track('voice', r.matches[0].id === pid);
            addProduct(pid, u.name, Math.max(1, Math.floor(VM.parseNum(row.querySelector('[data-q]').value)))); n++;
          });
          VM.store.save('voice');
          close(); clearSearch(); if (n) VM.ui.toast(`Đã thêm ${n} mặt hàng từ giọng nói`);
        };
        el.querySelector('[data-ok]').onclick = ok;
        el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'SELECT') { e.preventDefault(); ok(); } });
      },
    });
  }

  VM.pos = { printReceipt, receiptHtml };
  VM.ui.register({ id: 'pos', title: 'Bán hàng', head: 'Vinmec Pharmacy', group: 'retail', icon: 'cart', render, hot: true, detail: true,
    keys: [['F2', 'Tìm hàng'], ['↑ ↓ Enter', 'Chọn hàng'], ['F3', 'Giọng nói'], ['Esc', 'Xóa ô tìm / nghe sai'], ['F4', 'Thanh toán QR'], ['F8', 'Tiền mặt'], ['F9', 'Đơn mới']],
    tour: () => [
      { el: '#posSearchBox', title: 'Tìm hoặc quét thuốc', text: 'Gõ 1–2 chữ tên thuốc, hoạt chất hoặc mã (không dấu cũng được), danh sách bên dưới lọc ngay. Gõ <b>“2 para”</b> để thêm kèm số lượng. Máy quét mã vạch / DataMatrix: quét thẳng vào ô này. Phím tắt <kbd>F2</kbd>.' },
      { el: '#catBar .cat-tabs', title: 'Phân loại hàng', text: 'Bấm <b>Thuốc</b>, <b>TPCN</b>, <b>Vật tư</b> hoặc <b>Khác</b> để chỉ xem nhóm đó. Bấm lại (hoặc “Tất cả”) để bỏ lọc.' },
      { el: '#posRes', title: 'Danh sách hàng', text: 'Bấm một dòng (hoặc <kbd>↑</kbd> <kbd>↓</kbd> rồi <kbd>Enter</kbd>) để thêm vào giỏ. Hàng bán nhiều đứng trước.' },
      { el: '#micBtn:not([disabled])', title: 'Nói tên thuốc', text: 'Bấm micro (hoặc <kbd>F3</kbd>) rồi đọc tên thuốc + số lượng + ĐVT, VD “Smecta ba gói”. Nói nhiều mặt hàng thì app hỏi xác nhận từng dòng. Nút <b>?</b> bên cạnh có đủ mẹo.' },
      { el: '.cart', title: 'Giỏ hàng', text: 'Mỗi mặt hàng một dòng: đổi ĐVT, tăng/giảm số lượng ngay trên dòng. Đơn giá lấy theo Danh mục, không sửa tại quầy. Giỏ đang dở được giữ lại khi đổi ca.' },
      { el: '.pay-btns', title: 'Thanh toán', text: '<kbd>F4</kbd> chuyển khoản QR · <kbd>F8</kbd> tiền mặt. Sau khi thanh toán có thể in phiếu.' },
      { el: '#detailBtn', title: 'Hiển thị tất cả', text: 'Mặc định chỉ hiện thông tin cần thiết. Bấm để xem thêm mã hàng, lô, HSD, tồn kho, mã đơn… bấm lại để thu gọn.' },
      { el: '#newOrderBtn', title: 'Đơn mới, thêm hàng mới, báo cáo', text: '<kbd>F9</kbd> mở đơn mới. “Thêm hàng mới” để bán mặt hàng chưa có trong danh mục; “Báo cáo trong ngày” xuất Excel các đơn bán hôm nay.' },
    ] });
})(window.VM);
