/* App bootstrap: chọn nhân viên vào ca → chọn 1 trong 3 nghiệp vụ → khung ứng dụng; đổi ca / đăng xuất */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money } = VM;
  const LAST = 'vmhub.lastUser', LAST_HOME = 'vmhub.lastHome';
  let started = false, skipHash = false, chooserKey = null;

  function renderLogin() {
    const staff = VM.store.state.staff, last = localStorage.getItem(LAST);
    let sel = staff.find(s => s.id === last) ? last : '';
    document.title = 'Vào ca · Vinmec Pharmacy Hub';
    $('#root').innerHTML = `<div class="login">
      <section class="login-art">
        <div style="display:flex;align-items:center;gap:12px;position:relative;z-index:1"><div class="brand-mark" style="background:rgba(255,255,255,.16);color:#fff">${icon('cross')}</div><div><b style="font-size:17px">Pharmacy Hub</b><div style="opacity:.75;font-size:12px;letter-spacing:.08em">VINMEC · KHOA DƯỢC</div></div></div>
        <div style="position:relative;z-index:1">
          <h2>Bán lẻ, sổ vay và sổ hóa đơn – trên một màn hình.</h2>
          <p>Thay sổ giấy và file Excel rời rạc: ghi nhanh, tự cảnh báo, xuất đúng định dạng SAP.</p>
          <div class="feat"><div class="fi">${icon('cart')}</div><div><b>Bán lẻ OTC &amp; vật tư</b><small>Tìm thuốc gõ sai dấu vẫn ra, quét mã, QR thanh toán, in hóa đơn.</small></div></div>
          <div class="feat"><div class="fi">${icon('swap')}</div><div><b>Sổ vay thuốc Nhà thuốc ↔ Kho</b><small>Xác nhận 2 bên, gạch sổ từng phần, file điều chuyển SAP.</small></div></div>
          <div class="feat"><div class="fi">${icon('file')}</div><div><b>Sổ hóa đơn OPD / IPD</b><small>Theo dõi hàng về → bàn giao NVD → nhập hệ thống, cảnh báo trùng HĐ.</small></div></div>
        </div>
        <div style="opacity:.75;font-size:12.5px;position:relative;z-index:1;display:flex;gap:8px;align-items:center">${icon('shield', 's')} Dữ liệu lưu trên máy này · tự tạo điểm khôi phục · chạy cả khi mất mạng</div>
      </section>
      <section class="login-form"><div class="login-card">
        <h1>Bắt đầu ca làm việc</h1>
        <p class="muted" style="margin:0">Chọn tên của bạn. Mọi thao tác sẽ được ghi nhận theo người dùng.</p>
        <div class="staff-pick" id="lgPick">${staff.map(s => `<button type="button" data-id="${esc(s.id)}" class="${s.id === sel ? 'sel' : ''}"><span class="avatar">${esc(VM.initials(s.name))}</span><span style="flex:1"><b>${esc(s.name)}</b><br><small class="muted">${esc(s.role)} · ${esc(s.store)}${s.admin ? ' · Quản lý' : ''}</small></span><span class="pk" style="color:var(--primary)"></span></button>`).join('')}</div>
        <div class="or">hoặc nhập tên (nhân viên mới / thực tập)</div>
        <input class="input" id="lgName" placeholder="Họ và tên" autocomplete="name">
        <button class="btn primary xl block" id="lgGo" style="margin-top:16px" ${sel ? '' : 'disabled'}>${icon('arrowr')} Vào ca</button>
        <p class="muted small" style="text-align:center;margin-top:14px">Phiên bản thử nghiệm (Phase 1) · Mở bằng Chrome / Edge để dùng đầy đủ tính năng</p>
      </div></section></div>`;
    const sync = () => {
      $$('#lgPick [data-id]').forEach(b => { const on = b.dataset.id === sel; b.classList.toggle('sel', on); b.querySelector('.pk').innerHTML = on ? icon('checkc') : ''; });
      $('#lgGo').disabled = !sel && !$('#lgName').value.trim();
    };
    $$('#lgPick [data-id]').forEach(b => {
      b.onclick = () => { sel = b.dataset.id; $('#lgName').value = ''; sync(); };
      b.ondblclick = () => { sel = b.dataset.id; login(); };
    });
    $('#lgName').oninput = () => { if ($('#lgName').value.trim()) sel = ''; sync(); };
    $('#lgName').onkeydown = e => { if (e.key === 'Enter' && !$('#lgGo').disabled) login(); };
    $('#lgGo').onclick = login;
    sync();
    setTimeout(() => { const f = $('#lgPick .sel') || $('#lgPick button') || $('#lgName'); if (f) f.focus(); }, 30);

    function login() {
      let u;
      if (sel) { const s = staff.find(x => x.id === sel); u = { id: s.id, name: s.name, role: s.role, store: s.store, admin: !!s.admin }; }
      else { const name = $('#lgName').value.trim(); if (!name) return; u = { id: 'TMP-' + VM.normalize(name).replace(/[^a-z0-9]/g, '').slice(0, 10).toUpperCase(), name, role: 'Nhân viên (chưa có trong danh sách)', store: 'Y001', admin: false }; }
      u.loginAt = VM.iso();
      VM.store.setUser(u);
      localStorage.setItem(LAST, u.id);
      VM.store.log('Vào ca', 'Phiên làm việc', u.role);
      VM.store.save('login');
      renderChooser();
    }
  }

  // Sau khi vào ca: chọn 1 trong 3 nghiệp vụ rồi mới hiện màn hình chính của nghiệp vụ đó
  function renderChooser() {
    const u = VM.store.currentUser(), S = VM.store.state;
    if (!u) return renderLogin();
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
    document.title = 'Chọn nghiệp vụ · Vinmec Pharmacy Hub';
    $('#root').innerHTML = `<div class="chooser">
      <header class="ch-top">
        <div class="ch-brand"><div class="brand-mark">${icon('cross')}</div><div><b>Pharmacy Hub</b><small>VINMEC · KHOA DƯỢC</small></div></div>
        <div class="ch-me"><span class="avatar">${esc(VM.initials(u.name))}</span><div class="ch-me-t"><b>${esc(u.name)}</b><small>${esc(u.role || '')}</small></div>
          <button class="btn ghost sm" id="chBack" title="Chọn lại người vào ca">${icon('logout', 's')} Đổi người</button></div>
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
    const unbind = () => { if (chooserKey) document.removeEventListener('keydown', chooserKey); chooserKey = null; };
    const choose = home => {
      unbind();
      if (home !== 'dashboard') localStorage.setItem(LAST_HOME, home);
      start(home);
    };
    $$('#root [data-home]').forEach(b => b.onclick = () => choose(b.dataset.home));
    $('#chBack').onclick = () => { unbind(); VM.store.setUser(null); renderLogin(); };
    unbind();
    chooserKey = e => { const c = cards[+e.key - 1]; if (c && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); choose(c.home); } };
    document.addEventListener('keydown', chooserKey);
    setTimeout(() => { const c = $('#root .ch-card.last') || $('#root .ch-card'); if (c) c.focus(); }, 30);
  }

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
        <label class="check"><input type="checkbox" id="loBk" ${bk.level !== 'ok' ? 'checked' : ''}> Tải bản sao lưu trước khi kết thúc ca</label>`,
      foot: `<button class="btn" data-x>Ở lại</button><button class="btn primary" data-ok>${icon('logout', 's')} Kết thúc ca</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = async () => {
          if (el.querySelector('#loBk').checked) VM.backup.downloadFile();
          VM.store.log('Kết thúc ca', 'Phiên làm việc', `${mine.length} đơn · ${VM.sum(mine, s => s.total)} đ`);
          VM.store.save('logout');
          await VM.backup.snapshot('Kết thúc ca');
          close();
          VM.ui.teardown();
          if (VM.tour) VM.tour.clearSession();
          VM.store.setUser(null);
          $('#modalRoot').innerHTML = '';
          renderLogin();
        };
      },
    });
  }

  VM.app = { logout, start, chooser: renderChooser };
  if (VM.store.currentUser()) start(); else renderLogin();
})(window.VM);
