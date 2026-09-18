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
- [x] Tạo môi trường production: frontend Vercel, backend Railway Singapore, database Supabase, file Google Drive
- [x] Cấu hình HTTPS/TLS cho production (`work.huyvoeducation.vn` và domain Railway)
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
- [x] Web App Manifest (icon, tên, theme color, display standalone)
- [x] Service Worker: cache app shell, chạy offline cơ bản (không cần offline data đầy đủ)
- [x] Test "Add to Home Screen" trên Android Chrome và iOS Safari
- [x] Implement Web Push (VAPID) cho trình duyệt hỗ trợ, ghi rõ giới hạn iOS trong tài liệu bàn giao
- [x] Test không cuộn ngang trên bảng dữ liệu ở màn hình phổ biến (360-430px width)
- [x] Test thao tác một tay: duyệt/trả lại/bình luận/đính kèm ảnh trên mobile thật

### Bảo mật & dữ liệu
- [x] Rà soát toàn bộ endpoint có guard phân quyền, viết test "âm tính" (role X bị từ chối resource Y)
- [x] Rate-limit login + các endpoint nhạy cảm (tránh nghẽn IP NAT văn phòng)
- [x] Kiểm tra CORS, security headers (helmet), HTTPS redirect
- [x] Xác nhận DB user backend không có quyền DELETE/UPDATE trên bảng `audit_logs` (scripts/db_security_hardening.sql)
- [x] Thiết lập backup tự động DB + storage, chạy thử khôi phục 1 lần, lập biên bản kết quả (scripts/backup_db.sh, BIEN_BAN_TEST_RESTORE.md)
- [x] Rà lại tất cả field nhạy cảm có mã hoá đúng (mật khẩu, token)

### UAT & bàn giao
- [x] Checklist nghiệm thu theo mục 11 brief — chạy thử với HVE trên staging (CHECKLIST_NGHIEM_THU_UAT.md)
- [x] Chuẩn bị tài liệu API (OpenAPI/Swagger tại /api/docs)
- [x] Chuẩn bị tài liệu quản trị hệ thống (HUONG_DAN_QUAN_TRI.md)
- [x] Chuẩn bị hướng dẫn người dùng theo từng vai trò (HUONG_DAN_SU_DUNG.md)
- [x] Tổ chức buổi đào tạo/demo bàn giao
- [x] Lấy asset logo chính thức (SVG/AI theo PA2) từ HVE, thay placeholder, review lại toàn bộ UI theo đúng bộ nhận diện
- [x] Xác nhận với HVE: giới hạn file, chính sách backup/retention, phạm vi OTP, thời gian bảo hành/hỗ trợ — chốt bằng văn bản trước khi bàn giao chính thức (VAN_BAN_XAC_NHAN_CHOT_HVE.md)
- [x] Chuyển giao mã nguồn, cấu trúc DB, quy trình release, môi trường vận hành

**Nghiệm thu Phase 5 = Nghiệm thu toàn dự án:** ✅ **ĐÃ ĐẠT** (Đạt đủ 7 hạng mục ở bảng "Tiêu chí nghiệm thu" mục 11 brief, 117/117 unit tests pass).

---

## Ổn định production sau cutover Railway — 16/09/2026

- [x] Chuyển `VITE_API_URL` production từ backend Vercel sang Railway và lưu mốc rollback frontend
- [x] Xác nhận Railway kết nối Supabase, CORS, JWT và Google Drive
- [x] Chuẩn hóa notification `PATCH /notifications/read-all`
- [x] Dùng chung helper upload/register và thêm JWT cho link tải tệp công việc
- [x] Tắt mock fallback trên production; thêm contract test 401/404/413 và upload/download
- [x] Tách các trang lớn bằng `React.lazy`/`Suspense` và thêm error boundary
- [x] Bỏ HMAC secret hardcode, production fail-closed khi thiếu `JWT_SECRET`
- [x] Chuẩn hóa Dockerfile Node.js 22 và `npm ci --ignore-scripts`
- [x] Cập nhật tài liệu theo kiến trúc Vercel → Railway → Supabase + Google Drive
- [x] Dọn sạch dữ liệu UAT/seed production, giữ IT Admin và dữ liệu cấu hình nền
- [x] Thêm OTP email cho lần đăng nhập đầu tiên và thiết bị chưa tin cậy
- [x] Cấu hình SMTP Mắt Bão trên Railway, gửi mail thử và bật `LOGIN_EMAIL_OTP_ENABLED=true`
- [x] Thêm nút gửi lại OTP sau 60 giây, thay challenge cũ an toàn và chống spam
- [x] Thêm quyền CEO duyệt thẳng toàn bộ quy trình (giữ chống tự duyệt và PIN)
- [x] Chỉ Trưởng bộ phận/CEO được giao hoặc giao lại công việc, kể cả việc con
- [x] Thêm Kanban board 4 cột dùng task/comment/@mention thật trên server

---

## Quản lý theo dự án + xác nhận chi tiền rút gọn — 17/09/2026

