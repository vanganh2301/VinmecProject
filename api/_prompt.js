// Prompt dùng chung cho mọi nhà cung cấp AI. Giữ PROMPT khớp với PROMPT trong app/assets/js/core/ai.js
// (bản dùng cho máy chủ OCR nội bộ) – cùng mẫu JSON để app chỉ cần một bộ đọc kết quả.

export const OCR_PROMPT = `Bạn là công cụ đọc hóa đơn giá trị gia tăng (GTGT) Việt Nam cho khoa dược bệnh viện.
Chỉ trả về MỘT đối tượng JSON hợp lệ, không giải thích, theo đúng mẫu:
{"supplier":"","supplierTaxCode":"","invoiceSymbol":"","invoiceNo":"","invoiceDate":"YYYY-MM-DD","lookupCode":"","poNo":"",
"lines":[{"code":"","name":"","unit":"","lot":"","expiry":"YYYY-MM-DD","qty":0,"price":0,"discount":0,"taxRate":0,"amount":0}],
"subtotal":0,"tax":0,"total":0}
Quy tắc:
- Chép đúng ký tự nhìn thấy trên ảnh. KHÔNG đoán, KHÔNG bịa. Ô không đọc được thì để "" (chữ) hoặc null (số).
- supplier là ĐƠN VỊ BÁN HÀNG (không phải người mua). invoiceNo là "Số" hóa đơn, giữ nguyên số 0 ở đầu.
- Số tiền / số lượng là số thuần (bỏ dấu chấm, dấu phẩy phân cách hàng nghìn). taxRate là phần trăm: 0, 5, 8 hoặc 10.
- Mỗi dòng hàng là một phần tử trong "lines", giữ đúng thứ tự trên hóa đơn. Số lô / hạn dùng thường nằm trong tên hàng hoặc cột riêng.
- Ảnh không phải hóa đơn thì trả về {"error":"not_invoice"}.`;

export const OCR_USER = 'Đọc hóa đơn trong ảnh, trả về JSON theo đúng mẫu.';

// Cho mô hình đa năng (Gemini Flash…) khi dùng làm nhận giọng nói
export const STT_PROMPT = `Chép lại NGUYÊN VĂN lời nói tiếng Việt trong đoạn ghi âm. Đây là dược sĩ đọc tên thuốc và số lượng tại quầy nhà thuốc bệnh viện.
Chỉ trả về đúng câu nói (không giải thích, không ngoặc kép, không định dạng). Không có lời nói thì trả về chuỗi rỗng.
Viết tên thuốc theo đúng chính tả trong danh sách gợi ý nếu nghe thấy.`;

/** "Nhà thuốc bệnh viện. Tên thuốc: A, B, C" → ['A','B','C'] (danh sách từ vựng cho mô hình nhận giọng nói chuyên dụng) */
export function vocabList(prompt, max = 100) {
  const m = String(prompt || '').split(/Tên thuốc:/i)[1];
  return (m || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, max);
}
