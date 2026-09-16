# NHẬT KÝ CÔNG VIỆC & THEO DÕI TIẾN ĐỘ DỰ ÁN HVE APP

> **Tài liệu này được duy trì liên tục sau mỗi phiên làm việc.**
> Mục tiêu: Đảm bảo không bao giờ bị mất ngữ cảnh (context), dù có đổi máy, ngắt kết nối hay bắt đầu phiên chat mới thì người dùng và AI đều có thể tiếp tục công việc ngay lập tức.

---

## 📌 1. TỔNG QUAN DỰ ÁN & TIẾN ĐỘ CÁC PHASE

| Phase | Tên giai đoạn | Trạng thái | Đánh giá |
|---|---|---|---|
| **Phase 0** | Nền tảng & Hạ tầng (Auth, RBAC, DB Schema, CI) | **ĐÃ HOÀN THÀNH** | ✅ Đạt nghiệm thu ([04_REVIEW_PHASE0.md](04_REVIEW_PHASE0.md)) |
| **Phase 1** | Lõi phê duyệt: Đề nghị thanh toán (Backend + Frontend) | **ĐÃ HOÀN THÀNH** | ✅ Đạt nghiệm thu ([05_REVIEW_PHASE1.md](05_REVIEW_PHASE1.md)) |
| **Phase 2** | Mở rộng phê duyệt: Đề xuất, Hợp đồng, IT Admin Workflow | **ĐÃ HOÀN THÀNH** | ✅ Đạt nghiệm thu ([07_REVIEW_PHASE2.md](07_REVIEW_PHASE2.md)) |
| **Phase 3** | Quản lý công việc (Task Management, Recurring Tasks) | **ĐÃ HOÀN THÀNH** | ✅ Đạt 92/92 tests pass, build sạch sẽ, xử lý triệt để 6 điểm theo review [08_REVIEW_PHASE3_PLAN.md](08_REVIEW_PHASE3_PLAN.md) |
| **Phase 4** | Thông báo, Báo cáo, Dashboard nâng cao | **ĐÃ HOÀN THÀNH** | ✅ Đạt 105/105 tests pass, 0 lint warnings, hoàn thành trọn vẹn review [10_REVIEW_PHASE4_PLAN.md](10_REVIEW_PHASE4_PLAN.md) |
| **Phase 5** | PWA, Bảo mật (Hardening), UAT & Bàn giao | ⏳ **CHỜ BẮT ĐẦU** | Sẵn sàng triển khai tiếp theo |

---

## 🛠️ 2. TRẠNG THÁI HỆ THỐNG HIỆN TẠI (Tính đến 16/09/2026)

### A. Backend (`hve-backend`)
- **Công nghệ**: NestJS 11, Prisma ORM, PostgreSQL, Vitest.
- **Kết quả kiểm thử**: **40/40 unit tests pass** (tăng từ 21 tests ở Phase 0).
- **Kết quả build**: `npm run build` thành công, không lỗi TypeScript / ESM.
- **Các module đã triển khai**:
  1. **Auth & RBAC**:
     - Đăng nhập JWT (access token 15 phút, refresh token 7 ngày băm bcrypt trong DB).
     - Khóa tài khoản sau 5 lần nhập sai trong 15 phút.
     - Quên mật khẩu qua OTP 6 số (chống dò email).
     - Phân quyền RBAC 6 vai trò: `ceo`, `department_head`, `accountant`, `legal`, `employee`, `it_admin`.
  2. **Documents (Phê duyệt Đề nghị thanh toán)**:
     - Tạo mã tự động `DNTT-YYYY-NNN`.
     - Validate nghiệp vụ: số tiền, người nhận, thông tin ngân hàng, nội dung.
     - **Bắt buộc có chứng từ** đính kèm trước khi cho phép bấm gửi duyệt.
     - Snapshot luồng phê duyệt từ `WorkflowTemplate` sang `DocumentApprovalStep`.
     - 4 cấp duyệt tuần tự: Người tạo → Trưởng bộ phận → Kế toán → CEO.
     - **Chặn tự phê duyệt**: Người tạo không thể tự duyệt hồ sơ của chính mình.
     - **Bắt buộc nhập lý do** khi Trả lại hoặc Từ chối hồ sơ.
     - Khi Trả lại: Hồ sơ về trạng thái Nháp, người tạo chỉnh sửa và gửi duyệt lại từ đầu.
     - **Chống duyệt kép**: Sử dụng Optimistic Locking (`version` column).
     - **Tạo phiên bản mới**: Cho phép tạo bản sửa đổi (`-v2`, `-v3`) cho hồ sơ đã duyệt.
  3. **Attachments & File Storage**:
     - Endpoint sinh Pre-signed URL (`POST /attachments/presigned-url`).
     - Endpoint tải file trực tiếp lên server storage (`PUT /attachments/upload-storage/:fileKey`).
     - Đăng ký metadata file (`POST /attachments/register`).
  4. **Audit Log**:
     - Ghi nhận lịch sử mọi thao tác (tạo, sửa, gửi duyệt, duyệt, trả lại, từ chối, tạo version mới) kèm `beforeJson`, `afterJson`, `actorId`, `ip`.

