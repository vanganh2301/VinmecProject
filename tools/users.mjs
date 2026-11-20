// npm run users -- <lệnh>   –  quản lý cơ sở + tài khoản dược sĩ (không có đăng ký tự do trong app).
// Dùng cơ sở dữ liệu giống npm run dev: DATABASE_URL trong .env (Postgres – chung với bản Vercel), không có thì data/vinmec.db (SQLite).
// Mật khẩu tạm chỉ in ra MỘT lần; dược sĩ phải đổi ngay ở lần đăng nhập đầu. Không lưu mật khẩu ở đâu khác.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadEnv } from './_env.mjs';

loadEnv();
const imp = f => import(pathToFileURL(path.join(ROOT, 'api', f)).href);
const { db, now, newId } = await imp('_db.js');
const { hashPassword, tempPassword, normCode, normUser } = await imp('_auth.js');

const HELP = `
Quản lý tài khoản Vinmec Pharmacy Hub
  npm run users -- list [--facility OCP2]
  npm run users -- add --facility OCP2 --user DS01 --name "DS. Nguyễn Văn A" [--role pharmacist|head] [--title "Dược sĩ nhà thuốc"] [--store Y001]
  npm run users -- reset   --facility OCP2 --user DS01     cấp mật khẩu tạm mới, mở khóa, đăng xuất mọi máy
  npm run users -- disable --facility OCP2 --user DS01     khóa tài khoản (nghỉ việc / chuyển cơ sở), đăng xuất mọi máy
  npm run users -- enable  --facility OCP2 --user DS01
  npm run users -- role    --facility OCP2 --user DS01 --role head|pharmacist
  npm run users -- facilities
  npm run users -- facility --code TIMESCITY --enable|--disable [--name "Vinmec Times City"]   (mã mới thì tạo cơ sở mới)
Vai trò: head = Trưởng khoa (thêm / sửa thuốc trong danh mục chung, quyền quản lý); pharmacist = Dược sĩ.
Cơ sở dữ liệu: ${process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'Postgres (DATABASE_URL trong .env)' : 'SQLite data/vinmec.db (chưa đặt DATABASE_URL)'}
`;

