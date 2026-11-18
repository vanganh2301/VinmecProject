// npm run env:push  –  chép các biến AI trong .env lên Vercel (môi trường Production), không in giá trị ra màn hình.
// Cần: đã chạy npx vercel login và npx vercel link (thư mục .vercel/ có sẵn). Sau đó chạy npm run deploy để áp dụng.
// Tùy chọn: --env preview  (đẩy lên Preview thay cho Production)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseEnv } from './_env.mjs';

const target = process.argv.includes('--env') ? process.argv[process.argv.indexOf('--env') + 1] : 'production';
const file = path.join(ROOT, '.env');
if (!fs.existsSync(file)) { console.error('Không thấy file .env – chép .env.example thành .env rồi điền khóa.'); process.exit(1); }
if (!fs.existsSync(path.join(ROOT, '.vercel', 'project.json'))) { console.error('Chưa liên kết project Vercel. Chạy: npx vercel link --yes'); process.exit(1); }

const vars = parseEnv(fs.readFileSync(file, 'utf8'));
const KEYS = /^(AI_|OPENAI_|GEMINI_|QWEN_|LOCAL_)/;
const run = (args, input) => spawnSync('npx', ['--yes', 'vercel', ...args], { cwd: ROOT, input, encoding: 'utf8', shell: process.platform === 'win32' });
let n = 0, fail = 0;
for (const [k, v] of Object.entries(vars)) {
  if (!KEYS.test(k)) continue;
  run(['env', 'rm', k, target, '--yes']); // xóa bản cũ (nếu có) để ghi giá trị mới
  if (!v) { console.log(`·  ${k.padEnd(20)} trống – bỏ qua (đã xóa trên Vercel nếu từng có)`); continue; }
  const r = run(['env', 'add', k, target], v);
  const secret = /KEY$/.test(k);
  if (r.status === 0) { n++; console.log(`✓  ${k.padEnd(20)} ${secret ? '(đã ẩn, ' + v.length + ' ký tự)' : v}`); }
  else { fail++; console.log(`✗  ${k.padEnd(20)} lỗi: ${(r.stderr || r.stdout || '').split('\n').filter(Boolean).pop()}`); }
}
console.log(`\nĐã đẩy ${n} biến lên Vercel (${target})${fail ? `, ${fail} lỗi` : ''}. Chạy  npm run deploy  để bản mới dùng các biến này.`);
process.exit(fail ? 1 : 0);
