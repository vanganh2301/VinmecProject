/* Hướng dẫn ban đầu: làm nổi bật từng nút trên màn hình, có "Bỏ qua" và "Không hiện lại lần sau".
   Mỗi module khai báo `tour: () => [{ el, title, text }]` khi register. Lần đầu mở màn đó, hướng dẫn tự chạy.
   - Xong hết các bước  → không tự hiện lại cho màn đó.
   - Bỏ qua             → chỉ ẩn trong phiên này; lần đăng nhập sau sẽ hiện lại.
   - Tick "Không hiện lại lần sau" → tắt hẳn việc tự hiện (vẫn mở lại được bằng nút ? trên thanh tiêu đề).
   Module có nhiều màn con (VD Sổ vay: danh sách / tạo mã vay / chi tiết) khai báo thêm `tourKey: () => 'loans:new'`
   để mỗi màn con được tính "đã xem" riêng. */
'use strict';
(function (VM) {
  const { esc, icon } = VM;
  const key = () => 'vmhub.tour.' + ((VM.store.currentUser() || {}).id || 'guest');
  const skipped = new Set(); // bỏ qua trong phiên này
  function prefs() { try { return Object.assign({ off: false, seen: {} }, JSON.parse(localStorage.getItem(key()) || '{}')); } catch (_) { return { off: false, seen: {} }; } }
  function setPrefs(p) { try { localStorage.setItem(key(), JSON.stringify(p)); } catch (_) { } }

  // Các bước chung của khung ứng dụng – chỉ hiện ở lần hướng dẫn đầu tiên
  const SHELL = () => [
    { el: '#rail', title: '3 nghiệp vụ chính', text: 'Bán lẻ · Sổ vay · Hóa đơn. Bấm để chuyển nghiệp vụ. Số đỏ trên biểu tượng là việc đang chờ xử lý.' },
    { el: '.app.cur-open #curList', alt: '#curOpen', title: 'Rèm chức năng', text: 'Các mục con của nghiệp vụ đang mở. Mục <b class="tour-hot">tô vàng</b> là mục hay dùng. Bấm lại biểu tượng nghiệp vụ (hoặc nút ☰) để thu gọn / mở rèm.' },
    { el: '#railSys', title: 'Khác', text: 'Tổng quan, Lịch sử bán, Danh mục hàng, Sao lưu và Cài đặt.' },
    { el: '.app.cur-open #backupChip', alt: '#backupDot', title: 'Trạng thái sao lưu', text: 'Chấm <b style="color:var(--success)">xanh</b> là dữ liệu an toàn. Vàng / đỏ: bấm vào để tải bản sao lưu.' },
    { el: '#railMe', title: 'Kết thúc ca', text: 'Bấm vào tên viết tắt để đổi người hoặc kết thúc ca (có tổng kết doanh thu ca).' },
    { el: '#tourBtn', title: 'Xem lại hướng dẫn', text: 'Bấm nút <b>?</b> bất cứ lúc nào để xem lại hướng dẫn của màn đang mở.' },
  ];

  let cur = null; // { steps, i, id, el, onKey, onResize }

  // Có trên màn hình (kể cả phải cuộn dọc); loại phần tử bị ẩn hoặc trượt ra ngoài theo chiều ngang (rèm thu gọn)
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && st.visibility !== 'hidden'; };
  function resolve(step) {
    if (!step.el) return null;
    for (const sel of [step.el, step.alt].filter(Boolean)) {
      let found = null;
      try { found = Array.from(document.querySelectorAll(sel)).find(visible); } catch (_) { }
      if (found) return found;
    }
    return undefined; // không thấy trên màn hình → bỏ bước
  }

  const tkey = m => (m.tourKey && m.tourKey()) || m.id;
  function start(id, force) {
    const m = VM.ui.modules.find(x => x.id === id);
    if (!m || !m.tour || cur) return false;
    const tk = tkey(m);
    const p = prefs();
    let steps = m.tour().filter(Boolean);
    const withShell = !p.seen.__shell;
    if (withShell) steps = steps.concat(SHELL());
    steps = steps.filter(s => !s.el || resolve(s) !== undefined);
    if (!steps.length) return false;
    steps.unshift({ intro: true, title: force ? `Hướng dẫn: ${m.title}` : `Chào mừng đến ${m.title}`, text: `Xem nhanh ${steps.length} bước để biết các nút trên màn này. Bấm <b>Tiếp</b> (hoặc phím →) để đi tiếp, <b>Bỏ qua</b> nếu đã quen.` });
    open(steps, tk, withShell);
    return true;
  }

  function open(steps, id, withShell) {
    const layer = document.createElement('div');
    layer.className = 'tour';
    layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-label', 'Hướng dẫn sử dụng');
    layer.innerHTML = `<div class="tour-hole"></div><div class="tour-pop" tabindex="-1"></div>`;
    document.body.appendChild(layer);
    const prevFocus = document.activeElement;
    cur = { steps, i: 0, id, withShell, layer, prevFocus };
    cur.onKey = e => {
      if (!cur) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur.i - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); end(false); }
      e.stopPropagation(); // chặn phím tắt của màn phía dưới (F2, F4, S, N…) khi đang xem hướng dẫn
    };
    cur.onResize = () => cur && place();
    document.addEventListener('keydown', cur.onKey, true);
    window.addEventListener('resize', cur.onResize);
    window.addEventListener('scroll', cur.onResize, true);
    // Bấm vào vùng tối không làm gì (tránh bấm nhầm nút phía dưới)
    layer.addEventListener('mousedown', e => { if (!e.target.closest('.tour-pop')) e.preventDefault(); });
    go(0);
  }

  function go(i) {
    if (!cur) return;
    cur.i = Math.max(0, Math.min(cur.steps.length - 1, i));
    const s = cur.steps[cur.i], n = cur.steps.length, last = cur.i === n - 1;
    const pop = cur.layer.querySelector('.tour-pop');
    const p = prefs();
    pop.innerHTML = `<div class="tour-h">${s.intro ? `<span class="tour-ic">${icon('info')}</span>` : `<span class="tour-n">${cur.i}/${n - 1}</span>`}<b>${esc(s.title)}</b>
        <button type="button" class="btn ghost icon sm" data-t="skip" aria-label="Đóng hướng dẫn" title="Bỏ qua (Esc)">${icon('x', 's')}</button></div>
      <div class="tour-t">${s.text}</div>
      <div class="tour-dots" aria-hidden="true">${cur.steps.map((_, k) => `<i class="${k === cur.i ? 'on' : k < cur.i ? 'done' : ''}"></i>`).join('')}</div>
      <label class="check tour-off"><input type="checkbox" id="tourOff" ${p.off ? 'checked' : ''}> Không hiện lại lần sau</label>
      <div class="tour-f">
        <button type="button" class="btn ghost sm" data-t="skip">Bỏ qua</button>
        <span style="flex:1"></span>
        ${cur.i > 0 ? `<button type="button" class="btn sm" data-t="back">${icon('chevl', 's')} Quay lại</button>` : ''}
        <button type="button" class="btn primary sm" data-t="next">${last ? `${icon('check', 's')} Xong` : `Tiếp ${icon('chevr', 's')}`}</button>
      </div>`;
    pop.querySelectorAll('[data-t="skip"]').forEach(b => b.onclick = () => end(false));
    if (pop.querySelector('[data-t="back"]')) pop.querySelector('[data-t="back"]').onclick = () => go(cur.i - 1);
    pop.querySelector('[data-t="next"]').onclick = next;
    pop.querySelector('#tourOff').onchange = e => { const q = prefs(); q.off = e.target.checked; setPrefs(q); };
    const target = s.intro ? null : resolve(s);
    cur.target = target || null;
    if (target) {
      const r = target.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 20) target.scrollIntoView({ block: 'center' });
    }
    place();
    setTimeout(() => { const b = pop.querySelector('[data-t="next"]'); if (b) b.focus(); }, 20);
  }

  function place() {
    const hole = cur.layer.querySelector('.tour-hole'), pop = cur.layer.querySelector('.tour-pop');
    const vw = window.innerWidth, vh = window.innerHeight, pad = 6, gap = 12;
    const pw = Math.min(360, vw - 32);
    pop.style.width = pw + 'px';
    const t = cur.target;
    if (!t || !t.isConnected) {
      hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
      pop.style.left = Math.round((vw - pw) / 2) + 'px';
      pop.style.top = Math.round(Math.max(16, (vh - pop.offsetHeight) / 2)) + 'px';
      pop.dataset.side = 'center';
      return;
    }
    const r = t.getBoundingClientRect();
    const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    const w = Math.min(vw - 8, r.right + pad) - x, h = Math.min(vh - 8, r.bottom + pad) - y;
    hole.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    const ph = pop.offsetHeight;
    let side, left, top;
    if (y + h + gap + ph <= vh - 8) { side = 'bottom'; top = y + h + gap; left = x; }
    else if (y - gap - ph >= 8) { side = 'top'; top = y - gap - ph; left = x; }
    else if (x + w + gap + pw <= vw - 8) { side = 'right'; left = x + w + gap; top = y; }
    else if (x - gap - pw >= 8) { side = 'left'; left = x - gap - pw; top = y; }
    else { side = 'center'; left = (vw - pw) / 2; top = Math.max(8, vh - ph - 16); }
    left = Math.max(16, Math.min(left, vw - pw - 16));
    top = Math.max(8, Math.min(top, vh - ph - 8));
    pop.style.left = Math.round(left) + 'px'; pop.style.top = Math.round(top) + 'px';
    pop.dataset.side = side;
  }

  function next() { if (!cur) return; if (cur.i >= cur.steps.length - 1) end(true); else go(cur.i + 1); }

  function end(finished, quiet) {
    if (!cur) return;
    const c = cur; cur = null;
    document.removeEventListener('keydown', c.onKey, true);
    window.removeEventListener('resize', c.onResize);
    window.removeEventListener('scroll', c.onResize, true);
    c.layer.remove();
    const p = prefs();
    if (finished) { p.seen[c.id] = true; if (c.withShell) p.seen.__shell = true; setPrefs(p); }
    else skipped.add(c.id);
    if (!finished && !p.off && !quiet) VM.ui.toast('Đã bỏ qua hướng dẫn – bấm nút ? trên thanh tiêu đề để xem lại', 'ok', 4000);
    if (c.prevFocus && c.prevFocus.focus && c.prevFocus.isConnected) try { c.prevFocus.focus(); } catch (_) { }
  }

  // Gọi sau mỗi lần vẽ màn: tự chạy nếu là lần đầu và người dùng chưa tắt
  function auto(id) {
    const m = VM.ui.modules.find(x => x.id === id);
    if (!m || !m.tour || cur) return;
    const p = prefs(), tk = tkey(m);
    if (p.off || p.seen[tk] || skipped.has(tk)) return;
    setTimeout(() => {
      if (VM.ui.current !== id || tkey(m) !== tk || cur || document.querySelector('#modalRoot .overlay') || !VM.store.currentUser()) return;
      start(id, false);
    }, 450);
  }

  const has = id => { const m = VM.ui.modules.find(x => x.id === id); return !!(m && m.tour); };
  function reset() { setPrefs({ off: false, seen: {} }); skipped.clear(); }
  function clearSession() { if (cur) end(false, true); skipped.clear(); }

  VM.tour = { start, auto, has, reset, clearSession, prefs, get active() { return !!cur; } };
})(window.VM);
