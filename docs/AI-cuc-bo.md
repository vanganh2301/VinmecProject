# AI cục bộ cho Nhà thuốc: giọng nói (STT) và OCR hóa đơn

Tài liệu dành cho Khoa Dược và bộ phận CNTT bệnh viện, để chọn và nghiệm thu mô hình nhận dạng giọng nói (bán lẻ) và đọc hóa đơn (Sổ hóa đơn).

**Yêu cầu gốc:**
- dữ liệu hóa đơn và giọng nói **không được rời khỏi bệnh viện**, và không bên nào được thu thập dữ liệu người dùng;
- độ chính xác phải cao và **có bằng chứng đo được**.

Cập nhật: 17/11/2026.

---

## 1. Kết luận ngắn

| Việc | Khuyến nghị | Vì sao |
|---|---|---|
| Hóa đơn điện tử | **Đọc file XML**, không OCR | Hóa đơn điện tử theo TT78 luôn có file XML theo định dạng của Tổng cục Thuế (QĐ 1450). Đọc trực tiếp nên đúng 100%, không cần máy chủ. App đã làm sẵn |
| Hóa đơn giấy / ảnh chụp | **Qwen2.5-VL-7B** chạy trên máy chủ nội bộ (Ollama hoặc vLLM) | Điểm OCR công bố cao (DocVQA 95.7, OCRBench 864), giấy phép Apache-2.0, trả JSON có cấu trúc |
| Phương án nhẹ hơn cho hóa đơn ảnh | **PaddleOCR-VL** (0.9B) | Hỗ trợ 109 ngôn ngữ, có tiếng Việt, chạy được trên GPU nhỏ |
| Giọng nói, không cần máy chủ | **Nhận dạng ngay trên máy** của Chrome/Edge (on-device) | Âm thanh không rời máy. Phụ thuộc trình duyệt đã có gói tiếng Việt |
| Giọng nói, độ chính xác ổn định | **PhoWhisper** (VinAI) qua whisper.cpp, hoặc **Zipformer-30M** qua sherpa-onnx, đặt trên máy chủ nội bộ | Mô hình huấn luyện riêng cho tiếng Việt, có WER công bố trên nhiều bộ dữ liệu |
| Không dùng | Web Speech API thường của Chrome; API đám mây (OpenAI, Google, FPT.AI…) | Âm thanh hoặc ảnh được gửi ra ngoài bệnh viện |

**Điểm quan trọng nhất:** hiện **chưa có bộ đo công khai nào cho hóa đơn dược phẩm tiếng Việt**. Các điểm số công bố chỉ cho biết mô hình nào đáng thử. Quyết định cuối cùng phải dựa trên phép đo bằng hóa đơn và giọng nói thật tại khoa (mục 4). App đã tự ghi số đo này.

---

## 2. Bằng chứng đo lường công khai

### 2.1. Nhận dạng giọng nói tiếng Việt

WER (Word Error Rate) là tỉ lệ từ nhận sai. **Càng thấp càng tốt.**

| Mô hình | Kích thước | Kết quả công bố | Nguồn |
|---|---|---|---|
| PhoWhisper-large | ~1.5B | WER: VIVOS **4.7%**, CMV-Vi 8.1%, VLSP2020 T1 13.8%, VLSP2020 T2 26.7% | Bài báo VinAI, arXiv 2406.02555 |
| wav2vec2 tiếng Việt (mốc so sánh trong cùng bài) | ~300M | VIVOS 10.8% | như trên |
| PhoWhisper-medium / small | 769M / 244M | O-WER **14.07** / **14.37** trên bảng xếp hạng ASR tiếng Việt mở | Vietnamese Open ASR Leaderboard |
| Zipformer-30M-RNNT-6000h | ~30M | WER VLSP2020 T1 **12.29%**, GigaSpeech2 7.56% | Trang mô hình trên Hugging Face |
| Qwen3-ASR-0.6B | 0.6B | FLEURS-vi 9.21% (thẻ mô hình của bên thứ ba, chưa kiểm chứng độc lập) | Trang mô hình trên Hugging Face |

**Đọc số liệu thế nào:**
- PhoWhisper-large chính xác nhất nhưng cần GPU. Bản small/medium chạy được trên CPU máy chủ, chậm hơn.
- Zipformer-30M rất nhẹ, chạy được bằng CPU, thậm chí ngay trong trình duyệt (WebAssembly), và sai số trên VLSP2020 ngang PhoWhisper-large.
- VLSP T2 là dữ liệu nhiễu, gần với môi trường quầy thuốc ồn ào. Tại đây mọi mô hình đều kém hơn rõ rệt, nên **cần đo lại tại quầy**.
- Lệnh bán hàng thường ngắn ("Paracetamol hai vỉ"). App còn khớp mờ với danh mục, nên chỉ cần nhận đúng **mặt hàng** là đủ, không cần đúng từng chữ. Vì vậy chỉ số nên đo là **tỉ lệ chọn đúng ngay gợi ý đầu (top-1)**, không chỉ WER.

