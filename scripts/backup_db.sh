#!/bin/bash
# ==============================================================================
# HVE App - Automated Database Backup Script (Linux / Docker Environment)
# Khớp 100% với Thỏa thuận tại VAN_BAN_XAC_NHAN_CHOT_HVE.md - Điều khoản 2:
# 1. Hàng ngày: Tự động sao lưu và lưu trữ 30 ngày gần nhất (rolling 30 days).
# 2. Mốc tháng: Tự động lưu trữ 12 bản chụp cuối mỗi tháng trong vòng 01 năm (365 ngày).
# ==============================================================================

set -e

# Cấu hình thư mục sao lưu
BACKUP_DIR="${BACKUP_DIR:-/var/backups/hve_app}"
DAILY_DIR="${BACKUP_DIR}/daily"
MONTHLY_DIR="${BACKUP_DIR}/monthly_archives"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
YEAR_MONTH=$(date +"%Y_%m")

DAILY_FILE="${DAILY_DIR}/hve_backup_${TIMESTAMP}.sql.gz"
MONTHLY_FILE="${MONTHLY_DIR}/hve_monthly_${YEAR_MONTH}.sql.gz"

# Thông tin kết nối PostgreSQL (đồng bộ với docker-compose.yml)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-hve_user}"
DB_NAME="${DB_NAME:-hve_db}"

mkdir -p "${DAILY_DIR}"
mkdir -p "${MONTHLY_DIR}"

echo "[$(date)] [HVE BACKUP] Đang bắt đầu sao lưu cơ sở dữ liệu: ${DB_NAME}..."

# Thực hiện pg_dump và nén trực tiếp qua gzip vào tệp hàng ngày
PGPASSWORD="${DB_PASSWORD:-hve_password}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F p \
  --clean \
  --if-exists \
  | gzip -9 > "${DAILY_FILE}"

echo "[$(date)] [HVE BACKUP] ✅ Sao lưu hàng ngày thành công! Tệp tin: ${DAILY_FILE} ($(du -h "${DAILY_FILE}" | cut -f1))"

# Cập nhật snapshot mốc tháng (Monthly Archive)
# Tệp tin hve_monthly_YYYY_MM.sql.gz sẽ luôn được làm mới để lưu trữ dữ liệu cập nhật nhất của tháng
cp "${DAILY_FILE}" "${MONTHLY_FILE}"
echo "[$(date)] [HVE MONTHLY ARCHIVE] ✅ Đã đồng bộ bản chụp mốc tháng: ${MONTHLY_FILE}"

# ÁP DỤNG CHÍNH SÁCH LƯU TRỮ (RETENTION POLICY):
# 1. Dọn dẹp bản sao lưu hàng ngày cũ hơn 30 ngày
echo "[$(date)] [HVE RETENTION] Đang quét và dọn dẹp các bản sao lưu hàng ngày cũ hơn 30 ngày..."
find "${DAILY_DIR}" -name "hve_backup_*.sql.gz" -type f -mtime +30 -exec rm -f {} \;

# 2. Dọn dẹp bản sao lưu mốc tháng cũ hơn 365 ngày (đảm bảo lưu đủ 12 mốc tháng / 1 năm)
echo "[$(date)] [HVE RETENTION] Đang quét và dọn dẹp các bản sao lưu mốc tháng cũ hơn 365 ngày (1 năm)..."
find "${MONTHLY_DIR}" -name "hve_monthly_*.sql.gz" -type f -mtime +365 -exec rm -f {} \;

echo "[$(date)] [HVE BACKUP] Hoàn tất toàn bộ tiến trình sao lưu định kỳ và dọn dẹp theo cam kết."
