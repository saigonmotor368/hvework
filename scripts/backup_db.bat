@echo off
REM ==============================================================================
REM HVE App - Automated Database Backup Script (Windows Environment)
REM ==============================================================================

setlocal enabledelayedexpansion

set BACKUP_DIR=C:\backups\hve_app
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_FILE=%BACKUP_DIR%\hve_backup_%TIMESTAMP%.sql

set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=postgres
set DB_NAME=hve_app_db
set PGPASSWORD=postgres

echo [%date% %time%] [HVE BACKUP] Bat dau sao luu co so du lieu: %DB_NAME%...

pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F p --clean --if-exists > "%BACKUP_FILE%"

if %ERRORLEVEL% equ 0 (
    echo [%date% %time%] [HVE BACKUP] [OK] Sao luu thanh cong: %BACKUP_FILE%
) else (
    echo [%date% %time%] [HVE BACKUP] [FAILED] Loi khi sao luu!
    exit /b 1
)

echo [%date% %time%] [HVE BACKUP] Hoan tat tien trinh sao luu.
