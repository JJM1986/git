@echo off
rem Bildwerk lokal starten (Windows)
setlocal
set PORT=8777
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:%PORT%/
  python -m http.server %PORT% --bind 127.0.0.1
  goto :eof
)
where npx >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:%PORT%/
  npx --yes http-server . -p %PORT% -a 127.0.0.1
  goto :eof
)
echo Weder Python noch Node gefunden.
echo Alternative ohne Server: bildwerk-standalone.html im Browser oeffnen.
pause
