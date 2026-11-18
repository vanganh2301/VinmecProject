// npm run eval  –  so sánh các nhà cung cấp AI (OpenAI / Gemini / Qwen / Qwen tự cài) trên cùng một bộ mẫu.
//
// Mẫu (không đưa lên git, xem .gitignore):
//   eval/samples/ocr/<tên>.jpg|png|webp  + <tên>.json   ảnh hóa đơn + đáp án đúng (cùng mẫu JSON với prompt OCR)
//   eval/samples/stt/<tên>.wav|mp3|m4a|webm|ogg + <tên>.txt   ghi âm + câu đúng; tên thuốc đặt trong [ngoặc vuông]
//   eval/samples/stt/vocab.txt (tùy chọn)  mỗi dòng 1 tên thuốc – gửi kèm như danh mục của app
// Tạo nhanh bộ mẫu mô phỏng: npm run eval:samples
//
// Tùy chọn: --only ocr|stt   --provider openai,gemini   --model <tên>   --runs 2   --limit 5   --delay 1500
// Kết quả: eval/results/<thời điểm>.json (từng lần gọi) và .md (bảng tổng hợp). Không in khóa API ra màn hình.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadEnv } from './_env.mjs';

loadEnv();
const { PROVIDERS, ORDER } = await import(pathToFileURL(path.join(ROOT, 'api', '_providers.js')).href);

// ---------- tham số ----------
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = opt('only', '');
const WANT = (opt('provider', '') || '').split(',').filter(Boolean);
const MODEL = opt('model', '');
const RUNS = Math.max(1, +opt('runs', 1) || 1);
const LIMIT = +opt('limit', 0) || 0;
const DELAY = +opt('delay', 0) || 0;
const SAMPLES = path.resolve(ROOT, opt('samples', 'eval/samples'));
const OUT = path.join(ROOT, 'eval', 'results');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctl = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : null;
const fmtPct = v => v == null ? '—' : v.toFixed(1).replace('.', ',') + '%';
const fmtMs = v => v == null ? '—' : (v / 1000).toFixed(1).replace('.', ',') + ' s';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.ogg': 'audio/ogg' };

