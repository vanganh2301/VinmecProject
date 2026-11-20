// Đăng nhập: băm mật khẩu (scrypt), phiên đăng nhập (cookie HttpOnly, máy chủ giữ bản băm SHA-256 của mã phiên),
// khóa tài khoản / IP khi sai nhiều lần, kiểm tra quyền cho mọi API cần đăng nhập.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { db, now } from './_db.js';
import { fail } from './_lib.js';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const SESSION_HOURS = 12;            // một ca làm việc; hết hạn thì đăng nhập lại
export const MAX_FAILED = 5;                // sai 5 lần liền → khóa tài khoản
export const LOCK_MINUTES = 15;
export const IP_MAX_FAILED = 20;            // một địa chỉ IP sai 20 lần / 15 phút → tạm chặn
const IP_WINDOW_MIN = 15;

// ---------- mật khẩu ----------
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(pw).normalize('NFC'), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(String(pw).normalize('NFC'), Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
// Băm giả khi không có tài khoản → thời gian trả lời như nhau, không dò được tên đăng nhập nào tồn tại
let dummy = null;
export async function burnTime(pw) { dummy = dummy || await hashPassword('vm-dummy-' + crypto.randomUUID()); await verifyPassword(pw, dummy); }

/** Chính sách mật khẩu. Trả về câu lỗi tiếng Việt, hoặc '' nếu đạt. */
export function passwordProblem(pw, username = '') {
  const s = String(pw || '');
  if (s.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
  if (s.length > 128) return 'Mật khẩu dài quá 128 ký tự.';
  if (!/[A-Za-zÀ-ỹ]/.test(s) || !/\d/.test(s)) return 'Mật khẩu cần có cả chữ và số.';
  if (username && s.toLowerCase().includes(String(username).toLowerCase())) return 'Mật khẩu không được chứa tên đăng nhập.';
  if (/^(.)\1+$/.test(s) || /^(12345678|password|matkhau|vinmec)/i.test(s)) return 'Mật khẩu quá dễ đoán.';
  return '';
}
/** Mật khẩu tạm (cấp cho tài khoản mới / khi đặt lại), dễ đọc: bỏ 0/O, 1/l/I */
export function tempPassword() {
  const A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', all = A + D;
  const pick = set => set[crypto.randomInt(set.length)];
  const out = [pick(A), pick(D), ...Array.from({ length: 8 }, () => pick(all))];
  for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

export const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
export const normUser = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '').slice(0, 64);

// ---------- yêu cầu HTTP ----------
export function clientIp(req) {
  return (req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'local').trim().slice(0, 64);
}
const isHttps = req => (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
// https: tiền tố __Host- (bắt buộc Secure, Path=/, không Domain) → trang con / tên miền khác không ghi đè được cookie
const cookieName = req => isHttps(req) ? '__Host-vm_sid' : 'vm_sid';
export function sessionCookie(req, token, maxAgeSec) {
  return `${cookieName(req)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${isHttps(req) ? '; Secure' : ''}`;
}
export const clearCookie = req => sessionCookie(req, '', 0);
function readToken(req) {
  const name = cookieName(req);
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) { const v = part.slice(i + 1).trim(); return /^[A-Za-z0-9_-]{40,64}$/.test(v) ? v : ''; }
  }
  return '';
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// ---------- phiên ----------
export async function createSession(req, user) {
  const d = await db(), token = crypto.randomBytes(32).toString('base64url'), t = now();
  const exp = new Date(Date.now() + SESSION_HOURS * 36e5).toISOString();
  await d.run(`DELETE FROM sessions WHERE expires_at < $1`, [t]); // dọn phiên hết hạn
  await d.run(`INSERT INTO sessions (id, user_id, facility, created_at, expires_at, ip, ua) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sha(token), user.id, user.facility, t, exp, clientIp(req), (req.headers.get('user-agent') || '').slice(0, 200)]);
  return { cookie: sessionCookie(req, token, SESSION_HOURS * 3600), expiresAt: exp };
}
export async function destroySession(req) {
  const token = readToken(req);
  if (token) await (await db()).run(`DELETE FROM sessions WHERE id = $1`, [sha(token)]);
}
export async function dropOtherSessions(userId, keepReq) {
  const token = keepReq && readToken(keepReq);
  await (await db()).run(`DELETE FROM sessions WHERE user_id = $1 AND id <> $2`, [userId, token ? sha(token) : '']);
}

/** Người đang đăng nhập (đọc từ cookie) hoặc null. Tài khoản bị khóa / cơ sở bị tắt / phiên hết hạn → null. */
export async function sessionUser(req) {
  const token = readToken(req);
  if (!token) return null;
  const d = await db();
  const rows = await d.all(`SELECT s.id AS sid, s.expires_at, u.*, f.name AS facility_name, f.enabled AS facility_enabled
    FROM sessions s JOIN users u ON u.id = s.user_id JOIN facilities f ON f.code = u.facility WHERE s.id = $1`, [sha(token)]);
  const u = rows[0];
  if (!u) return null;
  if (u.expires_at < now() || !+u.active || !+u.facility_enabled) { await d.run(`DELETE FROM sessions WHERE id = $1`, [u.sid]); return null; }
  return u;
}

/** Thông tin gửi về trình duyệt (không có băm mật khẩu) */
export const publicUser = u => ({
  id: u.username.toUpperCase(), username: u.username, name: u.name, role: u.role, title: u.title, store: u.store,
  facility: u.facility, facilityName: u.facility_name || '', head: u.role === 'head', mustChange: !!+u.must_change,
});

/**
 * Bắt buộc đăng nhập. Trả về { user } hoặc { res } (Response lỗi cần trả ngay).
 * opt.head: chỉ Trưởng khoa. opt.allowMustChange: cho phép khi chưa đổi mật khẩu tạm (chỉ dùng cho API đổi mật khẩu).
 */
export async function requireUser(req, opt = {}) {
  let u;
  try { u = await sessionUser(req); } catch (e) { return { res: fail(e.status || 500, e.message) }; }
  if (!u) return { res: fail(401, 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập. Hãy đăng nhập lại.') };
  if (+u.must_change && !opt.allowMustChange) return { res: fail(403, 'Cần đổi mật khẩu tạm trước khi dùng app.') };
  if (opt.head && u.role !== 'head') return { res: fail(403, 'Chỉ Trưởng khoa được thực hiện thao tác này.') };
  return { user: u };
}

// ---------- chống dò mật khẩu theo IP ----------
export async function ipBlocked(req) {
  const rows = await (await db()).all(`SELECT n, reset_at FROM throttle WHERE k = $1`, ['ip:' + clientIp(req)]);
  return rows[0] && rows[0].reset_at > now() && +rows[0].n >= IP_MAX_FAILED;
}
export async function ipFailed(req) {
  const t = now(), reset = new Date(Date.now() + IP_WINDOW_MIN * 6e4).toISOString();
  await (await db()).run(`INSERT INTO throttle (k, n, reset_at) VALUES ($1, 1, $2) ON CONFLICT (k) DO UPDATE SET
      n = CASE WHEN throttle.reset_at < $3 THEN 1 ELSE throttle.n + 1 END,
      reset_at = CASE WHEN throttle.reset_at < $3 THEN $2 ELSE throttle.reset_at END`, ['ip:' + clientIp(req), reset, t]);
}
