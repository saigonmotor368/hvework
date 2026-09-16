#!/bin/bash
# ==============================================================================
# HVE App - Database Disaster Recovery / Restore Script (Linux / Docker)
# ==============================================================================

set -e

if [ -z "$1" ]; then
  echo "❌ Lỗi: Vui lòng cung cấp đường dẫn tệp sao lưu (.sql hoặc .sql.gz)"
  echo "Cách dùng: ./restore_db.sh /path/to/hve_backup_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Lỗi: Không tìm thấy tệp tin ${BACKUP_FILE}"
  exit 1
fi

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-hve_admin}"
DB_NAME="${DB_NAME:-hve_app_db}"

echo "⚠️  [HVE RESTORE] Bắt đầu khôi phục dữ liệu vào DB: ${DB_NAME} từ tệp: ${BACKUP_FILE}..."
echo "⚠️  Lưu ý: Dữ liệu hiện tại sẽ được thay thế bởi bản sao lưu này."

if [[ "${BACKUP_FILE}" == *.gz ]]; then
  gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD:-hve_password}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
else
  PGPASSWORD="${DB_PASSWORD:-hve_password}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" < "${BACKUP_FILE}"
fi

echo "✅ [HVE RESTORE] Khôi phục cơ sở dữ liệu thành công!"
