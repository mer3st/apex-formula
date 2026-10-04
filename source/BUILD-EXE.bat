@echo off
title Apex Formula - .exe yigish
echo.
echo  ============================================
echo   APEX FORMULA - .exe yigish
echo  ============================================
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo  [!] Node.js topilmadi.
  echo      https://nodejs.org saytidan LTS versiyani ornating va qayta urining.
  echo.
  pause
  exit /b 1
)
echo  [1/2] Kerakli paketlar yuklanmoqda ^(bir marta, ~200 MB^)...
call npm install --no-audit --no-fund
if errorlevel 1 ( echo  [!] npm install xato berdi. & pause & exit /b 1 )
echo.
echo  [2/2] .exe yigilmoqda...
call npm run dist
if errorlevel 1 ( echo  [!] Yigish xato berdi. & pause & exit /b 1 )
echo.
echo  TAYYOR!  dist\ papkasini oching - ApexFormula.exe shu yerda.
echo.
pause
