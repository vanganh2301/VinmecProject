// Các nhà cung cấp AI cho OCR hóa đơn và nhận giọng nói. Khóa chỉ đọc từ biến môi trường (Vercel / file .env khi chạy
// npm run dev hoặc npm run eval). Mỗi biến *_MODEL có thể ghi nhiều mô hình cách nhau dấu phẩy:
// app dùng mô hình ĐẦU TIÊN, công cụ đánh giá (tools/eval.mjs) chạy thử TẤT CẢ.
import { OCR_PROMPT, OCR_USER, STT_PROMPT, vocabList } from './_prompt.js';

const env = k => (process.env[k] || '').trim();
const list = (k, def) => (env(k) || def).split(',').map(s => s.trim()).filter(Boolean);
const b64 = async blob => Buffer.from(await blob.arrayBuffer()).toString('base64');
const dataUrlParts = u => { const m = /^data:([^;]+);base64,(.*)$/s.exec(u); return m ? { mime: m[1], data: m[2] } : null; };

/** fetch + đổi lỗi thành câu tiếng Việt. Trả về JSON. */
async function call(vendor, url, init, ms = 55000) {
  let res;
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { res = await fetch(url, { ...init, signal: ac.signal }); }
  catch (e) { throw Object.assign(new Error(e.name === 'AbortError' ? `${vendor} không trả lời trong ${ms / 1000} giây.` : `Không kết nối được ${vendor}: ${e.message}`), { status: 502 }); }
  finally { clearTimeout(t); }
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = null; }
  if (!res.ok) {
    const msg = String((body && (body.error?.message || body.message || body.error)) || text).slice(0, 240);
    const why = res.status === 401 || res.status === 403 ? `Khóa ${vendor} không hợp lệ, đã bị thu hồi hoặc chưa bật quyền cho dịch vụ này.`
      : res.status === 429 ? `${vendor} báo hết hạn mức / hết tiền, hoặc gọi quá nhanh. Thử lại sau ít phút.`
      : res.status === 404 ? `${vendor}: tên mô hình không tồn tại với khóa này (kiểm tra biến *_MODEL).`
      : `${vendor} trả lỗi ${res.status}.`;
    throw Object.assign(new Error(`${why} (${msg})`), { status: [401, 403, 404].includes(res.status) ? 500 : 502, upstream: res.status });
  }
  if (!body) throw Object.assign(new Error(`${vendor} trả về dữ liệu không đọc được.`), { status: 502 });
  return body;
}
const chatText = j => String(((j.choices || [])[0] || {}).message?.content ?? '');

