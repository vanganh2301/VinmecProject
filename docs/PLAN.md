# KẾ HOẠCH TRIỂN KHAI – VINMEC PHARMACY HUB

> Web tích hợp **Bán lẻ thuốc không kê đơn & vật tư y tế** + **Số hóa Sổ vay thuốc** + **Số hóa Sổ hóa đơn**, có **sao lưu / khôi phục**.
> Đầu vào: [Khaosat.md](Khaosat.md) · [PRD_Vinmec_Retail_Pharmacy.md](PRD_Vinmec_Retail_Pharmacy.md) · prototype cũ [legacy/vinmec_retail_pharmacy.html](../legacy/vinmec_retail_pharmacy.html)
> Phiên bản: v1.0 · 17/11/2026

---

## 1. Mục tiêu & thước đo

| Mục tiêu | Thước đo thành công | Hiện trạng (khảo sát) |
|---|---|---|
| 100% giao dịch bán lẻ được ghi nhận | Số đơn trên hệ thống = số lượt bán thực tế; 0 ca "bán nhớ giá không trừ tồn" | Lệch 117/273 mã |
| Bán nhanh giờ cao điểm | Tạo đơn OTC ≤ 60 giây (≤ 5 chạm sau khi tìm thấy thuốc) | 5–18 phút/khách (gồm tư vấn) |
| Không quên gạch sổ vay | 0 phiếu vay mở > 24 giờ mà không có cảnh báo | ~10 lượt vay/ngày, sổ giấy 2 nơi |
| Không thất lạc hóa đơn | 100% hóa đơn có trạng thái bàn giao; cảnh báo "hàng về chưa có HĐ" | Mất HĐ, kệ thừa thuốc |
| Không mất dữ liệu | Tự động snapshot; khôi phục được trong < 1 phút | — |

---

## 2. Người dùng & phân quyền

| Vai trò | Dùng chủ yếu | Quyền |
|---|---|---|
| **Dược sĩ nhà thuốc** | Bán lẻ, Sổ vay, nhận hóa đơn | Bán, ghi/xác nhận/gạch sổ vay, ghi sổ HĐ |
| **Dược sĩ kho** | Sổ vay, Sổ hóa đơn | Ghi/xác nhận/gạch sổ vay, ghi sổ HĐ |
| **Quản lý / Trưởng khoa** | Tổng quan, Lịch sử, Danh mục, Cài đặt | Toàn quyền + sửa giá, hủy đơn, khôi phục dữ liệu |

> MVP: đăng nhập chọn tài khoản (không mật khẩu – môi trường demo). Bản thật: SSO bệnh viện.

---

## 3. Kiến trúc thông tin – điều hướng ở **thanh bên trái**

```
┌───────────────┬──────────────────────────────────────────────┐
│ ✚ Pharmacy Hub│  Tiêu đề trang · breadcrumb      [Hành động]  │
│───────────────│──────────────────────────────────────────────│
│ TỔNG QUAN     │                                              │
│  ▣ Tổng quan  │                                              │
│ BÁN LẺ        │              NỘI DUNG MODULE                 │
│  🛒 Bán hàng   │                                              │
│  🧾 Lịch sử    │                                              │
│  📦 Danh mục   │                                              │
│ SỔ SỐ HÓA     │                                              │
│  ⇄ Sổ vay  (3)│                                              │
│  📄 Sổ hóa đơn │                                              │
│ HỆ THỐNG      │                                              │
│  🛡 Sao lưu    │                                              │
│  ⚙ Cài đặt    │                                              │
│───────────────│                                              │
│ ● Đã sao lưu  │                                              │
│ 👤 DS. A  ⏻   │                                              │
└───────────────┴──────────────────────────────────────────────┘
```
- Desktop ≥ 1200px: sidebar 248px, thu gọn còn 72px (chỉ icon + tooltip).
- Tablet 768–1199px: mặc định thu gọn.
- Mobile < 768px: sidebar thành ngăn kéo (drawer) mở bằng nút ☰.
- Badge số trên menu: phiếu vay đang mở, hóa đơn chờ xử lý.

---

## 4. Hệ thống thiết kế (Medical modern)

