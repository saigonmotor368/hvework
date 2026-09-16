# HVE App — Task List cho Developer

Phiên bản 1.0 | 15/09/2026
Bám theo [02_KE_HOACH_TRIEN_KHAI.md](02_KE_HOACH_TRIEN_KHAI.md) và [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md). Checkbox để dev tick khi làm. Mỗi task nên là 1 PR nhỏ, review được.

---

## Phase 0 — Nền tảng & hạ tầng

### Hạ tầng & DevOps
- [x] Khởi tạo repo (frontend + backend monorepo)
- [x] Thiết lập Docker Compose cho dev local (app + Postgres + Redis)
- [x] Thiết lập CI (lint, typecheck, unit test, build) trên mỗi PR
- [ ] Thiết lập CD deploy tự động lên staging khi merge `main` (bổ sung trước UAT Phase 5)
- [ ] Tạo môi trường production (chưa cần trỏ domain thật)
- [ ] Cấu hình HTTPS/TLS cho staging và production
- [x] Thiết lập storage upload chứng từ (pre-signed URL)
- [x] Thiết lập biến môi trường/secrets management (không commit secret vào repo)

### Database & Auth
- [x] Thiết kế & migrate schema: `users, roles, permissions, departments`
- [x] Thiết kế & migrate schema: `documents, document_approval_steps, workflow_templates, workflow_step_templates`
- [x] Thiết kế & migrate schema: `tasks, attachments, comments`
- [x] Thiết kế & migrate schema: `notifications, reminder_rules, audit_logs`
- [x] API đăng ký/khởi tạo tài khoản (IT admin tạo user, không tự đăng ký public)
- [x] API đăng nhập email/mật khẩu + JWT access/refresh
- [x] API quên mật khẩu / đặt lại mật khẩu qua email token / OTP
- [x] Khoá tài khoản sau N lần đăng nhập sai (rate-limit + lockout 15 phút sau 5 lần)
- [x] Middleware / Guard `checkPermission(user, resource, action)` và `RolesGuard` dùng chung toàn hệ thống
- [x] Seed dữ liệu mẫu: 6 vai trò, vài user mẫu mỗi bộ phận, 1 CEO, 1 IT admin
- [x] Ghi audit log cho sự kiện login/logout (chứng minh cơ chế hoạt động)
- [x] Unit test cho auth & middleware phân quyền (21/21 tests pass)

### Frontend khung
- [x] Khởi tạo React + TS + Vite + Tailwind, cấu hình theme màu HVE (`#0A66C2 #20B84D #FFC631 #1D1D1F`)
- [x] Layout khung: sidebar điều hướng (desktop) + bottom nav hoặc drawer (mobile)
- [x] Màn hình đăng nhập/quên mật khẩu
- [x] Cơ chế lưu/refresh token phía client, tự logout khi token hết hạn
- [x] Route guard theo vai trò (ẩn/hiện menu) — **nhắc lại: đây chỉ là UX, không thay cho kiểm tra server**

**Nghiệm thu Phase 0:** ✅ **ĐÃ ĐẠT** (Xem [04_REVIEW_PHASE0.md](04_REVIEW_PHASE0.md)).

---

## Phase 1 — Lõi phê duyệt: Đề nghị thanh toán

