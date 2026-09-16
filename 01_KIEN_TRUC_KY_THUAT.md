# HVE App — Kiến trúc kỹ thuật (Technical Architecture Plan)

Phiên bản 1.0 | 15/09/2026 | Dựa trên `HVE_App_Developer_Brief.pdf` v1.0
Tài liệu này biến các yêu cầu nghiệp vụ trong brief thành phương án kỹ thuật cụ thể để dev bám theo khi code. Các mục đánh dấu **[QUYẾT ĐỊNH CẦN CHỐT]** là chỗ brief để ngỏ cho developer đề xuất — đã chọn phương án mặc định hợp lý cho quy mô 20-30 user, có thể đổi trước khi code.

---

## 1. Tổng quan kiến trúc

Ứng dụng quy mô nhỏ (20-30 tài khoản), ưu tiên tốc độ triển khai, chi phí vận hành thấp, dễ bảo trì bởi 1 team nhỏ hoặc 1 dev. Chọn kiến trúc **monolith modular**, không cần microservices.

```
┌─────────────────────────────────────────────┐
│  Client: PWA (React + Vite, responsive)      │
│  - Service Worker (offline shell, installable)│
│  - Web Push (best-effort theo trình duyệt)   │
└───────────────────┬───────────────────────────┘
                     │ HTTPS / REST (JSON)
┌───────────────────▼───────────────────────────┐
│  Backend API (Node.js/NestJS hoặc tương đương) │
│  - Auth (JWT + refresh token)                  │
│  - RBAC middleware (kiểm tra quyền server-side)│
│  - Module: Approvals, Tasks, Reports, Notify   │
│  - Workflow engine cấu hình được (không hardcode)│
└───────┬───────────────────┬────────────────────┘
        │                   │
┌───────▼──────┐   ┌────────▼─────────┐
│ PostgreSQL    │   │ Object Storage   │
│ (dữ liệu chính,│   │ (file đính kèm:  │
│  audit log)    │   │  S3-compatible)  │
└───────────────┘   └──────────────────┘
        │
┌───────▼──────────────────────────┐
│  Background jobs (cron/queue)     │
│  - Nhắc hạn, cảnh báo quá hạn     │
│  - Gửi email                      │
│  - Việc lặp lại tự tạo kỳ mới     │
└───────────────────────────────────┘
```

### 1.1 Lựa chọn công nghệ **[QUYẾT ĐỊNH CẦN CHỐT]**

| Lớp | Đề xuất | Lý do |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite, PWA plugin (`vite-plugin-pwa`), TailwindCSS | Nhanh, hệ sinh thái lớn, dễ tuyển dev, hỗ trợ PWA tốt |
| Backend | Node.js + NestJS (TypeScript) | Cấu trúc module rõ ràng phù hợp RBAC + workflow, cùng ngôn ngữ với frontend giảm chi phí bảo trì |
| Database | PostgreSQL (managed, ví dụ Supabase/Neon/RDS) | Quan hệ rõ (hồ sơ, workflow, audit), hỗ trợ JSONB cho cấu hình luồng linh hoạt |
| Object storage | S3-compatible (Cloudflare R2 hoặc AWS S3) | Rẻ, lưu file đính kèm + versioning |
| Cache/Queue | Redis (BullMQ cho job nhắc hạn/email) | Nhẹ, đủ cho quy mô 20-30 user |
| Email | Provider giao dịch (Resend/SendGrid/SES) | Độ tin cậy gửi mail nhắc hạn/duyệt |
| Hosting | VPS đơn (Docker Compose) hoặc PaaS (Railway/Render) | Chi phí thấp, đủ cho tải nhỏ, dễ backup |
| CI/CD | GitHub Actions → build & deploy tự động | Chuẩn hoá release, khớp yêu cầu "quy trình phát hành phiên bản" ở mục 11 brief |

> Không bắt buộc đúng stack này — dev có thể đề xuất thay thế tương đương (vd. Laravel, Django, Supabase all-in-one) miễn đáp ứng toàn bộ NFR ở mục 6 dưới. Nhưng **PostgreSQL + RBAC server-side + audit log không thể xoá** là ràng buộc cứng từ brief, không đổi.