### B. Frontend (`hve-frontend`)
- **Công nghệ**: React 19, TypeScript, Vite, TailwindCSS.
- **Kết quả build**: `npm run build` sạch sẽ, thành công.
- **Các tính năng đã triển khai trên giao diện (`App.tsx`)**:
  - Giao diện đăng nhập & ghi nhớ phiên (`localStorage`).
  - Trang Tổng quan (Dashboard số liệu hồ sơ: tổng số, nháp, chờ duyệt, đã duyệt, từ chối).
  - Bộ lọc danh sách hồ sơ: Theo Tab (Tất cả, Của tôi, Cần tôi duyệt), theo Trạng thái, ô Tìm kiếm.
  - Form tạo hồ sơ Đề nghị thanh toán đầy đủ các trường nghiệp vụ và chọn đính kèm file chứng từ.
  - Xem chi tiết hồ sơ: Dòng thời gian trực quan (Timeline visual 4 bước duyệt, màu sắc trạng thái, người duyệt, thời gian, ghi chú).
  - Các nút hành động thông minh theo quyền người dùng:
    - Người tạo: Nút "Gửi duyệt", nút "Xóa nháp", nút "Tạo phiên bản mới" (khi đã duyệt).
    - Người phê duyệt: Nút "Phê duyệt", nút "Trả lại hồ sơ", nút "Từ chối hồ sơ".
  - Modal bắt buộc nhập lý do khi Trả lại hoặc Từ chối.
  - Chống double-submit (vô hiệu hóa nút và hiện trạng thái đang xử lý).

---

## 📝 3. LỊCH SỬ CÁC PHIÊN LÀM VIỆC (SESSION LOGS)

### Phiên 1 (15/09/2026) — Nền tảng Phase 0
- **Nội dung**: Khởi tạo kiến trúc dự án, Docker Compose, DB Prisma schema, Module Auth (JWT, RBAC Guard, Lockout, OTP reset password).
- **Kết quả**: Nghiệm thu Phase 0 ĐẠT (21/21 unit tests). Ghi nhận tại [04_REVIEW_PHASE0.md](04_REVIEW_PHASE0.md).

### Phiên 2 (15/09/2026) — Lõi Backend Phase 1
- **Nội dung**: Xây dựng module phê duyệt Đề nghị thanh toán ở Backend, xử lý State machine, Anti-self-approval rule, Optimistic locking, Audit log.
- **Kết quả**: Backend đạt 32/32 tests. Review Phase 1 lần 1 ghi nhận backend tốt nhưng chưa làm Frontend và còn thiếu pre-signed upload, validate chứng từ bắt buộc. Ghi nhận tại [05_REVIEW_PHASE1.md](05_REVIEW_PHASE1.md).

### Phiên 3 (15/09/2026) — Hoàn thiện Frontend & Bổ sung Backend Phase 1
- **Nội dung**:
  - Backend: Bổ sung validate bắt buộc đính kèm file trong `submitForApproval()`; thêm endpoint `createNewVersion()` cho hồ sơ đã duyệt; hoàn thiện endpoint sinh `presigned-url` và upload file.
  - Backend Tests: Nâng tổng số unit tests lên **40/40 tests pass**.
  - Frontend: Xây dựng toàn bộ giao diện hoàn chỉnh trong `App.tsx` (1.472 dòng code) bao gồm Auth, Dashboard, Form tạo hồ sơ, File upload, Danh sách & Chi tiết hồ sơ, Luồng 4 bước duyệt, Modal nhập lý do, Action buttons phân quyền.
  - Frontend Build: `npm run build` đạt chuẩn.

