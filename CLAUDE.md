# CLAUDE.md – Vinmec Pharmacy Hub

## ▶ Lệnh chạy nhanh trên máy (local)

Mở terminal ở thư mục gốc repo (`d:\55 Vinmec\VinmecProject`). Không cần build, không cần `npm install`.

| Việc | PowerShell (Windows) | Git Bash / macOS / Linux |
| --- | --- | --- |
| **Chạy server** (khuyên dùng) | `python -m http.server 8090 --bind 127.0.0.1 -d app` | như bên trái |
| Mở app | `Start-Process http://127.0.0.1:8090/` | `start http://127.0.0.1:8090/` (Git Bash) · `open …` (macOS) |
| Chạy server bằng Node thay Python | `npx serve app -l 8090` | như bên trái |
| Mở thẳng file, không server | `Start-Process app\index.html` | `start app/index.html` |
| Dừng server | `Ctrl + C` trong cửa sổ đang chạy (hoặc lệnh ở khối dưới) | `Ctrl + C` |
| Kiểm tra cú pháp JS | xem khối dưới | xem khối dưới |
| Cổng 8090 bị chiếm | đổi số cổng, VD `python -m http.server 8091 --bind 127.0.0.1 -d app` rồi mở `http://127.0.0.1:8091/` | như bên trái |

```powershell
# PowerShell – chạy server rồi tự mở trình duyệt
python -m http.server 8090 --bind 127.0.0.1 -d app
Start-Process http://127.0.0.1:8090/          # chạy ở cửa sổ PowerShell thứ hai

# Dừng server đang chiếm cổng 8090 (khi đã đóng mất cửa sổ chạy server)
Get-NetTCPConnection -LocalPort 8090 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }

# Kiểm tra cú pháp mọi file JS
Get-ChildItem app\assets\js -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

```bash
# Git Bash / macOS / Linux
python -m http.server 8090 --bind 127.0.0.1 -d app
for f in app/assets/js/core/*.js app/assets/js/modules/*.js app/assets/js/app.js; do node --check "$f"; done
```

- Địa chỉ app: **http://127.0.0.1:8090/**. Sau khi sửa code, bấm **Ctrl + F5** để trình duyệt nạp lại CSS/JS mới.
- Dữ liệu nằm trong localStorage **theo địa chỉ**: `http://127.0.0.1:8090`, `http://localhost:8090` và `file://` là 3 bộ dữ liệu riêng. Muốn làm lại từ dữ liệu mẫu: Khác → Sao lưu & khôi phục → "Đặt lại ứng dụng" (gõ `XOA`), hoặc DevTools → Application → Local Storage → xóa các khóa `vmhub.*`.
- Ảnh QR (VietQR) và font Google cần Internet. Phần còn lại chạy offline.
- Dùng Chrome hoặc Edge (tự ghi thư mục sao lưu chỉ có trên 2 trình duyệt này).

---

Ghi chú dành cho Claude / lập trình viên khi tiếp tục làm việc trên repo này. Đọc file này trước, sau đó mới đến [docs/PLAN.md](docs/PLAN.md) (đặc tả) và [docs/Khaosat.md](docs/Khaosat.md) (khảo sát gốc).

## 1. Dự án là gì

Web app nội bộ cho **Nhà thuốc – Khoa Dược Vinmec**, thay sổ giấy và các file Excel rời rạc. App có 3 nghiệp vụ chính, điều hướng bằng **sidebar bên trái**:

1. **Bán lẻ**: thuốc không kê đơn (OTC), thực phẩm chức năng (TPCN), vật tư y tế (VTYT).
2. **Sổ vay thuốc** giữa Nhà thuốc (Y001) và Kho nội trú (Y003), 2 kho của Khoa Dược. Kho HO2 là kho chung toàn viện nên **không** dùng trong sổ vay. Mỗi **mã vay** gồm nhiều thuốc. Xuất file cho tool điều chuyển SAP. Có màn **Thống kê vay thuốc** (thuốc vay thường xuyên theo ngày / tuần / tháng, dự báo nhu cầu).
3. **Sổ hóa đơn** ngoại trú (OPD) / nội trú (IPD), theo luồng: hàng về → nhận HĐ → bàn giao Nghiệp vụ dược (NVD) → nhập hệ thống.

Kèm theo: Tổng quan, Lịch sử bán (đối soát OH/SAP), Danh mục hàng, Sao lưu & khôi phục, Cài đặt.

Đây là **Phase 1 (MVP)**: chạy hoàn toàn trên trình duyệt, chưa có backend, chưa đồng bộ giữa các máy.

## 2. Chạy & kiểm tra

- **Chạy:** xem bảng "Lệnh chạy nhanh" ở đầu file. Mở `app/index.html` bằng Chrome hoặc Edge cũng được, kể cả qua `file://`.
- **Kiểm tra cú pháp:**
  ```bash
  for f in app/assets/js/core/*.js app/assets/js/modules/*.js app/assets/js/app.js; do node --check "$f"; done
  ```
- **Kiểm tra runtime:** dùng Chrome headless (`chrome.exe --headless=new --allow-file-access-from-files --virtual-time-budget=30000 --dump-dom <trang test>`).
  - Trang test là bản sao của `index.html` đặt trong scratchpad, gồm:
    - `<base href="file:///d:/55%20Vinmec/VinmecProject/app/">`;
    - một script chạy trước `util.js`: xóa localStorage, gán sẵn session `vmhub.session`, gom lỗi qua `window.onerror`;
    - một script chạy sau `app.js`: lần lượt bấm qua từng màn và ghi kết quả vào `<pre>`.
  - Lần chạy cuối (18/11/2026, sau khi làm giao diện tối giản + chia đôi màn Bán hàng): **61/61** bước đều OK, 2 lần liền, không có lỗi JS. Bước mới / sửa: tab Thuốc lọc danh sách `#posRes` chỉ còn OTC; tiêu đề "Vinmec Pharmacy", ô "Tìm kiếm", không còn Hay bán, nút đổi tên, 5 tab trên 1 hàng, giỏ nằm bên phải; gõ tên + Enter / ↓ Enter / quét mã hàng thêm vào giỏ; 6 mặt hàng trong giỏ thấy hết không cuộn và nút thanh toán không khuất (1440×900); nút "Hiển thị tất cả" ẩn/hiện `.xd` và lưu `vmhub.detail`; Lịch sử bán mỗi mặt hàng 1 dòng, không cuộn ngang.
  - Lần trước (sau khi làm lại Danh mục + màu theo nghiệp vụ): 57/57. Các bước: nhóm Khác + hàm lượng trong dữ liệu mẫu, Esc không bị nuốt sau khi đổi màn, bảng danh mục không cuộn ngang, tab Khác lọc bảng, file mẫu đúng 10 cột (đọc ngược .xlsx), nhập Excel theo mẫu (ĐVT Hộp quy đổi tồn, nhóm Khác, Kho Nhà thuốc → Y001, báo thiếu HSD), form thêm 10 trường, nút Điều chỉnh tồn trong form sửa. Nhập Excel cần chờ tới ~5 giây ảo (readTable chạy bất đồng bộ).
  - Lần trước (sau khi thêm Thống kê vay thuốc + Copy quyết toán trong ngày): 47/47 bước đều OK, không có lỗi JS (2 lần liền). 12 bước mới: lịch sử vay mẫu + migrate, KPI khớp đếm tay theo ngày / tuần / tháng / chiều vay, biểu đồ riêng 1 thuốc, sắp xếp, tìm, xuất Excel, phím Q, copy 3 cột / 3 dòng, giữ số 0 đầu số HĐ, ô ngày là ngày thật. Trước đó: 35/35 sau khi làm lại Sổ vay theo mã vay. Gồm màn chọn nghiệp vụ + phím 1/2/3, tour, tạo mã vay nhiều thuốc (quét → số lượng → cộng dồn → máy quét bắn mã vào ô SL → hàng ngoài danh mục → giữ nháp → Hoàn thành → người vay/cho vay → lưu), trang chi tiết (sửa thông số, gạch sổ từng phần / cả mã vay, xác nhận, hủy), file điều chuyển, thông báo hoàn thành, quét mã hóa đơn, kết thúc ca → vào lại.
  - Trong trang test nhớ tắt tour (`vmhub.tour.<id>` = `{"off":true}`) ở các bước không kiểm tra tour, nếu không tour tự chạy sẽ che màn. Bước kết thúc ca cần chờ tới ~90 giây ảo và `--virtual-time-budget=200000` (IndexedDB chạy bằng thời gian thật nên dưới virtual time đồng hồ ảo bị phóng đại; ngoài đời chỉ vài chục ms).
  - Trong headless, `navigator.clipboard.write` có thể treo: khi test copy hãy thay `VM.copyCells` bằng hàm giả và đọc `copyCells.last` của hàm thật (được gán trước khi ghi clipboard).
  - Chụp màn hình bằng `--screenshot --window-size=1440,900` để soát giao diện.
  - Trên Windows, cửa sổ headless rộng **tối thiểu 500px**. Muốn xem bố cục mobile thì nhúng trang test vào `<iframe style="width:390px">`.
  - Ảnh chụp không theo vị trí cuộn. Phần nằm dưới màn hình thì đưa lên đầu `#view` trước khi chụp.
- Repo chưa có test tự động. Khi thêm, ưu tiên Playwright chạy trên `file://`.

## 3. Kiến trúc & quy ước code

- **HTML/CSS/JS thuần, không build, không thư viện ngoài.** Script thường (không phải ES module), dùng chung namespace `window.VM`. Lý do: phải chạy được qua `file://` và khi mất mạng.
- **Thứ tự nạp** trong `index.html` là bắt buộc: `core/util` → `store` → `xlsx` → `backup` → `ai` → `ui` → `tour` → `modules/*` → `app.js`.
  - Module mới phải thêm `<script>` vào trước `app.js`.
  - Thứ tự các thẻ `<script>` cũng chính là thứ tự xuất hiện trên menu.
- Mỗi file bọc trong `(function (VM) { 'use strict'; ... })(window.VM);`.

| File               | Xuất ra                                                                                                                                                                                                          | Vai trò                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/util.js`   | `VM.$, $$, esc, icon, money, num, fmtDate, fmtDT, ymd, iso, daysUntil, hoursSince, ago, parseDate, parseNum, normalize, search, uid, debounce, download, sum, fileStamp, gs1, gtinKey, gtinCheck, isLocalUrl…` | Tiện ích. `search()` là fuzzy, bỏ dấu tiếng Việt. `gs1()` đọc mã DataMatrix GS1 (AI 01/17/10/21). `isLocalUrl()` nhận diện địa chỉ trong mạng nội bộ        |
| `core/store.js`  | `VM.store`                                                                                                                                                                                                      | State duy nhất, lưu vào localStorage, nhật ký (audit), dữ liệu mẫu, quy tắc nghiệp vụ. Thêm `matchScan(raw)`, `productFreq()`, `topProducts(n)`, `peopleFreq()`, `LOAN_STORES` / `loanStores()` (chỉ Y001, Y003), `loanGroup(l)`, `loanVouchers(list?)`, `voucherStatus(lines)`, `voucherOpen(v)`, `loanCode(peek)`, `CATEGORIES` (otc / supp / device / other) + `catOf(p)` |
| `core/xlsx.js`   | `VM.xlsx.exportXlsx(sheets, filename)`, `readTable(file)`                                                                                                                                                     | Tự ghi/đọc .xlsx (zip không nén) và CSV, không cần thư viện                                                                                                               |
| `core/backup.js` | `VM.backup`                                                                                                                                                                                                     | Snapshot IndexedDB, file JSON có checksum FNV-1a, ghi thư mục bằng File System Access API                                                                                       |
| `core/ai.js`     | `VM.ai = { MODES, listen, ocrInvoice, parseXmlInvoice, parseInvoiceCode, track, pct, ping, sttSupported }`                                                                                                                        | Giọng nói và OCR **chỉ gọi máy chủ nội bộ** (hàm `guard`). Đọc XML hóa đơn điện tử và mã QR / chuỗi tra cứu HĐĐT (`parseInvoiceCode`). Đo độ chính xác thực tế vào `state.aiStats`                 |
| `core/ui.js`     | `VM.ui`                                                                                                                                                                                                         | Shell gồm thanh biểu tượng (rail) và rèm (curtain), hash router `#/<id>/<arg>`, modal, confirm, toast, `done` (thông báo hoàn thành), print, `register`, `suggest` (danh sách gợi ý thả nổi), `catBar` (tab nhóm hàng, dùng chung cho Bán hàng và Danh mục). Nút `#detailBtn` (Hiển thị tất cả / Thu gọn) và `#tourBtn` (?) trên thanh tiêu đề      |
| `core/tour.js`   | `VM.tour = { start, auto, has, reset, clearSession, prefs, active }`                                                                                                                                             | Hướng dẫn ban đầu dạng spotlight. Tự chạy lần đầu mở mỗi màn có `tour`; lần đầu tiên kèm các bước chung của khung (rail, rèm, sao lưu, kết thúc ca, nút ?) |
| `modules/*.js`   | `VM.pos`, `VM.loans`, `VM.invoices`, `VM.catalog`                                                                                                                                                         | Mỗi màn là một module. `loan-stats.js` (id `loanstats`, nhóm `loans`) là màn Thống kê vay thuốc, nạp ngay sau `loans.js`                                                                                                                                                           |
| `app.js`         | `VM.app = { logout, start }`                                                                                                                                                                                    | Màn vào ca, khởi động, kết thúc ca                                                                                                                                           |

**Điều hướng:** rail bên trái có 3 biểu tượng nghiệp vụ là `retail` (Bán lẻ), `loans` (Sổ vay), `invoices` (Hóa đơn), cộng nút "Khác" (`system`: Tổng quan, Sao lưu, Cài đặt).

- Bấm một biểu tượng thì mở **rèm** liệt kê các module của nhóm đó và các mục con `subs()` của từng module.
- Bấm lại biểu tượng của nhóm đang mở thì thu/mở rèm. Trạng thái rèm lưu ở `vmhub.curtain`.
- Mục có `hot: true` được tô vàng nhẹ để dược sĩ dễ thấy.
- Màn < 768px: rail thành thanh tab dưới đáy, rèm thành ngăn kéo.

**Mẫu một module:**

```js
VM.ui.register({ id, title, group: 'retail'|'loans'|'invoices'|'system', icon,
  head: 'Vinmec Pharmacy' /* tùy chọn: chữ trên thanh tiêu đề thay cho title (rèm vẫn dùng title) */,
  detail: true /* tùy chọn: hiện nút "Hiển thị tất cả" cho màn có thông tin phụ .xd */,
  hot: true /* tùy chọn: tô nổi bật trên rèm */,
  render(view, topActions, arg) { ...; return cleanupFn /* tùy chọn */ },   // arg lấy từ #/<id>/<arg>
  badge: () => ({ n, soft, title }) /* tùy chọn, hiện số trên rail và rèm */,
  subs: () => [{ arg, label, n, tone: 'bad'|'warn', hot }] /* tùy chọn, mục con trên rèm */,
  keys: [['F2', 'Tìm hàng'], …] /* tùy chọn, hộp phím tắt dưới rèm */,
  tour: () => [{ el: '#selector', alt: '#selectorDuPhong', title, text /* HTML tĩnh, không chèn dữ liệu người dùng */ }] /* tùy chọn */ });