| Token | Giá trị | Dùng cho |
|---|---|---|
| Primary | `#0B7A75` (teal y tế) / hover `#096660` / nền nhạt `#E6F4F2` | Nút chính, menu đang chọn |
| Info | `#1D6FD8` | Liên kết, thông tin |
| Success / Warning / Danger | `#15803D` / `#B45309` / `#C2410C`→`#DC2626` | Trạng thái (luôn kèm icon + chữ) |
| OTC / TPCN / Vật tư | xanh lá / cam / tím | Nhãn nhóm hàng (theo PRD) |
| Nền / Bề mặt / Viền | `#F3F6F8` / `#FFFFFF` / `#E2E8EE` | |
| Chữ | `#0F2433` / phụ `#5B6B7A` | |
| Font | **Be Vietnam Pro** (fallback hệ thống) | Hỗ trợ tiếng Việt tốt |
| Bo góc | 10px (input, nút) · 14px (thẻ) · 999px (pill) | |
| Vùng chạm | **≥ 44px** (nút chính 48px) | Tablet tại quầy |

**Nguyên tắc:**
1. **Một hành động chính mỗi màn hình** (nút teal đặc), hành động phụ dạng viền / ghost.
2. Nút luôn có **icon + nhãn**; nút chỉ có icon phải có tooltip & `aria-label`.
3. Trạng thái dùng **pill màu + icon + chữ**, không chỉ màu.
4. Cảnh báo **tại chỗ** (inline), hạn chế popup; popup chỉ cho thao tác không hoàn tác được.
5. Mọi thao tác xóa/hủy có **xác nhận** và **ghi nhật ký**; dữ liệu không xóa vật lý.
6. Phím tắt cho quầy: `F2`/`/` tìm thuốc, `F4` thanh toán, `Esc` đóng.
7. Trạng thái rỗng có hướng dẫn và nút hành động.

---

## 5. Cấu trúc Repo

```
VinmecProject/
├── README.md                     Hướng dẫn chạy & cấu trúc
├── docs/
│   ├── PLAN.md                   (file này)
│   ├── Khaosat.md                Tổng hợp khảo sát
│   └── PRD_Vinmec_Retail_Pharmacy.md
├── app/                          Web app (HTML/CSS/JS thuần, chạy offline)
│   ├── index.html                Khung: sidebar + vùng nội dung + icon sprite
│   ├── assets/css/app.css        Design tokens + component
│   └── assets/js/
│       ├── core/
│       │   ├── util.js           Định dạng, ngày, fuzzy search, escape
│       │   ├── store.js          Trạng thái, lưu localStorage, nhật ký, dữ liệu mẫu
│       │   ├── backup.js         Snapshot IndexedDB, xuất/nhập JSON, sao lưu thư mục
│       │   ├── xlsx.js           Ghi/đọc Excel (.xlsx) không cần thư viện
│       │   └── ui.js             Router, sidebar, toast, modal, xác nhận, icon
│       ├── modules/
│       │   ├── dashboard.js      Tổng quan
│       │   ├── pos.js            Bán hàng
│       │   ├── history.js        Lịch sử bán
│       │   ├── catalog.js        Danh mục hàng
│       │   ├── loans.js          Sổ vay thuốc
│       │   ├── invoices.js       Sổ hóa đơn
│       │   ├── backup-view.js    Sao lưu & khôi phục, nhật ký
│       │   └── settings.js       Cài đặt
│       └── app.js                Khởi động, đăng nhập
└── legacy/
    └── vinmec_retail_pharmacy.html   Prototype cũ (tham chiếu)
```

**Lý do chọn HTML/JS thuần (không build):** chạy được ngay trên máy quầy bằng cách mở file, không cần cài Node/server, không phụ thuộc mạng (trừ QR VietQR & font). Khi lên bản thật sẽ chuyển sang backend (xem Phase 3).

---

## 6. Đặc tả module

### 6.1. Tổng quan (Dashboard)
- KPI: Đơn hôm nay · Doanh thu hôm nay · Phiếu vay đang mở (quá hạn) · Hóa đơn chờ xử lý.
- Biểu đồ **lượt khách theo giờ** (7h–21h, cao điểm 11–13h được đánh dấu) – hôm nay / 7 ngày / 30 ngày.
- **Bán chạy** theo tuần / tháng (thanh ngang, 1 màu).
- **Cần chú ý:** sắp hết hàng, sắp hết hạn (≤ 90 ngày), vay quá hạn, hàng về chưa có HĐ, chưa sao lưu.

