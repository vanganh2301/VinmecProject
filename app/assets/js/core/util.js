/* Utilities: DOM, format, dates, fuzzy search */
'use strict';
window.VM = window.VM || {};
(function (VM) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const pad = (n, l = 2) => String(n).padStart(l, '0');

  const nf = new Intl.NumberFormat('vi-VN');
  const money = n => nf.format(Math.round(Number(n) || 0)) + ' đ';
  const num = n => nf.format(Number(n) || 0);

  // ---- Dates (stored as ISO strings; expiry stored as yyyy-mm-dd) ----
  const now = () => new Date();
  const iso = (d = new Date()) => new Date(d).toISOString();
  const ymd = (d = new Date()) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtDate = v => { if (!v) return ''; const d = new Date(v.length === 10 ? v + 'T00:00:00' : v); return isNaN(d) ? String(v) : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const fmtTime = v => { if (!v) return ''; const d = new Date(v); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDT = v => v ? `${fmtTime(v)} · ${fmtDate(v)}` : '';
  const daysUntil = v => { if (!v) return Infinity; const d = new Date(v.length === 10 ? v + 'T00:00:00' : v); const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 864e5); };
  const hoursSince = v => (Date.now() - new Date(v).getTime()) / 36e5;
  const ago = v => {
    if (!v) return 'chưa có';
    const m = Math.round((Date.now() - new Date(v).getTime()) / 6e4);
    if (m < 1) return 'vừa xong';
    if (m < 60) return m + ' phút trước';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' giờ trước';
    const d = Math.round(h / 24);
    return d + ' ngày trước';
  };
  // Parse dd/mm/yyyy, yyyy-mm-dd, Excel serial → yyyy-mm-dd
  const parseDate = v => {
    if (v == null || v === '') return '';
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return ymd(d); }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/); // mm/yyyy → last day of month
    if (m) { const d = new Date(+m[2], +m[1], 0); return ymd(d); }
    return '';
  };

  // ---- Text normalisation & fuzzy search ----
  const normalize = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
  const normWords = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  // 0..100 relevance. Exact/prefix/substring rank above typo matches.
  function fuzzyScore(query, text) {
    const q = normalize(query), t = normalize(text);
    if (!q) return 1;
    if (!t) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 97;
    if (t.includes(q)) return 92;
    // every query word appears somewhere
    const qw = normWords(query), tw = normWords(text);
    if (qw.length > 1 && qw.every(w => tw.some(x => x.startsWith(w)))) return 88;
    let best = 100 - editDistance(q, t) / Math.max(q.length, t.length) * 100;
    if (q.length >= 3) {
      for (let i = 0; i <= t.length - q.length; i++) best = Math.max(best, 85 - editDistance(q, t.slice(i, i + q.length)) / q.length * 100);
    }
    return best;
  }
  function search(list, query, fields, min = 55) {
    if (!query.trim()) return list.slice();
    return list.map(item => ({ item, s: Math.max(...fields.map(f => fuzzyScore(query, typeof f === 'function' ? f(item) : item[f]))) }))
      .filter(x => x.s >= min).sort((a, b) => b.s - a.s).map(x => x.item);
  }

  const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const initials = name => String(name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  /** Sao chép chữ vào clipboard. Có phương án dự phòng (execCommand) khi trang mở qua file:// hoặc trình duyệt chặn Clipboard API. */
  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (_) { }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { }
    ta.remove(); return ok;
  }
  /** Dòng/cột cho Excel: tab giữa các ô, xuống dòng giữa các hàng – dán vào Excel sẽ tự tách ô. */
  const tsv = rows => rows.map(r => r.map(v => String(v ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\r\n');
  /**
   * Copy bảng ô để dán vào Excel mà KHÔNG bị Excel tự đổi kiểu:
   * - chuỗi (số HĐ 0001234, mã SAP, mã kho) giữ nguyên dạng chữ, không mất số 0 ở đầu;
   * - ngày truyền dạng { text: 'dd/mm/yyyy', date: 'yyyy-mm-dd' } → Excel nhận là ngày thật, không phụ thuộc định dạng vùng của máy;
   * - số (number) giữ là số.
   * Ghi đồng thời text/plain (tab) và text/html (bảng có mso-number-format).
   */
  async function copyCells(rows) {
    const norm = c => (c && typeof c === 'object') ? c : typeof c === 'number' ? { text: String(c), num: true } : { text: String(c ?? '') };
    const rs = rows.map(r => r.map(norm));
    const plain = tsv(rs.map(r => r.map(c => c.text)));
    const td = c => c.num ? `<td>${esc(c.text)}</td>` : (c.date && c.text) ? `<td style='mso-number-format:"dd\\/mm\\/yyyy"'>${esc(c.date)}</td>` : `<td style='mso-number-format:"\\@"'>${esc(c.text)}</td>`;
    const html = `<table>${rs.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</table>`;
    copyCells.last = { plain, html };
    try {
      if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([plain], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
        return true;
      }
    } catch (_) { }
    let ok = false;
    const h = e => { e.clipboardData.setData('text/plain', plain); e.clipboardData.setData('text/html', html); e.preventDefault(); ok = true; };
    document.addEventListener('copy', h);
    try { document.execCommand('copy'); } catch (_) { }
    document.removeEventListener('copy', h);
    return ok || copyText(plain);
  }
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f ? f(x) : x) || 0), 0);
  const fileStamp = () => { const d = new Date(); return `${ymd(d)}_${pad(d.getHours())}${pad(d.getMinutes())}`; };
  const parseNum = v => { if (typeof v === 'number') return v; const s = String(v ?? '').replace(/\s|đ/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); const n = parseFloat(s); return isNaN(n) ? 0 : n; };

  // ---- Barcode: GS1 (DataMatrix trên hộp thuốc) & EAN ----
  // Nhận "(01)08930000000012(17)270131(10)AB12" hoặc chuỗi thô "0108930000000012172701311 0AB12<GS>21..."
  function gs1(raw) {
    const s = String(raw || '').trim().replace(/^\](d2|C1|Q3|e0)/, '');
    const out = {};
    if (/^\(\d{2,4}\)/.test(s)) {
      const re = /\((\d{2,4})\)([^(]*)/g; let m;
      while ((m = re.exec(s))) out[m[1]] = m[2].replace(/\x1d/g, '');
    } else if (/^01\d{14}/.test(s)) {
      const FIX = { '01': 14, '11': 6, '15': 6, '17': 6 }, VAR = ['10', '21', '240'];
      let i = 0;
      while (i < s.length) {
        const ai2 = s.substr(i, 2), ai3 = s.substr(i, 3);
        if (FIX[ai2]) { out[ai2] = s.substr(i + 2, FIX[ai2]); i += 2 + FIX[ai2]; continue; }
        const ai = VAR.includes(ai3) ? ai3 : VAR.includes(ai2) ? ai2 : null;
        if (!ai) break;
        const end = s.indexOf('\x1d', i + ai.length);
        out[ai] = end < 0 ? s.slice(i + ai.length) : s.slice(i + ai.length, end);
        i = end < 0 ? s.length : end + 1;
      }
    } else return null;
    if (!out['01']) return null;
    let expiry = '';
    const e = out['17'];
    if (e && /^\d{6}$/.test(e)) {
      const y = 2000 + +e.slice(0, 2), mo = +e.slice(2, 4), d = +e.slice(4, 6);
      expiry = d ? `${y}-${pad(mo)}-${pad(d)}` : ymd(new Date(y, mo, 0)); // DD=00 → cuối tháng
    }
    return { gtin: out['01'], lot: out['10'] || '', expiry, serial: out['21'] || '' };
  }
  const gtinKey = g => String(g || '').replace(/\D/g, '').replace(/^0+/, '');
  const gtinCheck = body => { const d = String(body).split('').reverse().map(Number); const s = d.reduce((a, x, i) => a + x * (i % 2 ? 1 : 3), 0); return String((10 - s % 10) % 10); };

  // ---- Bảo mật: chỉ cho gửi dữ liệu tới máy chủ trong mạng nội bộ ----
  function isLocalUrl(u) {
    let h;
    try { h = new URL(u).hostname.toLowerCase(); } catch { return false; }
    h = h.replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h === '::1' || /\.(local|lan|internal|intranet)$/.test(h) || !h.includes('.')) return true;
    const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return false;
    const [a, b] = [+m[1], +m[2]];
    return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }

  Object.assign(VM, { $, $$, esc, icon, pad, money, num, now, iso, ymd, fmtDate, fmtTime, fmtDT, daysUntil, hoursSince, ago, parseDate, normalize, fuzzyScore, search, uid, initials, debounce, download, sum, fileStamp, parseNum, gs1, gtinKey, gtinCheck, isLocalUrl, copyText, copyCells, tsv });
})(window.VM);