```

**Thông báo hoàn thành:** sau mỗi thao tác xong (gạch sổ, lưu, thanh toán, bàn giao, khôi phục, xuất Excel…) gọi `VM.ui.done(title, sub, { action: {label, fn}, ms })`.

- Thẻ có dấu ✓ xanh hiện ở giữa phía trên màn hình, tự tắt sau 2,6 giây (5 giây nếu có nút). Không chặn thao tác tiếp theo.
- `VM.xlsx.exportXlsx` tự gọi `done('Đã xuất file Excel', tên file)`.
- `toast` chỉ dùng cho tin nhỏ, lặp nhiều (VD "Đã thêm X" khi quét ở POS) và cho cảnh báo / lỗi.

**Hướng dẫn ban đầu (`tour`):** bước nào không tìm thấy phần tử đang hiện trên màn thì tự bỏ.

- Module có nhiều màn con khai báo thêm `tourKey: () => 'loans:new'` để mỗi màn con được tính "đã xem" riêng. Sổ vay dùng `loans` / `loans:new` / `loans:detail`.

- Xong hết các bước: ghi `seen[id]`, không tự hiện lại cho màn đó.
- "Bỏ qua" / Esc: chỉ ẩn trong phiên này, lần vào ca sau hiện lại.
- Tick "Không hiện lại lần sau": ghi `off: true`, tắt tự hiện cho mọi màn. Vẫn xem lại được bằng nút ?.
- Khi tour mở, phím → / Enter / ← / Esc bị tour giữ lại, không lọt xuống phím tắt của màn.

**Ô gợi ý thả nổi:** `VM.ui.suggest(input, { items(q), head(q), empty(q), min, beforeEnter(e) })`.

- Hỗ trợ ↑ ↓ Enter Esc.
- `beforeEnter` dùng cho máy quét mã vạch: chuỗi quét kết thúc bằng Enter.

**Quy tắc bắt buộc khi viết code:**

- **Luôn `esc()`** mọi dữ liệu người dùng trước khi chèn vào `innerHTML`.
- Sửa state theo đúng trình tự: đổi `VM.store.state` → `VM.store.log(action, entity, detail, ref)` → `VM.store.save('<lý do>')`.
  - `save` tự tăng `meta.rev` rồi báo cho các listener.
  - Lý do `'restore'` hoặc `'external'` (thay đổi từ tab khác) làm cả màn hình vẽ lại.
- **Icon:** `VM.icon('name', 's')` dùng sprite SVG trong `index.html`. Muốn icon mới thì thêm `<symbol id="i-...">` vào sprite.
- **Hộp thoại:** dùng `VM.ui.modal({ title, sub, ic, size: ''|'lg'|'xl', body, foot, onMount(el, close), onClose, dismissable })`.
- **Xác nhận:** `await VM.ui.confirm({ title, message, ok, danger, input: { label, required, options } })` trả về `false`, `true` hoặc chuỗi đã nhập.
- **Hủy, không xóa:** đơn, phiếu vay, hóa đơn bị hủy chỉ đổi trạng thái và bắt buộc có lý do. Lịch sử luôn được giữ.
- **Thao tác nguy hiểm** phải gõ `XOA` để xác nhận và phải tạo snapshot trước khi chạy.

## 4. Dữ liệu

**Các khóa lưu trữ (localStorage):**

| Khóa                    | Nội dung                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `vmhub.state.v1`       | Toàn bộ state                                                                             |
| `vmhub.session`        | Người đang trong ca                                                                      |
| `vmhub.draft.<userId>` | Giỏ hàng POS đang dở                                                                    |
| `vmhub.lastUser`       | Người đăng nhập gần nhất                                                             |
| `vmhub.curtain`        | Rèm chức năng đang mở (`1`) hay thu gọn (`0`). Thay cho `vmhub.sidebarMini` cũ |
| `vmhub.lastDownload`   | Lần tải file sao lưu gần nhất                                                          |
| `vmhub.folderWrite`    | Lần ghi thư mục sao lưu gần nhất                                                      |
| `vmhub.lastHome`       | Nghiệp vụ chọn lần trước ở màn chọn nghiệp vụ (`pos` / `loans` / `invoices`), được đánh dấu "Lần trước" |
| `vmhub.tour.<userId>`  | Hướng dẫn ban đầu của từng người: `{off, seen:{<moduleId>:true, __shell:true}}`            |
| `vmhub.loanDraft.<userId>` | Mã vay đang tạo dở: `{items[], step:'scan'|'who', from, to, borrower, lender, confirmed}`. Xóa khi lưu hoặc hủy |
| `vmhub.loanStats`      | Lựa chọn ở màn Thống kê vay: `{g:'day'|'week'|'month', n, dir:''|'Y001'|'Y003', sort}` |
| `vmhub.detail`         | Nút "Hiển thị tất cả": `1` hiện thông tin chi tiết (`.xd`), `0` / không có = tối giản (mặc định) |
| `vmhub.qtDay`          | Lựa chọn ở hộp Copy quyết toán trong ngày: `{by:'recv'|'created', layout:'rows'|'cols', head, noInv}` |

IndexedDB `vmhub-backup` (**version 2**) có 2 store: `snapshots` (giữ 30 bản, có chỉ mục `at`) và `kv` (handle của thư mục sao lưu).

- Dọn bản cũ (`prune`) và lấy bản mới nhất khi khởi động đều đi qua chỉ mục `at`, không nạp dữ liệu snapshot. Chỉ màn Sao lưu mới gọi `list()` (đọc hết).
- Nâng từ v1 lên v2 tự tạo chỉ mục. Kết nối có `onversionchange` → tự đóng để lần nâng cấp sau không bị tab cũ chặn; nếu bị chặn thì hiện toast nhắc đóng tab khác.

**Cấu trúc state** (`schema: 1`):

```
meta{createdAt,updatedAt,rev,demo}
settings{pharmacyName, counter, bank{bin,account,owner}, stores[{code,name,plant,fundsCenter}],
         suppliers[], loanOverdueHours=24, invoiceAlertDays=2, expiryWarnDays=90, priceDiffPct=5, snapshotMinutes=15,
         transfer{plant='1000', fundsCenter='1000', unit:'base'|'loan', fillLot=false},
         ai{stt:'off'|'local'|'server'|'cloud', sttUrl, ocrUrl, ocrModel, allowPublic=false}}
