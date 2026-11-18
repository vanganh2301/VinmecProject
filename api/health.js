// GET /api/health → nhà cung cấp AI nào đã có khóa, mô hình nào đang dùng (không lộ khóa).
//   { ok, ready, providers: { openai: { label, ready, ocr: [...], stt: [...] }, gemini…, qwen…, local… }, defaults: { ocr, stt } }
import { json } from './_lib.js';
import { summary } from './_providers.js';

export function GET() {
  const s = summary();
  return json({ ok: true, ready: !!(s.defaults.ocr || s.defaults.stt), ...s });
}