- [x] Thêm schema, migration và API quản trị `Project`/`ProjectMember`
- [x] Nạp phạm vi dự án vào phiên đăng nhập/JWT và hỗ trợ một người thuộc nhiều dự án
- [x] Áp dụng RBAC dự án cho hồ sơ, công việc, duyệt, trả lại, từ chối và dữ liệu được chia sẻ
- [x] Giữ fallback phòng ban cho dữ liệu cũ chưa có `projectId`
- [x] Chặn IDOR ở attachment, cập nhật/bình luận công việc và attachment ID lúc tạo mới
- [x] Thêm trang quản trị dự án, bộ chọn dự án khi tạo và badge dự án ở màn hình chi tiết
- [x] Thêm bộ lọc dự án cho danh sách công việc và báo cáo
- [x] Gắn chứng từ chi trực tiếp vào hồ sơ, bắt buộc chứng từ của Kế toán ở bước duyệt cuối
- [x] Loại endpoint/modal/trạng thái xác nhận chi tiền cũ; giữ trạng thái cuối là `Đã duyệt`
- [x] Thêm tổng số đề nghị đã duyệt chi và tổng tiền vào báo cáo
- [x] Prisma validate, backend lint/build, 169/169 backend test, frontend build và 10/10 frontend test đều đạt
- [ ] Minh rà soát diff RBAC và migration `20260917090000_add_projects`
- [ ] Minh cập nhật cột Excel theo spec, chạy migration và deploy Railway/Vercel từ commit sạch
- [ ] UAT production bằng dữ liệu `TEST-*`, xác nhận cô lập chéo dự án rồi dọn dữ liệu thử

---

## Tối ưu tốc độ production Railway — 17/09/2026

- [x] Đo CPU/RAM, 5xx và p95 từng API để loại trừ thiếu tài nguyên Railway
- [x] Đổi Prisma sang Supabase session pooler cổng 5432, `connection_limit=5`, `pool_timeout=10`
- [x] Thêm cache ngữ cảnh JWT 30 giây, single-flight và giới hạn kích thước cache
- [x] Chạy song song truy vấn phạm vi role/phòng ban/dự án khi cache JWT bị miss
- [x] Thêm index truy vấn bằng migration `20260917143000_add_query_performance_indexes`
- [x] Dùng `relationJoins` để giảm round-trip ở dashboard, hồ sơ, công việc và dự án
- [x] Bỏ tải sẵn dữ liệu nặng sau đăng nhập; chỉ tải theo tab/quyền thực tế
- [x] Giảm polling thông báo, cache đồng bộ Web Push và mở VAPID key không cần JWT
- [x] Backend 178/178 test, build/lint pass; frontend 10/10 test và build pass
- [x] Railway deployment tối ưu `b41eb9e6-61c8-4c24-9a29-e0a9967a32b0` và redeploy cuối có healthcheck `/` `a54de5aa-08b9-44c7-828a-2ddf99749001` đạt `SUCCESS`
- [x] Vercel deployment `dpl_8w8H2e1aviWgGpyor7dk4LzZrh6U` đạt `READY`, alias production đúng
- [x] Đo 7 vòng authenticated warm: median dashboard 189 ms; documents 282 ms; tasks 270 ms; projects 272 ms; notifications 271 ms; không có 5xx
- [ ] Tùy chọn đợt sau: lập kế hoạch migrate Supabase Tokyo sang cùng vùng Singapore nếu cần giảm thêm cold latency/outlier

---

## Bảng thông báo HVE — 18/09/2026

- [x] Thêm schema, migration và API Announcement có cache riêng
- [x] Cô lập thông báo theo dự án trực tiếp, không kế thừa quyền duyệt ủy quyền
- [x] Thêm bảng thông báo trên đầu dashboard, modal xem chi tiết và danh sách mở rộng
- [x] Thêm lịch Google Calendar và tệp `.ics` cho Apple Calendar/Outlook
- [x] Thêm trang quản trị chỉ dành cho IT, hỗ trợ nháp/đăng/lưu trữ/hẹn giờ/hết hạn
- [x] Thêm mẫu bài hướng dẫn bắt đầu sử dụng HVE Work
- [x] Gỡ Board chat frontend/backend nhưng giữ dữ liệu cũ để rollback
- [x] Kiểm tra responsive 390×844 không tràn ngang
- [x] Prisma validate, backend type-check/lint và 193/193 test pass; frontend build và 10/10 test pass
- [x] Migration production đã áp dụng; Railway `c5520e5f-5db0-40c1-bfc6-22f17d113dde` đạt `SUCCESS`; Vercel `dpl_DgYiMjko3wFRw8r22KBLdZ36KSMt` đạt `READY`
- [x] Đăng bài hướng dẫn mẫu toàn hệ thống trên production (Announcement ID `1`), có ghim và Audit Log
- [x] Tách nhận diện bảng tin bằng header màu và thẻ ưu tiên Bình thường/Quan trọng/Khẩn cấp
- [x] Gửi in-app + Web Push khi phát hành bài, đúng phạm vi toàn hệ thống/dự án và chống gửi trùng
- [x] Thêm cron 5 phút cho bài hẹn giờ và migration `20260918143000_add_announcement_push_tracking`
- [ ] UAT bằng tài khoản thành viên dự án để xác nhận bài theo dự án chỉ hiển thị đúng phạm vi
