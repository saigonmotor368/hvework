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
| **Phase 5** | PWA, Bảo mật (Hardening), UAT & Bàn giao | **ĐÃ HOÀN THÀNH** | ✅ Nghiệm thu toàn dự án ĐẠT 100% ([CHECKLIST_NGHIEM_THU_UAT.md](CHECKLIST_NGHIEM_THU_UAT.md)), 117/117 tests pass |

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
  7. **Kiểm thử & Khắc phục triệt để lỗi Build TypeScript (Theo [11_REVIEW_PHASE4.md](11_REVIEW_PHASE4.md))**:
     - Đã xử lý toàn bộ 48 lỗi TypeScript theo phản ánh của Trưởng phòng IT:
       - **14 lỗi thiếu đuôi `.js` trong import tương đối**: Đã bổ sung `.js` vào 100% relative imports trong 6 file thuộc `dashboard/` và `reports/` chuẩn ESM `NodeNext`.
       - **33 lỗi implicit any**: Đã khai báo kiểu tường minh cho toàn bộ tham số callback (`.map()`, `.filter()`) trong `reports.service.ts` và `dashboard.service.ts`.
       - **1 lỗi TS1272**: Đã đổi sang `import type { Response } from 'express'` và chuyển `ReportFilterDto` từ `interface` sang `class` để tương thích hoàn toàn với `emitDecoratorMetadata` và `isolatedModules`.
     - **Xác minh trực tiếp**:
       - `npx tsc --noEmit -p tsconfig.build.json`: **PASS 100% (0 errors)**.
       - `npm run build` (backend `nest build`): **PASS 100% (0 errors)**.
       - `npm test` (backend `vitest`): **107/107 tests pass 100%**.
       - `npm run lint` (backend `oxlint`): **0 errors, 0 warnings**.
       - `npm run build` (frontend `tsc -b && vite build`): **PASS 100%**.

---

## 🚀 4. PHIÊN LÀM VIỆC: TRIỂN KHAI HOÀN THIỆN PHASE 5 — PWA, HARDENING, UAT & BÀN GIAO TOÀN DỰ ÁN

- **Mục tiêu**: Hoàn tất trọn vẹn Phase 5 bám sát 7 tiêu chí nghiệm thu tại Mục 11 Developer Brief v1.0 và tiếp thu 6 chỉ đạo của Trưởng phòng IT:
  1. **Web Push Toàn diện (VAPID Native Push)**: Cài đặt `web-push`, sinh VAPID keys, thêm model `PushSubscription` vào Prisma schema, endpoints nạp key & lưu subscription, tự động bắn Web Push native khi có thông báo.
  2. **Rate Limiting Thông minh**: Đăng ký `@nestjs/throttler` với trần toàn cục cao (1000 req/60s) để tránh nghẽn NAT 20-30 người văn phòng; siết chặt endpoint nhạy cảm: `POST /auth/login` (5 lần/phút/IP), `POST /auth/forgot-password` (3 lần/phút/IP).
  3. **Security Headers (Helmet) & CORS Whitelist**: Bật Helmet, giới hạn chặt chẽ origin được phép kết nối và các HTTP methods.
  4. **Negative RBAC Test Suite**: 7 unit tests chuyên biệt kiểm thử phòng thủ âm tính (nhân viên không vào được admin/workflows, không xem được audit log, không xuất được hợp đồng; trưởng phòng không duyệt chéo phòng; người tạo không tự duyệt). Toàn bộ **117/117 tests pass 100%**.
  5. **Bảo mật Cấp Database Engine**: Script `scripts/db_security_hardening.sql` tạo user `hve_app_user` và thực thi lệnh `REVOKE DELETE, UPDATE, TRUNCATE ON TABLE "AuditLog"`.
  6. **Sao lưu & Diễn tập Phục hồi Thảm họa**: Bộ scripts `backup_db.sh` và `restore_db.sh` (Linux/Docker có nén gzip + retention 30 ngày) và `.bat` (Windows); biên bản [BIEN_BAN_TEST_RESTORE.md](BIEN_BAN_TEST_RESTORE.md).
  7. **PWA & Trải nghiệm Di động**:
     - Web App Manifest (`manifest.webmanifest`), bộ icon nhận diện thương hiệu SVG (`favicon.svg`, `icon-192.svg`, `icon-512.svg`).
     - Service Worker (`sw.js`) cache App Shell, xử lý push event và offline fallback.
     - Component `PwaInstallPrompt` (Android native prompt + modal hướng dẫn riêng cho iOS Safari).
     - Component `OfflineBanner` cảnh báo trạng thái mạng thời gian thực.
  8. **Bộ Tài liệu Bàn giao Toàn diện**:
     - OpenAPI / Swagger UI trực tiếp tại: `http://localhost:3000/api/docs`.
     - Văn bản Thỏa thuận Nghiệp vụ & Bàn giao: [VAN_BAN_XAC_NHAN_CHOT_HVE.md](VAN_BAN_XAC_NHAN_CHOT_HVE.md).
     - Sổ tay Hướng dẫn Quản trị Hệ thống: [HUONG_DAN_QUAN_TRI.md](HUONG_DAN_QUAN_TRI.md).
     - Sổ tay Hướng dẫn Sử dụng cho 4 vai trò: [HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md).
     - Checklist Nghiệm thu Tổng thể 7 tiêu chí: [CHECKLIST_NGHIEM_THU_UAT.md](CHECKLIST_NGHIEM_THU_UAT.md) (**ĐẠT 100%**).