aiStats{ocr{docs,fields,kept}, voice{n,top1}}   // độ chính xác đo tại khoa
staff[{id,name,role,store,admin}]
products[{id,code,sap,gtin,name,strength,ingredient,category:'otc'|'supp'|'device'|'other',group,store,units[{name,factor,price}],defaultUnit,stock,lot,expiry,minStock,active,image}]
sales[{id,code,createdAt,sellerId,sellerName,customer,pid,items[{productId,code,sap,name,lot,unit,factor,qty,price,listPrice,total,special,seller}],total,payment:'qr'|'cash',status,recon:'pending'|'done',demo}]
loans[{id,group,line,code,createdAt,createdBy,from,to,productId,itemCode,sap,name,unit,qty,lot,expiry,borrower,lender,note,confirmedBy,confirmedAt,returns[{at,qty,ref,by,note}],edits[{at,by,what}],cancelled,cancelReason,sapExport{at,by,qty,how}}]
      // mỗi phần tử là MỘT THUỐC; các thuốc cùng mã vay có chung `group` (VAY-yyyymmdd-001), `line` = 1,2,3…, `code` = group/line.
      // Dữ liệu cũ không có group → loanGroup(l) = l.code (mỗi phiếu cũ là 1 mã vay 1 thuốc).
invoices[{id,book:'OPD'|'IPD',receivedAt,supplier,sellerTax,invoiceSymbol,invoiceNo,invoiceDate,refNo,prNo,poNo,itemCount,receivedBy,pharmacyReceiver,nvdReceiver,nvdAt,grNo,
          subtotal,tax,total,totalQty,taxByRate,source:'xml'|'ocr',lines[{code,name,country,lot,expiry,unit,qty,price,discount,taxRate,amount}],status,history[{at,by,action}],note}]
seq{ VAY<yyyymmdd>, ORD<yyyymmdd>, demoLoanHist, demoQtDay, demoCat2 }   audit[{at,userId,user,action,entity,ref,detail}] (tối đa 3000 dòng)
```

**Quy tắc quan trọng:**

- **Tồn kho** luôn tính theo **đơn vị nhỏ nhất** (`factor = 1`). Số lượng bán × `factor` sẽ trừ vào `stock`. Hủy đơn thì cộng trả lại.
- **Mã chứng từ:**
  - Đơn bán: `ORD-yyyymmdd-<mã quầy>-0001`. Mỗi máy phải đặt **mã quầy riêng** để không trùng mã.
  - Mã vay: `VAY-yyyymmdd-001` (lưu ở `group`); mỗi thuốc trong mã vay có `code` = `VAY-yyyymmdd-001/1`, `/2`…
  - Bộ đếm lưu trong `state.seq`.
- **Sổ vay chỉ có 2 kho:** Y001 (Nhà thuốc) ↔ Y003 (Kho nội trú). `migrate()` tự xóa HO2 khỏi `settings.stores` của dữ liệu cũ.
- **Sổ vay theo mã vay** (3 màn trong `modules/loans.js`):
  - `#/loans` – màn đầu: nút lớn **"Tạo mã vay mới"** (phím `N`, hiện "Tiếp tục…" nếu có nháp) + KPI + danh sách **mỗi dòng là một mã vay**: số thuốc, từng thuốc + SL, người vay ← người cho vay, trạng thái, nút Xác nhận / Gạch sổ. Bấm dòng → trang chi tiết.
  - `#/loans/new` – tạo mã vay, 2 bước:
    1. Quét mã thuốc → hiện ô **số lượng** (Enter thêm vào danh sách, Esc bỏ) → quét tiếp. Quét lại cùng thuốc + cùng lô thì cộng dồn. Nếu máy quét bắn mã vào ô số lượng (chưa Enter thuốc trước) thì thuốc trước giữ SL 1 và mở thuốc mới. Gõ tên không có trong danh mục + Enter → hàng ngoài danh mục, hỏi thêm ĐVT.
    2. **"Hoàn thành vay thuốc"** (Ctrl+Enter) → chiều kho, người vay (mặc định người đang trong ca), người cho vay, tick đã xác nhận giao → **Lưu mã vay** (Enter ở ô người cho vay).
    - ĐVT không chọn: lấy ĐVT nhỏ nhất của thuốc trong danh mục. Màn tạo **không** hiện mã SAP / lô / HSD / ghi chú (tự lấy từ danh mục hoặc DataMatrix).
  - `#/loans/VAY-…` – chi tiết mã vay: thông tin chung, nút Xác nhận đã giao / Gạch sổ cả mã vay / Hủy mã vay (khi chưa thuốc nào được gạch), In phiếu, File điều chuyển SAP của riêng mã vay. Mỗi thuốc một thẻ: **thông số** (mã SAP, mã hàng, lô, HSD, ghi chú – sửa bằng "Sửa thông số", ghi vào `edits`), **lịch sử truy xuất** (ghi sổ, xác nhận, xuất file điều chuyển, sửa thông số, từng lần gạch sổ), Gạch sổ (từng phần), Hủy thuốc này.
  - Trạng thái mã vay (`voucherStatus`): `cancelled` nếu mọi thuốc bị hủy; `settled` nếu mọi thuốc còn hiệu lực đã gạch; `partial` nếu có thuốc đã gạch (một phần hoặc đủ); `pending` nếu còn thuốc chưa xác nhận; còn lại `open`. Mã vay quá hạn khi có thuốc quá hạn.
  - Badge, rèm, Tổng quan, màn chọn nghiệp vụ đều đếm theo **mã vay**. File điều chuyển SAP vẫn mỗi thuốc 1 dòng.
