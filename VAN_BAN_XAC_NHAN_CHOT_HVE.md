# VĂN BẢN XÁC NHẬN THỎA THUẬN NGHIỆP VỤ & BÀN GIAO HỆ THỐNG
## DỰ ÁN: HỆ THỐNG ĐIỀU HÀNH & PHÊ DUYỆT HVE WORK (HUY VÕ EDUCATION)

**Căn cứ:**
- Developer Brief dự án HVE App phiên bản v1.0.
- Tài liệu kiến trúc kỹ thuật [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) và Kế hoạch triển khai [02_KE_HOACH_TRIEN_KHAI.md](02_KE_HOACH_TRIEN_KHAI.md).
- Kết quả nghiệm thu các giai đoạn: Phase 0, Phase 1, Phase 2, Phase 3, Phase 4 và Phase 5.

Hôm nay, ngày 16 tháng 09 năm 2026, các bên gồm có:
- **Đại diện Đơn vị Tiếp nhận & Sử dụng (HVE):**
  - **Anh Định** — Chủ tịch / Tổng Giám đốc
  - **Anh Minh** — Trưởng phòng Công nghệ Thông tin
- **Đại diện Đội ngũ Phát triển Hệ thống (Development Team):**
  - **An** — Trợ lý công nghệ & Kỹ sư trưởng dự án

Hai bên cùng thống nhất và xác nhận bằng văn bản 4 điều khoản thỏa thuận kỹ thuật tiên quyết trước khi đưa hệ thống vào vận hành chính thức (Go-Live):

---

### Điều khoản 1: Giới hạn File Đính kèm & Định dạng Hỗ trợ (Attachment Policy)
1. **Dung lượng tối đa:**
   - Mỗi tệp tin tải lên: Tối đa **10 MB / tệp tin**.
   - Tổng dung lượng đính kèm cho mỗi hồ sơ: Tối đa **20 MB / hồ sơ**.
2. **Danh mục định dạng cho phép (Whitelist MIME Types):**
   - Tài liệu văn phòng: `.pdf` (`application/pdf`), `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), `.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
   - Hình ảnh chứng từ: `.jpg`, `.jpeg` (`image/jpeg`), `.png` (`image/png`).
3. **Cơ chế bảo mật lưu trữ:**
   - Mọi tệp tin tải lên được cấp phát chữ ký xác thực thời hạn ngắn (Pre-signed HMAC URL 15 phút).
   - Truy cập chứng từ bắt buộc phải qua xác thực `JwtAuthGuard` (không serve public tĩnh).
   - Hỗ trợ đánh số phiên bản (`version`) bất biến, không ghi đè tệp tin cũ.

---

### Điều khoản 2: Chính sách Sao lưu & Thời hạn Lưu trữ Dữ liệu (Backup & Retention Policy)
1. **Tần suất sao lưu tự động:**
   - Cơ sở dữ liệu chính (PostgreSQL): Tự động sao lưu **hàng ngày vào lúc 02:00 sáng** qua script nén gzip `scripts/backup_db.sh`.
2. **Thời hạn lưu trữ (Retention Policy):**
   - **Bản sao lưu hàng ngày (Daily Rolling Backups):** Lưu trữ cố định **30 ngày gần nhất**. Các bản ghi quá 30 ngày sẽ được hệ thống quét và dọn dẹp tự động để tối ưu dung lượng đĩa.
   - **Bản sao lưu mốc tháng (Monthly Archives):** Lưu giữ 12 bản chụp vào ngày cuối cùng của mỗi tháng trong vòng **01 năm** phục vụ kiểm toán tài chính nội bộ.
3. **Diễn tập phục hồi thảm họa (Disaster Recovery):**
   - Đã tiến hành thử nghiệm khôi phục nguyên vẹn 100% dữ liệu và lập [BIEN_BAN_TEST_RESTORE.md](BIEN_BAN_TEST_RESTORE.md).

---

### Điều khoản 3: Phương án Xác thực Tài khoản & OTP (Authentication & OTP Scope)
1. **Giai đoạn 1 (Hiện tại):**
   - Đăng nhập bảo mật qua Email nội bộ + Mật khẩu mã hóa băm `bcrypt` + Cặp JWT Access Token (15 phút) / Refresh Token (7 ngày).
   - Khôi phục mật khẩu (Quên mật khẩu) thông qua **Mã xác thực OTP 6 chữ số gửi qua Email**, thời hạn hiệu lực **15 phút**, cơ chế chống brute-force và chống dò tìm email người dùng.
   - Khóa tài khoản an toàn sau **05 lần nhập sai liên tiếp trong 15 phút**.
2. **Giai đoạn nâng cấp (Tùy chọn tương lai):**
   - Xác thực OTP qua tin nhắn viễn thông SMS Gateway (Brandname Telco) được ghi nhận là hạng mục mở rộng sẽ kích hoạt khi HVE hoàn tất ký hợp đồng dịch vụ viễn thông.

---

### Điều khoản 4: Thời gian Bảo hành & Hỗ trợ Kỹ thuật Sau Bàn giao
1. **Thời hạn bảo hành miễn phí:** **12 tháng** kể từ ngày ký biên bản nghiệm thu bàn giao chính thức.
2. **Phạm vi bảo hành:**
   - Khắc phục miễn phí 100% các lỗi phần mềm (bugs) phát sinh liên quan đến luồng phê duyệt, phân quyền dữ liệu, tính toán hạn hợp đồng/công việc và lỗi hiển thị.
   - Hỗ trợ kỹ thuật vận hành định kỳ cho IT Admin (hướng dẫn phục hồi DB, cấp phát lại chứng thư VAPID Push).
   - Cam kết thời gian phản hồi: Sự cố gián đoạn nghiêm trọng $\le 2$ giờ; yêu cầu hỗ trợ kỹ thuật thông thường $\le 24$ giờ làm việc.

---

**ĐẠI DIỆN HVE (DOANH NGHIỆP)**  
*(Ký và ghi rõ họ tên)*

<br/><br/>
**Anh Định** — Chủ tịch HVE  
**Anh Minh** — Trưởng phòng IT HVE

---

**ĐẠI DIỆN ĐỘI NGŨ PHÁT TRIỂN**  
*(Ký và ghi rõ họ tên)*

<br/><br/>
**An** — Trợ lý công nghệ HVE
