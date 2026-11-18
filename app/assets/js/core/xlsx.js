/* Minimal XLSX writer/reader (no external library, works offline) */
'use strict';
(function (VM) {
  const utf8 = new TextEncoder();
  const xmlEsc = v => VM.esc(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const colName = c => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = data => { let c = 0xffffffff; for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  function zipStored(files, type) {
    const chunks = [], central = [];
    let offset = 0, size = 0, count = 0;
    for (const [path, content] of Object.entries(files)) {
      const name = utf8.encode(path), data = typeof content === 'string' ? utf8.encode(content) : content;
      const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 33, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true);
      new Uint8Array(c.buffer, 6, 26).set(new Uint8Array(h.buffer, 4, 26));
      c.setUint32(42, offset, true);
      chunks.push(h.buffer, name, data); central.push(c.buffer, name);
      offset += 30 + name.length + data.length; size += 46 + name.length; count++;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, count, true); end.setUint16(10, count, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end.buffer], { type });
  }

  /** sheets: { 'Tên sheet': [[header...], [row...], ...] } – first row is styled as header */
  function workbook(sheets) {
    const names = Object.keys(sheets);
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const files = {};
    files['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>';
    const rels = entries => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + entries.map(([t, ty], i) => `<Relationship Id="rId${i + 1}" Target="${t}" Type="${office}/${ty}"/>`).join('') + '</Relationships>';
    files['_rels/.rels'] = rels([['xl/workbook.xml', 'officeDocument']]);
    files['xl/_rels/workbook.xml.rels'] = rels([...names.map((_, i) => [`worksheets/sheet${i + 1}.xml`, 'worksheet']), ['styles.xml', 'styles']]);
    files['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}" xmlns:r="${office}"><sheets>` + names.map((n, i) => `<sheet name="${xmlEsc(n.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>';
    files['xl/styles.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B7A75"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="3" applyNumberFormat="1"/></cellXfs></styleSheet>`;
    names.forEach((name, i) => {
      const rows = sheets[name];
      const widths = (rows[0] || []).map((_, c) => Math.min(48, Math.max(8, ...rows.slice(0, 200).map(r => String(r[c] ?? '').length + 2))));
      const cols = widths.length ? '<cols>' + widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '';
      const data = rows.map((row, r) => `<row r="${r + 1}">` + row.map((v, c) => {
        const ref = colName(c) + (r + 1);
        const s = r === 0 ? ' s="1"' : '';
        if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${r === 0 ? s : (Number.isInteger(v) && Math.abs(v) >= 1000 ? ' s="2"' : '')}><v>${v}</v></c>`;
        return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v ?? '')}</t></is></c>`;
      }).join('') + '</row>').join('');
      files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${data}</sheetData></worksheet>`;
    });
    return zipStored(files, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  const exportXlsx = (sheets, filename) => { VM.download(workbook(sheets), filename); if (VM.ui && VM.ui.done) VM.ui.done('Đã xuất file Excel', filename); };

  /** Returns rows (array of arrays) of the first sheet. */
  async function readXlsx(file) {
    const bytes = await file.arrayBuffer(), view = new DataView(bytes), dec = new TextDecoder();
    const u16 = i => view.getUint16(i, true), u32 = i => view.getUint32(i, true);
    let end = bytes.byteLength - 22;
    while (end >= Math.max(0, bytes.byteLength - 65557) && u32(end) !== 0x06054b50) end--;
    if (end < 0 || u32(end) !== 0x06054b50) throw Error('Tệp Excel không hợp lệ.');
    let pos = u32(end + 16);
    const dir = new Map();
    for (let n = 0; n < u16(end + 10); n++) {
      if (u32(pos) !== 0x02014b50) throw Error('Tệp Excel bị lỗi.');
      const name = dec.decode(new Uint8Array(bytes, pos + 46, u16(pos + 28)));
      dir.set(name, { offset: u32(pos + 42), size: u32(pos + 20), expanded: u32(pos + 24), method: u16(pos + 10) });
      pos += 46 + u16(pos + 28) + u16(pos + 30) + u16(pos + 32);
    }
    async function xml(name) {
      const e = dir.get(name);
      if (!e) return null;
      if (e.expanded > 30e6 || u32(e.offset) !== 0x04034b50) throw Error('Trang tính quá lớn hoặc bị lỗi.');
      const data = new Uint8Array(bytes, e.offset + 30 + u16(e.offset + 26) + u16(e.offset + 28), e.size);
      let plain = data;
      if (e.method === 8) {
        if (!window.DecompressionStream) throw Error('Trình duyệt chưa hỗ trợ đọc Excel nén. Hãy lưu dạng CSV.');
        plain = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      } else if (e.method !== 0) throw Error('Định dạng nén Excel chưa hỗ trợ.');
      const doc = new DOMParser().parseFromString(dec.decode(plain), 'application/xml');
      if (doc.querySelector('parsererror')) throw Error('Trang tính bị lỗi.');
      return doc;
    }
    const wb = await xml('xl/workbook.xml'), rels = await xml('xl/_rels/workbook.xml.rels');
    const sheet = wb?.getElementsByTagNameNS('*', 'sheet')[0];
    const key = sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = Array.from(rels?.getElementsByTagNameNS('*', 'Relationship') || []).find(r => r.getAttribute('Id') === key)?.getAttribute('Target');
    const doc = target && await xml(target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, ''));
    if (!doc) throw Error('Không tìm thấy trang tính đầu tiên.');
    const ss = await xml('xl/sharedStrings.xml');
    const shared = Array.from(ss?.getElementsByTagNameNS('*', 'si') || [], c => c.textContent);
    return Array.from(doc.getElementsByTagNameNS('*', 'row'), r => {
      const row = [];
      for (const c of r.getElementsByTagNameNS('*', 'c')) {
        let col = 0;
        for (const ch of (c.getAttribute('r') || 'A').match(/^[A-Z]+/)[0]) col = col * 26 + ch.charCodeAt(0) - 64;
        const v = c.getElementsByTagNameNS('*', 'v')[0]?.textContent || '';
        const t = c.getAttribute('t');
        row[col - 1] = t === 's' ? shared[Number(v)] || '' : t === 'inlineStr' ? c.getElementsByTagNameNS('*', 'is')[0]?.textContent || '' : (t === 'str' || t === 'b' || v === '' || isNaN(v)) ? v : Number(v);
      }
      for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      return row;
    }).filter(row => row.some(v => v !== ''));
  }

  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
  }

  async function readTable(file) {
    if (/\.csv$/i.test(file.name)) return parseCSV((await file.text()).replace(/^﻿/, ''));
    return readXlsx(file);
  }

  VM.xlsx = { workbook, exportXlsx, readXlsx, readTable, parseCSV };
})(window.VM);
