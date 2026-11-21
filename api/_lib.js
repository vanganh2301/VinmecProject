// Dùng chung cho các Vercel Function trong api/ (file bắt đầu bằng "_" không thành đường dẫn API).
// Khóa AI chỉ nằm ở biến môi trường (Vercel, hoặc file .env khi chạy npm run dev), không bao giờ gửi xuống trình duyệt.

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
export const fail = (status, error) => json({ error }, status);

/** Kiểm tra chung. Trả về Response lỗi, hoặc null nếu hợp lệ. */
export function check(req, maxBytes) {
  // Chặn trang web khác gọi ké từ trình duyệt của người dùng: Origin (nếu có) phải trùng tên miền của app
  const origin = req.headers.get('origin');
  if (origin) {
    let o; try { o = new URL(origin).host; } catch { o = ''; }
    if (o !== req.headers.get('host')) return fail(403, 'Chỉ app V-Pharma Hub được gọi API này.');
  }
  const len = +req.headers.get('content-length') || 0;
  if (len > maxBytes) return fail(413, `Dữ liệu quá lớn (${Math.round(len / 1e6 * 10) / 10} MB).`);
  return null;
}