### 6.2. Bán hàng (POS)
- Tiêu đề "Vinmec Pharmacy". Nút trên cùng: Thêm hàng mới (ngoài danh mục), Báo cáo trong ngày (Excel), Đơn mới (F9). Thiết kế tối giản: mã đơn, mã hàng, tồn, lô/HSD chỉ hiện khi bấm "Hiển thị tất cả".
- Trái: tab Thuốc / TPCN / Vật tư / Khác, ô "Tìm kiếm" **fuzzy** (không dấu, sai chính tả, mã SAP; máy quét mã vạch → Enter thêm ngay), nhập bằng giọng nói; danh sách hàng mỗi dòng: nhóm, tên, cảnh báo hết hàng/cận hạn, giá/ĐVT. Chọn bằng chuột hoặc ↑ ↓ Enter.
- Phải (cố định): giỏ hàng thấy 6–7 mặt hàng không cần cuộn – đổi **ĐVT có hệ số quy đổi** (viên/vỉ/hộp), +/- số lượng, cảnh báo vượt tồn tại dòng, đơn giá theo Danh mục (không sửa tại quầy, bỏ 19/11/2026), hàng đặc biệt (ĐVT mặc định Viên) (tên người bán); khách/PID (không bắt buộc) trong mục gập; tổng tiền và 2 nút thanh toán ngay dưới giỏ.
- Thanh toán: **QR (VietQR, có mã đơn trong nội dung)** hoặc **Tiền mặt** (nhập tiền khách đưa → tiền thối, nút mệnh giá nhanh). Xác nhận → lưu đơn, trừ tồn, in phiếu.
- Quy tắc: không bán hàng hết hạn / hết tồn / ngừng bán; chống bấm xác nhận 2 lần; nháp giỏ hàng tự lưu.

### 6.3. Lịch sử bán
- Lọc: từ khóa (mã đơn, tên/mã thuốc, khách), khoảng ngày, người bán, hình thức TT, trạng thái đối soát.
- Chi tiết đơn, in lại phiếu, **hủy đơn** (lý do, hoàn tồn, nhật ký).
- Đánh dấu **đã nhập OH/SAP** (hàng loạt). Xuất Excel 3 sheet: Tổng hợp / Chi tiết / Chờ đối soát.

### 6.4. Danh mục hàng
- Phân loại 4 nhóm: Thuốc OTC, Thực phẩm chức năng, Vật tư y tế, Khác (tab trên đầu bảng). Thanh này dùng chung với màn Bán hàng. (Nút "Hay bán" đã bỏ ngày 18/11/2026 vì khoa thấy không cần.)
- Mặc định bảng chỉ hiện cột cần thiết; Hàm lượng, Kho, Số lô hiện khi bấm "Hiển thị tất cả".
- Bảng theo đúng 10 trường của file mẫu khoa: Mã hàng, Tên hàng, Nhóm hàng, Hàm lượng, Kho, Đơn vị tính, Giá bán, Số lượng tồn, Hạn sử dụng, Số lô. Mỗi mặt hàng một dòng, không cuộn ngang; bảng hẹp thì tự ẩn cột phụ.
- Thêm / sửa / ngừng bán (không xóa nếu đã phát sinh giao dịch), điều chỉnh tồn (lý do). Form thêm chỉ 10 trường trên; mã SAP, mã vạch, hoạt chất, quy đổi Vỉ/Hộp, tồn tối thiểu để trong "Thông tin thêm".
- Nhập Excel/CSV (kiểm tra hợp lệ, xem trước, cập nhật theo mã), xuất Excel, tải file mẫu `Vinmec_MauNhap_DanhMuc.xlsx` (10 cột).