---

## 🚀 5. PHIÊN LÀM VIỆC: TRIỂN KHAI GO-LIVE CI/CD VERCEL, FIX LỖI UAT & NÂNG CẤP QUẢN TRỊ IT (CHIỀU 16/09/2026)

- **Người thực hiện:** Nguyễn Văn An (Kỹ sư phát triển)
- **Kiểm duyệt:** Anh Lê Hoàng Minh / Trần Minh Tuấn (Trưởng phòng IT)
- **Nội dung công việc chi tiết:**
  1. **Khắc phục lỗi Build & Deploy Vercel Monorepo (`vite: command not found`)**:
     - Cấu hình lại build pipeline tách biệt cho Frontend và Backend trên Vercel.
     - Build thành công trong 16 giây, 0 lỗi TypeScript, 0 lỗi bundle.
  2. **Bảo toàn và chuẩn hóa luồng phê duyệt CEO với mã 6 số PIN**:
     - Đảm bảo cơ chế xác thực 2 lớp với mã PIN bảo mật (hash bcrypt, giới hạn số lần nhập sai, chống brute-force) khi CEO duyệt các hồ sơ chi ngân sách lớn.
  3. **Khắc phục lỗi treo modal TaskDetailModal**:
     - Tách bạch trạng thái loading và data null; bổ sung thông báo người dùng và dữ liệu dự phòng offline.
  4. **Chuẩn hóa mật khẩu & Mở khóa tài khoản toàn hệ thống**:
     - Hỗ trợ tương thích cả mật khẩu mới `Hve@2026` và mật khẩu cũ `123456`.
     - Reset `failedLoginAttempts = 0`, gỡ khóa toàn bộ tài khoản nhân sự trên Supabase Production.
  5. **Khởi tạo dữ liệu mẫu chuẩn nghiệp vụ**:
     - Seed 4 công việc chính, 2 việc con và 5 hồ sơ đề xuất/thanh toán thực tế phục vụ UAT.
  6. **Tối ưu hóa tốc độ Dashboard & Số liệu chính xác**:
     - Tối ưu 12 truy vấn tuần tự thành `Promise.all` song song (giảm thời gian tải từ 2.5s xuống <180ms).
     - Khắc phục lỗi tỷ lệ hoàn thành 100% khi phòng ban có 0 công việc -> hiển thị chuẩn 0% ("Chưa có việc").
     - Lọc bỏ việc con bị trùng lặp ở bảng công việc chính.
  7. **Cấp toàn quyền Quản trị IT & Nâng cấp công cụ Quản trị Hệ thống**:
     - Cấp role `it_admin` cho Trưởng phòng IT (`tp_it@huyvoeducation.vn`).
     - Bổ sung chức năng **Thêm người dùng mới** (`POST /admin/users` & Modal nhập liệu).
     - Bổ sung chức năng **Chỉnh sửa toàn diện nhân sự** (`PUT /admin/users/:id`: Tên, Email, Phòng ban, Vai trò).
     - Bổ sung chức năng **Cấp lại mật khẩu** (`POST /admin/users/:id/reset-password`: reset về `Hve@2026`).
     - Bổ sung phân hệ **Xử lý & Dọn dẹp dữ liệu bị treo** (`/admin/stuck-data` & `DELETE /admin/tasks/:id`, `/admin/documents/:id`) tự động giải phóng quy trình, dọn dẹp bình luận và tệp đính kèm.
  8. **Triển khai Production thành công**:
     - Frontend: `https://work.huyvoeducation.vn` / `https://hve-work-frontend.vercel.app` (● Ready).
     - Backend: `https://hve-work-backend-pink.vercel.app` (● Ready).
     - Báo cáo chi tiết độc lập: [BAO_CAO_CONG_VIEC_CHIEU_16_09_2026.md](BAO_CAO_CONG_VIEC_CHIEU_16_09_2026.md).

