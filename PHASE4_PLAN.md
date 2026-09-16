# Kế hoạch Triển khai Phase 4 — Thông báo, Báo cáo, Dashboard

Tài liệu thiết kế kỹ thuật và kế hoạch thi công Phase 4 cho hệ thống **HVE Work**, bám sát [03_TASKLIST_DEV.md](file:///e:/HUYVOEDUCATION/HVE%20Work/03_TASKLIST_DEV.md) §Phase 4 và brief yêu cầu của Huy Vo Education.

---

## 📌 1. Mục tiêu & Phạm vi Phase 4

Phase 4 hoàn thiện năng lực giám sát và điều hành toàn diện của ban lãnh đạo và các phòng ban tại HVE:
1. **Hệ thống Thông báo & Nhắc hạn thông minh (Reminders & Notifications)**:
   - Cấu hình mốc nhắc đa dạng (`ReminderRule`: trước 3 ngày, trước 1 ngày, đúng hạn, quá hạn 1 ngày...).
   - Cơ chế chống gửi trùng thông báo (`dedupeKey` chuẩn hóa theo ngày và mốc).
   - Quy tắc leo thang (Escalation): Công việc quá hạn tự động thông báo thêm cho Trưởng bộ phận và CEO.
   - Trung tâm thông báo (Notification Center): Icon chuông trên header, popover thông báo, đếm số chưa đọc, đánh dấu đã đọc.
   - Interface `NotificationChannel` mở sẵn cho kênh Zalo OA trong tương lai, hiện tại kích hoạt In-app & Email.
2. **Dashboard Điều hành chuyên biệt theo 4 Vai trò**:
   - **CEO Dashboard**: Tổng quan sức khỏe doanh nghiệp, dòng tiền thanh toán duyệt, số việc chậm tiến độ, hợp đồng sắp hết hạn.
   - **Trưởng bộ phận Dashboard**: Tiến độ công việc trong phòng, hồ sơ chờ duyệt của phòng mình, hiệu suất nhân viên.
   - **Kế toán & Pháp chế Dashboard**: Hồ sơ thanh toán cần chi, hợp đồng cần thẩm định pháp lý, hợp đồng sắp đáo hạn.
   - **Nhân viên Dashboard**: Các việc cần làm ngay trong ngày, việc sắp tới hạn, tiến độ các hồ sơ tự tạo.
   - *Nguyên tắc thiết kế*: Ưu tiên khối **"Cần hành động ngay"** lên trước các biểu đồ số liệu thuần; áp dụng in-memory cache 60s cho aggregate query.
3. **Báo cáo Động & Xuất dữ liệu (Reports & Export)**:
   - Báo cáo đa chiều: Công việc (theo nhân sự, phòng ban, trạng thái, thời gian), Hồ sơ & Thanh toán, Hợp đồng & Đối tác, Nhật ký thao tác (Audit Log).
   - Bộ lọc linh hoạt: Khoảng thời gian (tháng này, quý này, tùy chọn), bộ phận, người dùng, trạng thái.
   - Xuất file Excel (.xlsx / CSV) và PDF (HTML-print) chuẩn đẹp, có chữ ký và watermark.
   - **Bảo mật xuất báo cáo**: Dữ liệu xuất phải tuân thủ nghiêm ngặt theo phân quyền vai trò (nhân viên không thể xuất vượt scope phòng ban mình).
   - **Click-to-Drill-down**: Từ các chỉ số tổng hợp trong báo cáo, click để mở xem danh sách chi tiết tương ứng.

---

## 🏗️ 2. Thiết kế Kỹ thuật Backend (`hve-backend`)

### 2.1. Cập nhật Schema Database (`prisma/schema.prisma`)
- Bổ sung trường cho `Notification`:
  - `title`: Tiêu đề thông báo ngắn gọn.
  - `content`: Nội dung chi tiết.
  - `link`: URL/route nội bộ để click chuyển hướng (VD: `/documents?id=5` hoặc `/tasks?id=12`).
- Bổ sung trường cho `ReminderRule`:
  - `name`: Tên quy tắc (VD: "Nhắc duyệt hồ sơ thanh toán", "Cảnh báo hợp đồng sắp hết hạn").
  - `isActive`: Boolean bật/tắt quy tắc.

### 2.2. Module Thông báo & Nhắc hạn (`notifications`)
- **Dedupe Key chuẩn hóa**:
  `reminder_${entityType}_${entityId}_offset${offsetDays}_${dateString}`
  $\rightarrow$ Chống gửi trùng tuyệt đối khi job quét nhiều lần trong ngày.
- **Job Quét mốc tự động (Cron / Scheduled Service)**:
  - Quét hồ sơ ở trạng thái `Chờ duyệt` quá hạn.
  - Quét công việc ở trạng thái `Đang làm` / `Chưa làm` sắp đến hạn hoặc quá hạn.
  - Quét hợp đồng sắp hết hạn (dựa trên `endDate`).
- **Interface đa kênh (`NotificationChannel`)**:
  ```typescript
  export interface NotificationChannel {
    send(notification: NotificationPayload): Promise<boolean>;
  }
  ```
  - `InAppChannel`: Ghi vào DB `Notification`.
  - `EmailChannel`: Gửi email template chuyên nghiệp qua Nodemailer (hoặc console mock logger chuẩn).
  - `ZaloChannel`: Stub interface sẵn sàng tích hợp Zalo OA sau này.
- **Quy tắc leo thang (Escalation)**:
  - Khi task quá hạn $\ge 1$ ngày: Gửi notification cho `assignee`, đồng thời tìm `createdBy.departmentId` để gửi cho Trưởng bộ phận, và nếu quá hạn $\ge 3$ ngày gửi thêm cho CEO.

### 2.3. Module Dashboard & Cache (`dashboard`)
- Endpoint: `GET /dashboard`
- Service tự động nhận diện `user.roles` và `user.departmentId` để tổng hợp số liệu phù hợp:
  - `actionItems`: Các mục cần user xử lý ngay (hồ sơ cần duyệt, việc được giao sắp/quá hạn).
  - `metrics`: Các con số thống kê tổng hợp (tổng việc, hoàn thành %, số tiền đã duyệt, hợp đồng rủi ro).
  - `charts`: Dữ liệu phân bố trạng thái công việc và chi tiêu theo tháng.
- Caching: Lưu cache memory 60 giây theo key `dashboard_${userId}_${role}` để giảm tải database.

### 2.4. Module Báo cáo & Xuất dữ liệu (`reports`)
- Endpoint:
  - `GET /reports/summary`: Dữ liệu tổng hợp theo bộ lọc.
  - `GET /reports/export`: Xuất dữ liệu ra file Excel (hoặc CSV format UTF-8 kèm BOM hiển thị tiếng Việt hoàn hảo) hoặc HTML print-friendly cho PDF.
- Kiểm soát phân quyền xuất:
  - CEO / IT Admin: Xuất toàn công ty.
  - Trưởng BP: Chỉ xuất dữ liệu trong phòng ban mình phụ trách.
  - Nhân viên: Chỉ xuất dữ liệu cá nhân mình liên quan.

---

## 🎨 3. Thiết kế Giao diện Frontend (`hve-frontend`)

1. **Header Notification Center (`NotificationBell.tsx`)**:
   - Nút Chuông hiển thị trên Header Bar với chấm đỏ và số đếm chưa đọc.
   - Dropdown menu danh sách thông báo mới nhất (in-app), phân biệt đã đọc/chưa đọc.
   - Nút "Đánh dấu tất cả đã đọc" (`PATCH /notifications/read-all`).
   - Click vào thông báo chuyển ngay tới tab tương ứng (Documents hoặc Tasks) và mở modal chi tiết.
2. **Dashboard Theo Vai Trò (`OverviewDashboard.tsx` nâng cấp)**:
   - Thanh chọn tab vai trò (nếu user có nhiều vai trò, VD vừa là Trưởng BP vừa là Kế toán).
   - Khối **"Cần hành động ngay"** (Hồ sơ cần duyệt, Việc cần nộp/duyệt) hiển thị đầu tiên với nút bấm xử lý trực tiếp.
   - Khối Chỉ số KPI & Biểu đồ tiến độ (thanh tỷ lệ %, biểu đồ cột mức chi tiêu).
3. **Màn hình Báo cáo (`ReportsView.tsx`)**:
   - Thanh điều hướng: Báo cáo công việc / Báo cáo tài chính & thanh toán / Báo cáo hợp đồng / Nhật ký hệ thống.
   - Thanh lọc thời gian (Hôm nay, Tuần này, Tháng này, Quý này, Tùy chọn), chọn Bộ phận, Trạng thái.
   - Bảng dữ liệu có hỗ trợ Click-to-Drill-down (click vào dòng/con số để xem danh sách chi tiết).
   - Nút **"📥 Xuất Excel"** và **"🖨️ In / Xuất PDF"**.
4. **Màn hình Quản trị Mốc nhắc nhở (`AdminReminderView.tsx`)**:
   - IT Admin xem và cấu hình danh sách mốc nhắc nhở cho từng loại hồ sơ/công việc/hợp đồng.

---

## 🧪 4. Kế hoạch Kiểm thử & Tiêu chuẩn Nghiệm thu Phase 4

### Kế hoạch Kiểm thử Backend:
- Unit tests cho `NotificationsService`:
  - Đánh dấu đã đọc, unread count.
  - Sinh dedupeKey chuẩn và chặn bắn trùng lặp mốc nhắc trong cùng ngày.
  - Quy tắc leo thang: kiểm tra việc quá hạn gửi đúng cho Trưởng BP và CEO.
  - Interface channel email và in-app.
- Unit tests cho `DashboardService`:
  - Aggregate dữ liệu đúng theo 4 vai trò.
  - Kiểm tra cache 60s (gọi lần 2 không hit DB).
- Unit tests cho `ReportsService`:
  - Lọc theo phòng ban và chặn nhân viên xuất dữ liệu vượt phạm vi phòng ban khác.
  - Kiểm tra định dạng dữ liệu xuất.

### Tiêu chí Nghiệm thu Phase 4 (Theo brief):
- [x] Tạo 1 hồ sơ cận hạn và 1 việc quá hạn: kiểm tra thông báo gửi đúng người, không trùng lặp, đúng quy tắc leo thang.
- [x] Đăng nhập 4 vai trò khác nhau kiểm tra Dashboard hiển thị đúng góc nhìn và khối hành động.
- [x] Màn hình Báo cáo lọc dữ liệu theo thời gian, phòng ban; xuất được file Excel/PDF tiếng Việt chuẩn và drill-down được vào danh sách chi tiết.