### Backend
- [x] API tạo hồ sơ đề nghị thanh toán (nháp) với đủ field mục 5 brief (mã tự động `DNTT-YYYY-NNN`, tiêu đề, người đề nghị, bộ phận, số tiền, người nhận, nội dung, hạn thanh toán, ngân hàng, số tài khoản, chứng từ)
- [x] Validate field nghiệp vụ + chứng từ bắt buộc trước khi cho gửi duyệt (bắt buộc có ít nhất 1 attachment)
- [x] API sửa/xoá bản nháp (chỉ người tạo, chỉ khi ở trạng thái Nháp)
- [x] API gửi duyệt: snapshot step list từ `WorkflowTemplate` vào hồ sơ, chuyển trạng thái Chờ duyệt, tạo step đầu tiên
- [x] API duyệt/trả lại/từ chối tại từng step: kiểm tra đúng người/vai trò đang giữ step, chặn tự duyệt hồ sơ mình tạo
- [x] Bắt buộc nhập lý do khi trả lại hoặc từ chối (validate server-side)
- [x] Khi trả lại: hồ sơ quay về Nháp, người tạo sửa và gửi lại chạy lại từ đầu luồng (theo quyết định ở tài liệu kiến trúc mục 2.3)
- [x] Khi đủ tất cả step duyệt: chuyển Đã duyệt, khoá field (immutable)
- [x] API tạo version mới cho hồ sơ đã duyệt cần sửa (`createNewVersion`: mã `-v2`, `-v3`, giữ bản cũ)
- [x] Optimistic locking (`version` column) chống duyệt trùng khi bấm 2 lần
- [x] Ghi audit log cho mọi transition (tạo, sửa, gửi duyệt, duyệt, trả lại, từ chối, versioning) trong cùng transaction
- [x] API upload/tải chứng từ qua pre-signed URL, validate MIME + extension whitelist (PDF/DOCX/XLSX/JPG/PNG)
- [ ] Quét mã độc file upload trước khi cho phép tải xuống (ClamAV - dời sang hardening Phase 5)
- [x] Versioning file đính kèm (không ghi đè)

### Frontend
- [x] Form tạo/sửa đề nghị thanh toán (desktop + mobile) với validate client-side khớp server
- [x] Danh sách hồ sơ của tôi + bộ lọc trạng thái và tab
- [x] Màn hình chi tiết hồ sơ: thông tin, trạng thái hiện tại, người đang xử lý, lịch sử timeline, nút Duyệt/Trả lại/Từ chối theo quyền
- [x] Modal nhập lý do khi Trả lại/Từ chối (bắt buộc)
- [x] Upload file đính kèm (chọn file trực tiếp, kiểm tra định dạng)
- [x] Xử lý double-submit (disable nút sau khi bấm, hiển thị trạng thái đang xử lý) khớp yêu cầu "không ghi nhận phê duyệt hai lần"
- [x] Thông báo lỗi rõ ràng khi thao tác hoặc submit

**Nghiệm thu Phase 1:** ✅ **ĐÃ ĐẠT** (Backend 40/40 tests pass, Frontend builds pass, State machine & UI hoàn thiện).

---

## Phase 2 — Mở rộng phê duyệt

### Backend
- [x] Màn hình/API IT admin: CRUD `WorkflowTemplate` + `WorkflowStepTemplate` (chọn vai trò từng cấp, thứ tự cấp)
- [x] API tạo/sửa/gửi duyệt Đề xuất (form theo mục 5 brief — chỉ mã, tiêu đề, người tạo là bắt buộc)
- [x] API tạo/sửa/gửi duyệt Hợp đồng (5 cấp: Người tạo → Trưởng BP → Pháp chế → Kế toán → CEO)
- [x] Hợp đồng: lưu ngày hiệu lực/ngày hết hạn, job/helper tính trạng thái cảnh báo sắp hết hạn
- [x] Đảm bảo engine duyệt dùng chung code với Phase 1 (không copy-paste logic 3 lần)
- [x] Phân quyền duyệt theo bộ phận: Trưởng bộ phận (`department_head`) chỉ duyệt hồ sơ của nhân sự thuộc bộ phận mình phụ trách

### Frontend
- [x] Form Đề xuất (tiêu đề, nội dung đề xuất, tệp đính kèm tùy chọn)
- [x] Form Hợp đồng (đối tác, giá trị, ngày hiệu lực/hết hạn, người phụ trách, file hợp đồng bắt buộc)
- [x] Màn hình IT admin cấu hình workflow (thêm/xóa/đổi thứ tự cấp + chọn vai trò)
- [x] Màn hình quản lý user/vai trò/bộ phận cho IT admin (khóa/mở tài khoản, phân quyền vai trò)

**Nghiệm thu Phase 2:** ✅ **ĐÃ ĐẠT** (Backend 71/71 tests pass, lint sạch 0 warning, Frontend build pass, cả 3 loại hồ sơ chạy đúng luồng riêng bằng chung 1 engine, phân quyền bộ phận chặt chẽ, IT admin cấu hình quy trình và quản lý nhân sự hoàn chỉnh).