### 2.2. OCR / hiểu tài liệu

| Mô hình | Kích thước | Kết quả công bố | Nguồn |
|---|---|---|---|
| Qwen2.5-VL-7B | 7B | DocVQA **95.7**, OCRBench **864** | Báo cáo kỹ thuật Qwen2.5-VL, arXiv 2502.13923 |
| PaddleOCR-VL | 0.9B | ~92.9 điểm tổng trên OmniDocBench v1.5 (theo bản tóm tắt của bên thứ hai); 109 ngôn ngữ có tiếng Việt | arXiv 2510.14528 |
| Vintern-1B | 1B | Mô hình thị giác–ngôn ngữ tinh chỉnh cho tiếng Việt, có kết quả trên các bộ VQA tiếng Việt | arXiv 2408.12480 |
| PaddleOCR + VietOCR + PICK | — | Hướng dùng phổ biến trong nhóm dẫn đầu cuộc thi MC-OCR 2021 về **hóa đơn bán lẻ tiếng Việt** | Bài tổng kết MC-OCR 2021 |

**Đọc số liệu thế nào:**
- DocVQA và OCRBench là bộ đo tài liệu tiếng Anh/Trung là chính. Hóa đơn tiếng Việt có dấu, nhiều bảng, nhiều số, nên kết quả thực tế sẽ thấp hơn.
- MC-OCR 2021 gần với bài toán nhất (hóa đơn tiếng Việt). Nhưng đó là hóa đơn bán lẻ, không phải hóa đơn GTGT dược phẩm nhiều dòng có lô và hạn dùng.

---

## 3. Bảo mật: vì sao các phương án trên an toàn

- **Mô hình mã nguồn/trọng số mở, chạy trên máy chủ của bệnh viện.** Không bên nào nhận được ảnh hay âm thanh, kể cả nhà phát triển mô hình. Có thể chặn Internet của máy chủ AI bằng tường lửa.
- **App tự chặn ở phía trình duyệt** (`core/ai.js`, hàm `guard`). Chỉ gọi các địa chỉ trong mạng nội bộ:
  - `localhost`;
  - `10.x`, `192.168.x`, `172.16–31.x`;
  - tên miền nội bộ `.local` / `.lan` / `.internal` / `.intranet`, hoặc tên máy không có dấu chấm.
  - Muốn gọi ra ngoài phải được Quản lý bật riêng trong Cài đặt, và việc bật được ghi nhật ký.
- **Ảnh hóa đơn chỉ nằm trong bộ nhớ** trong lúc đối chiếu, không lưu vào dữ liệu app hay file sao lưu.
- **Web Speech API thường của Chrome gửi âm thanh lên máy chủ Google.** App không còn dùng chế độ này làm mặc định. Trong Cài đặt, chế độ này được ghi rõ là "gửi âm thanh ra ngoài".
- **Chế độ on-device:** Chrome/Edge bản mới cho phép nhận dạng giọng nói ngay trên máy (`processLocally`), sau khi tải gói ngôn ngữ một lần. Nếu máy chưa hỗ trợ tiếng Việt, app báo lỗi và gợi ý dùng máy chủ nội bộ, **không tự chuyển sang gửi đi**.

---

## 4. Nghiệm thu tại khoa: cách đo bằng dữ liệu thật

### 4.1. OCR hóa đơn

1. Lấy **50–100 hóa đơn giấy thật** đã nhập sổ (đủ NCC hay gặp, cả ảnh chụp điện thoại lẫn ảnh scan). Hóa đơn đã nhập tay chính là đáp án.
2. Mỗi hóa đơn chấm theo từng ô:
   - phần đầu: NCC, số hóa đơn, ngày;
   - từng dòng hàng: mã, tên, lô, hạn dùng, ĐVT, số lượng, đơn giá, thuế suất;
   - tổng tiền.
3. Chỉ tiêu đề xuất:
   - **≥ 98%** ô số (số lượng, đơn giá, tổng tiền) đúng tuyệt đối;
   - **≥ 95%** ô chữ đúng;
   - **100%** hóa đơn có tổng tiền khớp, hoặc lệch thì được app cảnh báo.
4. App tự tính số đo trong quá trình dùng thật, xem ở **Cài đặt → AI cục bộ → "Độ chính xác OCR thực tế"**:
   - Công thức: số ô dược sĩ giữ nguyên khi lưu / số ô máy đọc được.
   - Số này có thể thấp hơn thực tế, vì dược sĩ có thể sửa cả ô đã đúng (VD: viết lại tên cho gọn).

### 4.2. Giọng nói

1. Ghi **200 câu lệnh** thật tại quầy, có tiếng ồn nền, do ít nhất 3 dược sĩ đọc. Câu lệnh gồm tên thuốc, hàm lượng và số lượng, VD "Amoxicillin năm trăm hai vỉ".
2. Đo hai chỉ số:
   - **WER** trên bản chép tay;
   - **tỉ lệ top-1**: mặt hàng đứng đầu gợi ý có đúng không.
