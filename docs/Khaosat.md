# KHẢO SÁT KHOA DƯỢC – VINMEC OPC2 (TỔNG HỢP)

> **Nguồn:** Google Doc "Khảo sát Vinmec OPC2" (nhật ký khảo sát 29/10 – 16/11/2026, các tab *Vàng*, *DAY 1–17*, *Duy / Day 01–16*).
> **Mục đích:** Lọc thông tin quan trọng nhất để làm đầu vào thiết kế hệ thống số hóa **Sổ vay thuốc**, **Sổ hóa đơn** và **Bán lẻ thuốc không kê đơn / vật tư y tế**.
> **Bảo mật:** Tên cá nhân trong bản gốc đã được thay bằng vai trò (DS kho, DS nhà thuốc, Trưởng khoa…) theo yêu cầu "phải xóa các thông tin mật" của bệnh viện.
> **Ngày tổng hợp:** 17/11/2026

---

## 0. Tóm tắt 1 trang (TL;DR)

| # | Phát hiện chính | Số liệu đo được | Hướng giải quyết trong dự án |
|---|---|---|---|
| 1 | Bán lẻ nhớ giá, bán ngay, **không nhập trừ tồn** trên OH → lệch kho, cuối tháng kế toán mới truy ra | Kiểm kê nhà thuốc 09/11: **273 mã, lệch 117 (~43%)**; truy nguyên nhân **7–8 ngày** | **Module Bán lẻ (POS)**: mọi giao dịch có mã đơn, người bán, giờ; xuất Excel đối soát SAP/OH |
| 2 | **Sổ vay thuốc giấy** giữa Nhà thuốc ↔ Kho: quên ghi, quên gạch sổ, phải hỏi lại nhau | ~**10 thuốc/ngày** nhà thuốc vay kho; điều chuyển 1 thuốc 3–5 phút, cân đối 15–20 phút/lần | **Module Sổ vay số**: ghi nhanh, xác nhận 2 bên, cảnh báo chưa gạch, xuất file cho tool điều chuyển SAP |
| 3 | **Sổ hóa đơn giấy**, mất hóa đơn, hàng về rồi nhưng **chưa nhập hóa đơn** → thuốc thừa trên kệ so với hệ thống | Nhập HĐ + ghi sổ ~**3 phút/lần** | **Module Sổ hóa đơn số**: theo dõi chuỗi bàn giao Người nhận hàng → Nhà thuốc → NVD → Đã nhập hệ thống |
| 4 | Kiểm kê thủ công, quét QR + đếm | 2–3 giờ quét/đếm (2 người); nội trú 3–4 giờ; + 3–4 giờ truy vết | Ngoài phạm vi MVP – dữ liệu từ 3 module trên giúp giảm nguyên nhân lệch |
| 5 | Giờ cao điểm 11h–13h, khách chờ lâu, có khách bỏ về | 50–70 khách/ngày; 5–18 phút/khách | POS tối ưu tốc độ: tìm gần đúng, phím tắt, QR/tiền mặt, giọng nói |

**Đề xuất trực tiếp của Trưởng khoa Dược (16/11):**
1. Hệ thống đơn giản cho **thuốc, vật tư bán cho khách lẻ / vãng lai** để tiết kiệm thời gian giờ cao điểm.
2. **Số hóa sổ vay**, dùng **QR mã thuốc** để nhập, thêm số lượng, người vay, người cho vay.
3. Hệ thống đề xuất mua thuốc dựa vào dữ liệu quá khứ *(giai đoạn sau)*.
4. Số hóa phiếu xuất kho với Khoa Gây mê, hiển thị trạng thái lấy thuốc *(giai đoạn sau)*.
5. Hỗ trợ kiểm kê thuốc *(giai đoạn sau)*.

---

## 1. Bối cảnh & thuật ngữ

### 1.1. Hệ thống đang dùng

| Hệ thống | Vai trò | Ghi nhận |
|---|---|---|
| **OH – OrionHealth** | Phần mềm bệnh viện: bác sĩ kê đơn, dược sĩ xem đơn, quản lý giá & thu tiền, bán thuốc cho khách lẻ | Khá nhanh nhưng thỉnh thoảng lag; "check tồn mỗi lần hiện 1 kiểu" |
| **SAP** | Kho, xuất – nhập – tồn, kế toán, ngân sách, PR/PO/STO | Hệ thống lâu đời, hay lag; trừ tồn từ OH sang SAP |
| **Tool Excel (VBA)** | Nhập tồn nhanh, điều chuyển nội viện sang SAP | Bị ngắt quãng, mỗi bước cần xác nhận 2 lần |
| **App kiểm kê** | Quét QR từng thuốc, cập nhật SL thực tế vs lý thuyết | Chỉ theo số lượng, **chưa chia theo LOT**; quy định up file 1 lần/tháng |

