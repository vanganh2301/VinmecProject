// Đọc file .env ở thư mục gốc repo vào process.env (không cần thư viện dotenv). Không in giá trị ra màn hình.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, ''); // chú thích cuối dòng
    out[m[1]] = v;
  }
  return out;
}

/** Nạp .env; biến đã có sẵn trong môi trường thì giữ nguyên. Trả về object đọc được. */
export function loadEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return {};
  const vars = parseEnv(fs.readFileSync(file, 'utf8'));
  for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined) process.env[k] = v;
  return vars;
}

// node:sqlite (cơ sở dữ liệu khi chạy trên máy) còn gắn nhãn thử nghiệm ở Node 22 – không in cảnh báo đó ra màn hình
process.removeAllListeners('warning');
process.on('warning', w => { if (!(w.name === 'ExperimentalWarning' && /SQLite/i.test(w.message))) console.warn(`${w.name}: ${w.message}`); });

// Console Windows: in tiếng Việt cho đúng
try { process.stdout.setDefaultEncoding?.('utf8'); } catch { }
