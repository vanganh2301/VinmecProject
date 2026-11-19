/* Danh mục hàng – thêm/sửa/ngừng bán, quy đổi ĐVT, điều chỉnh tồn, nhập/xuất Excel */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money, num } = VM;
  const S = () => VM.store.state;
  const CAT = VM.store.CATEGORIES;
  const f = { q: '', cat: '', state: 'active' };
  let bar = null;

  // File mẫu: đúng 10 cột theo mẫu của khoa. Số lượng tồn tính theo "Đơn vị tính" của dòng.
  const HEAD = ['Mã hàng', 'Tên hàng', 'Nhóm hàng', 'Hàm lượng', 'Kho', 'Đơn vị tính', 'Giá bán', 'Số lượng tồn', 'Hạn sử dụng', 'Số lô'];
  const SAMPLE = [
    ['SAP011', 'Paracetamol 500mg viên nén', 'Thuốc OTC', '500mg', 'Kho Nhà thuốc', 'Hộp', 42000, 100, '20/12/2028', 'LOT-SAMPLE-1'],
    ['TPCN05', 'Canxi Nano D3', 'Thực phẩm chức năng', 'Hộp 60 viên', 'Kho Nhà thuốc', 'Hộp', 135000, 50, '15/08/2028', 'LOT-SAMPLE-2'],
    ['VTYT05', 'Bông băng gạc y tế tiệt trùng', 'Vật tư y tế', 'Gói 10 miếng', 'Kho Nhà thuốc', 'Gói', 18000, 200, '30/11/2029', 'LOT-SAMPLE-3'],
  ];
  // Xuất Excel: 10 cột như file mẫu (ĐVT = ĐVT nhỏ nhất) + các cột phụ để nhập lại không mất quy đổi / mã SAP / mã vạch
  const EXTRA = ['Mã SAP', 'Mã vạch (GTIN)', 'Hoạt chất', 'Tồn tối thiểu', 'ĐVT 2', 'Hệ số 2', 'Giá 2', 'ĐVT 3', 'Hệ số 3', 'Giá 3', 'ĐVT bán mặc định', 'Trạng thái'];
  const MAP = {
    mahang: 'code', ma: 'code', code: 'code', tenhang: 'name', ten: 'name', tenthuoc: 'name', name: 'name',
    nhomhang: 'category', nhom: 'category', nhomotctpcnvtyt: 'category', category: 'category', hamluong: 'strength', kho: 'store',
    donvitinh: 'u1', dvt: 'u1', dvtnhonhat: 'u1', giaban: 'p1', gia: 'p1', giadvtnhonhat: 'p1',
    soluongton: 'qtyU', soluong: 'qtyU', tondvtnhonhat: 'stock', ton: 'stock', tonkho: 'stock',
    hansudung: 'expiry', handung: 'expiry', hsd: 'expiry', handungddmmyyyy: 'expiry', solo: 'lot', lo: 'lot',
    masap: 'sap', sap: 'sap', mavachgtin: 'gtin', mavach: 'gtin', gtin: 'gtin', barcode: 'gtin', ean: 'gtin', hoatchat: 'ingredient', nhomduocly: 'group',
    tontoithieu: 'minStock', dvt2: 'u2', heso2: 'f2', gia2: 'p2', dvt3: 'u3', heso3: 'f3', gia3: 'p3', dvtbanmacdinh: 'defaultUnit', dvtmacdinh: 'defaultUnit', trangthai: 'status',
  };
  function catFrom(v) {
    const n = VM.normalize(v).replace(/\s+/g, '');
    if (!n) return '';
    if (/tpcn|thucpham|chucnang|supp/.test(n)) return 'supp';
    if (/vattu|vtyt|device|thietbi/.test(n)) return 'device';
    if (/thuoc|otc/.test(n)) return 'otc';
    return 'other';
  }
  const storeLabel = code => code === 'Y001' ? 'Kho Nhà thuốc' : code === 'Y003' ? 'Kho nội trú' : VM.store.storeName(code);
  function storeFrom(v) {
    const raw = String(v || '').trim(), n = VM.normalize(raw).replace(/\s+/g, '');
    if (!n) return '';
    const st = S().settings.stores;
    const hit = st.find(x => VM.normalize(x.code) === n) || (/nhathuoc|ngoaitru/.test(n) && st.find(x => x.code === 'Y001')) || (/noitru/.test(n) && st.find(x => x.code === 'Y003'))
      || st.find(x => { const m = VM.normalize(x.name).replace(/\s+/g, ''); return m && (n.includes(m) || m.includes(n.replace(/^kho/, ''))); });
    return hit ? hit.code : raw;
  }
  const sortUnits = us => us.slice().sort((a, b) => a.factor - b.factor);
  const defUnit = p => p.units.find(u => u.name === p.defaultUnit) || p.units[0];
  // Tồn quy theo 1 ĐVT: "120" hoặc "120 +5 viên"
  function stockIn(p, u) {
    const base = VM.store.baseUnit(p), w = Math.floor(p.stock / u.factor), r = p.stock % u.factor;
    if (!w && r) return `${num(r)} ${esc(base.name.toLowerCase())}`;
    return num(w) + (r ? ` <small>+${num(r)} ${esc(base.name.toLowerCase())}</small>` : '');
  }

  function base() { return S().products.filter(p => f.state === 'all' || (f.state === 'active' ? p.active : f.state === 'inactive' ? !p.active : VM.store.productIssue(p))); }
  function list() {
    const l = base().filter(p => !f.cat || p.category === f.cat);
    return f.q.trim() ? VM.search(l, f.q, ['name', 'code', 'sap', 'ingredient', 'gtin', 'strength']) : l.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  function render(view, top, arg) {
    // #/catalog/alert (từ cảnh báo tồn thấp ở màn Bán hàng) → mở sẵn bộ lọc "Cần chú ý", mọi nhóm
    if (arg === 'alert') { f.state = 'alert'; f.cat = ''; f.q = ''; }
    top.innerHTML = `<input type="file" id="impFile" accept=".xlsx,.csv" hidden>
      <button class="btn hide-m" id="tplBtn" title="Tải file Excel mẫu (10 cột)">${icon('sheet')}<span class="label">File mẫu</span></button>
      <button class="btn hide-m" id="impBtn">${icon('upload')}<span class="label">Nhập Excel</span></button>
      <button class="btn" id="expBtn">${icon('download')}<span class="label">Xuất Excel</span></button>
      <button class="btn primary" id="addBtn">${icon('plus')}<span class="label">Thêm mặt hàng</span></button>`;
    view.innerHTML = `<div class="card ct-card">
        <div class="toolbar">
          <div class="input-icon grow">${icon('search')}<input class="input" id="cQ" type="search" placeholder="Tên, hàm lượng, mã hàng, mã SAP, mã vạch…" value="${esc(f.q)}"></div>
          <div class="seg" id="cState"><button data-s="active">Đang bán</button><button data-s="alert">${icon('alert', 's')}Cần chú ý</button><button data-s="inactive">Ngừng bán</button><button data-s="all">Tất cả</button></div>
        </div>
        <div class="ct-bar" id="cBar"></div>
        <div class="table-wrap" id="cTable"></div></div>`;
    $('#cQ').oninput = VM.debounce(() => { f.q = $('#cQ').value; draw(); }, 150);
    $$('#cState [data-s]').forEach(b => b.onclick = () => { f.state = b.dataset.s; draw(); });
    bar = VM.ui.catBar($('#cBar'), {
      cat: f.cat,
      counts: () => { const c = { '': 0 }; base().forEach(p => { c[''] += 1; c[p.category] = (c[p.category] || 0) + 1; }); return c; },
      onCat: k => { f.cat = k; draw(); },
    });
    $('#addBtn').onclick = () => openEditor();
    $('#expBtn').onclick = exportXls;
    $('#tplBtn').onclick = () => VM.xlsx.exportXlsx({ 'Danh mục': [HEAD, ...SAMPLE] }, 'Vinmec_MauNhap_DanhMuc.xlsx');
    $('#impBtn').onclick = () => $('#impFile').click();
    $('#impFile').onchange = e => { const file = e.target.files[0]; e.target.value = ''; if (file) importFile(file); };
    draw();
  }

  function draw() {
    $$('#cState [data-s]').forEach(b => b.classList.toggle('active', b.dataset.s === f.state));
    if (bar) bar.refresh();
    const l = list();
    if (!l.length) { $('#cTable').innerHTML = VM.ui.empty('package', 'Không có mặt hàng', f.cat ? `Nhóm “${esc(CAT[f.cat].label)}” chưa có mặt hàng phù hợp.` : 'Thêm mặt hàng mới hoặc nhập từ file Excel.', `<button class="btn primary" onclick="VM.catalog.openEditor()">${icon('plus', 's')} Thêm mặt hàng</button>`); return; }
    const warnDays = S().settings.expiryWarnDays;
    $('#cTable').innerHTML = `<table class="t ct"><thead><tr>
        <th class="ct-code">Mã hàng</th><th class="ct-name">Tên hàng</th><th class="ct-cat">Nhóm</th><th class="ct-str xd">Hàm lượng</th><th class="ct-kho xd">Kho</th>
        <th class="ct-unit">ĐVT</th><th class="ct-price num">Giá bán</th><th class="ct-stock num">Tồn</th><th class="ct-exp">Hạn dùng</th><th class="ct-lot xd">Số lô</th><th class="ct-act"><span class="sr-only">Thao tác</span></th></tr></thead><tbody>
      ${l.map(p => {
        const iss = VM.store.productIssue(p), u = defUnit(p), d = VM.daysUntil(p.expiry), base = VM.store.baseUnit(p);
        const out = p.stock <= 0, low = !out && p.stock <= (p.minStock || 0);
        const expBad = d < 0, expWarn = !expBad && d <= warnDays;
        const conv = sortUnits(p.units).map(x => `${x.name}${x.factor > 1 ? ' = ' + num(x.factor) + ' ' + base.name.toLowerCase() : ''}: ${money(x.price)}`).join(' · ');
        const tip = [p.name, p.strength, p.ingredient && 'Hoạt chất: ' + p.ingredient, p.sap && 'SAP ' + p.sap, p.gtin && 'Mã vạch ' + p.gtin, iss && iss.text].filter(Boolean).join(' · ');
        const stockHtml = out ? `<span class="qchip bad">${icon('x', 's')}Hết hàng</span>` : low ? `<span class="qchip warn">${icon('alert', 's')}${stockIn(p, u)}</span>` : `<b>${stockIn(p, u)}</b>`;
        const expHtml = expBad ? `<span class="qchip bad">${icon('x', 's')}${VM.fmtDate(p.expiry)}</span>` : expWarn ? `<span class="qchip warn">${icon('clock', 's')}${VM.fmtDate(p.expiry)}</span>` : VM.fmtDate(p.expiry);
        return `<tr class="${!p.active ? 'off' : iss ? 'iss-' + iss.level : ''}" data-id="${p.id}">
          <td class="ct-code mono" title="${esc(p.sap ? 'Mã SAP ' + p.sap : '')}">${esc(p.code)}</td>
          <td class="ct-name" title="${esc(tip)}">${p.active ? '' : '<span class="tag mute">Ngừng bán</span>'}<b>${esc(p.name)}</b></td>
          <td class="ct-cat"><span class="tag ${p.category}" title="${esc(VM.store.catOf(p).label)}">${esc(VM.store.catOf(p).short)}</span></td>
          <td class="ct-str xd" title="${esc(p.strength || '')}">${esc(p.strength || '—')}</td>
          <td class="ct-kho xd" title="${esc(storeLabel(p.store) + ' (' + p.store + ')')}">${esc(storeLabel(p.store).replace(/^Kho /, ''))}</td>
          <td class="ct-unit" title="${esc(conv)}">${esc(u.name)}${p.units.length > 1 ? `<sup>+${p.units.length - 1}</sup>` : ''}</td>
          <td class="ct-price num" title="${esc(conv)}"><b>${money(u.price)}</b></td>
          <td class="ct-stock num" title="${esc(`${VM.store.stockText(p)} · ${num(p.stock)} ${base.name.toLowerCase()}${low ? ' · dưới mức tối thiểu ' + num(p.minStock) : ''}`)}">${stockHtml}</td>
          <td class="ct-exp" title="${esc(isFinite(d) ? (d < 0 ? 'Đã hết hạn ' + -d + ' ngày' : 'Còn ' + d + ' ngày') : '')}">${expHtml}</td>
          <td class="ct-lot mono xd" title="${esc(p.lot || '')}">${esc(p.lot || '—')}</td>
          <td class="ct-act"><div class="actions"><button class="btn sm icon" data-adj="${p.id}" title="Điều chỉnh tồn" aria-label="Điều chỉnh tồn ${esc(p.name)}">${icon('refresh', 's')}</button><button class="btn sm icon" data-edit="${p.id}" title="Sửa" aria-label="Sửa ${esc(p.name)}">${icon('edit', 's')}</button></div></td></tr>`;
      }).join('')}
      </tbody></table>`;
    $$('#cTable [data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); openEditor(b.dataset.edit); });
    $$('#cTable [data-adj]').forEach(b => b.onclick = e => { e.stopPropagation(); adjustStock(b.dataset.adj); });
    $$('#cTable tr[data-id]').forEach(tr => tr.ondblclick = () => openEditor(tr.dataset.id));
  }

  function unitRow(u = { name: '', factor: '', price: '' }) {
    return `<tr><td>${VM.ui.unitPick(u.name, 'data-un', { label: 'Đơn vị lớn hơn' })}</td><td><input class="input num" data-uf inputmode="numeric" value="${esc(u.factor)}" placeholder="10"></td><td><input class="input num" data-up inputmode="numeric" value="${u.price === '' ? '' : num(u.price)}" placeholder="0"></td><td><button class="btn ghost icon sm" data-urm aria-label="Xóa đơn vị">${icon('trash', 's')}</button></td></tr>`;
  }

  // Form thêm / sửa: 10 trường như file mẫu; mã SAP, mã vạch, quy đổi ĐVT… gom trong "Thông tin thêm"
  function openEditor(id) {
    const p = id ? VM.store.product(id) : null;
    const d = p || { code: '', sap: '', gtin: '', name: '', strength: '', ingredient: '', category: f.cat || 'otc', group: '', store: 'Y001', units: [{ name: 'Viên', factor: 1, price: '' }], defaultUnit: '', stock: '', minStock: 10, lot: '', expiry: '', active: true, image: '' };
    const us = sortUnits(d.units), main = us[0], extra = us.slice(1);
    VM.ui.modal({
      title: p ? 'Sửa mặt hàng' : 'Thêm mặt hàng', sub: p ? `<span class="mono">${esc(p.code)}</span> · cập nhật lần cuối ${VM.fmtDT(p.updatedAt)}` : 'Điền 10 thông tin giống file Excel mẫu. Dấu <span class="req">*</span> là bắt buộc.', ic: 'package', size: 'lg',
      body: `<div class="form-grid pe-grid">
        <div class="field c8"><label>Tên hàng <span class="req">*</span></label><input class="input" name="name" value="${esc(d.name)}" placeholder="VD: Paracetamol 500mg viên nén"></div>
        <div class="field c4"><label>Mã hàng <span class="req">*</span></label><input class="input mono" name="code" value="${esc(d.code)}" placeholder="VD: SAP011"></div>
        <div class="field c4 half"><label>Nhóm hàng <span class="req">*</span></label><select class="select" name="category">${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${d.category === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
        <div class="field c4 half"><label>Kho</label><select class="select" name="store">${S().settings.stores.map(x => `<option value="${esc(x.code)}" ${x.code === d.store ? 'selected' : ''}>${esc(storeLabel(x.code))}</option>`).join('')}${S().settings.stores.some(x => x.code === d.store) ? '' : `<option value="${esc(d.store)}" selected>${esc(d.store)}</option>`}</select></div>
        <div class="field c4"><label>Hàm lượng</label><input class="input" name="strength" value="${esc(d.strength || '')}" placeholder="500mg · Hộp 60 viên"></div>
        <div class="field c4"><label>Đơn vị tính <span class="req">*</span></label>${VM.ui.unitPick(main.name, 'name="unit" id="pUnit"', { label: 'Đơn vị tính nhỏ nhất' })}</div>
        <div class="field c4 half"><label>Giá bán (đ) <span class="req">*</span></label><input class="input num" name="price" inputmode="numeric" value="${main.price === '' ? '' : num(main.price)}" placeholder="0"></div>
        <div class="field c4 half"><label>Số lượng tồn</label><input class="input num" name="stock" inputmode="numeric" value="${d.stock === '' ? '' : d.stock}" placeholder="0" ${p ? 'readonly title="Dùng nút Điều chỉnh tồn để thay đổi"' : ''}>${p ? '<button type="button" class="linkbtn hint" id="pAdj">' + icon('refresh', 's') + ' Điều chỉnh tồn (có lý do)</button>' : '<span class="hint">Tính theo đơn vị tính đã chọn</span>'}</div>
        <div class="field c6 half"><label>Hạn sử dụng <span class="req">*</span></label><input class="input" type="date" name="expiry" value="${esc(d.expiry)}"></div>
        <div class="field c6 half"><label>Số lô</label><input class="input mono" name="lot" value="${esc(d.lot)}"></div>
        <details class="c12 pe-more"><summary>${icon('chevr', 's')}<b>Thông tin thêm</b><span class="muted">không bắt buộc · mã SAP, mã vạch, quy đổi Vỉ/Hộp, tồn tối thiểu${p ? ', ngừng bán' : ''}</span></summary>
          <div class="form-grid" style="margin-top:12px">
            <div class="field c4"><label>Mã SAP</label><input class="input mono" name="sap" value="${esc(d.sap || '')}"><span class="hint">Cần cho file điều chuyển SAP</span></div>
            <div class="field c4"><label>Mã vạch (GTIN)</label><input class="input mono" name="gtin" value="${esc(d.gtin || '')}" placeholder="Quét mã trên hộp" inputmode="numeric"><span class="hint">Quét được mã 2D (DataMatrix)</span></div>
            <div class="field c4"><label>Hoạt chất</label><input class="input" name="ingredient" value="${esc(d.ingredient || '')}"></div>
            <div class="c12"><div class="label-t" style="margin-bottom:6px">Đơn vị lớn hơn <span class="muted small">— hệ số = số <b id="pBaseN">${esc(main.name || 'ĐVT')}</b> trong 1 đơn vị (VD: 1 hộp = 10 vỉ)</span></div>
              <table class="t lines-tbl"><thead><tr><th>Đơn vị</th><th style="width:120px">Hệ số</th><th style="width:160px">Giá bán (đ)</th><th style="width:44px"></th></tr></thead><tbody id="uRows">${extra.map(unitRow).join('')}</tbody></table>
              <button class="btn ghost sm" id="uAdd" style="margin-top:6px">${icon('plus', 's')} Thêm đơn vị</button></div>
            <div class="field c4"><label>ĐVT bán mặc định</label><select class="select" name="defaultUnit" id="defUnit"></select></div>
            <div class="field c4"><label>Tồn tối thiểu (cảnh báo)</label><input class="input num" name="minStock" inputmode="numeric" value="${d.minStock}"></div>
            <label class="check c4"><input type="checkbox" name="active" ${d.active ? 'checked' : ''}> Đang bán (hiện ở màn Bán hàng)</label>
          </div></details>
      </div><div class="alert bad hidden" id="pErr" style="margin-top:12px"></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('check', 's')} Lưu mặt hàng</button>`,
      onMount(el, close) {
        const adjB = el.querySelector('#pAdj');
        if (adjB) adjB.onclick = () => { close(); setTimeout(() => adjustStock(p.id), 0); };
        const rows = el.querySelector('#uRows'), defSel = el.querySelector('#defUnit'), unitIn = el.querySelector('#pUnit');
        const extras = () => $$('tr', rows).map(tr => ({ name: tr.querySelector('[data-un]').value.trim(), factor: Math.floor(VM.parseNum(tr.querySelector('[data-uf]').value)) || 0, price: Math.round(VM.parseNum(tr.querySelector('[data-up]').value)) })).filter(u => u.name || u.price);
        const syncDef = () => {
          const cur = defSel.value || d.defaultUnit, names = [unitIn.value.trim(), ...extras().map(u => u.name)].filter(Boolean);
          defSel.innerHTML = names.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('');
          el.querySelector('#pBaseN').textContent = unitIn.value.trim() || 'ĐVT';
        };
        const bindRows = () => { $$('[data-urm]', rows).forEach(b => b.onclick = e => { e.preventDefault(); b.closest('tr').remove(); syncDef(); }); $$('[data-un]', rows).forEach(i => i.onchange = syncDef); };
        el.querySelector('#uAdd').onclick = e => { e.preventDefault(); rows.insertAdjacentHTML('beforeend', unitRow()); VM.ui.bindUnitPick(rows); bindRows(); rows.lastElementChild.querySelector('select').focus(); };
        unitIn.oninput = syncDef;
        bindRows(); syncDef();
        if (!p) setTimeout(() => el.querySelector('[name=name]').focus(), 30);
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = () => {
          const v = VM.ui.formData(el), errs = [];
          const mainU = { name: String(v.unit || '').trim(), factor: 1, price: Math.round(VM.parseNum(v.price)) };
          const ex = extras(), units = [mainU, ...ex];
          if (!v.code) errs.push('Nhập mã hàng');
          else if (S().products.some(x => x.code.toLowerCase() === v.code.toLowerCase() && x !== p)) errs.push('Mã hàng đã tồn tại');
          if (!v.name) errs.push('Nhập tên hàng');
          if (!mainU.name) errs.push('Nhập đơn vị tính');
          if (!(mainU.price > 0)) errs.push('Nhập giá bán');
          if (ex.some(u => !u.name)) errs.push('Đơn vị lớn hơn: thiếu tên');
          if (ex.some(u => u.factor < 2)) errs.push('Hệ số quy đổi của đơn vị lớn hơn phải ≥ 2');
          if (ex.some(u => !(u.price > 0))) errs.push('Nhập giá cho mọi đơn vị');
          if (new Set(units.map(u => u.name.toLowerCase())).size !== units.length) errs.push('Tên đơn vị bị trùng');
          if (!v.expiry) errs.push('Nhập hạn sử dụng');
          v.gtin = String(v.gtin || '').trim();
          if (v.gtin) {
            const g = VM.gs1(v.gtin);
            v.gtin = (g && g.gtin) || v.gtin.replace(/\D/g, '');
            if (!/^\d{8,14}$/.test(v.gtin) || VM.gtinCheck(v.gtin.slice(0, -1)) !== v.gtin.slice(-1)) errs.push('Mã vạch (GTIN) không hợp lệ – kiểm tra lại số cuối');
            else if (S().products.some(x => x !== p && x.gtin && VM.gtinKey(x.gtin) === VM.gtinKey(v.gtin))) errs.push('Mã vạch đã gắn cho mặt hàng khác');
          }
          if (errs.length) {
            const e = el.querySelector('#pErr'); e.innerHTML = icon('alert', 's') + '<span>' + errs.map(esc).join(' · ') + '</span>'; e.classList.remove('hidden');
            if (errs.some(x => /SAP|vạch|đơn vị lớn|Hệ số|mọi đơn vị|trùng/.test(x))) el.querySelector('.pe-more').open = true;
            return;
          }
          const obj = p || { id: VM.uid('p_'), group: '', image: '' };
          const sorted = sortUnits(units);
          const priceChanged = p && JSON.stringify(sortUnits(p.units).map(u => [u.name, u.price])) !== JSON.stringify(sorted.map(u => [u.name, u.price]));
          Object.assign(obj, { code: v.code, sap: v.sap || '', gtin: v.gtin, name: v.name, strength: v.strength || '', ingredient: v.ingredient || '', category: v.category, store: v.store, units: sorted, defaultUnit: sorted.some(u => u.name === v.defaultUnit) ? v.defaultUnit : mainU.name, minStock: Math.max(0, Math.floor(VM.parseNum(v.minStock))), lot: v.lot, expiry: v.expiry, active: p ? v.active : true, updatedAt: VM.iso() });
          if (!p) { obj.stock = Math.max(0, Math.floor(VM.parseNum(v.stock))); S().products.push(obj); VM.store.log('Thêm mặt hàng', 'Danh mục', obj.name, obj.code); }
          else VM.store.log(priceChanged ? 'Sửa mặt hàng (đổi giá)' : 'Sửa mặt hàng', 'Danh mục', priceChanged ? sorted.map(u => `${u.name}: ${money(u.price)}`).join(', ') : obj.name, obj.code);
          VM.store.save('product'); close(); draw(); VM.ui.done('Đã lưu mặt hàng', obj.name);
        };
      },
    });
  }

  function adjustStock(id) {
    const p = VM.store.product(id), base = VM.store.baseUnit(p);
    VM.ui.modal({
      title: 'Điều chỉnh tồn kho', sub: `${esc(p.name)} · hiện tại <b>${num(p.stock)} ${esc(base.name.toLowerCase())}</b> (${esc(VM.store.stockText(p))})`, ic: 'refresh',
      body: `<div class="seg" style="margin-bottom:14px"><button data-m="set" class="active">Đặt số tồn thực tế</button><button data-m="add">Nhập thêm</button><button data-m="sub">Giảm</button></div>
        <div class="form-grid"><div class="field c6 half"><label>Số lượng</label><input class="input num" id="aQty" inputmode="numeric" placeholder="0"></div>
        <div class="field c6 half"><label>Đơn vị</label><select class="select" id="aUnit">${p.units.map(u => `<option value="${u.factor}">${esc(u.name)}</option>`).join('')}</select></div>
        <div class="field c12"><label>Lý do <span class="req">*</span></label><input class="input" id="aWhy" list="whyList" placeholder="VD: Kiểm kê 17/11, hàng về theo HĐ 0001523…"><datalist id="whyList"><option>Kiểm kê thực tế</option><option>Nhập hàng theo hóa đơn</option><option>Nhận điều chuyển từ kho</option><option>Hàng hỏng / vỡ</option><option>Trả nhà cung cấp</option></datalist></div></div>
        <div class="alert info" style="margin-top:12px" id="aPrev">${icon('info', 's')}<span>Nhập số lượng để xem trước.</span></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('check', 's')} Lưu điều chỉnh</button>`,
      onMount(el, close) {
        let mode = 'set';
        const calc = () => { const q = Math.floor(VM.parseNum(el.querySelector('#aQty').value)) * +el.querySelector('#aUnit').value; return mode === 'set' ? q : mode === 'add' ? p.stock + q : p.stock - q; };
        const prev = () => { const n = calc(); el.querySelector('#aPrev').innerHTML = `${icon('info', 's')}<span>Tồn mới: <b>${num(n)} ${esc(base.name.toLowerCase())}</b> (chênh lệch ${n - p.stock >= 0 ? '+' : ''}${num(n - p.stock)})</span>`; };
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('active', x === b)); prev(); });
        el.querySelector('#aQty').oninput = prev; el.querySelector('#aUnit').onchange = prev;
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = () => {
          const why = el.querySelector('#aWhy').value.trim(), n = calc();
          if (!el.querySelector('#aQty').value.trim()) return VM.ui.toast('Nhập số lượng', 'warn');
          if (!why) return VM.ui.toast('Nhập lý do điều chỉnh', 'warn');
          if (n < 0) return VM.ui.toast('Tồn không thể âm', 'bad');
          VM.store.log('Điều chỉnh tồn', 'Danh mục', `${p.name}: ${p.stock} → ${n} ${base.name} · ${why}`, p.code);
          p.stock = n; p.updatedAt = VM.iso();
          VM.store.save('stock'); close(); draw(); VM.ui.done('Đã cập nhật tồn kho');
        };
      },
    });
  }

  function toRow(p) {
    const u = sortUnits(p.units);
    return [p.code, p.name, VM.store.catOf(p).label, p.strength || '', storeLabel(p.store), u[0]?.name, u[0]?.price, p.stock, VM.fmtDate(p.expiry), p.lot || '',
      p.sap || '', p.gtin || '', p.ingredient || '', p.minStock, u[1]?.name || '', u[1]?.factor || '', u[1]?.price || '', u[2]?.name || '', u[2]?.factor || '', u[2]?.price || '', p.defaultUnit, p.active ? 'Đang bán' : 'Ngừng bán'];
  }
  function exportXls() { VM.xlsx.exportXlsx({ 'Danh mục': [[...HEAD, ...EXTRA], ...S().products.map(toRow)] }, `vinmec_danh_muc_${VM.fileStamp()}.xlsx`); }

  // Đọc 1 dòng Excel → { o, units, stock, expiry, errs, exists }
  function parseRow(o, line) {
    const errs = [], exists = S().products.find(p => p.code.toLowerCase() === String(o.code || '').toLowerCase());
    const str = k => (o[k] === undefined || o[k] === null ? '' : String(o[k]).trim());
    if (!str('code')) errs.push('thiếu mã');
    if (!str('name')) errs.push('thiếu tên');
    const main = str('u1') ? { name: str('u1'), factor: 1, price: Math.round(VM.parseNum(o.p1)) } : null;
    const extra = [[o.u2, o.f2, o.p2], [o.u3, o.f3, o.p3]].filter(([n]) => n && String(n).trim()).map(([name, factor, price]) => ({ name: String(name).trim(), factor: Math.floor(VM.parseNum(factor)) || 0, price: Math.round(VM.parseNum(price)) }));
    let units = null, rowFactor = 1;
    if (!main) errs.push('thiếu ĐVT');
    else if (extra.length || !exists) {
      units = [main, ...extra];
      if (!(main.price > 0)) errs.push('thiếu giá');
      if (extra.some(u => u.factor < 2 || !(u.price > 0))) errs.push('ĐVT 2/3 thiếu hệ số hoặc giá');
    } else {
      // Mặt hàng đã có, file chỉ có 1 ĐVT: khớp với ĐVT sẵn có để cập nhật giá + quy đổi số tồn
      const hit = exists.units.find(x => VM.normalize(x.name) === VM.normalize(main.name));
      if (hit) { units = exists.units.map(x => Object.assign({}, x, x === hit && main.price > 0 ? { price: main.price } : {})); rowFactor = hit.factor; }
      else if (exists.units.length === 1) { units = [{ name: main.name, factor: 1, price: main.price > 0 ? main.price : exists.units[0].price }]; }
      else errs.push(`ĐVT “${main.name}” không có trong mặt hàng (${exists.units.map(x => x.name).join(' / ')})`);
    }
    if (units && new Set(units.map(u => u.name.toLowerCase())).size !== units.length) errs.push('ĐVT trùng');
    const expiry = VM.parseDate(o.expiry) || (exists && !str('expiry') ? exists.expiry : '');
    if (!expiry) errs.push(str('expiry') ? 'HSD không hợp lệ' : 'thiếu HSD');
    let stock;
    if (str('stock') !== '') stock = Math.max(0, Math.floor(VM.parseNum(o.stock)));
    else if (str('qtyU') !== '') stock = Math.max(0, Math.round(VM.parseNum(o.qtyU) * rowFactor));
    return { line, o, units, stock, expiry, errs, exists, cat: catFrom(o.category) };
  }

  async function importFile(file) {
    let rows;
    try { rows = await VM.xlsx.readTable(file); } catch (e) { VM.ui.toast(e.message, 'bad', 6000); return; }
    if (rows.length < 2) { VM.ui.toast('File không có dữ liệu', 'warn'); return; }
    const keys = rows[0].map(h => MAP[VM.normalize(h).replace(/[^a-z0-9]/g, '')] || null);
    if (!keys.includes('code') || !keys.includes('name')) { VM.ui.toast('Thiếu cột “Mã hàng” hoặc “Tên hàng”. Hãy dùng file mẫu.', 'bad', 6000); return; }
    const parsed = rows.slice(1).filter(r => r.some(c => String(c ?? '').trim())).map((r, i) => {
      const o = {}; keys.forEach((k, j) => { if (k && o[k] === undefined) o[k] = typeof r[j] === 'string' ? r[j].trim() : r[j]; });
      return parseRow(o, i + 2);
    });
    const ok = parsed.filter(x => !x.errs.length), bad = parsed.filter(x => x.errs.length);
    VM.ui.modal({
      title: 'Xem trước dữ liệu nhập', sub: esc(file.name), ic: 'upload', size: 'xl',
      body: `<div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="card kpi"><div class="kpi-ic">${icon('plus')}</div><div><span>Thêm mới</span><strong>${ok.filter(x => !x.exists).length}</strong></div></div><div class="card kpi"><div class="kpi-ic info">${icon('refresh')}</div><div><span>Cập nhật theo mã</span><strong>${ok.filter(x => x.exists).length}</strong></div></div><div class="card kpi"><div class="kpi-ic ${bad.length ? 'danger' : ''}">${icon('alert')}</div><div><span>Lỗi – bỏ qua</span><strong style="color:${bad.length ? 'var(--danger)' : 'inherit'}">${bad.length}</strong></div></div></div>
        ${bad.length ? `<div class="alert bad" style="margin-bottom:12px">${icon('alert', 's')}<div>${bad.slice(0, 8).map(x => `Dòng ${x.line}: ${esc(x.errs.join(', '))}`).join('<br>')}${bad.length > 8 ? '<br>…' : ''}</div></div>` : ''}
        ${ok.length ? `<div class="table-wrap imp-prev"><table class="t"><thead><tr><th></th><th>Mã hàng</th><th>Tên hàng</th><th>Nhóm</th><th>Hàm lượng</th><th>Kho</th><th>ĐVT</th><th class="num">Giá bán</th><th class="num">Tồn</th><th>HSD</th><th>Số lô</th></tr></thead><tbody>
          ${ok.slice(0, 12).map(x => { const c = x.cat || (x.exists && x.exists.category) || 'other', u = x.units[0]; return `<tr><td>${x.exists ? VM.ui.pill('info', 'Cập nhật', 'refresh') : VM.ui.pill('ok', 'Mới', 'plus')}</td><td class="mono">${esc(x.o.code)}</td><td><b>${esc(x.o.name)}</b></td><td><span class="tag ${c}">${esc(CAT[c].short)}</span></td><td>${esc(x.o.strength ?? (x.exists && x.exists.strength) ?? '')}</td><td>${esc(storeLabel(storeFrom(x.o.store) || (x.exists && x.exists.store) || 'Y001'))}</td><td>${esc(u.name)}</td><td class="num">${money(u.price)}</td><td class="num">${x.stock === undefined ? '<span class="muted">giữ nguyên</span>' : num(x.stock)}</td><td>${VM.fmtDate(x.expiry)}</td><td class="mono">${esc(x.o.lot ?? '')}</td></tr>`; }).join('')}
          ${ok.length > 12 ? `<tr><td colspan="11" class="muted small">… và ${ok.length - 12} dòng nữa</td></tr>` : ''}</tbody></table></div>` : ''}
        <label class="check"><input type="checkbox" id="impStock" checked> Cập nhật cả số lượng tồn từ file (bỏ chọn để chỉ cập nhật thông tin & giá)</label>
        <div class="alert info">${icon('shield', 's')}<span>Hệ thống sẽ tự tạo bản sao lưu trước khi nhập.</span></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok ${ok.length ? '' : 'disabled'}>${icon('check', 's')} Nhập ${ok.length} dòng</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = async () => {
          const withStock = el.querySelector('#impStock').checked;
          await VM.backup.snapshot('Trước khi nhập Excel danh mục');
          ok.forEach(({ o, units, stock, expiry, exists, cat }) => {
            const p = exists || { id: VM.uid('p_'), stock: 0, active: true, image: '', group: '', minStock: 10 };
            const has = k => o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '';
            const sorted = sortUnits(units);
            const st = String(o.status || '');
            Object.assign(p, {
              code: String(o.code).trim(), name: String(o.name).trim(),
              category: cat || p.category || 'other',
              strength: has('strength') ? String(o.strength).trim() : (p.strength || ''),
              store: (has('store') && storeFrom(o.store)) || p.store || 'Y001',
              sap: has('sap') ? String(o.sap).trim() : (p.sap || ''), gtin: has('gtin') ? String(o.gtin).replace(/\D/g, '') : (p.gtin || ''),
              ingredient: has('ingredient') ? String(o.ingredient).trim() : (p.ingredient || ''), group: has('group') ? String(o.group).trim() : (p.group || ''),
              units: sorted, defaultUnit: sorted.find(u => u.name === String(o.defaultUnit || '')) ? String(o.defaultUnit) : sorted.find(u => u.name === p.defaultUnit) ? p.defaultUnit : sorted[0].name,
              minStock: has('minStock') ? Math.floor(VM.parseNum(o.minStock)) : (p.minStock ?? 10),
              lot: has('lot') ? String(o.lot).trim() : (p.lot || ''), expiry, updatedAt: VM.iso(),
            });
            if (/ngung/.test(VM.normalize(st))) p.active = false; else if (/dangban/.test(VM.normalize(st).replace(/\s+/g, ''))) p.active = true;
            if ((withStock || !exists) && stock !== undefined) p.stock = stock;
            if (!exists) S().products.push(p);
          });
          VM.store.log('Nhập Excel danh mục', 'Danh mục', `${file.name}: ${ok.length} dòng, ${bad.length} lỗi`);
          VM.store.save('import'); close(); draw(); VM.ui.done('Nhập danh mục thành công', `${ok.length} mặt hàng`);
        };
      },
    });
  }

  VM.catalog = { openEditor, catFrom, storeFrom, parseRow, HEAD };
  VM.ui.register({ id: 'catalog', title: 'Danh mục hàng', group: 'retail', icon: 'package', render, detail: true,
    badge: () => { const n = S().products.filter(p => p.active && VM.store.productIssue(p) && VM.store.productIssue(p).level === 'bad').length; return { n, title: n + ' mặt hàng hết hàng/hết hạn' }; },
    tour: () => [
      { el: '#cBar .cat-tabs', title: 'Lọc theo nhóm', text: 'Bấm <b>Thuốc</b>, <b>TPCN</b>, <b>Vật tư</b> hoặc <b>Khác</b> để chỉ xem nhóm đó; số bên cạnh là số mặt hàng.' },
      { el: '#cTable', title: 'Mỗi mặt hàng một dòng', text: 'Chỉ hiện thông tin chính. Bấm <b>Hiển thị tất cả</b> (góc trên) để xem thêm hàm lượng, kho, số lô. Ô <b>vàng</b> = sắp hết / cận hạn, ô <b>đỏ</b> = hết hàng / hết hạn. Nhấp đúp một dòng để sửa.' },
      { el: '#tplBtn', title: 'File mẫu & nhập Excel', text: 'Tải file mẫu 10 cột, điền rồi bấm <b>Nhập Excel</b>. App cho xem trước từng dòng trước khi ghi.' },
    ] });
})(window.VM);
