// /api/auth – đăng nhập theo cơ sở.
//   GET                                                  → { user } người đang đăng nhập (401 nếu chưa)
//   POST { action: 'facility', code }                    → { facility: { code, name, enabled } }   (404 nếu sai mã)
//   POST { action: 'login', facility, username, password } → { user } + cookie phiên (HttpOnly)
//   POST { action: 'password', current, next }           → đổi mật khẩu (bắt buộc ở lần đăng nhập đầu / sau khi đặt lại)
//   POST { action: 'logout' }                            → xóa phiên
// Tài khoản do Trưởng khoa / quản trị tạo bằng lệnh  npm run users  (không có đăng ký tự do).
import { json, fail, check } from './_lib.js';
import { db, now } from './_db.js';
import {
  hashPassword, verifyPassword, burnTime, passwordProblem, normCode, normUser, createSession, destroySession, dropOtherSessions,
  requireUser, publicUser, clearCookie, ipBlocked, ipFailed, MAX_FAILED, LOCK_MINUTES,
} from './_auth.js';

const withCookie = (res, cookie) => { res.headers.append('Set-Cookie', cookie); return res; };
const GENERIC = 'Tên đăng nhập hoặc mật khẩu không đúng.';

export async function GET(req) {
  const r = await requireUser(req, { allowMustChange: true });
  if (r.res) return r.res;
  return json({ user: publicUser(r.user) });
}

export async function POST(req) {
  const badReq = check(req, 20_000);
  if (badReq) return badReq;
  if (!/^application\/json/i.test(req.headers.get('content-type') || '')) return fail(415, 'Dữ liệu phải là JSON.');
  let body;
  try { body = await req.json(); } catch { return fail(400, 'Dữ liệu gửi lên không phải JSON.'); }
  try {
    switch (body && body.action) {
      case 'facility': return await facility(req, body);
      case 'login': return await login(req, body);
      case 'password': return await changePassword(req, body);
      case 'logout': await destroySession(req); return withCookie(json({ ok: true }), clearCookie(req));
      default: return fail(400, 'Thao tác không hợp lệ.');
    }
  } catch (e) {
    console.error('auth', e);
    return fail(e.status || 500, e.status ? e.message : 'Lỗi máy chủ khi đăng nhập. Thử lại sau ít phút.');
  }
}

async function facility(req, { code }) {
  if (await ipBlocked(req)) return fail(429, 'Thử sai quá nhiều lần. Đợi 15 phút rồi thử lại.');
  const c = normCode(code);
  const rows = c ? await (await db()).all(`SELECT code, name, enabled FROM facilities WHERE code = $1`, [c]) : [];
  if (!rows[0]) { await ipFailed(req); return fail(404, 'Mã cơ sở không đúng. Kiểm tra lại với Trưởng khoa.'); }
  const f = rows[0];
  return json({ facility: { code: f.code, name: f.name, enabled: !!+f.enabled } });
}

async function login(req, { facility: fc, username, password }) {
  if (await ipBlocked(req)) return fail(429, 'Thử sai quá nhiều lần từ máy này. Đợi 15 phút rồi thử lại.');
  const code = normCode(fc), uname = normUser(username), pw = typeof password === 'string' ? password : '';
  if (!code || !uname || !pw || pw.length > 128) return fail(400, 'Nhập tên đăng nhập và mật khẩu.');
  const d = await db();
  const f = (await d.all(`SELECT code, name, enabled FROM facilities WHERE code = $1`, [code]))[0];
  if (!f) return fail(404, 'Mã cơ sở không đúng.');
  if (!+f.enabled) return fail(403, `${f.name} chưa được triển khai trên hệ thống.`);
  const u = (await d.all(`SELECT * FROM users WHERE facility = $1 AND username = $2`, [code, uname]))[0];
  if (!u || !+u.active) { await burnTime(pw); await ipFailed(req); return fail(401, GENERIC); }
  if (u.locked_until && u.locked_until > now()) {
    await burnTime(pw);
    const min = Math.max(1, Math.ceil((new Date(u.locked_until) - Date.now()) / 6e4));
    return fail(423, `Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${min} phút hoặc nhờ Trưởng khoa đặt lại mật khẩu.`);
  }
  if (!(await verifyPassword(pw, u.pass_hash))) {
    const n = (+u.failed || 0) + 1, lock = n >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 6e4).toISOString() : null;
    await d.run(`UPDATE users SET failed = $1, locked_until = $2, updated_at = $3 WHERE id = $4`, [lock ? 0 : n, lock, now(), u.id]);
    await ipFailed(req);
    if (lock) return fail(423, `Nhập sai ${MAX_FAILED} lần – tài khoản tạm khóa ${LOCK_MINUTES} phút.`);
    return fail(401, GENERIC + (MAX_FAILED - n <= 2 ? ` Còn ${MAX_FAILED - n} lần thử trước khi tài khoản bị khóa.` : ''));
  }
  await d.run(`UPDATE users SET failed = 0, locked_until = NULL, last_login_at = $1 WHERE id = $2`, [now(), u.id]);
  const s = await createSession(req, u);
  return withCookie(json({ user: publicUser({ ...u, facility_name: f.name }), expiresAt: s.expiresAt }), s.cookie);
}

async function changePassword(req, { current, next }) {
  const r = await requireUser(req, { allowMustChange: true });
  if (r.res) return r.res;
  const u = r.user;
  if (typeof current !== 'string' || typeof next !== 'string') return fail(400, 'Nhập mật khẩu hiện tại và mật khẩu mới.');
  if (await ipBlocked(req)) return fail(429, 'Thử sai quá nhiều lần. Đợi 15 phút rồi thử lại.');
  if (!(await verifyPassword(current, u.pass_hash))) { await ipFailed(req); return fail(401, 'Mật khẩu hiện tại không đúng.'); }
  const why = passwordProblem(next, u.username);
  if (why) return fail(400, why);
  if (next === current) return fail(400, 'Mật khẩu mới phải khác mật khẩu hiện tại.');
  const t = now();
  await (await db()).run(`UPDATE users SET pass_hash = $1, must_change = 0, pass_changed_at = $2, updated_at = $2 WHERE id = $3`, [await hashPassword(next), t, u.id]);
  await dropOtherSessions(u.id, req); // đăng xuất các máy khác đang dùng mật khẩu cũ
  return json({ user: publicUser({ ...u, must_change: 0 }) });
}
