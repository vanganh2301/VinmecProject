// npm run eval:samples  –  sinh bộ mẫu MÔ PHỎNG cho npm run eval (không có dữ liệu thật, không có thông tin bệnh nhân).
//   OCR: hóa đơn GTGT tự vẽ, nhà cung cấp hư cấu, chụp bằng Chrome headless ở 5 điều kiện ảnh:
//        clean (thẳng, rõ) · photo (chụp nghiêng trên bàn) · rotate (lệch 3°) · blur (mờ) · dark (thiếu sáng)
//        → eval/samples/ocr/hd01-clean.png + hd01-clean.json (đáp án)
//   Giọng nói: danh sách câu cho dược sĩ tự đọc (eval/samples/stt/DOC-CHO-DUOC-SI.txt) + vocab.txt.
//        --tts : đọc các câu bằng giọng máy OpenAI (cần OPENAI_API_KEY) → c01-giongmay.wav + c01-giongmay.txt
// Tùy chọn: --n 6 (số hóa đơn)  --chrome "<đường dẫn chrome.exe>"
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, loadEnv } from './_env.mjs';

loadEnv();
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const N = Math.max(1, +opt('n', 6) || 6);
const DIR = path.join(ROOT, 'eval', 'samples');
const OCR = path.join(DIR, 'ocr'), STT = path.join(DIR, 'stt'), RENDER = path.join(DIR, '.render');
for (const d of [OCR, STT, RENDER]) fs.mkdirSync(d, { recursive: true });

// ---------- số ngẫu nhiên cố định (chạy lại ra đúng bộ mẫu cũ) ----------
let seed = 20261119;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const money = n => n.toLocaleString('vi-VN');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SUPPLIERS = [
  ['CÔNG TY TNHH DƯỢC PHẨM MINH TÂM (MẪU)', '9990001231', 'Số 12 đường Mẫu, Quận Thử, TP. Mẫu'],
  ['CÔNG TY CỔ PHẦN THIẾT BỊ Y TẾ HÒA AN (MẪU)', '9990004562', 'Lô B3 khu công nghiệp Mẫu, tỉnh Thử'],
  ['CÔNG TY TNHH PHÂN PHỐI DƯỢC SAO MAI (MẪU)', '9990007893', '45 phố Giả Định, phường Thử Nghiệm'],
];
const ITEMS = [ // tên, ĐVT, giá, thuế suất
  ['Paracetamol 500mg (H/10 vỉ x 10 viên)', 'Hộp', 45000, 5], ['Efferalgan 500mg sủi (H/4 vỉ x 4 viên)', 'Hộp', 52000, 5],
  ['Cetirizine 10mg (H/10 vỉ x 10 viên)', 'Hộp', 38000, 5], ['Omeprazole 20mg (H/2 vỉ x 7 viên)', 'Hộp', 61000, 5],
  ['Smecta 3g (H/30 gói)', 'Hộp', 118000, 5], ['Natri clorid 0,9% 10ml', 'Lọ', 3500, 5],
  ['Dextromethorphan siro 60ml', 'Chai', 27000, 5], ['Vitamin C 500mg (Lọ 100 viên)', 'Lọ', 85000, 8],
  ['Omega 3 Fish Oil 1000mg (Lọ 100 viên)', 'Lọ', 240000, 8], ['Kẽm Gluconat 10mg (H/3 vỉ x 10 viên)', 'Hộp', 69000, 8],
  ['Khẩu trang y tế 4 lớp (H/50 cái)', 'Hộp', 35000, 10], ['Bông gạc tiệt trùng 10x10cm (Gói 10 miếng)', 'Gói', 12000, 10],
  ['Nhiệt kế điện tử', 'Cái', 95000, 10], ['Amoxicillin 500mg (H/10 vỉ x 10 viên)', 'Hộp', 76000, 5],
];
const VARIANTS = {
  clean: '',
  photo: 'body{background:#7b7468}.paper{transform:perspective(1400px) rotateX(9deg) rotateZ(-2.2deg) scale(.9);box-shadow:0 30px 60px rgba(0,0,0,.45);filter:sepia(.18) brightness(.93)}',
  rotate: '.paper{transform:rotate(3deg) scale(.95)}',
  blur: '.paper{filter:blur(1.15px)}',
  dark: '.paper{filter:brightness(.58) contrast(.82)}',
};