### 1.2. Kho & mã kho

| Mã | Ý nghĩa |
|---|---|
| **Y001** | Nhà thuốc (ngoại trú) |
| **Y003** | Kho thuốc (nội trú) |
| **HO2** | Kho thuốc Head Office |
| OPD / IPD | Ngoại trú / Nội trú – **giá thuốc 2 kho khác nhau** |
| Kho ký gửi (kho ảo) | Nhận hàng trước khi nhập kho thật; nguồn gây "thuốc ảo" |

### 1.3. Thuật ngữ

PID (mã bệnh nhân) · PR (Purchase Requisition) · PO (Purchase Order) · **STO (Stock Transport Order – dùng khi vay giữa chi nhánh)** · QLD (Quản lý dược) · NVD (Nghiệp vụ dược) · NCC (Nhà cung cấp) · LASA (Look-alike sound-alike) · Routine Fill / Initial Fill · Trần công nợ (tối đa **200 triệu/NCC**) · Ngân sách (vốn nhập thuốc).

### 1.4. Vai trò trong khoa

Trưởng khoa Dược · DS kho nội trú · DS nội trú · DS lâm sàng · DS hồ sơ (quản lý giá bán, danh mục) · DS nhà thuốc · Phụ trách mua hàng / QLD · Kế toán.

---

## 2. Quy trình hiện tại (AS-IS)

### 2.1. Bán thuốc cho khách lẻ (Nhà thuốc)
```
Khách lẻ → DS tìm mã sản phẩm trên OH → in đơn → khách thanh toán → OH trừ tồn → đồng bộ SAP
```
- Khách có đơn: DS xem đơn → chọn thuốc → kiểm tra tương tác (Google + hỏi BS/DS lâm sàng, **7–8 phút/3 thuốc**) → tư vấn → cấp phát → thanh toán → xuất hóa đơn (2–3 phút).
- Hoàn tiền: khách hoàn vào deposit để refund. **Thuốc kê đơn không được đổi.**
- Ship cho khách ở xa: xuất bảng kê phí ship; phối hợp Green SM – khách – nhà thuốc, 3–4 lượt/tuần, hay chờ shipper / khách không nghe máy.
- Sắp xếp: **Nhà thuốc theo nhóm dược lý**, Kho theo **A–Z**.

**Thời gian quan sát thực tế (10/11):** 4–18 phút/khách; khách nước ngoài thanh toán thẻ lỗi 20 phút; vừa kiểm kê vừa bán → 1 khách bỏ về; 1 khách mang 4–7 loại giấy tờ.

### 2.2. Sổ vay thuốc (Nhà thuốc ↔ Kho)
```
Nhà thuốc hết thuốc → sang Kho vay (hoặc ngược lại) → GHI SỔ GIẤY ở cả 2 bên
   → (sau đó) điều chuyển trên SAP bằng tool Excel → trưởng khoa duyệt → GẠCH SỔ
```
- Hai bên ghi sổ riêng → mất thời gian **hỏi lại "đã ghi sổ chưa"**, xác nhận người vay.
- Đã điều chuyển ngay thì **không cần ghi sổ**; chưa điều chuyển thì ghi, **gạch khi đã điều chuyển trên SAP**.
- Khi cân kho: điều chuyển xong mới clear sổ, **đếm lại** trước khi tìm nguyên nhân.
- Kho vay nhà thuốc **thuốc lẻ theo viên** → dễ nhầm.
- Vay giữa chi nhánh: giống đặt hàng nhưng tạo **STO** thay vì PO.

**Lý do không điều chuyển ngay:** gấp; người mới không biết cách điều chuyển. **Lý do lệch kho:** quên ghi sổ; khoa không trả thuốc thừa; phát thừa/thiếu cho khách; cùng hoạt chất khác hàm lượng nên phát nhầm.

**Quy trình điều chuyển trên SAP (5 bước):**
1. Lấy **mã SAP** trong Excel theo tên thuốc
2. Lấy **mã LOT** trên OH, kiểm tra số lượng theo lô
3. Ghi 2 mã vào tool Excel → **RUN**
4. Duyệt trong SAP bằng tài khoản trưởng khoa
5. "Duyệt bằng tay" trên VBA để hoàn tất