### Phiên 4 (16/09/2026 - Hôm nay) — Rà soát toàn diện, Vá lỗ hổng bảo mật & Refactor Frontend
- **Vấn đề phát hiện & xử lý**:
  1. **Lỗ hổng bảo mật upload file (PUT /attachments/upload-storage/:fileKey)**:
     - Đã thêm `@UseGuards(JwtAuthGuard)` chặn người dùng chưa đăng nhập.
     - Sinh chữ ký HMAC SHA-256 kèm thời hạn 15 phút tại `generatePresignedUrl`, kiểm tra xác thực khi upload chống gọi tắt.
     - Lắng nghe stream data, ngắt kết nối (`req.destroy()`) ngay khi luồng dữ liệu vượt 10MB để chống DoS bộ nhớ/ổ đĩa.
     - Validate lại định dạng phần mở rộng và kích thước buffer trước khi ghi đĩa; chống path traversal bằng `path.basename`.
  2. **Vá triệt để lỗ hổng tải chứng từ (Bảo vệ thông tin tài chính/ngân hàng)**:
     - Gỡ bỏ hoàn toàn `app.useStaticAssets(uploadDir, { prefix: '/uploads/' })` khỏi `main.ts`, xóa bỏ đường tắt công khai không xác thực. Truy cập `/uploads/...` hiện nhận lỗi 404.
     - Đổi toàn bộ `fileUrl` ở backend (`generatePresignedUrl` và `saveUploadedFile`) sang trỏ về endpoint an toàn `/attachments/file/:fileKey`.
     - Cấu hình `JwtStrategy` hỗ trợ trích xuất JWT qua query param `?token=...`.
     - Frontend `DocumentDetailModal.tsx` gắn token vào URL tải file, đi qua `JwtAuthGuard` 100%. Truy cập không token bị chặn 401 Unauthorized.
  3. **Sửa bug logic số hiệu bản sửa đổi (`createNewVersion`)**:
     - Tách độc lập `revision` number với `version` optimistic-lock. Đếm tài liệu có cùng `baseCode` trong DB để tính đúng mã `-v2`, `-v3` kể cả khi `doc.version` của bản ghi gốc là 6.
     - Bản nháp sửa đổi mới khởi tạo `version: 1` cho khoá lạc quan riêng.
  4. **Dọn dẹp chất lượng Frontend (Modularization & Config)**:
     - Tách component `App.tsx` (1.471 dòng) thành 8 component con trong `src/components/` (`LoginPage`, `Sidebar`, `OverviewDashboard`, `DocumentList`, `DocumentDetailModal`, `CreateDocumentForm`, `ActionReasonModal`, `Toast`) và `src/types.ts`.
     - Thay thế toàn bộ 13 vị trí hardcode `http://localhost:3000` bằng `API_BASE_URL` (thông qua `import.meta.env.VITE_API_URL`).
     - Tạo sẵn `.env.example` cho backend và frontend.
     - Thêm `uploads/` và `*.db` vào `.gitignore` của root và backend.
  5. **Quản lý mã nguồn & Kiểm thử**:
     - Khởi tạo Git repo (`git init -b main`) và cấu hình theo dõi phiên bản.
     - Unit tests backend: **51/51 tests pass** (tăng thêm 11 tests mới kiểm tra bảo mật upload, HMAC signature, size limit, path traversal, revision numbering, phục vụ file có guard).
     - Lint backend: **0 warnings, 0 errors**.
     - Frontend build: **Pass sạch sẽ trong 216ms**.
     - Nghiệm thu Phase 1: **CHÍNH THỨC ĐẠT** (Xem [05_REVIEW_PHASE1.md](05_REVIEW_PHASE1.md)).