// ---------- chuẩn hóa ----------
const nfc = s => String(s ?? '').normalize('NFC');
const noMark = s => nfc(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const squash = s => nfc(s).toLowerCase().replace(/[\s.,;:'"“”()\-–_/\\]+/g, '');
function lev(a, b) {
  a = [...a]; b = [...b];
  if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const sim = (a, b) => { const x = nfc(a).toLowerCase().trim(), y = nfc(b).toLowerCase().trim(); return !x && !y ? 1 : 1 - lev(x, y) / Math.max(x.length, y.length); };
const toNum = v => { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return v; const s = String(v).replace(/[^\d,.-]/g, ''); const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/[.,]/g, '')); return Number.isFinite(n) ? n : null; };
const toDate = v => { const s = String(v || '').trim(); let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

// Đọc số tiếng Việt (để "hai hộp" và "2 hộp" được coi là như nhau khi tính WER)
const DIG = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function readVi(n) {
  n = Math.floor(n);
  if (n < 10) return DIG[n];
  if (n < 20) return 'mười' + (n % 10 ? ' ' + (n % 10 === 5 ? 'năm' : DIG[n % 10]) : '');
  if (n < 100) return DIG[Math.floor(n / 10)] + ' mươi' + (n % 10 ? ' ' + DIG[n % 10] : '');
  if (n < 1000) { const r = n % 100; return DIG[Math.floor(n / 100)] + ' trăm' + (r ? (r < 10 ? ' lẻ ' + DIG[r] : ' ' + readVi(r)) : ''); }
  if (n < 1e6) { const r = n % 1000; return readVi(Math.floor(n / 1000)) + ' nghìn' + (r ? (r < 100 ? ' không trăm ' + (r < 10 ? 'lẻ ' + DIG[r] : readVi(r)) : ' ' + readVi(r)) : ''); }
  return String(n);
}
function normSpeech(s) {
  let t = nfc(s).toLowerCase().replace(/\[|\]/g, '');
  t = t.replace(/(\d)[.,](\d)/g, '$1 phẩy $2').replace(/%/g, ' phần trăm ').replace(/(\d)([a-zà-ỹ])/g, '$1 $2');
  t = t.replace(/\d+/g, d => ' ' + readVi(+d) + ' ');
  t = t.replace(/[.,!?;:"“”'()…–-]/g, ' ');
  t = t.replace(/\bmi ?li ?gam\b|\bmg\b/g, 'miligam').replace(/\bmi ?li ?lít\b|\bml\b/g, 'mililit').replace(/\bngàn\b/g, 'nghìn');
  // biến thể đọc số: hai mươi tư/mốt/lăm, linh/lẻ
  t = t.replace(/mươi tư\b/g, 'mươi bốn').replace(/mươi mốt\b/g, 'mươi một').replace(/\blăm\b/g, 'năm').replace(/\blinh\b/g, 'lẻ');
  return t.replace(/\s+/g, ' ').trim();
}

// ---------- OCR ----------
const HEAD = [['supplier', 'text'], ['supplierTaxCode', 'code'], ['invoiceSymbol', 'code'], ['invoiceNo', 'code'], ['invoiceDate', 'date'], ['subtotal', 'num'], ['tax', 'num'], ['total', 'num']];
const LINE = [['name', 'text'], ['unit', 'text'], ['lot', 'code'], ['expiry', 'date'], ['qty', 'num'], ['price', 'num'], ['taxRate', 'num'], ['amount', 'num']];
const has = (v, kind) => kind === 'num' ? toNum(v) !== null : String(v ?? '').trim() !== '';
function same(a, b, kind) {
  if (kind === 'num') { const x = toNum(a), y = toNum(b); return x !== null && y !== null && Math.abs(x - y) <= 0.5; }
  if (kind === 'date') return toDate(a) !== '' && toDate(a) === toDate(b);
  if (kind === 'code') return String(a ?? '').replace(/\s+/g, '').toUpperCase() === String(b ?? '').replace(/\s+/g, '').toUpperCase();
  return squash(a) === squash(b);
}
function parseJson(txt) { const a = txt.indexOf('{'), b = txt.lastIndexOf('}'); if (a < 0 || b < a) return null; try { return JSON.parse(txt.slice(a, b + 1)); } catch { return null; } }
function scoreOcr(truth, txt) {
  const got = parseJson(txt);
  const r = { json: !!got, head: [0, 0], line: [0, 0], wrong: [], lines: [(truth.lines || []).length, got && Array.isArray(got.lines) ? got.lines.length : 0], nameSim: [] };
  for (const [k, kind] of HEAD) if (has(truth[k], kind)) { r.head[1]++; if (got && same(truth[k], got[k], kind)) r.head[0]++; else r.wrong.push(`${k}: "${truth[k]}" → "${got ? got[k] ?? '' : ''}"`); }
  const gl = got && Array.isArray(got.lines) ? got.lines : [];
  (truth.lines || []).forEach((t, i) => {
    const g = gl[i] || {};
    if (t.name) r.nameSim.push(sim(t.name, g.name || ''));
    for (const [k, kind] of LINE) if (has(t[k], kind)) { r.line[1]++; if (same(t[k], g[k], kind)) r.line[0]++; else if (r.wrong.length < 12) r.wrong.push(`dòng ${i + 1} ${k}: "${t[k]}" → "${g[k] ?? ''}"`); }
  });
  // 3 trường quyết toán: Số HĐ, ngày (ở đây là ngày HĐ), SL hàng tổng – cộng thêm Tổng tiền
  const sumQty = l => (l || []).reduce((s, x) => s + (toNum(x.qty) || 0), 0);
  r.settle = !!got && same(truth.invoiceNo, got.invoiceNo, 'code') && same(truth.invoiceDate, got.invoiceDate, 'date') && Math.abs(sumQty(truth.lines) - sumQty(gl)) < 0.5 && same(truth.total, got.total, 'num');
  return r;
}

// ---------- giọng nói ----------
function scoreStt(ref, hyp) {
  const R = normSpeech(ref), H = normSpeech(hyp);
  const rw = R ? R.split(' ') : [], hw = H ? H.split(' ') : [];
  const terms = [...String(ref).matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
  const hitT = terms.filter(t => noMark(squash(hyp)).toLowerCase().includes(noMark(squash(t)).toLowerCase()));
  return { wer: rw.length ? lev(rw, hw) / rw.length : (hw.length ? 1 : 0), cer: R.length ? lev(R, H) / R.length : (H.length ? 1 : 0), terms: terms.length, hit: hitT.length, exact: R === H, missed: terms.filter(t => !hitT.includes(t)) };
}
function wavSeconds(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  let o = 12, rate = 0;
  while (o + 8 <= buf.length) { const id = buf.toString('ascii', o, o + 4), n = buf.readUInt32LE(o + 4); if (id === 'fmt ') rate = buf.readUInt32LE(o + 16); if (id === 'data') return rate ? Math.min(n, buf.length - o - 8) / rate : null; o += 8 + n + (n % 2); }
  return null;
}

// ---------- giá (USD) – tools/prices.json, sửa theo trang giá của từng hãng ----------
const PRICES = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'prices.json'), 'utf8')); } catch { return {}; } })();
function cost(model, usage, seconds) {
  const p = PRICES[model]; if (!p) return null;
  let c = 0, known = false;
  if (p.perMin != null && seconds != null) { c += p.perMin * seconds / 60; known = true; }
  if (p.in != null && usage && usage.in != null) { c += p.in * usage.in / 1e6; known = true; }
  if (p.out != null && usage && usage.out != null) { c += p.out * usage.out / 1e6; known = true; }
  return known ? c : null;
}

