@echo off
cd /d "%~dp0"
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:exe /platform:x64 /out:RumbleHelper.exe RumbleHelper.cs
exit /b %errorlevel%
