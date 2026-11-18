/* POS – bán lẻ thuốc không kê đơn, TPCN, vật tư y tế */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money, num } = VM;
  const S = () => VM.store.state;
  const CAT = VM.store.CATEGORIES;

  let draft, busy = false, keyHandler = null, sug = null, voice = null, voicePending = null;
  const draftKey = () => 'vmhub.draft.' + ((VM.store.currentUser() || {}).id || 'x');
  function loadDraft() { try { draft = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch { draft = null; } if (!draft) draft = { items: [], customer: '', pid: '' }; }
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
  function render(view, top) {
    loadDraft();
    const ai = S().settings.ai, mode = VM.ai.MODES[ai.stt] || VM.ai.MODES.off;
    top.innerHTML = `
      <button class="btn" id="addSpecial" title="Hàng ngoài danh mục">${icon('package')}<span class="label">Hàng ngoài DM</span></button>
      <button class="btn" id="posXls" title="Xuất Excel các đơn bán hôm nay">${icon('download')}<span class="label">Excel hôm nay</span></button>
      <button class="btn" id="newOrderBtn" title="Đơn mới (F9)">${icon('plus')}<span class="label">Đơn mới</span> <span class="kbd hide-m">F9</span></button>`;
    view.innerHTML = `
      <div class="pos">
        <section class="pos-main" aria-label="Chọn hàng">
          <div class="pos-search" id="posSearchBox">
            ${icon('search')}
            <input id="posSearch" type="search" autocomplete="off" placeholder="Gõ 1–2 chữ tên thuốc, hoạt chất, mã… · quét mã vạch · hoặc bấm micro" aria-label="Tìm thuốc">
            <div class="search-hint hide-m"><kbd>F2</kbd></div>
            <button class="mic-btn" id="micBtn" title="Nhập bằng giọng nói (F3) – ${esc(mode.label)}" aria-label="Nhập bằng giọng nói" ${ai.stt === 'off' ? 'disabled' : ''}>${icon('mic')}${mode.short ? `<span class="mic-mode ${ai.stt === 'cloud' ? 'cloud' : ''}">${mode.short}</span>` : ''}</button>
          </div>
          <div class="voice-live hidden" id="voiceLive"></div>
          <div class="hot-strip" id="hotStrip"></div>
          <div class="card cart" aria-label="Giỏ hàng">
            <div class="cart-h"><h3>Giỏ hàng</h3><span class="pill pri" id="cartCount"></span><span class="order-code" id="orderCode" title="Mã đơn"></span>
              <div class="right"><button class="btn ghost sm" id="clearCart">${icon('trash', 's')} Xóa giỏ</button></div></div>
            <div class="chead"><span>#</span><span>Mặt hàng</span><span>ĐVT</span><span>Số lượng</span><span class="r c-price">Đơn giá</span><span class="r">Thành tiền</span><span></span></div>
            <div class="cart-items" id="cartItems"></div>
          </div>
        </section>
        <aside class="card pay" aria-label="Thanh toán">
          <div class="card-b">
            <details class="cust" id="custBox" ${draft.customer || draft.pid ? 'open' : ''}><summary>${icon('user', 's')} Khách hàng <span class="muted">(không bắt buộc)</span></summary>
              <div class="field"><input class="input" id="cusName" placeholder="Tên khách / SĐT" value="${esc(draft.customer)}" aria-label="Khách hàng"></div>
              <div class="field"><input class="input mono" id="cusPid" placeholder="PID bệnh nhân" value="${esc(draft.pid)}" aria-label="PID"></div></details>
            <div class="sum-row"><span>Số mặt hàng</span><span id="sumLines">0</span></div>
            <div class="sum-row"><span>Tổng số lượng</span><span id="sumQty">0</span></div>
            <div class="sum-total"><span>Tổng tiền</span><strong id="sumTotal">0 đ</strong></div>
            <div id="cartIssue"></div>
            <div class="pay-btns">
              <button class="btn primary xl" id="payQr"><span>${icon('qr')} Chuyển khoản QR</span><span class="kbd">F4</span></button>
              <button class="btn tonal xl" id="payCash"><span>${icon('cash')} Tiền mặt</span><span class="kbd">F8</span></button>
            </div>
          </div>
        </aside>
      </div>`;

    $('#cusName').oninput = e => { draft.customer = e.target.value; saveDraft(); };
    $('#cusPid').oninput = e => { draft.pid = e.target.value; saveDraft(); };
    const si = $('#posSearch');
    sug = VM.ui.suggest(si, { items: searchItems, head: searchHead, empty: q => `Không tìm thấy “${esc(q)}”. Thử gõ không dấu, tên hoạt chất hoặc mã SAP.`, beforeEnter: scanEnter });
    si.addEventListener('input', () => { voicePending = null; $('#voiceLive').classList.add('hidden'); });
    si.addEventListener('keydown', e => { if (e.key === 'Escape') { si.value = ''; sug.close(); } });
    $('#newOrderBtn').onclick = newOrder;
    $('#posXls').onclick = () => {
      const today = VM.ymd(), list = S().sales.filter(s => VM.ymd(s.paidAt || s.createdAt) === today);
      if (!list.length) { VM.ui.toast('Hôm nay chưa có đơn bán nào', 'warn'); return; }
      VM.history.exportSales(list, 'vinmec_ban_hang_hom_nay');
    };
    $('#micBtn').onclick = toggleVoice;
    $('#addSpecial').onclick = openSpecial;
    $('#clearCart').onclick = async () => { if (!draft.items.length) return; if (await VM.ui.confirm({ title: 'Xóa toàn bộ giỏ hàng?', message: 'Các mặt hàng đã chọn sẽ bị xóa khỏi đơn đang tạo.', ok: 'Xóa giỏ', danger: true })) { draft.items = []; saveDraft(); renderCart(); } };
    $('#payQr').onclick = () => openPay('qr');
    $('#payCash').onclick = () => openPay('cash');

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

    renderHot(); renderCart();
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
  // Xếp hạng: độ khớp chữ + điểm "hay bán" (60 ngày) – thuốc hay dùng nổi lên đầu ngay khi gõ 1–2 ký tự
  function ranked(q, n = 8) {
    const f = VM.store.productFreq(), maxF = Math.max(1, ...Object.values(f));
    const act = S().products.filter(p => p.active);
    if (!q.trim()) return VM.store.topProducts(n);
    return act.map(p => {
      const s = Math.max(...['name', 'ingredient', 'code', 'sap'].map(k => VM.fuzzyScore(q, p[k])));
      return { p, s: s + (f[p.id] ? 6 + 10 * f[p.id] / maxF : 0) - (VM.store.sellable(p) ? 0 : 25) };
    }).filter(x => x.s >= (q.trim().length <= 2 ? 80 : 60)).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.p);
  }
  function searchHead(raw) {
    const { q } = splitQty(raw);
    return q.trim() ? `${icon('search', 's')} Kết quả · ★ = hay bán · Enter thêm dòng đang chọn` : `${icon('trend', 's')} Hay bán 60 ngày qua`;
  }
  function searchItems(raw) {
    const { qty, q } = voicePending || splitQty(raw);
    const hot = new Set(VM.store.topProducts(10).map(p => p.id));
    return ranked(q).map(p => {
      const u = (voicePending && voicePending.unit && p.units.find(x => VM.normalize(x.name) === voicePending.unit)) || defUnit(p);
      const iss = VM.store.productIssue(p), ok = VM.store.sellable(p);
      return {
        cls: ok ? '' : 'off',
        html: `${hot.has(p.id) ? `<span class="star" title="Hay bán">★</span>` : `<span class="tag ${p.category}">${CAT[p.category].short}</span>`}
          ${qty > 1 ? `<span class="qtyb">×${qty} ${esc(u.name.toLowerCase())}</span>` : ''}
          <span class="nm">${esc(p.name)}</span>
          <span class="sub">${esc(p.code)} · tồn ${esc(VM.store.stockText(p))}${iss ? ' · ' + esc(iss.text) : ''}</span>
          <span class="pr">${money(u.price)}<small class="muted">/${esc(u.name.toLowerCase())}</small></span>`,
        pick: () => { if (voicePending) VM.ai.track('voice', ranked(q, 1)[0] === p); addProduct(p.id, u.name, qty); clearSearch(); },
      };
    });
  }
  function clearSearch() { const si = $('#posSearch'); si.value = ''; voicePending = null; $('#voiceLive').classList.add('hidden'); si.focus(); }
  // Máy quét mã vạch gõ mã + Enter: khớp chính xác mã hàng / SAP / GTIN / GS1 thì thêm ngay
  function scanEnter(raw) {
    const r = VM.store.matchScan(raw);
    if (!r || !r.product) return false;
    addProduct(r.product.id);
    VM.ui.toast('Đã thêm ' + r.product.name);
    clearSearch();
    return true;
  }

  function renderHot() {
    const list = VM.store.topProducts(8);
    $('#hotStrip').innerHTML = list.length ? `<span class="hs-l">★ Hay bán</span>` + list.map(p => `<button class="hot-chip" data-hot="${p.id}" title="Thêm 1 ${esc(defUnit(p).name.toLowerCase())}">${esc(p.name)} <small>${money(defUnit(p).price)}</small></button>`).join('') : '';
    $$('#hotStrip [data-hot]').forEach(b => b.onclick = () => addProduct(b.dataset.hot));
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

  // Mỗi mặt hàng đúng MỘT dòng: tên đậm + thông tin phụ chữ nhỏ; 6–10 dòng nhìn thấy cùng lúc
  function renderCart() {
    $('#orderCode').textContent = VM.store.orderCode(true);
    const el = $('#cartItems');
    $('#cartCount').textContent = draft.items.length + ' mặt hàng';
    if (!draft.items.length) {
      el.innerHTML = `<div class="cart-empty">${icon('cart', 'l')}<b>Chưa có mặt hàng</b>Gõ 1–2 chữ vào ô tìm kiếm, quét mã vạch, bấm “Hay bán” hoặc dùng micro.</div>`;
    } else {
      el.innerHTML = draft.items.map((it, k) => {
        const p = it.special ? null : VM.store.product(it.productId);
        const iss = lineIssue(it);
        const meta = iss ? '⚠ ' + iss : it.special ? `Ngoài danh mục · người bán ${it.seller || '—'}` : `${it.code} · Lô ${it.lot || '—'}${p ? ' · HSD ' + VM.fmtDate(p.expiry) + ' · tồn ' + VM.store.stockText(p) : ''} · ${num(it.price)}đ/${it.unit.toLowerCase()}`;
        const unitSel = p && p.units.length > 1 ? `<select class="select unit-sel" data-unit="${it.key}" aria-label="Đơn vị tính">${p.units.map(u => `<option ${u.name === it.unit ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : `<span class="unit-txt">${esc(it.unit)}</span>`;
        const edited = it.price !== it.listPrice && !it.special;
        return `<div class="crow ${iss ? 'bad' : ''}" data-key="${it.key}">
          <span class="cr-n">${k + 1}</span>
          <div class="cr-name" title="${esc(it.name)} – ${esc(meta)}">${it.special ? '<span class="spc">NGOÀI DM</span>' : ''}<b>${esc(it.name)}</b><small>${esc(meta)}</small></div>
          <div class="c-unit">${unitSel}</div>
          <div class="c-step"><div class="stepper"><button data-dec="${it.key}" aria-label="Giảm">${icon('minus', 's')}</button><input inputmode="numeric" value="${it.qty}" data-qty="${it.key}" aria-label="Số lượng"><button data-inc="${it.key}" aria-label="Tăng">${icon('plus', 's')}</button></div></div>
          <button class="cr-price c-price ${edited ? 'edited' : ''}" data-price="${it.key}" title="Sửa đơn giá">${num(it.price)}${edited ? ' ✎' : ''}</button>
          <span class="cr-total" data-price="${it.key}" title="Bấm để sửa đơn giá">${money(it.qty * it.price)}</span>
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
    $$('[data-price]', el).forEach(b => b.onclick = () => editPrice(find(b.dataset.price)));
    $('#sumLines').textContent = draft.items.length;
    $('#sumQty').textContent = num(VM.sum(draft.items, i => i.qty));
    $('#sumTotal').textContent = money(total());
    const issue = draft.items.length ? cartIssue() : null;
    $('#cartIssue').innerHTML = issue ? `<div class="alert bad">${icon('alert', 's')}<span>${esc(issue)}</span></div>` : '';
    $('#payQr').disabled = $('#payCash').disabled = !draft.items.length || !!issue;
  }

  async function editPrice(it) {
    const v = await VM.ui.confirm({ title: 'Sửa đơn giá', message: `<b>${esc(it.name)}</b><br><span class="muted">Giá danh mục: ${money(it.listPrice)}/${esc(it.unit.toLowerCase())}. Việc sửa giá sẽ được ghi vào nhật ký.</span>`, ok: 'Cập nhật giá', ic: 'edit', input: { label: 'Đơn giá mới (đ)', required: true, value: String(it.price) } });
    if (v === false) return;
    const n = Math.round(VM.parseNum(v));
    if (n < 0) return VM.ui.toast('Giá không hợp lệ', 'bad');
    it.price = n; saveDraft(); renderCart();
  }

  function openSpecial() {
    const u = VM.store.currentUser();
    VM.ui.modal({
      title: 'Thêm hàng hóa đặc biệt', sub: 'Hàng ngoài danh mục (theo nhu cầu khách). Ghi rõ người bán để đối soát.', ic: 'package',
      body: `<div class="form-grid">
        <div class="field c12"><label>Tên hàng <span class="req">*</span></label><input class="input" name="name" placeholder="VD: Băng thun cổ tay size M"></div>
        <div class="field c6 half"><label>Đơn vị tính</label><input class="input" name="unit" list="unitList" value="Cái"><datalist id="unitList"><option>Hộp</option><option>Chai</option><option>Lọ</option><option>Ống</option><option>Vỉ</option><option>Viên</option><option>Cái</option><option>Gói</option></datalist></div>
        <div class="field c6 half"><label>Số lượng <span class="req">*</span></label><input class="input" name="qty" inputmode="numeric" value="1"></div>
        <div class="field c6"><label>Đơn giá (đ) <span class="req">*</span></label><input class="input" name="price" inputmode="numeric"></div>
        <div class="field c6"><label>Tên người bán</label><input class="input" name="seller" list="staffList" value="${esc(u.name)}"><datalist id="staffList">${VM.ui.staffOptions()}</datalist></div>
      </div><div class="err hidden" id="spErr" style="margin-top:10px"></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('plus', 's')} Thêm vào giỏ</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = () => {
          const d = VM.ui.formData(el), qty = Math.floor(VM.parseNum(d.qty)), price = Math.round(VM.parseNum(d.price));
          const err = !d.name ? 'Nhập tên hàng' : qty <= 0 ? 'Số lượng phải > 0' : !(price > 0) ? 'Nhập đơn giá' : '';
          if (err) { const e = el.querySelector('#spErr'); e.textContent = err; e.classList.remove('hidden'); return; }
          draft.items.push({ key: VM.uid('c'), special: true, productId: '', code: 'DACBIET', sap: '', name: d.name, lot: '', store: '', unit: d.unit || 'Cái', factor: 1, qty, price, listPrice: price, seller: d.seller });
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

  // ---------- payment ----------
  function openPay(mode) {
    const issue = cartIssue();
    if (issue) { VM.ui.toast(issue, 'warn'); return; }
    const t = total(), code = VM.store.orderCode(true), bank = S().settings.bank;
    const hasBank = bank.bin && bank.account;
    const qrUrl = hasBank ? `https://img.vietqr.io/image/${encodeURIComponent(bank.bin)}-${encodeURIComponent(bank.account)}-compact2.png?amount=${t}&addInfo=${encodeURIComponent(code)}&accountName=${encodeURIComponent(bank.owner || '')}` : '';
    const cashQuick = [...new Set([t, Math.ceil(t / 10000) * 10000, Math.ceil(t / 50000) * 50000, Math.ceil(t / 100000) * 100000, Math.ceil(t / 200000) * 200000, Math.ceil(t / 500000) * 500000])].filter(v => v >= t).slice(0, 4);
    VM.ui.modal({
      title: 'Thanh toán', sub: `Đơn <b class="mono">${esc(code)}</b> · ${draft.items.length} mặt hàng`, ic: mode === 'qr' ? 'qr' : 'cash', size: 'lg',
      body: `<div class="seg" style="margin-bottom:16px"><button data-m="qr" class="${mode === 'qr' ? 'active' : ''}">${icon('qr', 's')} Chuyển khoản QR</button><button data-m="cash" class="${mode === 'cash' ? 'active' : ''}">${icon('cash', 's')} Tiền mặt</button></div>
        <div data-pane="qr" class="${mode === 'qr' ? '' : 'hidden'}">
          ${hasBank ? `<div class="pay-panel"><div class="qr-box" id="qrBox"><span class="muted small">Đang tải mã QR…</span></div>
            <div><div class="muted small">Số tiền cần chuyển</div><div class="amount-big">${money(t)}</div>
            <dl class="kv" style="margin-top:14px"><dt>Nội dung CK</dt><dd class="mono">${esc(code)}</dd><dt>Tài khoản</dt><dd>${esc(bank.account)}</dd><dt>Chủ TK</dt><dd>${esc(bank.owner || '')}</dd></dl>
            <div class="alert info" style="margin-top:14px">${icon('info', 's')}<span>Chỉ bấm hoàn tất <b>sau khi đã kiểm tra tiền vào tài khoản</b>.</span></div></div></div>`
          : `<div class="alert warn">${icon('alert', 's')}<span>Chưa cấu hình tài khoản nhận chuyển khoản. Vào <b>Cài đặt → Thanh toán QR</b> để nhập ngân hàng và số tài khoản, hoặc chọn Tiền mặt.</span></div>`}
        </div>
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
        if (hasBank) {
          const img = new Image(); img.alt = 'Mã QR thanh toán ' + money(t);
          img.onload = () => { const b = el.querySelector('#qrBox'); if (b) { b.innerHTML = ''; b.appendChild(img); } };
          img.onerror = () => { const b = el.querySelector('#qrBox'); if (b) b.innerHTML = `<div class="alert warn">${icon('alert', 's')}<span>Không tải được QR (mất mạng?). Khách có thể chuyển khoản thủ công theo thông tin bên cạnh, hoặc thu tiền mặt.</span></div>`; };
          img.src = qrUrl;
        }
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
    if ($('#cusName')) { $('#cusName').value = ''; $('#cusPid').value = ''; renderCart(); renderHot(); }
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

  async function toggleVoice() {
    const btn = $('#micBtn'), live = $('#voiceLive');
    if (!btn || btn.disabled) return;
    if (voice) { voice.stop(); return; }
    const setState = s => {
      btn.classList.toggle('on', s === 'listening'); btn.classList.toggle('busy', s === 'processing' || s === 'installing');
      live.classList.toggle('hidden', s === 'idle' && !voicePending);
      if (s === 'listening') live.innerHTML = `${icon('mic', 's')} Đang nghe… nói tên thuốc + số lượng, VD: <b>“Paracetamol hai vỉ và Vitamin C một hộp”</b>. Bấm micro / F3 để dừng.`;
      if (s === 'processing') live.innerHTML = 'Đang chuyển giọng nói thành chữ trên máy chủ nội bộ…';
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
    live.innerHTML = `${icon('mic', 's')} Nghe được: <b>“${esc(text)}”</b>`;
    VM.store.log('Nhập bằng giọng nói', 'Bán lẻ', `“${text}”`);
    if (segs.length <= 1) {
      // Một mặt hàng: đưa vào ô tìm kiếm, dược sĩ chọn đúng dòng rồi Enter
      const r = parseVoice(text), si = $('#posSearch');
      voicePending = { qty: r.qty, unit: r.unit, q: r.q };
      si.value = r.q; si.focus(); sug.refresh();
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
  VM.ui.register({ id: 'pos', title: 'Bán hàng', group: 'retail', icon: 'cart', crumb: 'Bán lẻ · OTC, TPCN, vật tư y tế', render, hot: true,
    keys: [['F2', 'Tìm hàng'], ['F3', 'Giọng nói'], ['F4', 'Thanh toán QR'], ['F8', 'Tiền mặt'], ['F9', 'Đơn mới'], ['↑ ↓ Enter', 'Chọn gợi ý']],
    tour: () => [
      { el: '#posSearchBox', title: 'Tìm hoặc quét thuốc', text: 'Gõ 1–2 chữ tên thuốc, hoạt chất hoặc mã (không dấu cũng được). Gõ <b>“2 para”</b> để thêm kèm số lượng. Máy quét mã vạch / DataMatrix: quét thẳng vào ô này. Phím tắt <kbd>F2</kbd>.' },
      { el: '#micBtn:not([disabled])', title: 'Nói tên thuốc', text: 'Bấm micro (hoặc <kbd>F3</kbd>) rồi đọc tên thuốc và số lượng. Nói nhiều mặt hàng thì app hỏi xác nhận từng dòng.' },
      { el: '#hotStrip', title: 'Hàng hay bán', text: 'Dải <b class="tour-hot">vàng</b> là các mặt hàng bán nhiều nhất 60 ngày qua – bấm một lần để thêm vào giỏ.' },
      { el: '.cart', title: 'Giỏ hàng', text: 'Mỗi mặt hàng một dòng: đổi ĐVT, tăng/giảm số lượng ngay trên dòng. Giỏ đang dở được giữ lại khi đổi ca.' },
      { el: '.pay-btns', title: 'Thanh toán', text: '<kbd>F4</kbd> chuyển khoản QR · <kbd>F8</kbd> tiền mặt. Sau khi thanh toán có thể in hóa đơn.' },
      { el: '#newOrderBtn', title: 'Đơn mới & hàng ngoài danh mục', text: '<kbd>F9</kbd> mở đơn mới. Nút “Hàng ngoài DM” để bán mặt hàng chưa có trong danh mục; “Excel hôm nay” xuất các đơn trong ngày.' },
    ] });
})(window.VM);