### Phiên làm việc: 16/09/2026 (Phiên 3 — Triển khai hoàn thiện Phase 2: Mở rộng phê duyệt & Quản trị IT Admin)
- **Nhiệm vụ chính**: Triển khai trọn vẹn Phase 2 theo kế hoạch [PHASE2_PLAN.md](PHASE2_PLAN.md) và tiếp thu toàn bộ góp ý tại [06_REVIEW_PHASE2_PLAN.md](06_REVIEW_PHASE2_PLAN.md).
- **Kết quả thực hiện**:
  1. **Đa dạng hóa loại hồ sơ trên cùng 1 Core Approval Engine (Backend)**:
     - Hỗ trợ đầy đủ 3 loại hồ sơ: Đề nghị thanh toán (`payment_request`, mã `DNTT-YYYY-NNN`), Đề xuất (`proposal`, mã `DX-YYYY-NNN`), Hợp đồng (`contract`, mã `HD-YYYY-NNN`).
     - Tái sử dụng 100% Core Engine: chung các hàm `submitForApproval`, `approveStep`, `returnStep`, `rejectStep`, `createNewVersion`, Optimistic Locking (`version`) và Audit Trail.
     - Validate động theo loại khi gửi duyệt: `proposal` không ép buộc chứng từ; `contract` bắt buộc có file hợp đồng đính kèm và ngày hiệu lực ≤ ngày hết hạn.
  2. **Vá triệt để lỗ hổng phân quyền duyệt theo bộ phận (`department_head`)**:
     - Kiểm tra bắt buộc: khi bước duyệt yêu cầu `department_head`, so sánh `document.createdBy.departmentId === user.departmentId`. Chặn hoàn toàn việc Trưởng phòng ban này duyệt hồ sơ của nhân sự phòng ban khác.
     - Cập nhật cả ở luồng duyệt (`approveStep`, `returnStep`, `rejectStep`) và danh sách cần duyệt (`findAll` tab `to_review`).
     - Các vai trò toàn công ty (`accountant`, `legal`, `ceo`) giữ nguyên phạm vi duyệt toàn hệ thống.
  3. **Theo dõi và Cảnh báo hạn Hợp đồng**:
     - Helper runtime `calculateContractExpiry` và endpoint `GET /documents/contracts/expiring`: gắn cờ `isExpiringSoon`, trạng thái `valid` / `expiring_soon` (mặc định ≤ 30 ngày) / `expired`, và số ngày còn lại `daysRemaining`.
  4. **Module & API Quản lý Workflow cho IT Admin (`WorkflowsModule`)**:
     - Cung cấp `GET /workflows`, `GET /workflows/:type`, `PUT /workflows/:type`.
     - Validate chặt chẽ cấu hình: kiểm tra `stepOrder` liên tục từ 1, không rỗng, đối chiếu vai trò với bảng `Role` trong DB.
     - Cập nhật các bước trong transaction, ghi nhận Audit Log.
  5. **Module & API Quản lý Người dùng & Phân quyền cho IT Admin (`AdminModule`)**:
     - Cung cấp `GET /admin/users`, `GET /admin/roles`, `GET /admin/departments`, `PATCH /admin/users/:id/status`, `PUT /admin/users/:id/roles`.
     - Cơ chế an toàn: Chặn IT admin tự khóa tài khoản của chính mình.
  6. **Seed Database hoàn chỉnh (`prisma/seed.ts`)**:
     - Seed sẵn workflow templates cho `proposal` (Trưởng BP → CEO) và `contract` (Trưởng BP → Pháp chế → Kế toán → CEO).
     - Thêm tài khoản test cho Trưởng phòng IT (`tp_it@hve.com`) và Pháp chế (`phapche@hve.com`).
  7. **Giao diện người dùng Frontend Phase 2**:
     - `CreateDocumentForm.tsx`: Bộ chọn trực quan 3 loại hồ sơ với các trường dữ liệu tương ứng.
     - `DocumentList.tsx`: Thêm bộ lọc loại hồ sơ, badge phân loại màu sắc, badge cảnh báo hợp đồng sắp hết hạn / quá hạn.
     - `DocumentDetailModal.tsx`: Layout chi tiết động theo loại hồ sơ, hiển thị banner cảnh báo hạn hợp đồng và tiến trình duyệt động.
     - `AdminWorkflowView.tsx`: Màn hình trực quan cho IT Admin cấu hình thứ tự và vai trò các cấp duyệt.
     - `AdminUserView.tsx`: Màn hình quản lý nhân sự, gán vai trò, phân phòng ban và khóa/mở khóa tài khoản.
     - `Sidebar.tsx`: Thêm menu quản trị hệ thống (`admin_workflows`, `admin_users`) và nút chuyển nhanh tài khoản demo cho 6 vai trò.
  8. **Kiểm thử & Chất lượng mã nguồn**:
     - Unit tests backend: **71/71 tests pass** (tăng thêm 20 tests mới cho proposal, contract, hạn hợp đồng, phân quyền bộ phận chéo phòng, IT admin workflow validation, IT admin self-lock prevention).
     - Lint backend: **0 warnings, 0 errors** (oxlint sạch 100%).
     - Frontend build: **Pass sạch sẽ trong 216ms** (tsc + vite build 0 lỗi).
     - Nghiệm thu Phase 2: **CHÍNH THỨC ĐẠT** (Cả 3 loại hồ sơ chạy đúng luồng riêng bằng chung 1 engine; IT admin đổi được cấu hình duyệt và quản lý user qua UI mà không cần sửa code).