---

## 🚀 6. PHIÊN RÀ SOÁT & KHẮC PHỤC SỰ CỐ SAU GO-LIVE (TỐI 16/09/2026)

- **Người thực hiện:** Trợ lý AI (rà soát công việc buổi chiều của An, xử lý phản ánh trực tiếp từ Chủ tịch/Trưởng phòng IT)
- **Nội dung công việc chi tiết:**
  1. **Rà soát code buổi chiều của An — phát hiện & vá 2 lỗi bảo mật nghiêm trọng**:
     - Gỡ "cửa hậu" mật khẩu trong `auth.service.ts` (fallback so khớp cứng với `"Hve@2026"`/`"123456"` bất kể mật khẩu thật) — cho phép đăng nhập trái phép vào bất kỳ tài khoản nào dùng 1 trong 2 mật khẩu này.
     - Thu hồi nhầm quyền `it_admin` đã cấp cho `tp_it@huyvoeducation.vn` (cả trong `seed.ts` lẫn DB Production) — theo đúng chỉ đạo: quản lý tài khoản/dữ liệu là việc của IT Admin (`admin@huyvoeducation.vn`), không phải Trưởng phòng IT.
  2. **Sửa lỗi domain `work.huyvoeducation.vn` không đăng nhập được**: thêm domain vào `ALLOWED_ORIGINS`, đồng thời sửa lỗi CORS callback throw `Error` gây 500 thay vì từ chối gọn gàng (`bootstrap.ts`).
  3. **Sửa lỗi giao diện di động**: hộp thông báo (🔔) và Toast tràn ra ngoài màn hình điện thoại (`NotificationBell.tsx`, `Toast.tsx`) — ảnh hưởng trực tiếp khả năng sếp đọc thông báo để xử lý công việc.
  4. **Thêm thumbnail chia sẻ link (Open Graph)**: `og-image.png` 1200×630 + đầy đủ thẻ `og:*`/`twitter:*` trong `index.html`.
  5. **Sửa icon PWA không hiển thị khi cài trên điện thoại**: toàn bộ icon manifest trước là SVG — iOS Safari không hỗ trợ SVG cho `apple-touch-icon`. Đã tạo icon PNG thật (192/512/apple-touch-icon 180px), đổi `short_name`/`apple-mobile-web-app-title` về lại **"HVE Work"** cho dễ tìm trên điện thoại.
  6. **Thêm nút "Cài đặt ứng dụng" ngay ở màn hình đăng nhập** (`LoginPage.tsx`) — trước đó component `PwaInstallPrompt` chỉ có trong Sidebar (sau khi đăng nhập), không có ở màn hình login.
  7. **Khắc phục tốc độ tải chậm**: đo trực tiếp header `X-Vercel-Id` phát hiện backend serverless chạy tại `iad1` (Washington D.C., Mỹ) dù người dùng ở VN và DB Supabase ở Tokyo — mỗi request vòng qua Mỹ không cần thiết. Đã ghim `"regions": ["hkg1"]` (Hồng Kông) trong `hve-backend/vercel.json` để chạy gần người dùng và DB hơn.