---

## 2. Mô hình dữ liệu chính

### 2.1 Thực thể cốt lõi

- **User** (id, họ tên, email, số điện thoại, mật khẩu hash, trạng thái khoá, bộ phận, vai trò[])
- **Role**: `employee | department_head | accountant | legal | ceo | it_admin` — cấu hình được qua bảng `roles` + `permissions`, không hardcode enum cứng trong code nghiệp vụ (đáp ứng yêu cầu "IT có màn hình tự cấu hình vai trò và luồng duyệt").
- **Department** (bộ phận) — user thuộc 1 bộ phận chính.
- **Document** (hồ sơ — bảng cha chung cho 3 loại hoặc 3 bảng riêng, xem 2.2): payment_request | proposal | contract
- **DocumentApprovalStep**: document_id, step_order, role_required, assignee_id (nullable — theo vai trò hoặc theo người cụ thể), status (pending/approved/returned/rejected), acted_by, acted_at, comment
- **Task** (công việc): mã tự động, tiêu đề, mô tả, assignee, coordinators[], priority, start_date, due_date, status, parent_task_id (việc con), recurrence_rule (nullable), progress_percent
- **Attachment**: entity_type, entity_id, file_url, file_name, mime_type, size, version, uploaded_by, uploaded_at
- **Comment**: entity_type, entity_id, user_id, content, mentions[], created_at
- **Notification**: user_id, event_type, entity_ref, channel, sent_at, read_at, dedupe_key
- **ReminderRule**: entity_type, offset_days[], recipients_rule, channel — cấu hình được theo brief mục 7
- **AuditLog**: entity_type, entity_id, action, actor_id, before_json, after_json, ip, device, created_at — **append-only, không có API xoá/sửa cho user nghiệp vụ**
- **WorkflowTemplate** + **WorkflowStepTemplate**: cho phép IT admin cấu hình lại thứ tự/role của luồng duyệt qua UI (mục 2 brief: "IT được ưu tiên có màn hình tự cấu hình... không cần sửa mã nguồn")

### 2.2 Loại hồ sơ (3 luồng mặc định — mục 3 brief)

| Loại | Mã | Luồng mặc định |
|---|---|---|
| Đề nghị thanh toán | `DNTT-2026-001` | Người tạo → Trưởng bộ phận → Kế toán → CEO → Đã duyệt |
| Đề xuất | `DX-2026-001` | Người tạo → Trưởng bộ phận → CEO → Đã duyệt |
| Hợp đồng | `HD-2026-001` | Người tạo → Trưởng bộ phận → Pháp chế → Kế toán → CEO → Đã duyệt |

Mã tự sinh dạng `{PREFIX}-{YYYY}-{seq:03d}`, sequence reset theo năm.

### 2.3 State machine hồ sơ

`Nháp → Chờ duyệt (lặp qua từng step) → {Trả lại | Từ chối | Đã duyệt}`

- **Trả lại**: quay lại người tạo để sửa. **[QUYẾT ĐỊNH CẦN CHỐT — brief để ngỏ]**: khi gửi lại, hồ sơ chạy lại **từ đầu luồng** (đơn giản, an toàn, đúng tinh thần "một người không tự duyệt hồ sơ mình tạo" và tránh bypass các bước đã qua). Ghi rõ trong changelog để HVE xác nhận nếu muốn khác (vd. quay lại đúng cấp đã trả).
- **Từ chối**: bắt buộc nhập lý do (validation phía server, không chỉ frontend), kết thúc luồng, không cho thao tác tiếp trừ tạo hồ sơ mới.
- **Đã duyệt**: khoá toàn bộ field của bản ghi (immutable); sửa nội dung sau duyệt phải tạo **document version mới** (document_id giữ nguyên, version_no + 1), version cũ giữ nguyên để audit.

### 2.4 Task state machine

`Chưa làm → Đang làm → Chờ duyệt → Hoàn thành`, cờ `is_overdue` tính runtime (không lưu cứng) = `due_date < now() AND status != 'Hoàn thành'`.