### 2.3. Sổ hóa đơn (nhập hàng)
```
Trưởng khoa tạo PR → BLĐ/GĐ duyệt → GĐ khối Dược duyệt → QLD làm PO, đặt hàng
   → Lô mới về → nhập file Excel quyết toán → nhập hóa đơn + tồn kho bằng tool → GHI SỔ HÓA ĐƠN
```
- Đơn đặt hàng chưa có số HĐ, chỉ có tên đơn / giá / NCC. **Sai khác giá → hỏi QLD.**
- Khi HĐ về nhập tay: Số HĐ / Số lô / Hạn dùng / Ngày HĐ / Tổng tiền.
- Vấn đề: **mất hóa đơn**; **hàng về nhưng chưa nhập HĐ** → thuốc thừa trên kệ so với hệ thống; NCC giao trước khi GĐ duyệt PO; đặt 40 về 30 → điều chỉnh tiền file quyết toán thế nào chưa rõ; lọ nhiều viên NCC đóng thừa/thiếu phải giải trình.
- Có 2 sổ: **Sổ ngoại trú** và **Sổ nội trú** (cùng cấu trúc). Sổ ngoại trú **bổ sung trường "Nhà thuốc nhận HĐ"** (DS nhà thuốc nhận hàng trên kho).

### 2.4. Kiểm kê
```
Cầm app quét QR → xuất Excel → so On-hand 2 kho với tổng kiểm kê
   → khớp tổng 2 kho: điều chuyển cân đối | không khớp: tra từng thuốc, xem camera → giải trình
```
- Quét + đếm 2–3 giờ (2 người); nội trú (nhiều tiêm truyền) 3–4 giờ; 59 mã ≈ 30 phút; cân kho ~17 phút; điều chuyển 1 mã ~5 phút.
- Tăng/giảm kiểm kê **phải giải trình**, không giải trình bị phạt.
- Thuốc hay sai: vỉ (thiếu), viên lẻ trong lọ, thuốc giảm đau cùng tên khác hàm lượng.

### 2.5. Cấp phát nội trú, tủ trực, phiếu xuất kho
- Phát thuốc 1 lần/ngày, mốc 12h trưa; BN ra viện còn thuốc → **phiếu trả thuốc**, fill lại kệ (~30 phút, 1–2 lần/tuần).
- Tủ trực: 17h người trực làm phiếu xuất, ca tối chuẩn bị thuốc. Phiếu xuất 17 thuốc ≈ 12 phút chuẩn bị.
- Thuốc hướng thần: in phiếu, **4 người duyệt** (người gửi, 2 trưởng khoa, bác sĩ), kiểm soát vỏ & thuốc dư.
- Khoa Gây mê gửi đơn qua Teams → mong muốn app hiển thị trạng thái lấy thuốc.

---

## 3. Điểm nghẽn (Pain points) – xếp theo mức ưu tiên

| Ưu tiên | Điểm nghẽn | Bằng chứng | Module giải quyết |
|---|---|---|---|
| **P0** | Bán lẻ không ghi nhận / không trừ tồn kịp | Ca Efferalgan 11k/5 viên chỉ phát hiện cuối tháng; thiếu 4 viên Tamiflu không rõ nguyên nhân | Bán lẻ (POS) + Lịch sử + Xuất đối soát |
| **P0** | Sổ vay giấy: quên ghi, quên gạch, ghi 2 nơi | ~10 lượt vay/ngày; "đỡ quên gạch sổ", "tiện đi giữa 2 kho" | Sổ vay số |
| **P0** | Hóa đơn: mất HĐ, hàng về chưa nhập HĐ | Kệ thừa thuốc so với hệ thống | Sổ hóa đơn số |
| P1 | Giờ cao điểm 11–13h, khách chờ lâu | 50–70 khách/ngày, tới 18 phút/khách | POS tối ưu tốc độ |
| P1 | Lệch kho lớn, truy vết lâu | 117/273 mã lệch; 7–8 ngày tìm nguyên nhân | Nhật ký thao tác + dữ liệu 3 module |
| P2 | Kiểm kê thủ công, app chưa theo LOT | 2–4 giờ/lần + truy vết | Giai đoạn sau |
| P2 | Đặt hàng: NCC giao thiếu/trễ, thuốc ít dùng hay hết đột xuất | Đặt 10 ngày vẫn thiếu | Giai đoạn sau (dự trù) |
| P2 | Tra tương tác thuốc thủ công | 7–8 phút/3 thuốc | Ngoài phạm vi (cần DS lâm sàng) |

