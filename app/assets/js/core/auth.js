/* Đăng nhập qua máy chủ (api/auth): mã cơ sở → tên đăng nhập + mật khẩu → (đổi mật khẩu tạm).
   Mã phiên nằm trong cookie HttpOnly do máy chủ đặt – JavaScript (kể cả mã độc chèn vào trang) không đọc được.
   localStorage vmhub.session chỉ giữ tên / vai trò để vẽ giao diện; quyền thật luôn do máy chủ kiểm tra. */
'use strict';
(function (VM) {
  const URL_ = 'api/auth', FAC = 'vmhub.facility';
  let expiredFn = null, expiring = false;

  // → { status, data, error, network, noServer }
  async function request(url, method = 'GET', body) {
    if (location.protocol === 'file:') return { status: 0, noServer: true, error: 'Mở trực tiếp file không đăng nhập được.' };
    let res;
    try {
      res = await fetch(url, { method, cache: 'no-store', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { return { status: 0, network: true, error: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' }; }
    let data = null;
    if (/json/i.test(res.headers.get('content-type') || '')) { try { data = await res.json(); } catch (_) { } }
    // serve.py / trang tĩnh: không có api/ → 404 trang HTML
    if (!data && (res.status === 404 || res.status === 405 || res.status === 501)) return { status: res.status, noServer: true, error: 'Máy chủ này không có chức năng đăng nhập.' };
    return { status: res.status, data, error: res.ok ? '' : (data && data.error) || `Lỗi máy chủ (${res.status})` };
  }

  /** API cần đăng nhập (VD api/drugs): 401 → báo hết phiên, đưa về màn đăng nhập */
  async function api(url, body) {
    const r = await request(url, body ? 'POST' : 'GET', body);
    if (r.status === 401 && VM.store.currentUser()) expired();
    return r;
  }
  function expired() {
    if (expiring || !expiredFn) return;
    expiring = true;
    try { expiredFn(); } finally { setTimeout(() => { expiring = false; }, 1000); }
  }

  // Thông tin người dùng từ máy chủ → bản lưu cục bộ (vmhub.session) mà các màn hình đang dùng
  const toLocal = u => ({
    id: u.id, username: u.username, name: u.name, role: u.title || (u.head ? 'Trưởng khoa Dược' : 'Dược sĩ'), store: u.store || 'Y001',
    head: !!u.head, admin: !!u.head, facility: u.facility, facilityName: u.facilityName || u.facility, loginAt: VM.iso(),
  });

  const lastFacility = () => { try { return JSON.parse(localStorage.getItem(FAC) || 'null'); } catch (_) { return null; } };
  const rememberFacility = f => { try { localStorage.setItem(FAC, JSON.stringify({ code: f.code, name: f.name })); } catch (_) { } };

  VM.auth = {
    me: () => request(URL_),
    facility: code => request(URL_, 'POST', { action: 'facility', code }),
    login: (facility, username, password) => request(URL_, 'POST', { action: 'login', facility, username, password }),
    changePassword: (current, next) => request(URL_, 'POST', { action: 'password', current, next }),
    logout: () => request(URL_, 'POST', { action: 'logout' }),
    api, toLocal, lastFacility, rememberFacility,
    expired: () => { if (VM.store.currentUser()) expired(); },
    onExpired: fn => { expiredFn = fn; },
    // Kiểm tra nhanh phía trình duyệt cho đỡ phải chờ máy chủ (máy chủ vẫn kiểm tra lại)
    passwordProblem(pw, username) {
      const s = String(pw || '');
      if (s.length < 8) return 'Mật khẩu cần ít nhất 8 ký tự.';
      if (!/[A-Za-zÀ-ỹ]/.test(s) || !/\d/.test(s)) return 'Mật khẩu cần có cả chữ và số.';
      if (username && s.toLowerCase().includes(String(username).toLowerCase())) return 'Mật khẩu không được chứa tên đăng nhập.';
      return '';
    },
  };
})(window.VM);