- **Sổ hóa đơn – quét mã trước:** form ghi tay mở ra với ô "Quét mã hóa đơn" (QR trên HĐĐT, chuỗi tra cứu, hoặc gõ số HĐ), chọn file XML, hoặc "Hàng về chưa có HĐ". Các trường khác khóa cho tới khi có một trong ba. Mã quét được điền số HĐ / ký hiệu / ngày / tổng (tô vàng); NCC đoán qua `sellerTax` của hóa đơn cũ. Sửa hóa đơn đã có thì không qua bước này.
- **Thống kê vay thuốc** (`modules/loan-stats.js`, `#/loanstats[/day|week|month]`, nút "Thống kê" ở màn đầu Sổ vay):
  - Gom theo **ngày** (14/30/60/90), **tuần** bắt đầu thứ Hai (8/12/26/52) hoặc **tháng** (6/12/24); lọc chiều vay theo kho nhận (`to`): Nhà thuốc vay = Y001, Kho nội trú vay = Y003.
  - Không tính dòng vay đã hủy. Số lượng quy về **ĐVT nhỏ nhất** (`qty × factor`); hàng ngoài danh mục gom theo tên.
  - Mỗi thuốc: **lượt vay** (số mã vay có thuốc đó), tổng SL, số kỳ có vay, sparkline, xu hướng (TB 1/3 số kỳ gần nhất so với TB cả khoảng, ±10% coi là ổn định), **dự báo kỳ tới**, tồn nhà thuốc.
  - **Dự báo** = `ceil(0,6 × TB 1/3 số kỳ gần nhất + 0,4 × TB các kỳ đã qua)`. Kỳ hiện tại chưa kết thúc nên chỉ hiển thị (cột nhạt), không đưa vào dự báo. Có quy đổi sang ĐVT lớn nhất (≈ N Hộp); tồn < dự báo → pill "Thiếu so với dự báo".
  - "Thường xuyên": có vay ở ≥ max(2, ⌈số kỳ / 3⌉) kỳ.
  - Biểu đồ cột 1 màu: số mã vay mỗi kỳ, bấm 1 thuốc trong bảng thì đổi sang SL của thuốc đó. Có đường trung bình và cột dự báo viền đứt.
  - Xuất Excel 3 sheet: `Thuốc vay thường xuyên`, `Theo kỳ` (ma trận thuốc × kỳ), `Tổng theo kỳ`.
- **Trạng thái phiếu vay** (hàm `loanStatus`, suy ra từ dữ liệu, không lưu thẳng):
  - `cancelled` nếu phiếu bị hủy;
  - `settled` nếu đã hoàn ≥ số lượng vay;
  - `partial` nếu đã hoàn một phần;
  - `pending` nếu chưa ai xác nhận;
  - còn lại là `open`.
  - Phiếu quá hạn: đang mở và đã quá `loanOverdueHours` giờ.
- **Trạng thái hóa đơn:** `no_invoice` → `received` → `handed` → `entered`, hoặc `cancelled`. Hóa đơn tồn đọng: đang ở `no_invoice`/`received` quá `invoiceAlertDays` ngày.
- **Cảnh báo khi ghi hóa đơn:**
  - trùng NCC + số HĐ (bỏ số 0 ở đầu khi so);
  - hạn dùng còn dưới 180 ngày;
  - giá lệch so với **lần nhập trước** cùng mã và cùng ĐVT quá `priceDiffPct`%. Chưa có giá hợp đồng nên đang so với lần nhập trước.
- **File điều chuyển SAP** (Sổ vay → "File điều chuyển SAP"): mở hộp xem trước, rồi **Tải file Excel** hoặc **Copy để dán vào tool**.
  - Cột đúng thứ tự của tool điều chuyển, sheet `Sheet1`, dòng 1 là tiêu đề: `Mã SAP / Tên / Số lượng / Kho xuất / Kho nhận / LOT / DATE / plans / Funds center`. Không thêm cột nào khác.
  - **5 cột đầu phải chính xác:**
    - Mã SAP lấy từ phiếu, nếu trống thì lấy từ danh mục;
    - Số lượng là số **còn lại** (chưa gạch sổ);
    - Kho xuất / Kho nhận là mã kho (`from` / `to`).
  - Số lượng mặc định **quy đổi về ĐVT nhỏ nhất** theo hệ số trong danh mục, VD 2 Hộp × 100 = 200. Có thể chọn "ĐVT ghi trên phiếu".
  - LOT / DATE mặc định **để trống**, vì tool lấy từ file khác. Tick "Điền LOT / DATE" nếu muốn điền.
  - plans / Funds center là giá trị cố định, mặc định `1000`, sửa ngay trong hộp. Lưu ở `settings.transfer`.
  - Phiếu bị chặn (dòng đỏ), không xuất được: thiếu mã SAP, thiếu kho, kho xuất = kho nhận, hoặc không quy đổi được ĐVT.
  - Nguồn phiếu: các phiếu đang chọn, nếu không chọn phiếu nào thì lấy tất cả phiếu đang mở.
  - Sau khi xuất, phiếu được ghi `sapExport{at,by,qty,how}` và hiện pill "Đã xuất ĐC". Lần sau phiếu đó không tự được chọn; nếu chọn lại thì app cảnh báo nguy cơ điều chuyển hai lần.
- **Copy sang Excel:** dùng `VM.copyCells(rows)`, không dùng `copyText`. Hàm này ghi cả text/plain lẫn text/html có `mso-number-format`:
  - chuỗi (số HĐ `0001234`, mã SAP, mã kho) giữ dạng chữ, không mất số 0 đầu;
  - ô ngày `{text, date:'yyyy-mm-dd'}` được Excel nhận là ngày thật, không phụ thuộc định dạng vùng của máy.
- **3 trường quyết toán của hóa đơn:** Ngày hàng về / SL hàng tổng đã về / Số hóa đơn.
  - SL hàng tổng = tổng `qty` các dòng hàng (`calcInvoice` ghi vào `totalQty`). Nếu không nhập chi tiết dòng thì nhập tay ô "SL hàng tổng đã về".
  - Hiện ở 3 chỗ:
    - đầu form ghi/sửa hóa đơn, cập nhật theo từng thay đổi, kể cả ngay sau OCR / XML;
    - hộp chi tiết hóa đơn;
    - nút copy trên mỗi dòng và "Copy quyết toán" khi chọn nhiều dòng.
  - "Copy cả 3 ô" cho ra 3 ô liền nhau theo thứ tự trên.
  - **Copy quyết toán trong ngày** (nút "Quyết toán ngày", phím `Q`, mục rèm `#/invoices/qt`): copy 3 trường của **mọi hóa đơn trong 1 ngày** một lần.
    - Lọc theo Ngày hàng về (mặc định) hoặc Ngày ghi sổ; cả 2 sổ / OPD / IPD; đổi ngày bằng ‹ › hoặc ô ngày. Bỏ hóa đơn đã hủy; hàng về chưa có số HĐ chỉ copy khi tick "Kèm hàng về chưa có HĐ".
    - Cách dán: **Mỗi HĐ một dòng** (3 cột) hoặc **Mỗi HĐ một cột** (3 dòng); tùy chọn kèm tiêu đề. Thứ tự hóa đơn theo giờ ghi sổ.
    - Có bảng xem trước đúng như sẽ dán; cột / dòng NCC tô mờ chỉ để đối chiếu, không được copy. HĐ thiếu SL tổng được báo.
    - Nút Copy được focus sẵn: `Q` rồi `Enter` là xong. Dùng `VM.copyCells` nên số HĐ giữ số 0 đầu, ô ngày là ngày thật.
  - Excel sổ hóa đơn có sheet đầu tiên là `Quyết toán`.