---

## 4. Trường dữ liệu đã thu thập (dùng để thiết kế)

### 4.1. ⭐ Sổ vay thuốc
| Trường (bản gốc) | Kiểu | Ghi chú thiết kế |
|---|---|---|
| Ngày / tháng / năm | datetime | Tự điền giờ hiện tại |
| Tên thuốc / sản phẩm | text | Chọn từ danh mục hoặc **quét QR** |
| Đơn vị tính | text | Kho vay lẻ theo **viên** → hiển thị ĐVT nổi bật |
| Số lượng | number | > 0 |
| Người vay | text | |
| Người cho vay | text | |
| Ghi chú | text | |
| *(bổ sung)* Bên vay / Bên cho vay | Y001 / Y003 / HO2 | |
| *(bổ sung)* Mã SAP, LOT, Hạn dùng | text/date | Cần cho tool điều chuyển |
| *(bổ sung)* Trạng thái gạch sổ | enum | Gạch khi đã điều chuyển SAP |

### 4.2. ⭐ Tool điều chuyển nội viện (đầu ra cần xuất cho SAP)
`Mã SAP | Tên | Số lượng | Kho xuất | Kho nhận | LOT | DATE | plans | Funds center`
*(plans, Funds center: dạng số – cần hỏi lại ý nghĩa.)*

### 4.3. ⭐ Sổ hóa đơn (ngoại trú & nội trú)
`Ngày | NCC | Số hóa đơn | Số khoản (số thuốc) | Người nhận hàng | Nhà thuốc nhận HĐ | NVD nhận hóa đơn | Ghi chú`

### 4.4. ⭐ Hóa đơn GTGT (chi tiết dòng)
- **Mẫu 1:** STT / Mã hàng / Tên hàng hóa, dịch vụ (quy cách) / Nước SX / Số lô / Hạn dùng / ĐVT / Số lượng / Đơn giá trước CK / Chiết khấu / Đơn giá sau CK / Thành tiền / Thuế suất / Thuế GTGT / Số tiền thanh toán
- **Mẫu 2:** STT / Tên hàng / ĐVT / SL / Đơn giá / Thành tiền / % CK / Số lô / Hạn dùng → Tiền chưa CK TM, CK TM, CK bổ sung, Thuế GTGT, Cộng tiền gồm thuế, Trừ KM, **Tổng thanh toán**
- **Bảng tổng hợp thuế:** theo mức **5% / 8% / 10%** – Trị giá chưa thuế / Tiền thuế / Trị giá thanh toán
- **Thông tin đầu HĐ:** Số tham chiếu (10 số), Họ tên người mua, Tên đơn vị, Địa chỉ, MST, Mã định danh/CCCD, Mã KH, Mã ĐVQHNS

### 4.5. File quyết toán (mua hàng)
`Ngày dự trù | Số PR | Mã OH | NCC | Tên thuốc | ĐVT | SL dự trù | Đơn giá chưa VAT | SL quy ra hộp | SL đã về | Hàng chưa về | Ngày hàng về | Số hóa đơn | QLD gửi | Ngày QLD đặt hàng`

### 4.6. ⭐ Bán lẻ (yêu cầu DAY 17)
- **Màn 1:** Đăng nhập; biểu đồ khách lẻ theo giờ; bảng thuốc bán chạy theo tuần/tháng; mã đơn đổi khi tạo đơn mới.
- **Màn 2:** Tìm tên thuốc (**fuzzy search**) → Mã / Tên / Kho / ĐVT / Giá / SL tồn / HSD (+ ảnh). **Chỉ OTC, TPCN, vật tư y tế.** Thêm/sửa/xóa, upload Excel.
- **Màn 3:** Nhập theo nhu cầu khách: giá, ĐVT (hộp, chai, lọ, ống), số lượng; hàng hóa đặc biệt (tên người bán).
- **Màn 4:** QR chuyển khoản hiện số tiền; nút "Tiền mặt".
- **Màn 5:** Lưu lịch sử: tài khoản/người bán, mã đơn, tên/mã thuốc, giờ mua, SL, giá…
- Bổ sung: speech-to-text, **xuất Excel**, script SAP, **tích hợp sổ vay kho – nhà thuốc**, dự trù (tồn, hàng chưa về, tốc độ hết thuốc).

