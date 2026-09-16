# TÀI LIỆU HƯỚNG DẪN QUẢN TRỊ HỆ THỐNG (SYSTEM ADMINISTRATION MANUAL)
## DÀNH RIÊNG CHO QUẢN TRỊ VIÊN CÔNG NGHỆ THÔNG TIN (IT ADMIN)

**Ứng dụng:** HVE Work — Hệ thống Điều hành & Phê duyệt Nội bộ  
**Đơn vị:** Huy Võ Education (HVE)  
**Phiên bản:** 1.0 (Phase 5 Release)  

---

## 1. Tổng quan Trách nhiệm & Quyền hạn của IT Admin

Tài khoản Quản trị IT (`it_admin`) sở hữu toàn quyền quản trị kỹ thuật hệ thống, bao gồm:
- Quản lý danh mục người dùng, mở khóa tài khoản, phân quyền vai trò và phòng ban.
- Tự cấu hình và điều chỉnh luồng phê duyệt (Workflow Templates) trực tiếp qua giao diện UI mà không cần can thiệp mã nguồn.
- Giám sát nhật ký kiểm soát nội bộ (Audit Log) để truy vết mọi hành vi thay đổi dữ liệu.
- Quản lý hạ tầng sao lưu định kỳ, bảo vệ an toàn cơ sở dữ liệu.
- **Nguyên tắc đạo đức & bảo mật:** IT Admin **không có quyền can thiệp, tự ý sửa đổi số liệu nghiệp vụ tài chính** trên các hồ sơ đã duyệt.

---

## 2. Quản lý Người dùng & Phân quyền Vai trò

### 2.1 Truy cập màn hình Quản lý Người dùng
1. Đăng nhập bằng tài khoản IT Admin (ví dụ: `admin@huyvoeducation.vn` hoặc tài khoản có role `it_admin`).
2. Trên thanh điều hướng Sidebar bên trái, chọn mục **👥 Quản lý người dùng**.

### 2.2 Các thao tác quản trị tài khoản
- **Mở khóa tài khoản (Unlock Account):**
  - Khi người dùng nhập sai mật khẩu 5 lần liên tiếp trong vòng 15 phút, tài khoản sẽ tự động chuyển sang trạng thái `locked` (Khóa).
  - IT Admin tìm tài khoản trong danh sách, bấm nút **"Mở khóa"** để kích hoạt lại trạng thái `active`.
- **Phân bổ Bộ phận (Department Assignment):**
  - Bấm nút **"Sửa"** bên cạnh người dùng.
  - Chọn phòng ban tương ứng: *Ban Giám đốc, Phòng Công nghệ Thông tin, Phòng Tài chính - Kế toán, Phòng Đào tạo & Tuyển sinh*.
  - Bấm **Lưu thay đổi**.
- **Gán Vai trò (Role Management):**
  - Hệ thống hỗ trợ 6 vai trò chuẩn:
    1. `ceo`: Ban Giám đốc — phê duyệt cấp cao nhất, giao việc, xem toàn bộ báo cáo và nhật ký.
    2. `department_head`: Trưởng bộ phận — duyệt hồ sơ nội bộ phòng mình, giao việc cho nhân viên phòng.
    3. `accountant`: Kế toán — thẩm định chứng từ thanh toán, quản lý hợp đồng chi trả.
    4. `legal`: Pháp chế — thẩm định tính pháp lý của hợp đồng kinh tế.
    5. `employee`: Nhân viên — lập hồ sơ đề xuất/thanh toán, thực hiện công việc được giao.
    6. `it_admin`: Quản trị hệ thống — cấu hình người dùng, luồng duyệt, backup.
  - Tích chọn một hoặc nhiều vai trò tương ứng và bấm **Cập nhật vai trò**.

---

## 3. Tự Cấu hình Quy trình Phê duyệt Động (Workflows Engine)

Hệ thống HVE Work được thiết kế độc quyền với **Core Approval Engine** linh hoạt, cho phép IT Admin thay đổi số cấp duyệt hoặc vai trò duyệt trực tiếp trên giao diện:

