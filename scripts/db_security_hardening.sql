-- ==============================================================================
-- HVE App - Database Security Hardening Script
-- Mục tiêu: Thiết lập tài khoản chạy ứng dụng (runtime user) theo nguyên tắc
-- đặc quyền tối thiểu (Least Privilege), đảm bảo bảng AuditLog bất biến (Append-Only)
-- ==============================================================================

-- 1. Tạo role riêng cho backend runtime nếu chưa tồn tại
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hve_app_user') THEN
    CREATE ROLE hve_app_user WITH LOGIN PASSWORD 'HVE_Secure_Runtime_Pass_2026!';
  END IF;
END
$$;

-- 2. Cấp quyền kết nối và truy cập schema public
GRANT CONNECT ON DATABASE hve_app_db TO hve_app_user;
GRANT USAGE ON SCHEMA public TO hve_app_user;

-- 3. Cấp quyền đọc/ghi nghiệp vụ thông thường trên toàn bộ bảng
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
  RAISE NOTICE '✅ [HVE DB HARDENING] Đã thiết lập xong quyền tối thiểu cho hve_app_user. Bảng AuditLog đã được khóa chặt quyền UPDATE, DELETE, TRUNCATE.';
END
$$;
