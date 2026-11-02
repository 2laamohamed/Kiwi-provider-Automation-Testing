@echo off
REM ============================================================
REM  KIWI Provider automation - first-time setup (double-click)
REM  Installs the packages + Chromium and creates .env
REM ============================================================
cd /d %~dp0

echo.
echo [1/4] Installing npm packages...
call npm ci || goto :error

echo.
echo [2/4] Installing Chromium for Playwright...
call npx playwright install chromium || goto :error

echo.
echo [3/4] Creating .env (only if it does not exist)...
if not exist .env copy .env.example .env

echo.
echo [4/4] Checking the code compiles...
call npx tsc --noEmit || goto :error

echo.
echo ============================================================
echo  Done - no errors.
echo  Run:  npm run test:headless      (onboarding then provider, no browser window)
echo   or:  npm run test:all           (same, with the browser visible)
echo  Report: npm run report
echo ============================================================
pause
exit /b 0

:error
echo.
echo Something failed - check the message above.
pause
exit /b 1
