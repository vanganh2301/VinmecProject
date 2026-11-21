/* App bootstrap: mã cơ sở → đăng nhập (máy chủ kiểm tra mật khẩu) → chọn 1 trong 3 nghiệp vụ → khung ứng dụng; kết thúc ca / đăng xuất */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money } = VM;
  const LAST = 'vmhub.lastUser', LAST_HOME = 'vmhub.lastHome';
  let started = false, skipHash = false, chooserKey = null;

  // ---------- Đăng nhập: 1) mã cơ sở → 2) tên đăng nhập + mật khẩu → 3) đổi mật khẩu tạm (lần đầu / sau khi đặt lại) ----------
  // Mật khẩu chỉ được máy chủ kiểm tra (api/auth). Không có đăng ký tự do: tài khoản do Trưởng khoa cấp (npm run users).
  function gate(card) {
    $('#root').innerHTML = `<div class="login">
      <section class="login-art">
        <div style="display:flex;align-items:center;gap:12px;position:relative;z-index:1"><div class="brand-mark"><img src="assets/img/logo-mark.png" alt=""></div><b style="font-size:17px">V-Pharma Hub</b></div>
        <div style="position:relative;z-index:1">
          <h2>Bán lẻ, sổ vay và sổ hóa đơn – trên một màn hình.</h2>
          <p>Thay sổ giấy và file Excel rời rạc: ghi nhanh, tự cảnh báo, xuất đúng định dạng SAP.</p>
          <div class="feat"><div class="fi">${icon('cart')}</div><div><b>Bán lẻ OTC &amp; vật tư</b><small>Tìm thuốc gõ sai dấu vẫn ra, quét mã, QR thanh toán, in hóa đơn.</small></div></div>
          <div class="feat"><div class="fi">${icon('swap')}</div><div><b>Sổ vay thuốc Nhà thuốc ↔ Kho</b><small>Xác nhận 2 bên, gạch sổ từng phần, file điều chuyển SAP.</small></div></div>
          <div class="feat"><div class="fi">${icon('file')}</div><div><b>Sổ hóa đơn OPD / IPD</b><small>Theo dõi hàng về → bàn giao NVD → nhập hệ thống, cảnh báo trùng HĐ.</small></div></div>
        </div>
        <div style="opacity:.75;font-size:12.5px;position:relative;z-index:1;display:flex;gap:8px;align-items:center">${icon('shield', 's')} Chỉ dược sĩ có tài khoản mới vào được · mật khẩu kiểm tra trên máy chủ</div>
      </section>
      <section class="login-form"><div class="login-card" id="lgCard">${card}</div></section></div>`;
    return $('#lgCard');
  }
  const note = (msg, tone = 'warn') => msg ? `<div class="alert ${tone}" style="margin-top:14px">${icon(tone === 'bad' ? 'alert' : 'info', 's')}<span>${esc(msg)}</span></div>` : '';
  const pwField = (id, label, auto) => `<div class="field"><label for="${id}">${label}</label><div class="pw-wrap"><input class="input" id="${id}" type="password" autocomplete="${auto}" maxlength="128"><button type="button" class="btn ghost icon sm pw-eye" data-eye="${id}" aria-label="Hiện mật khẩu" title="Hiện / ẩn mật khẩu">${icon('eye', 's')}</button></div></div>`;
  function bindEyes(el) {
    el.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = el.querySelector('#' + b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; i.focus(); });
  }
  function bindForm(el, onSubmit) {
    const err = el.querySelector('#lgErr'), go = el.querySelector('#lgGo'), label = go.innerHTML;
    bindEyes(el);
    el.querySelectorAll('input[type=password]').forEach(i => i.onkeyup = e => { const c = el.querySelector('#lgCaps'); if (c && e.getModifierState) c.hidden = !e.getModifierState('CapsLock'); });
    const show = m => { err.innerHTML = m ? `${icon('alert', 's')}<span>${esc(m)}</span>` : ''; err.classList.toggle('hidden', !m); };
    el.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      if (go.disabled) return;
      show('');
      go.disabled = true; go.innerHTML = `${icon('clock')} Đang kiểm tra…`;
      try { await onSubmit(show); } finally { if (go.isConnected) { go.disabled = false; go.innerHTML = label; } }
    };
    return show;
  }

  function startLogin(msg) { renderFacility(msg); }

  function renderFacility(msg) {
    const last = VM.auth.lastFacility();
    document.title = 'Mã cơ sở · V-Pharma Hub';
    const el = gate(`<div class="lg-step">Bước 1 / 2</div>
      <h1>Mã cơ sở</h1>
      <p class="muted" style="margin:0">Nhập mã cơ sở Vinmec nơi bạn làm việc để vào đúng dữ liệu của cơ sở đó. Mã do Trưởng khoa cung cấp.</p>
      ${note(msg)}
      <form novalidate>
        <div class="field"><label for="lgFac">Mã cơ sở</label><input class="input lg-code" id="lgFac" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32" value="${esc(last ? last.code : '')}" placeholder="VD: OCP2"></div>
        <div class="alert bad hidden" id="lgErr" role="alert"></div>
        <button class="btn primary xl block" id="lgGo" type="submit">${icon('arrowr')} Tiếp tục</button>
      </form>`);
    const inp = el.querySelector('#lgFac');
    bindForm(el, async show => {
      const code = inp.value.trim();
      if (!code) { show('Nhập mã cơ sở.'); inp.focus(); return; }
      const r = await VM.auth.facility(code);
      if (r.noServer) return renderNoServer();
      if (r.status !== 200) { show(r.error); inp.select(); return; }
      const f = r.data.facility;
      if (!f.enabled) { show(`${f.name} chưa được đưa vào sử dụng trên hệ thống (chưa có dữ liệu của cơ sở). Liên hệ Khoa Dược để biết lịch triển khai.`); inp.select(); return; }
      VM.auth.rememberFacility(f);
      renderLogin(f);
    });
    setTimeout(() => { if (inp.isConnected) { inp.focus(); inp.select(); } }, 30);
  }

  function renderLogin(f, msg) {
    document.title = 'Đăng nhập · V-Pharma Hub';
    const last = localStorage.getItem(LAST) || '';
    const el = gate(`<div class="lg-step">Bước 2 / 2</div>
      <div class="lg-fac">${icon('cross', 's')}<span><b>${esc(f.name)}</b><small>Mã cơ sở <span class="mono">${esc(f.code)}</span></small></span><button type="button" class="linkbtn" id="lgChange">Đổi cơ sở</button></div>
      <h1>Đăng nhập</h1>
      <p class="muted" style="margin:0">Dùng tài khoản dược sĩ do Trưởng khoa cấp. Mọi thao tác được ghi nhận theo tài khoản.</p>
      ${note(msg)}
      <form novalidate>
        <div class="field"><label for="lgUser">Tên đăng nhập</label><input class="input" id="lgUser" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" value="${esc(last)}" placeholder="Mã nhân viên, VD: DS01"></div>
        ${pwField('lgPw', 'Mật khẩu', 'current-password')}
        <span class="hint lg-caps" id="lgCaps" hidden>${icon('alert', 's')} Đang bật Caps Lock</span>
        <div class="alert bad hidden" id="lgErr" role="alert"></div>
        <button class="btn primary xl block" id="lgGo" type="submit">${icon('arrowr')} Đăng nhập</button>
      </form>
      <p class="muted small" style="text-align:center;margin-top:14px">Quên mật khẩu hoặc tài khoản bị khóa: nhờ Trưởng khoa đặt lại.</p>`);
    const user = el.querySelector('#lgUser'), pw = el.querySelector('#lgPw');
    el.querySelector('#lgChange').onclick = () => renderFacility();
    bindForm(el, async show => {
      if (!user.value.trim()) { show('Nhập tên đăng nhập.'); user.focus(); return; }
      if (!pw.value) { show('Nhập mật khẩu.'); pw.focus(); return; }
      const password = pw.value;
      const r = await VM.auth.login(f.code, user.value.trim(), password);
      if (r.noServer) return renderNoServer();
      if (r.status !== 200 || !r.data || !r.data.user) { show(r.error); pw.value = ''; pw.focus(); return; }
      localStorage.setItem(LAST, r.data.user.username);
      enter(r.data.user, false, password);
    });
    setTimeout(() => { const t = last ? pw : user; if (t.isConnected) t.focus(); }, 30);
  }

  // Bắt buộc đổi mật khẩu tạm. current: mật khẩu vừa gõ ở bước đăng nhập (không cần gõ lại); trống nếu tải lại trang giữa chừng
  function renderPassword(user, current) {
    document.title = 'Đặt mật khẩu mới · V-Pharma Hub';
    const el = gate(`<div class="lg-fac">${icon('user', 's')}<span><b>${esc(user.name)}</b><small>${esc(user.facilityName || user.facility)} · ${esc(user.username)}</small></span><button type="button" class="linkbtn" id="lgOut">Đăng xuất</button></div>
      <h1>Đặt mật khẩu mới</h1>
      <p class="muted" style="margin:0">Bạn đang dùng mật khẩu tạm do Trưởng khoa cấp. Hãy đặt mật khẩu riêng – chỉ bạn biết, không chia sẻ cho người khác.</p>
      <form novalidate>
        ${current ? '' : pwField('pwCur', 'Mật khẩu tạm', 'current-password')}
        ${pwField('pwNew', 'Mật khẩu mới', 'new-password')}
        ${pwField('pwNew2', 'Nhập lại mật khẩu mới', 'new-password')}
        <span class="hint">Ít nhất 8 ký tự, có cả chữ và số, không chứa tên đăng nhập.</span>
        <span class="hint lg-caps" id="lgCaps" hidden>${icon('alert', 's')} Đang bật Caps Lock</span>
        <div class="alert bad hidden" id="lgErr" role="alert"></div>
        <button class="btn primary xl block" id="lgGo" type="submit">${icon('check')} Lưu mật khẩu và vào ca</button>
      </form>`);
    el.querySelector('#lgOut').onclick = async () => { await VM.auth.logout(); VM.store.setUser(null); startLogin(); };
    bindForm(el, async show => {
      const cur = current || el.querySelector('#pwCur').value, n1 = el.querySelector('#pwNew').value, n2 = el.querySelector('#pwNew2').value;
      if (!cur) { show('Nhập mật khẩu tạm.'); return; }
      const why = VM.auth.passwordProblem(n1, user.username);
      if (why) { show(why); el.querySelector('#pwNew').focus(); return; }
      if (n1 !== n2) { show('Hai lần nhập mật khẩu mới không khớp.'); el.querySelector('#pwNew2').select(); return; }
      if (n1 === cur) { show('Mật khẩu mới phải khác mật khẩu tạm.'); return; }
      const r = await VM.auth.changePassword(cur, n1);
      if (r.status === 401 && current) { VM.store.setUser(null); return startLogin('Phiên đăng nhập đã hết hạn – đăng nhập lại bằng mật khẩu tạm.'); }
      if (r.status !== 200 || !r.data) { show(r.error); return; }
      enter(r.data.user, false);
    });
    setTimeout(() => { const t = el.querySelector(current ? '#pwNew' : '#pwCur'); if (t) t.focus(); }, 30);
  }

  function renderNoServer() {
    document.title = 'Cần máy chủ · V-Pharma Hub';
    const el = gate(`<h1>Cần mở app qua máy chủ</h1>
      <p class="muted">App đã có đăng nhập bằng mật khẩu, mật khẩu được kiểm tra trên máy chủ. Cách mở hiện tại (mở thẳng file / <span class="mono">serve.py</span>) chỉ là trang tĩnh, không có máy chủ nên không đăng nhập được.</p>
      <div class="alert info">${icon('info', 's')}<div>Mở lại bằng một trong các cách:<br>• nhấp đúp <b>chay.bat</b> trong thư mục app (cần Node.js);<br>• hoặc chạy <span class="mono">npm run dev</span>;<br>• hoặc dùng bản trên Vercel.</div></div>
      <button class="btn primary xl block" id="lgRetry" style="margin-top:16px">${icon('refresh')} Thử lại</button>`);
    el.querySelector('#lgRetry').onclick = boot;
  }
  function renderError(msg) {
    const el = gate(`<h1>Chưa kết nối được máy chủ</h1>
      ${note(msg || 'Không kết nối được máy chủ.', 'bad')}
      <p class="muted">Kiểm tra mạng (Wi-Fi / 4G) rồi bấm Thử lại. Dữ liệu trên máy này vẫn còn nguyên.</p>
      <button class="btn primary xl block" id="lgRetry" style="margin-top:16px">${icon('refresh')} Thử lại</button>`);
    el.querySelector('#lgRetry').onclick = boot;
  }

  /** Đã đăng nhập (máy chủ xác nhận). resume = tải lại trang khi đang trong ca → vào thẳng màn đang dùng */
  function enter(user, resume, password) {
    if (user.mustChange) return renderPassword(user, password || '');
    const prev = VM.store.currentUser(), u = VM.auth.toLocal(user);
    const same = !!(prev && prev.id === u.id && prev.facility === u.facility);
    if (resume && same && prev.loginAt) u.loginAt = prev.loginAt;
    VM.store.setUser(u);
    if (!(resume && same)) { VM.store.log('Vào ca', 'Phiên làm việc', `${u.role} · ${u.facilityName}`); VM.store.save('login'); }
    VM.drugs.start();
    if (resume && same) start(); else renderChooser();
  }

  async function boot() {
    gate(`<div class="lg-wait">${icon('clock')} Đang kiểm tra đăng nhập…</div>`);
    const r = await VM.auth.me();
    if (r.status === 200 && r.data && r.data.user) return enter(r.data.user, true);
    VM.store.setUser(null);
    if (r.noServer) return renderNoServer();
    if (r.status === 401) return startLogin();
    renderError(r.error);
  }

  // Phiên hết hạn / bị đăng xuất từ máy chủ (đổi mật khẩu, bị khóa) / đăng xuất ở tab khác → về màn đăng nhập, dữ liệu trên máy giữ nguyên
  function kickOut(msg) {
    if (!VM.store.currentUser() && !$('#app') && !$('.chooser')) return;
    unbindChooser();
    VM.ui.teardown();
    if (VM.tour) VM.tour.clearSession();
    VM.store.setUser(null);
    $('#modalRoot').innerHTML = '';
    startLogin(msg);
  }
  VM.auth.onExpired(() => kickOut('Phiên đăng nhập đã hết hạn hoặc tài khoản vừa được đổi mật khẩu / khóa. Đăng nhập lại để tiếp tục – dữ liệu trên máy vẫn còn.'));
  window.addEventListener('storage', e => { if (e.key === 'vmhub.session' && !e.newValue && ($('#app') || $('.chooser'))) kickOut('Bạn vừa kết thúc ca ở một tab khác.'); });

  function changePassword() {
    const u = VM.store.currentUser() || {};
    VM.ui.modal({
      title: 'Đổi mật khẩu', sub: `${esc(u.name)} · ${esc(u.username || '')}`, ic: 'shield',
      body: `<div class="cp-grid">${pwField('cpCur', 'Mật khẩu hiện tại', 'current-password')}${pwField('cpNew', 'Mật khẩu mới', 'new-password')}${pwField('cpNew2', 'Nhập lại mật khẩu mới', 'new-password')}
        <span class="hint">Ít nhất 8 ký tự, có cả chữ và số. Sau khi đổi, các máy khác đang đăng nhập tài khoản này sẽ bị đăng xuất.</span></div>
        <div class="alert bad hidden" id="cpErr" style="margin-top:12px"></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('check', 's')} Đổi mật khẩu</button>`,
      onMount(el, close) {
        const v = id => el.querySelector('#' + id).value, err = el.querySelector('#cpErr');
        const show = m => { err.innerHTML = `${icon('alert', 's')}<span>${esc(m)}</span>`; err.classList.toggle('hidden', !m); };
        bindEyes(el);
        el.querySelector('[data-x]').onclick = () => close();
        const ok = el.querySelector('[data-ok]');
        ok.onclick = async () => {
          const why = !v('cpCur') ? 'Nhập mật khẩu hiện tại.' : VM.auth.passwordProblem(v('cpNew'), u.username) || (v('cpNew') !== v('cpNew2') ? 'Hai lần nhập mật khẩu mới không khớp.' : '');
          if (why) return show(why);
          ok.disabled = true;
          const r = await VM.auth.changePassword(v('cpCur'), v('cpNew'));
          ok.disabled = false;
          if (r.status !== 200) return show(r.error);
          VM.store.log('Đổi mật khẩu', 'Phiên làm việc'); VM.store.save('password');
          close(); VM.ui.done('Đã đổi mật khẩu', 'Lần đăng nhập sau dùng mật khẩu mới');
        };
        el.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') ok.click(); });
        setTimeout(() => el.querySelector('#cpCur').focus(), 30);
      },
    });
  }

  // Sau khi vào ca: chọn 1 trong 3 nghiệp vụ rồi mới hiện màn hình chính của nghiệp vụ đó
  function renderChooser() {
    const u = VM.store.currentUser(), S = VM.store.state;
    if (!u) return startLogin();
    const last = localStorage.getItem(LAST_HOME) || '';
    const today = VM.ymd();
    const sales = S.sales.filter(x => x.status !== 'cancelled' && VM.ymd(x.createdAt) === today);
    const openLoans = VM.store.loanVouchers().filter(VM.store.voucherOpen);
    const odLoans = openLoans.filter(v => v.overdue).length;
    const pendInv = S.invoices.filter(i => ['no_invoice', 'received', 'handed'].includes(i.status));
    const noInv = pendInv.filter(i => i.status === 'no_invoice').length;
    const cards = [
      { home: 'pos', ic: 'cart', tone: 'otc', title: 'Bán lẻ', desc: 'Thuốc OTC, thực phẩm chức năng, vật tư y tế. Quét mã, thanh toán QR, in hóa đơn.', stat: `${sales.length} đơn hôm nay`, warn: '' },
      { home: 'loans', ic: 'swap', tone: 'info', title: 'Sổ vay thuốc', desc: 'Tạo mã vay nhiều thuốc một lần giữa Nhà thuốc Y001 và Kho nội trú Y003. Gạch sổ, file điều chuyển SAP.', stat: `${openLoans.length} mã vay chưa gạch`, warn: odLoans ? `${odLoans} quá hạn` : '' },
      { home: 'invoices', ic: 'file', tone: 'device', title: 'Sổ hóa đơn', desc: 'Ngoại trú / nội trú: hàng về → nhận HĐ → bàn giao NVD → nhập hệ thống.', stat: `${pendInv.length} hóa đơn chưa xong`, warn: noInv ? `${noInv} chưa có HĐ` : '' },
    ];
    document.title = 'Chọn nghiệp vụ · V-Pharma Hub';
    $('#root').innerHTML = `<div class="chooser">
      <header class="ch-top">
        <div class="ch-brand"><div class="brand-mark"><img src="assets/img/logo-mark.png" alt=""></div><div><b>V-Pharma Hub</b><small>VINMEC · KHOA DƯỢC</small></div></div>
        <div class="ch-me"><span class="avatar">${esc(VM.initials(u.name))}</span><div class="ch-me-t"><b>${esc(u.name)}</b><small>${esc(u.role || '')}${u.facilityName ? ' · ' + esc(u.facilityName) : ''}</small></div>
          <button class="btn ghost sm" id="chBack" title="Đăng xuất để người khác đăng nhập">${icon('logout', 's')} Đăng xuất</button></div>
      </header>
      <main class="ch-main">
        <h1>Xin chào, ${esc(u.name)}</h1>
        <p class="muted">Hôm nay bạn làm nghiệp vụ nào? Chọn một để vào màn hình chính. Bạn có thể chuyển nghiệp vụ bất cứ lúc nào bằng thanh điều hướng.</p>
        <div class="ch-grid" role="list">
          ${cards.map((c, k) => `<button type="button" class="ch-card ${c.home === last ? 'last' : ''}" data-home="${c.home}" style="--i:${k}" role="listitem">
            <span class="ch-top-row"><span class="ch-ic ${c.tone}">${icon(c.ic, 'l')}</span>${c.home === last ? '<span class="ch-last">Lần trước</span>' : ''}<kbd class="ch-key" title="Phím tắt">${k + 1}</kbd></span>
            <b>${c.title}</b><small>${c.desc}</small>
            <span class="ch-stat"><span>${c.stat}</span>${c.warn ? VM.ui.pill('bad', c.warn, 'alert') : ''}</span>
            <span class="ch-go">Vào ${c.title.toLowerCase()} ${icon('arrowr', 's')}</span></button>`).join('')}
        </div>
        <p class="muted small ch-more">Bấm phím <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> để chọn nhanh · hoặc mở <button type="button" class="linkbtn" data-home="dashboard">Tổng quan</button></p>
      </main></div>`;
    const unbind = unbindChooser;
    const choose = home => {
      unbind();
      if (home !== 'dashboard') localStorage.setItem(LAST_HOME, home);
      start(home);
    };
    $$('#root [data-home]').forEach(b => b.onclick = () => choose(b.dataset.home));
    $('#chBack').onclick = async () => { unbind(); await VM.auth.logout(); VM.store.setUser(null); startLogin(); };
    unbind();
    chooserKey = e => { const c = cards[+e.key - 1]; if (c && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); choose(c.home); } };
    document.addEventListener('keydown', chooserKey);
    setTimeout(() => { const c = $('#root .ch-card.last') || $('#root .ch-card'); if (c) c.focus(); }, 30);
  }

  function unbindChooser() { if (chooserKey) document.removeEventListener('keydown', chooserKey); chooserKey = null; }

  // Đổi hash không gây vẽ lại 2 lần (replaceState lỗi khi trang có <base> → dùng location.hash và bỏ qua 1 lần hashchange)
  function setHash(h) {
    if (location.hash === h) return;
    try { history.replaceState(null, '', location.pathname + location.search + h); } catch (_) { }
    if (location.hash !== h) { skipHash = true; location.hash = h; }
  }

  function start(home) {
    if (home) setHash('#/' + home);
    VM.ui.shell();
    if (started) { VM.ui.route(); return; }
    started = true;
    if (!/^#\/[\w-]+/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search + '#/pos'); } catch (_) { } }
    VM.ui.route();
    window.addEventListener('hashchange', () => { if (skipHash) { skipHash = false; return; } if (VM.store.currentUser() && $('#app')) VM.ui.route(); });
    VM.backup.onChange(() => VM.ui.renderBackupChip());
    VM.store.onChange(reason => {
      if (!VM.store.currentUser() || !$('#app')) return;
      if (reason === 'external' || reason === 'restore') {
        if ($('#modalRoot').children.length && reason === 'external') VM.ui.toast('Dữ liệu vừa được cập nhật ở tab khác', 'warn', 6000, { label: 'Tải lại', fn: () => { $('#modalRoot').innerHTML = ''; VM.ui.rerender(); } });
        else { $('#modalRoot').innerHTML = ''; VM.ui.renderMe(); VM.ui.rerender(); }
      } else VM.ui.renderNav();
      VM.ui.renderBackupChip();
    });
    VM.backup.init();
    // Refresh badges & relative times every minute (overdue loans appear without reload)
    setInterval(() => { if (VM.store.currentUser() && $('#rail')) VM.ui.renderNav(); }, 60e3);
  }

  function logout() {
    const u = VM.store.currentUser() || {};
    const today = VM.ymd();
    const mine = VM.store.state.sales.filter(s => s.sellerId === u.id && s.status !== 'cancelled' && VM.ymd(s.createdAt) === today && s.createdAt >= (u.loginAt || ''));
    let cart = 0; try { cart = (JSON.parse(localStorage.getItem('vmhub.draft.' + u.id) || 'null') || { items: [] }).items.length; } catch (_) { }
    const bk = VM.backup.status();
    VM.ui.modal({
      title: 'Kết thúc ca / đổi người', sub: `${esc(u.name)} · vào ca ${VM.fmtTime(u.loginAt) || ''}`, ic: 'logout',
      body: `<div class="kpis" style="grid-template-columns:1fr 1fr;margin:0 0 14px">
          <div class="card kpi"><div class="kpi-ic">${icon('receipt')}</div><div><span>Đơn trong ca</span><strong>${mine.length}</strong></div></div>
          <div class="card kpi"><div class="kpi-ic info">${icon('cash')}</div><div><span>Doanh thu ca</span><strong style="font-size:18px">${money(VM.sum(mine, s => s.total))}</strong></div></div></div>
        <div class="muted small" style="margin-bottom:10px">Tiền mặt ${money(VM.sum(mine.filter(s => s.payment === 'cash'), s => s.total))} · QR ${money(VM.sum(mine.filter(s => s.payment === 'qr'), s => s.total))}</div>
        ${cart ? `<div class="alert warn">${icon('cart', 's')}<span>Giỏ hàng đang có <b>${cart}</b> mặt hàng chưa thanh toán – sẽ được giữ lại cho lần đăng nhập sau của bạn.</span></div>` : ''}
        <label class="check"><input type="checkbox" id="loBk"> Tải bản sao lưu trước khi kết thúc ca</label>`,
      foot: `<button class="btn ghost" data-pw style="margin-right:auto">${icon('shield', 's')} Đổi mật khẩu</button><button class="btn" data-x>Ở lại</button><button class="btn primary" data-ok>${icon('logout', 's')} Kết thúc ca</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-pw]').onclick = () => { close(); setTimeout(changePassword, 0); };
        el.querySelector('[data-ok]').onclick = async () => {
          if (el.querySelector('#loBk').checked) VM.backup.downloadFile();
          VM.store.log('Kết thúc ca', 'Phiên làm việc', `${mine.length} đơn · ${VM.sum(mine, s => s.total)} đ`);
          VM.store.save('logout');
          await VM.backup.snapshot('Kết thúc ca');
          close();
          VM.ui.teardown();
          if (VM.tour) VM.tour.clearSession();
          await VM.auth.logout(); // xóa phiên trên máy chủ → cookie trên máy này hết dùng
          VM.store.setUser(null);
          $('#modalRoot').innerHTML = '';
          startLogin();
        };
      },
    });
  }

  VM.app = { logout, start, chooser: renderChooser, changePassword, boot };
  boot();
})(window.VM);