- Người thực hiện chuyển `Đang làm → Chờ duyệt`; **chỉ người giao** chuyển `Chờ duyệt → Hoàn thành` (đúng nguyên tắc "người thực hiện không tự đóng việc").
- Task lặp lại: khi task gốc hoàn thành (hoặc theo lịch cron nếu cấu hình "tạo trước N ngày"), job tạo bản ghi task mới theo `recurrence_rule` (daily/weekly/monthly), copy assignee/coordinators/priority, due_date tính theo chu kỳ.

---

## 3. Phân quyền (RBAC) — chi tiết kỹ thuật

- Kiểm tra quyền **bắt buộc ở server** (API middleware/guard), tuyệt đối không dựa vào ẩn/hiện nút ở frontend (yêu cầu cứng ở mục 10 brief).
- Ma trận quyền dạng bảng `role_permissions(role_id, resource, action, scope)` — scope ví dụ: `own | department | assigned | all`.
- Middleware chung: `checkPermission(user, resource, action, record)` → so `record.department_id` / `record.owner_id` với scope của role.
- Rule đặc biệt bắt buộc code cứng vì là nguyên tắc kiểm soát nội bộ, không cấu hình được qua UI:
  - Không cho `acted_by == document.created_by` tại bất kỳ step nào (chặn tự duyệt hồ sơ mình tạo).
  - Mọi transition trạng thái đều ghi `AuditLog` trong cùng transaction DB (không tách riêng, tránh mất log khi lỗi).
- CEO: scope `all` trên mọi resource đọc + quyền duyệt cuối + giao việc.
- IT admin: full quyền trên `User, Role, Department, WorkflowTemplate, ReminderRule, Category`; **không có quyền ghi trên bản ghi nghiệp vụ đã duyệt** (chỉ đọc, đúng "không tự ý sửa nội dung nghiệp vụ đã duyệt").

---

## 4. Thông báo & nhắc hạn

- Bảng `ReminderRule` cho phép admin cấu hình nhiều mốc/đối tượng (vd 7/3/1 ngày trước hạn task, trước hạn hết hạn hợp đồng).
- Job scheduler (cron mỗi giờ hoặc mỗi ngày tuỳ SLA) quét các entity đến mốc nhắc → tạo `Notification` với `dedupe_key = hash(event_type + entity_id + recipient + milestone)` để tránh gửi trùng (yêu cầu cứng ở mục 7 brief).
- Kênh giai đoạn 1: **in-app + email**. Kiến trúc phải để sẵn interface `NotificationChannel` (in_app, email, zalo-stub) để cắm Zalo OA sau này mà không sửa lõi (yêu cầu "kiến trúc cần sẵn điểm kết nối" — mục 7 & mục ngoài phạm vi).
- Web Push (PWA) — **[QUYẾT ĐỊNH CẦN CHỐT]**: implement Web Push API (VAPID) cho trình duyệt hỗ trợ (Chrome/Edge Android & desktop); Safari/iOS PWA push có giới hạn (chỉ hỗ trợ từ iOS 16.4+ khi đã "Add to Home Screen") — cần test thực tế và ghi rõ giới hạn trong tài liệu bàn giao, đúng yêu cầu "developer đánh giá khả năng hỗ trợ theo trình duyệt/thiết bị".

---

## 5. File đính kèm

- Upload trực tiếp lên object storage qua **pre-signed URL** (giảm tải server, phù hợp mobile kết nối yếu).
- Giới hạn **[QUYẾT ĐỊNH CẦN CHỐT]**: 10MB/file, tối đa 20MB tổng/hồ sơ (điều chỉnh được qua config, không hardcode) — cần HVE xác nhận trước khi chốt.
- Loại file whitelist: PDF, DOCX, XLSX, JPG, PNG (kiểm tra MIME thật + đuôi file, không chỉ tin extension).
- Quét mã độc **[QUYẾT ĐỊNH CẦN CHỐT]**: dùng ClamAV (self-host trong container) hoặc dịch vụ quét cloud (VirusTotal API cho file nhỏ) — đề xuất ClamAV vì không phát sinh chi phí theo lượng dùng, phù hợp scale nhỏ.
- Không ghi đè: mỗi lần upload lại tạo `version` mới trong bảng `Attachment`, giữ file cũ + tên người tải lên + timestamp.