### 6.5. ⭐ Sổ vay thuốc
**Luồng TO-BE:**
```
Màn đầu: "Tạo mã vay mới" + danh sách theo MÃ VAY (mỗi mã vay: bao nhiêu thuốc, SL, ai vay – ai cho vay)
Tạo mã vay: quét mã thuốc → nhập SL → quét thuốc tiếp… (nhiều thuốc / 1 mã vay)
  → "Hoàn thành vay thuốc" → ghi người vay, người cho vay → Lưu     ← 1 người, 1 nơi
  → Thông số (mã SAP, lô, HSD, ghi chú) + lịch sử từng thuốc: chỉ ở trang chi tiết mã vay
  → Bên cho vay bấm "Xác nhận đã giao"                              ← thay việc hỏi lại "đã ghi sổ chưa"
  → Xuất file cho tool điều chuyển SAP (Mã SAP/Tên/SL/Kho xuất/Kho nhận/LOT/DATE/plans/Funds center)
  → Điều chuyển xong: "Gạch sổ" + số chứng từ SAP (cho phép từng phần)
  → Cảnh báo phiếu mở quá N giờ (mặc định 24h) trên menu & Tổng quan
```
**Trường:** Mã vay (gồm nhiều thuốc) · Thời gian · Bên cho vay → Bên vay (chỉ 2 kho của Khoa Dược: Y001 ↔ Y003; HO2 là kho của toàn bệnh viện nên không dùng) · Thuốc (mã, mã SAP, tên) · ĐVT (tự lấy ĐVT nhỏ nhất theo danh mục, dược sĩ không phải chọn) · SL · Lô · HSD · Người vay · Người cho vay · Ghi chú · Xác nhận (người, giờ) · Lịch sử gạch sổ (SL, số CT SAP, người, giờ) · Trạng thái: *Chờ xác nhận / Đang mở / Gạch một phần / Đã gạch / Đã hủy*.
**Tiện ích:** thuốc ngoài danh mục bán lẻ vẫn ghi được (nhập tay), gợi ý tên người, in sổ A4 có cột ký, xuất Excel.
**Thống kê vay thuốc (dự báo nhu cầu):** thuốc vay thường xuyên theo ngày / tuần / tháng, lọc chiều vay (Nhà thuốc vay / Kho nội trú vay) · lượt vay, tổng SL (ĐVT nhỏ nhất), số kỳ có vay, xu hướng · **dự báo kỳ tới** = 60% TB 1/3 số kỳ gần nhất + 40% TB cả khoảng (kỳ hiện tại không tính), so với tồn nhà thuốc · biểu đồ theo kỳ (tổng hoặc từng thuốc) · xuất Excel để gửi dự trù.

### 6.6. ⭐ Sổ hóa đơn
**Luồng TO-BE:**
```
Quét mã QR trên HĐ / gõ số HĐ (bước 1, kiểm tra trùng ngay) → mở các ô còn lại → ghi sổ (có thể "chưa có HĐ")  → Nhận HĐ tại nhà thuốc/kho
  → Bàn giao NVD (người, giờ) → Đã nhập OH/SAP (người, giờ)
```
**Trường sổ:** Sổ (Ngoại trú / Nội trú) · Ngày nhận hàng · NCC · Số HĐ · Ngày HĐ · Số tham chiếu · Số PR/PO · Số khoản · Người nhận hàng · Nhà thuốc nhận HĐ · NVD nhận HĐ · Tổng tiền trước thuế / Thuế / Thanh toán · Ghi chú.
**Chi tiết dòng (tùy chọn):** Mã hàng · Tên hàng (quy cách) · Nước SX · Lô · HSD · ĐVT · SL · Đơn giá · CK % · Thuế suất (0/5/8/10%) · Thành tiền → tự tính số khoản, tổng, **bảng tổng hợp thuế theo mức**.
**Copy quyết toán trong ngày:** một lần copy 3 trường (Ngày hàng về · SL hàng tổng đã về · Số hóa đơn) của mọi hóa đơn trong ngày, dán theo dòng hoặc theo cột vào file quyết toán; xem trước trước khi copy.
**Kiểm tra:** trùng (NCC + Số HĐ) · đơn giá lệch danh mục > 5% → nhãn "Hỏi QLD" · HSD < 6 tháng → cảnh báo · hàng về chưa có HĐ > 2 ngày → cảnh báo.

### 6.7. Sao lưu & khôi phục (Backup)
| Lớp | Cơ chế | Khi nào |
|---|---|---|
| 1. Lưu tức thì | `localStorage` sau mỗi thao tác; đồng bộ giữa các tab | Mọi thay đổi |
| 2. Snapshot tự động | IndexedDB, giữ **30 bản gần nhất** | Mỗi 15 phút nếu có thay đổi, khi mở app, **trước mọi thao tác khôi phục/nhập/xóa dữ liệu** |
| 3. Sao lưu ra thư mục | File System Access API (Chrome/Edge) ghi `vinmec-backup-YYYY-MM-DD.json` vào thư mục chọn (vd. ổ mạng khoa) | Tự động mỗi lần snapshot |
| 4. Tải về thủ công | File `.json` (toàn bộ) + Excel (từng sổ) | Theo nhu cầu; nhắc nếu > 24h chưa tải |

Khôi phục: chọn snapshot/file → xem trước số bản ghi → xác nhận → tự snapshot trạng thái hiện tại trước khi ghi đè. File sao lưu có `schemaVersion` + checksum để phát hiện file hỏng.

