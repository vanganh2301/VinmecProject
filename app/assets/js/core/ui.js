/* UI core: shell (rail + rèm), hash router, modal, confirm, toast, print */
'use strict';
(function (VM) {
  const { $, $$, esc, icon } = VM;
  const modules = [];
  let current = null, currentArg = '', cleanup = null;
  const LS_CUR = 'vmhub.curtain', LS_DETAIL = 'vmhub.detail';

  // 3 nghiệp vụ chính = 3 biểu tượng trên rail; "Khác" gom Tổng quan / Sao lưu / Cài đặt
  const GROUPS = {
    retail: { label: 'Bán lẻ', icon: 'cart', home: 'pos' },
    loans: { label: 'Sổ vay', icon: 'swap', home: 'loans', noCur: true },
    invoices: { label: 'Hóa đơn', icon: 'file', home: 'invoices', full: 'Sổ hóa đơn', noCur: true },
    system: { label: 'Khác', icon: 'grid', home: 'dashboard', full: 'Tổng quan & hệ thống' },
  };
  const register = def => modules.push(def);
  const groupOf = id => (modules.find(m => m.id === id) || {}).group;
  const curtainOpen = () => { const v = localStorage.getItem(LS_CUR); return v === null ? window.innerWidth >= 1200 : v === '1' && window.innerWidth >= 768; };

  function shell() {
    $('#root').innerHTML = `
      <div class="app ${curtainOpen() ? 'cur-open' : ''}" id="app">
        <nav class="rail" aria-label="Nghiệp vụ chính">
          <div class="rail-brand" title="Vinmec Pharmacy Hub">${icon('cross')}</div>
          <div class="rail-main" id="rail"></div>
          <div class="rail-foot">
            <button class="rail-btn" data-g="system" id="railSys" title="Tổng quan, sao lưu, cài đặt">${icon('grid')}<span>Khác</span></button>
            <button class="rail-dot" id="backupDot" title="Trạng thái sao lưu"><span class="dot"></span></button>
            <button class="avatar rail-av" id="railMe" title="Đổi ca / Đăng xuất"></button>
          </div>
        </nav>
        <aside class="curtain" id="curtain" aria-label="Chức năng">
          <div class="cur-h"><b id="curTitle"></b><button class="btn ghost icon sm" id="curClose" title="Thu gọn rèm" aria-label="Thu gọn">${icon('chevl', 's')}</button></div>
          <div class="cur-list" id="curList"></div>
          <div class="cur-foot">
            <button class="backup-chip" id="backupChip" title="Trạng thái sao lưu"><span class="dot"></span><span><b id="bkTitle">Đang kiểm tra…</b><span id="bkSub"></span></span></button>
            <div class="me" id="me"></div>
          </div>
        </aside>
        <div class="scrim" id="scrim"></div>
        <div class="main">
          <header class="topbar" id="topbar">
            <button class="btn ghost icon cur-toggle" id="curOpen" aria-label="Mở / thu gọn rèm chức năng" title="Mở / thu gọn rèm chức năng">${icon('menu')}</button>
            <span class="page-ic" id="pageIc" aria-hidden="true"></span><div style="min-width:0"><h1 id="pageTitle"></h1></div>
            <div class="topbar-actions" id="topActions"></div>
            <button class="btn ghost sm detail-btn hidden" id="detailBtn" aria-pressed="false" title="Hiện / ẩn thông tin chi tiết trong danh sách">${icon('eye', 's')}<span class="label" id="detailLbl">Hiển thị tất cả</span></button>
            <button class="btn ghost icon tour-btn hidden" id="tourBtn" title="Hướng dẫn sử dụng màn này" aria-label="Xem hướng dẫn sử dụng màn này">${icon('help')}</button>
          </header>
          <main class="content" id="view" tabindex="-1"></main>
        </div>
      </div>`;
    $('#curClose').onclick = () => setCur(false);
    $('#curOpen').onclick = () => setCur(!$('#app').classList.contains('cur-open'));
    $('#scrim').onclick = () => setCur(false);
    $('#backupChip').onclick = $('#backupDot').onclick = () => go('backup');
    $('#railMe').onclick = () => VM.app.logout();
    $('#railSys').onclick = () => railClick('system');
    $('#tourBtn').onclick = () => VM.tour && current && VM.tour.start(current, true);
    $('#detailBtn').onclick = () => setDetail(!$('#app').classList.contains('show-all'));
    setDetail(localStorage.getItem(LS_DETAIL) === '1', true);
    window.addEventListener('scroll', () => $('#topbar') && $('#topbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });
    // Thanh tiêu đề tự thu gọn nút khi tiêu đề bị cắt (rèm mở / cửa sổ hẹp / màn có nhiều nút)
    let fitRaf = 0;
    const fitLater = () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitTop); };
    if (window.ResizeObserver) new ResizeObserver(fitLater).observe($('#topbar'));
    new MutationObserver(fitLater).observe($('#topActions'), { childList: true, subtree: true });
    renderMe();
    renderNav();
    renderBackupChip();
  }
  // Tối giản: mặc định chỉ hiện thông tin cần thiết; phần tử .xd (chi tiết) chỉ hiện khi bật "Hiển thị tất cả"
  function setDetail(on, silent) {
    $('#app').classList.toggle('show-all', on);
    $('#detailBtn').setAttribute('aria-pressed', on);
    $('#detailBtn').classList.toggle('on', on);
    $('#detailLbl').textContent = on ? 'Thu gọn' : 'Hiển thị tất cả';
    try { localStorage.setItem(LS_DETAIL, on ? '1' : '0'); } catch (e) { }
    if (!silent) window.dispatchEvent(new Event('vm-detail'));
  }
  // Bậc 1: nút phụ chỉ còn icon · bậc 2: bỏ chữ "Hiển thị tất cả" và phím tắt · bậc 3: nút chính cũng chỉ còn icon.
  // Chữ của nút vẫn còn trong title (rê chuột / giữ lâu để xem).
  function fitTop() {
    const tb = $('#topbar'), h = $('#pageTitle');
    if (!tb || !h) return;
    $$('#topActions .btn').forEach(b => { const l = b.querySelector('.label'); if (!b.title && l) b.title = l.textContent.trim(); });
    tb.classList.remove('fit1', 'fit2', 'fit3', 'fit4');
    for (const c of ['fit1', 'fit2', 'fit3', 'fit4']) { if (h.scrollWidth <= h.clientWidth + 1 && h.scrollHeight <= h.clientHeight + 1) break; tb.classList.add(c); }
  }
  function setCur(open) {
    $('#app').classList.toggle('cur-open', open);
    if (window.innerWidth >= 768) localStorage.setItem(LS_CUR, open ? '1' : '0');
  }
  // Bấm biểu tượng nhóm: đang ở nhóm đó thì mở/đóng rèm, nếu không thì sang trang chính của nhóm.
  // Nhóm không có rèm (noCur: Sổ vay, Hóa đơn – bỏ theo yêu cầu khoa 19/11/2026) thì luôn về trang chính của nhóm.
  function railClick(g) {
    if (groupOf(current) === g && !GROUPS[g].noCur) { setCur(!$('#app').classList.contains('cur-open')); return; }
    if (GROUPS[g].noCur && current === GROUPS[g].home && !currentArg) return;
    go(GROUPS[g].home);
  }

  function renderMe() {
    const u = VM.store.currentUser();
    if (!u || !$('#me')) return;
    $('#railMe').textContent = VM.initials(u.name);
    $('#railMe').title = u.name + ' – bấm để đổi ca / đăng xuất';
    $('#me').innerHTML = `<div class="avatar" title="${esc(u.name)}">${esc(VM.initials(u.name))}</div>
      <div class="me-text"><b>${esc(u.name)}</b><small>${esc(u.role || '')}</small></div>
      <button class="btn ghost icon sm" id="logoutBtn" title="Đổi ca / Đăng xuất" aria-label="Đăng xuất">${icon('logout', 's')}</button>`;
    $('#logoutBtn').onclick = () => VM.app.logout();
  }

  const badgeHtml = (b, cls = 'nav-badge') => b && b.n ? `<span class="${cls} ${b.soft ? 'soft' : ''}" title="${esc(b.title || '')}">${b.n > 99 ? '99+' : b.n}</span>` : '';
  function renderNav() {
    const rail = $('#rail');
    if (!rail) return;
    const g = groupOf(current);
    rail.innerHTML = ['retail', 'loans', 'invoices'].map(k => {
      const G = GROUPS[k];
      const bs = modules.filter(m => m.group === k && m.badge).map(m => m.badge()).filter(b => b && b.n);
      const n = VM.sum(bs, b => b.n), soft = bs.every(b => b.soft);
      return `<button class="rail-btn ${g === k ? 'active' : ''}" data-g="${k}" data-area="${k}" title="${esc(G.full || G.label)}" ${g === k ? 'aria-current="page"' : ''}>${icon(G.icon, 'l')}<span>${G.label}</span>${badgeHtml({ n, soft })}</button>`;
    }).join('');
    $$('#rail [data-g]').forEach(b => b.onclick = () => railClick(b.dataset.g));
    $('#railSys').classList.toggle('active', g === 'system');
    // Rèm: chức năng con của nhóm đang mở; mục hay dùng (hot) được làm nổi bật
    const G = GROUPS[g] || GROUPS.retail;
    $('#curTitle').textContent = G.full || G.label;
    let html = '', i = 0;
    modules.filter(m => m.group === g).forEach(m => {
      const act = current === m.id;
      const subs = m.subs ? m.subs() : [];
      const onSub = act && subs.some(s => s.arg === currentArg);
      html += `<button class="cur-item ${m.hot ? 'hot' : ''} ${act && !onSub ? 'active' : ''}" data-go="${m.id}" style="--i:${i++}">${icon(m.icon)}<span class="label">${esc(m.title)}</span>${m.hot ? '<span class="hot-dot" title="Hay dùng"></span>' : ''}${badgeHtml(m.badge && m.badge())}</button>`;
      subs.forEach(s => {
        html += `<button class="cur-sub ${s.hot ? 'hot' : ''} ${act && currentArg === s.arg ? 'active' : ''}" data-go="${m.id}/${s.arg}" style="--i:${i++}">${s.icon ? icon(s.icon, 's') : '<i class="cur-bullet"></i>'}<span class="label">${esc(s.label)}</span>${s.n ? `<span class="cnt ${s.tone || ''}">${s.n}</span>` : ''}</button>`;
      });
    });
    const keys = (modules.find(m => m.id === current) || {}).keys;
    if (keys && keys.length) html += `<div class="cur-keys" style="--i:${i}"><div class="label-t">Phím tắt</div>${keys.map(([k, t]) => `<div><kbd>${esc(k)}</kbd><span>${esc(t)}</span></div>`).join('')}</div>`;
    $('#curList').innerHTML = html;
    $$('#curList [data-go]').forEach(b => b.onclick = () => { go(b.dataset.go); if (window.innerWidth < 768) $('#app').classList.remove('cur-open'); });
  }

  function renderBackupChip() {
    if (!$('#backupChip') || !VM.backup) return;
    const st = VM.backup.status();
    [$('#backupChip'), $('#backupDot')].forEach(chip => { chip.classList.remove('warn', 'bad'); if (st.level !== 'ok') chip.classList.add(st.level); });
    $('#bkTitle').textContent = st.level === 'ok' ? 'Dữ liệu an toàn' : st.level === 'warn' ? 'Nên tải bản sao lưu' : 'Chưa sao lưu';
    $('#bkSub').textContent = 'Sao lưu: ' + VM.ago(st.lastAny);
    $('#backupDot').title = $('#bkTitle').textContent + ' · ' + $('#bkSub').textContent;
  }

  function go(id) { if (location.hash !== '#/' + id) location.hash = '#/' + id; else route(); }
  function route() {
    const mm = location.hash.match(/^#\/([\w-]+)(?:\/([\w-]+))?/) || [];
    const m = modules.find(x => x.id === mm[1]) || modules.find(x => x.id === 'pos');
    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { } }
    cleanup = null;
    current = m.id; currentArg = m.id === mm[1] ? (mm[2] || '') : '';
    $('#pageTitle').textContent = m.head || m.title;
    $('#pageIc').innerHTML = icon(m.icon);
    $('#app').dataset.area = m.group || 'system';
    $('#app').classList.toggle('no-cur', !!(GROUPS[m.group] || {}).noCur);
    $('#detailBtn').classList.toggle('hidden', !m.detail);
    document.title = m.title + ' · Vinmec Pharmacy Hub';
    $('#topActions').innerHTML = '';
    const view = $('#view');
    view.innerHTML = '';
    view.className = 'content view-' + m.id;
    cleanup = m.render(view, $('#topActions'), currentArg);
    fitTop();
    renderNav();
    window.scrollTo(0, 0);
    $('#tourBtn').classList.toggle('hidden', !(VM.tour && VM.tour.has(m.id)));
    if (VM.tour) VM.tour.auto(m.id);
  }
  const rerender = () => { if (current) route(); };
  function teardown() { if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { } } cleanup = null; current = null; }

  // ---------- floating suggestions (dùng chung) ----------
  /**
   * Gắn danh sách gợi ý thả nổi vào một ô nhập.
   * opt.items(q) → [{ html, pick(), cls? }]; opt.min = số ký tự tối thiểu (0 = hiện ngay khi focus)
   * opt.beforeEnter(q) → true nếu đã tự xử lý Enter (VD: quét mã chính xác)
   * opt.head(q) → html tiêu đề nhỏ; opt.empty(q) → html khi không có kết quả
   * Khi Enter đã được xử lý, sự kiện keydown được gắn cờ e.handled = true.
   */
  function suggest(input, opt) {
    const host = input.parentNode;
    host.classList.add('pos-rel');
    const dd = document.createElement('div');
    dd.className = 'dd hidden'; dd.setAttribute('role', 'listbox');
    host.appendChild(dd);
    let list = [], hl = 0;
    const close = () => { dd.classList.add('hidden'); list = []; };
    const isOpen = () => !dd.classList.contains('hidden');
    function draw() {
      const q = input.value;
      if (q.trim().length < (opt.min || 0)) { close(); return; }
      list = opt.items(q) || [];
      if (!list.length && !opt.empty) { close(); return; }
      hl = 0;
      dd.innerHTML = (opt.head ? `<div class="dd-h">${opt.head(q)}</div>` : '') + (list.length ? list.map((x, i) => `<button type="button" class="dd-i ${i === 0 ? 'hl' : ''} ${x.cls || ''}" data-i="${i}" role="option">${x.html}</button>`).join('') : `<div class="dd-empty">${opt.empty(q)}</div>`);
      dd.classList.remove('hidden');
      $$('[data-i]', dd).forEach(b => {
        b.onmousedown = e => e.preventDefault();
        b.onclick = () => { const x = list[+b.dataset.i]; close(); x.pick(); };
      });
    }
    const mark = () => $$('[data-i]', dd).forEach((b, i) => { b.classList.toggle('hl', i === hl); if (i === hl) b.scrollIntoView({ block: 'nearest' }); });
    input.addEventListener('input', draw);
    input.addEventListener('focus', () => { if (!(opt.min > 0) || input.value.trim()) draw(); });
    input.addEventListener('blur', () => setTimeout(close, 150));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen()) { draw(); return; }
        if (!list.length) return;
        hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length; mark();
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        if (opt.beforeEnter && opt.beforeEnter(input.value)) { e.preventDefault(); e.handled = true; close(); return; }
        if (isOpen() && list[hl]) { e.preventDefault(); e.handled = true; const x = list[hl]; close(); x.pick(); }
      } else if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); }
    });
    return { refresh: draw, close, isOpen, el: dd };
  }

  // ---------- thanh phân loại: Tất cả / Thuốc / TPCN / Vật tư / Khác ----------
  /**
   * catBar(el, { cat, counts(): {'':n, otc:n, …}, onCat(cat) })
   * Trả về { set(cat), refresh(), cat }. Dùng chung cho Bán hàng và Danh mục hàng.
   */
  function catBar(el, opt) {
    const CAT = VM.store.CATEGORIES;
    let cat = opt.cat || '';
    el.classList.add('cat-bar');
    const tabs = [['', 'Tất cả', 'layers'], ...Object.entries(CAT).map(([k, v]) => [k, v.tab, v.icon])];
    function draw() {
      const c = opt.counts();
      el.innerHTML = `<div class="cat-tabs" role="tablist" aria-label="Phân loại hàng">${tabs.map(([k, label, ic]) => `<button type="button" role="tab" class="cat-tab ${k || 'all'} ${cat === k ? 'active' : ''}" data-cat="${k}" aria-selected="${cat === k}" title="${esc(k ? CAT[k].label : 'Mọi nhóm hàng')}">${icon(ic, 's')}<span>${esc(label)}</span><span class="cnt">${c[k] || 0}</span></button>`).join('')}</div>`;
      $$('[data-cat]', el).forEach(b => b.onclick = () => { const k = b.dataset.cat; set(k && k === cat ? '' : k); opt.onCat && opt.onCat(cat); });
    }
    function set(k) { cat = k || ''; $$('[data-cat]', el).forEach(b => { const on = b.dataset.cat === cat; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); }); }
    draw();
    return { set, refresh: draw, get cat() { return cat; } };
  }

  // ---------- toast ----------
  function toast(msg, type = 'ok', ms = 3200, action) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const ic = type === 'bad' ? 'alert' : type === 'warn' ? 'info' : 'checkc';
    el.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>${action ? `<button class="t-act">${esc(action.label)}</button>` : ''}`;
    if (action) el.querySelector('.t-act').onclick = () => { action.fn(); el.remove(); };
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // ---------- thông báo hoàn thành ----------
  // Hiện rõ ở giữa phía trên màn hình sau mỗi thao tác xong (gạch sổ, lưu, thanh toán…). Không chặn thao tác tiếp theo.
  let doneEl = null, doneT = 0;
  function done(title, sub = '', opt = {}) {
    clearTimeout(doneT);
    if (doneEl) doneEl.remove();
    const el = document.createElement('div');
    el.className = 'done-pop';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'assertive');
    el.innerHTML = `<div class="done-card"><span class="done-ic">${icon('check')}</span><div class="done-t"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${opt.action ? `<button type="button" class="btn sm" data-a>${esc(opt.action.label)}</button>` : ''}<button type="button" class="done-x" aria-label="Đóng thông báo">${icon('x', 's')}</button></div>`;
    document.body.appendChild(el); doneEl = el;
    const hide = () => { clearTimeout(doneT); el.classList.add('out'); setTimeout(() => el.remove(), 220); if (doneEl === el) doneEl = null; };
    el.querySelector('.done-x').onclick = hide;
    if (opt.action) el.querySelector('[data-a]').onclick = () => { hide(); opt.action.fn(); };
    doneT = setTimeout(hide, opt.ms || (opt.action ? 5000 : 2600));
    return hide;
  }

  // ---------- modal ----------
  const stack = [];
  function modal({ title, sub = '', ic, icCls = '', size = '', body = '', foot = '', onMount, dismissable = true, onClose }) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h">${ic ? `<div class="modal-ic ${icCls}">${icon(ic)}</div>` : ''}<div><h3>${esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}</div>
      <button class="btn ghost icon sm close" aria-label="Đóng">${icon('x')}</button></div>
      <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
    $('#modalRoot').appendChild(ov);
    const prevFocus = document.activeElement;
    const close = (val) => {
      if (!ov.isConnected) return;
      ov.remove(); stack.splice(stack.indexOf(api), 1);
      if (onClose) onClose(val);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (_) { }
    };
    const api = { el: ov, close, dismissable };
    stack.push(api);
    ov.querySelector('.close').onclick = () => close();
    ov.addEventListener('mousedown', e => { if (e.target === ov && dismissable) close(); });
    bindUnitPick(ov);
    if (onMount) onMount(ov, close);
    setTimeout(() => { const f = ov.querySelector('[autofocus]') || ov.querySelector('.modal-b input:not([type=hidden]):not([readonly]),.modal-b select,.modal-b textarea') || ov.querySelector('.modal-f .btn.primary'); f && f.focus(); }, 30);
    return api;
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) { const top = stack[stack.length - 1]; if (top.dismissable) top.close(); } });

  function confirm({ title, message = '', ok = 'Xác nhận', danger = false, ic, input = null }) {
    return new Promise(resolve => {
      let done = false;
      const inputHtml = input ? `<div class="field" style="margin-top:14px"><label>${esc(input.label)}${input.required ? ' <span class="req">*</span>' : ''}</label>
        ${input.options ? `<select class="select" id="cfIn">${input.options.map(o => `<option>${esc(o)}</option>`).join('')}</select>` : `<input class="input" id="cfIn" placeholder="${esc(input.placeholder || '')}" value="${esc(input.value || '')}">`}
        <span class="err hidden" id="cfErr">Vui lòng nhập ${esc(input.label.toLowerCase())}</span></div>` : '';
      const m = modal({
        title, ic: ic || (danger ? 'alert' : 'info'), icCls: danger ? 'bad' : '', body: `<div style="color:var(--ink-2)">${message}</div>${inputHtml}`,
        foot: `<button class="btn" data-x>Hủy</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${esc(ok)}</button>`,
        onClose: () => { if (!done) resolve(false); },
        onMount(el, close) {
          el.querySelector('[data-x]').onclick = () => close();
          const okFn = () => {
            let v = true;
            if (input) { v = el.querySelector('#cfIn').value.trim(); if (input.required && !v) { el.querySelector('#cfErr').classList.remove('hidden'); return; } }
            done = true; close(); resolve(v);
          };
          el.querySelector('[data-ok]').onclick = okFn;
          const inp = el.querySelector('#cfIn'); if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') okFn(); });
        },
      });
    });
  }

  function print(html) {
    $('#printArea').innerHTML = html;
    // Gỡ ngay thông báo hoàn thành (không chờ hiệu ứng mờ) để không lẫn vào bản in
    clearTimeout(doneT);
    if (doneEl) { doneEl.remove(); doneEl = null; }
    setTimeout(() => { window.print(); }, 50);
  }

  const pill = (cls, text, ic) => `<span class="pill ${cls}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
  const empty = (ic, title, text, btn = '') => `<div class="empty"><div class="em-ic">${icon(ic)}</div><b>${esc(title)}</b><div>${text}</div>${btn}</div>`;
  const staffOptions = () => VM.store.state.staff.map(s => `<option value="${esc(s.name)}">`).join('');
  const storeOptions = (sel) => VM.store.state.settings.stores.map(s => `<option value="${esc(s.code)}" ${s.code === sel ? 'selected' : ''}>${esc(s.code)} – ${esc(s.name)}</option>`).join('');

  // ---------- Ô chọn đơn vị tính (dùng chung) ----------
  // Danh sách sổ xuống (mặc định Viên) + "Khác…" để tự gõ. Giá trị thật nằm trong ô <input> đi kèm (attrs: name / id / data-…),
  // nên code đọc form không phải đổi gì. Gọi bindUnitPick(root) sau khi chèn HTML.
  const UNITS = ['Viên', 'Vỉ', 'Hộp', 'Gói', 'Chai', 'Lọ', 'Ống', 'Tuýp', 'Cái', 'Bộ', 'Túi'];
  function unitPick(value, attrs = '', opt = {}) {
    const v = String(value == null ? '' : value).trim();
    const known = UNITS.find(u => u.toLowerCase() === v.toLowerCase());
    const list = v && !known ? [...UNITS, v] : UNITS;
    const cur = known || v;
    return `<div class="unit-pick">
      <select class="select" data-unit-pick aria-label="${esc(opt.label || 'Đơn vị tính')}">${cur ? '' : '<option value="" selected>— Chọn ĐVT —</option>'}${list.map(u => `<option ${u === cur ? 'selected' : ''}>${esc(u)}</option>`).join('')}<option value="__other">Khác (tự gõ)…</option></select>
      <input class="input hidden" ${attrs} value="${esc(cur)}" autocomplete="off" placeholder="Gõ ĐVT, VD: Lốc" aria-label="Đơn vị tính khác">
    </div>`;
  }
  function bindUnitPick(root) {
    root.querySelectorAll('[data-unit-pick]').forEach(sel => {
      if (sel.dataset.bound) return;
      sel.dataset.bound = '1';
      const inp = sel.nextElementSibling, fire = () => { inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); };
      sel.addEventListener('change', () => {
        const other = sel.value === '__other';
        sel.closest('.unit-pick').classList.toggle('other', other);
        inp.classList.toggle('hidden', !other);
        if (other) { inp.value = ''; inp.focus(); } else inp.value = sel.value;
        fire();
      });
    });
  }

  /** Read all [name] fields of a container into an object */
  function formData(root) {
    const o = {};
    root.querySelectorAll('[name]').forEach(el => { o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    return o;
  }

  VM.ui = { register, shell, route, go, rerender, teardown, renderNav, renderMe, renderBackupChip, toast, done, modal, confirm, print, pill, empty, staffOptions, storeOptions, formData, suggest, catBar, unitPick, bindUnitPick, UNITS, get current() { return current; }, modules };
})(window.VM);