- **Xuất Excel ở mọi màn:**
  - Bán hàng: đơn hôm nay, dùng chung `VM.history.exportSales`;
  - Lịch sử bán; Danh mục;
  - Sổ vay: sổ + file điều chuyển; Thống kê vay thuốc (3 sheet);
  - Sổ hóa đơn;
  - Tổng quan: chỉ số, doanh thu 30 ngày, bán chạy, tồn cần chú ý;
  - Sao lưu: toàn bộ dữ liệu + nhật ký;
  - Cài đặt: kho, nhân viên, NCC, thông số.
- **Dữ liệu mẫu:**
  - sinh cố định (deterministic): 30 ngày bán hàng (kể cả hôm nay, chỉ lấy các giờ đã qua), 4 mã vay đang dùng + **lịch sử vay ~10 tháng** đã gạch sổ (`demoLoanHistory`, có mùa ho để thấy xu hướng tăng), 4 hóa đơn cũ + 4 hóa đơn **hàng về hôm nay** (`demoTodayInvoices`), đều gắn cờ `demo: true`;
  - dữ liệu mẫu cũ (còn `meta.demo`) được `migrate()` bổ sung 2 phần trên **một lần** (cờ `seq.demoLoanHist`, `seq.demoQtDay`) rồi lưu lại ngay;
  - xóa ở màn Sao lưu → "Xóa dữ liệu mẫu" (danh mục hàng được giữ lại).
- Danh sách **ngân hàng** cho VietQR nằm trong `settings.js`. Ảnh QR lấy từ `img.vietqr.io`, nên cần Internet.
- **Nhóm hàng** (`VM.store.CATEGORIES`): `otc` Thuốc OTC, `supp` Thực phẩm chức năng, `device` Vật tư y tế, `other` Khác. Mỗi nhóm có `label`, `short` (tag), `tab` (chữ trên tab), `icon`. `catOf(p)` trả nhóm của mặt hàng, nhóm lạ coi là `other`; `migrate()` cũng đổi nhóm không hợp lệ thành `other`.
- **Thanh phân loại** `VM.ui.catBar(el, { cat, counts(), onCat(k) })` → `{ set, refresh, cat }`: tab Tất cả / Thuốc / TPCN / Vật tư / Khác kèm số mặt hàng; bấm lại tab đang chọn thì về Tất cả. Ở Bán hàng: lọc danh sách hàng bên trái; ở Danh mục: lọc bảng. (Nút "Hay bán" đã bỏ theo yêu cầu khoa ngày 18/11/2026; `topProducts` vẫn còn trong store, dùng cho Tổng quan.)
- **Chế độ tối giản / "Hiển thị tất cả":** mặc định chỉ hiện thông tin cần để làm việc. Phần tử có lớp `.xd` bị ẩn bằng `.app:not(.show-all) .xd{display:none!important}`; nút `#detailBtn` trên thanh tiêu đề (chỉ hiện ở màn khai báo `detail: true`: Bán hàng, Lịch sử bán, Danh mục, Sổ vay, Sổ hóa đơn) bật lớp `show-all` trên `#app`, lưu `vmhub.detail` và phát sự kiện `window` `vm-detail`. Khi viết màn mới: thông tin phụ (mã hàng, lô, HSD, PID, ngày tương đối, bộ lọc ít dùng…) gắn `.xd`, không gắn cho thứ cần để thao tác. Đã bỏ dòng chữ nhỏ (`crumb`) dưới tiêu đề ở mọi màn.
- **Màn Bán hàng** (`modules/pos.js`), tiêu đề "Vinmec Pharmacy", chia đôi màn:
  - **trái** (`.pos-left`): thanh phân loại `#catBar`, ô `#posSearch` (chỉ ghi "Tìm kiếm") + nút micro, danh sách hàng `#posRes` (`.pr-i`: tag nhóm, tên, cảnh báo hết hàng / cận hạn, giá / ĐVT; mã hàng · tồn là `.xd`). Ô trống thì liệt kê cả nhóm (hàng còn bán trước, rồi theo `productFreq`). ↑ ↓ chọn dòng, Enter: thử `matchScan` trước (máy quét), không khớp thì thêm dòng đang tô; Esc xóa ô tìm;
  - **phải** (`aside.cart`, sticky): giỏ hàng `.crow` (tên + dòng nhỏ ĐVT / đơn giá, bước số lượng, thành tiền, xóa), mục gập "Khách hàng / PID", tổng tiền, 2 nút QR (F4) / Tiền mặt (F8). Màn 1440×900 thấy ≥ 6–7 mặt hàng cùng tổng và nút thanh toán;
  - nút trên cùng: **Thêm hàng mới** (hàng ngoài danh mục), **Báo cáo trong ngày** (Excel đơn hôm nay), **Đơn mới** (F9). ≤1024px giỏ xuống dưới danh sách.
- **Lịch sử bán:** bảng `.ht` chữ 12,5px, `table-layout:fixed`, mỗi ô 1 dòng; đơn nhiều mặt hàng thì mỗi mặt hàng 1 dòng trong ô "Mặt hàng" (`tên × SL đvt`). Đơn hôm nay chỉ hiện giờ, đơn cũ hiện `dd/mm giờ`; mã đơn rút gọn (`Q1-0006`, tooltip đủ mã). Cột Khách / PID, bộ lọc ngày / dược sĩ / hình thức / đối soát, tổng QR – tiền mặt là `.xd`. Mobile còn Mã đơn / Mặt hàng / Tổng tiền.
- **Sổ hóa đơn (tối giản):** cột Hàng về chỉ ngày; cột NCC · Số HĐ 1 dòng tên NCC + "HĐ số"; số mặt hàng, VAT, người bàn giao, thanh tiến trình, ngày HĐ / PO, ghi chú, lọc NCC / khoảng ngày là `.xd`.
- **Danh mục hàng** (`modules/catalog.js`):
  - **File mẫu** `Vinmec_MauNhap_DanhMuc.xlsx` đúng 10 cột, theo thứ tự: `Mã hàng / Tên hàng / Nhóm hàng / Hàm lượng / Kho / Đơn vị tính / Giá bán / Số lượng tồn / Hạn sử dụng / Số lô` (hằng `HEAD`, 3 dòng mẫu `SAMPLE`). Xuất Excel dùng 10 cột đó rồi nối thêm các cột phụ (`EXTRA`: Mã SAP, GTIN, Hoạt chất, Tồn tối thiểu, ĐVT 2/3 + hệ số + giá, ĐVT bán mặc định, Trạng thái) để nhập lại không mất dữ liệu.
  - Nhập Excel: "Nhóm hàng" nhận chữ (Thuốc OTC / Thực phẩm chức năng / Vật tư y tế / Khác, hoặc OTC / TPCN / VTYT); "Kho" nhận "Kho Nhà thuốc" → Y001, "Kho nội trú" → Y003 hoặc mã kho. "Số lượng tồn" tính theo **ĐVT của dòng**: mặt hàng đã có và ĐVT là Hộp (hệ số 100) thì 3 → tồn 300 viên. HSD trống thì giữ HSD cũ nếu mặt hàng đã có, mặt hàng mới thì báo lỗi.
  - Form thêm / sửa chỉ hiện 10 trường như file mẫu; mã SAP, GTIN, hoạt chất, ĐVT lớn hơn (Vỉ/Hộp), ĐVT bán mặc định, tồn tối thiểu, ngừng bán nằm trong mục gập "Thông tin thêm". Khi sửa, số tồn chỉ đọc; nút "Điều chỉnh tồn" ngay dưới ô mở hộp điều chỉnh (bắt buộc lý do).
  - Bảng danh mục **không cuộn ngang**: `table-layout:fixed`, mỗi ô 1 dòng + `…` (tooltip có đủ chữ). Cột phụ tự ẩn theo **container query** `@container ct` (bề rộng thật của bảng, không phải màn hình), nên thu rèm là hiện lại đủ cột: ≤1068px ẩn Kho, ≤984px ẩn Số lô, ≤894px ẩn Hàm lượng + Nhóm, ≤700px chỉ còn Tên / Giá / Tồn / Sửa. Dòng sắp hết / cận hạn tô vàng, hết hàng / hết hạn tô đỏ, kèm chip có icon. Nhấp đúp một dòng để sửa.
  - Dữ liệu mẫu có hàm lượng cho mọi mặt hàng và 1 mặt hàng nhóm Khác (KH001). Dữ liệu mẫu cũ được `migrate()` bổ sung một lần (cờ `seq.demoCat2`).
