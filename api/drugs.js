// /api/drugs – danh mục thuốc chung toàn hệ thống (mọi cơ sở, mọi máy).
//   GET                                       → { drugs: [...], at }               (mọi dược sĩ đã đăng nhập)
//   POST { action: 'create', drug }           → { drug }                           (chỉ Trưởng khoa)
//   POST { action: 'update', id, version, drug } → { drug }   409 nếu người khác vừa sửa (chỉ Trưởng khoa)
//   POST { action: 'bulk', drugs: [...] }     → { created, updated, drugs }        (chỉ Trưởng khoa; nhập Excel / đưa danh mục có sẵn lên)
// Chỉ lưu thông tin gốc của thuốc (mã, tên, nhóm, ĐVT, giá…). Tồn kho, số lô, HSD là của từng nhà thuốc, không lưu ở đây.
import { json, fail, check } from './_lib.js';
import { db, now, newId } from './_db.js';
import { requireUser } from './_auth.js';

const CATS = ['otc', 'supp', 'device', 'other'];
const MAX_BULK = 1000;
const FIELDS = { code: 'mã hàng', name: 'tên', sap: 'mã SAP', gtin: 'mã vạch', strength: 'hàm lượng', ingredient: 'hoạt chất', category: 'nhóm', group: 'nhóm dược lý', store: 'kho', units: 'ĐVT / giá', defaultUnit: 'ĐVT bán mặc định', active: 'trạng thái bán' };

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const gtinKey = g => String(g || '').replace(/\D/g, '').replace(/^0+/, '');
const gtinOk = g => { if (!/^\d{8,14}$/.test(g)) return false; const d = g.slice(0, -1).split('').reverse().map(Number); return String((10 - d.reduce((a, x, i) => a + x * (i % 2 ? 1 : 3), 0) % 10) % 10) === g.slice(-1); };

/** Kiểm tra + chuẩn hóa 1 thuốc. → { drug } hoặc { error } */
export function clean(x) {
  if (!x || typeof x !== 'object') return { error: 'Thiếu thông tin thuốc' };
  const code = str(x.code, 40), name = str(x.name, 200);
  if (!code) return { error: 'Thiếu mã hàng' };
  if (!/^[\p{L}\p{N}._\-/ ]+$/u.test(code)) return { error: `Mã hàng “${code}” có ký tự không hợp lệ` };
  if (!name) return { error: `${code}: thiếu tên hàng` };
  const category = CATS.includes(x.category) ? x.category : 'other';
  const gtin = str(x.gtin, 20).replace(/\D/g, '');
  if (gtin && !gtinOk(gtin)) return { error: `${code}: mã vạch (GTIN) không hợp lệ` };
  if (!Array.isArray(x.units) || !x.units.length || x.units.length > 6) return { error: `${code}: cần 1–6 đơn vị tính` };
  const units = [];
  for (const u of x.units) {
    const n = str(u && u.name, 20), factor = Number(u && u.factor), price = Number(u && u.price);
    if (!n) return { error: `${code}: thiếu tên đơn vị tính` };
    if (!Number.isInteger(factor) || factor < 1 || factor > 100000) return { error: `${code}: hệ số quy đổi của “${n}” không hợp lệ` };
    if (!Number.isInteger(price) || price <= 0 || price > 1e10) return { error: `${code}: giá của “${n}” không hợp lệ` };
    if (units.some(v => v.name.toLowerCase() === n.toLowerCase())) return { error: `${code}: đơn vị “${n}” bị trùng` };
    if (units.some(v => v.factor === factor)) return { error: `${code}: hai đơn vị có cùng hệ số ${factor}` };
    units.push({ name: n, factor, price });
  }
  units.sort((a, b) => a.factor - b.factor);
  if (units[0].factor !== 1) return { error: `${code}: đơn vị nhỏ nhất phải có hệ số 1` };
  const du = str(x.defaultUnit, 20);
  return {
    drug: {
      code, name, category, gtin, units,
      sap: str(x.sap, 40), strength: str(x.strength, 200), ingredient: str(x.ingredient, 200), group: str(x.group, 100),
      store: str(x.store, 20).replace(/[^A-Za-z0-9]/g, '') || 'Y001',
      defaultUnit: units.some(u => u.name === du) ? du : units[0].name,
      active: x.active !== false,
    },
  };
}