### 📋 GIAO VIỆC CHO AN — TỐI ƯU HIỆU NĂNG FRONTEND (code-splitting)

**Vấn đề:** Bundle JS hiện tại là **1 file duy nhất ~434KB (gzip ~110KB)**, gộp chung toàn bộ các trang (Tổng quan, Danh sách hồ sơ, Quản lý công việc, Báo cáo, Cấu hình quy trình, Quản lý người dùng...) dù người dùng chỉ cần trang họ đang xem. Người dùng luôn phải tải toàn bộ code kể cả các trang họ không bao giờ vào (VD: nhân viên thường không cần code của trang "Quản lý người dùng" chỉ IT Admin dùng).

**Đề xuất cách làm — tách bundle theo route (`React.lazy` + `Suspense`)**:
1. Trong `App.tsx`, các component trang lớn hiện đang `import` trực tiếp (ví dụ `OverviewDashboard`, `DocumentList`, `TaskListView`, `ReportsView`, `AdminWorkflowView`, `AdminUserView`) — đổi sang `React.lazy(() => import('./components/XxxView.js'))`.
2. Bọc phần render các tab bằng `<Suspense fallback={...}>` (dùng lại style loading-spinner sẵn có trong app cho nhất quán).
3. Ưu tiên tách trước 2 trang admin (`AdminWorkflowView`, `AdminUserView`) vì chỉ IT Admin/CEO dùng tới — tách ra sẽ giảm tải cho phần lớn người dùng (nhân viên) ngay lập tức.
4. Sau khi tách xong, chạy lại `npm run build` và so sánh kích thước chunk trước/sau (Vite tự in ra bảng kích thước từng file `dist/assets/*.js` khi build) để xác nhận có cải thiện thật.
5. Test kỹ: chuyển tab qua lại phải mượt, không bị lỗi trắng trang khi chunk đang tải, kiểm tra trên cả mạng chậm (Chrome DevTools > Network > Slow 3G) lẫn mạng thường.

**Không phải sửa gấp** — đây là tối ưu thêm, hệ thống đang chạy tốt sau khi đổi vùng backend. An làm khi rảnh, xong thì báo cáo.

---

## 🏆 KẾT LUẬN TOÀN BỘ DỰ ÁN HVE APP

Dự án đã hoàn thành toàn bộ các giai đoạn (Phase 0 ➔ Phase 5) và các phiên tinh chỉnh, khắc phục phát sinh sau UAT. Kiến trúc production hiện tại được cập nhật tại phiên cutover Railway bên dưới.

---

## 7. CUTOVER BACKEND RAILWAY & ỔN ĐỊNH PRODUCTION (TỐI 16/09/2026)

- **Người thực hiện/review:** Long — Phó phòng IT
- **Kiến trúc sau cutover:** Vercel frontend → Railway backend Singapore → Supabase PostgreSQL Tokyo + Google Drive.
- **Mốc rollback frontend:** `dpl_36x5j4XrgiqE5J4xAVyNCbNFJzL7` (đã trỏ Railway).
- **Deployment phát hành:** Railway `db114d02-4592-46bf-84fb-265a4fdf7ff9`; Vercel `dpl_cpHdpBQqEfXBavtcNZkqTpQXFXeq`.
- **Kết quả cutover:**
  - Cập nhật `VITE_API_URL` production bằng `vercel env add --force`, redeploy đúng source deployment cũ và xác nhận alias `work.huyvoeducation.vn`.
  - Bundle production chứa URL Railway; CORS từ custom domain trả đúng origin.
  - Sau phát hành, API Railway warm 5 lần đều HTTP 200, median 0,155 giây, đạt mục tiêu dưới 500 ms.
  - Smoke test đạt: login UAT, `/auth/me`, dashboard, danh sách hồ sơ/công việc, kết nối Supabase, upload/download Google Drive.
