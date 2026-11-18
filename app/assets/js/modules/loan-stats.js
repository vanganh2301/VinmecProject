/* Thống kê vay thuốc – thuốc vay thường xuyên theo ngày / tuần / tháng, gợi ý dự báo nhu cầu */
'use strict';
(function (VM) {
  const { $, $$, esc, icon, num } = VM;
  const S = () => VM.store.state;
  const LS = 'vmhub.loanStats';
  const GRAN = {
    day: { label: 'Ngày', unit: 'ngày', per: '/ngày', ns: [14, 30, 60, 90], n: 30 },
    week: { label: 'Tuần', unit: 'tuần', per: '/tuần', ns: [8, 12, 26, 52], n: 12 },
    month: { label: 'Tháng', unit: 'tháng', per: '/tháng', ns: [6, 12, 24], n: 12 },
  };
  const SORTERS = { times: (a, b) => b.times - a.times || b.total - a.total, total: (a, b) => b.total - a.total || b.times - a.times, fc: (a, b) => b.fc - a.fc || b.times - a.times, trend: (a, b) => b.trend - a.trend || b.times - a.times };
  const SORTS = { times: 'Vay nhiều lần nhất', total: 'Tổng số lượng lớn nhất', fc: 'Dự báo cao nhất', trend: 'Đang tăng nhanh nhất' };
  const DIRS = [['', 'Cả 2 chiều'], ['Y001', 'Nhà thuốc vay'], ['Y003', 'Kho nội trú vay']];
  const o = Object.assign({ g: 'week', n: 12, dir: '', sort: 'times', q: '', pick: '' }, (() => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (_) { return {}; } })());
  const keep = () => { try { localStorage.setItem(LS, JSON.stringify({ g: o.g, n: o.n, dir: o.dir, sort: o.sort })); } catch (_) { } };
  if (!GRAN[o.g]) o.g = 'week';
  if (!GRAN[o.g].ns.includes(o.n)) o.n = GRAN[o.g].n;

  // ---------- kỳ (bucket) ----------
  function startOf(g, d) { const x = new Date(d); x.setHours(0, 0, 0, 0); if (g === 'week') x.setDate(x.getDate() - (x.getDay() + 6) % 7); if (g === 'month') x.setDate(1); return x; }
  function addP(g, d, k) { const x = new Date(d); if (g === 'day') x.setDate(x.getDate() + k); else if (g === 'week') x.setDate(x.getDate() + 7 * k); else x.setMonth(x.getMonth() + k); return x; }
  const dm = d => `${VM.pad(d.getDate())}/${VM.pad(d.getMonth() + 1)}`;
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  function bucket(g, s) {
    const e = addP(g, s, 1), last = new Date(e.getTime() - 864e5);
    const short = g === 'day' ? dm(s) : g === 'week' ? dm(s) : `${s.getMonth() + 1}/${String(s.getFullYear()).slice(2)}`;
    const long = g === 'day' ? `${WD[s.getDay()]} ${VM.fmtDate(s)}` : g === 'week' ? `Tuần ${dm(s)} – ${dm(last)}/${last.getFullYear()}` : `Tháng ${s.getMonth() + 1}/${s.getFullYear()}`;
    return { s, e, last, short, long };
  }
  function buckets(g, n) {
    const cur = startOf(g, new Date()), out = [];
    for (let i = n - 1; i >= 0; i--) out.push(Object.assign(bucket(g, addP(g, cur, -i)), { cur: i === 0 }));
    return out;
  }

  // ---------- tính toán ----------
  const factorOf = (p, unit) => (p && (p.units.find(u => u.name === unit) || {}).factor) || 1;
  const bigUnit = p => p && p.units.length > 1 ? p.units.reduce((a, b) => (b.factor > a.factor ? b : a), p.units[0]) : null;
  function compute() {
    const B = buckets(o.g, o.n), t0 = B[0].s, t1 = B[B.length - 1].e;
    const per = B.map(() => ({ v: new Set(), n: 0 }));
    const drugs = new Map();
    S().loans.forEach(l => {
      if (l.cancelled || (o.dir && l.to !== o.dir)) return;
      const t = new Date(l.createdAt);
      if (!(t >= t0 && t < t1)) return;
      const i = B.findIndex(b => t >= b.s && t < b.e);
      if (i < 0) return;
      const p = l.productId ? VM.store.product(l.productId) : null;
      const key = p ? p.id : 'x:' + VM.normalize(l.name);
      let d = drugs.get(key);
      if (!d) drugs.set(key, d = { key, p, name: p ? p.name : l.name, code: p ? p.code : (l.itemCode || ''), sap: p ? p.sap : (l.sap || ''), unit: p ? VM.store.baseUnit(p).name : (l.unit || ''), big: bigUnit(p), cat: p ? p.category : '', b: B.map(() => 0), v: new Set(), last: '', to: {} });
      const g = VM.store.loanGroup(l);
      d.b[i] += (Number(l.qty) || 0) * (p ? factorOf(p, l.unit) : 1);
      d.v.add(g); d.to[l.to] = (d.to[l.to] || 0) + 1;
      if (l.createdAt > d.last) d.last = l.createdAt;
      per[i].v.add(g); per[i].n++;
    });
    const done = B.length - 1; // kỳ hiện tại chưa kết thúc → không tính vào dự báo
    const k = Math.max(1, Math.round(done / 3));
    const regularMin = Math.max(2, Math.ceil(B.length / 3));
    const list = [...drugs.values()].map(d => {
      const full = d.b.slice(0, done), recent = full.slice(-k);
      d.total = VM.sum(d.b); d.times = d.v.size; d.active = d.b.filter(x => x > 0).length;
      d.avg = full.length ? VM.sum(full) / full.length : 0;
      d.ravg = recent.length ? VM.sum(recent) / recent.length : 0;
      // Dự báo kỳ tới: 60% trung bình 1/3 số kỳ gần nhất + 40% trung bình cả khoảng (làm tròn lên)
      d.fc = Math.ceil(0.6 * d.ravg + 0.4 * d.avg - 1e-9);
      d.trend = d.avg > 0 ? (d.ravg - d.avg) / d.avg : (d.ravg > 0 ? 1 : 0);
      d.regular = d.active >= regularMin;
      d.stock = d.p ? Number(d.p.stock) || 0 : null;
      d.cover = d.fc > 0 && d.stock != null ? d.stock / d.fc : null;
      return d;
    });
    list.sort(SORTERS.times);
    return { B, per, list, done, k, regularMin, vouchers: new Set(per.flatMap(x => [...x.v])).size, lines: VM.sum(per, x => x.n) };
  }

  // ---------- render ----------
  let R = null;
  function render(view, top, arg) {
    if (GRAN[arg]) { o.g = arg; if (!GRAN[o.g].ns.includes(o.n)) o.n = GRAN[o.g].n; keep(); }
    top.innerHTML = `<button class="btn" id="sBack">${icon('chevl')}<span class="label">Về sổ vay</span></button>
      <button class="btn primary" id="sXls">${icon('download')}<span class="label">Xuất Excel</span></button>`;
    view.innerHTML = `<div class="card st-filter">
        <div class="toolbar">
          <div class="seg" id="sG" role="group" aria-label="Thống kê theo">${Object.entries(GRAN).map(([k, g]) => `<button data-g="${k}">Theo ${g.label.toLowerCase()}</button>`).join('')}</div>
          <label class="st-n"><span class="muted small">Khoảng</span><select class="select" id="sN" aria-label="Số kỳ"></select></label>
          <div class="seg" id="sDir" role="group" aria-label="Chiều vay">${DIRS.map(([k, l]) => `<button data-d="${k}" title="${k ? `Kho nhận: ${k}` : ''}">${l}</button>`).join('')}</div>
        </div>
      </div>
      <div class="kpis compact" id="sKpis"></div>
      <div class="card">
        <div class="card-h st-ch"><div><h3 id="sChartT">–</h3><div class="muted small" id="sChartS"></div></div><div id="sPick"></div></div>
        <div class="chart-wrap" id="sChart"></div>
      </div>
      <div class="card">
        <div class="toolbar">
          <div class="input-icon grow">${icon('search')}<input class="input" id="sQ" type="search" placeholder="Tìm thuốc, mã hàng, mã SAP…" value="${esc(o.q)}"></div>
          <select class="select" id="sSort" aria-label="Sắp xếp">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}" ${o.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <div class="table-wrap" id="sTable"></div>
        <div class="st-note muted small" id="sNote"></div>
      </div>`;
    $('#sBack').onclick = () => VM.ui.go('loans');
    $('#sXls').onclick = exportXls;
    $$('#sG [data-g]').forEach(b => b.onclick = () => { if (b.dataset.g === o.g) return; o.g = b.dataset.g; o.n = GRAN[o.g].n; keep(); VM.ui.go('loanstats/' + o.g); });
    $('#sN').onchange = e => { o.n = +e.target.value; keep(); draw(); };
    $$('#sDir [data-d]').forEach(b => b.onclick = () => { o.dir = b.dataset.d; keep(); draw(); });
    $('#sSort').onchange = e => { o.sort = e.target.value; keep(); drawTable(); };
    $('#sQ').oninput = VM.debounce(() => { o.q = $('#sQ').value; drawTable(); }, 150);
    draw();
  }

  function draw() {
    R = compute();
    const G = GRAN[o.g];
    if (o.pick && !R.list.some(d => d.key === o.pick)) o.pick = '';
    $$('#sG [data-g]').forEach(b => b.classList.toggle('active', b.dataset.g === o.g));
    $$('#sDir [data-d]').forEach(b => b.classList.toggle('active', b.dataset.d === o.dir));
    $('#sN').innerHTML = G.ns.map(n => `<option value="${n}" ${n === o.n ? 'selected' : ''}>${n} ${G.unit} gần nhất</option>`).join('');
    const top = R.list[0];
    const reg = R.list.filter(d => d.regular).length;
    $('#sKpis').innerHTML = [
      ['', 'sheet', 'Mã vay trong khoảng', num(R.vouchers), `TB ${fmt1(avgOf(R.per.slice(0, R.done).map(x => x.v.size)))} mã vay${G.per}`],
      ['info', 'pill', 'Loại thuốc được vay', num(R.list.length), `${num(R.lines)} lượt thuốc`],
      ['warn', 'history', 'Vay thường xuyên', num(reg), `có vay ≥ ${R.regularMin}/${R.B.length} ${G.unit}`],
      ['', 'trend', 'Vay nhiều nhất', top ? esc(top.name) : '—', top ? `${top.times} lần · ${num(top.total)} ${esc(top.unit)}` : ''],
    ].map(([cls, ic, label, val, sub]) => `<div class="card kpi"><div class="kpi-ic ${cls}">${icon(ic)}</div><div style="min-width:0"><span>${label}</span><strong class="${ic === 'trend' ? 'st-kname' : ''}" title="${ic === 'trend' && top ? esc(top.name) : ''}">${val}</strong><small>${sub}</small></div></div>`).join('');
    drawChart(); drawTable();
    $('#sNote').innerHTML = `${icon('info', 's')} <span>Số lượng quy về <b>ĐVT nhỏ nhất</b>, không tính thuốc / mã vay đã hủy. <b>Dự báo ${G.per}</b> = 60% trung bình ${R.k} ${G.unit} gần nhất + 40% trung bình ${R.done} ${G.unit} đã qua, làm tròn lên. ${G.label} hiện tại chưa kết thúc nên chỉ hiển thị, không đưa vào dự báo. Đây là số gợi ý để dự trù – dược sĩ cân nhắc thêm mùa bệnh, hàng sắp về.</span>`;
  }

  const fmt1 = v => (Math.round(v * 10) / 10).toLocaleString('vi-VN');

  function drawChart() {
    const G = GRAN[o.g], d = o.pick ? R.list.find(x => x.key === o.pick) : null;
    const vals = d ? d.b.slice() : R.per.map(x => x.v.size);
    const fc = d ? d.fc : Math.ceil(0.6 * avgOf(vals.slice(0, R.done).slice(-R.k)) + 0.4 * avgOf(vals.slice(0, R.done)) - 1e-9);
    const avg = avgOf(vals.slice(0, R.done));
    const unit = d ? d.unit : 'mã vay';
    $('#sChartT').textContent = d ? `${d.name} – số lượng vay theo ${G.label.toLowerCase()}` : `Số mã vay theo ${G.label.toLowerCase()}`;
    $('#sChartS').textContent = d ? `Đơn vị: ${d.unit} (ĐVT nhỏ nhất). Bấm lại dòng thuốc để xem tổng.` : 'Bấm một thuốc trong bảng bên dưới để xem riêng thuốc đó.';
    $('#sPick').innerHTML = d ? `<button class="btn sm" id="sUnpick">${icon('x', 's')} Xem tổng</button>` : '';
    if ($('#sUnpick')) $('#sUnpick').onclick = () => { o.pick = ''; drawChart(); drawTable(); };

    const all = [...vals, fc];
    const n = all.length, max = Math.max(d ? 4 : 3, ...all);
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    const step = nice.find(s => max / s <= 5) || Math.ceil(max / 5);
    const yMax = Math.ceil(max / step) * step;
    const W = 760, Hh = 250, L = 46, Rr = 58, T = 16, Bm = 30, cw = (W - L - Rr) / n, bw = Math.max(4, Math.min(30, cw * .62));
    const y = v => T + (Hh - T - Bm) * (1 - v / yMax);
    const lab = Math.ceil(n / 12);
    let g = '';
    for (let v = 0; v <= yMax; v += step) g += `<line class="grid-l" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`;
    const fx = L + (n - 1) * cw;
    g += `<rect class="st-fcband" x="${fx}" y="${T}" width="${cw}" height="${Hh - T - Bm}" rx="6"/>`;
    all.forEach((c, i) => {
      const x = L + i * cw + (cw - bw) / 2, top = y(c), h = Hh - Bm - top, r = Math.min(4, h, bw / 2);
      const isFc = i === n - 1, isCur = i === n - 2;
      if (c > 0) g += `<path class="bar ${isFc ? 'fc' : isCur ? 'cur' : ''}" data-b="${i}" d="M${x},${Hh - Bm} V${top + r} q0,-${r} ${r},-${r} h${bw - 2 * r} q${r},0 ${r},${r} V${Hh - Bm} Z"/>`;
      // Nhãn trục: cách đều, và không đè lên nhãn "Dự báo" ở cột cuối
      if (isFc || (i % lab === (n - 2) % lab && (n - 1 - i) * cw >= 46)) g += `<text class="ax ${isFc ? 'st-fct' : ''}" x="${L + i * cw + cw / 2}" y="${Hh - 10}" text-anchor="middle">${isFc ? 'Dự báo' : esc(R.B[i].short)}</text>`;
    });
    if (avg > 0) g += `<line class="st-avg" x1="${L}" x2="${fx}" y1="${y(avg)}" y2="${y(avg)}"/><text class="ax st-avgt" x="${W - Rr + 6}" y="${y(avg) + 4}" text-anchor="start">TB ${fmt1(avg)}</text>`;
    all.forEach((c, i) => { g += `<rect x="${L + i * cw}" y="${T}" width="${cw}" height="${Hh - T - Bm}" fill="transparent" data-i="${i}"/>`; });
    const el = $('#sChart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc($('#sChartT').textContent)}">${g}</svg><div class="chart-tip" id="sTip"></div>
      <div class="muted small st-legend"><span>Tổng: <b>${num(VM.sum(vals))} ${esc(unit)}</b> · TB <b>${fmt1(avg)} ${esc(unit)}${G.per}</b></span><span><i class="st-sw"></i>Đã qua <i class="st-sw cur"></i>${G.label} hiện tại (chưa hết) <i class="st-sw fc"></i>Dự báo ${G.label.toLowerCase()} tới: <b>${num(fc)} ${esc(unit)}</b></span></div>`;
    const tip = $('#sTip'), svg = el.querySelector('svg');
    el.querySelectorAll('rect[data-i]').forEach(r => {
      r.onmouseenter = () => {
        const i = +r.dataset.i, isFc = i === n - 1, box = svg.getBoundingClientRect(), sc = box.width / W;
        const nb = isFc ? bucket(o.g, addP(o.g, R.B[R.B.length - 1].s, 1)) : R.B[i];
        tip.innerHTML = `<b>${esc(nb.long)}</b><br>${isFc ? 'Dự báo: ' : ''}${num(all[i])} ${esc(unit)}${!d && !isFc ? ` · ${R.per[i].n} lượt thuốc` : ''}${i === n - 2 ? '<br><i>đang diễn ra</i>' : ''}`;
        tip.style.left = Math.min(Math.max((L + i * cw + cw / 2) * sc, 90), box.width - 90) + 'px'; tip.style.top = Math.max(y(all[i]) * sc - 4, 50) + 'px';
        tip.classList.add('show');
        el.querySelectorAll('.bar').forEach(b => b.classList.toggle('hl', +b.dataset.b === i));
      };
      r.onmouseleave = () => { tip.classList.remove('show'); el.querySelectorAll('.bar.hl').forEach(b => b.classList.remove('hl')); };
    });
  }
  const avgOf = a => a.length ? VM.sum(a) / a.length : 0;

  function spark(d) {
    const W = 120, H = 28, n = d.b.length, cw = W / n, bw = Math.max(1.5, cw - (n > 40 ? .6 : 1.5)), mx = Math.max(1, ...d.b);
    return `<svg class="st-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${d.b.map((v, i) => { const h = v ? Math.max(2, (H - 2) * v / mx) : 0; return h ? `<rect x="${(i * cw).toFixed(2)}" y="${(H - h).toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="1" class="${i === n - 1 ? 'cur' : ''}"/>` : `<rect x="${(i * cw).toFixed(2)}" y="${H - 1}" width="${bw.toFixed(2)}" height="1" class="z"/>`; }).join('')}</svg>`;
  }
  const trendHtml = d => {
    if (!d.avg && !d.ravg) return '<span class="muted">—</span>';
    const p = Math.round(d.trend * 100);
    if (Math.abs(p) < 10) return '<span class="st-tr flat" title="Gần bằng trung bình">→ ổn định</span>';
    return `<span class="st-tr ${p > 0 ? 'up' : 'down'}" title="Trung bình ${R.k} kỳ gần nhất so với trung bình cả khoảng">${p > 0 ? '↑' : '↓'} ${Math.abs(p) > 300 ? '>300' : Math.abs(p)}%</span>`;
  };
  const bigText = d => d.big && d.fc ? `≈ ${num(Math.ceil(d.fc / d.big.factor))} ${esc(d.big.name)}` : '';

  function drawTable() {
    if (!R) return;
    const G = GRAN[o.g];
    let list = R.list.slice();
    list.sort(SORTERS[o.sort] || SORTERS.times);
    const q = VM.normalize(o.q.trim());
    if (q) list = list.filter(d => [d.name, d.code, d.sap].some(v => VM.normalize(v).includes(q)));
    if (!R.list.length) {
      $('#sTable').innerHTML = VM.ui.empty('trend', 'Chưa có dữ liệu vay trong khoảng này', `Chọn khoảng dài hơn hoặc đổi chiều vay. Thống kê lấy từ các mã vay đã ghi trong sổ.`, `<button class="btn primary" id="sGoNew">${icon('plus', 's')} Tạo mã vay mới</button>`);
      $('#sGoNew').onclick = () => VM.ui.go('loans/new');
      return;
    }
    if (!list.length) { $('#sTable').innerHTML = VM.ui.empty('search', 'Không tìm thấy thuốc', 'Thử từ khóa khác.'); return; }
    $('#sTable').innerHTML = `<table class="t st-table"><thead><tr>
        <th class="num" style="width:38px">#</th><th>Thuốc</th><th class="num">Lượt vay</th><th class="num">Tổng SL</th>
        <th class="hide-m">Diễn biến ${R.B.length} ${G.unit}</th>
        <th class="hide-m">Xu hướng</th><th class="num">Dự báo ${G.per}</th><th class="num hide-m">Tồn nhà thuốc</th></tr></thead><tbody>
      ${list.map((d, i) => `<tr class="clickable ${o.pick === d.key ? 'st-on' : ''}" data-k="${esc(d.key)}" title="Bấm để xem biểu đồ của thuốc này">
        <td class="num muted">${i + 1}</td>
        <td><div class="t-title">${esc(d.name)} ${d.regular ? `<span class="st-reg" title="Có vay ở ≥ ${R.regularMin}/${R.B.length} ${G.unit}">${icon('history', 's')}Thường xuyên</span>` : ''}</div>
          <div class="t-sub">${d.code ? `<span class="mono">${esc(d.code)}</span>` : '<i>Ngoài danh mục</i>'}${d.sap ? ` · SAP <span class="mono">${esc(d.sap)}</span>` : ''}${Object.keys(d.to).length === 1 && !o.dir ? ` · ${Object.keys(d.to)[0] === 'Y001' ? 'Nhà thuốc vay' : 'Kho nội trú vay'}` : ''}</div></td>
        <td class="num"><b>${d.times}</b><div class="t-sub" title="Lần vay gần nhất: ${VM.fmtDT(d.last)}">${VM.ago(d.last)}</div></td>
        <td class="num"><b>${num(d.total)}</b> <span class="muted small">${esc(d.unit)}</span></td>
        <td class="hide-m">${spark(d)}<div class="t-sub">có vay ${d.active}/${R.B.length} ${G.unit}</div></td>
        <td class="hide-m">${trendHtml(d)}</td>
        <td class="num st-fc"><b>${d.fc ? num(d.fc) : '—'}</b> <span class="muted small">${d.fc ? esc(d.unit) : ''}</span>${bigText(d) ? `<div class="t-sub">${bigText(d)}</div>` : ''}</td>
        <td class="num hide-m">${d.stock == null ? '<span class="muted">—</span>' : `${num(d.stock)}${d.cover != null && d.cover < 1 ? `<div>${VM.ui.pill('warn', 'Thiếu so với dự báo', 'alert')}</div>` : d.cover != null ? `<div class="t-sub">đủ ~${d.cover >= 20 ? '20+' : fmt1(d.cover)} ${G.unit}</div>` : ''}`}</td>
      </tr>`).join('')}</tbody></table>`;
    $$('#sTable tr[data-k]').forEach(tr => tr.onclick = () => {
      o.pick = o.pick === tr.dataset.k ? '' : tr.dataset.k;
      drawChart(); drawTable();
      if (o.pick) { const c = $('#sChart'); if (c && c.scrollIntoView) c.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    });
  }

  function exportXls() {
    if (!R) R = compute();
    const G = GRAN[o.g];
    const dirLabel = (DIRS.find(x => x[0] === o.dir) || DIRS[0])[1];
    const head = ['STT', 'Mã hàng', 'Mã SAP', 'Tên thuốc', 'ĐVT (nhỏ nhất)', 'Lượt vay (số mã vay)', 'Tổng SL', `Số ${G.unit} có vay`, `TB ${G.per}`, `TB ${R.k} ${G.unit} gần nhất`, `Dự báo ${G.per}`, 'Quy đổi ĐVT lớn', 'Tồn nhà thuốc', 'Vay thường xuyên', 'Vay gần nhất'];
    const rows = R.list.map((d, i) => [i + 1, d.code, d.sap, d.name, d.unit, d.times, d.total, d.active, Math.round(d.avg * 100) / 100, Math.round(d.ravg * 100) / 100, d.fc, d.big && d.fc ? `${Math.ceil(d.fc / d.big.factor)} ${d.big.name}` : '', d.stock == null ? '' : d.stock, d.regular ? 'Có' : '', VM.fmtDate(d.last)]);
    const mHead = ['Mã hàng', 'Tên thuốc', 'ĐVT', ...R.B.map(b => b.long + (b.cur ? ' (chưa hết)' : ''))];
    const matrix = R.list.map(d => [d.code, d.name, d.unit, ...d.b]);
    const per = R.B.map((b, i) => [b.long + (b.cur ? ' (chưa hết)' : ''), VM.fmtDate(b.s), VM.fmtDate(b.last), R.per[i].v.size, R.per[i].n]);
    VM.xlsx.exportXlsx({
      'Thuốc vay thường xuyên': [head, ...rows, [], [`Thống kê theo ${G.label.toLowerCase()} · ${R.B.length} ${G.unit} gần nhất · ${dirLabel} · xuất lúc ${VM.fmtDT(VM.iso())}`], [`Dự báo = 60% TB ${R.k} ${G.unit} gần nhất + 40% TB ${R.done} ${G.unit} đã qua (không tính ${G.unit} hiện tại), làm tròn lên. SL quy về ĐVT nhỏ nhất.`]],
      'Theo kỳ': [mHead, ...matrix],
      'Tổng theo kỳ': [['Kỳ', 'Từ ngày', 'Đến ngày', 'Số mã vay', 'Lượt thuốc'], ...per],
    }, `thong_ke_vay_thuoc_${o.g}_${VM.fileStamp()}.xlsx`);
    VM.store.log('Xuất thống kê vay thuốc', 'Sổ vay', `${G.label} · ${R.B.length} kỳ · ${R.list.length} thuốc`);
  }

  VM.ui.register({
    id: 'loanstats', title: 'Thống kê vay thuốc', group: 'loans', icon: 'trend', render,
    tour: () => [
      { el: '#sG', title: 'Theo ngày, tuần hoặc tháng', text: 'Chọn cách gom số liệu và số kỳ muốn xem. Lọc riêng <b>Nhà thuốc vay</b> hoặc <b>Kho nội trú vay</b> để biết kho nào hay thiếu thuốc.' },
      { el: '#sChart', title: 'Diễn biến theo kỳ', text: 'Cột nhạt là kỳ hiện tại (chưa hết), cột viền đứt là <b>dự báo kỳ tới</b>. Đường nét đứt là trung bình.' },
      { el: '#sTable', title: 'Thuốc vay thường xuyên', text: 'Xếp theo số lần vay. Cột <b>Dự báo</b> gợi ý lượng cần dự trù cho kỳ tới, so với tồn nhà thuốc. Bấm một thuốc để xem biểu đồ riêng.' },
      { el: '#sXls', title: 'Xuất Excel', text: 'Xuất bảng thống kê, ma trận thuốc × kỳ và tổng theo kỳ để gửi dự trù.' },
    ],
    subs: () => Object.entries(GRAN).map(([k, g]) => ({ arg: k, label: `Theo ${g.label.toLowerCase()}` })),
  });
})(window.VM);
