/* Danh mục thuốc chung toàn hệ thống (api/drugs, cơ sở dữ liệu trên máy chủ).
   - Thông tin gốc (mã, tên, nhóm, hàm lượng, ĐVT + giá, mã SAP, mã vạch, đang bán / ngừng bán) lấy từ máy chủ, chỉ Trưởng khoa thêm / sửa.
   - Tồn kho, số lô, HSD, tồn tối thiểu vẫn của riêng nhà thuốc này (state.products trên máy), không gửi lên máy chủ.
   - Mặt hàng trên máy được nối với thuốc trên máy chủ qua p.drugId (lần đầu khớp theo mã hàng); p.drugVersion để biết có bản mới. */
'use strict';
(function (VM) {
  const URL_ = 'api/drugs', EVERY = 5 * 60e3, BULK = 500;
  const MASTER = ['code', 'sap', 'gtin', 'name', 'strength', 'ingredient', 'category', 'group', 'store', 'units', 'defaultUnit', 'active'];
  const S = () => VM.store.state;
  let inflight = null, lastAt = 0, started = false;

  const isHead = () => !!(VM.store.currentUser() || {}).head;
  /** Phần thông tin gốc của một mặt hàng (gửi lên máy chủ) */
  const payload = p => ({
    code: p.code, sap: p.sap || '', gtin: p.gtin || '', name: p.name, strength: p.strength || '', ingredient: p.ingredient || '', category: p.category,
    group: p.group || '', store: p.store || 'Y001', units: (p.units || []).map(u => ({ name: u.name, factor: +u.factor, price: +u.price })), defaultUnit: p.defaultUnit, active: p.active !== false,
  });

  // Ghi 1 thuốc từ máy chủ vào mặt hàng trên máy (tạo mới nếu chưa có). → 'added' | 'updated' | ''
  function applyOne(d, p) {
    const list = S().products;
    p = p || list.find(x => x.drugId === d.id) || list.find(x => !x.drugId && String(x.code).toLowerCase() === d.code.toLowerCase());
    let how = 'updated';
    if (!p) { p = { id: VM.uid('p_'), stock: 0, lot: '', expiry: '', minStock: 10, image: '' }; list.push(p); how = 'added'; }
    else if (p.drugId === d.id && p.drugVersion === d.version) return '';
    MASTER.forEach(k => { p[k] = k === 'units' ? d.units.map(u => Object.assign({}, u)) : d[k]; });
    Object.assign(p, { drugId: d.id, drugVersion: d.version, updatedAt: d.updatedAt, updatedBy: d.updatedBy });
    return how;
  }
  function apply(drugs) {
    const c = { added: 0, updated: 0 };
    drugs.forEach(d => { const h = applyOne(d); if (h) c[h]++; });
    return c;
  }
  function afterApply(c, why) {
    if (!c.added && !c.updated) return;
    VM.store.log(why || 'Đồng bộ danh mục hệ thống', 'Danh mục', `${c.added} thuốc mới, ${c.updated} cập nhật`);
    VM.store.save('drugs');
    if (VM.ui && VM.ui.current === 'catalog' && !document.querySelector('#modalRoot .overlay')) VM.ui.rerender();
  }

  /** Tải danh mục chung về máy. → { ok, added, updated, error } */
  function sync() {
    if (!VM.store.currentUser()) return Promise.resolve({ ok: false });
    if (inflight) return inflight;
    inflight = (async () => {
      const r = await VM.auth.api(URL_);
      if (!r.data || !Array.isArray(r.data.drugs)) return { ok: false, error: r.error };
      const c = apply(r.data.drugs);
      lastAt = Date.now();
      afterApply(c);
      return Object.assign({ ok: true, total: r.data.drugs.length }, c);
    })().finally(() => { inflight = null; });
    return inflight;
  }

  /** Trưởng khoa lưu 1 thuốc lên máy chủ (thêm mới hoặc sửa). p = mặt hàng trên máy (null nếu thêm mới), draft = thông tin gốc mới.
      → { ok, product, error, status }. Thành công thì mặt hàng trên máy đã được cập nhật (chưa save). */
  async function save(p, draft) {
    const body = p && p.drugId ? { action: 'update', id: p.drugId, version: p.drugVersion, drug: payload(draft) } : { action: 'create', drug: payload(draft) };
    const r = await VM.auth.api(URL_, body);
    if (r.status === 409 && r.data && r.data.drug) { applyOne(r.data.drug, p); VM.store.save('drugs'); }
    if (!r.data || !r.data.drug || r.status !== 200) return { ok: false, status: r.status, error: r.error || 'Không lưu được lên danh mục hệ thống.' };
    applyOne(r.data.drug, p || null);
    return { ok: true, product: p || S().products.find(x => x.drugId === r.data.drug.id), drug: r.data.drug };
  }

  /** Trưởng khoa gửi nhiều thuốc một lần (nhập Excel, đưa danh mục có sẵn trên máy lên). → { ok, created, updated, error, errors } */
  async function bulk(list) {
    let created = 0, updated = 0;
    for (let i = 0; i < list.length; i += BULK) {
      const r = await VM.auth.api(URL_, { action: 'bulk', drugs: list.slice(i, i + BULK).map(payload) });
      if (r.status !== 200 || !r.data) return { ok: false, created, updated, error: r.error, errors: r.data && r.data.errors, offset: i };
      created += r.data.created; updated += r.data.updated;
      r.data.drugs.forEach(d => applyOne(d));
    }
    return { ok: true, created, updated };
  }

  /** Mặt hàng chỉ có trên máy này, chưa có trong danh mục hệ thống (dữ liệu cũ / dữ liệu mẫu) */
  const localOnly = () => S().products.filter(p => !p.drugId);

  // Tự đồng bộ: khi vào ca, mỗi 5 phút, khi quay lại tab sau ≥ 2 phút, khi có mạng lại
  function start() {
    sync();
    if (started) return;
    started = true;
    setInterval(() => { if (VM.store.currentUser()) sync(); }, EVERY);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastAt > 2 * 60e3 && VM.store.currentUser()) sync(); });
    window.addEventListener('online', () => { if (VM.store.currentUser()) sync(); });
  }

  VM.drugs = { sync, save, bulk, apply, payload, localOnly, isHead, start, MASTER, get lastAt() { return lastAt; } };
})(window.VM);
