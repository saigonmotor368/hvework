# NHẬT KÝ CÔNG VIỆC & THEO DÕI TIẾN ĐỘ DỰ ÁN HVE APP

> **Tài liệu này được duy trì liên tục sau mỗi phiên làm việc.**
> Mục tiêu: Đảm bảo không bao giờ bị mất ngữ cảnh (context), dù có đổi máy, ngắt kết nối hay bắt đầu phiên chat mới thì người dùng và AI đều có thể tiếp tục công việc ngay lập tức.

---

## 📌 1. TỔNG QUAN DỰ ÁN & TIẾN ĐỘ CÁC PHASE

| Phase | Tên giai đoạn | Trạng thái | Đánh giá |
|---|---|---|---|
| **Phase 0** | Nền tảng & Hạ tầng (Auth, RBAC, DB Schema, CI) | **ĐÃ HOÀN THÀNH** | ✅ Đạt nghiệm thu ([04_REVIEW_PHASE0.md](04_REVIEW_PHASE0.md)) |
| **Phase 1** | Lõi phê duyệt: Đề nghị thanh toán (Backend + Frontend) | **ĐÃ HOÀN THÀNH** | ✅ Đã bổ sung đủ Frontend, Pre-signed URL, Versioning, Validate chứng từ. 40/40 Unit tests pass, Frontend build pass. |
| **Phase 2** | Mở rộng phê duyệt: Đề xuất, Hợp đồng, IT Admin Workflow | ⏳ **CHỜ BẮT ĐẦU** | Sẵn sàng triển khai tiếp theo |
| **Phase 3** | Quản lý công việc (Task Management, Recurring Tasks) | ⏳ Chưa bắt đầu | Kế hoạch sau Phase 2 |
| **Phase 4** | Thông báo, Báo cáo, Dashboard nâng cao | ⏳ Chưa bắt đầu | Kế hoạch sau Phase 3 |
| **Phase 5** | PWA, Bảo mật (Hardening), UAT & Bàn giao | ⏳ Chưa bắt đầu | Giai đoạn cuối |

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

---

## 🎯 4. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT STEPS)

Khi bắt đầu phiên làm việc tiếp theo, chuyển sang triển khai **Phase 3 — Quản lý công việc ([03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 3)**:

1. **Backend**:
   - API tạo/giao việc: tiêu đề, mô tả, người thực hiện, người phối hợp, hạn hoàn thành, ưu tiên, thẻ phân loại.
   - API việc con (`parentTaskId`), tính progress cha theo việc con.
   - API việc lặp lại: cấu hình chu kỳ (ngày/tuần/tháng), job tự sinh kỳ mới.
   - API cập nhật tiến độ (%), đổi trạng thái Chưa làm → Đang làm → Chờ duyệt.
   - API xác nhận hoàn thành (chỉ người giao việc được xác nhận).
   - Runtime flag `is_overdue`.
   - API bình luận + mention người dùng trên task.
2. **Frontend**:
   - Form tạo & giao việc (desktop + mobile).
   - Danh sách việc: của tôi / tôi giao / theo bộ phận, filter theo trạng thái/ưu tiên/hạn.
   - Màn hình chi tiết việc: tiến độ, việc con, bình luận, nút xác nhận hoàn thành cho người giao việc.

