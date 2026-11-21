@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo 먼저 README.md의 Python 설치 단계를 실행해 주세요.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" "backend\server.py"
pause