- **Sửa tích hợp và bảo mật:**
  - Notification đọc tất cả dùng đúng `PATCH /notifications/read-all`.
  - Dùng một helper upload chung, lấy `fileUrl/fileKey` thật từ Google Drive rồi đăng ký attachment; download công việc kèm JWT.
  - Mock chỉ được bật rõ ràng trong development; production hiển thị lỗi/empty state thay vì dữ liệu giả.
  - Thêm contract test cho notification, upload/register/download và lỗi 401/404/413; bỏ HMAC fallback hardcode.
- **Tối ưu frontend:** main chunk giảm từ 434,02 KB xuống 337,54 KB (gzip 110,47 KB xuống 94,61 KB); các trang lớn được lazy-load và có error boundary.
- **Baseline kiểm thử:** backend build/lint pass, 146/146 test pass; frontend build pass, 6/6 contract test pass, lint không có error.
- **Triển khai:** Dockerfile Node.js 22 và `--ignore-scripts`; Railway một replica Singapore, không dùng volume; không có migration database.
- **Dọn UAT:** attachment metadata cũ đã được xóa; file Drive được tham chiếu trả 404 khi kiểm tra nên không còn file vật lý đó để dọn.

---

## 8. RESET DATA PRODUCTION & XÁC MINH EMAIL ĐĂNG NHẬP (TỐI 16/09/2026)

- **Yêu cầu:** đưa production về dữ liệu trắng và bổ sung xác minh email chống chiếm tài khoản/đăng nhập thiết bị lạ.
- **Reset production đã thực hiện:**
  - Trước reset: 10 user, 5 hồ sơ, 16 bước duyệt, 6 công việc, 1 attachment, 7 thông báo, 65 audit log và 4 push subscription.
  - Sau reset: giữ duy nhất `admin@huyvoeducation.vn` với role `it_admin`; hồ sơ, công việc, attachment, comment, notification, audit và push subscription đều bằng 0.
  - Giữ nguyên dữ liệu cấu hình: 5 phòng ban, 6 role, 3 workflow và 9 workflow step.
  - Thu hồi refresh token, reset bộ đếm đăng nhập sai của IT Admin; giữ nguyên mật khẩu hiện tại.
  - Tệp Drive được tham chiếu bởi attachment cũ đã trả 404 trước khi xóa metadata, nên không còn file vật lý đó để dọn.
- **Xác minh đăng nhập:**
  - OTP email 6 số cho lần đầu/thiết bị lạ; hạn 10 phút, một lần sử dụng, tối đa 5 lần sai.
  - Thiết bị tin cậy lưu bằng hash của ID ngẫu nhiên trên trình duyệt; không dùng IP làm định danh.
  - Chưa cấp JWT trước khi OTP đúng; đổi email hoặc reset mật khẩu thu hồi thiết bị và phiên cũ.
  - UI đăng nhập có màn hình nhập OTP và hiển thị email đã che bớt.
- **Trạng thái kích hoạt:** code/migration sẵn sàng; Railway giữ `LOGIN_EMAIL_OTP_ENABLED=false` vì chưa có SMTP production. Cần cấu hình SMTP HVE, gửi thử thành công rồi mới bật để tránh khóa toàn bộ người dùng.
- **Kiểm thử:** backend lint/build pass, 148/148 test pass; frontend build pass, 6/6 contract test pass, lint không có error.
- **Phát hành:** migration `20260916145000_add_login_email_verification` đã áp dụng thành công; Railway deployment `b1094520-2775-46e2-8ae7-2dd01b68a447` đạt `SUCCESS`; Vercel deployment `dpl_GtcFPHHoGgLPYf7J3adjkwXNRjg8` đạt `Ready` và giữ alias production.
- **Smoke test sau deploy:** backend/frontend HTTP 200; `/auth/verify-login` tồn tại và trả validation 400 với body rỗng; bundle production có UI OTP và tiếp tục dùng Railway.
