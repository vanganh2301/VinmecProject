/* AI cục bộ: nhận giọng nói (STT), OCR hóa đơn, đọc XML hóa đơn điện tử.
   Nguyên tắc bảo mật: mặc định KHÔNG gửi âm thanh / ảnh ra ngoài. Mọi lời gọi mạng
   chỉ tới máy chủ trong mạng nội bộ (localhost, 10.x, 192.168.x, 172.16–31.x, *.local),
   trừ khi Quản lý bật "cho phép máy chủ ngoài" trong Cài đặt. */
'use strict';
(function (VM) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const cfg = () => VM.store.state.settings.ai;

  const MODES = {
    off: { label: 'Tắt', short: '' },
    local: { label: 'Trên thiết bị (Chrome/Edge – không gửi âm thanh đi)', short: 'MÁY' },
    server: { label: 'Máy chủ nội bộ (Whisper / PhoWhisper tự cài)', short: 'LAN' },
    app: { label: 'AI của app (OpenAI / Gemini / Qwen) – GỬI âm thanh ra ngoài', short: 'AI' },
    cloud: { label: 'Dịch vụ đám mây của trình duyệt – GỬI âm thanh ra ngoài', short: 'CLOUD' },
  };
  const OCR_MODES = {
    lan: { label: 'Máy chủ OCR nội bộ (Ollama / vLLM)' },
    app: { label: 'AI của app (OpenAI / Gemini / Qwen) – GỬI ảnh hóa đơn ra ngoài' },
  };
  // Endpoint của chính app (Vercel Functions trong api/), cùng tên miền với trang → không qua guard()
  const API = { stt: 'api/stt', ocr: 'api/ocr', health: 'api/health' };
  const errOf = async res => { try { return (await res.json()).error || ''; } catch { return ''; } };
  const appHint = () => VM.isHosted() ? '' : ' (AI của app chỉ chạy trên bản Vercel hoặc khi mở bằng npm run dev; serve.py không có máy chủ AI)';
  const PROVIDERS = { auto: 'Tự động (theo máy chủ)', openai: 'OpenAI', gemini: 'Google Gemini', qwen: 'Qwen (Alibaba Cloud)', local: 'Qwen tự cài (Ollama / vLLM)' };
  // Nhà cung cấp + mô hình vừa dùng cho lần OCR / giọng nói gần nhất → ghi độ chính xác thực tế theo từng nhà cung cấp
  const last = { ocr: '', voice: '' };
  const tagOf = j => j && j.provider ? `${j.provider}/${j.model || ''}` : '';

  function guard(url, what) {
    if (!url) throw new Error(`Chưa cấu hình địa chỉ máy chủ ${what}. Vào Khác → Cài đặt → AI cục bộ.`);
    if (!VM.isLocalUrl(url) && !cfg().allowPublic) throw new Error(`Đã chặn: ${url} không thuộc mạng nội bộ. Dữ liệu hóa đơn / giọng nói không được gửi ra Internet.`);
  }
  async function fetchT(url, init, ms) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
    try { return await fetch(url, Object.assign({ signal: ac.signal }, init)); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'Máy chủ không phản hồi (quá thời gian chờ).' : `Không kết nối được ${url} – máy chủ đã bật chưa? (${e.message})`); }
    finally { clearTimeout(t); }
  }

  // ---------- Speech to text ----------
  /** h = { onState(s: listening|installing|processing|idle), onPartial(text), onFinal(text), onError(msg) } → Promise<{ stop() }> */
  async function listen(h) {
    const mode = cfg().stt;
    if (mode === 'off') throw new Error('Nhập bằng giọng nói đang tắt (Cài đặt → AI cục bộ).');
    if (mode === 'server') return listenServer(h, false);
    if (mode === 'app') return listenServer(h, true);
    return listenBrowser(mode === 'local', h);
  }
  async function listenBrowser(local, h) {
    if (!SR) throw new Error('Trình duyệt chưa hỗ trợ nhận giọng nói. Dùng Chrome/Edge bản mới hoặc máy chủ nội bộ.');
    if (local) {
      if (typeof SR.available !== 'function') throw new Error('Trình duyệt này chưa có nhận giọng nói trên thiết bị. Cập nhật Chrome/Edge, hoặc chọn "Máy chủ nội bộ" trong Cài đặt → AI cục bộ.');
      const opt = { langs: ['vi-VN'], processLocally: true };
      let st = await SR.available(opt);
      if (st === 'downloadable' || st === 'downloading') {
        h.onState('installing'); // tải gói ngôn ngữ (mô hình) về máy – không gửi dữ liệu người dùng
        st = (await SR.install(opt)) ? 'available' : 'unavailable';
      }
      if (st !== 'available') throw new Error('Máy này chưa có gói nhận giọng nói tiếng Việt chạy trên thiết bị. Chọn "Máy chủ nội bộ" trong Cài đặt → AI cục bộ.');
    }
    const rec = new SR();
    rec.lang = 'vi-VN'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    if (local) rec.processLocally = true;
    let final = '';
    rec.onstart = () => h.onState('listening');
    rec.onresult = e => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) { t += e.results[i][0].transcript; }
      if (e.results[e.results.length - 1].isFinal) final = t; else h.onPartial(t);
    };
    rec.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') h.onError('Không nhận được giọng nói: ' + e.error); };
    rec.onend = () => { h.onState('idle'); if (final.trim()) h.onFinal(final.trim()); };
    rec.start();
    return { stop: () => { try { rec.stop(); } catch (_) { } } };
  }
  // Tên thuốc hay bán, gửi kèm làm gợi ý từ vựng để mô hình viết đúng tên biệt dược
  function vocab() {
    const f = VM.store.productFreq ? VM.store.productFreq() : {};
    return 'Nhà thuốc bệnh viện. Tên thuốc: ' + VM.store.state.products.filter(p => p.active !== false)
      .sort((a, b) => (f[b.id] || 0) - (f[a.id] || 0)).map(p => p.name).join(', ').slice(0, 700);
  }
  async function listenServer(h, app) {
    const url = app ? API.stt : cfg().sttUrl;
    if (!app) guard(url, 'nhận giọng nói');
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Trình duyệt này không cho ghi âm. Mở app bằng Chrome (Android) hoặc Safari (iPhone), qua địa chỉ https.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { throw new Error(e.name === 'NotAllowedError' ? 'Chưa cho phép dùng micro. Bấm biểu tượng ổ khóa cạnh địa chỉ trang → cho phép Micro, rồi thử lại.' : 'Không mở được micro: ' + e.message); }
    const mr = new MediaRecorder(stream), chunks = [];
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    const auto = setTimeout(() => mr.state === 'recording' && mr.stop(), 10000);
    mr.onstop = async () => {
      clearTimeout(auto); stream.getTracks().forEach(t => t.stop());
      h.onState('processing');
      try {
        const wav = await toWav16k(new Blob(chunks, { type: mr.mimeType }));
        const fd = new FormData();
        fd.append('file', wav, 'speech.wav');
        if (app) { fd.append('prompt', vocab()); fd.append('provider', cfg().sttProvider || 'auto'); }
        else {
          fd.append('language', 'vi'); fd.append('response_format', 'json'); fd.append('temperature', '0');
          if (cfg().sttModel) fd.append('model', cfg().sttModel);
        }
        const res = await fetchT(url, { method: 'POST', body: fd }, 60000);
        if (res.status === 401 && app && VM.auth) VM.auth.expired(); // phiên đăng nhập hết hạn → về màn đăng nhập
        if (!res.ok) throw new Error((await errOf(res)) || `Máy chủ trả lỗi ${res.status}${app ? appHint() : ''}`);
        const j = await res.json();
        last.voice = app ? tagOf(j) : 'lan';
        const text = String(j.text || (j.segments || []).map(s => s.text).join(' ') || '').trim();
        h.onState('idle');
        if (text) h.onFinal(text); else h.onError('Không nghe rõ – hãy nói lại gần micro hơn.');
      } catch (e) { h.onState('idle'); h.onError(e.message); }
    };
    mr.start();
    h.onState('listening');
    return { stop: () => mr.state === 'recording' && mr.stop() };
  }
  // Whisper cần WAV 16 kHz mono: giải mã bản ghi của trình duyệt rồi lấy mẫu lại
  async function toWav16k(blob) {
    const buf = await blob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = await ctx.decodeAudioData(buf);
    ctx.close();
    const off = new OfflineAudioContext(1, Math.ceil(src.duration * 16000), 16000);
    const node = off.createBufferSource(); node.buffer = src; node.connect(off.destination); node.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, pcm.length * 2, true);
    pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
    return new Blob([out], { type: 'audio/wav' });
  }

  // ---------- OCR hóa đơn qua mô hình thị giác chạy nội bộ (API kiểu OpenAI: Ollama / vLLM / llama.cpp) ----------
  const PROMPT = `Bạn là công cụ đọc hóa đơn giá trị gia tăng (GTGT) Việt Nam cho khoa dược bệnh viện.
Chỉ trả về MỘT đối tượng JSON hợp lệ, không giải thích, theo đúng mẫu:
{"supplier":"","supplierTaxCode":"","invoiceSymbol":"","invoiceNo":"","invoiceDate":"YYYY-MM-DD","lookupCode":"","poNo":"",
"lines":[{"code":"","name":"","unit":"","lot":"","expiry":"YYYY-MM-DD","qty":0,"price":0,"discount":0,"taxRate":0,"amount":0}],
"subtotal":0,"tax":0,"total":0}
Quy tắc:
- Chép đúng ký tự nhìn thấy trên ảnh. KHÔNG đoán, KHÔNG bịa. Ô không đọc được thì để "" (chữ) hoặc null (số).
- supplier là ĐƠN VỊ BÁN HÀNG (không phải người mua). invoiceNo là "Số" hóa đơn, giữ nguyên số 0 ở đầu.
- Số tiền / số lượng là số thuần (bỏ dấu chấm, dấu phẩy phân cách hàng nghìn). taxRate là phần trăm: 0, 5, 8 hoặc 10.
- Mỗi dòng hàng là một phần tử trong "lines", giữ đúng thứ tự trên hóa đơn. Số lô / hạn dùng thường nằm trong tên hàng hoặc cột riêng.`;

  async function imageToDataUrl(file, max = 2000, q = 0.9) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Không đọc được ảnh')); i.src = url; });
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    } finally { URL.revokeObjectURL(url); }
  }
  async function ocrInvoice(file) {
    if (cfg().ocr === 'app') return ocrApp(file);
    const { ocrUrl, ocrModel } = cfg();
    guard(ocrUrl, 'OCR');
    const image = await imageToDataUrl(file);
    const res = await fetchT(ocrUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ocrModel, temperature: 0, stream: false, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: [{ type: 'text', text: 'Đọc hóa đơn trong ảnh, trả về JSON theo đúng mẫu.' }, { type: 'image_url', image_url: { url: image } }] }] }),
    }, 180000);
    if (!res.ok) throw new Error(`Máy chủ OCR trả lỗi ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const j = await res.json();
    last.ocr = 'lan/' + (ocrModel || '');
    return { data: parseOcr(((j.choices || [])[0] || {}).message?.content || j.message?.content || ''), image };
  }
  // AI của app: ảnh → /api/ocr (Vercel / npm run dev) → OpenAI / Gemini / Qwen theo cài đặt. Prompt nằm ở máy chủ (api/_prompt.js).
  async function ocrApp(file) {
    let image = await imageToDataUrl(file, 2000, 0.85);
    if (image.length > 3800000) image = await imageToDataUrl(file, 1600, 0.75); // Vercel nhận tối đa 4,5 MB
    const res = await fetchT(API.ocr, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, provider: cfg().ocrProvider || 'auto' }) }, 130000);
    if (res.status === 401 && VM.auth) VM.auth.expired();
    if (!res.ok) throw new Error((await errOf(res)) || `Máy chủ OCR trả lỗi ${res.status}${appHint()}`);
    const j = await res.json();
    last.ocr = tagOf(j);
    return { data: parseOcr(j.text || ''), image, provider: j.provider, model: j.model, ms: j.ms };
  }
  function parseOcr(txt) {
    const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('Mô hình không trả về JSON – thử chụp lại rõ hơn hoặc nhập tay.');
    let o;
    try { o = JSON.parse(txt.slice(a, b + 1)); } catch { throw new Error('JSON từ mô hình bị lỗi – thử lại hoặc nhập tay.'); }
    return clean(o);
  }
  const rate = v => { const n = VM.parseNum(String(v ?? '').replace('%', '')); return [0, 5, 8, 10].includes(n) ? n : 0; };
  const nOrNull = v => (v === null || v === undefined || v === '') ? null : VM.parseNum(v);
  function clean(o) {
    const str = v => String(v ?? '').trim();
    return {
      supplier: str(o.supplier), sellerTax: str(o.supplierTaxCode).replace(/\s+/g, ''), invoiceSymbol: str(o.invoiceSymbol).toUpperCase(), invoiceNo: str(o.invoiceNo), invoiceDate: VM.parseDate(o.invoiceDate) || '', refNo: str(o.lookupCode), poNo: str(o.poNo),
      lines: (Array.isArray(o.lines) ? o.lines : []).filter(l => l && (l.name || l.code)).map(l => ({
        id: VM.uid('ln_'), code: str(l.code), name: str(l.name), country: '', lot: str(l.lot), expiry: VM.parseDate(l.expiry) || '', unit: str(l.unit),
        qty: nOrNull(l.qty) || 0, price: nOrNull(l.price) || 0, discount: nOrNull(l.discount) || 0, taxRate: rate(l.taxRate),
      })),
      printedSubtotal: nOrNull(o.subtotal), printedTax: nOrNull(o.tax), printedTotal: nOrNull(o.total),
    };
  }

  // ---------- XML hóa đơn điện tử (TT78/2021, QĐ 1450/QĐ-TCT) – dữ liệu gốc, chính xác tuyệt đối ----------
  function parseXmlInvoice(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('File không phải XML hợp lệ.');
    const all = (el, tag) => Array.from(el.getElementsByTagNameNS('*', tag));
    const one = (el, tag) => all(el, tag)[0];
    const txt = (el, tag) => { const x = el && one(el, tag); return x ? x.textContent.trim() : ''; };
    const root = one(doc, 'DLHDon');
    if (!root) throw new Error('Không nhận ra định dạng XML hóa đơn điện tử (cần mẫu theo TT78 – thẻ DLHDon).');
    const ttc = one(root, 'TTChung'), nban = one(root, 'NBan'), tt = one(root, 'TToan');
    const extra = el => { const m = {}; all(el, 'TTin').forEach(t => { m[VM.normalize(txt(t, 'TTruong'))] = txt(t, 'DLieu'); }); return m; };
    // TChat: 1 hàng hóa, 2 khuyến mại (vẫn nhận hàng), 3 chiết khấu thương mại, 4 dòng ghi chú
    const lines = all(root, 'HHDVu').filter(h => !['3', '4'].includes(txt(h, 'TChat'))).map(h => {
      const name = txt(h, 'THHDVu'), ex = extra(h);
      const pick = (...keys) => { for (const k of keys) { const v = Object.entries(ex).find(([kk]) => kk.includes(k)); if (v && v[1]) return v[1]; } return ''; };
      const lotM = name.match(/(?:số\s*lô|so\s*lo|lô|lot)\s*[:.]?\s*([A-Za-z0-9\-\/]+)/i);
      const expM = name.match(/(?:hsd|hạn\s*dùng|han\s*dung|hạn\s*sử\s*dụng|exp)\s*[:.]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}[\/\-.]\d{4}|\d{4}-\d{2}-\d{2})/i);
      let exp = pick('handung', 'hsd', 'hansudung', 'expiry', 'exp') || (expM ? expM[1] : '');
      exp = VM.parseDate(exp.replace(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/, '$1/$2/20$3'));
      return {
        id: VM.uid('ln_'), code: txt(h, 'MHHDVu'), name, country: pick('nuocsx', 'xuatxu', 'country'), lot: pick('solo', 'lot') || (lotM ? lotM[1] : ''), expiry: exp,
        unit: txt(h, 'DVTinh'), qty: VM.parseNum(txt(h, 'SLuong')), price: VM.parseNum(txt(h, 'DGia')), discount: VM.parseNum(txt(h, 'TLCKhau')), taxRate: rate(txt(h, 'TSuat')),
      };
    });
    return {
      supplier: txt(nban, 'Ten'), sellerTax: txt(nban, 'MST'), invoiceNo: txt(ttc, 'SHDon'), invoiceDate: VM.parseDate(txt(ttc, 'NLap')) || '', refNo: txt(doc, 'MCCQT') || txt(ttc, 'MTCuu') || '',
      invoiceSymbol: txt(ttc, 'KHMSHDon') + txt(ttc, 'KHHDon'), poNo: '', lines,
      printedSubtotal: nOrNull(txt(tt, 'TgTCThue')), printedTax: nOrNull(txt(tt, 'TgTThue')), printedTotal: nOrNull(txt(tt, 'TgTTTBSo')),
    };
  }

  // ---------- Mã QR / mã vạch in trên hóa đơn (bước 1 khi ghi hóa đơn) ----------
  // Mỗi nhà cung cấp HĐĐT in QR một kiểu: chuỗi phân cách bởi | ; tab (MST · ký hiệu · số HĐ · ngày · tổng tiền),
  // đường dẫn tra cứu có tham số, hoặc chỉ một mã. Nhận diện mềm dẻo, không đoán bừa: trả về các trường chắc chắn đọc được.
  function parseInvoiceCode(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const out = { raw: s, invoiceNo: '', invoiceSymbol: '', sellerTax: '', invoiceDate: '', total: null, refNo: '', url: '' };
    const isDate = p => { if (/^\d{8}$/.test(p)) { const y = +p.slice(0, 4), m = +p.slice(4, 6), d = +p.slice(6); return y >= 2000 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6)}` : ''; } return /[\/\-.]/.test(p) ? VM.parseDate(p.replace(/[T ].*$/, '')) : ''; };
    let parts = [];
    if (/^https?:\/\//i.test(s)) {
      out.url = s;
      try {
        new URL(s).searchParams.forEach((v, k) => {
          const kk = VM.normalize(k);
          if (/^(shdon|sohd|sohoadon|invoiceno|invoicenumber|invno|no|so)$/.test(kk)) out.invoiceNo = v.trim();
          else if (/(mst|taxcode|^tin$|masothue)/.test(kk)) out.sellerTax = v.trim();
          else if (/(khhdon|khmshdon|kyhieu|serial|symbol|pattern)/.test(kk)) out.invoiceSymbol += v.trim();
          else if (/(matracuu|mtcuu|mccqt|lookup|searchkey|secret|fkey|code|key|^ma$)/.test(kk)) out.refNo = v.trim();
        });
      } catch (_) { }
    } else parts = s.split(/[|;\t]+/).map(x => x.trim()).filter(Boolean);
    if (parts.length === 1) {
      const p = parts[0].replace(/\s+/g, '');
      if (/^\d{1,8}$/.test(p)) out.invoiceNo = p;        // TT78: số hóa đơn tối đa 8 chữ số
      else if (/^[A-Z0-9\-]{6,40}$/i.test(p)) out.refNo = p; // mã tra cứu / mã của CQT
    } else parts.forEach(p => {
      let d;
      if (!out.sellerTax && /^\d{10}(-\d{3})?$/.test(p)) out.sellerTax = p;
      else if (!out.invoiceSymbol && /^\d?[CK]\d{2}[A-Z]{2,4}$/i.test(p)) out.invoiceSymbol = p.toUpperCase(); // VD 1C24TAA
      else if (!out.invoiceDate && (d = isDate(p))) out.invoiceDate = d;
      else if (!out.invoiceNo && /^\d{1,8}$/.test(p)) out.invoiceNo = p;
      else if (out.total == null && /^\d{4,}([.,]\d+)?$/.test(p)) out.total = VM.parseNum(p);
      else if (!out.refNo && /^[A-Z0-9]{20,40}$/i.test(p)) out.refNo = p;
    });
    return out.invoiceNo || out.refNo || out.sellerTax || out.url ? out : null;
  }

  // ---------- Đo độ chính xác thực tế tại khoa ----------
  // Ghi cả tổng lẫn theo từng nhà cung cấp/mô hình (aiStats.by['ocr:openai/gpt-4.1-mini'] …) để so sánh khi dùng thật
  function track(kind, a, b) {
    const s = VM.store.state.aiStats;
    const tag = last[kind] || (kind === 'voice' ? (cfg().stt || '') : 'lan');
    const by = s.by || (s.by = {});
    const k = `${kind}:${tag}`;
    if (kind === 'voice') { s.voice.n++; if (a) s.voice.top1++; const x = by[k] || (by[k] = { n: 0, top1: 0 }); x.n++; if (a) x.top1++; }
    if (kind === 'ocr') { s.ocr.docs++; s.ocr.fields += a; s.ocr.kept += b; const x = by[k] || (by[k] = { docs: 0, fields: 0, kept: 0 }); x.docs++; x.fields += a; x.kept += b; }
  }
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + '%' : '—';

  async function ping(url) {
    guard(url, '');
    const res = await fetchT(new URL(url).origin + '/', { method: 'GET' }, 5000);
    return res.status;
  }
  /** Máy chủ của app (Vercel) đã sẵn sàng AI chưa → { ok, openai, ocrModel, sttModel } */
  async function health() {
    const res = await fetchT(API.health, { cache: 'no-store' }, 8000);
    if (!res.ok) throw new Error(`Không thấy máy chủ AI của app (lỗi ${res.status})${appHint()}`);
    return res.json();
  }
  const usesApp = () => cfg().stt === 'app' || cfg().ocr === 'app';

  VM.ai = { MODES, OCR_MODES, PROVIDERS, health, usesApp, listen, ocrInvoice, parseXmlInvoice, parseInvoiceCode, track, pct, ping, sttSupported: () => !!SR || !!(navigator.mediaDevices && window.MediaRecorder) };
})(window.VM);