// ---------- nạp mẫu ----------
function samples(kind) {
  const dir = path.join(SAMPLES, kind);
  if (!fs.existsSync(dir)) return [];
  const exts = kind === 'ocr' ? ['.jpg', '.jpeg', '.png', '.webp'] : ['.wav', '.mp3', '.m4a', '.webm', '.ogg'];
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const ext = path.extname(f).toLowerCase(); if (!exts.includes(ext)) continue;
    const base = path.join(dir, f.slice(0, -ext.length)), truthFile = base + (kind === 'ocr' ? '.json' : '.txt');
    if (!fs.existsSync(truthFile)) { console.warn(`  bỏ qua ${f}: thiếu ${path.basename(truthFile)}`); continue; }
    const tag = (f.slice(0, -ext.length).split('-').slice(1).join('-')) || 'mặc định';
    out.push({ name: f, tag, file: path.join(dir, f), mime: MIME[ext], truth: kind === 'ocr' ? JSON.parse(fs.readFileSync(truthFile, 'utf8')) : fs.readFileSync(truthFile, 'utf8').trim() });
  }
  return LIMIT ? out.slice(0, LIMIT) : out;
}
function vocabPrompt(stt) {
  const f = path.join(SAMPLES, 'stt', 'vocab.txt');
  let names = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
  for (const s of stt) for (const m of s.truth.matchAll(/\[([^\]]+)\]/g)) if (!names.includes(m[1])) names.push(m[1]);
  // giống app: 'Nhà thuốc bệnh viện. Tên thuốc: A, B, C' (≤ 700 ký tự)
  return ('Nhà thuốc bệnh viện. Tên thuốc: ' + names.join(', ')).slice(0, 700);
}

