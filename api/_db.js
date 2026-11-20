// Cơ sở dữ liệu dùng chung cho toàn hệ thống: cơ sở (bệnh viện), tài khoản dược sĩ, phiên đăng nhập, danh mục thuốc.
//  - Có DATABASE_URL (hoặc POSTGRES_URL): Postgres trên Neon (Vercel Marketplace → Storage → Neon). Bản Vercel bắt buộc dùng cách này.
//  - Không có (npm run dev trên máy): file SQLite data/vinmec.db (node:sqlite có sẵn trong Node ≥ 22.13, không cần npm install).
// SQL viết một kiểu chạy được trên cả hai: tham số $1 $2…, TEXT / INTEGER, thời gian là chuỗi ISO (UTC), cờ là 0/1.
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_VERSION = '1';

// Cơ sở mặc định. Chỉ OCP2 đang dùng được; các cơ sở khác bật sau khi có dữ liệu (npm run users -- facility --code … --enable).
export const FACILITIES = [
  ['OCP2', 'Vinmec OCP2', 1],
  ['TIMESCITY', 'Vinmec Times City', 0],
  ['CENTRALPARK', 'Vinmec Central Park', 0],
];

const DDL = [
  `CREATE TABLE IF NOT EXISTS facilities (
    code TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, facility TEXT NOT NULL REFERENCES facilities(code), username TEXT NOT NULL,
    name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('head', 'pharmacist')), title TEXT NOT NULL DEFAULT '', store TEXT NOT NULL DEFAULT 'Y001',
    pass_hash TEXT NOT NULL, must_change INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1,
    failed INTEGER NOT NULL DEFAULT 0, locked_until TEXT, pass_changed_at TEXT, last_login_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (facility, username))`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, facility TEXT NOT NULL,
    created_at TEXT NOT NULL, expires_at TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  // Danh mục thuốc chung toàn hệ thống (thông tin gốc). Tồn kho / lô / HSD vẫn riêng từng nhà thuốc (trên máy).
  `CREATE TABLE IF NOT EXISTS drugs (
    id TEXT PRIMARY KEY, code TEXT NOT NULL, code_key TEXT NOT NULL UNIQUE, sap TEXT NOT NULL DEFAULT '', gtin TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL, strength TEXT NOT NULL DEFAULT '', ingredient TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL CHECK (category IN ('otc', 'supp', 'device', 'other')), grp TEXT NOT NULL DEFAULT '', store TEXT NOT NULL DEFAULT 'Y001',
    default_unit TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS drugs_gtin ON drugs (gtin)`,
  // Đơn vị tính của từng thuốc: factor = số ĐVT nhỏ nhất trong 1 đơn vị (ĐVT nhỏ nhất có factor 1), price = giá bán (đồng)
  `CREATE TABLE IF NOT EXISTS drug_units (
    drug_id TEXT NOT NULL REFERENCES drugs(id) ON DELETE CASCADE, name TEXT NOT NULL,
    factor INTEGER NOT NULL CHECK (factor >= 1), price INTEGER NOT NULL CHECK (price >= 0), PRIMARY KEY (drug_id, name))`,
  // Nhật ký danh mục: ai thêm / sửa thuốc nào, lúc nào, từ cơ sở nào
  `CREATE TABLE IF NOT EXISTS drug_log (
    id TEXT PRIMARY KEY, drug_id TEXT NOT NULL, code TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL,
    user_id TEXT NOT NULL, user_name TEXT NOT NULL, facility TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS drug_log_drug ON drug_log (drug_id)`,
  // Đếm số lần đăng nhập sai theo địa chỉ IP (chống dò mật khẩu)
  `CREATE TABLE IF NOT EXISTS throttle (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
];

export const now = () => new Date().toISOString();
export const newId = prefix => prefix + crypto.randomBytes(12).toString('base64url');
const bad = (status, message) => Object.assign(new Error(message), { status });

let ready = null;
/** Mở kết nối (một lần cho mỗi tiến trình) + tạo bảng nếu chưa có. → { kind, all(q, p), run(q, p), tx([[q, p], …]) } */
export function db() {
  if (!ready) ready = open().catch(e => { ready = null; throw e; });
  return ready;
}

async function open() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const d = url ? await openPg(url) : await openSqlite();
  await migrate(d);
  return d;
}

async function openPg(url) {
  let neon;
  try { ({ neon } = await import('@neondatabase/serverless')); }
  catch { throw bad(503, 'Thiếu thư viện @neondatabase/serverless – chạy npm install (bản Vercel tự cài).'); }
  const sql = neon(url);
  return {
    kind: 'postgres',
    all: (q, p = []) => sql.query(q, p),
    run: async (q, p = []) => { await sql.query(q, p); },
    tx: list => sql.transaction(list.map(([q, p = []]) => sql.query(q, p))),
  };
}

async function openSqlite() {
  if (process.env.VERCEL) throw bad(503, 'Máy chủ chưa có cơ sở dữ liệu: thêm Neon (Vercel → Storage) để có biến DATABASE_URL, rồi deploy lại.');
  let DatabaseSync;
  try { ({ DatabaseSync } = await import('node:sqlite')); }
  catch { throw bad(503, `Node ${process.version} chưa có SQLite – cài Node.js ≥ 22.13, hoặc đặt DATABASE_URL trong .env.`); }
  const file = process.env.SQLITE_FILE || path.join(ROOT, 'data', 'vinmec.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const s = new DatabaseSync(file);
  s.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  // node:sqlite chỉ gán tham số "?" theo vị trí → $1 $2 $1 thành ? ? ? với mảng [p0, p1, p0]; true/false → 1/0; undefined → NULL
  const cache = new Map();
  const conv = q => {
    if (!cache.has(q)) { const order = []; const text = q.replace(/\$(\d+)/g, (_, n) => { order.push(+n - 1); return '?'; }); cache.set(q, { stmt: s.prepare(text), order }); }
    return cache.get(q);
  };
  const call = (how, q, p = []) => {
    const { stmt, order } = conv(q);
    return stmt[how](...order.map(i => { const v = p[i]; return v === undefined ? null : typeof v === 'boolean' ? +v : v; }));
  };
  const run = (q, p) => call('run', q, p);
  return {
    kind: 'sqlite', file,
    all: async (q, p) => call('all', q, p),
    run: async (q, p = []) => { run(q, p); },
    tx: async list => {
      s.exec('BEGIN IMMEDIATE');
      try { for (const [q, p] of list) run(q, p); s.exec('COMMIT'); }
      catch (e) { s.exec('ROLLBACK'); throw e; }
    },
  };
}

async function migrate(d) {
  try {
    const r = await d.all(`SELECT v FROM app_meta WHERE k = 'schema'`);
    if (r[0] && r[0].v === SCHEMA_VERSION) return;
  } catch { /* bảng chưa có → tạo */ }
  for (const q of DDL) await d.run(q);
  const t = now();
  for (const [code, name, enabled] of FACILITIES) await d.run(`INSERT INTO facilities (code, name, enabled, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`, [code, name, enabled, t]);
  await d.run(`INSERT INTO app_meta (k, v) VALUES ('schema', $1) ON CONFLICT (k) DO UPDATE SET v = excluded.v`, [SCHEMA_VERSION]);
}