- **Mã vạch:** `matchScan(raw)` khớp lần lượt GTIN (từ mã DataMatrix GS1 hoặc EAN), mã hàng, mã SAP.
  - Lô/HSD đọc từ DataMatrix được ưu tiên hơn lô/HSD trong danh mục.
  - GTIN mẫu dùng tiền tố `20` (dải dùng nội bộ của GS1), không trùng sản phẩm thật.
- **Xếp hạng gợi ý:** điểm fuzzy + số đơn có mặt hàng trong 60 ngày (`productFreq`).
  - Gõ ≤ 2 ký tự thì chỉ lấy kết quả khớp đầu từ hoặc chứa chuỗi (ngưỡng 80).
  - Tên người quen ở Sổ vay (`peopleFreq`): nhân viên 0,5 điểm; mỗi lần xuất hiện trong phiếu vay +1; trong 14 ngày gần đây +1.
- **AI (`core/ai.js`):**
  - Mọi lời gọi mạng đi qua `guard()`: địa chỉ không thuộc mạng nội bộ bị chặn, trừ khi bật `settings.ai.allowPublic`.
  - Ảnh hóa đơn chỉ giữ trong bộ nhớ, không lưu vào state.
  - XML hóa đơn điện tử (TT78 / QĐ 1450) được đọc trực tiếp, không cần OCR. Bỏ dòng `TChat` 3, 4 (chiết khấu, ghi chú).
  - Khi lưu hóa đơn từ OCR, mỗi ô máy đọc được mà dược sĩ giữ nguyên cộng vào `aiStats.ocr.kept`.
  - Khi thêm hàng bằng giọng nói, chọn đúng gợi ý đầu tiên thì cộng `aiStats.voice.top1`.
  - Chi tiết mô hình đề xuất và cách nghiệm thu: [docs/AI-cuc-bo.md](docs/AI-cuc-bo.md).

## 5. Thiết kế giao diện ("Medical modern")

- **Token màu** đặt trong `:root` của `app.css`:
  - màu chính teal `--primary #0b7a75`;
  - trạng thái: info `#1d6fd8`, success `#15803d`, warning `#b45309`, danger `#c62828`;
  - nhóm hàng: OTC xanh lá `--otc`, TPCN cam `--supp`, VTYT tím `--device`.
- **Font và khoảng chạm:** Be Vietnam Pro (Google Fonts). Vùng bấm tối thiểu `--tap: 44px`, nút lớn 48px.
- **Màu theo nghiệp vụ:** `route()` gán `#app[data-area=retail|loans|invoices|system]`, CSS đặt `--ac` / `--ac50` / `--ac100`: Bán lẻ teal `#0b7a75`, Sổ vay xanh dương `#2160c4`, Hóa đơn tím `#6d3fc0`, Khác xám `#475569`. Dùng cho viền trên thanh tiêu đề, icon trang `.page-ic`, mục đang chọn trên rail / rèm. Màu trạng thái (info / success / warning / danger) giữ nguyên ở mọi nghiệp vụ.
- **KPI:** màu theo icon (`.kpi-ic.info/warn/danger`, dùng `:has`), dải màu 4px bên trái, icon nền đặc, số đậm 800. Cỡ số tự co theo bề rộng thẻ (`container-type:inline-size`, `clamp(18px, 10.5cqi, 28px)`) để số tiền dài không tràn.
- **Rail + rèm:** rail rộng 76px (`--rail`), rèm rộng 232px (`--cur`). Mỗi mục có badge số lượng việc cần xử lý. Chip trạng thái sao lưu nằm cuối rèm, chấm màu tương ứng nằm trên rail.
- **Nổi bật mục hay dùng:** tông vàng `--hot #d97706`, nền `--hot-50` / `--hot-100`. Dùng cho mục `hot` trên rèm, chip tên người quen ở Sổ vay, ô do OCR điền (`.ai-fill`).
- **Giỏ hàng POS:** cột phải (`minmax(380px, 41%)`), mỗi mặt hàng cao ~57px (`.crow`: tên trên, ĐVT + giá nhỏ dưới). Màn 1440×900 thấy đủ 7 dòng không cần cuộn.
- **Hộp phím tắt dưới rèm** (`.cur-keys`): lưới 2 cột `max-content / 1fr`, phím không xuống dòng, chú thích tự xuống dòng, không tràn.
- **Biểu đồ Thống kê vay:** lề phải 58px cho nhãn "TB", nhãn trục X chỉ vẽ khi cách cột Dự báo ≥ 46px, tooltip bị kẹp trong khung.
- **Breakpoint:** 1380 / 1199 / 1024 / 767px.
  - Bảng rộng dùng `.table-wrap`.
  - Cột phụ ẩn trên mobile bằng `.hide-m`.
- **Trạng thái không chỉ dựa vào màu:** pill luôn có icon + chữ.
- **Biểu đồ** (Tổng quan, Thống kê vay) làm theo skill dataviz: chỉ dùng một màu, đầu cột bo 4px, lưới nhạt, có tooltip khi rê chuột, vùng giờ cao điểm 11–13h.
- **Lớp CSS hay dùng:**
  - nút: `.btn` (`primary|tonal|ghost|danger|sm|lg|xl|icon|block`);
  - form: `.field`, `.input`, `.select`, `.form-grid` + `.c3/.c4/.c5/.c6/.c8/.c12`;
  - bố cục và hiển thị: `.card`, `.kpis` / `.kpis.compact`, `.seg`, `.pill`, `.tag`, `table.t`, `.alert`, `.timeline`, `.kv`;
  - khối in: `#printArea .sign`.
- **Phím tắt:**
  - POS: F2 hoặc `/` tìm hàng, ↑ ↓ Enter chọn hàng trong danh sách, F3 nói (giọng nói), F4 thanh toán QR, F8 tiền mặt, F9 đơn mới;
  - Màn chọn nghiệp vụ (ngay sau khi vào ca): `1` Bán lẻ, `2` Sổ vay, `3` Sổ hóa đơn;
  - Hướng dẫn: → / Enter tiếp, ← quay lại, Esc bỏ qua;
  - Sổ vay: `N` tạo mã vay mới; khi tạo: F2 hoặc `/` về ô quét, Enter thêm thuốc, Esc bỏ thuốc vừa quét, Ctrl+Enter hoàn thành / lưu mã vay, Enter ở ô người cho vay thì lưu;
  - Sổ hóa đơn: `S` quét hóa đơn (XML / ảnh), `N` ghi tay, `Q` copy quyết toán trong ngày;
  - Esc đóng modal.

## 6. Sao lưu (4 lớp)

1. **Tự lưu ngay:** mỗi lần `save()` ghi thẳng vào localStorage.
2. **Snapshot trong IndexedDB:**
   - tạo mỗi `snapshotMinutes` phút nếu có thay đổi;
   - tạo khi mở app (nếu snapshot gần nhất đã quá 1 giờ), khi đóng tab, khi kết thúc ca, và trước khi khôi phục, nhập file hay xóa dữ liệu.
3. **Tự ghi vào thư mục** bằng `showDirectoryPicker`, chỉ có trên Chrome/Edge:
   - mỗi ngày một file `vinmec-pharmacy-backup_YYYY-MM-DD.json`;
   - mỗi lần mở trình duyệt phải cấp lại quyền ghi.
4. **Tải file `.json` thủ công:**
   - file có `checksum`;
   - trước khi khôi phục có bước xem trước, so sánh số bản ghi hiện tại với số bản ghi trong file.

Mức cảnh báo của `backup.status()`:

- `bad`: chưa có snapshot nào và cũng chưa từng tải file;
- `warn`: bản sao gần nhất nằm ngoài trình duyệt (thư mục hoặc file tải về) đã quá 24 giờ;
- `ok`: các trường hợp còn lại.

## 7. Bảo mật & quyền riêng tư (bắt buộc)

- Tài liệu khảo sát yêu cầu **xóa thông tin mật**. Vì vậy:
  - trong `docs/` chỉ ghi chức danh, không ghi tên thật;
  - dữ liệu mẫu và nhân viên mẫu đều là **tên hư cấu**;
  - không đưa tên nhân viên thật, PID hay thông tin bệnh nhân vào code hoặc docs.
