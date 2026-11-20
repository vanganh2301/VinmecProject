// POST /api/ocr  { image: "data:image/jpeg;base64,...", provider?: "auto"|"openai"|"gemini"|"qwen"|"local" }
//   → { text, provider, model, ms }
// Prompt cố định ở máy chủ (_prompt.js): endpoint chỉ đọc hóa đơn, không dùng được làm chatbot tự do.
import { json, fail, check } from './_lib.js';
import { pick } from './_providers.js';
import { requireUser } from './_auth.js';

export async function POST(req) {
  const bad = check(req, 4_400_000); // Vercel giới hạn thân request 4,5 MB
  if (bad) return bad;
  const me = await requireUser(req); // chỉ dược sĩ đã đăng nhập mới dùng được AI (khóa AI tính tiền theo lần gọi)
  if (me.res) return me.res;
  let body;
  try { body = await req.json(); } catch { return fail(400, 'Dữ liệu gửi lên không phải JSON.'); }
  const { image, provider } = body || {};
  if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) return fail(400, 'Thiếu ảnh hóa đơn (data URL JPEG/PNG/WebP).');
  try {
    const p = pick('ocr', provider), model = p.models('ocr')[0], t = Date.now();
    const r = await p.ocr({ image, model });
    if (/"error"\s*:\s*"not_invoice"/.test(r.text)) return fail(422, 'Ảnh này không giống hóa đơn – chụp lại cả tờ hóa đơn, đủ sáng, không bị lóa.');
    return json({ text: r.text, provider: p.id, model, ms: Date.now() - t });
  } catch (e) {
    return fail(e.status || 500, e.message);
  }
}

export function GET() { return fail(405, 'Dùng POST.'); }