---

## Phase 3 — Quản lý công việc

### Backend
- [x] API tạo/giao việc: tiêu đề, mô tả, người thực hiện, người phối hợp, hạn hoàn thành, ưu tiên, thẻ phân loại (`CV-YYYY-NNN`)
- [x] API việc con (parent_task_id), tính progress cha tự động từ việc con (khóa nhập tay tiến độ cha khi có việc con, giới hạn tối đa 2 cấp)
- [x] API việc lặp lại: cấu hình chu kỳ (daily/weekly/monthly), tự tạo kỳ mới khi xác nhận hoàn thành (hỗ trợ round-forward tới mốc tương lai và helper safe-month chống tràn ngày cuối tháng)
- [x] API cập nhật tiến độ (%), tự động đổi trạng thái Chưa làm (0%) → Đang làm (1-99%) → Chờ duyệt (100%)
- [x] API xác nhận hoàn thành — chỉ người giao việc hoặc CEO được gọi, chặn double-submit (`status !== 'Chờ duyệt'`)
- [x] Cờ `is_overdue` tính runtime (`now > dueDate && status !== 'Hoàn thành'`), không lưu cứng trong DB
- [x] API bình luận + gắn tên người dùng (mention) trên task, sinh in-app notification với `dedupeKey` duy nhất
- [x] Audit log cho mọi thay đổi người phụ trách (`assigneeId`) hoặc hạn hoàn thành (`dueDate`), chỉ người giao, Trưởng BP cùng phòng hoặc CEO mới có quyền sửa

### Frontend
- [x] Form tạo/giao việc (desktop + mobile) với chọn người thực hiện, người phối hợp, ưu tiên, tag, chu kỳ lặp và đính kèm file
- [x] Danh sách việc: 4 tab (Tất cả / Việc tôi làm / Việc tôi giao / Việc bộ phận — lọc đúng theo bộ phận của user), filter trạng thái/ưu tiên/quá hạn/tìm kiếm
- [x] Màn hình chi tiết việc: tiến độ slider, khóa tiến độ cha nếu có việc con, việc con dạng danh sách, bình luận + mention, file đính kèm, nút xác nhận hoàn thành (chỉ hiện cho người giao khi Chờ duyệt)
- [x] Badge "Quá hạn" tự động trên danh sách và chi tiết
- [x] UI cấu hình việc lặp lại (chọn chu kỳ daily/weekly/monthly, chỉ áp dụng cho việc độc lập)

**Nghiệm thu Phase 3:** ✅ **ĐÃ ĐẠT** (Backend 92/92 tests pass, Frontend build pass sạch sẽ, bao phủ đầy đủ state machine, chống double submit, round-forward kỳ lặp, lọc việc bộ phận chính xác và phân quyền chặt chẽ).

---

## Phase 4 — Thông báo, báo cáo, dashboard

### Backend
- [x] Bảng `reminder_rules` + API cấu hình mốc nhắc theo loại đối tượng
- [x] Bổ sung thông báo tức thời ngay khi duyệt/trả lại/từ chối/gửi duyệt hồ sơ trong `documents.service.ts`
- [x] Job scheduler quét mốc nhắc (hồ sơ cần duyệt, hồ sơ duyệt/trả/từ chối, việc sắp/quá hạn, hợp đồng sắp hết hạn)
- [x] Cơ chế dedupe thông báo (`dedupe_key`) chống gửi trùng theo ngày
- [x] Tích hợp gửi email (kênh Email logger theo format chuẩn HVE)
- [x] Quy tắc leo thang: việc quá hạn ≥1 ngày báo Trưởng BP, ≥3 ngày leo thang báo CEO
- [x] API đánh dấu đã đọc thông báo; thông báo quan trọng vẫn giữ trong lịch sử
- [x] Interface `NotificationChannel` mở sẵn chỗ cắm Zalo OA sau này (stub mở rộng)
- [x] API dashboard theo 4 vai trò (CEO / Trưởng BP / Nhân viên / Kế toán-Pháp chế) — aggregate query, cache 60s
- [x] API báo cáo: công việc theo nhân viên/bộ phận/trạng thái/thời gian; việc sắp/quá hạn; hồ sơ theo loại/trạng thái; hợp đồng; nhật ký thao tác audit log (chỉ CEO & IT Admin)
- [x] Filter báo cáo: 5 bộ lọc (khoảng thời gian, bộ phận, người dùng, trạng thái, loại hồ sơ)
- [x] Export Excel/CSV với UTF-8 BOM (`\uFEFF`) chống vỡ font tiếng Việt trong Excel Windows
- [x] Drill-down: từ chỉ số tổng hợp mở được danh sách chi tiết tương ứng