### 3.3. Phiên làm việc: Triển khai Phase 3 — Quản lý công việc (16/09/2026)
- **Mục tiêu**: Xây dựng toàn bộ phân hệ Quản lý công việc (Task Management) theo đúng brief, tuân thủ nghiêm ngặt 6 điểm chốt và 2 lưu ý kỹ thuật từ [08_REVIEW_PHASE3_PLAN.md](08_REVIEW_PHASE3_PLAN.md).
- **Các hạng mục đã hoàn thành**:
  1. **Schema Database Prisma**:
     - Bổ sung `tags String?` và `collaboratorIds Json?` vào model `Task`. Chạy `npx prisma generate` cập nhật Prisma Client.
  2. **Backend `TasksModule` & `TasksService`**:
     - Sinh mã việc tự động chuẩn hóa `CV-YYYY-NNN` (ví dụ `CV-2026-001`).
     - **Chặn double-submit `confirmCompletion`**: Kiểm tra `if (task.status !== 'Chờ duyệt') throw new BadRequestException(...)` ngay đầu hàm. Phân quyền: chỉ người giao việc (`createdById`) hoặc CEO mới được xác nhận hoàn thành.
     - **Xử lý việc lặp lại & helper an toàn**:
       - Helper `addMonthsSafe` chống tràn ngày cuối tháng (VD: 31/01 -> 28/02).
       - Helper `calculateNextDueDate` round-forward từ `dueDate` cũ tới mốc tương lai gần nhất (`>= now`).
       - Tự động sinh task kỳ mới khi xác nhận hoàn thành trong Prisma `$transaction`.
     - **Tính toán tiến độ việc con & việc cha**:
       - Khóa cập nhật tiến độ trực tiếp trên việc cha khi đã có việc con.
       - Tự động tính trung bình cộng tiến độ từ các việc con lên việc cha: 0% → Chưa làm, 1-99% → Đang làm, 100% → Chờ duyệt.
     - **Giới hạn 2 cấp công việc**: Chặn không cho tạo việc con vượt quá 2 cấp (việc cha và việc con).
     - **Cờ runtime `isOverdue`**: Tính động `status !== 'Hoàn thành' && dueDate < now`, không lưu cứng trong DB.
     - **Lọc 4 tab danh sách**:
       - `all`: Danh sách chung.
       - `assigned_to_me`: Lọc theo `assigneeId = user.id`.
       - `assigned_by_me`: Lọc theo `createdById = user.id`.
       - `department`: Lọc chính xác các việc mà `assignee.departmentId === userDeptId` HOẶC `createdBy.departmentId === userDeptId`.
     - **Bình luận, Mention & In-app Notification**:
       - `addComment` lưu bình luận kèm mảng ID người được nhắc tên (`mentions`).
       - Tự động tạo `Notification` với `dedupeKey: task_mention_${comment.id}_${userId}_${timestamp}` đảm bảo duy nhất tuyệt đối.
     - **Phân quyền sửa việc & Audit Log**:
       - Chỉ người giao việc, Trưởng BP cùng phòng hoặc CEO mới có quyền đổi `assigneeId` hoặc `dueDate`. Ghi nhận Audit Log sự kiện thay đổi.
     - **API danh sách nhân viên khả dụng**: Thêm `GET /tasks/users` để nhân viên dễ dàng chọn người thực hiện, người phối hợp và mention đồng nghiệp.
  3. **Frontend Phase 3**:
     - `types.ts`: Bổ sung `TaskItem`, `SubTaskItem`, `TaskComment`, bảng màu trạng thái và ưu tiên.
     - `CreateTaskModal.tsx`: Form tạo việc mới / việc con, chọn người làm, người phối hợp, mức độ ưu tiên, hạn, tag, chu kỳ lặp lại và tải file đính kèm.
     - `TaskDetailModal.tsx`: Xem chi tiết việc, thanh kéo slider cập nhật tiến độ (tự khóa khi có việc con), nút "Xác nhận hoàn thành" chỉ hiện cho người giao khi Chờ duyệt, danh sách việc con, tệp đính kèm và khu vực thảo luận mention.
     - `TaskListView.tsx`: Giao diện 4 tab, bộ lọc trạng thái, độ ưu tiên, checkbox xem việc quá hạn, tìm kiếm, bảng danh sách có thể mở rộng (accordion) xem việc con trực thuộc.
     - `Sidebar.tsx` & `App.tsx`: Tích hợp tab `tasks`, hiển thị badge số việc cần xử lý.
  4. **Kiểm thử & Build**:
     - Backend unit tests: **92/92 tests pass 100%** (bao phủ 21 unit tests mới trong `tasks.service.spec.ts` cho toàn bộ các case nghiệp vụ).
     - Backend build: **Pass sạch sẽ** (`nest build` 0 lỗi).
     - Frontend build: **Pass sạch sẽ** (`tsc -b && vite build` 0 lỗi).

