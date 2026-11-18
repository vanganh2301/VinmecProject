"""Chạy Vinmec Pharmacy Hub trên máy: python serve.py

- Chạy được từ BẤT KỲ thư mục nào (tự tìm thư mục app/ cạnh file này).
- Tự chọn cổng trống bắt đầu từ 8090, tự mở trình duyệt khi server đã sẵn sàng.
- Gửi header no-cache: sửa code xong chỉ cần F5, không cần Ctrl + F5.

Tùy chọn:
  --port 8091   chọn cổng khác (mặc định 8090)
  --no-open     không tự mở trình duyệt
  --lan         cho máy khác trong cùng mạng Wi-Fi/LAN truy cập (mặc định chỉ máy này)
Dừng: Ctrl + C.
"""
import argparse
import errno
import functools
import http.server
import os
import socket
import sys
import threading
import webbrowser

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")

# Console Windows (cp1252/cp437) không in được tiếng Việt -> ép UTF-8, ký tự lạ thì thay bằng '?'
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
                      ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):  # chỉ in lỗi, không in từng file nạp
        if len(args) > 1 and str(args[1])[:1] in "45":
            super().log_message(fmt, *args)


class Server(http.server.ThreadingHTTPServer):
    # Windows: SO_REUSEADDR cho 2 tiến trình cùng nghe 1 cổng -> mở 2 lần là trình duyệt
    # trúng server cũ. Tắt nó và giữ cổng độc quyền để lần chạy sau tự sang cổng khác.
    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # không gửi gói nào, chỉ để hỏi card mạng đang dùng
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser(description="Chạy Vinmec Pharmacy Hub")
    ap.add_argument("--port", type=int, default=8090)
    ap.add_argument("--no-open", action="store_true")
    ap.add_argument("--lan", action="store_true")
    a = ap.parse_args()

    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        sys.exit(f"Không thấy {ROOT}\\index.html - hãy để serve.py ở thư mục gốc repo (cạnh thư mục app).")

    host = "0.0.0.0" if a.lan else "127.0.0.1"
    handler = functools.partial(Handler, directory=ROOT)
    httpd = None
    for port in range(a.port, a.port + 20):
        try:
            httpd = Server((host, port), handler)
            break
        except OSError as e:
            if e.errno not in (errno.EADDRINUSE, errno.EACCES, 10048, 10013):
                raise
            print(f"Cổng {port} đang bận, thử cổng {port + 1}...")
    if httpd is None:
        sys.exit("Không tìm được cổng trống. Đóng bớt server cũ rồi chạy lại.")

    url = f"http://127.0.0.1:{port}/"
    print("=" * 60)
    print(" Vinmec Pharmacy Hub đang chạy")
    print(f"   Trên máy này : {url}")
    if a.lan and lan_ip():
        print(f"   Máy khác cùng mạng: http://{lan_ip()}:{port}/  (micro/giọng nói cần HTTPS nên có thể không dùng được)")
    if port != 8090:
        print(f"   Lưu ý: dữ liệu lưu theo địa chỉ, cổng {port} là bộ dữ liệu khác với cổng 8090.")
    print(" Dừng server: bấm Ctrl + C trong cửa sổ này")
    print("=" * 60, flush=True)

    if not a.no_open:
        threading.Timer(0.3, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng server.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