---

## 6. Yêu cầu phi chức năng (NFR) — cách đáp ứng

| Yêu cầu brief | Giải pháp kỹ thuật |
|---|---|
| Đăng nhập email/SĐT, ưu tiên OTP | Auth cơ bản: email + mật khẩu (bcrypt/argon2) + JWT access (15p) + refresh token (7 ngày, rotate). OTP qua email ở v1; OTP SMS **[CẦN CHỐT]** hoãn vì phát sinh chi phí SMS gateway — đề xuất OTP email trước, SMS là tuỳ chọn nâng cấp. |
| Khôi phục & khoá tài khoản | Quên mật khẩu qua email token hết hạn 15p; khoá tài khoản sau 5 lần đăng nhập sai liên tiếp trong 15 phút, IT admin mở khoá thủ công. |
| Kiểm tra quyền server-side | Guard/middleware ở mọi endpoint, unit test riêng cho từng role x resource. |
| Nhật ký không xoá được | Bảng `audit_log` không có DELETE/UPDATE endpoint; DB user của backend không có quyền DELETE trên bảng này ở mức DB (defense in depth). |
| HTTPS, mã hoá, chống truy cập trái phép | TLS bắt buộc (redirect http→https), mật khẩu hash argon2id, JWT ký RS256, rate-limit login (vd 10 req/phút/IP), CORS whitelist domain HVE, helmet/security headers. |
| Sao lưu & khôi phục | Backup DB tự động hàng ngày (retention **[CẦN CHỐT]**: đề xuất 30 ngày rolling + 12 bản cuối tháng lưu 1 năm), test restore theo quý, backup file storage kế thừa versioning của S3-compatible provider. |
| Hiệu năng <3s | Index đúng cột lọc thường dùng (status, department_id, assignee_id, due_date), phân trang mọi danh sách, cache dashboard aggregate 60s (Redis) vì không cần realtime tuyệt đối. |
| Tương thích Chrome/Edge/Safari, desktop/iOS/Android | Test matrix thủ công trước UAT; dùng CSS/JS chuẩn, tránh API độc quyền Chrome. |

---

## 7. Nhận diện thương hiệu

- Dùng bộ màu đã chốt: `--hve-blue:#0A66C2; --hve-green:#20B84D; --hve-yellow:#FFC631; --hve-dark:#1D1D1F;`
- Semantic mapping theo brief mục 8: xanh dương = hành động chính, xanh lá = hoàn thành, vàng = cảnh báo, đỏ (không nằm trong bộ màu chính — dùng đỏ chuẩn accessible, vd `#DC2626`) chỉ dùng cho lỗi/quá hạn.
- **Việc cần làm trước khi code UI production**: liên hệ HVE để lấy file logo vector (SVG/AI) theo phương án PA2 trong `Logo Proposal PA2 14.07.2026.pdf` — hiện chỉ có PDF, chưa có asset xuất sẵn. Không tự vẽ lại/đổi tỷ lệ logo.

---

## 8. Rủi ro kỹ thuật cần lưu ý

1. **Workflow cấu hình được nhưng vẫn phải giữ 3 luồng mặc định đúng thứ tự** — thiết kế `WorkflowTemplate` sao cho thay đổi cấu hình không phá vỡ hồ sơ đang chạy dở (snapshot step list vào `document` lúc submit, không tham chiếu sống tới template).
2. **Trả lại từ giữa luồng** — brief để ngỏ, đã chọn phương án "chạy lại từ đầu" ở mục 2.3, cần HVE xác nhận bằng văn bản trước khi code vì ảnh hưởng UX rõ rệt.
3. **Web Push trên iOS Safari** — giới hạn nền tảng, không phải lỗi kỹ thuật của dev; cần set kỳ vọng với HVE sớm.
4. **Đồng thời sửa/duyệt (race condition)** — 2 người duyệt cùng lúc một hồ sơ: dùng optimistic locking (`version` column) trên bảng document/step để tránh duyệt trùng khi bấm 2 lần trên mobile mạng yếu (đúng yêu cầu "không ghi nhận phê duyệt hai lần").