// ---------- chạy ----------
async function withRetry(fn) {
  try { return await fn(); }
  catch (e) { if (e.upstream === 429) { await sleep(20000); return fn(); } throw e; }
}
async function runKind(kind, list, prompt) {
  const rows = [];
  const provs = ORDER.filter(id => (!WANT.length || WANT.includes(id)) && PROVIDERS[id].ready() && PROVIDERS[id].models(kind).length);
  if (!provs.length) { console.log(`\n${kind.toUpperCase()}: không có nhà cung cấp nào có khóa / mô hình – điền .env`); return rows; }
  if (!list.length) { console.log(`\n${kind.toUpperCase()}: chưa có mẫu trong ${path.relative(ROOT, path.join(SAMPLES, kind))} – chạy npm run eval:samples`); return rows; }
  console.log(`\n${kind === 'ocr' ? 'OCR hóa đơn' : 'Giọng nói'}: ${list.length} mẫu × ${RUNS} lần · ${provs.map(id => PROVIDERS[id].models(kind).filter(m => !MODEL || m === MODEL).map(m => id + '/' + m).join(', ')).join(' · ')}`);
  await Promise.all(provs.map(async id => {
    const p = PROVIDERS[id];
    for (const model of p.models(kind).filter(m => !MODEL || m === MODEL)) {
      for (let run = 1; run <= RUNS; run++) for (const s of list) {
        const buf = fs.readFileSync(s.file), t = Date.now();
        const row = { kind, provider: id, model, sample: s.name, tag: s.tag, run };
        try {
          if (kind === 'ocr') {
            const r = await withRetry(() => p.ocr({ image: `data:${s.mime};base64,${buf.toString('base64')}`, model }));
            Object.assign(row, { ms: Date.now() - t, usage: r.usage && { in: r.usage.in, out: r.usage.out }, text: r.text, score: scoreOcr(s.truth, r.text) });
            row.cost = cost(model, r.usage, null);
          } else {
            const secs = wavSeconds(buf);
            const r = await withRetry(() => p.stt({ file: new File([buf], s.name, { type: s.mime }), prompt, model }));
            Object.assign(row, { ms: Date.now() - t, usage: r.usage && { in: r.usage.in, out: r.usage.out }, text: r.text, seconds: secs, score: scoreStt(s.truth, r.text) });
            row.cost = cost(model, r.usage, secs);
          }
          process.stdout.write('.');
        } catch (e) { Object.assign(row, { ms: Date.now() - t, error: e.message }); process.stdout.write('x'); }
        rows.push(row);
        if (DELAY) await sleep(DELAY);
      }
    }
  }));
  process.stdout.write('\n');
  return rows;
}

function summarize(rows) {
  const groups = {};
  for (const r of rows) (groups[`${r.kind}|${r.provider}|${r.model}`] ||= []).push(r);
  return Object.entries(groups).map(([k, rs]) => {
    const [kind, provider, model] = k.split('|'), ok = rs.filter(r => !r.error), ms = ok.map(r => r.ms);
    const costs = ok.map(r => r.cost).filter(c => c != null);
    const base = { kind, provider, model, n: rs.length, errors: rs.length - ok.length, msMed: median(ms), msP90: pctl(ms, 0.9), cost1k: costs.length === ok.length && ok.length ? 1000 * costs.reduce((a, b) => a + b, 0) / ok.length : null, tokIn: median(ok.map(r => r.usage?.in).filter(x => x != null)), tokOut: median(ok.map(r => r.usage?.out).filter(x => x != null)), errorSamples: [...new Set(rs.filter(r => r.error).map(r => r.error))].slice(0, 3) };
    if (kind === 'ocr') {
      const h = ok.reduce((a, r) => [a[0] + r.score.head[0], a[1] + r.score.head[1]], [0, 0]), l = ok.reduce((a, r) => [a[0] + r.score.line[0], a[1] + r.score.line[1]], [0, 0]);
      const byTag = {}; for (const r of ok) { const t = byTag[r.tag] ||= [0, 0]; t[0] += r.score.head[0] + r.score.line[0]; t[1] += r.score.head[1] + r.score.line[1]; }
      const consist = runsConsistency(ok);
      return { ...base, json: pct(ok.filter(r => r.score.json).length, rs.length), head: pct(h[0], h[1]), line: pct(l[0], l[1]), all: pct(h[0] + l[0], h[1] + l[1]), settle: pct(ok.filter(r => r.score.settle).length, rs.length), lineCount: pct(ok.filter(r => r.score.lines[0] === r.score.lines[1]).length, rs.length), nameSim: ok.length ? 100 * median(ok.flatMap(r => r.score.nameSim)) : null, byTag: Object.fromEntries(Object.entries(byTag).map(([t, v]) => [t, pct(v[0], v[1])])), consist };
    }
    const words = ok.map(r => r.score.wer), terms = ok.reduce((a, r) => [a[0] + r.score.hit, a[1] + r.score.terms], [0, 0]);
    const byTag = {}; for (const r of ok) { const t = byTag[r.tag] ||= [0, 0]; t[0] += r.score.hit; t[1] += r.score.terms; }
    return { ...base, wer: words.length ? 100 * words.reduce((a, b) => a + b, 0) / words.length : null, cer: ok.length ? 100 * ok.reduce((a, r) => a + r.score.cer, 0) / ok.length : null, terms: pct(terms[0], terms[1]), exact: pct(ok.filter(r => r.score.exact).length, rs.length), byTag: Object.fromEntries(Object.entries(byTag).map(([t, v]) => [t, pct(v[0], v[1])])), missed: [...new Set(ok.flatMap(r => r.score.missed))].slice(0, 8), consist: runsConsistency(ok) };
  });
}
// Cùng mẫu, chạy nhiều lần (--runs): tỉ lệ mẫu cho ra đúng cùng một kết quả mọi lần
function runsConsistency(ok) {
  if (RUNS < 2) return null;
  const by = {}; for (const r of ok) (by[r.sample] ||= []).push(r.text);
  const v = Object.values(by).filter(a => a.length > 1);
  return v.length ? pct(v.filter(a => a.every(x => x === a[0])).length, v.length) : null;
}

