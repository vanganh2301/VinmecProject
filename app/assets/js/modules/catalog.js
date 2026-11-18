/* Danh mục hàng – thêm/sửa/ngừng bán, quy đổi ĐVT, điều chỉnh tồn, nhập/xuất Excel */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, money, num } = VM;
  const S = () => VM.store.state;
  const CAT = VM.store.CATEGORIES;
  const f = { q: '', cat: '', state: 'active' };

  const HEAD = ['Mã hàng', 'Mã SAP', 'Tên hàng', 'Hoạt chất', 'Nhóm (OTC/TPCN/VTYT)', 'Nhóm dược lý', 'Kho', 'ĐVT nhỏ nhất', 'Giá ĐVT nhỏ nhất', 'ĐVT 2', 'Hệ số 2', 'Giá 2', 'ĐVT 3', 'Hệ số 3', 'Giá 3', 'ĐVT bán mặc định', 'Tồn (ĐVT nhỏ nhất)', 'Tồn tối thiểu', 'Số lô', 'Hạn dùng (dd/mm/yyyy)', 'Mã vạch (GTIN)'];
  const MAP = { mahang: 'code', ma: 'code', code: 'code', masap: 'sap', sap: 'sap', tenhang: 'name', ten: 'name', tenthuoc: 'name', name: 'name', hoatchat: 'ingredient', nhomotctpcnvtyt: 'category', nhom: 'category', category: 'category', nhomduocly: 'group', kho: 'store', dvtnhonhat: 'u1', dvt: 'u1', donvitinh: 'u1', giadvtnhonhat: 'p1', gia: 'p1', giaban: 'p1', dvt2: 'u2', heso2: 'f2', gia2: 'p2', dvt3: 'u3', heso3: 'f3', gia3: 'p3', dvtbanmacdinh: 'defaultUnit', dvtmacdinh: 'defaultUnit', tondvtnhonhat: 'stock', ton: 'stock', tonkho: 'stock', tontoithieu: 'minStock', solo: 'lot', lo: 'lot', handungddmmyyyy: 'expiry', handung: 'expiry', hsd: 'expiry', hansudung: 'expiry', mavachgtin: 'gtin', mavach: 'gtin', gtin: 'gtin', barcode: 'gtin', ean: 'gtin' };
  const catFrom = v => { const n = VM.normalize(v); return /tpcn|thucpham|supp/.test(n) ? 'supp' : /vt|vattu|device/.test(n) ? 'device' : 'otc'; };

  function list() {
    let l = S().products.filter(p => (!f.cat || p.category === f.cat) && (f.state === 'all' || (f.state === 'active' ? p.active : f.state === 'inactive' ? !p.active : VM.store.productIssue(p))));
    return f.q.trim() ? VM.search(l, f.q, ['name', 'code', 'sap', 'ingredient', 'gtin']) : l.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  function render(view, top) {
    top.innerHTML = `<input type="file" id="impFile" accept=".xlsx,.csv" hidden>
      <button class="btn" id="tplBtn" title="Tải file Excel mẫu">${icon('sheet')}<span class="label">File mẫu</span></button>
      <button class="btn" id="impBtn">${icon('upload')}<span class="label">Nhập Excel</span></button>
      <button class="btn" id="expBtn">${icon('download')}<span class="label">Xuất Excel</span></button>
      <button class="btn primary" id="addBtn">${icon('plus')}<span class="label">Thêm mặt hàng</span></button>`;
    view.innerHTML = `<div class="page-note">${icon('info', 's')}Danh mục bán lẻ chỉ gồm <b>thuốc không kê đơn, thực phẩm chức năng và vật tư y tế</b>. Tồn kho tính theo đơn vị nhỏ nhất.</div>
      <div class="card"><div class="toolbar">
        <div class="input-icon grow">${icon('search')}<input class="input" id="cQ" type="search" placeholder="Tên, hoạt chất, mã hàng, mã SAP…" value="${esc(f.q)}"></div>
        <select class="select" id="cCat" aria-label="Nhóm hàng"><option value="">Mọi nhóm</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${f.cat === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        <div class="seg" id="cState"><button data-s="active">Đang bán</button><button data-s="alert">Cần chú ý</button><button data-s="inactive">Ngừng bán</button><button data-s="all">Tất cả</button></div>
      </div><div class="table-wrap" id="cTable"></div></div>`;
    $('#cQ').oninput = VM.debounce(e => { f.q = $('#cQ').value; draw(); }, 150);
    $('#cCat').onchange = e => { f.cat = e.target.value; draw(); };
    $$('#cState [data-s]').forEach(b => b.onclick = () => { f.state = b.dataset.s; draw(); });
    $('#addBtn').onclick = () => openEditor();
    $('#expBtn').onclick = exportXls;
    $('#tplBtn').onclick = () => VM.xlsx.exportXlsx({ 'Danh mục': [HEAD, ['OTC099', '10009999', 'Ibuprofen 400mg', 'Ibuprofen', 'OTC', 'Giảm đau – hạ sốt', 'Y001', 'Viên', 1500, 'Vỉ', 10, 14000, 'Hộp', 100, 130000, 'Vỉ', 500, 50, 'IB2501A', '31/12/2027']] }, 'mau_danh_muc_ban_le.xlsx');
    $('#impBtn').onclick = () => $('#impFile').click();
    $('#impFile').onchange = e => { const file = e.target.files[0]; e.target.value = ''; if (file) importFile(file); };
    draw();
  }

  function draw() {
    $$('#cState [data-s]').forEach(b => b.classList.toggle('active', b.dataset.s === f.state));
    const l = list();
    if (!l.length) { $('#cTable').innerHTML = VM.ui.empty('package', 'Không có mặt hàng', 'Thêm mặt hàng mới hoặc nhập từ file Excel.', `<button class="btn primary" onclick="VM.catalog.openEditor()">${icon('plus', 's')} Thêm mặt hàng</button>`); return; }
    $('#cTable').innerHTML = `<table class="t"><thead><tr><th>Mặt hàng</th><th>Nhóm</th><th class="hide-m">Kho</th><th>Giá bán</th><th class="num">Tồn</th><th class="hide-m">Lô · HSD</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${l.map(p => { const iss = VM.store.productIssue(p); return `<tr class="${p.active ? '' : 'done'}">
        <td><div class="t-title">${esc(p.name)}</div><div class="t-sub"><span class="mono">${esc(p.code)}</span>${p.sap ? ' · SAP <span class="mono">' + esc(p.sap) + '</span>' : ''}${p.ingredient ? ' · ' + esc(p.ingredient) : ''}</div></td>
        <td><span class="tag ${p.category}">${CAT[p.category].short}</span><div class="t-sub">${esc(p.group || '')}</div></td>
        <td class="hide-m"><span class="store">${esc(p.store)}</span></td>
        <td>${p.units.map(u => `<div class="small" style="white-space:nowrap"><b>${money(u.price)}</b> / ${esc(u.name.toLowerCase())}${u.factor > 1 ? ` <span class="muted">(${u.factor})</span>` : ''}</div>`).join('')}</td>
        <td class="num"><b>${esc(VM.store.stockText(p))}</b><div class="t-sub">${num(p.stock)} ${esc(VM.store.baseUnit(p).name.toLowerCase())}</div></td>
        <td class="hide-m"><span class="mono">${esc(p.lot || '—')}</span><div class="t-sub">${VM.fmtDate(p.expiry)}</div></td>
        <td>${iss ? VM.ui.pill(iss.level, iss.text, 'alert') : VM.ui.pill('ok', 'Sẵn sàng', 'check')}</td>
        <td><div class="actions"><button class="btn sm" data-adj="${p.id}" title="Điều chỉnh tồn">${icon('refresh', 's')}<span class="hide-m">Tồn</span></button><button class="btn sm" data-edit="${p.id}">${icon('edit', 's')}<span class="hide-m">Sửa</span></button></div></td></tr>`; }).join('')}
      </tbody></table>`;
    $$('#cTable [data-edit]').forEach(b => b.onclick = () => openEditor(b.dataset.edit));
    $$('#cTable [data-adj]').forEach(b => b.onclick = () => adjustStock(b.dataset.adj));
  }

  function unitRow(u = { name: '', factor: '', price: '' }) {
    return `<tr><td><input class="input" data-un value="${esc(u.name)}" placeholder="Viên / Vỉ / Hộp" list="unitNames"></td><td><input class="input num" data-uf inputmode="numeric" value="${esc(u.factor)}" placeholder="1"></td><td><input class="input num" data-up inputmode="numeric" value="${u.price === '' ? '' : num(u.price)}" placeholder="0"></td><td><button class="btn ghost icon sm" data-urm aria-label="Xóa đơn vị">${icon('trash', 's')}</button></td></tr>`;
  }

  function openEditor(id) {
    const p = id ? VM.store.product(id) : null;
    const d = p || { code: '', sap: '', gtin: '', name: '', ingredient: '', category: 'otc', group: '', store: 'Y001', units: [{ name: 'Viên', factor: 1, price: '' }], defaultUnit: 'Viên', stock: 0, minStock: 10, lot: '', expiry: '', active: true, image: '' };
    let image = d.image;
    VM.ui.modal({
      title: p ? 'Sửa mặt hàng' : 'Thêm mặt hàng', sub: p ? `<span class="mono">${esc(p.code)}</span> · cập nhật lần cuối ${VM.fmtDT(p.updatedAt)}` : 'Chỉ áp dụng cho thuốc không kê đơn, TPCN, vật tư y tế', ic: 'package', size: 'lg',
      body: `<div class="form-grid">
        <div class="field c4 half"><label>Mã hàng (OH) <span class="req">*</span></label><input class="input mono" name="code" value="${esc(d.code)}"></div>
        <div class="field c4 half"><label>Mã SAP</label><input class="input mono" name="sap" value="${esc(d.sap)}"></div>
        <div class="field c4"><label>Nhóm hàng <span class="req">*</span></label><select class="select" name="category">${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${d.category === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
        <div class="field c8"><label>Tên hàng (gồm hàm lượng) <span class="req">*</span></label><input class="input" name="name" value="${esc(d.name)}" placeholder="VD: Paracetamol 500mg"></div>
        <div class="field c4"><label>Hoạt chất</label><input class="input" name="ingredient" value="${esc(d.ingredient)}"></div>
        <div class="field c4"><label>Mã vạch (GTIN)</label><input class="input mono" name="gtin" value="${esc(d.gtin || '')}" placeholder="Quét mã trên hộp" inputmode="numeric"><span class="hint">Quét được mã 2D (DataMatrix) – app tự lấy GTIN</span></div>
        <div class="field c4"><label>Nhóm dược lý</label><input class="input" name="group" value="${esc(d.group)}" list="grpList"><datalist id="grpList">${[...new Set(S().products.map(x => x.group).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>
        <div class="field c4"><label>Kho</label><select class="select" name="store">${VM.ui.storeOptions(d.store)}</select></div>
        <div class="c12"><div class="label-t" style="margin-bottom:6px">Đơn vị tính & giá bán <span class="muted small">— hệ số = số đơn vị nhỏ nhất (VD: 1 hộp = 100 viên)</span></div>
          <table class="t lines-tbl"><thead><tr><th>Đơn vị</th><th style="width:120px">Hệ số</th><th style="width:160px">Giá bán (đ)</th><th style="width:44px"></th></tr></thead><tbody id="uRows">${d.units.map(unitRow).join('')}</tbody></table>
          <datalist id="unitNames"><option>Viên</option><option>Vỉ</option><option>Hộp</option><option>Chai</option><option>Lọ</option><option>Ống</option><option>Gói</option><option>Tuýp</option><option>Cái</option></datalist>
          <button class="btn ghost sm" id="uAdd" style="margin-top:6px">${icon('plus', 's')} Thêm đơn vị</button></div>
        <div class="field c4"><label>ĐVT bán mặc định</label><select class="select" name="defaultUnit" id="defUnit"></select></div>
        <div class="field c4 half"><label>Tồn hiện tại (ĐV nhỏ nhất)</label><input class="input num" name="stock" inputmode="numeric" value="${d.stock}" ${p ? 'readonly title="Dùng nút Điều chỉnh tồn để thay đổi"' : ''}>${p ? '<span class="hint">Dùng “Điều chỉnh tồn” để thay đổi (có lý do)</span>' : ''}</div>
        <div class="field c4 half"><label>Tồn tối thiểu (cảnh báo)</label><input class="input num" name="minStock" inputmode="numeric" value="${d.minStock}"></div>
        <div class="field c4 half"><label>Số lô</label><input class="input mono" name="lot" value="${esc(d.lot)}"></div>
        <div class="field c4 half"><label>Hạn dùng <span class="req">*</span></label><input class="input" type="date" name="expiry" value="${esc(d.expiry)}"></div>
        <div class="field c4"><label>Ảnh sản phẩm</label><input type="file" accept="image/*" id="imgIn" class="input" style="padding-top:9px"></div>
        <label class="check c12"><input type="checkbox" name="active" ${d.active ? 'checked' : ''}> Đang kinh doanh (hiển thị trên màn hình bán)</label>
      </div><div class="alert bad hidden" id="pErr" style="margin-top:12px"></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>${icon('check', 's')} Lưu mặt hàng</button>`,
      onMount(el, close) {
        const rows = el.querySelector('#uRows'), defSel = el.querySelector('#defUnit');
        const units = () => $$('tr', rows).map(tr => ({ name: tr.querySelector('[data-un]').value.trim(), factor: Math.floor(VM.parseNum(tr.querySelector('[data-uf]').value)) || 0, price: Math.round(VM.parseNum(tr.querySelector('[data-up]').value)) }));
        const syncDef = () => { const cur = defSel.value || d.defaultUnit; defSel.innerHTML = units().filter(u => u.name).map(u => `<option ${u.name === cur ? 'selected' : ''}>${esc(u.name)}</option>`).join(''); };
        const bindRows = () => { $$('[data-urm]', rows).forEach(b => b.onclick = () => { if (rows.children.length > 1) { b.closest('tr').remove(); syncDef(); } }); $$('[data-un]', rows).forEach(i => i.onchange = syncDef); };
        el.querySelector('#uAdd').onclick = e => { e.preventDefault(); rows.insertAdjacentHTML('beforeend', unitRow()); bindRows(); };
        bindRows(); syncDef();
        el.querySelector('#imgIn').onchange = e => {
          const file = e.target.files[0]; if (!file) return;
          const img = new Image(); img.onload = () => { const c = document.createElement('canvas'), s = 160, r = Math.min(s / img.width, s / img.height); c.width = img.width * r; c.height = img.height * r; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); image = c.toDataURL('image/jpeg', .8); URL.revokeObjectURL(img.src); };
          img.src = URL.createObjectURL(file);
        };
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = () => {
          const v = VM.ui.formData(el), us = units().filter(u => u.name);
          const errs = [];
          if (!v.code) errs.push('Nhập mã hàng');
          v.gtin = String(v.gtin || '').trim();
          if (v.gtin) {
            const g = VM.gs1(v.gtin);
            v.gtin = (g && g.gtin) || v.gtin.replace(/\D/g, '');
            if (!/^\d{8,14}$/.test(v.gtin) || VM.gtinCheck(v.gtin.slice(0, -1)) !== v.gtin.slice(-1)) errs.push('Mã vạch (GTIN) không hợp lệ – kiểm tra lại số cuối');
            else if (S().products.some(x => x !== p && x.gtin && VM.gtinKey(x.gtin) === VM.gtinKey(v.gtin))) errs.push('Mã vạch đã gắn cho mặt hàng khác');
          }
          if (S().products.some(x => x.code.toLowerCase() === v.code.toLowerCase() && x !== p)) errs.push('Mã hàng đã tồn tại');
          if (!v.name) errs.push('Nhập tên hàng');
          if (!us.length) errs.push('Cần ít nhất 1 đơn vị tính');
          if (us.some(u => u.factor < 1)) errs.push('Hệ số quy đổi phải ≥ 1');
          if (!us.some(u => u.factor === 1)) errs.push('Cần 1 đơn vị nhỏ nhất có hệ số = 1');
          if (us.some(u => !(u.price > 0))) errs.push('Nhập giá bán cho mọi đơn vị');
          if (new Set(us.map(u => u.name.toLowerCase())).size !== us.length) errs.push('Tên đơn vị bị trùng');
          if (!v.expiry) errs.push('Nhập hạn dùng');
          if (errs.length) { const e = el.querySelector('#pErr'); e.innerHTML = icon('alert', 's') + '<span>' + errs.map(esc).join(' · ') + '</span>'; e.classList.remove('hidden'); return; }
          const obj = p || { id: VM.uid('p_') };
          const priceChanged = p && JSON.stringify(p.units.map(u => [u.name, u.price])) !== JSON.stringify(us.map(u => [u.name, u.price]));
          Object.assign(obj, { code: v.code, sap: v.sap, gtin: v.gtin, name: v.name, ingredient: v.ingredient, category: v.category, group: v.group, store: v.store, units: us.sort((a, b) => a.factor - b.factor), defaultUnit: v.defaultUnit || us[0].name, minStock: Math.max(0, Math.floor(VM.parseNum(v.minStock))), lot: v.lot, expiry: v.expiry, active: v.active, image, updatedAt: VM.iso() });
          if (!p) { obj.stock = Math.max(0, Math.floor(VM.parseNum(v.stock))); S().products.push(obj); VM.store.log('Thêm mặt hàng', 'Danh mục', obj.name, obj.code); }
          else VM.store.log(priceChanged ? 'Sửa mặt hàng (đổi giá)' : 'Sửa mặt hàng', 'Danh mục', priceChanged ? us.map(u => `${u.name}: ${money(u.price)}`).join(', ') : obj.name, obj.code);
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
    const u = p.units;
    return [p.code, p.sap, p.name, p.ingredient, CAT[p.category].short, p.group, p.store, u[0]?.name, u[0]?.price, u[1]?.name || '', u[1]?.factor || '', u[1]?.price || '', u[2]?.name || '', u[2]?.factor || '', u[2]?.price || '', p.defaultUnit, p.stock, p.minStock, p.lot, VM.fmtDate(p.expiry), p.gtin || ''];
  }
  function exportXls() { VM.xlsx.exportXlsx({ 'Danh mục': [HEAD, ...S().products.map(toRow)] }, `vinmec_danh_muc_${VM.fileStamp()}.xlsx`); }

  async function importFile(file) {
    let rows;
    try { rows = await VM.xlsx.readTable(file); } catch (e) { VM.ui.toast(e.message, 'bad', 6000); return; }
    if (rows.length < 2) { VM.ui.toast('File không có dữ liệu', 'warn'); return; }
    const keys = rows[0].map(h => MAP[VM.normalize(h)] || null);
    if (!keys.includes('code') || !keys.includes('name')) { VM.ui.toast('Thiếu cột “Mã hàng” hoặc “Tên hàng”. Hãy dùng file mẫu.', 'bad', 6000); return; }
    const parsed = rows.slice(1).map((r, i) => {
      const o = {}; keys.forEach((k, j) => { if (k) o[k] = typeof r[j] === 'string' ? r[j].trim() : r[j]; });
      const units = [[o.u1, 1, o.p1], [o.u2, o.f2, o.p2], [o.u3, o.f3, o.p3]].filter(([n]) => n).map(([name, factor, price]) => ({ name: String(name), factor: Math.floor(VM.parseNum(factor)) || 1, price: Math.round(VM.parseNum(price)) }));
      const errs = [];
      if (!o.code) errs.push('thiếu mã');
      if (!o.name) errs.push('thiếu tên');
      if (!units.length) errs.push('thiếu ĐVT');
      if (units.some(u => !(u.price > 0))) errs.push('thiếu giá');
      const expiry = VM.parseDate(o.expiry);
      if (!expiry) errs.push('HSD không hợp lệ');
      return { line: i + 2, o, units, expiry, errs, exists: S().products.find(p => p.code.toLowerCase() === String(o.code || '').toLowerCase()) };
    });
    const ok = parsed.filter(x => !x.errs.length), bad = parsed.filter(x => x.errs.length);
    VM.ui.modal({
      title: 'Xem trước dữ liệu nhập', sub: esc(file.name), ic: 'upload', size: 'lg',
      body: `<div class="kpis" style="grid-template-columns:repeat(3,1fr)"><div class="card kpi"><div><span>Thêm mới</span><strong>${ok.filter(x => !x.exists).length}</strong></div></div><div class="card kpi"><div><span>Cập nhật theo mã</span><strong>${ok.filter(x => x.exists).length}</strong></div></div><div class="card kpi"><div><span>Lỗi – bỏ qua</span><strong style="color:${bad.length ? 'var(--danger)' : 'inherit'}">${bad.length}</strong></div></div></div>
        ${bad.length ? `<div class="alert bad" style="margin-bottom:12px">${icon('alert', 's')}<div>${bad.slice(0, 8).map(x => `Dòng ${x.line}: ${esc(x.errs.join(', '))}`).join('<br>')}${bad.length > 8 ? '<br>…' : ''}</div></div>` : ''}
        <label class="check"><input type="checkbox" id="impStock" checked> Cập nhật cả số tồn từ file (bỏ chọn để chỉ cập nhật thông tin & giá)</label>
        <div class="alert info">${icon('shield', 's')}<span>Hệ thống sẽ tự tạo bản sao lưu trước khi nhập.</span></div>`,
      foot: `<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok ${ok.length ? '' : 'disabled'}>${icon('check', 's')} Nhập ${ok.length} dòng</button>`,
      onMount(el, close) {
        el.querySelector('[data-x]').onclick = () => close();
        el.querySelector('[data-ok]').onclick = async () => {
          const withStock = el.querySelector('#impStock').checked;
          await VM.backup.snapshot('Trước khi nhập Excel danh mục');
          ok.forEach(({ o, units, expiry, exists }) => {
            const p = exists || { id: VM.uid('p_'), stock: 0, active: true, image: '' };
            Object.assign(p, { code: String(o.code), sap: String(o.sap || p.sap || ''), gtin: String(o.gtin || p.gtin || '').replace(/\D/g, ''), name: String(o.name), ingredient: String(o.ingredient || p.ingredient || ''), category: o.category ? catFrom(o.category) : (p.category || 'otc'), group: String(o.group || p.group || ''), store: String(o.store || p.store || 'Y001'), units, defaultUnit: units.find(u => u.name === o.defaultUnit) ? String(o.defaultUnit) : units[0].name, minStock: o.minStock !== undefined && o.minStock !== '' ? Math.floor(VM.parseNum(o.minStock)) : (p.minStock ?? 10), lot: String(o.lot || p.lot || ''), expiry, updatedAt: VM.iso() });
            if (withStock && o.stock !== undefined && o.stock !== '') p.stock = Math.max(0, Math.floor(VM.parseNum(o.stock)));
            if (!exists) S().products.push(p);
          });
          VM.store.log('Nhập Excel danh mục', 'Danh mục', `${file.name}: ${ok.length} dòng, ${bad.length} lỗi`);
          VM.store.save('import'); close(); draw(); VM.ui.done('Nhập danh mục thành công', `${ok.length} mặt hàng`);
        };
      },
    });
  }

  VM.catalog = { openEditor };
  VM.ui.register({ id: 'catalog', title: 'Danh mục hàng', group: 'retail', icon: 'package', crumb: 'Bán lẻ · Thuốc OTC, TPCN, vật tư', render,
    badge: () => { const n = S().products.filter(p => p.active && VM.store.productIssue(p) && VM.store.productIssue(p).level === 'bad').length; return { n, title: n + ' mặt hàng hết hàng/hết hạn' }; } });
})(window.VM);
