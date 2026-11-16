@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Preparar-Neurify.ps1" %*
pause
