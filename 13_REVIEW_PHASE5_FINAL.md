# Review Phase 5 & Nghiệm thu Toàn Dự án — HVE App (Lần 1)

Ngày review: 16/09/2026
Đối chiếu với: [12_REVIEW_PHASE5_PLAN.md](12_REVIEW_PHASE5_PLAN.md), [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 5, HVE Developer Brief mục 11
**Kết luận: CHƯA SẴN SÀNG GO-LIVE. Phần lớn hạng mục làm tốt và đúng những gì đã yêu cầu bổ sung (Web Push thật, rate-limit hợp lý, negative RBAC re-test 7 lỗ hổng cũ). Nhưng phát hiện cụm vấn đề "hardening có làm nhưng chưa thật sự nối vào cấu hình chạy thật" — đúng lúc dự án tự nhận "sẵn sàng Go-Live" thì đây là loại lỗi nguy hiểm nhất vì dễ bị bỏ qua.**

---

## Đã xác minh thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` (backend) | ✅ Pass |
| `npm run lint` (backend) | ✅ Sạch |
| `npm run test` (backend) | ✅ **117/117 pass** |
| `npm run build` (frontend) | ✅ Pass |
| Negative RBAC — đọc code test | ✅ 7 kịch bản đúng như báo cáo, tái test đúng các lỗ hổng đã từng phát hiện/sửa ở Phase 2-4 (admin, workflow, audit log, export hợp đồng, duyệt chéo phòng, tự duyệt) |
| Rate-limit toàn cục | ✅ Đã sửa đúng theo góp ý — `ThrottlerModule.forRoot([{ttl:60000, limit:1000}])`, không còn 100/60s |
| CORS whitelist | ✅ Đúng — dùng callback kiểm tra origin, không còn `enableCors()` mở toàn bộ |

## VẤN ĐỀ NGHIÊM TRỌNG NHẤT: Bí mật (secret) có fallback hardcode trong source — đúng lúc Phase 5 "hardening"

### 1. `JWT_SECRET` — tồn tại từ Phase 0, chưa từng được rà lại dù Phase 5 có mục "rà lại field nhạy cảm mã hoá đúng"
`auth.module.ts` và `jwt.strategy.ts` vẫn dùng `process.env.JWT_SECRET || 'secretKey'`. Nếu triển khai thật mà quên set biến môi trường (lỗi cấu hình rất dễ xảy ra), toàn bộ hệ thống ký token bằng chuỗi `'secretKey'` — ai cũng đoán được, có thể tự tạo JWT hợp lệ giả danh bất kỳ user/role nào, kể cả CEO.

### 2. Khoá VAPID (Web Push) — public key fallback là **khoá demo nổi tiếng trong mọi tutorial Web Push**, private key cũng hardcode
`web-push.service.ts`:
```
vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'UUxI4g7-2N8XkP_W4L3w_R7O3jB-8Y8bI8nB7I0nJ5c'
```
Chuỗi public key fallback chính là **VAPID key mẫu được copy trong hầu hết tài liệu hướng dẫn Web Push trên mạng** — không có giá trị bảo mật nếu vô tình dùng tới. Nghiêm trọng hơn: **`.env.example` không hề liệt kê `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`** — nghĩa là người triển khai đọc theo hướng dẫn mặc định sẽ không biết cần phải tự sinh cặp khoá riêng, khả năng cao vô tình chạy production với khoá demo công khai.

**Cần sửa trước Go-Live (bắt buộc):**
- Bỏ hẳn giá trị fallback hardcode cho `JWT_SECRET` và `VAPID_PRIVATE_KEY` — nếu thiếu biến môi trường, ứng dụng phải **crash khi khởi động** (fail-closed) thay vì âm thầm dùng giá trị yếu.
- Cập nhật `.env.example` liệt kê đầy đủ `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ALLOWED_ORIGINS` kèm hướng dẫn cách tự sinh (`npx web-push generate-vapid-keys`).

## 2. Script hardening DB đã viết đúng nhưng CHƯA THẬT SỰ ĐƯỢC NỐI VÀO CẤU HÌNH CHẠY

Đọc `scripts/db_security_hardening.sql` — nội dung kỹ thuật đúng (tạo role `hve_app_user`, REVOKE UPDATE/DELETE/TRUNCATE trên `AuditLog`, áp dụng cho cả bảng tạo sau này). Nhưng đối chiếu với cấu hình thực tế đang chạy:

- `hve-backend/.env.example` vẫn khai `DATABASE_URL="postgresql://postgres:postgres@..."` — dùng tài khoản **superuser mặc định**, không phải `hve_app_user` vừa tạo.
- `docker-compose.yml` (gốc từ Phase 0) tạo database tên **`hve_db`** với user **`hve_user`**, trong khi script hardening lại `GRANT CONNECT ON DATABASE hve_app_db` — **sai tên database, script sẽ báo lỗi "database does not exist" nếu chạy đúng theo docker-compose hiện tại.**
- Nghĩa là: script hardening tồn tại như 1 file độc lập, **chưa được test chạy thật trên môi trường dev/staging hiện có**, và ứng dụng hiện tại (`.env.example`) vẫn đang chạy bằng quyền superuser — quyền hạn chế trên `AuditLog` **chưa thực sự có hiệu lực** với cấu hình mặc định.

**Cần sửa:** đồng bộ tên database giữa script và `docker-compose.yml`, cập nhật `.env.example` trỏ `DATABASE_URL` sang `hve_app_user`, và **chạy thử thật 1 lần** để xác nhận: (a) migration vẫn chạy được (cần user có quyền DDL riêng để migrate, khác với runtime user), (b) app chạy bình thường với quyền hạn chế, (c) thử `DELETE FROM "AuditLog"` bằng `hve_app_user` phải bị từ chối thật.

Ngoài ra: mật khẩu `HVE_Secure_Runtime_Pass_2026!` trong script đã bị commit vào git dưới dạng plaintext — nên đổi mật khẩu này trước khi dùng thật cho production (coi như đã "lộ" vì nằm trong lịch sử git).

## 3. Cam kết trong văn bản xác nhận không khớp với những gì đã code

`VAN_BAN_XAC_NHAN_CHOT_HVE.md` Điều khoản 2 ghi: *"Bản sao lưu mốc tháng (Monthly Archives): Lưu giữ 12 bản chụp vào ngày cuối cùng của mỗi tháng trong vòng 01 năm."* Nhưng đọc `scripts/backup_db.sh` **chỉ có logic rolling 30 ngày**, không có cơ chế lưu riêng bản cuối tháng nào. Đây là văn bản dự định trình anh Định/anh Minh ký — không nên ký một cam kết mà hệ thống chưa thực sự làm được. Cần bổ sung logic backup mốc tháng vào script, hoặc sửa lại nội dung văn bản cho khớp thực tế trước khi trình ký.

## 4. Còn thiếu — đã nêu ở review kế hoạch, chưa thấy xử lý

- **Logo chính thức từ HVE**: đã flag từ Phase 0 và nhắc lại ở review kế hoạch Phase 5, nhưng báo cáo hoàn thành không đề cập gì. Icon hiện tại (`icon-192.svg`, `icon-512.svg`) nhiều khả năng vẫn là placeholder tự vẽ theo mã màu, chưa phải logo thật theo phương án PA2. Cần xác nhận với HVE trước khi Go-Live vì đây là hạng mục hiển thị công khai (icon app trên màn hình chính điện thoại).
- **Swagger `/api/docs` vẫn public không xác thực** — đã nêu trong review kế hoạch, chưa thấy thêm bảo vệ (Basic Auth hoặc giới hạn theo môi trường).

## Điểm làm tốt, xác nhận đúng

- Web Push đã làm đầy đủ end-to-end (không chỉ là "vỏ" như lo ngại ở review kế hoạch): có bảng `PushSubscription`, API subscribe, gọi gửi thật qua `webpush.sendNotification`, tự xoá subscription hết hạn khi nhận lỗi 404/410 — xử lý vòng đời subscription đúng chuẩn.
- Rate-limit đã điều chỉnh đúng góp ý (1000/60s toàn cục thay vì 100/60s), tránh chặn nhầm văn phòng dùng chung IP.
- CORS chuyển từ mở hoàn toàn sang whitelist qua callback — đúng.
- 7 test RBAC âm tính đều là test tái hiện đúng lỗ hổng thật đã từng gặp, không phải test hình thức.
- Backup script `.sh` cho Linux/Docker đã có (đúng góp ý về môi trường triển khai thật), kèm `.bat` cho dev Windows.

---

## Kết luận & việc bắt buộc trước khi ký nghiệm thu Go-Live

1. **Bắt buộc**: bỏ fallback hardcode cho `JWT_SECRET` và VAPID keys, bổ sung đầy đủ vào `.env.example`, ứng dụng phải fail-closed nếu thiếu.
2. **Bắt buộc**: đồng bộ tên database giữa `docker-compose.yml` và script hardening, cập nhật `.env.example` dùng đúng `hve_app_user`, chạy thử thật để xác nhận quyền hạn chế có hiệu lực. Đổi mật khẩu đã lộ trong git.
3. **Bắt buộc**: sửa lại nội dung "Monthly Archives" trong văn bản xác nhận cho khớp thực tế, hoặc bổ sung logic backup mốc tháng vào script trước khi trình ký.
4. Nên làm trước Go-Live: xác nhận tình trạng logo chính thức với HVE, cân nhắc bảo vệ `/api/docs`.

Sau khi xử lý xong mục 1-3 (bắt buộc), đề nghị chạy lại toàn bộ checklist UAT một lần cuối rồi mới ký văn bản bàn giao chính thức.

---

## Review lần 2 (16/09/2026) — Xác nhận độc lập sau khi vá

Đọc trực tiếp code, không dựa vào báo cáo:

1. ✅ **JWT_SECRET/VAPID fail-closed đúng**: `jwt.strategy.ts`/`auth.module.ts` ném lỗi `FATAL SECURITY ERROR` và dừng khởi động nếu thiếu `JWT_SECRET`; `web-push.service.ts` tương tự cho VAPID, có ghi rõ "Hardcoded demo keys are strictly forbidden". Có thêm test riêng `fail-closed-security.spec.ts` xác nhận hành vi này. `.env.example` viết lại đầy đủ, có hướng dẫn lệnh sinh khoá thật (`openssl rand`, `npx web-push generate-vapid-keys`).
2. ✅ **Đồng bộ DB hardening đúng**: `docker-compose.yml` và `db_security_hardening.sql` đã cùng dùng database `hve_db`. Mật khẩu `hve_app_user` chuyển sang truyền qua biến `psql -v APP_PASS=...`, không còn hardcode 1 chuỗi thật cố định — có cảnh báo rõ trong comment phải đổi khi lên staging/production. `.env.example` tách riêng `DATABASE_URL` (runtime, quyền hạn chế) và `MIGRATION_DATABASE_URL` (quyền DDL) — đúng nguyên tắc least-privilege.
3. ✅ **Backup script đã có logic mốc tháng**: `backup_db.sh` bổ sung `MONTHLY_DIR`, ghi đè snapshot mỗi tháng, dọn file cũ hơn 365 ngày — khớp đúng cam kết ở `VAN_BAN_XAC_NHAN_CHOT_HVE.md` Điều khoản 2, không còn cam kết vượt quá thực tế.
4. ✅ **Logo**: văn bản xác nhận đã ghi rõ đây là hạng mục chờ HVE bàn giao file gốc PA2, kèm hướng dẫn kỹ thuật để IT Admin tự thay khi có (chỉ cần copy file vào `/hve-frontend/public/icons/`, không cần sửa code) — xử lý minh bạch, không giấu như 1 việc đã xong.
5. ✅ **Bonus ngoài yêu cầu**: Swagger `/api/docs` được bảo vệ bằng Basic Auth middleware thật (không phải chỉ khai báo biến), fail-closed nếu thiếu `SWAGGER_PASSWORD` ở production — vượt mức đề xuất ban đầu (mình chỉ nói "nên", dev đã chủ động làm đầy đủ).

Build/lint/test verify lại: pass sạch cả 2 phía, **121/121 test pass** (tăng 4 so với lần trước, gồm test fail-closed mới).

**Nghiệm thu Phase 5 & toàn dự án: ĐẠT. Đồng ý trình anh Định/anh Minh ký văn bản bàn giao tại [VAN_BAN_XAC_NHAN_CHOT_HVE.md](VAN_BAN_XAC_NHAN_CHOT_HVE.md).**