### 3.1 Truy cập màn hình Cấu hình Luồng
- Trên thanh Sidebar, chọn mục **⚙️ Cấu hình quy trình**.

### 3.2 Tùy biến các bước duyệt
1. Chọn loại hồ sơ cần cấu hình:
   - **Đề nghị thanh toán (`payment_request`):** Mặc định 4 bước (Người tạo → Trưởng BP → Kế toán → CEO).
   - **Đề xuất / Tờ trình (`proposal`):** Mặc định 2 bước (Người tạo → Trưởng BP → CEO).
   - **Hợp đồng (`contract`):** Mặc định 4 bước (Người tạo → Trưởng BP → Pháp chế → Kế toán → CEO).
2. Thao tác điều chỉnh:
   - **Thay đổi thứ tự duyệt:** Bấm nút mũi tên ⬆️ hoặc ⬇️ để hoán đổi cấp duyệt.
   - **Đổi vai trò phê duyệt:** Chọn vai trò mong muốn từ dropdown tại từng bước.
   - **Thêm cấp duyệt mới:** Bấm nút **"+ Thêm bước duyệt"**, chọn vai trò chịu trách nhiệm.
   - **Xóa bớt cấp duyệt:** Bấm biểu tượng thùng rác 🗑️ tại bước cần xóa.
3. Bấm nút **"💾 Lưu cấu hình quy trình"**: Cấu hình mới sẽ có hiệu lực ngay lập tức cho các hồ sơ được khởi tạo sau thời điểm lưu.

---

## 4. Quản lý Thông báo, Nhắc hạn & Leo thang (Reminders)

- Hệ thống tự động kích hoạt tiến trình quét mốc định kỳ:
  - **Công việc sắp đến hạn ($\le 1$ ngày):** Thông báo in-app, email và Web Push cho người thực hiện.
  - **Công việc quá hạn $\ge 1$ ngày:** Gửi cảnh báo đôn đốc cho Trưởng bộ phận.
  - **Công việc quá hạn $\ge 3$ ngày:** Tự động leo thang cảnh báo gửi tới CEO.
  - **Hợp đồng sắp hết hạn ($\le 30$ ngày):** Thông báo nhắc nhở Kế toán & Pháp chế để chuẩn bị tái ký hoặc thanh lý.
- **Kích hoạt thủ công qua API:** IT Admin có thể kích hoạt quét mốc cưỡng bức bất kỳ lúc nào bằng lệnh:
  ```bash
  curl -X POST http://localhost:3000/notifications/trigger-reminders -H "Authorization: Bearer <ADMIN_TOKEN>"
  ```

---

## 5. Vận hành Sao lưu & Phục hồi Cơ sở Dữ liệu

### 5.1 Cấu hình bảo mật cấp Database Engine
Chạy script bảo vệ bất biến bảng Audit Log:
```bash
psql -h localhost -U postgres -d hve_app_db -f scripts/db_security_hardening.sql
```

### 5.2 Sao lưu tự động trên Linux / Docker
- Lệnh chạy thử sao lưu:
  ```bash
  bash scripts/backup_db.sh
  ```
- Thiết lập Cronjob tự động lúc 02:00 sáng hàng ngày (`crontab -e`):
  ```cron
  0 2 * * * /bin/bash /opt/hve_app/scripts/backup_db.sh >> /var/log/hve_backup.log 2>&1
  ```

### 5.3 Khôi phục dữ liệu khi có sự cố
- Khôi phục từ bản sao lưu gần nhất:
  ```bash
  bash scripts/restore_db.sh /var/backups/hve_app/hve_backup_YYYYMMDD_HHMMSS.sql.gz
  ```

---

## 6. Tra cứu Tài liệu API Chuẩn (OpenAPI / Swagger)

IT Admin và các lập trình viên có thể truy cập toàn bộ tài liệu API tương tác, danh sách DTOs, tham số và mã phản hồi tại địa chỉ:
👉 **`http://localhost:3000/api/docs`**

Hệ thống hỗ trợ cơ chế xác thực JWT trực tiếp trên giao diện Swagger thông qua nút **Authorize 🔓** (dán Bearer Token để chạy thử nghiệm các API).
