/* Store: single state object persisted to localStorage, audit log, change events */
'use strict';
(function (VM) {
  const KEY = 'vmhub.state.v1';
  const SESSION = 'vmhub.session';
  const SCHEMA = 1;

  // tab = nhãn ngắn trên thanh phân loại (Bán hàng, Danh mục); label = giá trị cột "Nhóm hàng" trong Excel
  const CATEGORIES = {
    otc: { label: 'Thuốc OTC', short: 'OTC', tab: 'Thuốc', icon: 'pill' },
    supp: { label: 'Thực phẩm chức năng', short: 'TPCN', tab: 'TPCN', icon: 'leaf' },
    device: { label: 'Vật tư y tế', short: 'VTYT', tab: 'Vật tư', icon: 'band' },
    other: { label: 'Khác', short: 'Khác', tab: 'Khác', icon: 'package' },
  };
  const catOf = p => CATEGORIES[p && p.category] || CATEGORIES.other;

  function seedProducts() {
    const P = (code, sap, name, ingredient, category, group, units, defaultUnit, stock, lot, expiry, minStock = 20) =>
      ({ id: VM.uid('p_'), code, sap, name, ingredient, category, group, store: 'Y001', units, defaultUnit, stock, lot, expiry, minStock, active: true, image: '', updatedAt: VM.iso() });
    const u = (name, factor, price) => ({ name, factor, price });
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return VM.ymd(x); };
    return [
      P('OTC001', '10001234', 'Paracetamol 500mg', 'Paracetamol', 'otc', 'Giảm đau – hạ sốt', [u('Viên', 1, 600), u('Vỉ', 10, 5500), u('Hộp', 100, 45000)], 'Vỉ', 1200, 'PA2405A', d(540), 100),
      P('OTC002', '10001240', 'Efferalgan 500mg (sủi)', 'Paracetamol', 'otc', 'Giảm đau – hạ sốt', [u('Viên', 1, 2200), u('Vỉ', 4, 8800), u('Hộp', 16, 35000)], 'Vỉ', 160, 'EF24K09', d(420), 32),
      P('OTC003', '10002210', 'Cetirizine 10mg', 'Cetirizine', 'otc', 'Kháng histamin', [u('Viên', 1, 3000), u('Vỉ', 10, 28000)], 'Vỉ', 90, 'CE2311B', d(300), 30),
      P('OTC004', '10002875', 'Omeprazole 20mg', 'Omeprazole', 'otc', 'Tiêu hóa', [u('Viên', 1, 2800), u('Hộp', 28, 78000)], 'Hộp', 18, 'OM2408C', d(75), 28),
      P('OTC005', '10003301', 'Smecta 3g', 'Diosmectite', 'otc', 'Tiêu hóa', [u('Gói', 1, 4500), u('Hộp', 30, 128000)], 'Gói', 240, 'SM2402D', d(610), 30),
      P('OTC006', '10003790', 'Dextromethorphan siro 60ml', 'Dextromethorphan', 'otc', 'Hô hấp', [u('Chai', 1, 32000)], 'Chai', 27, 'DX2312E', d(260), 10),
      P('OTC007', '10004102', 'Natri clorid 0,9% nhỏ mắt 10ml', 'Natri clorid', 'otc', 'Mắt – Mũi – Họng', [u('Lọ', 1, 4000)], 'Lọ', 150, 'NC2409F', d(700), 30),
      P('OTC008', '10004450', 'Strepsils hương bạc hà', 'Amylmetacresol', 'otc', 'Mắt – Mũi – Họng', [u('Vỉ', 1, 18000), u('Hộp', 2, 35000)], 'Vỉ', 6, 'ST2401G', d(40), 10),
      P('TPCN01', '20001001', 'Vitamin C 500mg', 'Acid ascorbic', 'supp', 'Vitamin – khoáng chất', [u('Viên', 1, 700), u('Hộp', 100, 65000)], 'Hộp', 6500, 'VC2405H', d(480), 500),
      P('TPCN02', '20001020', 'Omega 3 Fish Oil 1000mg', 'Omega 3', 'supp', 'Vitamin – khoáng chất', [u('Lọ', 1, 185000)], 'Lọ', 31, 'OG2310I', d(330), 5),
      P('TPCN03', '20001055', 'Kẽm Gluconat 10mg', 'Kẽm', 'supp', 'Vitamin – khoáng chất', [u('Viên', 1, 1500), u('Lọ', 60, 85000)], 'Lọ', 600, 'ZN2404J', d(390), 120),
      P('VTYT01', '30001001', 'Khẩu trang y tế 4 lớp', '', 'device', 'Vật tư tiêu hao', [u('Cái', 1, 1000), u('Hộp', 50, 35000)], 'Hộp', 2700, 'KT2406K', d(900), 200),
      P('VTYT02', '30001012', 'Bông gạc tiệt trùng 10x10', '', 'device', 'Vật tư tiêu hao', [u('Gói', 1, 9000)], 'Gói', 80, 'BG2403L', d(800), 20),
      P('VTYT03', '30001030', 'Nhiệt kế điện tử', '', 'device', 'Thiết bị', [u('Cái', 1, 95000)], 'Cái', 12, 'NK2401M', d(1500), 3),
    ].map((p, i) => {
      // GTIN mẫu dùng tiền tố 20 (GS1 dành cho mã nội bộ) để không trùng mã thật
      const body = '20000000' + VM.pad(i + 1, 4);
      p.gtin = body + VM.gtinCheck(body);
      return p;
    });
  }

  function seedState() {
    const staff = [
      { id: 'DS01', name: 'DS. Nguyễn Minh An', role: 'Dược sĩ nhà thuốc', store: 'Y001', admin: false },
      { id: 'DS02', name: 'DS. Trần Thu Hà', role: 'Dược sĩ nhà thuốc', store: 'Y001', admin: false },
      { id: 'DS03', name: 'DS. Lê Quốc Bảo', role: 'Dược sĩ kho nội trú', store: 'Y003', admin: false },
      { id: 'NV01', name: 'Đỗ Quỳnh Anh', role: 'Nghiệp vụ dược', store: 'Y003', admin: false },
      { id: 'QL01', name: 'DS. Phạm Thanh Mai', role: 'Quản lý / Trưởng khoa', store: 'Y001', admin: true },
    ];
    const s = {
      schema: SCHEMA,
      meta: { createdAt: VM.iso(), updatedAt: VM.iso(), rev: 0, demo: true },
      settings: {
        pharmacyName: 'Nhà thuốc Vinmec OPC2',
        counter: 'Q1',
        bank: { bin: '', account: '', owner: '' },
        stores: [
          { code: 'Y001', name: 'Nhà thuốc (ngoại trú)', plant: '', fundsCenter: '' },
          { code: 'Y003', name: 'Kho thuốc nội trú', plant: '', fundsCenter: '' },
        ],
        suppliers: ['Cty CP Dược phẩm An Khang Phát', 'Cty TNHH Phân phối Dược Hà Thành', 'Cty TNHH Thiết bị Y tế Bình Minh'],
        loanOverdueHours: 24,
        invoiceAlertDays: 2,
        expiryWarnDays: 90,
        priceDiffPct: 5,
        snapshotMinutes: 15,
        // File điều chuyển SAP: plans / Funds center là giá trị cố định; số lượng quy đổi về ĐVT nhỏ nhất; LOT/DATE mặc định để trống (lấy từ file khác)
        transfer: { plant: '1000', fundsCenter: '1000', unit: 'base', fillLot: false },
        // AI chạy cục bộ – mặc định KHÔNG gửi dữ liệu ra ngoài
        ai: { stt: 'local', sttUrl: 'http://localhost:8080/inference', ocrUrl: 'http://localhost:11434/v1/chat/completions', ocrModel: 'qwen2.5vl:7b', allowPublic: false },
      },
      staff,
      products: seedProducts(),
      sales: [],
      loans: [],
      invoices: [],
      seq: {},
      audit: [],
      aiStats: blankStats(),
    };
    demoData(s);
    demoCatalogExtra(s);
    demoCatalogMain(s);
    return s;
  }

  // Hàm lượng cho hàng mẫu + 1 mặt hàng nhóm "Khác" (dữ liệu mẫu tạo trước khi có 2 thứ này được bổ sung một lần qua migrate)
  const DEMO_STRENGTH = { OTC001: '500mg', OTC002: '500mg', OTC003: '10mg', OTC004: '20mg', OTC005: '3g', OTC006: '60ml', OTC007: '0,9% – 10ml', OTC008: 'Viên ngậm', TPCN01: '500mg', TPCN02: '1000mg', TPCN03: '10mg', VTYT01: '4 lớp', VTYT02: '10 x 10 cm', VTYT03: 'Đo ở nách / miệng' };
  function demoCatalogExtra(s) {
    if (s.seq.demoCat2) return;
    s.seq.demoCat2 = 1;
    s.products.forEach(p => { if (p.strength == null && DEMO_STRENGTH[p.code]) p.strength = DEMO_STRENGTH[p.code]; });
    if (!s.products.some(p => p.code === 'KH001')) {
      const d = new Date(); d.setDate(d.getDate() + 640);
      const body = '20000000' + VM.pad(15, 4);
      s.products.push({ id: VM.uid('p_'), code: 'KH001', sap: '40001001', gtin: body + VM.gtinCheck(body), name: 'Kem dưỡng ẩm da nhạy cảm', strength: 'Tuýp 50g', ingredient: '', category: 'other', group: 'Chăm sóc da', store: 'Y001', units: [{ name: 'Tuýp', factor: 1, price: 145000 }], defaultUnit: 'Tuýp', stock: 14, lot: 'KD2406N', expiry: VM.ymd(d), minStock: 3, active: true, image: '', updatedAt: VM.iso() });
    }
  }

  // 26 mặt hàng mẫu gộp từ prototype nhánh main (legacy/vinmec_ocp2_v1.html), quy về 4 nhóm của khoa:
  // Dược mỹ phẩm / Chăm sóc cá nhân → nhóm "Khác" (tên nhóm cũ giữ ở trường group). Tồn = ĐVT nhỏ nhất.
  // Thêm sau lịch sử bán mẫu để không đổi dữ liệu mẫu đã sinh; dữ liệu mẫu cũ được bổ sung một lần (seq.demoCat3).
  function demoCatalogMain(s) {
    if (s.seq.demoCat3) return;
    s.seq.demoCat3 = 1;
    const u = (name, factor, price) => ({ name, factor, price });
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return VM.ymd(x); };
    const rows = [
      // code, sap, name, strength, ingredient, category, group, units, defaultUnit, stock (theo ĐVT mặc định), lot, HSD (ngày), tồn tối thiểu (theo ĐVT mặc định)
      ['OTC009', '10005001', 'Panadol Extra (đỏ)', 'Paracetamol 500mg, Caffeine 65mg', 'Paracetamol, Caffeine', 'otc', 'Giảm đau – hạ sốt', [u('Viên', 1, 2300), u('Vỉ', 12, 23000), u('Hộp', 180, 345000)], 'Hộp', 120, 'LOT-PND-01', 549, 20],
      ['OTC010', '10005002', 'Panadol (xanh)', 'Paracetamol 500mg', 'Paracetamol', 'otc', 'Giảm đau – hạ sốt', [u('Viên', 1, 1700), u('Vỉ', 12, 19000), u('Hộp', 120, 190000)], 'Hộp', 110, 'LOT-PND-02', 575, 20],
      ['OTC011', '10005003', 'Panadol Cảm Cúm', 'Paracetamol 500mg, Phenylephrine 10mg', 'Paracetamol, Phenylephrine', 'otc', 'Giảm đau – hạ sốt', [u('Viên', 1, 2500), u('Vỉ', 12, 24000), u('Hộp', 180, 360000)], 'Hộp', 95, 'LOT-PND-03', 723, 20],
      ['OTC012', '10005004', 'Panadol viên sủi 500mg', 'Paracetamol 500mg', 'Paracetamol', 'otc', 'Giảm đau – hạ sốt', [u('Viên', 1, 4500), u('Vỉ', 4, 18000), u('Hộp', 16, 72000)], 'Hộp', 80, 'LOT-PND-04', 646, 20],
      ['OTC013', '10005005', 'Panadol Extra with Optizorb', 'Paracetamol 500mg', 'Paracetamol', 'otc', 'Giảm đau – hạ sốt', [u('Viên', 1, 2800), u('Vỉ', 10, 28000), u('Hộp', 120, 336000)], 'Hộp', 70, 'LOT-PND-05', 694, 20],
      ['TPCN04', '20001101', 'Blackmores Omega Double High Strength Fish Oil', 'EPA 360mg, DHA 240mg – lọ 90 viên', 'Dầu cá', 'supp', 'Dầu cá – Omega 3', [u('Viên', 1, 6000), u('Lọ', 90, 520000)], 'Lọ', 65, 'LOT-BKM-01', 700, 10],
      ['TPCN05', '20001102', 'Sụn vi cá mập Shark Cartilage 750mg', 'Chondroitin 750mg – lọ 100 viên', 'Sụn vi cá mập', 'supp', 'Xương khớp', [u('Viên', 1, 4200), u('Hộp', 100, 395000)], 'Hộp', 45, 'LOT-CST-02', 767, 10],
      ['TPCN06', '20001103', 'Dầu cá Omega-3 Fish Oil 1000mg (Goodhealth)', 'EPA 180mg, DHA 120mg – lọ 150 viên', 'Dầu cá', 'supp', 'Dầu cá – Omega 3', [u('Viên', 1, 2000), u('Lọ', 150, 285000)], 'Lọ', 80, 'LOT-GDH-03', 636, 10],
      ['TPCN07', '20001104', 'Glucosamine HCl 1500mg with MSM', 'Glucosamine 1500mg, MSM 1500mg – 375 viên', 'Glucosamine, MSM', 'supp', 'Xương khớp', [u('Viên', 1, 1600), u('Hộp', 375, 580000)], 'Hộp', 50, 'LOT-KKL-04', 743, 10],
      ['TPCN08', '20001105', 'Ocuvite Lutein & Zeaxanthin', 'Lutein 6mg, Zeaxanthin – hộp 3 vỉ x 10 viên', 'Lutein, Zeaxanthin', 'supp', 'Mắt', [u('Vỉ', 1, 110000), u('Hộp', 3, 320000)], 'Hộp', 40, 'LOT-OCV-05', 604, 10],
      ['TPCN09', '20001106', 'Hoạt huyết dưỡng não Traphaco', 'Cao đinh lăng 150mg, Ginkgo 5mg – hộp 5 vỉ x 20 viên', 'Đinh lăng, Ginkgo biloba', 'supp', 'Tuần hoàn não', [u('Vỉ', 1, 14000), u('Hộp', 5, 65000)], 'Hộp', 90, 'LOT-TRP-06', 657, 10],
      ['VTYT04', '30001101', 'Máy đo huyết áp bắp tay Omron HEM-7120', 'Bắp tay, tự động', '', 'device', 'Thiết bị', [u('Hộp', 1, 870000)], 'Hộp', 35, 'LOT-OMR-01', 1825, 3],
      ['VTYT05', '30001102', 'Nhiệt kế điện tử đầu mềm Omron MC-246', 'Đo miệng / nách – 60 giây', '', 'device', 'Thiết bị', [u('Hộp', 1, 105000)], 'Hộp', 90, 'LOT-OMR-02', 1825, 5],
      ['VTYT06', '30001103', 'Máy xông khí dung Omron NE-C106', 'Hạt sương 4,56 µm', '', 'device', 'Thiết bị', [u('Hộp', 1, 790000)], 'Hộp', 25, 'LOT-OMR-03', 1825, 3],
      ['VTYT07', '30001104', 'Máy đo huyết áp cổ tay Omron HEM-6161', 'Cổ tay', '', 'device', 'Thiết bị', [u('Hộp', 1, 780000)], 'Hộp', 30, 'LOT-OMR-04', 1825, 3],
      ['VTYT08', '30001105', 'Máy đo huyết áp bắp tay Omron HEM-7121', 'Bắp tay, bộ nhớ 30 lần đo', '', 'device', 'Thiết bị', [u('Hộp', 1, 1050000)], 'Hộp', 20, 'LOT-OMR-05', 1825, 3],
      ['KH002', '40001002', 'La Roche-Posay Cicaplast Baume B5+', 'Panthenol 5% – tuýp 40ml', 'Panthenol, Madecassoside', 'other', 'Dược mỹ phẩm', [u('Tuýp', 1, 330000)], 'Tuýp', 75, 'LOT-LRP-01', 588, 10],
      ['KH003', '40001003', 'La Roche-Posay Effaclar Foaming Gel 200ml', 'Kẽm PCA – chai 200ml', 'Kẽm PCA', 'other', 'Dược mỹ phẩm', [u('Chai', 1, 385000)], 'Chai', 60, 'LOT-LRP-02', 539, 10],
      ['KH004', '40001004', 'La Roche-Posay Effaclar Foaming Gel 50ml', 'Kẽm PCA – tuýp 50ml', 'Kẽm PCA', 'other', 'Dược mỹ phẩm', [u('Tuýp', 1, 145000)], 'Tuýp', 85, 'LOT-LRP-03', 667, 10],
      ['KH005', '40001005', 'La Roche-Posay Micellar Water Ultra 400ml', 'Tẩy trang – chai 400ml', '', 'other', 'Dược mỹ phẩm', [u('Chai', 1, 435000)], 'Chai', 55, 'LOT-LRP-04', 763, 10],
      ['KH006', '40001006', 'La Roche-Posay Thermal Spring Water 150ml', 'Xịt khoáng – bình 150ml', '', 'other', 'Dược mỹ phẩm', [u('Bình', 1, 265000)], 'Bình', 70, 'LOT-LRP-05', 743, 10],
      ['KH007', '40001007', 'Dầu gội dược liệu Thái Dương 3 hương hoa đào', 'Chai 200ml', '', 'other', 'Chăm sóc cá nhân', [u('Chai', 1, 55000)], 'Chai', 90, 'LOT-STD-01', 561, 10],
      ['KH008', '40001008', 'Dầu gội dược liệu Thái Dương 7', 'Trị gàu – chai 200ml', '', 'other', 'Chăm sóc cá nhân', [u('Chai', 1, 115000)], 'Chai', 85, 'LOT-STD-02', 604, 10],
      ['KH009', '40001009', 'Dầu gội dược liệu Thái Dương 3 hương lá thơm', 'Chai 200ml', '', 'other', 'Chăm sóc cá nhân', [u('Chai', 1, 55000)], 'Chai', 70, 'LOT-STD-03', 672, 10],
      ['KH010', '40001010', 'Kem nghệ Thái Dương nano bạc', 'Tuýp 20g', 'Curcumin, nano bạc', 'other', 'Chăm sóc cá nhân', [u('Tuýp', 1, 20000)], 'Tuýp', 130, 'LOT-STD-04', 718, 10],
      ['KH011', '40001011', 'Nước súc miệng Valentine Thái Dương', 'Chai 500ml', 'Nano bạc, bạc hà', 'other', 'Chăm sóc cá nhân', [u('Chai', 1, 42000)], 'Chai', 100, 'LOT-STD-05', 761, 10],
    ];
    const have = new Set(s.products.map(p => p.code));
    rows.forEach(([code, sap, name, strength, ingredient, category, group, units, defaultUnit, stock, lot, days, min], i) => {
      if (have.has(code)) return;
      const f = units.find(x => x.name === defaultUnit).factor;
      const body = '20000000' + VM.pad(16 + i, 4);
      s.products.push({ id: VM.uid('p_'), code, sap, gtin: body + VM.gtinCheck(body), name, strength, ingredient, category, group, store: 'Y001', units, defaultUnit, stock: stock * f, lot, expiry: d(days), minStock: min * f, active: true, image: '', updatedAt: VM.iso() });
    });
  }

  const blankStats = () => ({ ocr: { docs: 0, fields: 0, kept: 0 }, voice: { n: 0, top1: 0 } });

  // Deterministic demo history so dashboard / books are not empty on first run.
  function demoData(s) {
    let r = 7;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const sellable = s.products;
    const hourW = [0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 6, 9, 10, 8, 4, 5, 6, 5, 4, 2, 1, 0, 0, 0];
    const pickHour = () => { const tot = hourW.reduce((a, b) => a + b, 0); let x = rnd() * tot; for (let h = 0; h < 24; h++) { x -= hourW[h]; if (x <= 0) return h; } return 11; };
    for (let day = 29; day >= 0; day--) {
      const n = 4 + Math.floor(rnd() * 7);
      for (let k = 0; k < n; k++) {
        const t = new Date(); t.setDate(t.getDate() - day); t.setHours(pickHour(), Math.floor(rnd() * 60), 0, 0);
        if (t > new Date()) continue; // today: only orders already in the past
        const items = [];
        const lines = 1 + Math.floor(rnd() * 3);
        for (let j = 0; j < lines; j++) {
          const p = sellable[Math.floor(rnd() * sellable.length)];
          if (items.some(i => i.productId === p.id)) continue;
          const unit = p.units.find(u => u.name === p.defaultUnit) || p.units[0];
          const qty = 1 + Math.floor(rnd() * 2);
          items.push({ productId: p.id, code: p.code, sap: p.sap, name: p.name, lot: p.lot, store: p.store, unit: unit.name, factor: unit.factor, qty, price: unit.price, listPrice: unit.price, total: qty * unit.price });
        }
        const seller = s.staff[Math.floor(rnd() * 2)];
        const total = VM.sum(items, i => i.total);
        const key = VM.ymd(t).replace(/-/g, '');
        s.seq['ORD' + key] = (s.seq['ORD' + key] || 0) + 1;
        s.sales.push({ id: VM.uid('s_'), code: `ORD-${key}-Q1-${VM.pad(s.seq['ORD' + key], 4)}`, createdAt: VM.iso(t), paidAt: VM.iso(t), sellerId: seller.id, sellerName: seller.name, customer: '', pid: '', items, total, payment: rnd() > .45 ? 'qr' : 'cash', status: 'paid', recon: day > 3 ? 'done' : 'pending', demo: true });
      }
    }
    const hAgo = h => { const t = new Date(Date.now() - h * 36e5); return VM.iso(t); };
    const P = c => s.products.find(p => p.code === c);
    // Một mã vay (VAY-yyyymmdd-001) gồm nhiều dòng thuốc; mỗi dòng có trạng thái / lịch sử gạch sổ riêng
    const V = (h, from, to, borrower, lender, confirmed, items) => {
      const t = new Date(Date.now() - h * 36e5), key = VM.ymd(t).replace(/-/g, '');
      s.seq['VAY' + key] = (s.seq['VAY' + key] || 0) + 1;
      const group = `VAY-${key}-${VM.pad(s.seq['VAY' + key], 3)}`;
      return items.map(([p, qty, returns = [], note = ''], i) => ({ id: VM.uid('l_'), group, line: i + 1, code: `${group}/${i + 1}`, createdAt: VM.iso(t), createdBy: borrower, from, to, productId: p.id, itemCode: p.code, sap: p.sap, name: p.name, unit: baseUnit(p).name, qty, lot: p.lot, expiry: p.expiry, borrower, lender, note, confirmedBy: confirmed ? lender : '', confirmedAt: confirmed ? VM.iso(new Date(t.getTime() + 6e5)) : '', returns, cancelled: false, demo: true }));
    };
    const R = (h, qty, ref, note = '') => ({ id: VM.uid('r_'), at: hAgo(h), qty, ref, by: 'DS. Lê Quốc Bảo', note });
    demoLoanHistory(s);
    s.loans.push(
      ...V(52, 'Y003', 'Y001', 'DS. Nguyễn Minh An', 'DS. Lê Quốc Bảo', true, [[P('TPCN03'), 30, [R(26, 30, '4900012299')]]]),
      ...V(30, 'Y003', 'Y001', 'DS. Nguyễn Minh An', 'DS. Lê Quốc Bảo', true, [[P('OTC004'), 14, [], 'Khách cần gấp, nhà thuốc hết'], [P('OTC003'), 20], [P('OTC005'), 10]]),
      ...V(5, 'Y001', 'Y003', 'DS. Lê Quốc Bảo', 'DS. Trần Thu Hà', true, [[P('OTC001'), 40, [R(2, 20, '4900012345', 'Điều chuyển một phần')]], [P('VTYT01'), 50, [R(2, 50, '4900012345')]]]),
      ...V(2, 'Y003', 'Y001', 'DS. Trần Thu Hà', 'DS. Lê Quốc Bảo', false, [[P('OTC006'), 3], [P('OTC007'), 5]]),
    );
    const I = (daysAgo, book, sup, no, status, extra = {}) => {
      const t = new Date(); t.setDate(t.getDate() - daysAgo);
      const inv = { id: VM.uid('i_'), book, receivedAt: VM.ymd(t), supplier: sup, invoiceNo: no, invoiceDate: no ? VM.ymd(t) : '', refNo: '', prNo: '', poNo: '', itemCount: 0, receivedBy: 'DS. Lê Quốc Bảo', pharmacyReceiver: book === 'OPD' ? 'DS. Nguyễn Minh An' : '', nvdReceiver: '', subtotal: 0, tax: 0, total: 0, lines: [], status, history: [{ at: VM.iso(t), by: 'DS. Lê Quốc Bảo', action: status === 'no_invoice' ? 'Hàng về – chưa có hóa đơn' : 'Ghi sổ' }], note: '', createdAt: VM.iso(t), createdBy: 'DS. Lê Quốc Bảo', demo: true };
      return Object.assign(inv, extra);
    };
    const lines = [
      { id: VM.uid('ln_'), code: 'OTC001', name: 'Paracetamol 500mg H/100v', country: 'Việt Nam', lot: 'PA2410Z', expiry: (() => { const x = new Date(); x.setFullYear(x.getFullYear() + 2); return VM.ymd(x); })(), unit: 'Hộp', qty: 20, price: 38000, discount: 0, taxRate: 5 },
      { id: VM.uid('ln_'), code: 'VTYT01', name: 'Khẩu trang y tế 4 lớp H/50', country: 'Việt Nam', lot: 'KT2410Y', expiry: (() => { const x = new Date(); x.setFullYear(x.getFullYear() + 3); return VM.ymd(x); })(), unit: 'Hộp', qty: 30, price: 26000, discount: 0, taxRate: 10 },
    ];
    const withLines = I(1, 'OPD', s.settings.suppliers[0], '0001523', 'received', { lines, refNo: '1234567890', poNo: '4500098765' });
    calcInvoice(withLines);
    s.invoices.push(
      withLines,
      I(4, 'OPD', s.settings.suppliers[1], '', 'no_invoice', { itemCount: 3, note: 'Hàng về, NCC hẹn gửi HĐ sau' }),
      I(3, 'IPD', s.settings.suppliers[1], '0008812', 'handed', { itemCount: 5, subtotal: 12400000, tax: 620000, total: 13020000, nvdReceiver: 'Đỗ Quỳnh Anh', nvdAt: VM.iso(new Date(Date.now() - 2 * 864e5)) }),
      I(9, 'IPD', s.settings.suppliers[2], '0000731', 'entered', { itemCount: 2, subtotal: 3500000, tax: 350000, total: 3850000, nvdReceiver: 'Đỗ Quỳnh Anh' }),
    );
    demoTodayInvoices(s);
  }

  // Lịch sử vay mẫu ~10 tháng (đã gạch sổ hết) để màn Thống kê vay thuốc có số liệu. Cố định (deterministic), gắn cờ demo.
  function demoLoanHistory(s) {
    if (s.seq.demoLoanHist) return;
    s.seq.demoLoanHist = 1;
    let r = 11;
    const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    const P = c => s.products.find(p => p.code === c);
    // [mã hàng, trọng số, SL tối thiểu, bước, số bước, tỉ lệ Nhà thuốc vay]
    const POOL = [['OTC001', 9, 20, 10, 8, .7], ['OTC004', 7, 14, 14, 3, .9], ['VTYT01', 6, 50, 50, 3, .2], ['OTC005', 5, 10, 10, 3, .6], ['TPCN01', 4, 50, 50, 2, .8],
      ['OTC003', 4, 10, 10, 3, .7], ['OTC007', 3, 5, 5, 3, .5], ['TPCN03', 2, 30, 30, 2, .9], ['VTYT02', 2, 5, 5, 2, .3], ['OTC002', 1, 8, 8, 2, .8], ['OTC006', 1, 2, 1, 4, .8]]
      .filter(x => P(x[0]));
    if (!POOL.length) return;
    const ph = ['DS. Nguyễn Minh An', 'DS. Trần Thu Hà'], ks = 'DS. Lê Quốc Bảo';
    const out = [];
    for (let day = 300; day >= 4; day--) {
      const t0 = new Date(); t0.setDate(t0.getDate() - day);
      const wk = t0.getDay() === 0 || t0.getDay() === 6;
      // Mùa ho (≈ 6 tuần gần đây) – siro ho được vay nhiều hơn để thấy xu hướng tăng
      const pool = POOL.map(x => x[0] === 'OTC006' && day <= 45 ? Object.assign([...x], { 1: 8 }) : x);
      const tot = pool.reduce((a, x) => a + x[1], 0);
      const nv = rnd() < (wk ? .15 : .45) ? (rnd() < .2 ? 2 : 1) : 0;
      for (let v = 0; v < nv; v++) {
        const t = new Date(t0); t.setHours(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0);
        const key = VM.ymd(t).replace(/-/g, '');
        s.seq['VAY' + key] = (s.seq['VAY' + key] || 0) + 1;
        const group = `VAY-${key}-${VM.pad(s.seq['VAY' + key], 3)}`;
        const picks = [];
        const k = 1 + (rnd() < .45 ? 1 : 0) + (rnd() < .2 ? 1 : 0);
        for (let j = 0; j < k; j++) { let x = rnd() * tot; const it = pool.find(p => (x -= p[1]) <= 0) || pool[0]; if (!picks.includes(it)) picks.push(it); }
        const toY001 = rnd() < picks[0][5];
        const from = toY001 ? 'Y003' : 'Y001', to = toY001 ? 'Y001' : 'Y003';
        const borrower = toY001 ? ph[Math.floor(rnd() * 2)] : ks, lender = toY001 ? ks : ph[Math.floor(rnd() * 2)];
        const back = new Date(t.getTime() + (20 + Math.floor(rnd() * 30)) * 36e5);
        picks.forEach(([code, , min, step, steps], i) => {
          const p = P(code), qty = min + step * Math.floor(rnd() * steps);
          out.push({ id: VM.uid('l_'), group, line: i + 1, code: `${group}/${i + 1}`, createdAt: VM.iso(t), createdBy: borrower, from, to, productId: p.id, itemCode: p.code, sap: p.sap, name: p.name, unit: baseUnit(p).name, qty, lot: p.lot, expiry: p.expiry, borrower, lender, note: '', confirmedBy: lender, confirmedAt: VM.iso(new Date(t.getTime() + 6e5)), returns: [{ id: VM.uid('r_'), at: VM.iso(back), qty, ref: '49' + VM.pad(Math.floor(rnd() * 1e8), 8), by: ks, note: '' }], cancelled: false, demo: true });
        });
      }
    }
    s.loans.push(...out);
  }

  // 3 hóa đơn mẫu hàng về hôm nay (để thử "Copy quyết toán trong ngày"); số HĐ có số 0 đầu để kiểm tra giữ dạng chữ
  function demoTodayInvoices(s) {
    if (s.seq.demoQtDay) return;
    s.seq.demoQtDay = 1;
    const sup = s.settings.suppliers || [], at = h => { const t = new Date(); t.setHours(h, 15, 0, 0); return VM.iso(t); };
    const I = (h, book, supplier, invoiceNo, totalQty, itemCount, total, status) => ({ id: VM.uid('i_'), book, receivedAt: VM.ymd(), supplier: supplier || 'NCC mẫu', invoiceNo, invoiceDate: invoiceNo ? VM.ymd() : '', refNo: '', prNo: '', poNo: '', itemCount, totalQty, receivedBy: 'DS. Lê Quốc Bảo', pharmacyReceiver: book === 'OPD' ? 'DS. Nguyễn Minh An' : '', nvdReceiver: '', subtotal: Math.round(total / 1.05), tax: total - Math.round(total / 1.05), total, lines: [], status, history: [{ at: at(h), by: 'DS. Lê Quốc Bảo', action: invoiceNo ? 'Ghi sổ' : 'Hàng về – chưa có hóa đơn' }], note: '', createdAt: at(h), createdBy: 'DS. Lê Quốc Bảo', demo: true });
    s.invoices.push(
      I(8, 'OPD', sup[0], '0001688', 240, 4, 6720000, 'received'),
      I(9, 'IPD', sup[2], '0000802', 35, 2, 3150000, 'received'),
      I(10, 'OPD', sup[1], '0009417', 120, 3, 2940000, 'received'),
      I(11, 'OPD', sup[1], '', 0, 1, 0, 'no_invoice'),
    );
  }

  // Invoice totals from lines (if any)
  function calcInvoice(inv) {
    if (!inv.lines || !inv.lines.length) return inv;
    let sub = 0, tax = 0;
    const byRate = {};
    inv.lines.forEach(l => {
      const gross = (Number(l.qty) || 0) * (Number(l.price) || 0);
      const net = gross * (1 - (Number(l.discount) || 0) / 100);
      const t = net * (Number(l.taxRate) || 0) / 100;
      l.amount = Math.round(net);
      sub += net; tax += t;
      const k = String(Number(l.taxRate) || 0);
      byRate[k] = byRate[k] || { net: 0, tax: 0 };
      byRate[k].net += net; byRate[k].tax += t;
    });
    inv.subtotal = Math.round(sub); inv.tax = Math.round(tax); inv.total = Math.round(sub + tax);
    inv.itemCount = inv.lines.length;
    inv.totalQty = inv.lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);
    inv.taxByRate = byRate;
    return inv;
  }

  // ---------- persistence ----------
  let state, listeners = [], saveErr = false;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = migrate(JSON.parse(raw)); if (state.__migrated) { delete state.__migrated; save('migrate'); } return; }
    } catch (e) { console.error('Load failed', e); }
    state = seedState();
    save('init');
  }
  function migrate(s) {
    if (!s || typeof s !== 'object') return seedState();
    const base = seedState();
    s.schema = s.schema || 1;
    s.settings = Object.assign({}, base.settings, s.settings || {});
    s.settings.ai = Object.assign({}, base.settings.ai, s.settings.ai || {});
    s.settings.transfer = Object.assign({}, base.settings.transfer, s.settings.transfer || {});
    // Kho HO2 là kho của toàn bệnh viện, không thuộc Khoa Dược → bỏ khỏi danh sách kho (bản cũ có sẵn trong dữ liệu mẫu)
    if (Array.isArray(s.settings.stores)) s.settings.stores = s.settings.stores.filter(x => !/^H[O0]2$/i.test(String(x.code || '').trim()));
    s.aiStats = Object.assign(blankStats(), s.aiStats || {});
    ['staff', 'products', 'sales', 'loans', 'invoices', 'audit'].forEach(k => { if (!Array.isArray(s[k])) s[k] = k === 'staff' ? base.staff : []; });
    s.seq = s.seq || {};
    s.meta = Object.assign({ rev: 0 }, s.meta || {});
    // Dữ liệu mẫu tạo trước khi có màn Thống kê vay: bổ sung lịch sử vay mẫu một lần (vẫn xóa được bằng "Xóa dữ liệu mẫu")
    if (s.meta.demo && !s.seq.demoLoanHist && s.products.length) { demoLoanHistory(s); s.__migrated = true; }
    if (s.meta.demo && !s.seq.demoQtDay) { demoTodayInvoices(s); s.__migrated = true; }
    if (s.meta.demo && !s.seq.demoCat2 && s.products.length) { demoCatalogExtra(s); s.__migrated = true; }
    if (s.meta.demo && !s.seq.demoCat3 && s.products.length) { demoCatalogMain(s); s.__migrated = true; }
    // Nhóm hàng lạ (nhập từ file cũ) → "Khác" để thanh phân loại luôn đếm đủ
    s.products.forEach(p => { if (!CATEGORIES[p.category]) p.category = 'other'; });
    return s;
  }
  function save(reason) {
    delete state.__migrated;
    state.meta.updatedAt = VM.iso();
    state.meta.rev = (state.meta.rev || 0) + 1;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      saveErr = false;
    } catch (e) {
      saveErr = true;
      console.error(e);
      VM.ui && VM.ui.toast('Không lưu được dữ liệu (bộ nhớ trình duyệt đầy). Hãy tải bản sao lưu ngay!', 'bad', 8000);
    }
    listeners.forEach(fn => { try { fn(reason); } catch (e) { console.error(e); } });
  }
  function replace(newState, reason = 'restore') { state = migrate(newState); save(reason); }
  const onChange = fn => listeners.push(fn);

  // Other tabs: pick up changes
  window.addEventListener('storage', e => {
    if (e.key === KEY && e.newValue) {
      try { state = migrate(JSON.parse(e.newValue)); listeners.forEach(fn => fn('external')); } catch (_) { }
    }
  });

  // ---------- session ----------
  function currentUser() { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { return null; } }
  function setUser(u) { if (u) localStorage.setItem(SESSION, JSON.stringify(u)); else localStorage.removeItem(SESSION); }
  const isAdmin = () => !!(currentUser() || {}).admin;

  // ---------- audit ----------
  function log(action, entity, detail = '', ref = '') {
    const u = currentUser() || {};
    state.audit.unshift({ id: VM.uid('a_'), at: VM.iso(), userId: u.id || '', user: u.name || 'Hệ thống', action, entity, ref, detail });
    if (state.audit.length > 3000) state.audit.length = 3000;
  }

  // ---------- codes ----------
  function nextCode(prefix, width = 4, peek = false) {
    const key = VM.ymd().replace(/-/g, '');
    const k = prefix + key;
    const n = (state.seq[k] || 0) + 1;
    if (!peek) state.seq[k] = n;
    return { key, n: VM.pad(n, width) };
  }
  const orderCode = (peek) => { const c = nextCode('ORD', 4, peek); return `ORD-${c.key}-${state.settings.counter || 'Q1'}-${c.n}`; };
  const loanCode = (peek) => { const c = nextCode('VAY', 3, peek); return `VAY-${c.key}-${c.n}`; };

  // ---------- domain helpers ----------
  const storeName = code => (state.settings.stores.find(s => s.code === code) || {}).name || code;
  const product = id => state.products.find(p => p.id === id);
  const baseUnit = p => p.units.reduce((a, b) => (a.factor <= b.factor ? a : b), p.units[0]);
  function stockText(p) {
    const big = p.units.reduce((a, b) => (a.factor >= b.factor ? a : b), p.units[0]);
    const base = baseUnit(p);
    if (big.factor > 1 && p.stock >= big.factor) {
      const whole = Math.floor(p.stock / big.factor), rest = p.stock % big.factor;
      return `${VM.num(whole)} ${big.name.toLowerCase()}` + (rest ? ` + ${VM.num(rest)} ${base.name.toLowerCase()}` : '');
    }
    return `${VM.num(p.stock)} ${base.name.toLowerCase()}`;
  }
  function productIssue(p) {
    if (!p.active) return { level: 'bad', text: 'Ngừng bán' };
    const d = VM.daysUntil(p.expiry);
    if (d < 0) return { level: 'bad', text: 'Hết hạn' };
    if (p.stock <= 0) return { level: 'bad', text: 'Hết hàng' };
    if (d <= state.settings.expiryWarnDays) return { level: 'warn', text: `HSD còn ${d} ngày` };
    if (p.stock <= (p.minStock || 0)) return { level: 'warn', text: 'Sắp hết' };
    return null;
  }
  const sellable = p => p.active && p.stock > 0 && VM.daysUntil(p.expiry) >= 0;

  // Quét mã: mã hàng, mã SAP, GTIN/EAN hoặc GS1 DataMatrix (kèm lô + HSD) → { product, gs1 }
  function matchScan(raw) {
    const c = String(raw || '').trim();
    if (!c) return null;
    const g = VM.gs1(c);
    const key = VM.gtinKey(g ? g.gtin : (/^\d{8,14}$/.test(c) ? c : ''));
    const lc = c.toLowerCase();
    const p = (key && state.products.find(x => x.gtin && VM.gtinKey(x.gtin) === key))
      || state.products.find(x => [x.code, x.sap].some(v => v && v.toLowerCase() === lc))
      || (!g && state.products.find(x => [x.code, x.sap].some(v => v && v.length >= 5 && lc.includes(v.toLowerCase()))));
    return p || g ? { product: p || null, gs1: g } : null;
  }

  // Tần suất bán 60 ngày gần nhất (đếm số đơn có mặt hàng) – dùng để ưu tiên gợi ý
  let freqCache = { rev: -1, map: {} };
  function productFreq() {
    if (freqCache.rev === state.meta.rev) return freqCache.map;
    const since = Date.now() - 60 * 864e5, map = {};
    state.sales.forEach(s => { if (s.status === 'cancelled' || new Date(s.createdAt) < since) return; s.items.forEach(i => { if (i.productId) map[i.productId] = (map[i.productId] || 0) + 1; }); });
    freqCache = { rev: state.meta.rev, map };
    return map;
  }
  const topProducts = (n = 8) => { const f = productFreq(); return state.products.filter(p => sellable(p) && f[p.id]).sort((a, b) => f[b.id] - f[a.id]).slice(0, n); };
  // Tên người hay xuất hiện trong sổ vay (người vay + người cho vay), kèm danh sách nhân viên
  function peopleFreq() {
    const m = {};
    state.staff.forEach(s => { m[s.name] = (m[s.name] || 0) + 0.5; });
    const seen = new Set();
    state.loans.forEach(l => { const g = loanGroup(l); if (seen.has(g)) return; seen.add(g); [l.borrower, l.lender].forEach(n => { if (n) m[n] = (m[n] || 0) + 1 + (VM.hoursSince(l.createdAt) < 24 * 14 ? 1 : 0); }); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  }

  function loanStatus(l) {
    if (l.cancelled) return 'cancelled';
    const returned = VM.sum(l.returns || [], r => r.qty);
    if (returned >= l.qty) return 'settled';
    if (returned > 0) return 'partial';
    if (!l.confirmedAt) return 'pending';
    return 'open';
  }
  const loanRemaining = l => Math.max(0, l.qty - VM.sum(l.returns || [], r => r.qty));
  // Sổ vay chỉ dùng 2 kho của Khoa Dược: Nhà thuốc Y001 và Kho nội trú Y003
  const LOAN_STORES = ['Y001', 'Y003'];
  const loanStores = () => LOAN_STORES.map(code => state.settings.stores.find(s => s.code === code) || { code, name: code === 'Y001' ? 'Nhà thuốc (ngoại trú)' : 'Kho thuốc nội trú' });
  const loanOverdue = l => ['open', 'pending', 'partial'].includes(loanStatus(l)) && VM.hoursSince(l.createdAt) > state.settings.loanOverdueHours;
  // ---- Mã vay: gom các dòng thuốc cùng `group` (dữ liệu cũ chưa có group → mỗi phiếu là 1 mã vay) ----
  const loanGroup = l => l.group || l.code;
  function voucherStatus(lines) {
    const act = lines.filter(l => !l.cancelled);
    if (!act.length) return 'cancelled';
    const st = act.map(loanStatus);
    if (st.every(x => x === 'settled')) return 'settled';
    if (st.some(x => x === 'settled' || x === 'partial')) return 'partial';
    if (st.some(x => x === 'pending')) return 'pending';
    return 'open';
  }
  function loanVouchers(list = state.loans) {
    const m = new Map();
    list.forEach(l => { const g = loanGroup(l); if (!m.has(g)) m.set(g, []); m.get(g).push(l); });
    return [...m.entries()].map(([code, lines]) => {
      lines.sort((a, b) => (a.line || 0) - (b.line || 0));
      const h = lines[0];
      return { code, lines, createdAt: h.createdAt, createdBy: h.createdBy, from: h.from, to: h.to, borrower: h.borrower, lender: h.lender, confirmedAt: lines.every(l => l.confirmedAt || l.cancelled) ? h.confirmedAt : '', confirmedBy: h.confirmedBy, status: voucherStatus(lines), overdue: lines.some(loanOverdue), demo: h.demo };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const voucherOpen = v => ['pending', 'open', 'partial'].includes(v.status);

  const INVOICE_STATUS = {
    no_invoice: { label: 'Hàng về – chưa có HĐ', cls: 'bad', step: 0 },
    received: { label: 'Đã nhận HĐ', cls: 'warn', step: 1 },
    handed: { label: 'Đã bàn giao NVD', cls: 'info', step: 2 },
    entered: { label: 'Đã nhập hệ thống', cls: 'ok', step: 3 },
    cancelled: { label: 'Đã hủy', cls: '', step: -1 },
  };
  const invoiceOverdue = inv => (inv.status === 'no_invoice' || inv.status === 'received') && VM.daysUntil(inv.receivedAt) < -state.settings.invoiceAlertDays;

  load();

  VM.store = {
    get state() { return state; }, save, replace, onChange, log, currentUser, setUser, isAdmin, seedState,
    orderCode, loanCode, storeName, product, baseUnit, stockText, productIssue, sellable, matchScan, productFreq, topProducts, peopleFreq,
    loanStatus, loanRemaining, loanOverdue, loanStores, LOAN_STORES, loanGroup, loanVouchers, voucherStatus, voucherOpen, calcInvoice, invoiceOverdue,
    CATEGORIES, catOf, INVOICE_STATUS, KEY, SCHEMA, get saveErr() { return saveErr; },
  };
})(window.VM);