### 6.8. Nhật ký thao tác (Audit log)
Ghi: thời gian, người, hành động, đối tượng, chi tiết (bán, hủy, sửa giá, ghi/gạch sổ vay, ghi/bàn giao HĐ, nhập Excel, khôi phục). Phục vụ truy vết khi lệch kho.

---

## 7. Lộ trình

### Phase 1 – MVP (tuần 1–2) ✅ *đã dựng trong repo này*
- [x] Khung repo, tài liệu Khaosat, PLAN
- [x] Layout sidebar trái, design system y tế, responsive
- [x] POS: fuzzy search, ĐVT quy đổi, giỏ hàng, QR/tiền mặt, in phiếu, giọng nói
- [x] Lịch sử, hủy đơn, đối soát, xuất Excel
- [x] Danh mục: CRUD, nhập/xuất Excel
- [x] Sổ vay: ghi, xác nhận, gạch từng phần, cảnh báo, xuất file điều chuyển, in
- [x] Sổ hóa đơn: 2 sổ, chuỗi bàn giao, chi tiết dòng + thuế, kiểm tra trùng/lệch giá
- [x] Sao lưu 4 lớp + nhật ký thao tác

### Phase 2 – Thử nghiệm tại khoa (tuần 3–4)
- [ ] Chạy song song sổ giấy 1 tuần tại Nhà thuốc OPC2 & Kho, đo: thời gian ghi sổ, số phiếu quên gạch, số HĐ thất lạc
- [ ] Chốt định dạng file tool điều chuyển với DS kho (plans, Funds center)
- [ ] Quét QR bằng camera tablet, chụp ảnh hóa đơn đính kèm
- [ ] Phân quyền theo vai trò, mã PIN khi đổi ca

### Phase 3 – Tích hợp (sau thử nghiệm, cần IT bệnh viện duyệt)
- [ ] Backend + CSDL tập trung (mã đơn duy nhất đa thiết bị), SSO
- [ ] Đồng bộ danh mục/giá từ OH; đẩy giao dịch/điều chuyển sang SAP (API hoặc file chuẩn)
- [ ] Dự trù mua hàng theo tốc độ tiêu thụ; phiếu xuất kho với Khoa Gây mê; hỗ trợ kiểm kê theo LOT

---

## 8. Kiểm thử chấp nhận (rút gọn)
- [ ] Gõ `paracatamol` ra Paracetamol; quét mã `SAP001` + Enter thêm vào giỏ.
- [ ] Đổi Hộp → Viên tự đổi giá; SL vượt tồn hiện cảnh báo, không cho thanh toán.
- [ ] Tiền mặt 100.000 cho đơn 57.000 → tiền thối 43.000; bấm xác nhận 2 lần chỉ tạo 1 đơn.
- [ ] Hủy đơn → tồn hoàn lại, nhật ký ghi lý do.
- [ ] Ghi phiếu vay → menu hiện badge; gạch 2/5 → "Gạch một phần", còn 3; gạch nốt → "Đã gạch".
- [ ] Phiếu mở > 24h → nhãn "Quá hạn" + xuất hiện ở Tổng quan.
- [ ] Hóa đơn trùng NCC + số HĐ → cảnh báo; nhập dòng 5% & 10% → bảng thuế đúng.
- [ ] Tải sao lưu → xóa dữ liệu → khôi phục từ file → dữ liệu như cũ.
- [ ] Giao diện dùng được ở 375px, 768px, 1440px; điều hướng bằng bàn phím.

---

## 9. Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Dữ liệu chỉ nằm trên 1 trình duyệt | Snapshot + sao lưu thư mục mạng + nhắc tải; Phase 3 chuyển CSDL tập trung |
| Hai máy cùng sinh mã đơn trùng | Mã đơn gắn mã máy/quầy (cài đặt); Phase 3 cấp mã từ server |
| Nhân viên ngại đổi thói quen sổ giấy | Ghi phiếu ≤ 20 giây, in sổ A4 có chữ ký để song song giai đoạn đầu |
| Bảo mật dữ liệu bệnh viện | Không gửi dữ liệu ra ngoài (trừ ảnh QR VietQR); không lưu thông tin bệnh nhân ngoài PID tùy chọn |

## 10. Câu hỏi cần xác nhận
Xem mục 6 của [Khaosat.md](Khaosat.md#6-câu-hỏi-còn-mở-cần-hỏi-lại-bệnh-viện).
