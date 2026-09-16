# Kế hoạch Triển khai Phase 4 — Thông báo, Báo cáo, Dashboard

Tài liệu thiết kế kỹ thuật và kế hoạch thi công Phase 4 cho hệ thống **HVE Work**, bám sát [03_TASKLIST_DEV.md](file:///e:/HUYVOEDUCATION/HVE%20Work/03_TASKLIST_DEV.md) §Phase 4 và brief yêu cầu của Huy Vo Education.

---

## 📌 1. Mục tiêu & Phạm vi Phase 4

Phase 4 hoàn thiện năng lực giám sát, thông báo và điều hành toàn diện theo đúng mục 6-7 HVE Brief và chỉ đạo từ Trưởng phòng IT ([10_REVIEW_PHASE4_PLAN.md](10_REVIEW_PHASE4_PLAN.md)):

### 1.1. Đủ 5/5 Loại Thông báo theo Brief (Tức thời & Theo mốc lịch)
1. **Có hồ sơ cần duyệt (TỨC THỜI)**: Gửi ngay cho người/vai trò giữ bước duyệt khi hồ sơ được gửi duyệt (`submitForApproval`) hoặc khi bước trước vừa duyệt xong (`approveStep`).
2. **Hồ sơ được duyệt / trả lại / từ chối (TỨC THỜI)**: Gửi ngay cho người tạo hồ sơ (`createdById`) kèm lý do khi hồ sơ hoàn tất phê duyệt, bị trả lại hoặc bị từ chối.
3. **Công việc sắp đến hạn (CRON / LỊCH)**: Quét tự động gửi cho người thực hiện (`assigneeId`) theo mốc nhắc nhở cấu hình (VD: trước 1 ngày, trước 3 ngày).
4. **Công việc quá hạn & Leo thang (CRON / LỊCH)**: Quét tự động gửi cho người thực hiện khi quá hạn; nếu quá hạn $\ge 1$ ngày gửi thêm cho Trưởng bộ phận, nếu quá hạn $\ge 3$ ngày (ngưỡng leo thang mặc định) gửi thêm cho CEO.
5. **Hợp đồng sắp hết hạn (CRON / LỊCH)**: Quét tự động gửi cho người phụ trách (`manager`) và bộ phận Pháp chế khi còn $\le 30$ ngày.

### 1.2. Dashboard Điều hành chuyên biệt theo 4 Vai trò
- **CEO Dashboard**: Tổng quan sức khỏe doanh nghiệp, dòng tiền thanh toán duyệt, số việc chậm tiến độ, hợp đồng sắp hết hạn.
- **Trưởng bộ phận Dashboard**: Tiến độ công việc trong phòng, hồ sơ chờ duyệt của phòng mình, hiệu suất nhân viên.
- **Kế toán & Pháp chế Dashboard**: Hồ sơ thanh toán cần chi, hợp đồng cần thẩm định pháp lý, hợp đồng sắp đáo hạn.
- **Nhân viên Dashboard**: Các việc cần làm ngay trong ngày, việc sắp tới hạn, tiến độ các hồ sơ tự tạo.
- *Nguyên tắc thiết kế*: Khối **"Cần hành động ngay"** luôn nằm ở vị trí trên cùng; in-memory cache 60s cho aggregate query (được chọn cho MVP, kiến trúc mở sẵn sàng switch sang Redis khi chạy multi-instance).

### 1.3. Báo cáo Đa chiều, Xuất dữ liệu & Phân quyền bảo mật
- **Đủ 5 bộ lọc nghiệp vụ theo brief**: Khoảng thời gian, Bộ phận, **Người dùng**, Trạng thái và **Loại hồ sơ**.
- **Phân quyền Tab "Nhật ký hệ thống" (Audit Log)**: Giới hạn **chỉ CEO và IT Admin** được xem và xuất dữ liệu audit log (tránh lộ `beforeJson`/`afterJson` của người khác).
- **Xuất file Excel/CSV chuẩn**: Định dạng CSV có gắn **BOM UTF-8** (`\uFEFF`) chống vỡ font tiếng Việt tuyệt đối khi mở bằng Microsoft Excel trên Windows.
- **Click-to-Drill-down**: Từ các chỉ số tổng hợp click chuyển ngay sang danh sách chi tiết có filter tương ứng.

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
