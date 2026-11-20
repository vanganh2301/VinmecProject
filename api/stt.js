// POST /api/stt  multipart: file (audio ≤ 4 MB), prompt (tùy chọn: tên thuốc trong danh mục), provider (tùy chọn)
//   → { text, provider, model, ms }
import { json, fail, check } from './_lib.js';
import { pick } from './_providers.js';
import { requireUser } from './_auth.js';

export async function POST(req) {
  const bad = check(req, 4_400_000);
  if (bad) return bad;
  const me = await requireUser(req); // chỉ dược sĩ đã đăng nhập mới dùng được AI (khóa AI tính tiền theo lần gọi)
  if (me.res) return me.res;
  let form;
  try { form = await req.formData(); } catch { return fail(400, 'Dữ liệu gửi lên không phải multipart/form-data.'); }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) return fail(400, 'Thiếu file ghi âm.');
  if (file.size > 4_000_000) return fail(413, 'Đoạn ghi âm quá dài.');
  const prompt = String(form.get('prompt') || '').slice(0, 1500);
  try {
    const p = pick('stt', String(form.get('provider') || '')), model = p.models('stt')[0], t = Date.now();
    const r = await p.stt({ file, prompt, model });
    return json({ text: r.text, provider: p.id, model, ms: Date.now() - t });
  } catch (e) {
    return fail(e.status || 500, e.message);
  }
}

export function GET() { return fail(405, 'Dùng POST.'); }