- `.gitignore` đã chặn file sao lưu `*.json` và `*.xlsx` xuất ra, vì có thể chứa dữ liệu kinh doanh hoặc bệnh nhân. **Không commit các file đó.**
- **Quyền quản lý** (`admin`): sửa cài đặt, đặt lại app, hủy mọi đơn. Nhân viên thường chỉ hủy được **đơn của chính mình, trong ngày**.
- Chưa có mật khẩu hay PIN: chọn tên là vào ca. Phase 2 cần bổ sung.

## 8. Nhật ký thay đổi

### 18/11/2026 – Giao diện tối giản, Bán hàng chia đôi màn (nhánh `Duy`)

- **Bán hàng chia đôi:** trái là tab nhóm + ô "Tìm kiếm" + danh sách hàng (chọn bằng chuột hoặc ↑ ↓ Enter, máy quét vẫn thêm thẳng), phải là giỏ hàng + tổng + nút thanh toán, thấy 6–7 mặt hàng đã chọn không cần cuộn. Tiêu đề "Vinmec Pharmacy". Nút đổi tên: "Hàng ngoài DM" → **Thêm hàng mới**, "Excel hôm nay" → **Báo cáo trong ngày**.
- **Bỏ "Hay bán"** ở Bán hàng và Danh mục (cả CSS `.hot-btn/.hot-dd/.hot-i`). 5 tab nhóm hàng nằm trên 1 hàng, không bị che khi mở rèm.
- **Tối giản toàn app:** bỏ dòng chữ nhỏ dưới tiêu đề mọi màn; thông tin chi tiết (`.xd`) chỉ hiện khi bấm **Hiển thị tất cả** (lưu `vmhub.detail`). Áp dụng cho Bán hàng, Lịch sử bán, Danh mục, Sổ vay, Sổ hóa đơn. Ô tìm kiếm chỉ ghi "Tìm kiếm".
- **Lịch sử bán:** chữ nhỏ hơn, mỗi ô 1 dòng, đơn nhiều mặt hàng thì mỗi mặt hàng xuống 1 dòng; không còn ngày lặp hai lần trên một dòng (hôm nay chỉ hiện giờ).
- **Sổ hóa đơn:** mỗi dòng chỉ còn ngày về, NCC + số HĐ, sổ, tổng tiền, trạng thái, nút thao tác.
- **Sửa hiển thị:** hộp phím tắt dưới rèm bị tràn; biểu đồ Thống kê vay bị chèn nhãn (nhãn ngày đè "Dự báo", "TB" đè cột, tooltip ra ngoài khung); bảng Lịch sử bán trên mobile lệch tiêu đề cột; thanh nút trên cùng mobile xếp dọc.
- **Sửa lỗi:** màn vào ca gọi `focus()` lên phần tử đã bị gỡ nếu chuyển màn trong 30 ms (`app.js`).
- Kiểm tra: 61/61 bước OK, 2 lần liền, không lỗi JS; chụp màn 1440×900 và 390px.

### 18/11/2026 – Danh mục theo file mẫu, thanh phân loại + Hay bán, màu theo nghiệp vụ (nhánh `Duy`)

- **Thanh phân loại** dùng chung (`VM.ui.catBar`) ở Bán hàng và Danh mục: tab Thuốc / TPCN / Vật tư / Khác bên trái, nút **Hay bán** bên phải thả xuống danh sách xếp hạng. Bỏ dải chip "Hay bán" cũ ở POS (`#hotStrip`).
- **Nhóm hàng mới `other` (Khác)** và trường **`strength` (Hàm lượng)** cho mặt hàng.
- **Danh mục:** file mẫu Excel đúng 10 cột theo mẫu của khoa; form thêm mặt hàng chỉ 10 trường đó (phần còn lại gập trong "Thông tin thêm"); nhập Excel quy đổi tồn theo ĐVT của dòng; bảng hiện đủ thông tin trên một dòng, không cuộn ngang (container query ẩn bớt cột khi bảng hẹp); nút Điều chỉnh tồn trong form sửa.
- **Giao diện** (tham khảo các mẫu dashboard y tế, POS, bảng dữ liệu hiện đại): mỗi nghiệp vụ một màu nhấn; KPI nổi màu, số to hơn và tự co khi dài; chữ bảng 13,5px; pill có viền; nút chính dạng gradient; icon trang cạnh tiêu đề (ẩn ≤1380px); thanh nút trên cùng không xuống dòng ở 1280px.
- **Sửa lỗi:** đổi màn khi danh sách Hay bán đang mở thì listener Esc trên `document` còn lại và nuốt lần bấm Esc kế tiếp (VD không đóng được modal) → listener tự gỡ khi thanh đã bị gỡ khỏi trang.
- Kiểm tra: 57/57 bước OK, không lỗi JS; chụp màn 1440×900, 1280×800 và 390–420px.

### 18/11/2026 – Thống kê vay thuốc + Copy quyết toán trong ngày (nhánh `Duy`)

- **Thống kê vay thuốc** (màn mới `loanstats`): thuốc vay thường xuyên theo ngày / tuần / tháng, lọc chiều vay, biểu đồ theo kỳ (tổng hoặc từng thuốc), dự báo kỳ tới so với tồn nhà thuốc, xuất Excel. Nút "Thống kê" ở Sổ vay, mục con trên rèm.
- **Copy quyết toán trong ngày** ở Sổ hóa đơn (phím `Q`): copy Ngày hàng về / SL tổng / Số HĐ của mọi hóa đơn trong ngày, dán theo dòng hoặc theo cột, có xem trước. Nút In sổ / Xuất Excel ở thanh trên chuyển sang dạng chỉ icon cho vừa một hàng.
- Dữ liệu mẫu: thêm lịch sử vay ~10 tháng và 4 hóa đơn hàng về hôm nay; migrate bổ sung một lần cho dữ liệu mẫu cũ.
- **Sao lưu:** IndexedDB lên v2 với chỉ mục `at`; dọn snapshot cũ và đọc bản mới nhất không còn nạp cả 30 bản (trước đây mỗi lần snapshot đọc lại toàn bộ). Thêm `onversionchange` / `onblocked`.
- Kiểm tra: 47/47 bước OK, 2 lần liền, không lỗi JS; thử nâng cấp IndexedDB v1 có 32 bản → v2; chụp màn 1440×900 và 390px.

### 18/11/2026 – Sổ vay theo mã vay (nhiều thuốc một lần) + thông báo hoàn thành (nhánh `Duy`)

- **Sổ vay** làm lại thành 3 màn: màn đầu "Tạo mã vay mới" + danh sách theo mã vay; màn tạo mã vay (quét → số lượng → … → Hoàn thành vay thuốc → người vay / cho vay); trang chi tiết mã vay (thông số + lịch sử truy xuất từng thuốc, gạch sổ từng thuốc hoặc cả mã vay, sửa thông số, hủy).
- Dữ liệu: thêm `group`, `line`, `edits` cho dòng vay; store thêm `loanGroup`, `loanVouchers`, `voucherStatus`, `voucherOpen`, `loanCode(peek)`. Dữ liệu mẫu có mã vay 2–3 thuốc. Dữ liệu cũ vẫn đọc được (mỗi phiếu cũ = 1 mã vay).
- Mã vay đang tạo được giữ nháp (`vmhub.loanDraft.<userId>`), rời màn rồi quay lại vẫn còn.
- **Thông báo hoàn thành** `VM.ui.done` cho mọi thao tác xong: gạch sổ, tạo mã vay, xác nhận, hủy, sửa thông số, xuất file điều chuyển / Excel, thanh toán POS, ghi / bàn giao / nhập hóa đơn, lưu danh mục / tồn kho / cài đặt, đối soát, hủy đơn, sao lưu / khôi phục.
- Tour: thêm `tourKey` để mỗi màn con có hướng dẫn riêng.
- Kiểm tra: 35 bước chạy thử đều OK, không có lỗi JS; chụp màn 1440×900 và 390px.

### 18/11/2026 – Sổ vay 2 kho, quét mã trước khi nhập, chọn nghiệp vụ khi vào ca, hướng dẫn ban đầu (nhánh `Duy`)

- **Sổ vay:**
  - bỏ kho HO2 (kho chung toàn viện), chỉ còn Y001 ↔ Y003; chiều kho là 2 ô bấm để đảo;
  - bỏ ô chọn ĐVT: ĐVT lấy theo thuốc (ĐVT nhỏ nhất + hệ số quy đổi);
  - form khóa cho tới khi quét / chọn được thuốc.
