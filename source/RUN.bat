@echo off
title Apex Formula - test rejimida ishga tushirish
where node >nul 2>&1
if errorlevel 1 ( echo Node.js kerak: https://nodejs.org & pause & exit /b 1 )
if not exist node_modules ( echo Paketlar yuklanmoqda... & call npm install --no-audit --no-fund )
call npm start