3. Chỉ tiêu đề xuất:
   - top-1 **≥ 90%**;
   - số lượng đúng **≥ 98%**;
   - thời gian từ lúc nói xong đến lúc ra kết quả **≤ 2 giây**.
4. App ghi tỉ lệ top-1 thực tế ở **Cài đặt → AI cục bộ**.

Chạy cùng một bộ dữ liệu cho 2–3 mô hình ứng viên rồi chọn mô hình tốt nhất. Lưu kết quả vào biên bản nghiệm thu, **không lưu ảnh hóa đơn hay file ghi âm** ra ngoài máy chủ nội bộ.

---

## 5. Gợi ý triển khai

**Máy chủ AI nội bộ** (một máy trong mạng bệnh viện):

| Thành phần | Phần cứng gợi ý | Lệnh khởi động tham khảo | Địa chỉ điền vào Cài đặt |
|---|---|---|---|
| OCR – Qwen2.5-VL-7B qua Ollama | GPU 16–24 GB VRAM (bản lượng tử hóa 4-bit cần khoảng 8 GB) | `ollama pull qwen2.5vl:7b` rồi `ollama serve` | `http://<ip>:11434/v1/chat/completions`, mô hình `qwen2.5vl:7b` |
| OCR – vLLM (nhiều máy dùng chung) | GPU 24 GB | `vllm serve Qwen/Qwen2.5-VL-7B-Instruct` | `http://<ip>:8000/v1/chat/completions` |
| Giọng nói – whisper.cpp + PhoWhisper | CPU 8 nhân hoặc GPU nhỏ | `whisper-server -m phowhisper-small.bin -l vi --port 8080` (mô hình PhoWhisper chuyển sang định dạng ggml) | `http://<ip>:8080/inference` |
| Giọng nói – sherpa-onnx + Zipformer-30M | CPU | Server của sherpa-onnx, hoặc bọc bằng API kiểu OpenAI `/v1/audio/transcriptions` | `http://<ip>:<cổng>/v1/audio/transcriptions` |

**Lưu ý:**
- Nếu mở app qua `file://`, máy chủ phải cho phép CORS, VD biến môi trường `OLLAMA_ORIGINS=*`, hoặc chỉ cho phép đúng origin của app. Cách gọn hơn là phục vụ app từ cùng máy chủ nội bộ.
- Trên máy chủ AI, tắt mọi tính năng gửi số liệu sử dụng (telemetry), và chặn kết nối ra Internet bằng tường lửa sau khi đã tải mô hình.
- Bấm **Cài đặt → AI cục bộ → "Kiểm tra kết nối"** để thử. Địa chỉ ngoài mạng nội bộ sẽ bị từ chối ngay.

---

## 6. Nguồn

- PhoWhisper (VinAI), bài báo: https://arxiv.org/pdf/2406.02555 · mã nguồn: https://github.com/VinAIResearch/PhoWhisper
- Vietnamese Open ASR Leaderboard: https://vietaudio-team-vietnamese-asr-leaderboard.hf.space/
- Zipformer-30M-RNNT-6000h: https://huggingface.co/hynt/Zipformer-30M-RNNT-6000h
- Nhận dạng tiếng Việt trong trình duyệt bằng sherpa-onnx (WASM): https://huggingface.co/coflar-ai/viet-asr
- Qwen3-ASR-0.6B (thẻ mô hình bên thứ ba): https://huggingface.co/vrfai/Qwen3-ASR-0.6B-int4
- Qwen2.5-VL, báo cáo kỹ thuật: https://arxiv.org/pdf/2502.13923
- PaddleOCR-VL: https://arxiv.org/pdf/2510.14528 · tóm tắt: https://alphaxiv.org/overview/2510.14528v4
- Vintern-1B: https://arxiv.org/pdf/2408.12480
- MC-OCR 2021 (hóa đơn tiếng Việt): https://people.cs.umu.se/sonvx/files/MCOCR_Preprint.pdf
- Nhận dạng giọng nói on-device trong Chrome:
  - https://developer.mozilla.org/docs/Web/API/SpeechRecognition/available_static
  - https://developer.mozilla.org/docs/Web/API/SpeechRecognition/install_static
  - https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss/c/Rlyc2uAsFCY
- Nhận dạng giọng nói trong Microsoft Edge: https://learn.microsoft.com/en-us/microsoft-edge/web-platform/speech-recognition-api
- QĐ 1450/QĐ-TCT (định dạng dữ liệu hóa đơn điện tử): https://thuvienphapluat.vn/van-ban/thue-phi-le-phi/quyet-dinh-1450-qd-tct-2021-thanh-phan-chua-du-lieu-nghiep-vu-hoa-don-dien-tu-490526.aspx
