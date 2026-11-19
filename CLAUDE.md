# CLAUDE.md – Vinmec Pharmacy Hub

## ▶ Lệnh chạy nhanh trên máy (local)

Không cần build, không cần `npm install`. Cần Python 3 (máy này có 3.12) hoặc Node.js.

**Cách 1 – không cần terminal:** nhấp đúp file **`chay.bat`** ở thư mục gốc repo. Cửa sổ đen hiện lên và trình duyệt tự mở app. Đóng cửa sổ đó là dừng app.

**Cách 2 – terminal (PowerShell, cmd hay Git Bash đều được).** Copy nguyên dòng dưới, dán vào terminal, Enter. Chạy được từ **bất kỳ thư mục nào**:

```
python "D:\55 Vinmec\VinmecProject\serve.py"
```

Nếu đang đứng sẵn ở thư mục repo thì gõ ngắn:

```
python serve.py
```

`serve.py` tự làm 3 việc: tìm thư mục `app/`, chọn cổng trống (8090, bận thì 8091…), mở trình duyệt khi server đã sẵn sàng. Terminal sẽ đứng ở dòng "đang chạy" – **đó là bình thường**, cứ để cửa sổ đó mở trong lúc dùng app.

| Việc                                  | Lệnh / thao tác                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| Dừng app                              | Bấm **Ctrl + C** trong cửa sổ đang chạy, hoặc đóng cửa sổ              |
| Không tự mở trình duyệt           | thêm `--no-open` vào cuối lệnh                                                   |
| Chọn cổng khác                      | thêm `--port 8095` vào cuối lệnh                                                 |
| Cho máy khác cùng Wi-Fi mở được | thêm `--lan` (micro / giọng nói vẫn cần HTTPS, xem bản Vercel)                 |
| Không có Python, dùng Node          | `npx serve "D:\55 Vinmec\VinmecProject\app" -l 8090` rồi mở http://127.0.0.1:8090/ |
| Mở thẳng file, không server         | nhấp đúp `app\index.html` (dữ liệu tách riêng với bản chạy qua server)     |

Dừng server đang chiếm cổng 8090 khi đã lỡ đóng mất cửa sổ (PowerShell):

```
Get-NetTCPConnection -LocalPort 8090 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

Kiểm tra cú pháp mọi file JS (PowerShell):

```
Get-ChildItem "D:\55 Vinmec\VinmecProject\app\assets\js" -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Kiểm tra cú pháp (Git Bash / macOS / Linux, đứng ở thư mục repo):

```
for f in app/assets/js/core/*.js app/assets/js/modules/*.js app/assets/js/app.js; do node --check "$f"; done
```

**Vì sao lệnh cũ hay hỏng** (đừng lặp lại khi viết lệnh mới vào file này):

- `python -m http.server … -d app` dùng đường dẫn tương đối: mở terminal ở thư mục khác thì server vẫn chạy nhưng trang báo **404**.
- Đường dẫn có dấu cách (`55 Vinmec`): `cd d:\55 Vinmec\VinmecProject` không có ngoặc kép sẽ lỗi. Luôn bọc đường dẫn trong `"…"`.
- Copy lệnh từ ô bảng dính dấu `` ` ``: với PowerShell đó là ký tự thoát, terminal hiện `>>` và đứng chờ. Lệnh để copy luôn đặt trong khối code riêng, mỗi khối một lệnh.
- Khối nhiều dòng "chạy server rồi mở trình duyệt": dòng server chiếm terminal nên dòng mở trình duyệt không bao giờ chạy.
- Trên Windows, Python mặc định cho 2 server cùng nghe một cổng (`SO_REUSEADDR`), trình duyệt trúng server cũ. `serve.py` giữ cổng độc quyền (`SO_EXCLUSIVEADDRUSE`).

**Lưu ý khi dùng:**

- Địa chỉ app: **http://127.0.0.1:8090/**. `serve.py` tắt cache (`Cache-Control: no-store`), sửa code xong chỉ cần F5.
- Dữ liệu nằm trong localStorage **theo địa chỉ**: `http://127.0.0.1:8090`, `http://127.0.0.1:8091`, `http://localhost:8090` và `file://` là các bộ dữ liệu riêng. Muốn làm lại từ dữ liệu mẫu: Khác → Sao lưu & khôi phục → "Đặt lại ứng dụng" (gõ `XOA`), hoặc DevTools → Application → Local Storage → xóa các khóa `vmhub.*`.
- Ảnh QR (VietQR) và font Google cần Internet. Phần còn lại chạy offline.
- Dùng Chrome hoặc Edge (tự ghi thư mục sao lưu chỉ có trên 2 trình duyệt này).

## ▶ AI (OCR hóa đơn + giọng nói): điền khóa, thử, đánh giá

App gọi AI qua máy chủ `api/` (không bao giờ gọi thẳng từ trình duyệt), hỗ trợ **OpenAI, Google Gemini, Qwen (Alibaba Cloud)** và **Qwen tự cài** (Ollama / vLLM). Cần Node.js ≥ 20. Không có bước build.