### 3.4. Phiên làm việc: Triển khai Phase 4 — Thông báo, Báo cáo, Dashboard (16/09/2026)
- **Mục tiêu**: Hoàn thành toàn diện Phase 4 theo yêu cầu của anh Định (Chủ tịch) và tiếp thu 100% phản hồi quan trọng từ anh Minh (Trưởng phòng IT) tại [10_REVIEW_PHASE4_PLAN.md](10_REVIEW_PHASE4_PLAN.md).
- **Vá lỗi tồn đọng từ Phase 3**:
  - Chặn `recurrenceRule` trong `updateTask()` khi task có `subTasks` hoặc là việc con (`parentTaskId`).
  - Dọn dẹp sạch sẽ 2 lint warnings trong backend (0 errors, 0 warnings).
  - Đồng bộ toàn bộ email test sang domain `@huyvoeducation.vn`.
- **Các hạng mục Phase 4 đã hoàn thành**:
  1. **Schema Database Prisma**:
     - Bổ sung `title`, `content`, `link` vào model `Notification`.
     - Bổ sung `name`, `isActive` vào model `ReminderRule`. Chạy `npx prisma generate` thành công.
  2. **Bổ sung 2 loại Thông báo tức thời cốt lõi trong `DocumentsService`**:
     - Thay vì chỉ dựa vào cron quét mốc, đã tích hợp bắn thông báo tức thời ngay khi chuyển trạng thái hồ sơ trong `documents.service.ts`:
       - `submitForApproval`: Bắn thông báo ngay cho người duyệt bước 1 (`document_pending_approval`).
       - `approveStep`: Bắn thông báo cho người duyệt bước tiếp theo hoặc cho người tạo hồ sơ khi bước cuối được duyệt (`document_approved`).
       - `returnStep`: Bắn thông báo tức thời cho người tạo hồ sơ kèm lý do trả lại (`document_returned`).
       - `rejectStep`: Bắn thông báo tức thời cho người tạo hồ sơ kèm lý do từ chối (`document_rejected`).
  3. **Module Thông báo đa kênh (`NotificationsModule`)**:
     - Interface đa kênh `NotificationChannel`:
       - `InAppChannel`: Ghi DB, bắt mã lỗi `P2002` dedupeKey chống trùng thông báo.
       - `EmailChannel`: Gửi email / logger chuẩn format thương hiệu HVE.
       - `ZaloChannel`: Stub mở sẵn cho Zalo Official Account.
     - Cơ chế quét mốc định kỳ & leo thang (`triggerScheduledReminders`):
       - Quét công việc sắp đến hạn ($\le 1$ ngày).
       - Quét công việc quá hạn: quá hạn $\ge 1$ ngày báo Trưởng bộ phận, quá hạn $\ge 3$ ngày leo thang báo CEO.
       - Quét hợp đồng sắp hết hạn ($\le 30$ ngày) gửi cho Kế toán & Pháp chế.
       - Sinh `dedupeKey` duy nhất theo ngày: `reminder_${type}_${id}_${mốc}_${YYYY-MM-DD}` chống spam gửi trùng.
  4. **Module Dashboard theo 4 vai trò (`DashboardModule`)**:
     - Endpoint `GET /dashboard` và `POST /dashboard/clear-cache`.
     - In-memory cache 60s theo quyết định kiến trúc, key theo `dashboard_${userId}_${primaryRole}`.
     - Khối "CẦN HÀNH ĐỘNG NGAY" trên cùng phân loại chính xác theo 4 vai trò:
       - **CEO**: Hồ sơ chờ CEO duyệt, công việc leo thang quá hạn $\ge 3$ ngày, tỷ lệ hoàn thành theo phòng ban.
       - **Trưởng bộ phận**: Hồ sơ chờ Trưởng phòng duyệt trong phòng ban mình, việc quá hạn của nhân sự trong phòng ban.
       - **Kế toán & Pháp chế**: Đề xuất thanh toán đã duyệt chờ chi, hợp đồng sắp hết hạn $\le 30$ ngày, tổng giá trị hợp đồng.
       - **Nhân viên**: Hồ sơ bị trả lại cần sửa, công việc đến hạn hôm nay hoặc quá hạn.
  5. **Module Báo cáo & Phân quyền Audit Log (`ReportsModule`)**:
     - Endpoint `GET /reports/summary`: Hỗ trợ đầy đủ **5 bộ lọc đa chiều** (thời gian, bộ phận, người dùng, trạng thái, loại hồ sơ) tổng hợp số lượng, tỷ lệ duyệt, thời gian duyệt TB, tiến độ công việc, giá trị hợp đồng.
     - Endpoint `GET /reports/audit-logs`: **Phân quyền nghiêm ngặt**: Chỉ CEO và Quản trị IT mới có quyền xem và truy xuất. Nhân viên thường gọi bị chặn `403 Forbidden`.
     - Endpoint `GET /reports/export`: Xuất file CSV có **UTF-8 BOM (`\uFEFF`)** ở đầu tệp, đảm bảo hiển thị đúng 100% tiếng Việt có dấu trong Microsoft Excel trên Windows.
  6. **Frontend Phase 4**:
     - `NotificationBell.tsx`: Chuông thông báo góc header, badge unread đếm số tin mới, popover danh sách, nút đọc tất cả, click thông báo tự động chuyển hướng đến chi tiết hồ sơ hoặc công việc.
     - `OverviewDashboard.tsx`: Nâng cấp giao diện hiện đại, khối "CẦN HÀNH ĐỘNG NGAY" đặt trên cùng kèm hiệu ứng cảnh báo, các card chỉ số thời gian thực, bảng tiến độ phòng ban, nút làm mới dữ liệu gọi clear-cache.
     - `ReportsView.tsx`: 4 tab báo cáo (Hồ sơ, Công việc, Tài chính & Hợp đồng, Nhật ký hệ thống), 5 bộ lọc linh hoạt, nút xuất Excel UTF-8 BOM, nút In / Xuất PDF, drill-down click xem chi tiết, ẩn tab Nhật ký hệ thống với người không có quyền CEO/Admin.
     - `Sidebar.tsx` & `App.tsx`: Tích hợp tab `reports`, gắn NotificationBell vào Header, liên kết điều hướng thông báo.
  7. **Kiểm thử & Chất lượng**:
     - Backend unit tests: **105/105 tests pass 100%** (bao phủ 11 test suites).
     - Backend lint: **0 warnings, 0 errors** (oxlint sạch 100%).
     - Frontend build: **Pass sạch sẽ trong 241ms** (`tsc -b && vite build` 0 lỗi).

---

## 🎯 4. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT STEPS)

Khi bắt đầu phiên làm việc tiếp theo, chuyển sang triển khai **Phase 5 — PWA, Bảo mật (Hardening), UAT & Bàn giao ([03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 5)**:

1. **PWA (Progressive Web App)**:
   - Cấu hình Web App Manifest, Service Worker, cache offline assets, icon cho di động.
   - Thêm nút "Cài đặt ứng dụng" trên mobile browser.
2. **Bảo mật & Tối ưu hóa (Hardening)**:
   - Rà soát CORS, Helmet headers, Rate Limiting (chống brute force).
   - Kiểm tra SQL injection, XSS, CSRF.
3. **UAT & Kiểm thử kịch bản trọn vẹn**:
   - Chạy kịch bản người dùng liên hoàn từ Phase 0 tới Phase 4.
   - Chuẩn bị tài liệu bàn giao dự án cho anh Định và anh Minh.

