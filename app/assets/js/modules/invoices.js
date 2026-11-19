/* Sổ hóa đơn – ngoại trú (OPD) & nội trú (IPD): hàng về → nhận HĐ → bàn giao NVD → nhập hệ thống */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, num, money } = VM;
  const S = () => VM.store.state;
  const IS = VM.store.INVOICE_STATUS;
  const TAX = [0, 5, 8, 10];
  const BOOK = { OPD: 'Ngoại trú', IPD: 'Nội trú' };
  const NEXT = { no_invoice: { label: 'Đã có HĐ', ic: 'file' }, received: { label: 'Bàn giao NVD', ic: 'arrowr' }, handed: { label: 'Đã nhập', ic: 'check' } };
  const f = { q: '', book: '', tab: 'pending', sup: '', from: '', to: '' };
  let selected = new Set();
  const isPending = i => ['no_invoice', 'received', 'handed'].includes(i.status);
  const me = () => (VM.store.currentUser() || {}).name || '';
  const histPush = (inv, action) => { inv.history = inv.history || []; inv.history.push({ at: VM.iso(), by: me(), action }); };

  // ---------- 3 trường nhập nhanh vào file quyết toán: Ngày hàng về / SL hàng tổng đã về / Số hóa đơn ----------
  const QT_LABELS = ['Ngày hàng về', 'SL hàng tổng đã về', 'Số hóa đơn'];
  const invQty = i => (i.lines && i.lines.length) ? VM.sum(i.lines, l => Number(l.qty) || 0) : (Number(i.totalQty) || 0);
  const qtVals = i => [VM.fmtDate(i.receivedAt), invQty(i) || '', i.invoiceNo || ''];
  // Kiểu ô khi dán vào Excel: ngày là ngày thật, số HĐ giữ dạng chữ (không mất số 0 đầu)
  const qtCells = i => { const v = qtVals(i); return [{ text: v[0], date: i.receivedAt || '' }, v[1] === '' ? '' : v[1], { text: v[2] }]; };
  function qtHtml(vals, note) {
    return `<div class="qt-box"><div class="qt-h">${icon('copy', 's')}<b>Nhập nhanh file quyết toán</b><span class="muted small">${note || 'Bấm từng ô để copy, hoặc copy cả 3 rồi dán vào 3 ô liền nhau trong Excel'}</span>
        <button type="button" class="btn sm primary" data-qt-all>${icon('copy', 's')} Copy cả 3 ô</button></div>
      <div class="qt-cells">${QT_LABELS.map((l, k) => `<button type="button" class="qt-cell ${vals[k] === '' ? 'empty' : ''}" data-qt="${k}" title="Copy ${l}"><span>${l}</span><b class="${k ? 'mono' : ''}">${vals[k] === '' ? '—' : esc(k === 1 ? num(vals[k]) : vals[k])}</b>${icon('copy', 's')}</button>`).join('')}</div></div>`;
  }
  function bindQt(root, getInv) {
    const getVals = () => qtVals(getInv());
    const flash = (b, ok) => { b.classList.add(ok ? 'copied' : 'copy-fail'); setTimeout(() => b.classList.remove('copied', 'copy-fail'), 900); };
    root.querySelectorAll('[data-qt]').forEach(b => b.onclick = async () => {
      const v = getVals()[+b.dataset.qt]; if (v === '' || v == null) { VM.ui.toast(QT_LABELS[+b.dataset.qt] + ' đang trống', 'warn'); return; }
      const ok = await VM.copyCells([[qtCells(getInv())[+b.dataset.qt]]]); flash(b, ok);
      VM.ui.toast(ok ? `Đã copy ${QT_LABELS[+b.dataset.qt]}: ${v}` : 'Trình duyệt chặn sao chép', ok ? 'ok' : 'bad', 1800);
    });
    const all = root.querySelector('[data-qt-all]');
    if (all) all.onclick = async () => {
      const v = getVals(); const ok = await VM.copyCells([qtCells(getInv())]); flash(all, ok);
      VM.ui.toast(ok ? `Đã copy: ${v.join('  |  ')} – dán vào ô “Ngày hàng về” của file quyết toán` : 'Trình duyệt chặn sao chép', ok ? 'ok' : 'bad', 3500);
    };
  }

  // ---------- Copy quyết toán cả ngày: 3 trường của mọi hóa đơn nhập trong 1 ngày ----------
  const LS_QT = 'vmhub.qtDay';
  function openDayCopy(day) {
    const pref = Object.assign({ by: 'recv', layout: 'rows', head: false, noInv: false }, (() => { try { return JSON.parse(localStorage.getItem(LS_QT) || '{}'); } catch (_) { return {}; } })());
    const o = Object.assign(pref, { day: day || VM.ymd(), book: f.book });
    const keepPref = () => { try { localStorage.setItem(LS_QT, JSON.stringify({ by: o.by, layout: o.layout, head: o.head, noInv: o.noInv })); } catch (_) { } };
    const shift = (d, k) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + k); return VM.ymd(x); };
    const pick = () => S().invoices.filter(i => i.status !== 'cancelled'
      && (o.by === 'recv' ? i.receivedAt === o.day : VM.ymd(new Date(i.createdAt)) === o.day)
      && (!o.book || i.book === o.book)).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const cellsOf = list => {
      const rows = list.map(qtCells);
      if (o.layout === 'rows') return o.head ? [QT_LABELS, ...rows] : rows;
      return QT_LABELS.map((l, k) => [...(o.head ? [l] : []), ...rows.map(r => r[k])]);
    };
    const show = c => c && typeof c === 'object' ? c.text : (typeof c === 'number' ? num(c) : String(c ?? ''));
    let cur = [];
    VM.ui.modal({
      title: 'Copy quyết toán trong ngày', ic: 'copy', size: 'lg',
      sub: 'Ngày hàng về · SL hàng tổng đã về · Số hóa đơn của mọi hóa đơn trong ngày – dán một lần vào file quyết toán',
      body: `<div class="qd-bar">
          <div class="qd-day"><button type="button" class="btn icon" id="qdPrev" aria-label="Ngày trước">${icon('chevl')}</button>
            <input class="input" type="date" id="qdDay" aria-label="Ngày">
            <button type="button" class="btn icon" id="qdNext" aria-label="Ngày sau">${icon('chevr')}</button>
            <button type="button" class="btn sm ghost" id="qdToday">Hôm nay</button></div>
          <div class="seg" id="qdBy" role="group" aria-label="Lọc theo"><button data-v="recv">Ngày hàng về</button><button data-v="created">Ngày ghi sổ</button></div>
          <div class="seg" id="qdBook" role="group" aria-label="Sổ"><button data-v="">Cả 2 sổ</button><button data-v="OPD">Ngoại trú</button><button data-v="IPD">Nội trú</button></div>
        </div>
        <div class="qd-bar">
          <div class="seg" id="qdLayout" role="group" aria-label="Cách dán"><button data-v="rows" title="Mỗi hóa đơn một dòng, 3 cột liền nhau">Mỗi HĐ một dòng</button><button data-v="cols" title="Mỗi hóa đơn một cột, 3 dòng liền nhau">Mỗi HĐ một cột</button></div>
          <label class="check"><input type="checkbox" id="qdHead"> Kèm tiêu đề</label>
          <label class="check"><input type="checkbox" id="qdNoInv"> Kèm hàng về chưa có HĐ</label>
        </div>
        <div id="qdSum" class="qd-sum"></div>
        <div class="table-wrap qd-prev" id="qdPrevT"></div>`,
      foot: `<button class="btn" data-x>Đóng</button><button class="btn primary" id="qdCopy" autofocus>${icon('copy', 's')} <span id="qdCopyL">Copy</span></button>`,
      onMount(el, close) {
        const q = s => el.querySelector(s);
        const segs = [['#qdBy', 'by'], ['#qdBook', 'book'], ['#qdLayout', 'layout']];
        const paint = () => {
          q('#qdDay').value = o.day; q('#qdHead').checked = o.head; q('#qdNoInv').checked = o.noInv;
          segs.forEach(([s, k]) => el.querySelectorAll(s + ' [data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === o[k])));
          const all = pick(), noInv = all.filter(i => i.status === 'no_invoice' || !i.invoiceNo);
          cur = o.noInv ? all : all.filter(i => !noInv.includes(i));
          const missQty = cur.filter(i => !invQty(i));
          q('#qdSum').innerHTML = `<span><b>${cur.length}</b> hóa đơn · SL tổng <b>${num(VM.sum(cur, invQty))}</b>${VM.ymd() === o.day ? ' · hôm nay' : ''}</span>
            ${noInv.length && !o.noInv ? `<span class="pill">${icon('info')}${noInv.length} hàng về chưa có HĐ – không copy</span>` : ''}
            ${missQty.length ? `<span class="pill warn">${icon('alert')}${missQty.length} HĐ chưa có SL tổng</span>` : ''}`;
          q('#qdCopyL').textContent = cur.length ? `Copy ${cur.length} hóa đơn` : 'Copy';
          q('#qdCopy').disabled = !cur.length;
          if (!cur.length) {
            q('#qdPrevT').innerHTML = VM.ui.empty('file', `Không có hóa đơn ${o.by === 'recv' ? 'hàng về' : 'ghi sổ'} ngày ${VM.fmtDate(o.day)}`, all.length ? 'Chỉ có hàng về chưa có số hóa đơn. Tick “Kèm hàng về chưa có HĐ” nếu vẫn muốn copy.' : 'Chọn ngày khác bằng nút ‹ ›.');
            return;
          }
          const grid = cellsOf(cur);
          // Xem trước đúng như sẽ dán; cột / dòng NCC tô mờ để đối chiếu, không được copy
          const ncc = cur.map(i => `${i.supplier || ''}${i.book ? ' · ' + (BOOK[i.book] || i.book) : ''}`);
          const td = (c, r, k) => { const v = show(c), miss = v === ''; return `<td class="${miss ? 'qd-miss' : ''} ${o.head && (o.layout === 'rows' ? r === 0 : k === 0) ? 'qd-h' : ''} ${typeof c === 'number' ? 'num' : 'mono'}">${miss ? '—' : esc(v)}</td>`; };
          q('#qdPrevT').innerHTML = `<div class="muted small qd-cap">${icon('eye', 's')} Sẽ dán ra như sau (ô tô mờ chỉ để đối chiếu, không copy)</div><table class="t qd-grid"><tbody>${o.layout === 'rows'
            ? grid.map((r, ri) => `<tr>${r.map((c, k) => td(c, ri, k)).join('')}<td class="qd-ref">${o.head && ri === 0 ? 'NCC' : esc(ncc[ri - (o.head ? 1 : 0)])}</td></tr>`).join('')
            : `<tr class="qd-ref-r">${o.head ? '<td class="qd-ref"></td>' : ''}${ncc.map(n => `<td class="qd-ref">${esc(n)}</td>`).join('')}</tr>` + grid.map((r, ri) => `<tr>${r.map((c, k) => td(c, ri, k)).join('')}</tr>`).join('')}</tbody></table>`;
        };
        segs.forEach(([s, k]) => el.querySelectorAll(s + ' [data-v]').forEach(b => b.onclick = () => { o[k] = b.dataset.v; if (k !== 'book') keepPref(); paint(); }));
        q('#qdDay').onchange = e => { if (e.target.value) { o.day = e.target.value; paint(); } };
        q('#qdPrev').onclick = () => { o.day = shift(o.day, -1); paint(); };
        q('#qdNext').onclick = () => { o.day = shift(o.day, 1); paint(); };
        q('#qdToday').onclick = () => { o.day = VM.ymd(); paint(); };
        q('#qdHead').onchange = e => { o.head = e.target.checked; keepPref(); paint(); };
        q('#qdNoInv').onchange = e => { o.noInv = e.target.checked; keepPref(); paint(); };
        q('[data-x]').onclick = () => close();
        q('#qdCopy').onclick = async () => {
          if (!cur.length) return;
          const ok = await VM.copyCells(cellsOf(cur));
          if (!ok) { VM.ui.toast('Trình duyệt chặn sao chép', 'bad'); return; }
          close();
          VM.ui.done(`Đã copy quyết toán ${cur.length} hóa đơn`, `${o.by === 'recv' ? 'Hàng về' : 'Ghi sổ'} ngày ${VM.fmtDate(o.day)} · dán vào ô “Ngày hàng về” đầu tiên của file quyết toán`);
        };
        paint();
      },
    });
  }

  function filtered() {
    let l = S().invoices.filter(i => {
      if (f.tab === 'pending' && !isPending(i)) return false;
      if (!['pending', 'all'].includes(f.tab) && i.status !== f.tab) return false;
      if (f.book && i.book !== f.book) return false;
      if (f.sup && i.supplier !== f.sup) return false;
      if (f.from && i.receivedAt < f.from) return false;
      if (f.to && i.receivedAt > f.to) return false;
      return true;
    });
    if (f.q.trim()) { const q = VM.normalize(f.q); l = l.filter(i => [i.supplier, i.invoiceNo, i.refNo, i.prNo, i.poNo, i.grNo, i.note, i.nvdReceiver, ...(i.lines || []).map(x => x.name + ' ' + x.code + ' ' + x.lot)].some(v => VM.normalize(v).includes(q))); }
    return l.sort((a, b) => (b.receivedAt + b.createdAt).localeCompare(a.receivedAt + a.createdAt));
  }

  function render(view, top, arg) {
    selected = new Set();
    if (arg === 'overdue') f.tab = 'pending'; // liên kết cũ tới tab "Quá … ngày" đã bỏ
    if (['pending', 'no_invoice', 'received', 'handed', 'entered', 'all'].includes(arg)) f.tab = arg;
    top.innerHTML = `<button class="btn" id="iDay" title="Copy 3 trường quyết toán của mọi hóa đơn trong ngày (phím Q)">${icon('copy')}<span class="label">Quyết toán ngày</span></button>
      <button class="btn icon" id="iPrint" title="In sổ hóa đơn" aria-label="In sổ">${icon('printer')}</button>
      <button class="btn icon" id="iXls" title="Xuất Excel sổ hóa đơn (sheet đầu: Quyết toán)" aria-label="Xuất Excel">${icon('download')}</button>
      <button class="btn" id="iNew">${icon('edit')}<span class="label">Ghi tay</span> <span class="kbd hide-m">N</span></button>
      <button class="btn primary" id="iScan">${icon('scan')}<span class="label">Quét hóa đơn</span> <span class="kbd hide-m">S</span></button>`;
    const sups = [...new Set([...S().settings.suppliers, ...S().invoices.map(i => i.supplier)].filter(Boolean))].sort();
    view.innerHTML = `<div class="kpis" id="iKpis"></div>
      <div class="card">
        <div class="toolbar">
          <div class="seg" id="iBook"><button data-b="">Tất cả</button><button data-b="OPD">Ngoại trú</button><button data-b="IPD">Nội trú</button></div>
          <div class="input-icon grow">${icon('search')}<input class="input" id="iQ" type="search" placeholder="Tìm kiếm" title="NCC, số HĐ, mã tra cứu, PR/PO, tên thuốc, số lô"></div>
          <select class="select xd" id="iSup" aria-label="Nhà cung cấp" style="max-width:260px"><option value="">Mọi nhà cung cấp</option>${sups.map(s => `<option ${s === f.sup ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <input class="input xd" type="date" id="iFrom" value="${f.from}" aria-label="Từ ngày" style="width:auto"><input class="input xd" type="date" id="iTo" value="${f.to}" aria-label="Đến ngày" style="width:auto">
        </div>
        <div class="toolbar" style="padding:10px 18px"><div class="seg" id="iTabs"></div><div id="iBulk" style="margin-left:auto;display:flex;gap:8px;align-items:center"></div></div>
        <div class="table-wrap" id="iTable"></div>
      </div>`;
    $$('#iBook [data-b]').forEach(b => b.onclick = () => { f.book = b.dataset.b; draw(); });
    $('#iQ').oninput = VM.debounce(() => { f.q = $('#iQ').value; draw(); }, 150);
    $('#iSup').onchange = e => { f.sup = e.target.value; draw(); };
    $('#iFrom').onchange = e => { f.from = e.target.value; draw(); };
    $('#iTo').onchange = e => { f.to = e.target.value; draw(); };
    $('#iNew').onclick = () => openEditor();
    $('#iScan').onclick = openScan;
    $('#iXls').onclick = exportXls;
    $('#iPrint').onclick = () => printBook(filtered());
    $('#iDay').onclick = () => openDayCopy();
    const key = e => { if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !$('#modalRoot').children.length) { e.preventDefault(); openDayCopy(); return; } if (e.key === 's' && !e.ctrlKey && !e.metaKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !$('#modalRoot').children.length) { e.preventDefault(); openScan(); return; } if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !$('#modalRoot').children.length) { e.preventDefault(); openEditor(); } };
    document.addEventListener('keydown', key);
    draw();
    if (arg === 'scan') setTimeout(openScan, 30);
    if (arg === 'new') setTimeout(() => openEditor(), 30);
    if (arg === 'qt') setTimeout(() => openDayCopy(), 30);
    return () => document.removeEventListener('keydown', key);
  }

  function draw() {
    const all = S().invoices;
    const c = st => all.filter(i => i.status === st).length;
    const monthTotal = VM.sum(all.filter(i => i.status !== 'cancelled' && (i.receivedAt || '').slice(0, 7) === VM.ymd().slice(0, 7)), i => i.total);
    $('#iKpis').innerHTML = [
      ['no_invoice', 'danger', 'alert', 'Hàng về chưa có HĐ', c('no_invoice')],
      ['received', 'warn', 'file', 'Chờ bàn giao NVD', c('received')],
      ['handed', 'info', 'hourglass', 'Chờ nhập hệ thống', c('handed')],
      ['all', '', 'trend', 'Giá trị nhận tháng này', money(monthTotal)],
    ].map(([t, cls, ic, label, val]) => `<div class="card kpi clickable" role="button" tabindex="0" data-kt="${t}"><div class="kpi-ic ${cls}">${icon(ic)}</div><div><span>${label}</span><strong ${t === 'no_invoice' && val ? 'style="color:var(--danger)"' : ''}>${val}</strong></div></div>`).join('');
    $$('#iKpis [data-kt]').forEach(k => k.onclick = k.onkeydown = e => { if (e.type === 'keydown' && e.key !== 'Enter') return; f.tab = k.dataset.kt; draw(); });
    $$('#iBook [data-b]').forEach(b => b.classList.toggle('active', b.dataset.b === f.book));
    const tabs = [['pending', 'Chưa xong', all.filter(isPending).length], ['no_invoice', 'Chưa có HĐ', c('no_invoice')], ['received', 'Đã nhận HĐ', c('received')], ['handed', 'Đã bàn giao', c('handed')], ['entered', 'Đã nhập', c('entered')], ['all', 'Tất cả', all.length]];
    $('#iTabs').innerHTML = tabs.map(([k, l, n]) => `<button data-t="${k}" class="${f.tab === k ? 'active' : ''}">${l} <span class="cnt">${n}</span></button>`).join('');
    $$('#iTabs [data-t]').forEach(b => b.onclick = () => { f.tab = b.dataset.t; draw(); });

    const list = filtered();
    selected.forEach(id => { if (!list.some(i => i.id === id)) selected.delete(id); });
    const sel = list.filter(i => selected.has(i.id));
    $('#iBulk').innerHTML = sel.length ? `<span class="muted small">Đã chọn ${sel.length}</span>
      <button class="btn sm" id="bQt" title="Mỗi hóa đơn một dòng: ngày hàng về · SL tổng · số HĐ">${icon('copy', 's')} Copy quyết toán</button>
      <button class="btn sm" id="bPrint">${icon('printer', 's')} Phiếu bàn giao</button>
      ${sel.some(i => i.status === 'received') ? `<button class="btn primary sm" id="bHand">${icon('arrowr', 's')} Bàn giao NVD</button>` : ''}
      ${sel.some(i => i.status === 'handed') ? `<button class="btn tonal sm" id="bEnter">${icon('check', 's')} Đã nhập hệ thống</button>` : ''}` : '';
    if ($('#bPrint')) $('#bPrint').onclick = () => printHandover(sel);
    if ($('#bQt')) $('#bQt').onclick = async () => { const ok = await VM.copyCells(sel.map(qtCells)); VM.ui.toast(ok ? `Đã copy ${sel.length} dòng – dán vào file quyết toán` : 'Trình duyệt chặn sao chép', ok ? 'ok' : 'bad'); };
    if ($('#bHand')) $('#bHand').onclick = () => handOver(sel.filter(i => i.status === 'received'));
    if ($('#bEnter')) $('#bEnter').onclick = () => markEntered(sel.filter(i => i.status === 'handed'));

    if (!list.length) {
      $('#iTable').innerHTML = VM.ui.empty(f.tab === 'pending' ? 'checkc' : 'file', f.tab === 'pending' ? 'Không còn hóa đơn tồn đọng' : 'Không có hóa đơn', f.tab === 'pending' ? 'Mọi hóa đơn đã được nhập hệ thống.' : 'Thử đổi bộ lọc hoặc ghi hóa đơn mới.', `<button class="btn primary" id="iNew2">${icon('plus', 's')} Ghi hóa đơn</button>`);
      $('#iNew2').onclick = () => openEditor();
    } else {
      $('#iTable').innerHTML = `<table class="t it"><thead><tr><th style="width:40px"><input type="checkbox" id="iAll" aria-label="Chọn tất cả"></th><th>Hàng về</th><th>Nhà cung cấp · Số HĐ</th><th class="hide-m">Sổ</th><th class="num hide-m xd">Mặt hàng</th><th class="num">Tổng tiền</th><th class="hide-m xd">Bàn giao</th><th>Trạng thái</th><th></th></tr></thead><tbody>
        ${list.map(i => {
          const st = IS[i.status] || IS.received, nx = NEXT[i.status];
          return `<tr class="clickable ${i.status === 'entered' || i.status === 'cancelled' ? 'done' : ''}" data-id="${i.id}">
            <td onclick="event.stopPropagation()"><input type="checkbox" data-sel="${i.id}" ${selected.has(i.id) ? 'checked' : ''} aria-label="Chọn"></td>
            <td class="i-date" title="Ghi sổ ${esc(VM.ago(i.createdAt))}"><b>${VM.fmtDate(i.receivedAt)}</b><div class="t-sub xd">${VM.ago(i.createdAt)}</div></td>
            <td class="i-ncc"><div class="t-title" title="${esc(i.supplier)}">${esc(i.supplier)}</div><div class="t-sub">${i.invoiceNo ? `HĐ <span class="mono">${esc(i.invoiceNo)}</span><span class="xd">${i.invoiceDate ? ' · ngày HĐ ' + VM.fmtDate(i.invoiceDate) : ''}${i.poNo ? ` · PO <span class="mono">${esc(i.poNo)}</span>` : ''}</span>` : '<span style="color:var(--danger)">Chưa có số HĐ</span>'}</div>${i.note ? `<div class="t-sub xd">“${esc(i.note)}”</div>` : ''}</td>
            <td class="hide-m">${VM.ui.pill(i.book === 'IPD' ? 'info' : 'pri', BOOK[i.book] || i.book)}</td>
            <td class="num hide-m xd">${num(i.itemCount || 0)}</td>
            <td class="num"><b>${i.total ? money(i.total) : '—'}</b>${i.tax ? `<div class="t-sub xd">VAT ${num(i.tax)}</div>` : ''}</td>
            <td class="hide-m xd">${i.nvdReceiver ? `<div>${esc(i.nvdReceiver)}</div><div class="t-sub">${VM.fmtDT(i.nvdAt)}</div>` : '<span class="muted">—</span>'}</td>
            <td>${VM.ui.pill(st.cls, st.label)}${st.step >= 0 ? `<div class="steps xd" style="margin-top:6px" title="Bước ${st.step}/3">${[1, 2, 3].map(k => `<i class="${st.step >= k ? 'on' : ''}"></i>`).join('')}</div>` : ''}</td>
            <td onclick="event.stopPropagation()"><div class="actions">${nx ? `<button class="btn ${i.status === 'no_invoice' ? '' : 'tonal'} sm" data-next="${i.id}">${icon(nx.ic, 's')} ${nx.label}</button>` : ''}${i.status !== 'cancelled' ? `<button class="btn ghost icon sm" data-qtrow="${i.id}" title="Copy 3 ô cho file quyết toán: ngày hàng về · SL tổng · số HĐ" aria-label="Copy cho file quyết toán">${icon('copy', 's')}</button>` : ''}<button class="btn ghost icon sm xd" data-open="${i.id}" aria-label="Chi tiết">${icon('chevr', 's')}</button></div></td></tr>`;
        }).join('')}</tbody></table>`;
      $$('#iTable tr[data-id]').forEach(tr => tr.onclick = () => openDetail(tr.dataset.id));
      $$('#iTable [data-open]').forEach(b => b.onclick = () => openDetail(b.dataset.open));
      $$('#iTable [data-next]').forEach(b => b.onclick = () => advance(b.dataset.next));
      $$('#iTable [data-qtrow]').forEach(b => b.onclick = async () => { const inv = find(b.dataset.qtrow), v = qtVals(inv); const ok = await VM.copyCells([qtCells(inv)]); VM.ui.toast(ok ? `Đã copy: ${v.join('  |  ')}` : 'Trình duyệt chặn sao chép', ok ? 'ok' : 'bad', 3000); });
      $$('#iTable [data-sel]').forEach(c => c.onchange = () => { c.checked ? selected.add(c.dataset.sel) : selected.delete(c.dataset.sel); draw(); });
      const a = $('#iAll'); a.checked = list.every(i => selected.has(i.id)); a.onchange = () => { list.forEach(i => a.checked ? selected.add(i.id) : selected.delete(i.id)); draw(); };
    }
    VM.ui.renderNav();
  }

  // ---------- workflow ----------
  const find = id => S().invoices.find(x => x.id === id);
  async function advance(id) {
    const inv = find(id);
    if (inv.status === 'no_invoice') return openEditor(id, { receiveInvoice: true });
    if (inv.status === 'received') return handOver([inv]);
    if (inv.status === 'handed') return markEntered([inv]);
  }
  async function handOver(list) {
    if (!list.length) return;
    const nvd = [...S().staff].sort((a, b) => (/nghiệp vụ/i.test(b.role) ? 1 : 0) - (/nghiệp vụ/i.test(a.role) ? 1 : 0)).map(s => s.name);
    const who = await VM.ui.confirm({ title: list.length > 1 ? `Bàn giao ${list.length} hóa đơn cho NVD` : 'Bàn giao hóa đơn cho Nghiệp vụ dược', message: list.map(i => `<div>• ${esc(i.supplier)} · HĐ <b class="mono">${esc(i.invoiceNo || '—')}</b> · ${money(i.total)}</div>`).join(''), ok: 'Đã bàn giao', ic: 'arrowr', input: { label: 'Người nhận (Nghiệp vụ dược)', required: true, options: nvd } });
    if (!who) return;
    const at = VM.iso();
    list.forEach(i => { i.status = 'handed'; i.nvdReceiver = who; i.nvdAt = at; histPush(i, 'Bàn giao NVD – ' + who); VM.store.log('Bàn giao hóa đơn', 'Sổ hóa đơn', `${i.supplier} · ${i.invoiceNo} → ${who}`, i.invoiceNo); });
    VM.store.save('invoice-hand'); selected.clear(); draw();
    VM.ui.done('Bàn giao thành công', `${list.length} hóa đơn cho ${who}`, { action: { label: 'In phiếu bàn giao', fn: () => printHandover(list) } });
  }
  async function markEntered(list) {
    if (!list.length) return;
    const ref = await VM.ui.confirm({ title: list.length > 1 ? `Đánh dấu ${list.length} hóa đơn đã nhập hệ thống` : 'Đã nhập hóa đơn vào hệ thống', message: 'NVD đã nhập hóa đơn lên SAP / hệ thống kế toán.', ok: 'Xác nhận', ic: 'check', input: { label: 'Số chứng từ nhập kho (GR / SAP) – nếu có', placeholder: 'VD: 5000123456' } });
    if (ref === false) return;
    list.forEach(i => { i.status = 'entered'; i.enteredAt = VM.iso(); i.enteredBy = me(); if (ref !== true) i.grNo = ref; histPush(i, 'Đã nhập hệ thống' + (ref && ref !== true ? ' · CT ' + ref : '')); VM.store.log('Nhập hóa đơn vào hệ thống', 'Sổ hóa đơn', `${i.supplier} · ${i.invoiceNo}`, i.invoiceNo); });
    VM.store.save('invoice-enter'); selected.clear(); draw(); VM.ui.done('Đã nhập hệ thống', `${list.length} hóa đơn`);
  }

  // ---------- checks ----------
  function lastPrice(code, unit, excludeId) {
    if (!code) return null;
    const c = code.toLowerCase();
    const inv = S().invoices.filter(i => i.id !== excludeId && i.status !== 'cancelled').sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    for (const i of inv) for (const l of i.lines || []) if ((l.code || '').toLowerCase() === c && (!unit || l.unit === unit)) return { price: l.price * (1 - (l.discount || 0) / 100), at: i.receivedAt, sup: i.supplier };
    return null;
  }
  function warnings(d, noInv) {
    const w = [];
    const n = s => String(s || '').trim().replace(/^0+/, '');
    if (!noInv && d.invoiceNo && d.supplier) {
      const dup = S().invoices.find(x => x.id !== d.id && x.status !== 'cancelled' && VM.normalize(x.supplier) === VM.normalize(d.supplier) && n(x.invoiceNo) === n(d.invoiceNo));
      if (dup) w.push({ lvl: 'bad', text: `Trùng hóa đơn: ${esc(dup.supplier)} số ${esc(dup.invoiceNo)} đã ghi ngày ${VM.fmtDate(dup.receivedAt)} (${IS[dup.status].label}).` });
    }
    const pt = d._printed && d._printed.total;
    if (pt && (d.lines || []).some(l => l.name)) {
      const calc = VM.store.calcInvoice(Object.assign({}, d, { lines: d.lines.filter(l => l.name).map(l => Object.assign({}, l)) })).total;
      if (Math.abs(calc - pt) > Math.max(1000, pt * 0.002)) w.push({ lvl: 'bad', text: `Tổng tính từ các dòng hàng ${num(calc)} ≠ tổng in trên hóa đơn ${num(pt)} (lệch ${num(calc - pt)}). Đối chiếu lại số lượng / đơn giá / thuế suất.` });
    }
    (d.lines || []).forEach((l, k) => {
      if (!l.name) return;
      const days = VM.daysUntil(l.expiry);
      if (l.expiry && days < 180) w.push({ lvl: days < 0 ? 'bad' : 'warn', text: `Dòng ${k + 1} – ${esc(l.name)}: ${days < 0 ? 'đã hết hạn' : `hạn dùng còn ${days} ngày (< 6 tháng)`}. Kiểm tra trước khi nhận hàng.` });
      const lp = lastPrice(l.code, l.unit, d.id), p = (Number(l.price) || 0) * (1 - (Number(l.discount) || 0) / 100);
      if (lp && lp.price && p && Math.abs(p - lp.price) / lp.price * 100 > S().settings.priceDiffPct)
        w.push({ lvl: 'warn', text: `Dòng ${k + 1} – ${esc(l.name)}: giá ${num(Math.round(p))} khác lần nhập trước ${num(Math.round(lp.price))} (${VM.fmtDate(lp.at)}) ${Math.round((p - lp.price) / lp.price * 100)}% – hỏi Quản lý dược.` });
    });
    return w;
  }
  function taxSumHtml(inv) {
    const rates = Object.keys(inv.taxByRate || {}).sort((a, b) => a - b);
    const r = (a, b, c, d, cls = '') => `<span class="${cls}">${a}</span><span class="num ${cls}">${b}</span><span class="num ${cls}">${c}</span><span class="num ${cls}">${d}</span>`;
    return `<div class="tax-sum">${r('Thuế suất', 'Tiền hàng', 'Tiền thuế', 'Cộng', 'h')}
      ${rates.map(k => { const x = inv.taxByRate[k]; return r(k + '%', num(Math.round(x.net)), num(Math.round(x.tax)), num(Math.round(x.net + x.tax))); }).join('')}
      <span><b>Tổng cộng</b></span><span class="num"><b>${num(inv.subtotal)}</b></span><span class="num"><b>${num(inv.tax)}</b></span><span class="num tot">${money(inv.total)}</span></div>`;
  }

  // ---------- editor ----------
  const blankLine = () => ({ id: VM.uid('ln_'), code: '', name: '', country: '', lot: '', expiry: '', unit: '', qty: 1, price: 0, discount: 0, taxRate: 5 });
  function openEditor(id, opts = {}) {
    const src = id ? find(id) : null;
    const d = src ? JSON.parse(JSON.stringify(src)) : { id: '', book: f.book || 'OPD', receivedAt: VM.ymd(), supplier: '', invoiceNo: '', invoiceDate: VM.ymd(), refNo: '', prNo: '', poNo: '', itemCount: '', receivedBy: me(), pharmacyReceiver: '', subtotal: '', tax: '', total: '', lines: [], status: 'received', note: '' };
    let ocrOrig = null, hdrOrig = {};
    if (opts.prefill) {
      const pf = opts.prefill;
      ['supplier', 'invoiceNo', 'invoiceDate', 'refNo', 'poNo'].forEach(k => { if (pf[k]) { d[k] = pf[k]; hdrOrig[k] = pf[k]; } });
      if (pf.sellerTax) d.sellerTax = pf.sellerTax;
      if (pf.invoiceSymbol) d.invoiceSymbol = pf.invoiceSymbol;
      if (pf.lines && pf.lines.length) d.lines = pf.lines.map(l => Object.assign({}, l, { _o: Object.assign({}, l) }));
      d._printed = { subtotal: pf.printedSubtotal, tax: pf.printedTax, total: pf.printedTotal };
      if (!d.lines.length) Object.assign(d, { subtotal: pf.printedSubtotal || '', tax: pf.printedTax || '', total: pf.printedTotal || '' });
      ocrOrig = d.lines.map(l => l._o);
      if (src && src.status === 'no_invoice') opts.receiveInvoice = true;
    }
    const banner = opts.source === 'xml' ? `<div class="alert ok" style="margin-bottom:14px">${icon('checkc', 's')}<span><b>Nhập từ file XML hóa đơn điện tử</b> – dữ liệu gốc do nhà cung cấp phát hành, không qua OCR. Chỉ cần kiểm tra số lô / hạn dùng và bổ sung PR/PO.</span></div>`
      : opts.source === 'ocr' ? `<div class="ocr-banner">${opts.preview ? `<button type="button" class="ocr-thumb" id="ivPrev" title="Xem ảnh gốc"><img src="${opts.preview}" alt="Ảnh hóa đơn"></button>` : ''}
          <div><b>${icon('scan', 's')} Dữ liệu do OCR đọc – cần đối chiếu</b><br>Các ô <span class="ai-fill-demo">tô vàng</span> do máy đọc: kiểm tra với hóa đơn gốc; ô sẽ hết vàng khi bạn sửa. Tổng tiền được so với tổng in trên hóa đơn. Ảnh chỉ giữ tạm trong phiên này, không lưu vào sổ.</div></div>` : '';
    let noInv = d.status === 'no_invoice' && !opts.receiveInvoice;
    let detail = (d.lines || []).length > 0;
    const canToggleNoInv = !src || ['no_invoice', 'received'].includes(src.status);
    const sups = [...new Set([...S().settings.suppliers, ...S().invoices.map(i => i.supplier)].filter(Boolean))];
    const v = x => esc(x == null ? '' : x);
    // Ghi mới bằng tay: bước 1 là quét mã QR trên hóa đơn / gõ số HĐ, các ô khác chỉ mở sau đó
    const scanFirst = !src && !opts.prefill;
    let scanned = !scanFirst;
    const firstHtml = scanFirst ? `<div class="scan-first" id="ivFirst">
        <div class="step-l"><span class="stp">1</span> Quét mã hóa đơn <span class="req">*</span><span class="muted small" style="font-weight:400">– mã QR in trên hóa đơn, hoặc gõ số hóa đơn rồi Enter</span></div>
        <div class="scan-row">
          <div class="input-icon scan-in">${icon('scan')}<input class="input" id="ivCode" autocomplete="off" placeholder="Quét mã QR / gõ số hóa đơn" aria-label="Mã hoặc số hóa đơn" autofocus></div>
          <button type="button" class="btn icon" id="ivCam" title="Quét bằng camera" aria-label="Quét bằng camera">${icon('qr')}</button>
          <button type="button" class="btn primary" id="ivGo">Tiếp tục ${icon('arrowr', 's')}</button>
        </div>
        <div class="sf-alt">
          <label class="btn ghost sm" title="Đọc thẳng dữ liệu gốc – chính xác 100%"><input type="file" accept=".xml,text/xml,application/xml" id="ivXml" hidden>${icon('file', 's')} Có file XML hóa đơn điện tử</label>
          <button type="button" class="btn ghost sm" id="ivNoInvGo">${icon('truck', 's')} Hàng về – chưa có hóa đơn</button>
        </div>
        <div class="alert bad hidden" id="ivFirstErr"></div>
      </div>` : '';

    VM.ui.modal({
      title: src ? (opts.receiveInvoice ? 'Cập nhật hóa đơn đã nhận' : 'Sửa hóa đơn') : 'Ghi hóa đơn / hàng về', sub: 'Các trường có <span class="req">*</span> là bắt buộc. Chi tiết dòng hàng là tùy chọn.', ic: 'file', size: 'xl', dismissable: false,
      body: `${banner}${firstHtml}<div id="ivQT" class="${scanned ? '' : 'hidden'}"></div><fieldset class="form-grid lock-area" id="ivForm" ${scanned ? '' : 'disabled'}>
          <div class="c12" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
            <div class="seg" id="ivBook"><button type="button" data-b="OPD">${icon('cart', 's')} Ngoại trú (OPD)</button><button type="button" data-b="IPD">${icon('package', 's')} Nội trú (IPD)</button></div>
            <label class="check" ${canToggleNoInv ? '' : 'style="opacity:.5"'}><input type="checkbox" id="ivNoInv" ${noInv ? 'checked' : ''} ${canToggleNoInv ? '' : 'disabled'}><span>Hàng về nhưng <b>chưa có hóa đơn</b></span></label>
          </div>
          <div class="field c3"><label>Ngày hàng về <span class="req">*</span></label><input class="input" type="date" name="receivedAt" value="${v(d.receivedAt)}"></div>
          <div class="field c6"><label>Nhà cung cấp <span class="req">*</span></label><input class="input" name="supplier" id="ivSup" list="ivSups" value="${v(d.supplier)}" autocomplete="off"><datalist id="ivSups">${sups.map(s => `<option value="${esc(s)}">`).join('')}</datalist></div>
          <div class="field c3 inv-only"><label>Số hóa đơn <span class="req">*</span></label><input class="input mono" name="invoiceNo" id="ivNo" value="${v(d.invoiceNo)}" ${opts.receiveInvoice ? 'autofocus' : ''}></div>
          <div class="field c3 inv-only"><label>Ngày hóa đơn</label><input class="input" type="date" name="invoiceDate" value="${v(d.invoiceDate)}"></div>
          <div class="field c3 inv-only"><label>Mã tra cứu HĐĐT</label><input class="input mono" name="refNo" value="${v(d.refNo)}"></div>
          <div class="field c3"><label>Số PR</label><input class="input mono" name="prNo" value="${v(d.prNo)}"></div>
          <div class="field c3"><label>Số PO</label><input class="input mono" name="poNo" value="${v(d.poNo)}"></div>
          <div class="field c4"><label>Người nhận hàng (kho)</label><input class="input" name="receivedBy" list="ivStaff" value="${v(d.receivedBy)}"></div>
          <div class="field c4" id="ivPharm"><label>Nhà thuốc nhận</label><input class="input" name="pharmacyReceiver" list="ivStaff" value="${v(d.pharmacyReceiver)}"></div>
          <div class="field c4"><label>Ghi chú</label><input class="input" name="note" value="${v(d.note)}" placeholder="VD: NCC hẹn gửi HĐ sau"></div>
          <datalist id="ivStaff">${VM.ui.staffOptions()}</datalist>
          <div class="c12" id="ivManual"><div class="form-grid">
            <div class="field c3"><label>Số mặt hàng</label><input class="input num" name="itemCount" inputmode="numeric" value="${v(d.itemCount)}"></div>
            <div class="field c3"><label>SL hàng tổng đã về</label><input class="input num" name="totalQty" id="ivQty" inputmode="numeric" value="${d.totalQty ? num(d.totalQty) : ''}"><span class="hint">Tổng số lượng các dòng trên hóa đơn</span></div>
            <div class="field c6"><label>Tiền hàng (trước thuế)</label><input class="input num" name="subtotal" id="ivSub" inputmode="numeric" value="${d.subtotal ? num(d.subtotal) : ''}"></div>
            <div class="field c6"><label>Tiền thuế GTGT</label><input class="input num" name="tax" id="ivTax" inputmode="numeric" value="${d.tax ? num(d.tax) : ''}"></div>
            <div class="field c6"><label>Tổng thanh toán</label><input class="input num" name="total" id="ivTot" inputmode="numeric" value="${d.total ? num(d.total) : ''}"><span class="hint">Tự tính = tiền hàng + thuế</span></div>
          </div></div>
          <label class="check c12"><input type="checkbox" id="ivDetail" ${detail ? 'checked' : ''}> Nhập chi tiết từng dòng hàng (lô, hạn dùng, thuế suất) – kiểm tra hạn dùng &amp; chênh lệch giá tự động</label>
          <div class="c12 hidden" id="ivLines">
            <div class="table-wrap" style="border:1px solid var(--line);border-radius:12px"><table class="t lines-tbl"><thead><tr><th>#</th><th>Mã hàng</th><th style="min-width:190px">Tên hàng</th><th>Số lô</th><th>Hạn dùng</th><th>ĐVT</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">CK %</th><th>VAT</th><th class="num">Thành tiền</th><th></th></tr></thead><tbody id="lnBody"></tbody></table></div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn sm" id="lnAdd">${icon('plus', 's')} Thêm dòng</button><button type="button" class="btn ghost sm" id="lnPaste">${icon('copy', 's')} Dán từ Excel</button></div>
            <div id="ivTaxSum"></div>
          </div>
          <div class="c12" id="ivWarn"></div>
          <div class="c12 alert bad hidden" id="ivErr"></div>
        </fieldset>
        <datalist id="ivCodes">${S().products.map(p => `<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('')}</datalist>`,
      foot: `<button class="btn" data-x>Hủy</button>${src ? '' : `<button class="btn tonal" data-more ${scanned ? '' : 'disabled'}>Lưu &amp; ghi tiếp</button>`}<button class="btn primary" data-ok ${scanned ? '' : 'disabled'}>${icon('check', 's')} Lưu hóa đơn</button>`,
      onMount(el, close) {
        const q = s => el.querySelector(s);
        const setBook = b => { d.book = b; el.querySelectorAll('#ivBook [data-b]').forEach(x => x.classList.toggle('active', x.dataset.b === b)); q('#ivPharm').style.display = b === 'OPD' ? '' : 'none'; };
        el.querySelectorAll('#ivBook [data-b]').forEach(x => x.onclick = () => setBook(x.dataset.b));
        setBook(d.book);
        const syncMode = () => {
          el.querySelectorAll('.inv-only').forEach(x => x.style.opacity = noInv ? .45 : 1);
          q('#ivNo').disabled = noInv;
          q('#ivLines').classList.toggle('hidden', !detail);
          q('#ivManual').classList.toggle('hidden', detail);
          if (detail && !d.lines.length) d.lines.push(blankLine());
          if (detail) drawLines();
          refresh();
        };
        q('#ivNoInv').onchange = e => { noInv = e.target.checked; syncMode(); };
        q('#ivDetail').onchange = e => { detail = e.target.checked; syncMode(); };
        const autoTot = () => { q('#ivTot').value = num(VM.parseNum(q('#ivSub').value) + VM.parseNum(q('#ivTax').value)); };
        q('#ivSub').oninput = autoTot; q('#ivTax').oninput = autoTot;
        q('#ivSup').onchange = refresh; q('#ivNo').oninput = VM.debounce(refresh, 250);
        const curInv = () => ({ receivedAt: q('[name="receivedAt"]').value, invoiceNo: noInv ? '' : q('#ivNo').value.trim(), lines: detail ? d.lines.filter(l => l.name || l.code) : [], totalQty: VM.parseNum(q('#ivQty').value) });
        const curQt = () => qtVals(curInv());
        const drawQt = () => {
          const box = q('#ivQT');
          box.innerHTML = qtHtml(curQt(), opts.source ? `Đã đọc từ ${opts.source === 'xml' ? 'file XML' : 'OCR'} – kiểm tra rồi copy vào file quyết toán` : '');
          bindQt(box, curInv);
        };
        q('[name="receivedAt"]').onchange = drawQt; q('#ivQty').oninput = drawQt;

        function drawLines() {
          q('#lnBody').innerHTML = d.lines.map((l, k) => `<tr data-i="${k}">
            <td class="muted">${k + 1}</td>
            <td><input class="input mono" data-k="code" list="ivCodes" value="${v(l.code)}" style="width:96px"></td>
            <td><input class="input" data-k="name" value="${v(l.name)}"></td>
            <td><input class="input mono" data-k="lot" value="${v(l.lot)}" style="width:92px"></td>
            <td><input class="input" type="date" data-k="expiry" value="${v(l.expiry)}" style="width:140px"></td>
            <td><input class="input" data-k="unit" value="${v(l.unit)}" style="width:70px"></td>
            <td><input class="input num" data-k="qty" inputmode="numeric" value="${v(l.qty)}" style="width:64px"></td>
            <td><input class="input num" data-k="price" inputmode="numeric" value="${l.price ? num(l.price) : ''}" style="width:100px"></td>
            <td><input class="input num" data-k="discount" inputmode="decimal" value="${v(l.discount || '')}" style="width:52px"></td>
            <td><select class="select" data-k="taxRate" style="min-height:36px;padding:0 6px;width:68px">${TAX.map(t => `<option value="${t}" ${Number(l.taxRate) === t ? 'selected' : ''}>${t}%</option>`).join('')}</select></td>
            <td class="num strong" data-amt>${num(l.amount || 0)}</td>
            <td><button type="button" class="btn ghost icon sm" data-del aria-label="Xóa dòng">${icon('trash', 's')}</button></td></tr>`).join('');
          el.querySelectorAll('#lnBody tr').forEach(tr => {
            const l = d.lines[+tr.dataset.i];
            tr.querySelectorAll('[data-k]').forEach(inp => {
              const k = inp.dataset.k;
              if (opts.source === 'ocr' && l._o && l._o[k] !== '' && l._o[k] != null && l._o[k] !== 0 && String(l._o[k]) === String(l[k])) inp.classList.add('ai-fill');
              inp.oninput = inp.onchange = e => {
                inp.classList.remove('ai-fill');
                l[k] = ['qty', 'price', 'discount', 'taxRate'].includes(k) ? VM.parseNum(inp.value) : inp.value.trim();
                if (k === 'code' && e.type === 'change') {
                  const p = S().products.find(x => x.code.toLowerCase() === l.code.toLowerCase() || x.sap === l.code);
                  if (p) { l.code = p.code; if (!l.name) l.name = p.name; if (!l.unit) l.unit = (p.units.find(u => u.name === p.defaultUnit) || p.units[0]).name; const lp = lastPrice(p.code, l.unit, d.id); if (!l.price && lp) l.price = Math.round(lp.price); drawLines(); tr.parentNode && el.querySelector(`#lnBody tr[data-i="${tr.dataset.i}"] [data-k="lot"]`).focus(); return; }
                }
                refresh();
              };
              inp.onkeydown = e => { if (e.key === 'Enter' && +tr.dataset.i === d.lines.length - 1 && k !== 'code') { e.preventDefault(); d.lines.push(blankLine()); drawLines(); el.querySelector(`#lnBody tr:last-child [data-k="code"]`).focus(); } };
            });
            tr.querySelector('[data-del]').onclick = () => { d.lines.splice(+tr.dataset.i, 1); if (!d.lines.length) d.lines.push(blankLine()); drawLines(); };
          });
          refresh();
        }
        function refresh() {
          if (detail) {
            VM.store.calcInvoice(d);
            el.querySelectorAll('#lnBody tr').forEach(tr => { const a = tr.querySelector('[data-amt]'); if (a) a.textContent = num(d.lines[+tr.dataset.i].amount || 0); });
            q('#ivTaxSum').innerHTML = d.lines.some(l => l.name) ? taxSumHtml(d) : '';
          }
          drawQt();
          const probe = Object.assign({}, d, { supplier: q('#ivSup').value.trim(), invoiceNo: q('#ivNo').value.trim(), lines: detail ? d.lines : [] });
          q('#ivWarn').innerHTML = warnings(probe, noInv).map(w => `<div class="alert ${w.lvl}" style="margin-top:8px">${icon('alert', 's')}<span>${w.text}</span></div>`).join('');
        }
        q('#lnAdd').onclick = () => { d.lines.push(blankLine()); drawLines(); el.querySelector('#lnBody tr:last-child [data-k="code"]').focus(); };
        q('#lnPaste').onclick = () => pasteDialog(rows => { d.lines = d.lines.filter(l => l.name).concat(rows); if (!d.lines.length) d.lines.push(blankLine()); drawLines(); });
        syncMode();
        if (opts.source === 'ocr') Object.keys(hdrOrig).forEach(k => { const i = q(`#ivForm [name="${k}"]`); if (i) { i.classList.add('ai-fill'); i.addEventListener('input', () => i.classList.remove('ai-fill'), { once: true }); } });
        if (q('#ivPrev')) q('#ivPrev').onclick = () => VM.ui.modal({ title: 'Ảnh hóa đơn gốc', ic: 'eye', size: 'xl', body: `<img src="${opts.preview}" alt="Ảnh hóa đơn" style="width:100%;border-radius:10px">` });

        // ----- Bước 1: quét mã hóa đơn → mở các ô còn lại -----
        if (scanFirst) {
          const errBox = q('#ivFirstErr');
          const firstErr = m => { errBox.innerHTML = `${icon('alert', 's')}<span>${m}</span>`; errBox.classList.remove('hidden'); q('#ivCode').focus(); q('#ivCode').select(); };
          const fill = (name, val) => { const i = q(`#ivForm [name="${name}"]`); if (!i || val === '' || val == null) return; i.value = val; i.classList.add('ai-fill'); i.addEventListener('input', () => i.classList.remove('ai-fill'), { once: true }); };
          const unlock = (title, sub) => {
            scanned = true;
            q('#ivForm').disabled = false; q('#ivQT').classList.remove('hidden');
            el.querySelectorAll('[data-ok],[data-more]').forEach(b => { b.disabled = false; });
            const box = q('#ivFirst');
            box.className = 'scan-first done';
            box.innerHTML = `${icon('checkc')}<div style="flex:1;min-width:0"><b>${title}</b><small>${sub}</small></div><button type="button" class="btn ghost sm" id="ivRescan">${icon('refresh', 's')} Quét lại</button>`;
            q('#ivRescan').onclick = () => { close(); openEditor(null); };
            syncMode();
            const next = ['#ivSup', '#ivNo'].map(q).find(i => i && !i.disabled && !i.value.trim());
            setTimeout(() => (next || q('[name="poNo"]')).focus(), 30);
          };
          const applyCode = raw => {
            raw = String(raw || '').trim();
            if (!raw) { firstErr('Quét mã QR trên hóa đơn hoặc gõ số hóa đơn'); return; }
            const r = VM.ai.parseInvoiceCode(raw);
            if (!r || (!r.invoiceNo && !r.refNo)) { firstErr(r && r.url ? 'Mã QR này chỉ là đường dẫn tra cứu, không chứa số hóa đơn. Gõ số hóa đơn (in ở góc phải hóa đơn) rồi Enter.' : 'Không đọc được số hóa đơn từ mã này. Gõ số hóa đơn (tối đa 8 chữ số) rồi Enter.'); return; }
            const fromQr = r.invoiceNo !== raw;
            fill('invoiceNo', r.invoiceNo); fill('refNo', r.refNo); fill('invoiceDate', r.invoiceDate);
            if (r.sellerTax) {
              d.sellerTax = r.sellerTax;
              const known = S().invoices.find(x => x.sellerTax === r.sellerTax && x.supplier);
              if (known && !q('#ivSup').value.trim()) fill('supplier', known.supplier);
            }
            if (r.total && !detail) fill('total', num(r.total));
            if (r.invoiceSymbol) d.invoiceSymbol = r.invoiceSymbol;
            const bits = [r.invoiceSymbol && `ký hiệu ${esc(r.invoiceSymbol)}`, r.sellerTax && `MST bán ${esc(r.sellerTax)}`, r.invoiceDate && `ngày ${VM.fmtDate(r.invoiceDate)}`, r.total && `tổng ${num(r.total)}`].filter(Boolean);
            unlock(r.invoiceNo ? `Hóa đơn số <span class="mono">${esc(r.invoiceNo)}</span>` : `Mã tra cứu <span class="mono">${esc(r.refNo)}</span>`,
              (fromQr ? 'Đọc từ mã QR' : 'Gõ tay') + (bits.length ? ' · ' + bits.join(' · ') : '') + (r.invoiceNo ? (fromQr ? ' · ô tô vàng do máy điền, hãy đối chiếu' : '') : ' · hãy gõ số hóa đơn'));
          };
          q('#ivCode').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); applyCode(q('#ivCode').value); } };
          q('#ivCode').oninput = () => errBox.classList.add('hidden');
          q('#ivGo').onclick = () => applyCode(q('#ivCode').value);
          q('#ivCam').onclick = () => VM.loans.openScanner(code => { q('#ivCode').value = code; applyCode(code); });
          q('#ivNoInvGo').onclick = () => { noInv = true; q('#ivNoInv').checked = true; unlock('Hàng về – chưa có hóa đơn', 'Ghi nhận hàng về trước; khi NCC gửi hóa đơn, bấm “Đã có HĐ” trên dòng này để cập nhật số hóa đơn'); };
          q('#ivXml').onchange = async e => {
            const file = e.target.files[0]; if (!file) return;
            try { const data = VM.ai.parseXmlInvoice(await file.text()); VM.store.log('Nhập XML hóa đơn điện tử', 'Sổ hóa đơn', `${data.supplier} · ${data.invoiceNo}`); close(); openEditor(null, { prefill: data, source: 'xml' }); }
            catch (err) { firstErr(esc(err.message)); }
          };
        }

        const save = async (more) => {
          if (!scanned) return;
          const fd = VM.ui.formData(q('#ivForm'));
          const errs = [];
          if (!fd.receivedAt) errs.push('Chọn ngày hàng về');
          if (!fd.supplier) errs.push('Nhập nhà cung cấp');
          if (!noInv && !fd.invoiceNo) errs.push('Nhập số hóa đơn (hoặc tick “chưa có hóa đơn”)');
          const lines = detail ? d.lines.filter(l => l.name || l.code) : [];
          if (detail && !lines.length) errs.push('Nhập ít nhất 1 dòng hàng hoặc bỏ tick “chi tiết dòng hàng”');
          lines.forEach((l, k) => { if (!l.name) errs.push(`Dòng ${k + 1}: thiếu tên hàng`); if (!(l.qty > 0)) errs.push(`Dòng ${k + 1}: số lượng phải > 0`); });
          if (errs.length) { const e = q('#ivErr'); e.innerHTML = icon('alert', 's') + '<span>' + errs.map(esc).join(' · ') + '</span>'; e.classList.remove('hidden'); e.scrollIntoView({ block: 'nearest' }); return; }
          const probe = Object.assign({}, d, fd, { lines });
          if (warnings(probe, noInv).some(w => w.lvl === 'bad' && w.text.startsWith('Trùng'))) {
            if (!(await VM.ui.confirm({ title: 'Hóa đơn có thể bị trùng', message: 'Nhà cung cấp và số hóa đơn này đã có trong sổ. Vẫn lưu?', ok: 'Vẫn lưu', danger: true }))) return;
          }
          if (opts.source === 'ocr') {
            let n = 0, kept = 0;
            Object.entries(hdrOrig).forEach(([k, v]) => { n++; if (String(fd[k] || '') === String(v)) kept++; });
            const KEYS = ['code', 'name', 'unit', 'lot', 'expiry', 'qty', 'price', 'taxRate'];
            (ocrOrig || []).forEach(o => { const now = lines.find(l => l._o && l._o.id === o.id); KEYS.forEach(k => { if (o[k] === '' || o[k] == null || o[k] === 0) return; n++; if (now && String(now[k]) === String(o[k])) kept++; }); });
            VM.ai.track('ocr', n, kept);
          }
          const out = Object.assign(d, {
            book: d.book, receivedAt: fd.receivedAt, supplier: fd.supplier, invoiceNo: noInv ? '' : fd.invoiceNo, invoiceDate: noInv ? '' : fd.invoiceDate, refNo: noInv ? '' : fd.refNo,
            prNo: fd.prNo, poNo: fd.poNo, receivedBy: fd.receivedBy, pharmacyReceiver: d.book === 'OPD' ? fd.pharmacyReceiver : '', note: fd.note, lines: lines.map(({ _o, ...l }) => l),
          });
          delete out._printed;
          if (opts.source) out.source = opts.source;
          if (detail) VM.store.calcInvoice(out);
          else { out.itemCount = Math.floor(VM.parseNum(fd.itemCount)); out.subtotal = VM.parseNum(fd.subtotal); out.tax = VM.parseNum(fd.tax); out.total = VM.parseNum(fd.total) || out.subtotal + out.tax; out.totalQty = VM.parseNum(fd.totalQty) || 0; delete out.taxByRate; }
          if (!S().settings.suppliers.includes(out.supplier)) S().settings.suppliers.push(out.supplier);
          if (!src) {
            Object.assign(out, { id: VM.uid('i_'), status: noInv ? 'no_invoice' : 'received', createdAt: VM.iso(), createdBy: me(), history: [] });
            histPush(out, noInv ? 'Hàng về – chưa có HĐ' : 'Ghi sổ hóa đơn');
            S().invoices.push(out);
            VM.store.log('Ghi hóa đơn', 'Sổ hóa đơn', `${out.supplier} · ${out.invoiceNo || 'chưa có HĐ'} · ${money(out.total)}`, out.invoiceNo);
          } else {
            if (src.status === 'no_invoice' && !noInv) { out.status = 'received'; histPush(out, 'Đã nhận hóa đơn số ' + out.invoiceNo); }
            else if (src.status === 'received' && noInv) { out.status = 'no_invoice'; histPush(out, 'Chuyển về: chưa có HĐ'); }
            else histPush(out, 'Sửa thông tin');
            Object.keys(src).forEach(k => delete src[k]); Object.assign(src, out);
            VM.store.log('Sửa hóa đơn', 'Sổ hóa đơn', `${out.supplier} · ${out.invoiceNo}`, out.invoiceNo);
          }
          if (opts.source) histPush(out, opts.source === 'xml' ? 'Nhập từ file XML hóa đơn điện tử' : 'Đọc bằng OCR – đã đối chiếu và lưu');
          VM.store.save('invoice'); close();
          if ($('#iTable')) draw();
          if (src) VM.ui.done('Đã cập nhật hóa đơn'); else if (noInv) VM.ui.done('Đã ghi hàng về', 'Nhớ bổ sung hóa đơn khi NCC gửi'); else VM.ui.done('Đã ghi hóa đơn vào sổ');
          if (more) openEditor(null);
        };
        q('[data-x]').onclick = () => close();
        q('[data-ok]').onclick = () => save(false);
        if (q('[data-more]')) q('[data-more]').onclick = () => save(true);
      },
    });
  }

  function pasteDialog(onRows) {
    VM.ui.modal({
      title: 'Dán dòng hàng từ Excel', sub: 'Copy các cột theo thứ tự: <b>Mã hàng · Tên hàng · Số lô · Hạn dùng · ĐVT · SL · Đơn giá · CK% · VAT%</b> rồi dán vào ô dưới.', ic: 'copy', size: 'lg',
      body: `<textarea class="textarea mono" id="pTxt" style="min-height:200px" placeholder="OTC001&#9;Paracetamol 500mg H/100v&#9;PA2410Z&#9;31/12/2027&#9;Hộp&#9;20&#9;38000&#9;0&#9;5"></textarea><div class="muted small" id="pInfo" style="margin-top:6px"></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>Thêm dòng</button>`,
      onMount(el, close) {
        const parse = () => el.querySelector('#pTxt').value.split(/\r?\n/).map(r => r.split('\t')).filter(c => c.some(x => x.trim()) && !/^(mã|ma|code)/i.test(c[0].trim()))
          .map(c => { const t = c.map(x => (x || '').trim()); const pd = VM.parseDate(t[3]); return Object.assign(blankLine(), { code: t[0], name: t[1], lot: t[2], expiry: pd ? VM.ymd(pd) : '', unit: t[4], qty: VM.parseNum(t[5]) || 1, price: VM.parseNum(t[6]), discount: VM.parseNum(t[7]), taxRate: t[8] !== undefined && t[8] !== '' ? VM.parseNum(String(t[8]).replace('%', '')) : 5 }); });
        el.querySelector('#pTxt').oninput = () => { el.querySelector('#pInfo').textContent = `Nhận diện ${parse().length} dòng`; };
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = () => { const rows = parse(); if (!rows.length) return VM.ui.toast('Chưa có dòng nào', 'warn'); close(); onRows(rows); VM.ui.toast(`Đã thêm ${rows.length} dòng`); };
      },
    });
  }

  // ---------- detail ----------
  function openDetail(id) {
    const i = find(id), st = IS[i.status], nx = NEXT[i.status];
    VM.ui.modal({
      title: `${i.supplier}`, sub: `${VM.ui.pill(st.cls, st.label)} · ${BOOK[i.book]} · HĐ <span class="mono">${esc(i.invoiceNo || '—')}</span>`, ic: 'file', size: 'xl',
      body: `${i.status !== 'cancelled' ? qtHtml(qtVals(i)) : ''}<div class="form-grid"><div class="c8">
          <dl class="kv"><dt>Ngày hàng về</dt><dd>${VM.fmtDate(i.receivedAt)}</dd><dt>Số HĐ · Ngày HĐ</dt><dd><span class="mono">${esc(i.invoiceNo || '—')}</span> · ${VM.fmtDate(i.invoiceDate) || '—'}</dd>
          <dt>Mã tra cứu</dt><dd class="mono">${esc(i.refNo || '—')}</dd><dt>PR · PO</dt><dd class="mono">${esc(i.prNo || '—')} · ${esc(i.poNo || '—')}</dd>
          <dt>Người nhận hàng</dt><dd>${esc(i.receivedBy || '—')}${i.pharmacyReceiver ? ' · nhà thuốc: ' + esc(i.pharmacyReceiver) : ''}</dd>
          <dt>NVD nhận HĐ</dt><dd>${esc(i.nvdReceiver || '—')}${i.nvdAt ? ' · ' + VM.fmtDT(i.nvdAt) : ''}</dd>${i.grNo ? `<dt>Số CT nhập</dt><dd class="mono">${esc(i.grNo)}</dd>` : ''}
          <dt>Số mặt hàng · SL tổng</dt><dd>${num(i.itemCount || 0)} · ${num(invQty(i))}</dd><dt>Tổng thanh toán</dt><dd style="color:var(--primary-700);font-size:16px">${money(i.total)}</dd>${i.note ? `<dt>Ghi chú</dt><dd>${esc(i.note)}</dd>` : ''}</dl>
          ${(i.lines || []).length ? `<div class="table-wrap" style="margin-top:16px;border:1px solid var(--line);border-radius:12px"><table class="t"><thead><tr><th>#</th><th>Tên hàng</th><th>Lô · HSD</th><th>ĐVT</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">VAT</th><th class="num">Thành tiền</th></tr></thead><tbody>
            ${i.lines.map((l, k) => `<tr><td>${k + 1}</td><td><div class="t-title">${esc(l.name)}</div><div class="t-sub mono">${esc(l.code)}</div></td><td><span class="mono">${esc(l.lot || '—')}</span><div class="t-sub">${VM.fmtDate(l.expiry)}</div></td><td>${esc(l.unit)}</td><td class="num">${num(l.qty)}</td><td class="num">${num(l.price)}${l.discount ? `<div class="t-sub">CK ${l.discount}%</div>` : ''}</td><td class="num">${l.taxRate}%</td><td class="num strong">${num(l.amount)}</td></tr>`).join('')}</tbody></table></div>${taxSumHtml(i)}` : ''}
        </div>
        <div class="c4"><div class="label-t" style="margin-bottom:10px">Lịch sử</div><ul class="timeline">${(i.history || []).map(h => `<li class="on"><span class="tdot">${icon('check')}</span><b>${esc(h.action)}</b><small>${esc(h.by)} · ${VM.fmtDT(h.at)}</small></li>`).join('')}
          ${nx ? `<li class="cur"><span class="tdot"></span><b>Tiếp theo: ${nx.label}</b></li>` : ''}</ul></div></div>`,
      foot: `${i.status !== 'entered' && i.status !== 'cancelled' ? `<button class="btn danger" data-cancel style="margin-right:auto">${icon('x', 's')} Hủy</button>` : '<span style="margin-right:auto"></span>'}
        <button class="btn" data-print>${icon('printer', 's')} Phiếu bàn giao</button>
        ${i.status !== 'cancelled' ? `<button class="btn" data-edit>${icon('edit', 's')} Sửa</button>` : ''}
        ${nx ? `<button class="btn primary" data-next>${icon(nx.ic, 's')} ${nx.label}</button>` : ''}`,
      onMount(el, close) {
        const b = s => el.querySelector(s);
        b('[data-print]').onclick = () => printHandover([i]);
        bindQt(el, () => i);
        if (b('[data-edit]')) b('[data-edit]').onclick = () => { close(); openEditor(i.id); };
        if (b('[data-next]')) b('[data-next]').onclick = () => { close(); advance(i.id); };
        if (b('[data-cancel]')) b('[data-cancel]').onclick = async () => {
          const r = await VM.ui.confirm({ title: 'Hủy hóa đơn này?', message: 'Chỉ hủy khi ghi nhầm / trả hàng. Bản ghi vẫn được giữ lại.', ok: 'Hủy hóa đơn', danger: true, input: { label: 'Lý do', required: true } });
          if (!r) return;
          i.status = 'cancelled'; i.cancelReason = r; histPush(i, 'Hủy – ' + r);
          VM.store.log('Hủy hóa đơn', 'Sổ hóa đơn', r, i.invoiceNo); VM.store.save('invoice-cancel'); close(); draw();
        };
      },
    });
  }

  // ---------- print & export ----------
  function printHandover(list) {
    if (!list.length) return;
    VM.ui.print(`<h2>BIÊN BẢN BÀN GIAO HÓA ĐƠN</h2><div>${esc(S().settings.pharmacyName)} → Nghiệp vụ dược · ${VM.fmtDT(new Date())}</div>
      <table><thead><tr><th>STT</th><th>Sổ</th><th>Ngày hàng về</th><th>Nhà cung cấp</th><th>Số HĐ</th><th>Ngày HĐ</th><th>PO</th><th>Số MH</th><th>Tổng tiền</th><th>Ghi chú</th></tr></thead><tbody>
      ${list.map((i, k) => `<tr><td>${k + 1}</td><td>${i.book}</td><td>${VM.fmtDate(i.receivedAt)}</td><td>${esc(i.supplier)}</td><td>${esc(i.invoiceNo)}</td><td>${VM.fmtDate(i.invoiceDate)}</td><td>${esc(i.poNo || '')}</td><td>${i.itemCount || ''}</td><td style="text-align:right">${num(i.total)}</td><td>${esc(i.note || '')}</td></tr>`).join('')}
      <tr><td colspan="8"><b>Tổng cộng ${list.length} hóa đơn</b></td><td style="text-align:right"><b>${num(VM.sum(list, i => i.total))}</b></td><td></td></tr></tbody></table>
      <div class="sign"><div>Người giao<br><small>(ký, ghi rõ họ tên)</small></div><div>Người nhận – Nghiệp vụ dược<br><small>(ký, ghi rõ họ tên)</small></div></div>`);
  }
  function printBook(list) {
    VM.ui.print(`<h2>SỔ THEO DÕI HÓA ĐƠN${f.book ? ' – ' + BOOK[f.book].toUpperCase() : ''}</h2><div>In lúc ${VM.fmtDT(new Date())} · ${list.length} hóa đơn</div>
      <table><thead><tr><th>STT</th><th>Ngày về</th><th>Sổ</th><th>Nhà cung cấp</th><th>Số HĐ</th><th>Số MH</th><th>Tổng tiền</th><th>Người nhận</th><th>NVD nhận</th><th>Trạng thái</th></tr></thead><tbody>
      ${list.map((i, k) => `<tr><td>${k + 1}</td><td>${VM.fmtDate(i.receivedAt)}</td><td>${i.book}</td><td>${esc(i.supplier)}</td><td>${esc(i.invoiceNo || '—')}</td><td>${i.itemCount || ''}</td><td style="text-align:right">${num(i.total)}</td><td>${esc(i.receivedBy || '')}</td><td>${esc(i.nvdReceiver || '')}<br><small>${VM.fmtDT(i.nvdAt)}</small></td><td>${IS[i.status].label}</td></tr>`).join('')}</tbody></table>`);
  }
  function exportXls() {
    const list = filtered();
    VM.xlsx.exportXlsx({
      'Quyết toán': [[...QT_LABELS, 'Nhà cung cấp', 'Sổ', 'Tổng tiền'], ...list.filter(i => i.status !== 'cancelled').map(i => { const v = qtVals(i); return [v[0], v[1] === '' ? '' : v[1], v[2], i.supplier, i.book, i.total || '']; })],
      'Sổ hóa đơn': [['Sổ', 'Ngày hàng về', 'Nhà cung cấp', 'Số HĐ', 'Ngày HĐ', 'Mã tra cứu', 'Số PR', 'Số PO', 'Số mặt hàng', 'SL hàng tổng đã về', 'Tiền hàng', 'Thuế GTGT', 'Tổng tiền', 'Người nhận hàng', 'Nhà thuốc nhận', 'NVD nhận', 'Thời gian bàn giao', 'Số CT nhập', 'Trạng thái', 'Ghi chú'],
        ...list.map(i => [BOOK[i.book], VM.fmtDate(i.receivedAt), i.supplier, i.invoiceNo, VM.fmtDate(i.invoiceDate), i.refNo, i.prNo, i.poNo, i.itemCount, invQty(i) || '', i.subtotal, i.tax, i.total, i.receivedBy, i.pharmacyReceiver, i.nvdReceiver, VM.fmtDT(i.nvdAt), i.grNo || '', IS[i.status].label, i.note])],
      'Chi tiết dòng hàng': [['Nhà cung cấp', 'Số HĐ', 'Mã hàng', 'Tên hàng', 'Số lô', 'Hạn dùng', 'ĐVT', 'Số lượng', 'Đơn giá', 'CK %', 'Thuế suất %', 'Thành tiền'],
        ...list.flatMap(i => (i.lines || []).map(l => [i.supplier, i.invoiceNo, l.code, l.name, l.lot, VM.fmtDate(l.expiry), l.unit, l.qty, l.price, l.discount, l.taxRate, l.amount]))],
    }, `so_hoa_don_${VM.fileStamp()}.xlsx`);
  }

  // ---------- Quét hóa đơn: ưu tiên XML hóa đơn điện tử (chính xác 100%), sau đó mới OCR ảnh ----------
  function openScan(forId) {
    const ai = S().settings.ai, app = ai.ocr === 'app', local = VM.isLocalUrl(ai.ocrUrl);
    const target = typeof forId === 'string' ? forId : null;
    const prov = ai.ocrProvider && ai.ocrProvider !== 'auto' ? VM.ai.PROVIDERS[ai.ocrProvider] : '';
    const tag = app ? ['ok', `AI đọc ảnh${prov ? ` (${prov})` : ''}`] : local ? ['ok', 'OCR nội bộ'] : ['bad', 'Chưa cấu hình máy chủ nội bộ'];
    const where = app ? `Ảnh được gửi qua máy chủ của app tới <b>${esc(prov || 'nhà cung cấp AI đã cấu hình')}</b> để đọc, không lưu lại trong app.`
      : `Ảnh được gửi tới mô hình OCR chạy trong bệnh viện: <span class="mono">${esc(ai.ocrUrl || '—')}</span> · mô hình <span class="mono">${esc(ai.ocrModel || '—')}</span>.`;
    VM.ui.modal({
      title: 'Quét / nhập hóa đơn', sub: app ? 'Chọn cách nhanh và chính xác nhất. File XML đọc ngay trên máy; ảnh chụp được gửi cho AI đọc.' : 'Chọn cách nhanh và chính xác nhất. Dữ liệu không rời khỏi mạng nội bộ bệnh viện.', ic: 'scan', size: 'lg',
      body: `<div class="scan-opts">
          <label class="scan-opt best"><input type="file" accept=".xml,text/xml,application/xml" id="scXml" hidden>
            <span class="so-ic">${icon('file', 'l')}</span><b>File XML hóa đơn điện tử</b><span class="so-tag">Khuyến nghị · chính xác 100%</span>
            <small>Hóa đơn điện tử (TT78) luôn có file .xml gửi kèm email / cổng tra cứu của NCC. Đọc thẳng dữ liệu gốc – không cần OCR, không cần mạng.</small></label>
          <label class="scan-opt"><input type="file" accept="image/*" capture="environment" id="scImg" hidden>
            <span class="so-ic">${icon('scan', 'l')}</span><b>Chụp / ảnh scan hóa đơn giấy</b><span class="so-tag ${tag[0]}">${tag[1]}</span>
            <small>${where} Kết quả luôn phải đối chiếu trước khi lưu.</small></label>
        </div>
        <div id="scState" style="margin-top:14px"></div>`,
      foot: `<button class="btn" data-x>Đóng</button><button class="btn ghost" data-manual>${icon('edit', 's')} Nhập tay</button>`,
      onMount(el, close) {
        const st = el.querySelector('#scState');
        const fail = m => { st.innerHTML = `<div class="alert bad">${icon('alert', 's')}<span>${esc(m)}</span></div>`; };
        const done = (data, source, preview) => { close(); openEditor(target, { prefill: data, source, preview }); };
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-manual]').onclick = () => { close(); openEditor(target, target ? { receiveInvoice: true } : {}); };
        el.querySelector('#scXml').onchange = async e => {
          const file = e.target.files[0]; if (!file) return;
          try { const data = VM.ai.parseXmlInvoice(await file.text()); VM.store.log('Nhập XML hóa đơn điện tử', 'Sổ hóa đơn', `${data.supplier} · ${data.invoiceNo}`); done(data, 'xml'); }
          catch (err) { fail(err.message); }
        };
        el.querySelector('#scImg').onchange = async e => {
          const file = e.target.files[0]; if (!file) return;
          st.innerHTML = `<div class="alert info">${icon('hourglass', 's')}<span>${app ? 'Đang gửi ảnh cho AI đọc… (thường 10–30 giây)' : 'Đang đọc hóa đơn bằng mô hình nội bộ… (thường 10–60 giây tùy máy chủ)'}</span></div>`;
          el.querySelectorAll('.scan-opt').forEach(x => x.classList.add('busy'));
          try { const r = await VM.ai.ocrInvoice(file); VM.store.log('OCR hóa đơn', 'Sổ hóa đơn', `${r.data.supplier} · ${r.data.invoiceNo} · ${r.data.lines.length} dòng`); done(r.data, 'ocr', r.image); }
          catch (err) { el.querySelectorAll('.scan-opt').forEach(x => x.classList.remove('busy')); fail(err.message); }
          e.target.value = '';
        };
      },
    });
  }

  VM.invoices = { openEditor, openScan };
  VM.ui.register({ id: 'invoices', title: 'Sổ hóa đơn', group: 'invoices', icon: 'file', render, detail: true,
    keys: [['S', 'Quét hóa đơn'], ['N', 'Ghi tay'], ['Q', 'Copy quyết toán trong ngày'], ['Enter', 'Thêm dòng hàng']],
    tour: () => [
      { el: '#iScan', title: 'Quét hóa đơn', text: 'Phím <kbd>S</kbd>. Chọn file XML hóa đơn điện tử (chính xác 100%) hoặc chụp ảnh hóa đơn giấy để AI đọc. Ô do máy đọc được tô <b class="tour-hot">vàng</b>.' },
      { el: '#iNew', title: 'Ghi tay', text: 'Phím <kbd>N</kbd>. Bước đầu luôn là <b>quét mã QR trên hóa đơn hoặc gõ số hóa đơn</b> – app kiểm tra trùng ngay, sau đó mới mở các ô khác.' },
      { el: '#iKpis', title: 'Việc cần làm', text: 'Hàng về chưa có HĐ · chờ bàn giao NVD · chờ nhập hệ thống. Bấm vào ô để lọc nhanh.' },
      { el: '#iTabs', title: 'Trạng thái hóa đơn', text: 'Hàng về → nhận HĐ → bàn giao NVD → nhập hệ thống.' },
      { el: '#iTable [data-next], #iTable', title: 'Chuyển bước tiếp theo', text: 'Nút trên mỗi dòng đưa hóa đơn sang bước kế tiếp. Nút copy bên cạnh copy 3 ô cho file quyết toán: ngày hàng về · SL tổng · số HĐ.' },
      { el: '#iDay', title: 'Copy quyết toán cả ngày', text: 'Phím <kbd>Q</kbd>. Copy một lần 3 trường <b>Ngày hàng về · SL tổng · Số HĐ</b> của mọi hóa đơn trong ngày, rồi dán vào file quyết toán. Có xem trước, đổi ngày bằng ‹ ›.' },
      { el: '#iXls', title: 'In & xuất Excel', text: 'In sổ, phiếu bàn giao hoặc xuất Excel (sheet đầu là “Quyết toán”).' },
    ],
    subs: () => {
      const all = S().invoices, c = st => all.filter(i => i.status === st).length;
      return [
        { arg: 'scan', label: 'Quét hóa đơn (XML / OCR)', icon: 'scan', hot: true },
        { arg: 'new', label: 'Ghi tay / hàng về', icon: 'edit' },
        { arg: 'qt', label: 'Copy quyết toán trong ngày', icon: 'copy', hot: true },
        { arg: 'pending', label: 'Chưa xong', n: all.filter(isPending).length },
        { arg: 'no_invoice', label: 'Hàng về chưa có HĐ', n: c('no_invoice'), tone: 'bad' },
        { arg: 'received', label: 'Chờ bàn giao NVD', n: c('received'), tone: 'warn' },
        { arg: 'handed', label: 'Chờ nhập hệ thống', n: c('handed') },
        { arg: 'all', label: 'Tất cả hóa đơn' },
      ];
    },
    badge: () => { const p = S().invoices.filter(isPending), bad = p.some(i => i.status === 'no_invoice'); return { n: p.length, soft: !bad, title: `${p.length} hóa đơn chưa nhập hệ thống` }; } });
})(window.VM);
