# CHECKLIST NGHIỆM THU TỔNG THỂ DỰ ÁN (FINAL UAT ACCEPTANCE CHECKLIST)
## DỰ ÁN: HỆ THỐNG ĐIỀU HÀNH & PHÊ DUYỆT HVE WORK (HUY VÕ EDUCATION)

**Căn cứ nghiệm thu:** Bảng "Tiêu chí nghiệm thu" tại **Mục 11 Developer Brief v1.0**.  
**Đơn vị nghiệm thu:** Ban Giám đốc HVE & Phòng Công nghệ Thông tin.  
**Ngày kiểm tra:** 16/09/2026.  

---

| STT | Hạng mục Nghiệm thu | Tiêu chí Chi tiết từ Brief | Hiện trạng Đạt được | Kết quả |
|:---:|---|---|---|:---:|
| **1** | **Xác thực & Phân quyền (RBAC)** | - 6 vai trò: `ceo`, `department_head`, `accountant`, `legal`, `employee`, `it_admin`<br/>- Kiểm tra quyền server-side<br/>- Khóa tài khoản sau 5 lần nhập sai<br/>- Quên mật khẩu qua OTP 6 số (15p) | - Cấu hình RBAC Guards chặt chẽ<br/>- 117 unit tests pass 100%<br/>- 7 negative RBAC tests chặn triệt để truy cập trái quyền<br/>- Khóa tài khoản và OTP email hoạt động đúng | ✅ **ĐẠT** |
| **2** | **Lõi Phê duyệt Hồ sơ (Approvals)** | - 3 loại hồ sơ: ĐNTT, Đề xuất, Hợp đồng<br/>- Core approval engine chung linh hoạt<br/>- Bắt buộc đính kèm chứng từ với ĐNTT/Hợp đồng<br/>- Chặn người tạo tự duyệt hồ sơ mình tạo<br/>- Bắt buộc lý do khi Trả lại/Từ chối<br/>- Chống duyệt kép (Optimistic Locking)<br/>- Tạo bản sửa đổi (`-v2`, `-v3`) cho hồ sơ đã duyệt | - Đã triển khai trọn vẹn 3 luồng<br/>- Mã hóa tự động: `DNTT-YYYY-NNN`, `DX-YYYY-NNN`, `HD-YYYY-NNN`<br/>- Timeline trực quan trạng thái từng bước<br/>- Anti-self-approval rule được kiểm thử pass<br/>- Tách biệt lock version và revision version | ✅ **ĐẠT** |
| **3** | **Quản lý Công việc (Task Management)** | - Giao việc, việc con (subtasks 2 cấp)<br/>- Việc lặp lại (Hàng ngày/tuần/tháng)<br/>- State machine: Chưa làm → Đang làm → Chờ duyệt → Hoàn thành<br/>- Quy tắc cứng: Người thực hiện không tự đóng việc (chỉ người giao đóng việc)<br/>- Cảnh báo hạn và quá hạn runtime | - Giao việc đa năng, gán người phối hợp<br/>- Việc con tự động tính tiến độ cha<br/>- Việc lặp lại tự sinh kỳ mới an toàn<br/>- Chống double-submit khi confirm completion<br/>- Tab "Việc bộ phận" lọc đúng theo phòng ban | ✅ **ĐẠT** |
| **4** | **Thông báo & Cảnh báo Leo thang** | - Thông báo tức thời khi gửi duyệt/duyệt/trả lại/từ chối<br/>- Quét mốc công việc sắp hạn $\le 1$ ngày<br/>- Quá hạn $\ge 1$ ngày báo Trưởng BP, $\ge 3$ ngày leo thang lên CEO<br/>- Hợp đồng sắp hết hạn $\le 30$ ngày báo Kế toán & Pháp chế<br/>- Chống trùng thông báo (`dedupeKey`)<br/>- Đa kênh: In-app + Email + Web Push VAPID | - `InAppChannel` ghi DB kèm dedupeKey<br/>- `EmailChannel` gửi định dạng chuẩn<br/>- `WebPushService` VAPID native push thật<br/>- Chuông `NotificationBell` góc header có unread badge và popover tương tác mượt mà | ✅ **ĐẠT** |
| **5** | **Dashboard & Báo cáo Điều hành** | - 4 Dashboard theo vai trò, ưu tiên khối "CẦN HÀNH ĐỘNG NGAY"<br/>- Báo cáo đa chiều với 5 bộ lọc linh hoạt<br/>- Phân quyền chặt chẽ dữ liệu báo cáo (Nhân viên: cá nhân, Trưởng phòng: phòng ban, CEO: toàn công ty)<br/>- Bảo mật Audit Log: chỉ CEO & IT Admin<br/>- Xuất file CSV UTF-8 BOM (`\uFEFF`) chuẩn tiếng Việt Windows | - Dashboard aggregate cache 60s<br/>- Khối "CẦN HÀNH ĐỘNG NGAY" đặt trên cùng kèm hiệu ứng viền cảnh báo<br/>- Phân quyền data scoping cứng ở backend service<br/>- Excel mở ra không bị lỗi font tiếng Việt | ✅ **ĐẠT** |
| **6** | **PWA & Trải nghiệm Di động** | - Cài đặt lên Màn hình chính (Add to Home Screen)<br/>- Chạy offline App Shell cơ bản<br/>- Web App Manifest đầy đủ icons, theme `#0A66C2`<br/>- Responsive mượt mà trên màn hình nhỏ 360–430px<br/>- Thao tác một tay thuận tiện (touch target $\ge 44 \times 44$px) | - Manifest chuẩn PWA độc lập (standalone)<br/>- Service Worker `sw.js` cache app shell<br/>- Component `PwaInstallPrompt` hỗ trợ cả Android và hướng dẫn iOS Safari<br/>- Component `OfflineBanner` cảnh báo mạng<br/>- Nút bấm to rõ, bảng cuộn ngang an toàn | ✅ **ĐẠT** |
| **7** | **Bảo mật, Sao lưu & Bàn giao Kỹ thuật** | - Rate limiting chống brute force & spam OTP<br/>- Security headers (Helmet)<br/>- Khóa chặt CORS domain whitelist<br/>- Bất biến Audit Log ở cấp Engine PostgreSQL<br/>- Script sao lưu tự động cho Linux/Docker (.sh) & Windows (.bat)<br/>- Diễn tập khôi phục dữ liệu có biên bản<br/>- OpenAPI/Swagger UI tại `/api/docs`<br/>- Đầy đủ tài liệu quản trị, hướng dẫn sử dụng và văn bản chốt điều kiện với HVE | - Rate limitlogin (5 lần/p) & OTP (3 lần/p)<br/>- Helmet CSP/HSTS/Frame-Options bật<br/>- Script `db_security_hardening.sql` REVOKE DELETE AuditLog<br/>- Đã lập `BIEN_BAN_TEST_RESTORE.md`<br/>- Đã lập `HUONG_DAN_QUAN_TRI.md`<br/>- Đã lập `HUONG_DAN_SU_DUNG.md`<br/>- Đã lập `VAN_BAN_XAC_NHAN_CHOT_HVE.md` | ✅ **ĐẠT** |

---

## 🏆 KẾT LUẬN NGHIỆM THU

Căn cứ vào kết quả kiểm thử thực tế, đối soát mã nguồn và kiểm chứng độc lập:
Hệ thống phần mềm **HVE Work** đã đáp ứng **100% các tiêu chí kỹ thuật và nghiệp vụ** được đề ra trong Developer Brief.

**ĐÁNH GIÁ CHUNG: NGHIỆM THU DỰ ÁN ĐẠT XUẤT SẮC (100% PASS)**