const argv = process.argv.slice(2), cmd = argv[0];
const opt = k => { const i = argv.indexOf('--' + k); return i > 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
const flag = k => argv.includes('--' + k);
const die = m => { console.error('✗ ' + m); process.exit(1); };

async function findUser(d) {
  const f = normCode(opt('facility')), u = normUser(opt('user'));
  if (!f || !u) die('Cần --facility và --user');
  const row = (await d.all(`SELECT * FROM users WHERE facility = $1 AND username = $2`, [f, u]))[0];
  if (!row) die(`Không có tài khoản ${u} ở cơ sở ${f}`);
  return row;
}
const showPw = (u, pw) => {
  console.log(`\n  Cơ sở:           ${u.facility}\n  Tên đăng nhập:   ${u.username}\n  Mật khẩu tạm:    ${pw}\n`);
  console.log('  → Đưa trực tiếp cho dược sĩ (không gửi qua nhóm chat). Lần đăng nhập đầu app bắt đổi mật khẩu.');
};

async function main() {
  if (!cmd || cmd === 'help' || flag('help')) { console.log(HELP); return; }
  const d = await db(), t = now();
  switch (cmd) {
    case 'list': {
      const f = normCode(opt('facility'));
      const rows = await d.all(`SELECT facility, username, name, role, title, store, active, must_change, locked_until, last_login_at FROM users ${f ? 'WHERE facility = $1' : ''} ORDER BY facility, role, username`, f ? [f] : []);
      if (!rows.length) { console.log('Chưa có tài khoản nào. Tạo Trưởng khoa trước:\n  npm run users -- add --facility OCP2 --user TK01 --name "DS. …" --role head'); return; }
      console.table(rows.map(r => ({ 'Cơ sở': r.facility, 'Đăng nhập': r.username, 'Họ tên': r.name, 'Vai trò': r.role === 'head' ? 'Trưởng khoa' : 'Dược sĩ', 'Kho': r.store,
        'Trạng thái': !+r.active ? 'ĐÃ KHÓA' : r.locked_until && r.locked_until > t ? 'tạm khóa (sai MK)' : +r.must_change ? 'chưa đổi MK tạm' : 'đang dùng', 'Lần cuối': r.last_login_at ? new Date(r.last_login_at).toLocaleString('vi-VN') : '—' })));
      return;
    }
    case 'add': {
      const f = normCode(opt('facility')), u = normUser(opt('user')), name = opt('name').trim(), role = opt('role') || 'pharmacist';
      if (!f || !u || !name) die('Cần --facility, --user và --name');
      if (!/^[a-z0-9._-]{2,64}$/.test(u)) die('Tên đăng nhập chỉ gồm chữ không dấu, số, dấu . _ - (VD mã nhân viên DS01)');
      if (!['head', 'pharmacist'].includes(role)) die('--role phải là head hoặc pharmacist');
      const fac = (await d.all(`SELECT code FROM facilities WHERE code = $1`, [f]))[0];
      if (!fac) die(`Không có cơ sở ${f}. Xem: npm run users -- facilities`);
      if ((await d.all(`SELECT id FROM users WHERE facility = $1 AND username = $2`, [f, u]))[0]) die(`Đã có tài khoản ${u} ở ${f}. Dùng reset để cấp lại mật khẩu.`);
      const pw = tempPassword();
      await d.run(`INSERT INTO users (id, facility, username, name, role, title, store, pass_hash, must_change, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1, $9, $9)`,
        [newId('u_'), f, u, name, role, opt('title') || (role === 'head' ? 'Trưởng khoa Dược' : 'Dược sĩ'), (opt('store') || 'Y001').toUpperCase(), await hashPassword(pw), t]);
      console.log(`✓ Đã tạo tài khoản ${role === 'head' ? 'Trưởng khoa' : 'Dược sĩ'} ${name}`);
      showPw({ facility: f, username: u }, pw);
      return;
    }
    case 'reset': {
      const u = await findUser(d), pw = tempPassword();
      await d.run(`UPDATE users SET pass_hash = $1, must_change = 1, failed = 0, locked_until = NULL, updated_at = $2 WHERE id = $3`, [await hashPassword(pw), t, u.id]);
      await d.run(`DELETE FROM sessions WHERE user_id = $1`, [u.id]);
      console.log(`✓ Đã đặt lại mật khẩu cho ${u.name}, đăng xuất mọi máy`);
      showPw(u, pw);
      return;
    }
    case 'disable': case 'enable': {
      const u = await findUser(d);
      await d.run(`UPDATE users SET active = $1, failed = 0, locked_until = NULL, updated_at = $2 WHERE id = $3`, [cmd === 'enable' ? 1 : 0, t, u.id]);
      if (cmd === 'disable') await d.run(`DELETE FROM sessions WHERE user_id = $1`, [u.id]);
      console.log(`✓ ${cmd === 'enable' ? 'Đã mở' : 'Đã khóa'} tài khoản ${u.name} (${u.facility}/${u.username})`);
      return;
    }
    case 'role': {
      const u = await findUser(d), role = opt('role');
      if (!['head', 'pharmacist'].includes(role)) die('--role phải là head hoặc pharmacist');
      await d.run(`UPDATE users SET role = $1, updated_at = $2 WHERE id = $3`, [role, t, u.id]);
      await d.run(`DELETE FROM sessions WHERE user_id = $1`, [u.id]); // quyền mới áp dụng từ lần đăng nhập sau
      console.log(`✓ ${u.name} → ${role === 'head' ? 'Trưởng khoa' : 'Dược sĩ'} (cần đăng nhập lại)`);
      return;
    }
    case 'facilities': {
      const rows = await d.all(`SELECT f.code, f.name, f.enabled, (SELECT COUNT(*) FROM users u WHERE u.facility = f.code) AS n FROM facilities f ORDER BY f.enabled DESC, f.code`);
      console.table(rows.map(r => ({ 'Mã cơ sở': r.code, 'Tên': r.name, 'Trạng thái': +r.enabled ? 'đang dùng' : 'chưa triển khai', 'Số tài khoản': +r.n })));
      return;
    }
    case 'facility': {
      const c = normCode(opt('code')), name = opt('name').trim();
      if (!c) die('Cần --code');
      const row = (await d.all(`SELECT * FROM facilities WHERE code = $1`, [c]))[0];
      const en = flag('enable') ? 1 : flag('disable') ? 0 : row ? +row.enabled : 0;
      if (!row) { if (!name) die('Cơ sở mới cần --name'); await d.run(`INSERT INTO facilities (code, name, enabled, created_at) VALUES ($1, $2, $3, $4)`, [c, name, en, t]); }
      else await d.run(`UPDATE facilities SET name = $1, enabled = $2 WHERE code = $3`, [name || row.name, en, c]);
      if (!en) await d.run(`DELETE FROM sessions WHERE facility = $1`, [c]);
      console.log(`✓ Cơ sở ${c} (${name || (row && row.name)}): ${en ? 'đang dùng' : 'chưa triển khai – không đăng nhập được'}`);
      return;
    }
    default: console.log(HELP); process.exitCode = 1;
  }
}
main().catch(e => die(e.message));
