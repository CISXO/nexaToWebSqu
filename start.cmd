@echo off
REM 전환 닥터 실행 (Windows). node_modules 가 없으면 npm install 후 개발 서버를 띄운다.
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run dev
