#!/bin/bash
# ==============================================================================
# HVE App - Automated Database Backup Script (Linux / Docker Environment)
# Chính sách lưu trữ: Giữ 30 ngày gần nhất (rolling 30 days) + nén gzip tiết kiệm dung lượng
# ==============================================================================

set -e

# Cấu hình thư mục sao lưu
BACKUP_DIR="${BACKUP_DIR:-/var/backups/hve_app}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/hve_backup_${TIMESTAMP}.sql.gz"

# Thông tin kết nối PostgreSQL (mặc định lấy từ biến môi trường hoặc docker)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-hve_admin}"
DB_NAME="${DB_NAME:-hve_app_db}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] [HVE BACKUP] Đang bắt đầu sao lưu cơ sở dữ liệu: ${DB_NAME}..."

# Thực hiện pg_dump và nén trực tiếp qua gzip
PGPASSWORD="${DB_PASSWORD:-hve_password}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F p \
  --clean \
  --if-exists \
  | gzip -9 > "${BACKUP_FILE}"

echo "[$(date)] [HVE BACKUP] ✅ Sao lưu thành công! Tệp tin: ${BACKUP_FILE} (Dung lượng: $(du -h "${BACKUP_FILE}" | cut -f1))"

# Áp dụng chính sách lưu trữ (Retention Policy): Xóa các bản backup cũ hơn 30 ngày
echo "[$(date)] [HVE RETENTION] Đang quét và dọn dẹp các bản sao lưu cũ hơn 30 ngày..."
find "${BACKUP_DIR}" -name "hve_backup_*.sql.gz" -type f -mtime +30 -exec rm -f {} \;

echo "[$(date)] [HVE BACKUP] Hoàn tất toàn bộ tiến trình sao lưu định kỳ."