// ---------- OpenAI và các máy chủ kiểu OpenAI (Qwen trên Alibaba Cloud, Ollama / vLLM tự cài) ----------
function openaiLike({ id, label, vendor, base, key, ocrModels, sttModels, sttStyle }) {
  const auth = () => key() ? { Authorization: `Bearer ${key()}` } : {};
  return {
    id, label, vendor,
    ready: () => !!(base() && (key() || id === 'local')) && (ocrModels().length + sttModels().length > 0),
    models: kind => (kind === 'ocr' ? ocrModels() : sttModels()),
    async ocr({ image, model }) {
      // Prompt đặt trong tin nhắn người dùng (mô hình OCR chuyên dụng của Qwen không nhận vai trò system)
      const body = { model, temperature: 0, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: image, ...(id === 'openai' ? { detail: 'high' } : {}) } }, { type: 'text', text: OCR_PROMPT + '\n\n' + OCR_USER }] }] };
      if (id === 'openai') body.response_format = { type: 'json_object' };
      if (id === 'local') body.stream = false;
      const j = await call(vendor, base() + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(body) }, 120000);
      return { text: chatText(j), usage: { in: j.usage?.prompt_tokens, out: j.usage?.completion_tokens, raw: j.usage } };
    },
    async stt({ file, prompt, model }) {
      if (sttStyle === 'qwen') {
        // Qwen3-ASR: âm thanh dạng data URL trong input_audio; tin nhắn system đầu tiên = ngữ cảnh / từ vựng
        const audio = `data:${file.type || 'audio/wav'};base64,${await b64(file)}`;
        const send = withCtx => call(vendor, base() + '/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({ model, stream: false, asr_options: { language: 'vi', enable_itn: false },
            messages: [...(withCtx && prompt ? [{ role: 'system', content: [{ type: 'text', text: prompt }] }] : []), { role: 'user', content: [{ type: 'input_audio', input_audio: { data: audio } }] }] }),
        });
        let j;
        try { j = await send(true); }
        catch (e) { if (e.upstream === 400 && prompt) j = await send(false); else throw e; } // định dạng ngữ cảnh chưa được tài liệu nêu rõ → thử lại không ngữ cảnh
        return { text: chatText(j).trim(), usage: { in: j.usage?.prompt_tokens ?? j.usage?.input_tokens, out: j.usage?.completion_tokens ?? j.usage?.output_tokens, raw: j.usage } };
      }
      const fd = new FormData();
      fd.append('file', file, file.name || 'speech.wav');
      fd.append('model', model);
      fd.append('language', 'vi');
      fd.append('response_format', 'json');
      if (prompt) fd.append('prompt', prompt.slice(0, 800));
      const j = await call(vendor, base() + '/audio/transcriptions', { method: 'POST', headers: auth(), body: fd });
      return { text: String(j.text || '').trim(), usage: { in: j.usage?.input_tokens, out: j.usage?.output_tokens, raw: j.usage } };
    },
  };
}

