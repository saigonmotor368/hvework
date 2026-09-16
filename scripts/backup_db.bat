@echo off
REM ==============================================================================
REM HVE App - Automated Database Backup Script (Windows Environment)
REM Khop 100%% voi Thoa thuan tai VAN_BAN_XAC_NHAN_CHOT_HVE.md - Dieu khoan 2:
REM 1. Hang ngay: Luu tru 30 ngay gan nhat.
REM 2. Moc thang: Luu tru 12 ban chup cuoi moi thang trong vong 01 nam (monthly_archives).
REM ==============================================================================

setlocal enabledelayedexpansion

set BACKUP_DIR=C:\backups\hve_app
set DAILY_DIR=%BACKUP_DIR%\daily
set MONTHLY_DIR=%BACKUP_DIR%\monthly_archives

if not exist "%DAILY_DIR%" mkdir "%DAILY_DIR%"
if not exist "%MONTHLY_DIR%" mkdir "%MONTHLY_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set YEAR=%datetime:~0,4%
set MONTH=%datetime:~4,2%
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

set DAILY_FILE=%DAILY_DIR%\hve_backup_%TIMESTAMP%.sql
set MONTHLY_FILE=%MONTHLY_DIR%\hve_monthly_%YEAR%_%MONTH%.sql

set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=hve_user
set DB_NAME=hve_db
set PGPASSWORD=hve_password

echo [%date% %time%] [HVE BACKUP] Bat dau sao luu co so du lieu: %DB_NAME%...

pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F p --clean --if-exists > "%DAILY_FILE%"

if %ERRORLEVEL% equ 0 (
    echo [%date% %time%] [HVE BACKUP] [OK] Sao luu hang ngay thanh cong: %DAILY_FILE%
    copy /Y "%DAILY_FILE%" "%MONTHLY_FILE%" >nul
    echo [%date% %time%] [HVE MONTHLY ARCHIVE] [OK] Da dong bo ban chup moc thang: %MONTHLY_FILE%
) else (
    echo [%date% %time%] [HVE BACKUP] [FAILED] Loi khi sao luu!
    exit /b 1
)

REM Don dep file hang ngay cu hon 30 ngay
forfiles /P "%DAILY_DIR%" /S /M hve_backup_*.sql /D -30 /C "cmd /c del /F /Q @path" 2>nul
REM Don dep file moc thang cu hon 365 ngay (12 thang)
forfiles /P "%MONTHLY_DIR%" /S /M hve_monthly_*.sql /D -365 /C "cmd /c del /F /Q @path" 2>nul

echo [%date% %time%] [HVE BACKUP] Hoan tat tien trinh sao luu dinh ky va don dep theo cam ket.
