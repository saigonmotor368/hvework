@echo off
REM ==============================================================================
REM HVE App - Database Disaster Recovery / Restore Script (Windows)
REM ==============================================================================

if "%~1"=="" (
    echo [ERROR] Vui long cung cap duong dan file sao luu .sql
    echo Cu phap: restore_db.bat C:\backups\hve_app\hve_backup_YYYYMMDD_HHMMSS.sql
    exit /b 1
)

set BACKUP_FILE=%~1
if not exist "%BACKUP_FILE%" (
    echo [ERROR] File sao luu khong ton tai: %BACKUP_FILE%
    exit /b 1
)

set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=postgres
set DB_NAME=hve_app_db
set PGPASSWORD=postgres

echo [HVE RESTORE] Dang khoi phuc du lieu tu: %BACKUP_FILE% vao database: %DB_NAME%...

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% < "%BACKUP_FILE%"

if %ERRORLEVEL% equ 0 (
    echo [HVE RESTORE] [OK] Khoi phuc thanh cong!
) else (
    echo [HVE RESTORE] [FAILED] Loi trong qua trinh khoi phuc!
    exit /b 1
)