1. Mở file `.env` ở thư mục repo (đã tạo sẵn, khóa để trống; mẫu đầy đủ ở `.env.example`) bằng Notepad, điền khóa nào có. Để trống khóa nào thì bỏ qua nhà cung cấp đó. `.env` đã bị `.gitignore` và `.vercelignore` chặn.
2. Chạy app + AI trên máy (http://127.0.0.1:8095, dữ liệu riêng với `serve.py`). Đứng ở thư mục repo:

```
npm run dev
```

3. So sánh các nhà cung cấp trên cùng bộ mẫu. Tạo bộ mẫu mô phỏng một lần (thêm ` -- --tts` để tạo cả giọng đọc máy bằng OpenAI):

```
npm run eval:samples
```

```
npm run eval
```

Kết quả: `eval/results/<thời điểm>.md` (bảng tổng hợp) và `.json` (từng lần gọi). Tùy chọn: `npm run eval -- --only ocr`, `--provider gemini,qwen`, `--runs 2`, `--limit 5`. Mẫu thật (ảnh hóa đơn đã che thông tin, ghi âm của dược sĩ) đặt vào `eval/samples/ocr|stt/` theo hướng dẫn đầu file `tools/eval.mjs`; `eval/samples/` và `eval/results/` không lên git.

Trong app: Khác → Cài đặt → thẻ AI → chọn "AI của app" rồi chọn **Nhà cung cấp OCR / giọng nói** (Tự động = theo `AI_OCR_PROVIDER` / `AI_STT_PROVIDER`; trống thì cái đầu tiên có khóa theo thứ tự OpenAI → Gemini → Qwen → tự cài). Bảng "độ chính xác theo nhà cung cấp" đo trên thao tác thật của dược sĩ.

## ▶ Bản trên Vercel (dùng trên điện thoại)

Vercel phục vụ `app/` làm trang tĩnh và chạy `api/*.js` làm máy chủ AI. Cấu hình ở `vercel.json`, `.vercelignore`, `package.json`.

Lần đầu (PowerShell, mỗi lệnh một lần):

```
cd "D:\55 Vinmec\VinmecProject"
```

```
npx vercel login
```

```
npx vercel link --yes
```

Đưa khóa trong `.env` lên Vercel (không in giá trị khóa ra màn hình), rồi deploy:

```
npm run env:push
```

```
npm run deploy
```

**Đã deploy (19/11/2026): https://vinmec-pharmacy.vercel.app** (project Vercel `vinmec-pharmacy`, máy này đã liên kết sẵn trong `.vercel/`). Hai lưu ý khi liên kết lại ở máy khác:

- `npx vercel link --yes` báo lỗi tên project vì tên thư mục `VinmecProject` có chữ hoa → dùng `npx vercel link --yes --project vinmec-pharmacy`.
- Vercel CLI tự nối `.vercel` và `.env*` vào cuối `.gitignore`; dòng `.env*` đè lên `!.env.example` làm file mẫu biến mất khỏi git → xóa 2 dòng đó (`.gitignore` đã chặn `.vercel/`, `.env`, `.env.*` sẵn).

Lệnh deploy in ra địa chỉ `https://….vercel.app`: mở trên điện thoại bằng Chrome (Android) hoặc Safari (iPhone), cho phép micro / camera khi được hỏi. Có thể "Thêm vào màn hình chính" để mở như app.

- Sửa code: chạy lại `npm run deploy`. Đổi khóa / mô hình trong `.env`: `npm run env:push` rồi `npm run deploy` (biến mới chỉ áp dụng cho bản deploy sau).
- Kiểm tra máy chủ AI: mở `https://<địa chỉ>/api/health` → `"ready": true`, trong `providers` nhà cung cấp nào có `"ready": true` là đã có khóa. Trong app: Khác → Cài đặt → thẻ AI hiện "Sẵn sàng · …".
- Bản Vercel không gọi được Qwen tự cài trong mạng nội bộ (`LOCAL_AI_URL`); chỉ `npm run dev` / `npm run eval` dùng được.
- Dữ liệu vẫn nằm trong localStorage **của từng điện thoại** (chưa đồng bộ giữa các máy – việc của Phase 3). Muốn mang dữ liệu từ máy bàn sang: tải file sao lưu ở máy bàn → mở trên điện thoại → Sao lưu & khôi phục → khôi phục từ file.
- Địa chỉ Vercel là **công khai**, app chưa có mật khẩu (chọn tên là vào ca). Đừng nhập dữ liệu bệnh nhân thật lên bản này cho tới khi có đăng nhập (Phase 2). Đặt giới hạn chi tiêu cho từng khóa (OpenAI → Limits; Google AI Studio / Alibaba Model Studio → hạn mức dự án). Khóa Gemini **gói miễn phí** cho phép Google dùng dữ liệu để cải tiến sản phẩm: không dùng gói này cho hóa đơn thật.

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
  - **Test AI của app** (18/11/2026): không chạy được qua `file://` (cần `api/` cùng tên miền). Dùng một server Node nhỏ trong scratchpad: phục vụ `app/`, `import()` đúng `api/*.js` và gọi `POST(new Request(…))`, thay `globalThis.fetch` tới `api.openai.com` bằng bản giả có ghi lại request; trang test chèn `VM.isHosted = () => true` ngay sau `util.js`. Lái Chrome headless qua DevTools Protocol (WebSocket có sẵn trong Node 22), **không** dùng `--virtual-time-budget` (MediaRecorder cần thời gian thật), thêm `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` để có micro giả. Fetch giả thay cho cả `generativelanguage.googleapis.com` và `dashscope`; đổi khóa qua `/__ctl?nokey|key|qwen|fail=N`. Kết quả (19/11/2026, nhiều nhà cung cấp): 35/35 bước + 2 bước migrate + 10 bước kiểm tra máy chủ (Origin lạ 403, quá cỡ 413, thiếu khóa 503…), 4 lần liền, không lỗi JS. Thử `tools/eval.mjs`: gán `globalThis.fetch` giả rồi `import()` với `--samples <thư mục scratchpad>` (để kết quả không rơi vào `eval/results/` của repo).
  - Lần chạy trước (18/11/2026, sau khi làm giao diện tối giản + chia đôi màn Bán hàng): **61/61** bước đều OK, 2 lần liền, không có lỗi JS. Bước mới / sửa: tab Thuốc lọc danh sách `#posRes` chỉ còn OTC; tiêu đề "Vinmec Pharmacy", ô "Tìm kiếm", không còn Hay bán, nút đổi tên, 5 tab trên 1 hàng, giỏ nằm bên phải; gõ tên + Enter / ↓ Enter / quét mã hàng thêm vào giỏ; 6 mặt hàng trong giỏ thấy hết không cuộn và nút thanh toán không khuất (1440×900); nút "Hiển thị tất cả" ẩn/hiện `.xd` và lưu `vmhub.detail`; Lịch sử bán mỗi mặt hàng 1 dòng, không cuộn ngang.
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

| File                                                           | Xuất ra                                                                                                                                                                                                                                                                         | Vai trò                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/util.js`                                               | `VM.$, $$, esc, icon, money, num, fmtDate, fmtDT, ymd, iso, daysUntil, hoursSince, ago, parseDate, parseNum, normalize, search, uid, debounce, download, sum, fileStamp, gs1, gtinKey, gtinCheck, isLocalUrl…`                                                                | Tiện ích. `search()` là fuzzy, bỏ dấu tiếng Việt. `gs1()` đọc mã DataMatrix GS1 (AI 01/17/10/21). `isLocalUrl()` nhận diện địa chỉ trong mạng nội bộ                                                                                                                                                                                                                                        |
| `core/store.js`                                              | `VM.store`                                                                                                                                                                                                                                                                     | State duy nhất, lưu vào localStorage, nhật ký (audit), dữ liệu mẫu, quy tắc nghiệp vụ. Thêm `matchScan(raw)`, `productFreq()`, `topProducts(n)`, `peopleFreq()`, `LOAN_STORES` / `loanStores()` (chỉ Y001, Y003), `loanGroup(l)`, `loanVouchers(list?)`, `voucherStatus(lines)`, `voucherOpen(v)`, `loanCode(peek)`, `CATEGORIES` (otc / supp / device / other) + `catOf(p)` |
| `core/xlsx.js`                                               | `VM.xlsx.exportXlsx(sheets, filename)`, `readTable(file)`                                                                                                                                                                                                                    | Tự ghi/đọc .xlsx (zip không nén) và CSV, không cần thư viện                                                                                                                                                                                                                                                                                                                                               |
| `core/backup.js`                                             | `VM.backup`                                                                                                                                                                                                                                                                    | Snapshot IndexedDB, file JSON có checksum FNV-1a, ghi thư mục bằng File System Access API                                                                                                                                                                                                                                                                                                                       |
| `core/ai.js`                                                 | `VM.ai = { MODES, OCR_MODES, PROVIDERS, health, usesApp, listen, ocrInvoice, parseXmlInvoice, parseInvoiceCode, track, pct, ping, sttSupported }`                                                                                                                              | Giọng nói và OCR gọi máy chủ nội bộ (hàm `guard` chặn địa chỉ ngoài), hoặc **AI của app** (`api/stt`, `api/ocr` trên Vercel / `npm run dev` → OpenAI / Gemini / Qwen). Đọc XML hóa đơn điện tử và mã QR / chuỗi tra cứu HĐĐT (`parseInvoiceCode`). Đo độ chính xác thực tế vào `state.aiStats`                                                            |
| `core/ui.js`                                                 | `VM.ui`                                                                                                                                                                                                                                                                        | Shell gồm thanh biểu tượng (rail) và rèm (curtain), hash router `#/<id>/<arg>`, modal, confirm, toast, `done` (thông báo hoàn thành), print, `register`, `suggest` (danh sách gợi ý thả nổi), `catBar` (tab nhóm hàng, dùng chung cho Bán hàng và Danh mục). Nút `#detailBtn` (Hiển thị tất cả / Thu gọn) và `#tourBtn` (?) trên thanh tiêu đề                       |
| `core/tour.js`                                               | `VM.tour = { start, auto, has, reset, clearSession, prefs, active }`                                                                                                                                                                                                           | Hướng dẫn ban đầu dạng spotlight. Tự chạy lần đầu mở mỗi màn có `tour`; lần đầu tiên kèm các bước chung của khung (rail, rèm, sao lưu, kết thúc ca, nút ?)                                                                                                                                                                                                                           |
| `modules/*.js`                                               | `VM.pos`, `VM.loans`, `VM.invoices`, `VM.catalog`                                                                                                                                                                                                                        | Mỗi màn là một module. `loan-stats.js` (id `loanstats`, nhóm `loans`) là màn Thống kê vay thuốc, nạp ngay sau `loans.js`                                                                                                                                                                                                                                                                         |
| `api/*.js` (gốc repo, **không** nằm trong `app/`) | Vercel Functions (ES module, `export function GET/POST(Request)`): `ocr.js`, `stt.js`, `health.js`, dùng chung `_lib.js`, `_prompt.js` (prompt OCR), `_providers.js` (OpenAI / Gemini / Qwen / tự cài); file bắt đầu bằng `_` không thành đường dẫn | Máy chủ AI của bản Vercel và `npm run dev`. `package.json` có `"type":"module"` cho thư mục này                                                                                                                                                                                                                                                                                                      |
| `tools/*.mjs`, `tools/prices.json`                         | `npm run dev`, `eval`, `eval:samples`, `env:push`                                                                                                                                                                                                                        | `dev.mjs` chạy app + `api/` ở cổng 8095 với khóa trong `.env`; `eval.mjs` chấm điểm các nhà cung cấp; `make-samples.mjs` sinh hóa đơn / câu nói mẫu hư cấu; `env-push.mjs` đẩy biến `.env` lên Vercel; `prices.json` giá tham khảo để tính chi phí                                                                                                                     |
| `serve.py`, `chay.bat`                                     | –                                                                                                                                                                                                                                                                               | Chạy app ở máy local (xem đầu file)                                                                                                                                                                                                                                                                                                                                                                            |
| `app.js`                                                     | `VM.app = { logout, start }`                                                                                                                                                                                                                                                   | Màn vào ca, khởi động, kết thúc ca                                                                                                                                                                                                                                                                                                                                                                           |

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

| Khóa                        | Nội dung                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `vmhub.state.v1`           | Toàn bộ state                                                                                                                   |
| `vmhub.session`            | Người đang trong ca                                                                                                            |
| `vmhub.draft.<userId>`     | Giỏ hàng POS đang dở                                                                                                          |
| `vmhub.lastUser`           | Người đăng nhập gần nhất                                                                                                   |
| `vmhub.curtain`            | Rèm chức năng đang mở (`1`) hay thu gọn (`0`). Thay cho `vmhub.sidebarMini` cũ                                       |
| `vmhub.lastDownload`       | Lần tải file sao lưu gần nhất                                                                                                |
| `vmhub.folderWrite`        | Lần ghi thư mục sao lưu gần nhất                                                                                            |
| `vmhub.lastHome`           | Nghiệp vụ chọn lần trước ở màn chọn nghiệp vụ (`pos` / `loans` / `invoices`), được đánh dấu "Lần trước" |
| `vmhub.tour.<userId>`      | Hướng dẫn ban đầu của từng người: `{off, seen:{<moduleId>:true, __shell:true}}`                                        |
| `vmhub.loanDraft.<userId>` | Mã vay đang tạo dở: `{items[], step:'scan'                                                                                    |
| `vmhub.loanStats`          | Lựa chọn ở màn Thống kê vay: `{g:'day'                                                                                      |
| `vmhub.detail`             | Nút "Hiển thị tất cả": `1` hiện thông tin chi tiết (`.xd`), `0` / không có = tối giản (mặc định)             |
| `vmhub.qtDay`              | Lựa chọn ở hộp Copy quyết toán trong ngày: `{by:'recv'                                                                     |

IndexedDB `vmhub-backup` (**version 2**) có 2 store: `snapshots` (giữ 30 bản, có chỉ mục `at`) và `kv` (handle của thư mục sao lưu).

- Dọn bản cũ (`prune`) và lấy bản mới nhất khi khởi động đều đi qua chỉ mục `at`, không nạp dữ liệu snapshot. Chỉ màn Sao lưu mới gọi `list()` (đọc hết).
- Nâng từ v1 lên v2 tự tạo chỉ mục. Kết nối có `onversionchange` → tự đóng để lần nâng cấp sau không bị tab cũ chặn; nếu bị chặn thì hiện toast nhắc đóng tab khác.

**Cấu trúc state** (`schema: 1`):

```
meta{createdAt,updatedAt,rev,demo}
settings{pharmacyName, counter, bank{bin,account,owner}, stores[{code,name,plant,fundsCenter}],
         suppliers[], loanOverdueHours=24, invoiceAlertDays=2, expiryWarnDays=90, priceDiffPct=5, snapshotMinutes=15,
         transfer{plant='1000', fundsCenter='1000', unit:'base'|'loan', fillLot=false},
         ai{stt:'off'|'local'|'server'|'app'|'cloud', ocr:'lan'|'app', ocrProvider, sttProvider /* 'auto'|'openai'|'gemini'|'qwen'|'local' */, sttUrl, ocrUrl, ocrModel, allowPublic=false}}
aiStats{ocr{docs,fields,kept}, voice{n,top1}, by{'ocr:<nhà cung cấp>/<mô hình>':{docs,fields,kept}, 'voice:<…>':{n,top1}}}   // độ chính xác đo tại khoa
staff[{id,name,role,store,admin}]
products[{id,code,sap,gtin,name,strength,ingredient,category:'otc'|'supp'|'device'|'other',group,store,units[{name,factor,price}],defaultUnit,stock,lot,expiry,minStock,active,image}]
sales[{id,code,createdAt,sellerId,sellerName,customer,pid,items[{productId,code,sap,name,lot,unit,factor,qty,price,listPrice,total,special,seller}],total,payment:'qr'|'cash',status,recon:'pending'|'done',demo}]
loans[{id,group,line,code,createdAt,createdBy,from,to,productId,itemCode,sap,name,unit,qty,lot,expiry,borrower,lender,note,confirmedBy,confirmedAt,returns[{at,qty,ref,by,note}],edits[{at,by,what}],cancelled,cancelReason,sapExport{at,by,qty,how}}]
      // mỗi phần tử là MỘT THUỐC; các thuốc cùng mã vay có chung `group` (VAY-yyyymmdd-001), `line` = 1,2,3…, `code` = group/line.
      // Dữ liệu cũ không có group → loanGroup(l) = l.code (mỗi phiếu cũ là 1 mã vay 1 thuốc).
invoices[{id,book:'OPD'|'IPD',receivedAt,supplier,sellerTax,invoiceSymbol,invoiceNo,invoiceDate,refNo,prNo,poNo,itemCount,receivedBy,pharmacyReceiver,nvdReceiver,nvdAt,grNo,
          subtotal,tax,total,totalQty,taxByRate,source:'xml'|'ocr',lines[{code,name,country,lot,expiry,unit,qty,price,discount,taxRate,amount}],status,history[{at,by,action}],note}]
seq{ VAY<yyyymmdd>, ORD<yyyymmdd>, demoLoanHist, demoQtDay, demoCat2, demoCat3 }   audit[{at,userId,user,action,entity,ref,detail}] (tối đa 3000 dòng)
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
- **Thanh toán QR (VietQR)** (gộp từ prototype POS của nhánh `main`):
  - Danh sách **ngân hàng** (`VM.store.BANKS`, mã BIN NAPAS) dùng chung cho Cài đặt và Bán hàng; `bankName(bin)`, `bankOwner(s)` (in hoa không dấu), `payMemo(code)`.
  - **Nội dung CK** = mã đơn bỏ ký tự đặc biệt (`ORD-20261119-Q1-0001` → `ORD20261119Q10001`), vì nhiều ngân hàng tự bỏ dấu `-`. Ô tìm ở Lịch sử bán vẫn khớp vì `normalize` bỏ dấu `-`.
  - Hộp thanh toán QR: ảnh QR + ngân hàng / số TK / chủ TK / nội dung CK, nút **Chép** cho số TK và nội dung CK. Mất mạng (`navigator.onLine === false`) thì báo ngay, có nút Thử lại, có mạng lại tự tải lại.
  - Chưa có tài khoản: pill vàng **"Chưa có TK QR"** trên đầu giỏ + nút "Nhập tài khoản nhận tiền" trong hộp thanh toán, mở hộp nhập tài khoản ngay tại quầy (`openBank` trong `pos.js`). **Chỉ Quản lý** được lưu (nhân viên thường thấy chỉ đọc); mỗi lần đổi ghi nhật ký `Đổi tài khoản nhận CK`.
  - **Không** có tài khoản mặc định (bản prototype dùng số TK mẫu `vietinbank 108876543210` – không đưa vào để tránh khách chuyển tiền vào tài khoản không phải của khoa).
  - Ảnh QR lấy từ `img.vietqr.io`, nên cần Internet.
- **Nhóm hàng** (`VM.store.CATEGORIES`): `otc` Thuốc OTC, `supp` Thực phẩm chức năng, `device` Vật tư y tế, `other` Khác. Mỗi nhóm có `label`, `short` (tag), `tab` (chữ trên tab), `icon`. `catOf(p)` trả nhóm của mặt hàng, nhóm lạ coi là `other`; `migrate()` cũng đổi nhóm không hợp lệ thành `other`.
- **Thanh phân loại** `VM.ui.catBar(el, { cat, counts(), onCat(k) })` → `{ set, refresh, cat }`: tab Tất cả / Thuốc / TPCN / Vật tư / Khác kèm số mặt hàng; bấm lại tab đang chọn thì về Tất cả. Ở Bán hàng: lọc danh sách hàng bên trái; ở Danh mục: lọc bảng. (Nút "Hay bán" đã bỏ theo yêu cầu khoa ngày 18/11/2026; `topProducts` vẫn còn trong store, dùng cho Tổng quan.)
- **Chế độ tối giản / "Hiển thị tất cả":** mặc định chỉ hiện thông tin cần để làm việc. Phần tử có lớp `.xd` bị ẩn bằng `.app:not(.show-all) .xd{display:none!important}`; nút `#detailBtn` trên thanh tiêu đề (chỉ hiện ở màn khai báo `detail: true`: Bán hàng, Lịch sử bán, Danh mục, Sổ vay, Sổ hóa đơn) bật lớp `show-all` trên `#app`, lưu `vmhub.detail` và phát sự kiện `window` `vm-detail`. Khi viết màn mới: thông tin phụ (mã hàng, lô, HSD, PID, ngày tương đối, bộ lọc ít dùng…) gắn `.xd`, không gắn cho thứ cần để thao tác. Đã bỏ dòng chữ nhỏ (`crumb`) dưới tiêu đề ở mọi màn.
- **Màn Bán hàng** (`modules/pos.js`), tiêu đề "Vinmec Pharmacy", chia đôi màn:
  - **trái** (`.pos-left`): thanh phân loại `#catBar`, ô `#posSearch` (chỉ ghi "Tìm kiếm") + nút micro, danh sách hàng `#posRes` (`.pr-i`: tag nhóm, tên, cảnh báo hết hàng / cận hạn, giá / ĐVT; mã hàng · tồn là `.xd`). Ô trống thì liệt kê cả nhóm (hàng còn bán trước, rồi theo `productFreq`). ↑ ↓ chọn dòng, Enter: thử `matchScan` trước (máy quét), không khớp thì thêm dòng đang tô; Esc xóa ô tìm;
  - **phải** (`aside.cart`, sticky): giỏ hàng `.crow` (tên + dòng nhỏ ĐVT / đơn giá, bước số lượng, thành tiền, xóa), mục gập "Khách hàng / PID", tổng tiền, 2 nút QR (F4) / Tiền mặt (F8). Màn 1440×900 thấy ≥ 6–7 mặt hàng cùng tổng và nút thanh toán;
  - nút trên cùng: **Thêm hàng mới** (hàng ngoài danh mục), **Báo cáo trong ngày** (Excel đơn hôm nay), **Đơn mới** (F9). ≤1024px giỏ xuống dưới danh sách.
  - **Cảnh báo tồn thấp:** pill vàng `#lowBtn` "N tồn thấp" trên đầu giỏ (mặt hàng đang bán có `stock ≤ minStock`, kể cả hết hàng), ẩn khi N = 0, không chiếm chỗ dòng hàng. Bấm → hộp liệt kê Tồn / Tối thiểu → "Mở Danh mục" (`#/catalog/alert`). Cập nhật mỗi lần vẽ lại giỏ.
- **Lịch sử bán:** bảng `.ht` chữ 12,5px, `table-layout:fixed`, mỗi ô 1 dòng; đơn nhiều mặt hàng thì mỗi mặt hàng 1 dòng trong ô "Mặt hàng" (`tên × SL đvt`). Đơn hôm nay chỉ hiện giờ, đơn cũ hiện `dd/mm giờ`; mã đơn rút gọn (`Q1-0006`, tooltip đủ mã). Cột Khách / PID, bộ lọc ngày / dược sĩ / hình thức / đối soát, tổng QR – tiền mặt là `.xd`. Mobile còn Mã đơn / Mặt hàng / Tổng tiền.
- **Sổ hóa đơn (tối giản):** cột Hàng về chỉ ngày; cột NCC · Số HĐ 1 dòng tên NCC + "HĐ số"; số mặt hàng, VAT, người bàn giao, thanh tiến trình, ngày HĐ / PO, ghi chú, lọc NCC / khoảng ngày là `.xd`.
- **Danh mục hàng** (`modules/catalog.js`):
  - **File mẫu** `Vinmec_MauNhap_DanhMuc.xlsx` đúng 10 cột, theo thứ tự: `Mã hàng / Tên hàng / Nhóm hàng / Hàm lượng / Kho / Đơn vị tính / Giá bán / Số lượng tồn / Hạn sử dụng / Số lô` (hằng `HEAD`, 3 dòng mẫu `SAMPLE`). Xuất Excel dùng 10 cột đó rồi nối thêm các cột phụ (`EXTRA`: Mã SAP, GTIN, Hoạt chất, Tồn tối thiểu, ĐVT 2/3 + hệ số + giá, ĐVT bán mặc định, Trạng thái) để nhập lại không mất dữ liệu.
  - Nhập Excel: "Nhóm hàng" nhận chữ (Thuốc OTC / Thực phẩm chức năng / Vật tư y tế / Khác, hoặc OTC / TPCN / VTYT); "Kho" nhận "Kho Nhà thuốc" → Y001, "Kho nội trú" → Y003 hoặc mã kho. "Số lượng tồn" tính theo **ĐVT của dòng**: mặt hàng đã có và ĐVT là Hộp (hệ số 100) thì 3 → tồn 300 viên. HSD trống thì giữ HSD cũ nếu mặt hàng đã có, mặt hàng mới thì báo lỗi.
  - Form thêm / sửa chỉ hiện 10 trường như file mẫu; mã SAP, GTIN, hoạt chất, ĐVT lớn hơn (Vỉ/Hộp), ĐVT bán mặc định, tồn tối thiểu, ngừng bán nằm trong mục gập "Thông tin thêm". Khi sửa, số tồn chỉ đọc; nút "Điều chỉnh tồn" ngay dưới ô mở hộp điều chỉnh (bắt buộc lý do).
  - Bảng danh mục **không cuộn ngang**: `table-layout:fixed`, mỗi ô 1 dòng + `…` (tooltip có đủ chữ). Cột phụ tự ẩn theo **container query** `@container ct` (bề rộng thật của bảng, không phải màn hình), nên thu rèm là hiện lại đủ cột: ≤1068px ẩn Kho, ≤984px ẩn Số lô, ≤894px ẩn Hàm lượng + Nhóm, ≤700px chỉ còn Tên / Giá / Tồn / Sửa. Dòng sắp hết / cận hạn tô vàng, hết hàng / hết hạn tô đỏ, kèm chip có icon. Nhấp đúp một dòng để sửa.
  - Dữ liệu mẫu có hàm lượng cho mọi mặt hàng và 1 mặt hàng nhóm Khác (KH001). Dữ liệu mẫu cũ được `migrate()` bổ sung một lần (cờ `seq.demoCat2`).
  - Thêm **26 mặt hàng gộp từ nhánh `main`** (`demoCatalogMain`, cờ `seq.demoCat3`): Panadol OTC009–013, TPCN04–09, Omron VTYT04–08, La Roche-Posay + Thái Dương KH002–011. Dược mỹ phẩm / Chăm sóc cá nhân xếp vào nhóm `other`, tên nhóm cũ giữ ở `group`. Hệ số ĐVT suy từ quy cách (VD Panadol Extra 15 vỉ × 12 viên → Hộp = 180). Thêm sau lịch sử bán mẫu nên không có đơn bán mẫu; tổng cộng 41 mặt hàng.
  - `#/catalog/alert` mở sẵn bộ lọc "Cần chú ý" (dùng cho cảnh báo tồn thấp ở Bán hàng).
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
- **AI của app (bản Vercel / `npm run dev`; OpenAI, Gemini, Qwen)** – chế độ `stt: 'app'` và `ocr: 'app'`:
  - Trình duyệt gọi `api/stt`, `api/ocr`, `api/health` (đường dẫn tương đối, cùng tên miền nên **không qua `guard()`**). Khóa nằm ở biến môi trường máy chủ (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `QWEN_API_KEY`, `LOCAL_AI_URL`), **không bao giờ** xuống trình duyệt hay vào git.
  - Request mang `provider` (`settings.ai.ocrProvider` / `sttProvider`, mặc định `auto`). `pick()` trong `api/_providers.js`: nhà cung cấp được yêu cầu nếu có khóa → `AI_OCR_PROVIDER` / `AI_STT_PROVIDER` → cái đầu tiên có khóa theo `ORDER` (openai, gemini, qwen, local). Phản hồi kèm `provider`, `model`, `ms`.
  - Mô hình: biến `*_OCR_MODEL` / `*_STT_MODEL` ghi được nhiều tên, cách dấu phẩy; app dùng tên **đầu tiên**, `npm run eval` thử **tất cả**. Mặc định: OpenAI `gpt-4.1-mini` / `gpt-4o-mini-transcribe`; Gemini `gemini-3.8-flash` / `gemini-3.5-flash-lite` (Interactions API, header `x-goog-api-key`); Qwen `qwen3-vl-plus` / `qwen3-asr-flash` (DashScope chế độ tương thích OpenAI, vùng Singapore); tự cài `qwen2.5vl:7b`.
  - `api/health` trả `{ok, ready, providers:{id:{label, ready, ocr[], stt[]}}, defaults:{ocr, stt}}`. Cài đặt → thẻ AI: 2 ô chọn nhà cung cấp (ẩn khi chế độ không phải `app`; nhà cung cấp chưa có khóa bị khóa và ghi "· chưa có khóa"), dòng trạng thái liệt kê nhà cung cấp sẵn sàng, bảng độ chính xác theo `aiStats.by`. Trạng thái đọc bản nháp `st.ai`, không đọc cài đặt đã lưu.
  - Máy chủ tự dựng prompt OCR (`api/_prompt.js`, giữ khớp với `PROMPT` trong `ai.js`), chỉ nhận ảnh `data:image/(jpeg|png|webp)` → không ai dùng ké làm chatbot. Chặn `Origin` khác tên miền app (403), thân > 4,4 MB (413). Lỗi 401 / 404 / 429 của nhà cung cấp đổi thành câu tiếng Việt.
  - Giọng nói: ghi âm tối đa 10 giây → WAV 16 kHz (`toWav16k`) → `api/stt`, kèm `prompt` = tên thuốc trong danh mục (xếp theo `productFreq`, ≤ 700 ký tự) để mô hình viết đúng tên biệt dược.
  - Ảnh OCR: JPEG 2000px / 0,85; nếu > 3,8 MB thì nén lại 1600px / 0,75 (Vercel nhận tối đa 4,5 MB). OCR đọc thêm `sellerTax` (MST bán) và `invoiceSymbol`. Thời gian chờ OCR 130 giây.
  - `VM.isHosted()` (util.js) = `window.VM_APP_API === true` (do `npm run dev` chèn vào trang) hoặc trang chạy https và không phải địa chỉ nội bộ. Dữ liệu mới khi có máy chủ AI mặc định `stt:'app', ocr:'app'`; chạy `serve.py` mặc định `stt:'local', ocr:'lan'` như cũ. `migrate()` chuyển `stt` `local`/`server` → `app` **một lần** cho dữ liệu cũ (chưa có `ai.ocr`) mở trên bản Vercel, VD khôi phục file sao lưu từ máy bàn; đồng thời bổ sung `ocrProvider` / `sttProvider` = `auto`.
  - `track()` cộng thêm vào `aiStats.by['ocr:<provider>/<model>']` / `['voice:…']` để so sánh nhà cung cấp trên dữ liệu thật.
  - **Đánh giá** (`npm run eval`): OCR chấm độ đúng từng trường đầu hóa đơn và dòng hàng, tỉ lệ "đúng cả 4 trường quyết toán" (số HĐ so nguyên chuỗi kể cả số 0 đầu, ngày, tổng SL, tổng tiền), số dòng hàng, JSON hợp lệ, thời gian (trung vị / p90), chi phí / 1.000 hóa đơn (`tools/prices.json`, giá `null` = "chưa có giá"); giọng nói chấm tỉ lệ đúng tên thuốc, WER / CER sau chuẩn hóa tiếng Việt (số → chữ). Lỗi 429 thử lại 1 lần sau 20 giây.
  - Chạy local bằng `serve.py` thì **không có** `api/` (chỉ là trang tĩnh): chế độ `app` sẽ báo "AI của app chỉ chạy trên bản Vercel hoặc khi mở bằng npm run dev".

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

- **Khóa AI** (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `QWEN_API_KEY`, `LOCAL_AI_KEY`) chỉ nằm trong file `.env` trên máy (đã bị `.gitignore` / `.vercelignore` chặn) và biến môi trường của Vercel. Không ghi vào code, `vercel.json`, `.env.example` hay localStorage; các script không in giá trị khóa ra màn hình.
- Chế độ "AI của app" gửi âm thanh / ảnh hóa đơn tới nhà cung cấp đã chọn. OpenAI API và gói trả phí của Gemini / Alibaba không dùng dữ liệu để huấn luyện theo mặc định; **gói miễn phí của Gemini thì có**. Bản chạy trong mạng bệnh viện vẫn dùng chế độ nội bộ (Qwen tự cài).
- Bộ mẫu đánh giá thật (`eval/samples/`) và kết quả (`eval/results/`) không lên git. Mẫu do `make-samples.mjs` sinh dùng NCC hư cấu có chữ "(MẪU)", MST 999000xxxx và dòng "MẪU THỬ – KHÔNG CÓ GIÁ TRỊ".
- Tài liệu khảo sát yêu cầu **xóa thông tin mật**. Vì vậy:

  - trong `docs/` chỉ ghi chức danh, không ghi tên thật;
  - dữ liệu mẫu và nhân viên mẫu đều là **tên hư cấu**;
  - không đưa tên nhân viên thật, PID hay thông tin bệnh nhân vào code hoặc docs.
- `.gitignore` đã chặn file sao lưu `*.json` và `*.xlsx` xuất ra, vì có thể chứa dữ liệu kinh doanh hoặc bệnh nhân. **Không commit các file đó.**
- **Quyền quản lý** (`admin`): sửa cài đặt, đặt lại app, hủy mọi đơn. Nhân viên thường chỉ hủy được **đơn của chính mình, trong ngày**.
- Chưa có mật khẩu hay PIN: chọn tên là vào ca. Phase 2 cần bổ sung.

## 8. Nhật ký thay đổi

### 19/11/2026 – Số tiền thanh toán không còn tràn, thử AI với khóa OpenAI thật (nhánh `Duy`)

- **Điện thoại (≤767px):** thành tiền từng dòng trong giỏ rơi vào cột 28px của nút × nên bị cắt → xếp lại `"nm nm x" / "st tt tt"`. Cột giỏ dùng `minmax(0,1fr)` thay `1fr`, đầu giỏ cho xuống dòng (pill "Chưa có TK QR" + "tồn thấp" từng kéo rộng cả trang). Tổng tiền, số tiền trong hộp thanh toán, tiền thối co theo bề rộng (`clamp`).
- **Máy tính:** cột thành tiền 88px cắt số ≥ 10 chữ số → `minmax(88px, max-content)`.
- **768–1024px:** nút trên thanh tiêu đề không co nên đẩy "Hiển thị tất cả" và "?" ra ngoài, phải kéo ngang ở Bán hàng / Danh mục / Sổ vay / Sổ hóa đơn → các nút chỉ còn icon ở khoảng này.
- Kiểm tra: đo `scrollWidth` của trang ở 10 màn (kể cả hộp thanh toán QR / tiền mặt) × 7 bề rộng (500–1440px), giỏ 4 mặt hàng × 999 (tổng 126.173.700 đ): không màn nào tràn (code cũ: 6 màn tràn ở 800px). QR 33/33 bước.
- **AI thật (chỉ có `OPENAI_API_KEY`):** `npm run eval -- --provider openai` trên 30 ảnh hóa đơn mô phỏng + 16 câu giọng máy: OCR `gpt-4.1-mini` đúng 98,0% số ô, quyết toán đúng cả 4 trường 90%, 0 lỗi gọi, ~6 s/HĐ, ≈ $1,8 / 1.000 HĐ; giọng nói `gpt-4o-mini-transcribe` đúng tên thuốc 94,4% (hay sai "Omeprazole"), 0,5 s, ≈ $0,16 / 1.000 lần. Gemini / Qwen chưa có khóa nên chưa so được.

### 19/11/2026 – Gộp phần thanh toán QR từ prototype POS nhánh `main` (nhánh `Duy`)

- Lấy từ `legacy/vinmec_ocp2_v1.html` (bản POS của nhánh `main`): sửa tài khoản nhận tiền ngay ở màn Bán hàng, hiện đủ ngân hàng / số TK / chủ TK, nút chép nội dung CK, nội dung CK không có dấu `-`, báo mất mạng khi tạo QR, tên chủ TK tự in hoa. Viết lại theo kiến trúc app (modal, `VM.store.log`, chỉ Quản lý được đổi tài khoản), không chép nguyên khối HTML.
- Danh sách ngân hàng chuyển từ `settings.js` sang `VM.store.BANKS`, thêm 12 ngân hàng (OCB, MSB, SeABank, LPBank, Eximbank…). Cài đặt cũng chuẩn hóa tên chủ TK khi lưu.
- Không lấy: số tài khoản mẫu mặc định, nút "mô phỏng mất mạng", bước "Kiểm tra đơn" riêng trước khi thanh toán.
- Kiểm tra: 33/33 bước (chưa có TK → pill + nút khóa, nhập TK báo lỗi / lưu bằng Enter / ghi nhật ký, URL VietQR đúng, chép, mất mạng → có mạng lại, hoàn tất đơn QR, gỡ listener, nhân viên thường chỉ đọc, Cài đặt dùng chung danh sách), không lỗi JS; chụp 1440×900 thấy mã VietQR thật tải về đúng số tiền và nội dung.

### 19/11/2026 – Nhiều nhà cung cấp AI (OpenAI / Gemini / Qwen) + công cụ đánh giá (nhánh `Duy`)

- **Máy chủ AI** (`api/_providers.js`, `_prompt.js`): OpenAI, Google Gemini (Interactions API), Qwen trên Alibaba Cloud (DashScope: `qwen3-vl-plus` / `qwen-vl-ocr`, `qwen3-asr-flash`) và Qwen tự cài (Ollama / vLLM, như thiết kế ban đầu). Chọn theo request → `AI_*_PROVIDER` → cái đầu tiên có khóa. `api/health` trả trạng thái từng nhà cung cấp.
- **Khóa trong `.env`** (mẫu `.env.example`): `npm run dev` chạy app + AI trên máy (cổng 8095), `npm run env:push` đẩy biến lên Vercel, `npm run deploy`.
- **App:** Cài đặt có 2 ô chọn nhà cung cấp OCR / giọng nói và bảng độ chính xác theo nhà cung cấp (`aiStats.by`); màn quét hóa đơn ghi rõ ảnh gửi tới nhà cung cấp nào.
- **Đánh giá:** `npm run eval:samples` sinh 30 ảnh hóa đơn hư cấu (5 kiểu: rõ, chụp nghiêng, xoay, mờ, tối) + 16 câu nói mẫu (`--tts` tạo giọng máy); `npm run eval` chấm OCR / giọng nói cho mọi nhà cung cấp × mô hình, ghi `eval/results/*.md`.
- **Sửa lỗi:** `track()` ghi nhầm `s.byProvider` thay vì `s.by`.
- Kiểm tra (fetch giả cho cả 3 nhà cung cấp): trình duyệt 35/35 bước, 4 lần liền, không lỗi JS; máy chủ 10/10 (Origin lạ 403, quá cỡ 413, thiếu khóa 503, chọn nhà cung cấp, lỗi 401 → tiếng Việt…); migrate 2/2; `eval.mjs` chấm đúng (số HĐ mất số 0 đầu bị tính sai, 429 thử lại, liệt kê lỗi). **Chưa chạy với khóa thật**: dạng request của Gemini Interactions / Qwen ASR, tên mô hình Qwen và giá Gemini / Qwen cần xác nhận ở lần `npm run eval` đầu tiên.

### 18/11/2026 – Sửa lệnh chạy local, AI giọng nói + OCR qua OpenAI, deploy Vercel (nhánh `Duy`)

- **Lệnh chạy:** lệnh cũ hỏng vì đường dẫn tương đối (`-d app` → 404 khi đứng sai thư mục), đường dẫn có dấu cách không bọc ngoặc kép, và dấu backtick dính khi copy từ bảng (PowerShell hiện `>>`). Thêm `serve.py` (tự tìm `app/`, tự chọn cổng trống, tự mở trình duyệt, tắt cache, giữ cổng độc quyền trên Windows) và `chay.bat` (nhấp đúp). Viết lại phần lệnh đầu file: mỗi lệnh một khối code.
- **AI của app:** thêm `api/ocr.js`, `api/stt.js`, `api/health.js` (Vercel Functions gọi OpenAI), chế độ `app` cho giọng nói và OCR trong `core/ai.js`, ô chọn OCR + trạng thái máy chủ trong Cài đặt. Bản Vercel mặc định dùng AI của app; chạy local vẫn mặc định không gửi gì ra ngoài.
- **Quyết định của người dùng (18/11/2026):** dùng OpenAI cho cả 2; chấp nhận gửi âm thanh / ảnh hóa đơn ra ngoài trên bản Vercel (khác khuyến nghị trong docs/AI-cuc-bo.md, đã ghi rõ ở đó); không đặt mã truy cập vì sau này mỗi tài khoản sẽ có đăng nhập.
- **Sửa lỗi:** hóa đơn nhập từ XML có `invoiceSymbol` nhưng form ghi hóa đơn không giữ lại.
- Kiểm tra: xem mục "Test AI của app" ở §2.

### 18/11/2026 – Hợp nhất nhánh `main` vào `Duy`

- `main` có 2 commit của một thành viên khác: prototype POS 1 file `vinmec_ocp2_v1.html` (bán hàng, thống kê trên màn bán, danh mục dạng thẻ có ảnh, sửa nhanh giá), sửa lớn `vinmec_retail_pharmacy.html`, đổi tên PRD thành "Vinmec Pharma (Retail POS)" (sau merge đã đổi lại thành **Vinmec Pharmacy** theo quyết định của khoa, khớp tiêu đề app), ~85 ảnh sản phẩm và 4 file Word khảo sát lấy từ website Nhà thuốc Long Châu.
- Merge commit `d8d85d2`: conflict duy nhất là `.gitignore` (gộp 2 bản). Thay đổi PRD / prototype cũ tự đi theo vào `docs/`, `legacy/`. `vinmec_ocp2_v1.html` chuyển vào `legacy/`. Ảnh + file Word **bỏ khỏi cây thư mục** (ảnh/giá của nhà thuốc khác, có bản trùng, ~31 MB); vẫn lấy lại được từ commit `5db369b`. Prototype trong `legacy/` vì thế sẽ thiếu ảnh cục bộ (nó tự lấy ảnh dự phòng từ CDN bên ngoài).
- Theo quyết định của khoa: **không** đưa ảnh sản phẩm vào `app/` (giữ tối giản, tránh vượt dung lượng localStorage); **giữ 4 nhóm hàng**; chỉ gộp 2 thứ: 26 mặt hàng mẫu và cảnh báo tồn thấp ở màn Bán hàng. Thống kê trên màn bán, dạng thẻ / ảnh, "đặt hàng bổ sung" (chỉ là toast giả), chế độ ngoại tuyến giả lập không đưa vào.
- Kiểm tra: 28 bước (41 mặt hàng, mã / GTIN không trùng, quy đổi tồn, 4 nhóm, pill + hộp tồn thấp, `#/catalog/alert`, mở mọi màn) + 4 bước migrate dữ liệu mẫu cũ, đều OK, không lỗi JS; chụp 1440×900 thấy đủ 6 mặt hàng trong giỏ + nút thanh toán.

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
