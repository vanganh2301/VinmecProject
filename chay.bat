@echo off
rem Nhap dup file nay de chay V-Pharma Hub (khong can mo terminal).
rem App can may chu Node.js (>= 22.13) de dang nhap bang mat khau.
cd /d "%~dp0"
where node >nul 2>nul && (node tools\dev.mjs --port 8090 %* & goto :end)
where python >nul 2>nul && (python serve.py %* & goto :end)
where py >nul 2>nul && (py serve.py %* & goto :end)
echo Khong tim thay Node.js. Cai Node.js LTS tai https://nodejs.org roi chay lai.
:end
pause