async function loadAll(d, where = '', params = []) {
  const rows = await d.all(`SELECT * FROM drugs ${where} ORDER BY name`, params);
  if (!rows.length) return [];
  const units = await d.all(`SELECT drug_id, name, factor, price FROM drug_units ${where ? 'WHERE drug_id IN (SELECT id FROM drugs ' + where + ')' : ''}`, params);
  const by = new Map(rows.map(r => [r.id, []]));
  units.forEach(u => by.get(u.drug_id) && by.get(u.drug_id).push({ name: u.name, factor: +u.factor, price: +u.price }));
  return rows.map(r => ({
    id: r.id, code: r.code, sap: r.sap, gtin: r.gtin, name: r.name, strength: r.strength, ingredient: r.ingredient, category: r.category,
    group: r.grp, store: r.store, units: by.get(r.id).sort((a, b) => a.factor - b.factor), defaultUnit: r.default_unit, active: !!+r.active,
    version: +r.version, createdAt: r.created_at, createdBy: r.created_by, updatedAt: r.updated_at, updatedBy: r.updated_by,
  }));
}

// Câu lệnh ghi 1 thuốc (thêm hoặc sửa) + ĐVT + nhật ký – chạy chung trong một giao dịch
function writeOps(drug, prev, user, t) {
  const by = `${user.name} (${user.facility})`;
  const id = prev ? prev.id : newId('d_');
  const ops = prev
    ? [[`UPDATE drugs SET code = $1, code_key = $2, sap = $3, gtin = $4, name = $5, strength = $6, ingredient = $7, category = $8, grp = $9, store = $10,
          default_unit = $11, active = $12, version = version + 1, updated_at = $13, updated_by = $14 WHERE id = $15`,
        [drug.code, drug.code.toLowerCase(), drug.sap, drug.gtin, drug.name, drug.strength, drug.ingredient, drug.category, drug.group, drug.store, drug.defaultUnit, drug.active ? 1 : 0, t, by, id]],
       [`DELETE FROM drug_units WHERE drug_id = $1`, [id]]]
    : [[`INSERT INTO drugs (id, code, code_key, sap, gtin, name, strength, ingredient, category, grp, store, default_unit, active, version, created_at, created_by, updated_at, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, $15, $14, $15)`,
        [id, drug.code, drug.code.toLowerCase(), drug.sap, drug.gtin, drug.name, drug.strength, drug.ingredient, drug.category, drug.group, drug.store, drug.defaultUnit, drug.active ? 1 : 0, t, by]]];
  drug.units.forEach(u => ops.push([`INSERT INTO drug_units (drug_id, name, factor, price) VALUES ($1, $2, $3, $4)`, [id, u.name, u.factor, u.price]]));
  const changed = prev ? Object.keys(FIELDS).filter(k => JSON.stringify(prev[k]) !== JSON.stringify(drug[k])) : [];
  const detail = prev ? (changed.map(k => FIELDS[k]).join(', ') || 'không đổi') : drug.name;
  ops.push([`INSERT INTO drug_log (id, drug_id, code, action, at, user_id, user_name, facility, detail) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [newId('g_'), id, drug.code, prev ? 'update' : 'create', t, user.id, user.name, user.facility, detail.slice(0, 500)]]);
  return { id, ops, changed: !prev || changed.length > 0 };
}

async function gtinTaken(d, gtin, exceptId) {
  if (!gtin) return null;
  const key = gtinKey(gtin);
  const rows = await d.all(`SELECT id, code, gtin FROM drugs WHERE gtin <> '' AND id <> $1`, [exceptId || '']);
  return rows.find(r => gtinKey(r.gtin) === key) || null;
}

export async function GET(req) {
  const r = await requireUser(req);
  if (r.res) return r.res;
  try { return json({ drugs: await loadAll(await db()), at: now() }); }
  catch (e) { console.error('drugs', e); return fail(e.status || 500, e.status ? e.message : 'Không đọc được danh mục thuốc.'); }
}

export async function POST(req) {
  const badReq = check(req, 2_000_000);
  if (badReq) return badReq;
  if (!/^application\/json/i.test(req.headers.get('content-type') || '')) return fail(415, 'Dữ liệu phải là JSON.');
  const r = await requireUser(req, { head: true });
  if (r.res) return r.res;
  let body;
  try { body = await req.json(); } catch { return fail(400, 'Dữ liệu gửi lên không phải JSON.'); }
  try {
    const d = await db(), user = r.user, t = now();
    if (body.action === 'create' || body.action === 'update') {
      const c = clean(body.drug);
      if (c.error) return fail(400, c.error);
      const drug = c.drug;
      let prev = null;
      if (body.action === 'update') {
        prev = (await loadAll(d, 'WHERE id = $1', [String(body.id || '')]))[0];
        if (!prev) return fail(404, 'Không tìm thấy thuốc này trong danh mục hệ thống.');
        if (+body.version !== prev.version) return json({ error: `Thuốc ${prev.code} vừa được ${prev.updatedBy} sửa lúc ${prev.updatedAt}. Đã tải bản mới nhất – kiểm tra rồi lưu lại.`, drug: prev }, 409);
      }
      const dup = (await d.all(`SELECT id, code FROM drugs WHERE code_key = $1`, [drug.code.toLowerCase()]))[0];
      if (dup && (!prev || dup.id !== prev.id)) return fail(409, `Mã hàng ${dup.code} đã có trong danh mục hệ thống.`);
      const g = await gtinTaken(d, drug.gtin, prev && prev.id);
      if (g) return fail(409, `Mã vạch đã gắn cho thuốc ${g.code}.`);
      const w = writeOps(drug, prev, user, t);
      if (w.changed) await d.tx(w.ops);
      return json({ drug: (await loadAll(d, 'WHERE id = $1', [w.id]))[0] });
    }
    if (body.action === 'bulk') {
      const list = Array.isArray(body.drugs) ? body.drugs : [];
      if (!list.length) return fail(400, 'Không có thuốc nào.');
      if (list.length > MAX_BULK) return fail(413, `Tối đa ${MAX_BULK} thuốc mỗi lần.`);
      const errors = [], seen = new Map(), seenG = new Map(), clean_ = [];
      list.forEach((x, i) => {
        const c = clean(x);
        if (c.error) return errors.push({ i, error: c.error });
        const k = c.drug.code.toLowerCase(), g = gtinKey(c.drug.gtin);
        if (seen.has(k)) return errors.push({ i, error: `Mã hàng ${c.drug.code} lặp lại trong file` });
        if (g && seenG.has(g)) return errors.push({ i, error: `${c.drug.code}: mã vạch trùng với ${seenG.get(g)}` });
        seen.set(k, i); if (g) seenG.set(g, c.drug.code); clean_.push(c.drug);
      });
      if (errors.length) return json({ error: `${errors.length} thuốc không hợp lệ – chưa ghi gì.`, errors: errors.slice(0, 50) }, 400);
      const all = await loadAll(d), byCode = new Map(all.map(x => [x.code.toLowerCase(), x]));
      const ops = [], ids = [];
      let created = 0, updated = 0;
      for (const drug of clean_) {
        const prev = byCode.get(drug.code.toLowerCase()) || null;
        const g = gtinKey(drug.gtin), clash = g && all.find(x => x !== prev && gtinKey(x.gtin) === g && !seen.has(x.code.toLowerCase()));
        if (clash) return fail(409, `${drug.code}: mã vạch đã gắn cho thuốc ${clash.code} – chưa ghi gì.`);
        const w = writeOps(drug, prev, user, t);
        ids.push(w.id);
        if (!w.changed) continue;
        ops.push(...w.ops);
        prev ? updated++ : created++;
      }
      if (ops.length) await d.tx(ops);
      const out = await loadAll(d), want = new Set(ids);
      return json({ created, updated, drugs: out.filter(x => want.has(x.id)) });
    }
    return fail(400, 'Thao tác không hợp lệ.');
  } catch (e) {
    console.error('drugs', e);
    if (/unique|duplicate/i.test(e.message || '')) return fail(409, 'Mã hàng đã có trong danh mục hệ thống.');
    return fail(e.status || 500, e.status ? e.message : 'Không lưu được danh mục thuốc. Thử lại sau ít phút.');
  }
}
