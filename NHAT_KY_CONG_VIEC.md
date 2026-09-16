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
  2. **Khắc phục lỗi 404 xem chứng từ**:
     - Cấu hình serve static `app.useStaticAssets(uploadDir, { prefix: '/uploads/' })` trong `main.ts`.
     - Thêm endpoint `GET /attachments/file/:fileKey` có guard bảo mật.
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
     - Unit tests backend: **47/47 tests pass** (tăng thêm 7 tests mới kiểm tra bảo mật upload, HMAC signature, size limit, path traversal, revision numbering).
     - Lint backend: **0 warnings, 0 errors**.
     - Frontend build: **Pass sạch sẽ trong 170ms**.
     - Nghiệm thu Phase 1: **ĐẠT TOÀN DIỆN** (Xem [05_REVIEW_PHASE1.md](05_REVIEW_PHASE1.md)).


---

## 🎯 4. KẾ HOẠCH BƯỚC TIẾP THEO (NEXT STEPS)

Khi bắt đầu phiên làm việc tiếp theo, ưu tiên thực hiện các nội dung sau:

1. **Khởi động Phase 2 — Mở rộng phê duyệt ([03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 2)**:
   - **Backend**:
     - Thêm hỗ trợ loại hồ sơ **Đề xuất** (form tinh gọn: mã, tiêu đề, người tạo, nội dung đề xuất).
     - Thêm hỗ trợ loại hồ sơ **Hợp đồng** (5 cấp duyệt: Người tạo → Trưởng BP → Pháp chế → Kế toán → CEO; ngày hiệu lực/hết hạn, đối tác, giá trị hợp đồng).
     - Xây dựng API cho IT Admin quản lý quy trình phê duyệt (`WorkflowTemplate` & `WorkflowStepTemplate`).
   - **Frontend**:
     - Màn hình/Form tạo hồ sơ Đề xuất & Hợp đồng.
     - Màn hình cấu hình Workflow cho IT Admin (chọn số cấp, sắp xếp thứ tự vai trò duyệt).
2. **Kiểm thử tích hợp & chạy thử với Docker local**:
   - Khởi chạy Docker Compose (Postgres + Redis) và chạy `prisma migrate` + `prisma db seed` để tạo dữ liệu mẫu thực tế.