### 4.7. Các biểu mẫu khác (tham khảo giai đoạn sau)
| Biểu mẫu | Trường |
|---|---|
| App kiểm kê (xuất) | Mã thuốc, Tên, ĐVT, SL lý thuyết, SL thực tế, Chênh lệch, HSD lý thuyết, HSD thực tế, Trạng thái, Người kiểm kê, Thời gian |
| OH Item movement report | Store, Item code, Item name, UOM, Movement type (sale / sale deleted / sale return), Qty in, Qty out, On hand, Lot, Date time, User name |
| SAP tồn kho | Item code, Item name, Stock UOM, Bin location, On-hand, Pending in/out, Min/Max, Target, Reorder point, Max day stock, Tracked |
| Phiếu xuất kho | Số phiếu, ngày xuất từ/đến, đơn vị xuất/lĩnh; STT, Mã vật tư (mã trên kệ), SL, Đơn vị, Hạn dùng, Số lô, Vị trí |
| Phiếu xuất kho (OH) | Line No., Item code, Item name, UOM, Request bin, Requested, Issued bin, Issued received, To follow, Status |
| Phiếu trả thuốc BN | STT, Mã OH, Tên – nồng độ – hàm lượng, ĐVT, SL, Hạn dùng, Lý do trả, Đánh giá chất lượng, Ghi chú |
| Biên bản giao nhận | STT, Tên thuốc – nồng độ – hàm lượng, ĐVT, SL xuất, Số lô, Nơi SX, Hạn dùng, ĐK bảo quản, Nhiệt độ xuất/nhận |
| Sổ nhiệt độ | 9h & 15h hằng ngày; ≤ 30°C, độ ẩm ≤ 75% |
| Danh mục thuốc VMOCP2 | Ngày update, thuốc hết (mã + tên), thuốc thay thế, thông tin thuốc mới (nhóm dược lý, hoạt chất, nồng độ – hàm lượng, đối tượng, liều dùng) |

**Định dạng dữ liệu:** LOT = chữ + số (text); Hạn dùng dd/mm/yyyy; Mỗi thuốc 1 mã SAP (cần xác nhận lại – có ghi chú "1 thuốc ~3 mục SAP").

### 4.8. Nhóm dược lý (sắp xếp nhà thuốc)
Kháng sinh / Kháng histamin · Kháng sinh đặc biệt · Mỡ máu · Chống đông · Hô hấp · Vitamin & khoáng chất · Tiểu đường · Tim mạch *(cẩn trọng liều – lấy đơn lâu hơn 10–15 phút)* · Tiêu hóa · Mắt – Mũi – Họng.

---

## 5. Ý tưởng đã ghi nhận
- Đèn báo trên kệ khi lấy thuốc (mô hình BV Yên Bái), cuối ngày bù thuốc ô sáng đèn.
- Bảng điện tử +/- trên từng kệ; quét số lượng realtime.
- AI kiểm kê hằng ngày theo hóa đơn bán, so với tồn và báo kệ thiếu.
- Đóng gói thuốc theo ngày (mô hình Hàn Quốc).
- **Nguyên tắc từ mentor:** tập trung pain point lớn nhất, định lượng được; vấn đề giải được bằng workflow thì làm workflow trước (Non-AI); prototype là tối thiểu; bảo mật dữ liệu Vinmec.

---

## 6. Câu hỏi còn mở (cần hỏi lại bệnh viện)
1. **Sổ vay là "theo dõi lấy tạm" hay "khoản nợ thuốc"?** → Hệ thống hiện hỗ trợ cả 2: cho phép gạch sổ **từng phần**, lưu lịch sử tất toán.
2. Ý nghĩa và giá trị của **plans** và **Funds center** trong tool điều chuyển.
3. File tool điều chuyển chạy sang SAP cần **chính xác những cột nào, định dạng nào**?
4. Mỗi thuốc có 1 hay nhiều mã SAP?
5. SAP / OH có API, export/import nào? Cơ chế đồng bộ tồn OH → SAP?
6. Đặt 40 về 30: điều chỉnh tiền trong file quyết toán thế nào?
7. 1 tháng vay thuốc bao nhiêu lần, chi phí ship gấp bao nhiêu?
8. Ai được quyền **sửa giá bán** lẻ? Có cần duyệt không?
9. Tài khoản ngân hàng nhận QR là tài khoản nào; có cần đối soát tự động?
