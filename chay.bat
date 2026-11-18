@echo off
rem Nhap dup file nay de chay Vinmec Pharmacy Hub (khong can mo terminal).
cd /d "%~dp0"
where python >nul 2>nul && (python serve.py %* & goto :end)
where py >nul 2>nul && (py serve.py %* & goto :end)
where node >nul 2>nul && (start "" http://127.0.0.1:8090/ & npx --yes serve app -l 8090 & goto :end)
echo Khong tim thay Python hoac Node.js. Cai Python tai https://www.python.org/downloads/ roi chay lai.
:end
pause
