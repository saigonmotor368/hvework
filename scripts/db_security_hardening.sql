-- ==============================================================================
-- HVE App - Database Security Hardening Script
-- Mục tiêu: Thiết lập tài khoản chạy ứng dụng (runtime user) theo nguyên tắc
-- đặc quyền tối thiểu (Least Privilege), bảo vệ bảng AuditLog bất biến (Append-Only)
-- ==============================================================================
-- Hướng dẫn thực thi:
-- 1. Triển khai Docker:
--    docker exec -i hve_postgres psql -U hve_user -d hve_db -v APP_PASS="MatKhauMoiCuaBan" < scripts/db_security_hardening.sql
-- 2. Triển khai Linux / Standalone Postgres:
--    psql -h localhost -U hve_user -d hve_db -v APP_PASS="MatKhauMoiCuaBan" -f scripts/db_security_hardening.sql
-- ==============================================================================

\set ON_ERROR_STOP on

-- Khởi tạo biến mật khẩu runtime nếu chưa truyền qua -v APP_PASS=...
-- CẢNH BÁO BẢO MẬT: Luôn truyền mật khẩu ngẫu nhiên riêng khi chạy trên Staging/Production!
\if :{?APP_PASS}
\else
  \set APP_PASS 'HVE_Runtime_Pass_2026_Change_On_Deploy'
\endif

-- 1. Tạo role riêng cho backend runtime nếu chưa tồn tại, hoặc cập nhật mật khẩu
DO $$
DECLARE
  v_pass text := :'APP_PASS';
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hve_app_user') THEN
    EXECUTE format('CREATE ROLE hve_app_user WITH LOGIN PASSWORD %L', v_pass);
    RAISE NOTICE 'Đã tạo mới role hve_app_user.';
  ELSE
    EXECUTE format('ALTER ROLE hve_app_user WITH PASSWORD %L', v_pass);
    RAISE NOTICE 'Đã cập nhật mật khẩu mới cho role hve_app_user.';
  END IF;
END
$$;

-- 2. Cấp quyền kết nối vào database hve_db và truy cập schema public
GRANT CONNECT ON DATABASE hve_db TO hve_app_user;
GRANT USAGE ON SCHEMA public TO hve_app_user;

-- 3. Cấp quyền đọc/ghi nghiệp vụ thông thường trên toàn bộ bảng hiện tại
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hve_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hve_app_user;

-- 4. BẢO VỆ TÍNH BẤT BIẾN CỦA NHẬT KÝ KIỂM SOÁT NỘI BỘ (AUDIT LOG DEFENSE-IN-DEPTH)
-- Nghiêm cấm hoàn toàn hành vi xoá (DELETE), sửa đổi (UPDATE) hoặc dọn sạch (TRUNCATE) bảng AuditLog
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditLog" FROM hve_app_user;

-- 5. Đảm bảo các bảng tạo mới trong tương lai tự động áp dụng chính sách này
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hve_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hve_app_user;

-- 6. Thông báo trạng thái hoàn tất
DO $$
BEGIN
  RAISE NOTICE '✅ [HVE DB HARDENING] Đã thiết lập xong quyền tối thiểu cho hve_app_user trên cơ sở dữ liệu hve_db.';
  RAISE NOTICE '✅ [HVE DB HARDENING] Bảng AuditLog đã được khóa chặt quyền UPDATE, DELETE, TRUNCATE đối với hve_app_user.';
END
$$;
