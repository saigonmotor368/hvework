# Kế hoạch Triển khai Phase 3: Quản lý Công việc (Task Management) — Đã cập nhật theo Review

## Mục tiêu Phase 3 & Các quyết định đã chốt

### 1. Tránh bug cũ từ Phase 1 & 2 (Ưu tiên số 1):
1. **Chặn double-submit / gọi trùng ở `confirmCompletion()`**:
   - Kiểm tra ngay đầu hàm: `if (task.status !== 'Chờ duyệt') throw new BadRequestException(...)`.
   - Thực thi cập nhật `status = 'Hoàn thành'` và sinh kỳ mới (nếu có `recurrenceRule`) trong `prisma.$transaction`.
   - Bất kỳ lần gọi thứ 2 nào (double-click hoặc mạng lag) đều bị chặn ngay lập tức, không sinh trùng task kỳ mới.
2. **Tab "Việc bộ phận" có logic phân quyền rõ ràng**:
   - Lọc các công việc mà người thực hiện (`assignee.departmentId === userDeptId`) HOẶC người giao việc (`createdBy.departmentId === userDeptId`).
   - Giới hạn quyền: Với `department_head`, chỉ lọc trong bộ phận mình phụ trách; với `ceo`, có thể xem toàn công ty.

### 2. Bốn quyết định nghiệp vụ đã thống nhất:
3. **Tiến độ việc cha có việc con**:
   - Khi task đã có ≥ 1 việc con: Tiến độ cha = trung bình cộng tiến độ các việc con.
   - Khóa cập nhật trực tiếp: `updateProgress` sẽ chặn nếu gọi trên task cha đang có việc con. UI hiển thị tiến độ tự động (read-only) và ẩn thanh nhập tay.
4. **Việc lặp lại độc lập**:
   - `recurrenceRule` chỉ áp dụng trên việc độc lập (không có việc con và không phải là việc con). Validate chặn nếu kết hợp cả 2 để tránh phức tạp và lỗi đệ quy.
5. **Tịnh tiến hạn hoàn thành với Round-Forward**:
   - Helper tính chu kỳ lặp: `daily` (+1 ngày), `weekly` (+7 ngày), `monthly` (dùng safe month addition chống tràn ngày cuối tháng).
   - Nếu `dueDate cũ + interval < now` (xác nhận trễ), hệ thống tự động cộng tiếp chu kỳ đến mốc tương lai gần nhất (`round-forward`), đảm bảo kỳ mới không bị quá hạn ngay khi sinh ra.
6. **Phân quyền sửa việc (`PUT /tasks/:id`)**:
   - Chỉ người giao việc (`createdById`), Trưởng bộ phận của phòng ban đó (`department_head`), hoặc `ceo` mới được đổi `assigneeId` hoặc `dueDate`.
   - Mọi thay đổi đều được ghi nhận chi tiết vào `AuditLog`.

### 3. Lưu ý kỹ thuật:
- `Notification.dedupeKey`: Sinh khóa duy nhất `mention_task_${taskId}_comment_${commentId}_user_${userId}_${Date.now()}` chống lỗi unique constraint.
- Safe month helper: Đảm bảo 31/01 + 1 tháng ra đúng 28/02 (hoặc 29/02 năm nhuận).
- Cờ `is_overdue`: Tính toán runtime khi `now > dueDate` và status chưa hoàn thành.

---

## Danh mục thay đổi mã nguồn

### 1. Database Schema (`hve-backend/prisma/schema.prisma`)
- Bổ sung `tags String?` và `collaboratorIds Json?` vào model `Task`.

### 2. Backend (`hve-backend`)
- DTOs: `CreateTaskDto`, `UpdateTaskDto`, `UpdateProgressDto`, `CreateCommentDto`.
- `TasksService` & `TasksController`:
  - `POST /tasks`: Tạo việc mới
  - `GET /tasks`: Lấy danh sách việc có bộ lọc (tab, status, priority, search, overdue)
  - `GET /tasks/:id`: Lấy chi tiết việc kèm subtasks, comments, attachments
  - `PUT /tasks/:id`: Cập nhật thông tin việc (người giao việc), audit log thay đổi assignee/dueDate
  - `PATCH /tasks/:id/progress`: Cập nhật tiến độ % (người thực hiện / phối hợp / giao), tự động tính tiến độ cha
  - `POST /tasks/:id/complete`: Xác nhận hoàn thành (**chỉ người giao việc**), tự sinh kỳ mới nếu task lặp lại
  - `POST /tasks/:id/comments`: Thêm bình luận & mention (sinh notification)
  - `GET /tasks/:id/comments`: Lấy bình luận
- `TasksModule` & đăng ký vào `AppModule`.
- Unit tests: `tasks.service.spec.ts`.

### 3. Frontend (`hve-frontend`)
- `types.ts`: Thêm types cho Task, SubTask, Comment.
- `TaskListView.tsx`: Danh sách việc với tabs, bộ lọc, thanh tiến độ, badge quá hạn.
- `TaskDetailModal.tsx`: Chi tiết việc, cập nhật tiến độ, nút hoàn thành (cho người giao), danh sách việc con, bình luận mention.
- `CreateTaskModal.tsx`: Modal tạo và giao việc.
- `Sidebar.tsx`: Thêm mục menu Quản lý công việc.
- `App.tsx`: Tích hợp quản lý state và gọi API task.