function report(sum, meta) {
  const L = [];
  L.push(`# Đánh giá AI – OCR hóa đơn & giọng nói`, '', `Chạy lúc ${meta.at} · ${meta.runs} lần/mẫu · ${meta.ocrN} ảnh hóa đơn · ${meta.sttN} đoạn ghi âm · bộ mẫu \`${meta.samples}\``, '');
  const ocr = sum.filter(s => s.kind === 'ocr').sort((a, b) => (b.all ?? -1) - (a.all ?? -1));
  if (ocr.length) {
    L.push('## OCR hóa đơn', '', 'Xếp theo độ chính xác toàn bộ ô. "Quyết toán đúng" = Số HĐ, ngày HĐ, tổng SL và tổng tiền đều đúng – đủ để copy quyết toán không phải sửa.', '');
    L.push('| Nhà cung cấp / mô hình | Toàn bộ ô | Đầu HĐ | Dòng hàng | Quyết toán đúng | Đúng số dòng | JSON hợp lệ | Thời gian (trung vị / p90) | Chi phí / 1.000 HĐ | Lỗi gọi |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const s of ocr) L.push(`| ${s.provider} / \`${s.model}\` | **${fmtPct(s.all)}** | ${fmtPct(s.head)} | ${fmtPct(s.line)} | ${fmtPct(s.settle)} | ${fmtPct(s.lineCount)} | ${fmtPct(s.json)} | ${fmtMs(s.msMed)} / ${fmtMs(s.msP90)} | ${s.cost1k == null ? 'chưa có giá' : '$' + s.cost1k.toFixed(2)} | ${s.errors}/${s.n} |`);
    const tags = [...new Set(ocr.flatMap(s => Object.keys(s.byTag)))];
    if (tags.length > 1) {
      L.push('', '**Theo chất lượng ảnh** (độ chính xác toàn bộ ô):', '', `| Mô hình | ${tags.join(' | ')} |`, `| --- |${tags.map(() => ' --- |').join('')}`);
      for (const s of ocr) L.push(`| ${s.provider} / \`${s.model}\` | ${tags.map(t => fmtPct(s.byTag[t])).join(' | ')} |`);
    }
    if (ocr.some(s => s.consist != null)) L.push('', `**Ổn định giữa các lần chạy:** ${ocr.map(s => `${s.provider}/${s.model} ${fmtPct(s.consist)}`).join(' · ')}`);
  }
  const stt = sum.filter(s => s.kind === 'stt').sort((a, b) => (b.terms ?? -1) - (a.terms ?? -1) || (a.wer ?? 999) - (b.wer ?? 999));
  if (stt.length) {
    L.push('', '## Giọng nói', '', 'Xếp theo tỉ lệ nhận đúng tên thuốc (điều quyết định thêm đúng hàng vào giỏ), rồi theo WER (tỉ lệ lỗi từ, càng thấp càng tốt).', '');
    L.push('| Nhà cung cấp / mô hình | Đúng tên thuốc | WER | CER | Câu đúng hoàn toàn | Thời gian (trung vị / p90) | Chi phí / 1.000 lần | Lỗi gọi |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const s of stt) L.push(`| ${s.provider} / \`${s.model}\` | **${fmtPct(s.terms)}** | ${fmtPct(s.wer)} | ${fmtPct(s.cer)} | ${fmtPct(s.exact)} | ${fmtMs(s.msMed)} / ${fmtMs(s.msP90)} | ${s.cost1k == null ? 'chưa có giá' : '$' + s.cost1k.toFixed(2)} | ${s.errors}/${s.n} |`);
    const tags = [...new Set(stt.flatMap(s => Object.keys(s.byTag)))];
    if (tags.length > 1) {
      L.push('', '**Đúng tên thuốc theo loại ghi âm:**', '', `| Mô hình | ${tags.join(' | ')} |`, `| --- |${tags.map(() => ' --- |').join('')}`);
      for (const s of stt) L.push(`| ${s.provider} / \`${s.model}\` | ${tags.map(t => fmtPct(s.byTag[t])).join(' | ')} |`);
    }
    for (const s of stt) if (s.missed.length) L.push('', `- ${s.provider}/${s.model} hay sai: ${s.missed.join(', ')}`);
  }
  const errs = sum.filter(s => s.errorSamples.length);
  if (errs.length) { L.push('', '## Lỗi gọi API', ''); for (const s of errs) L.push(`- ${s.kind} ${s.provider}/${s.model}: ${s.errorSamples.join(' | ')}`); }
  L.push('', '## Cách đọc', '', '- Bộ mẫu do `npm run eval:samples` sinh ra là **mô phỏng** (hóa đơn tự vẽ, giọng máy). Trước khi chốt, thêm ảnh chụp thật (đã che thông tin) và ghi âm của dược sĩ vào cùng thư mục rồi chạy lại.', '- Chi phí tính từ số token / số giây mà nhà cung cấp trả về × giá trong `tools/prices.json`. Giá đổi theo thời điểm: kiểm tra trang giá trước khi báo cáo.', '- Thời gian đo từ máy chạy lệnh (gồm cả mạng), không phải thời gian dược sĩ chờ trên điện thoại.');
  return L.join('\n') + '\n';
}

const ocrList = ONLY === 'stt' ? [] : samples('ocr');
const sttList = ONLY === 'ocr' ? [] : samples('stt');
console.log('Nhà cung cấp có khóa: ' + (ORDER.filter(id => PROVIDERS[id].ready()).map(id => PROVIDERS[id].label).join(', ') || 'KHÔNG CÓ – điền khóa vào file .env'));
const rows = [
  ...(ONLY === 'stt' ? [] : await runKind('ocr', ocrList)),
  ...(ONLY === 'ocr' ? [] : await runKind('stt', sttList, vocabPrompt(sttList))),
];
if (!rows.length) process.exit(1);
const sum = summarize(rows);
const at = new Date(), z = n => String(n).padStart(2, '0'), stamp = `${at.getFullYear()}-${z(at.getMonth() + 1)}-${z(at.getDate())}_${z(at.getHours())}-${z(at.getMinutes())}-${z(at.getSeconds())}`;
const meta = { at: at.toLocaleString('vi-VN'), runs: RUNS, ocrN: ocrList.length, sttN: sttList.length, samples: path.relative(ROOT, SAMPLES).replace(/\\/g, '/') };
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, stamp + '.json'), JSON.stringify({ meta, summary: sum, rows }, null, 2));
const md = report(sum, meta);
fs.writeFileSync(path.join(OUT, stamp + '.md'), md);
console.log('\n' + md);
console.log(`Đã ghi: eval/results/${stamp}.md và .json`);