function invoice(i) {
  const [supplier, tax, addr] = SUPPLIERS[i % SUPPLIERS.length];
  const day = int(1, 18), date = `2026-11-${String(day).padStart(2, '0')}`;
  const pool = [...ITEMS].sort(() => rnd() - 0.5).slice(0, int(3, 8));
  const lines = pool.map(([name, unit, price, taxRate]) => {
    const qty = pick([2, 5, 10, 12, 20, 24, 30, 50, 100]);
    const lot = pick(['PA', 'EF', 'CT', 'OM', 'SM', 'NC', 'VT', 'KZ']) + int(2401, 2612) + pick(['A', 'B', 'C', '']);
    const expiry = `${int(2027, 2029)}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;
    return { code: 'SP' + int(1000, 9999), name, unit, lot, expiry, qty, price, discount: 0, taxRate, amount: qty * price };
  });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0), taxAmt = lines.reduce((s, l) => s + Math.round(l.amount * l.taxRate / 100), 0);
  return {
    supplier, supplierTaxCode: tax, invoiceSymbol: pick(['1C26TAA', '1C26TMH', '1K26TSM']), invoiceNo: String(int(120, 9800)).padStart(8, '0'), invoiceDate: date,
    lookupCode: 'MAU' + int(100000, 999999), poNo: 'PO' + int(4500000, 4599999), lines, subtotal, tax: taxAmt, total: subtotal + taxAmt, _addr: addr,
  };
}

function html(inv, css) {
  const d = inv.invoiceDate.split('-'), fmtD = s => s.split('-').reverse().join('/');
  const rates = [...new Set(inv.lines.map(l => l.taxRate))].sort();
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#fff;font-family:"Times New Roman",serif;color:#111}
  .paper{width:880px;margin:30px auto;background:#fff;padding:34px 40px;position:relative;font-size:15px}
  h1{text-align:center;color:#b0161d;font-size:24px;margin:6px 0 2px}.c{text-align:center}.r{text-align:right}.b{font-weight:bold}
  .wm{position:absolute;top:44%;left:6%;transform:rotate(-24deg);font-size:58px;color:rgba(200,0,0,.08);font-weight:bold;white-space:nowrap}
  table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #555;padding:5px 6px;font-size:13.5px;vertical-align:top}th{background:#f2f2f2}
  .meta{display:flex;justify-content:space-between;margin-top:6px}.kv{margin:3px 0}${css}</style></head><body><div class="paper">
  <div class="wm">MẪU THỬ – KHÔNG CÓ GIÁ TRỊ</div>
  <div class="meta"><div></div><div class="r">Ký hiệu: <b>${inv.invoiceSymbol}</b><br>Số: <b style="color:#b0161d">${inv.invoiceNo}</b></div></div>
  <h1>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</h1><div class="c"><i>Ngày ${d[2]} tháng ${d[1]} năm ${d[0]}</i></div>
  <div class="c" style="font-size:13px;margin-top:4px">Mã tra cứu: ${inv.lookupCode}</div>
  <div class="kv" style="margin-top:14px">Đơn vị bán hàng: <b>${esc(inv.supplier)}</b></div>
  <div class="kv">Mã số thuế: <b>${inv.supplierTaxCode}</b></div><div class="kv">Địa chỉ: ${esc(inv._addr)}</div>
  <div class="kv" style="margin-top:10px">Đơn vị mua hàng: Nhà thuốc bệnh viện (mẫu thử)</div><div class="kv">Số đơn đặt hàng (PO): ${inv.poNo} · Hình thức thanh toán: CK</div>
  <table><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng hóa, dịch vụ</th><th>Số lô</th><th>Hạn dùng</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thuế suất</th><th>Thành tiền</th></tr>
  ${inv.lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${l.code}</td><td>${esc(l.name)}</td><td>${l.lot}</td><td>${fmtD(l.expiry)}</td><td>${l.unit}</td><td class="r">${money(l.qty)}</td><td class="r">${money(l.price)}</td><td class="c">${l.taxRate}%</td><td class="r">${money(l.amount)}</td></tr>`).join('')}
  <tr><td colspan="9" class="r b">Cộng tiền hàng</td><td class="r b">${money(inv.subtotal)}</td></tr>
  ${rates.map(r => { const s = inv.lines.filter(l => l.taxRate === r).reduce((a, l) => a + l.amount, 0); return `<tr><td colspan="9" class="r">Thuế GTGT ${r}% (trên ${money(s)})</td><td class="r">${money(Math.round(s * r / 100))}</td></tr>`; }).join('')}
  <tr><td colspan="9" class="r b">Tiền thuế GTGT</td><td class="r b">${money(inv.tax)}</td></tr>
  <tr><td colspan="9" class="r b">Tổng tiền thanh toán</td><td class="r b">${money(inv.total)}</td></tr></table>
  <div class="meta" style="margin-top:26px"><div class="c">Người mua hàng<br><i>(Ký, ghi rõ họ tên)</i></div><div class="c">Người bán hàng<br><i>(Ký điện tử – mẫu thử)</i></div></div>
  </div></body></html>`;
}

function chromePath() {
  const c = [opt('chrome'), process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return c.find(p => p && fs.existsSync(p));
}

// ---------- OCR ----------
const chrome = chromePath();
if (!chrome) console.log('Không thấy Chrome / Edge – bỏ qua ảnh hóa đơn (dùng --chrome "<đường dẫn>").');
else {
  let n = 0;
  for (let i = 0; i < N; i++) {
    const inv = invoice(i), id = 'hd' + String(i + 1).padStart(2, '0');
    const truth = { ...inv }; delete truth._addr;
    for (const [v, css] of Object.entries(VARIANTS)) {
      const page = path.join(RENDER, `${id}-${v}.html`), png = path.join(OCR, `${id}-${v}.png`);
      fs.writeFileSync(page, html(inv, css));
      const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=960,1040', `--screenshot=${png}`, pathToFileURL(page).href], { encoding: 'utf8', timeout: 60000 });
      if (!fs.existsSync(png)) { console.log(`✗ ${id}-${v}: ${(r.stderr || r.error || '').toString().split('\n')[0]}`); continue; }
      fs.writeFileSync(path.join(OCR, `${id}-${v}.json`), JSON.stringify(truth, null, 2));
      n++;
    }
  }
  console.log(`OCR: ${n} ảnh (${N} hóa đơn × ${Object.keys(VARIANTS).length} điều kiện) → eval/samples/ocr/`);
}

// ---------- giọng nói ----------
const SENT = [
  'hai hộp [Paracetamol 500mg]', 'ba vỉ [Efferalgan] sủi', 'một hộp [Cetirizine 10mg]', '[Omeprazole 20mg] hai hộp',
  'năm gói [Smecta]', 'hai lọ [Natri clorid] nhỏ mắt', 'một chai [Dextromethorphan] siro', '[Vitamin C 500mg] một lọ',
  'một lọ [Omega 3] và hai hộp [Kẽm Gluconat]', 'mười cái [khẩu trang y tế]', 'ba gói [bông gạc] tiệt trùng', 'một cái [nhiệt kế điện tử]',
  '[Strepsils] hai vỉ', 'cho tôi bốn vỉ [Paracetamol] với một hộp [Smecta]', 'hai mươi viên [Cetirizine]', 'mười lăm viên [Omeprazole]',
];
const VOCAB = ['Paracetamol 500mg', 'Efferalgan 500mg (sủi)', 'Cetirizine 10mg', 'Omeprazole 20mg', 'Smecta 3g', 'Dextromethorphan siro 60ml', 'Natri clorid 0,9% nhỏ mắt 10ml', 'Strepsils hương bạc hà', 'Vitamin C 500mg', 'Omega 3 Fish Oil 1000mg', 'Kẽm Gluconat 10mg', 'Khẩu trang y tế 4 lớp', 'Bông gạc tiệt trùng 10x10', 'Nhiệt kế điện tử'];
fs.writeFileSync(path.join(STT, 'vocab.txt'), VOCAB.join('\n') + '\n');
fs.writeFileSync(path.join(STT, 'DOC-CHO-DUOC-SI.txt'), [
  'Ghi âm từng câu dưới đây (điện thoại hoặc máy tính, ở quầy như lúc bán hàng thật), mỗi câu một file.',
  'Đặt tên file theo số câu + tên viết tắt KHÔNG dấu của loại ghi âm, ví dụ: c01-quay.m4a, c01-yentinh.m4a.',
  'Rồi chép file câu đúng của câu đó (c01.txt) thành cùng tên với file ghi âm: c01-quay.txt. Đọc khác câu mẫu thì sửa lại file .txt cho đúng lời đã đọc.',
  'Không nói tên bệnh nhân hay thông tin cá nhân trong ghi âm.', '',
  ...SENT.map((s, i) => `c${String(i + 1).padStart(2, '0')}: ${s.replace(/[[\]]/g, '')}`)].join('\n') + '\n');
for (const [i, s] of SENT.entries()) fs.writeFileSync(path.join(STT, `c${String(i + 1).padStart(2, '0')}.txt`), s + '\n');

if (argv.includes('--tts')) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) console.log('--tts cần OPENAI_API_KEY trong .env – bỏ qua giọng máy.');
  else {
    let n = 0;
    for (const [i, s] of SENT.entries()) {
      const id = `c${String(i + 1).padStart(2, '0')}-giongmay`;
      const res = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice: 'alloy', input: s.replace(/[[\]]/g, ''), response_format: 'wav', instructions: 'Giọng tiếng Việt miền Bắc, tự nhiên, tốc độ vừa phải như dược sĩ đọc nhanh tại quầy.' }) });
      if (!res.ok) { console.log(`✗ ${id}: OpenAI TTS lỗi ${res.status} ${(await res.text()).slice(0, 160)}`); break; }
      fs.writeFileSync(path.join(STT, id + '.wav'), Buffer.from(await res.arrayBuffer()));
      fs.writeFileSync(path.join(STT, id + '.txt'), s + '\n');
      n++;
    }
    console.log(`Giọng nói: ${n} file giọng máy → eval/samples/stt/ (giọng máy dễ hơn giọng thật – cần thêm ghi âm của dược sĩ)`);
  }
} else console.log(`Giọng nói: đã ghi ${SENT.length} câu mẫu + DOC-CHO-DUOC-SI.txt. Thêm --tts để tạo giọng máy bằng OpenAI, hoặc nhờ dược sĩ ghi âm.`);