### Frontend
- [x] Trung tâm thông báo `NotificationBell` (chuông + badge số tin mới + popover + đánh dấu đã đọc tất cả + click chuyển hướng)
- [x] 4 dashboard theo vai trò, ưu tiên hiển thị khối "CẦN HÀNH ĐỘNG NGAY" trên cùng trước số liệu thuần
- [x] Màn hình báo cáo `ReportsView` với 4 tab, 5 bộ lọc + nút export CSV UTF-8 BOM + nút In PDF + click-to-drill-down
- [x] Bảo mật tab Nhật ký hệ thống: chỉ hiển thị cho CEO và IT Admin

**Nghiệm thu Phase 4:** ✅ **ĐÃ ĐẠT** (Backend 105/105 tests pass, 0 lint warnings, Frontend build sạch sẽ trong 241ms, xử lý trọn vẹn thông báo tức thời, quét mốc leo thang, 5 filter báo cáo, bảo mật audit log và CSV UTF-8 BOM).

---

## Phase 5 — PWA, hardening, UAT, bàn giao

### PWA
- [ ] Web App Manifest (icon, tên, theme color, display standalone)
- [ ] Service Worker: cache app shell, chạy offline cơ bản (không cần offline data đầy đủ)
- [ ] Test "Add to Home Screen" trên Android Chrome và iOS Safari
- [ ] Implement Web Push (VAPID) cho trình duyệt hỗ trợ, ghi rõ giới hạn iOS trong tài liệu bàn giao
- [ ] Test không cuộn ngang trên bảng dữ liệu ở màn hình phổ biến (360-430px width)
- [ ] Test thao tác một tay: duyệt/trả lại/bình luận/đính kèm ảnh trên mobile thật

### Bảo mật & dữ liệu
- [ ] Rà soát toàn bộ endpoint có guard phân quyền, viết test "âm tính" (role X bị từ chối resource Y)
- [ ] Rate-limit login + các endpoint nhạy cảm
- [ ] Kiểm tra CORS, security headers (helmet), HTTPS redirect
- [ ] Xác nhận DB user backend không có quyền DELETE/UPDATE trên bảng `audit_logs`
- [ ] Thiết lập backup tự động DB + storage, chạy thử khôi phục 1 lần, lập biên bản kết quả
- [ ] Rà lại tất cả field nhạy cảm có mã hoá đúng (mật khẩu, token)

### UAT & bàn giao
- [ ] Checklist nghiệm thu theo mục 11 brief — chạy thử với HVE trên staging
- [ ] Chuẩn bị tài liệu API (OpenAPI/Swagger)
- [ ] Chuẩn bị tài liệu quản trị hệ thống (cấu hình vai trò, workflow, reminder)
- [ ] Chuẩn bị hướng dẫn người dùng theo từng vai trò
- [ ] Tổ chức buổi đào tạo/demo bàn giao
- [ ] Lấy asset logo chính thức (SVG/AI theo PA2) từ HVE, thay placeholder, review lại toàn bộ UI theo đúng bộ nhận diện
- [ ] Xác nhận với HVE: giới hạn file, chính sách backup/retention, phạm vi OTP, thời gian bảo hành/hỗ trợ — chốt bằng văn bản trước khi bàn giao chính thức
- [ ] Chuyển giao mã nguồn, cấu trúc DB, quy trình release, môi trường vận hành

**Nghiệm thu Phase 5 = Nghiệm thu toàn dự án:** đạt đủ 7 hạng mục ở bảng "Tiêu chí nghiệm thu" mục 11 brief.
