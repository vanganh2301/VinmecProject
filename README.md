# Vinmec Pharmacy Hub

Web app cho **Nhà thuốc – Khoa Dược**, gom 3 việc đang làm bằng sổ giấy / Excel vào một màn hình. Điều hướng nằm ở **thanh bên trái**.

| Module | Thay cho | Điểm chính |
|---|---|---|
| **Bán hàng** (OTC, TPCN, vật tư y tế) | Phiếu tay + nhập lại OH/SAP | Tìm không dấu / gõ sai vẫn ra, quét mã vạch, quy đổi đơn vị, QR VietQR, in hóa đơn 80mm, phím tắt F2/F4/F8/F9 |
| **Sổ vay thuốc** (Nhà thuốc ↔ Kho) | Sổ vay giấy + file tool điều chuyển SAP | Bên cho vay xác nhận trên hệ thống, gạch sổ từng phần kèm số chứng từ SAP, cảnh báo quá 24h, **xuất file đúng cột của tool điều chuyển** |
| **Sổ hóa đơn** (OPD / IPD) | Sổ theo dõi hóa đơn giấy | Hàng về chưa có HĐ → nhận HĐ → bàn giao NVD → nhập hệ thống; cảnh báo trùng HĐ, HSD < 6 tháng, giá lệch lần nhập trước; tổng thuế theo 0/5/8/10%; in biên bản bàn giao |
| Tổng quan, Lịch sử bán, Danh mục | — | Giờ cao điểm, việc cần chú ý, đối soát OH/SAP, nhập danh mục từ Excel |
| **Sao lưu & khôi phục** | — | 4 lớp bảo vệ dữ liệu, nhật ký thao tác |

## Chạy thử

Không cần build. Cần **Node.js ≥ 22.13** (máy chủ đăng nhập + danh mục thuốc), mở bằng **Chrome** hoặc **Edge**.

1. Tạo tài khoản Trưởng khoa đầu tiên (in ra mật khẩu tạm một lần):
   `npm run users -- add --facility OCP2 --user TK01 --name "Tên Trưởng khoa" --role head`
2. Nhấp đúp **`chay.bat`** (hoặc `npm run dev`). Trình duyệt tự mở.
3. Nhập **mã cơ sở** `OCP2` → tên đăng nhập + mật khẩu tạm → đặt mật khẩu riêng → chọn nghiệp vụ.

- Đăng nhập 2 bước: **mã cơ sở** (OCP2 đang dùng; Times City `TIMESCITY`, Central Park `CENTRALPARK` đã có mã nhưng chưa mở) rồi **tài khoản dược sĩ**. Không có đăng ký tự do: tài khoản do Trưởng khoa cấp bằng `npm run users`. Mở thẳng `app/index.html` không đăng nhập được.
- **Danh mục thuốc chung** lưu trong cơ sở dữ liệu trên máy chủ: chỉ **Trưởng khoa** thêm / sửa thuốc, mọi máy tự nhận bản mới. Tồn kho, số lô, HSD vẫn riêng từng nhà thuốc.
- Lần đầu, ứng dụng tạo **dữ liệu mẫu** (khoảng 30 ngày bán hàng, 4 phiếu vay, 4 hóa đơn) để xem thử. Xóa chúng ở *Sao lưu & khôi phục → Vùng nguy hiểm → Xóa dữ liệu mẫu*.
- Ảnh QR (VietQR) và font chữ cần có mạng; đăng nhập cần kết nối tới máy chủ. Chi tiết ở đầu [CLAUDE.md](CLAUDE.md).

## Dùng trên điện thoại (bản Vercel)

App được triển khai lên Vercel, kèm máy chủ AI nhỏ trong `api/` cho **nhập bằng giọng nói** (Bán hàng) và **đọc ảnh hóa đơn** (Sổ hóa đơn). Máy chủ dùng được OpenAI, Google Gemini, Qwen (Alibaba Cloud) hoặc Qwen tự cài (Ollama / vLLM); chọn trong Cài đặt → thẻ AI.

Khóa AI điền vào file `.env` trên máy (mẫu: `.env.example`; file này không lên git, không lên Vercel), rồi dùng:

- `npm run dev`: chạy app + AI trên máy;
- `npm run eval:samples` rồi `npm run eval`: so sánh các nhà cung cấp trên cùng bộ mẫu;
- `npm run env:push` rồi `npm run deploy`: đưa khóa lên Vercel và triển khai.

Chi tiết ở đầu [CLAUDE.md](CLAUDE.md). Về quyền riêng tư: xem [docs/AI-cuc-bo.md](docs/AI-cuc-bo.md).

## Sao lưu – dữ liệu nằm ở đâu?

Dữ liệu được lưu **trên trình duyệt của máy đang dùng** (localStorage). Có 4 lớp bảo vệ:

1. **Tự lưu ngay** sau mỗi thao tác.
2. **Điểm khôi phục** trong IndexedDB: tạo mỗi 15 phút khi có thay đổi, khi mở app, khi kết thúc ca, và trước mỗi lần khôi phục hoặc nhập file. Giữ 30 bản gần nhất.
3. **Tự động ghi vào thư mục**, ví dụ ổ mạng khoa hoặc OneDrive. Chỉ có trên Chrome/Edge và phải bật trong màn *Sao lưu*.
4. **Tải file `.json`**: nên làm mỗi cuối ca. File có checksum và có màn xem trước khi khôi phục.

> ⚠️ Xóa lịch sử / dữ liệu duyệt web sẽ xóa dữ liệu app. Hãy bật lớp 3 hoặc tải file mỗi ngày. Chip trạng thái ở góc dưới bên trái chuyển **cam/đỏ** khi đã quá 24 giờ chưa có bản sao lưu nằm ngoài trình duyệt.
>
> Các máy **không dùng chung dữ liệu** với nhau (đây là bản Phase 1). Mỗi quầy cần đặt **Mã quầy** riêng trong *Cài đặt* để mã đơn không trùng nhau.

## Cấu trúc

```
docs/      PLAN.md (kế hoạch, đặc tả, lộ trình) · Khaosat.md (tổng hợp khảo sát) · PRD
app/       index.html · assets/css/app.css · assets/js/{core,modules}/*.js · app.js
api/       máy chủ (Vercel Functions): auth.js (đăng nhập) · drugs.js (danh mục thuốc chung) · _db.js (Postgres / SQLite)
           · ocr.js · stt.js · health.js · _providers.js (OpenAI / Gemini / Qwen)
tools/     dev.mjs · users.mjs (tài khoản, cơ sở) · eval.mjs · make-samples.mjs · env-push.mjs · prices.json
legacy/    prototype HTML cũ (tham chiếu): vinmec_retail_pharmacy.html, vinmec_ocp2_v1.html (gộp từ nhánh main)
```

Chi tiết từng file nằm trong [docs/PLAN.md §5](docs/PLAN.md). Code là HTML/CSS/JS thuần, các script nạp theo thứ tự trong `index.html` và dùng chung namespace `window.VM`. Mỗi module tự đăng ký vào router và sidebar qua `VM.ui.register({...})`.

## Việc cần xác nhận trước khi thử nghiệm tại khoa

Xem [docs/Khaosat.md §6](docs/Khaosat.md) và [docs/PLAN.md §10](docs/PLAN.md). Quan trọng nhất là **Plant / Funds center** của từng kho và **thứ tự cột của tool điều chuyển SAP**.