- **Sổ hóa đơn:** ghi tay bắt đầu bằng bước quét mã hóa đơn (QR HĐĐT / chuỗi tra cứu / số HĐ), file XML, hoặc "chưa có HĐ". Thêm `VM.ai.parseInvoiceCode`, trường `sellerTax`, `invoiceSymbol`.
- **Vào ca:** sau khi chọn tên, hiện màn chọn 1 trong 3 nghiệp vụ (kèm số việc đang chờ, đánh dấu "Lần trước", phím 1/2/3, link Tổng quan, nút Đổi người).
- **Hướng dẫn ban đầu:** `core/tour.js` + thuộc tính `tour` trên POS, Sổ vay, Sổ hóa đơn. Có Bỏ qua, "Không hiện lại lần sau", nút ? để xem lại.
- **Kiểm tra:** 24 bước chạy thử, 2 lần liền đều OK, không có lỗi JS; chụp màn 1440×900 và 390px.

### 17/11/2026 – Xuất Excel mọi màn, file điều chuyển SAP dùng được ngay, copy nhanh 3 trường quyết toán (nhánh `Duy`)

- **Sổ vay:** viết lại file điều chuyển SAP:
  - đúng 9 cột của tool;
  - quy đổi số lượng về ĐVT nhỏ nhất;
  - LOT/DATE để trống; plans/Funds center cố định;
  - chặn phiếu thiếu mã SAP;
  - đánh dấu phiếu đã xuất;
  - thêm nút copy để dán thẳng vào tool.
- **Sổ hóa đơn:**
  - thêm khối "Nhập nhanh file quyết toán" (3 ô bấm để copy);
  - thêm trường `totalQty`;
  - nút copy trên từng dòng và copy hàng loạt;
  - sheet `Quyết toán` trong file Excel.
- **Xuất Excel bổ sung** cho các màn Bán hàng (đơn hôm nay), Tổng quan và Cài đặt.
- **util:** thêm `copyText`, `copyCells`, `tsv`.
- **Kiểm tra:** thêm 22 bước chạy thử. Hàm tải file được chặn lại để đọc ngược file .xlsx vừa tạo, kiểm tra tiêu đề và giá trị từng ô. Tất cả đều OK, không có lỗi JS.

### 17/11/2026 – Làm lại giao diện cho nhanh và chính xác, thêm quét mã / giọng nói / OCR (nhánh `Duy`)

- **Điều hướng:** bỏ sidebar 248px. Thay bằng rail 3 biểu tượng (Bán lẻ, Sổ vay, Hóa đơn) + "Khác", và rèm chức năng con thu gọn được. Router nhận `#/<id>/<arg>` để mở thẳng mục con, VD `#/loans/new`, `#/invoices/scan`.
- **Bán lẻ:**
  - ô tìm có danh sách gợi ý thả nổi ngay từ 1–2 ký tự, hàng hay bán đứng trước (★);
  - gõ được kèm số lượng: "2 para" hoặc "para x3";
  - máy quét mã vạch / DataMatrix thêm thẳng vào giỏ;
  - giỏ hàng mỗi mặt hàng một dòng, thấy đủ 6 dòng;
  - nhập bằng giọng nói (F3); nói nhiều mặt hàng thì mở hộp xác nhận từng dòng.
- **Sổ vay:** form 4 bước: quét mã → số lượng → người vay → người cho vay. Gợi ý tên người quen (danh sách thả nổi + chip). Thêm tab "Chờ xác nhận".
- **Sổ hóa đơn:**
  - nút "Quét hóa đơn": đọc file XML hóa đơn điện tử (chính xác 100%) hoặc ảnh qua OCR chạy trong mạng nội bộ;
  - ô do máy đọc tô vàng, hết vàng khi sửa;
  - so tổng tính được với tổng in trên hóa đơn.
- **Cài đặt:** thẻ "AI cục bộ" để chọn chế độ giọng nói, máy chủ OCR/STT, kiểm tra kết nối, xem độ chính xác đo tại khoa.
- **Danh mục:** thêm trường Mã vạch (GTIN), có kiểm tra số cuối và trùng mã. Nhập/xuất Excel có cột GTIN.
- **Quyền riêng tư:** chế độ giọng nói mặc định chuyển từ Web Speech thường (gửi âm thanh lên máy chủ Google) sang nhận dạng ngay trên máy.
- **Sửa lỗi khi chạy thử:**
  - thiếu `$$` trong `ui.js` làm rail không gắn được sự kiện;
  - Sổ vay tràn ngang trên mobile vì cột `1fr` không co được dưới bề rộng `<select>`, đổi sang `minmax(0,1fr)`.

### 17/11/2026 – Dựng Phase 1 (nhánh `Duy`)

- Sắp lại repo: dùng `git mv` chuyển `PRD_Vinmec_Retail_Pharmacy.md` vào `docs/` và `vinmec_retail_pharmacy.html` vào `legacy/` (prototype cũ, chỉ để tham chiếu).
- Thêm tài liệu:
  - `docs/Khaosat.md`: tổng hợp Google Doc khảo sát (TL;DR, AS-IS, điểm nghẽn, trường dữ liệu, ý tưởng, câu hỏi mở);
  - `docs/PLAN.md`: mục tiêu, vai trò, kiến trúc thông tin, design system, đặc tả module, lộ trình, tiêu chí nghiệm thu, rủi ro;
  - `README.md` và `.gitignore`.
- Viết toàn bộ thư mục `app/`: core (util, store, xlsx, backup, ui), 8 module (dashboard, pos, history, catalog, loans, invoices, backup-view, settings) và `app.js` (màn vào ca, kết thúc ca có tổng kết doanh thu ca và gợi ý tải bản sao lưu).
- Thiết kế lại giao diện so với `legacy/`:
  - menu chuyển sang sidebar bên trái;
  - nút to, rõ, có icon kèm chữ;
  - tông màu y tế teal;
  - KPI bấm được; trang "Cần chú ý" gom việc tồn đọng.
- Sửa lỗi phát hiện khi chạy thử:
  - `datalist` nằm trong `tbody` làm hỏng `tr:last-child` ở bảng nhân viên (Cài đặt);
  - `history.replaceState` lỗi khi trang có `<base>`, nên đã bọc `try` và chỉ chạy một lần;
  - thêm `VM.ui.teardown()` để gỡ phím tắt của màn hiện tại khi đăng xuất;
  - bảng sổ vay bị tràn: gộp cột, thao tác đặt dưới cột trạng thái;
  - số tiền và pill không xuống dòng; nút `.seg` không gãy dòng;
  - dữ liệu mẫu có thêm đơn hôm nay để biểu đồ không trống.

## 9. Việc còn mở

**Cần bệnh viện xác nhận** (xem thêm Khaosat §6 và PLAN §10):

1. Giá trị **plans / Funds center** của Y001, Y003. Hiện đang để trống trong Cài đặt. (HO2 đã bỏ khỏi sổ vay theo yêu cầu khoa ngày 18/11/2026.)
2. ~~Thứ tự cột của tool điều chuyển SAP~~: đã xác nhận ngày 17/11/2026. Còn cần kiểm tra:
   - tool nhận số lượng theo **ĐVT nhỏ nhất** hay theo ĐVT khác (app đang mặc định quy đổi về ĐVT nhỏ nhất);
   - giá trị plans / Funds center cố định thật là gì (đang để `1000`).
3. Sổ vay là "lấy tạm" hay "khoản nợ thuốc"? Hiện app hỗ trợ cả hai nhờ gạch sổ từng phần.
4. Tài khoản ngân hàng nhận tiền qua QR; ai được quyền sửa giá bán lẻ.
5. Mỗi thuốc có một hay nhiều mã SAP? SAP/OH có API hoặc cơ chế import/export không?

**Phase 2 – thử nghiệm tại khoa:**

- PIN cho từng nhân viên;
- dùng giá hợp đồng để cảnh báo lệch giá;
- in mã QR cho kệ hoặc lô hàng;
- kiểm kê.

**Phase 3:**

- backend dùng chung cho nhiều máy, thay localStorage;
- tích hợp OH/SAP;
- đối soát QR tự động.

## 10. Lưu ý về Git

- Nhánh làm việc: `Duy`. Nhánh chính: `main`.
- **Chỉ commit hoặc push khi người dùng yêu cầu.**
- Khi viết file này, hầu hết thay đổi đã được stage, riêng file PRD và file HTML cũ ở thư mục gốc đang hiện là ` D`. Lý do: bản mới đã được stage trong `docs/` và `legacy/`, còn thao tác xóa bản cũ thì chưa. Trước khi commit, chạy `git add -A` để Git ghi nhận đây là thao tác đổi tên/di chuyển file.