// ---------- Google Gemini – Interactions API (API khuyến nghị từ 2026; generateContent đã thành "Legacy") ----------
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/interactions';
function geminiText(j) {
  if (j.status === 'failed') throw Object.assign(new Error('Gemini báo xử lý thất bại.'), { status: 502 });
  const steps = (j.steps || []).filter(s => s.type === 'model_output');
  const out = steps.flatMap(s => (s.content || []).filter(c => c.type === 'text').map(c => c.text)).join('');
  return out || j.output_text || '';
}
const geminiUsage = j => ({ in: j.usage?.total_input_tokens, out: (j.usage?.total_output_tokens || 0) + (j.usage?.total_thought_tokens || 0), raw: j.usage });
const gemini = {
  id: 'gemini', label: 'Google Gemini', vendor: 'Gemini',
  ready: () => !!env('GEMINI_API_KEY'),
  models: kind => kind === 'ocr' ? list('GEMINI_OCR_MODEL', 'gemini-3.8-flash') : list('GEMINI_STT_MODEL', 'gemini-3.5-flash-lite'),
  headers: () => ({ 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY'), 'Api-Revision': env('GEMINI_API_REVISION') || '2026-05-20' }),
  async ocr({ image, model }) {
    const p = dataUrlParts(image);
    // Gemini 3.6+ bỏ qua temperature → không gửi
    const j = await call('Gemini', GEMINI, { method: 'POST', headers: this.headers(), body: JSON.stringify({
      model, input: [{ type: 'text', text: OCR_PROMPT + '\n\n' + OCR_USER }, { type: 'image', data: p.data, mime_type: p.mime }],
      response_format: { type: 'text', mime_type: 'application/json' } }) }, 120000);
    return { text: geminiText(j), usage: geminiUsage(j) };
  },
  async stt({ file, prompt, model }) {
    const audio = { type: 'audio', data: await b64(file), mime_type: file.type || 'audio/wav' };
    const body = /transcribe/i.test(model)
      // Mô hình chuyên nhận giọng nói: gợi ý ngôn ngữ + danh sách từ vựng (tối đa 1000, tốt nhất ~100)
      ? { model, input: [audio], generation_config: { transcription_config: { language_codes: ['vi-VN'], custom_vocabulary: vocabList(prompt) } } }
      : { model, input: [{ type: 'text', text: STT_PROMPT + (prompt ? '\n' + prompt : '') }, audio] };
    const j = await call('Gemini', GEMINI, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    return { text: geminiText(j).trim(), usage: geminiUsage(j) };
  },
};

export const PROVIDERS = {
  openai: openaiLike({ id: 'openai', label: 'OpenAI', vendor: 'OpenAI', base: () => 'https://api.openai.com/v1', key: () => env('OPENAI_API_KEY'),
    ocrModels: () => list('OPENAI_OCR_MODEL', 'gpt-4.1-mini'), sttModels: () => list('OPENAI_STT_MODEL', 'gpt-4o-mini-transcribe') }),
  gemini,
  qwen: openaiLike({ id: 'qwen', label: 'Qwen (Alibaba Cloud)', vendor: 'Qwen', base: () => (env('QWEN_BASE_URL') || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, ''), key: () => env('QWEN_API_KEY'),
    ocrModels: () => list('QWEN_OCR_MODEL', 'qwen3-vl-plus'), sttModels: () => list('QWEN_STT_MODEL', 'qwen3-asr-flash'), sttStyle: 'qwen' }),
  // Qwen tự cài như thiết kế ban đầu (Ollama / vLLM / whisper.cpp kiểu OpenAI). Chỉ dùng được khi máy chủ gọi tới được
  // địa chỉ này: chạy npm run dev / npm run eval trong mạng bệnh viện. Trên Vercel thường KHÔNG tới được máy nội bộ.
  local: openaiLike({ id: 'local', label: 'Qwen tự cài (Ollama / vLLM)', vendor: 'Máy chủ tự cài', base: () => env('LOCAL_AI_URL').replace(/\/+$/, ''), key: () => env('LOCAL_AI_KEY'),
    ocrModels: () => env('LOCAL_AI_URL') ? list('LOCAL_OCR_MODEL', 'qwen2.5vl:7b') : [], sttModels: () => env('LOCAL_AI_URL') ? list('LOCAL_STT_MODEL', '') : [] }),
};
export const ORDER = ['openai', 'gemini', 'qwen', 'local'];

/** Chọn nhà cung cấp: theo yêu cầu của app (nếu đã cấu hình) → AI_OCR_PROVIDER / AI_STT_PROVIDER → cái đầu tiên có khóa. */
export function pick(kind, wanted) {
  const ok = id => PROVIDERS[id] && PROVIDERS[id].ready() && PROVIDERS[id].models(kind).length;
  if (wanted && wanted !== 'auto') {
    if (!PROVIDERS[wanted]) throw Object.assign(new Error(`Không có nhà cung cấp "${wanted}".`), { status: 400 });
    if (!ok(wanted)) throw Object.assign(new Error(`${PROVIDERS[wanted].label} chưa được cấu hình khóa / mô hình ${kind === 'ocr' ? 'OCR' : 'giọng nói'} trên máy chủ.`), { status: 503 });
    return PROVIDERS[wanted];
  }
  const def = env(kind === 'ocr' ? 'AI_OCR_PROVIDER' : 'AI_STT_PROVIDER');
  if (def && ok(def)) return PROVIDERS[def];
  const id = ORDER.find(ok);
  if (!id) throw Object.assign(new Error('Máy chủ chưa có khóa AI nào (OPENAI_API_KEY / GEMINI_API_KEY / QWEN_API_KEY). Điền vào .env hoặc biến môi trường trên Vercel.'), { status: 503 });
  return PROVIDERS[id];
}

/** Thông tin cho /api/health – không lộ khóa. */
export function summary() {
  const out = {};
  for (const id of ORDER) {
    const p = PROVIDERS[id];
    out[id] = { label: p.label, ready: p.ready(), ocr: p.ready() ? p.models('ocr') : [], stt: p.ready() ? p.models('stt') : [] };
  }
  let ocr = null, stt = null;
  try { ocr = pick('ocr').id; } catch { }
  try { stt = pick('stt').id; } catch { }
  return { providers: out, defaults: { ocr, stt } };
}
