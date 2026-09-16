# Review kế hoạch Phase 5 (trước khi code)

Ngày review: 16/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 5 (checklist đầy đủ), [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md), HVE Developer Brief mục 9-11

**Kết luận: Phần lớn kế hoạch đúng hướng và khá đầy đủ (PWA shell, Throttler, Helmet, Swagger, negative RBAC, tài liệu bàn giao). Nhưng thiếu 1 hạng mục đã nêu rõ trong checklist gốc (Web Push thật, không chỉ stub), 1 rủi ro triển khai đáng lưu ý riêng cho quy mô công ty này (rate-limit theo IP), và vài mục trong checklist Phase 5 gốc bị bỏ sót không nhắc tới trong kế hoạch.**

---

## Đối chiếu với checklist gốc — phát hiện thiếu sót

### 1. Web Push (VAPID) — kế hoạch chỉ làm phần "vỏ", thiếu phần thật
Checklist Phase 5 ghi rõ: *"Implement Web Push (VAPID) cho trình duyệt hỗ trợ, ghi rõ giới hạn iOS trong tài liệu bàn giao"* — đây là yêu cầu cụ thể từ brief (mục 9: "Thông báo đẩy của PWA là hạng mục developer đánh giá khả năng hỗ trợ"). Kế hoạch Phase 5 hiện tại chỉ có *"Push Notification Listener: Sẵn sàng lắng nghe sự kiện push"* trong `sw.js` — đây là code chờ nhận push, **không phải cơ chế gửi push thật** (thiếu: sinh cặp khoá VAPID, endpoint backend lưu `PushSubscription` theo user, gọi thư viện `web-push` để đẩy khi có event như "hồ sơ cần duyệt"). Nếu không làm phần backend gửi push thật, tính năng này coi như chưa tồn tại — chỉ có khung rỗng.

**Đề nghị:** bổ sung vào phạm vi Phase 5: cài `web-push`, sinh VAPID key, thêm bảng/field lưu subscription theo user, thêm 1 API `POST /notifications/subscribe`, và gọi gửi push khi `dispatchNotification` chạy (tái dùng logic đã có ở Phase 4, chỉ thêm 1 channel mới). Nếu quyết định không kịp làm đầy đủ trong Phase 5 (khối lượng không nhỏ), cần nói rõ với HVE đây là tính năng dời sang giai đoạn sau, không phải "đã có nhưng giới hạn" — brief cho phép giới hạn theo trình duyệt/thiết bị nhưng không cho phép bỏ hẳn mà không báo trước.

### 2. Backup script chỉ có `.bat` (Windows) — không chạy được trên môi trường triển khai thật
`scripts/backup_db.bat`/`restore_db.bat` chỉ chạy trên Windows, trong khi Postgres production/staging gần như chắc chắn chạy trên Linux (Docker container theo kiến trúc đã chốt). Cần thêm bản `.sh` tương đương (hoặc viết bằng Node.js để chạy được cả 2 hệ điều hành) — nếu không, "script backup tự động" chỉ dùng thử được trên máy dev Windows, không dùng được ở nơi cần nhất là server thật.

### 3. "DB user backend không có quyền DELETE/UPDATE trên `audit_logs`" — kế hoạch chưa có giải pháp kỹ thuật cụ thể
Đây là yêu cầu ở cấp quyền hạn database (defense-in-depth, độc lập với việc API có endpoint xoá hay không), nhưng kế hoạch không đề cập cách làm. Cần: tạo riêng 1 DB role cho ứng dụng runtime (khác với role dùng để chạy migration), sau đó `REVOKE DELETE, UPDATE ON audit_logs FROM <app_role>`. Đây là việc cần làm ở tầng hạ tầng (docker-compose/init script SQL), không phải code Prisma.

### 4. Chưa nhắc tới việc lấy logo chính thức từ HVE
Đã note từ [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) §7 ngay từ đầu dự án: *"trước khi làm UI production, developer cần yêu cầu hoặc trích xuất tài sản logo phù hợp và được HVE xác nhận."* Đây là Phase cuối cùng trước bàn giao — nếu chưa lấy được asset thật, cần chủ động hỏi HVE ngay bây giờ, không để tới lúc bàn giao mới phát hiện còn thiếu.

### 5. Xác nhận bằng văn bản với HVE (giới hạn file, backup retention, phạm vi OTP, thời gian bảo hành) — chưa thấy trong kế hoạch
Đây không phải việc code, nhưng là điều kiện tiên quyết trong checklist gốc trước khi "bàn giao chính thức". Nên đưa vào kế hoạch như 1 đầu việc riêng (gửi email/văn bản xác nhận), không để trôi qua.

---

## Rủi ro cần cân nhắc kỹ trước khi code

### 6. Rate-limit toàn cục theo IP (100 req/60s) có thể chặn nhầm người dùng thật
Cấu hình `ThrottlerGuard` toàn cục theo IP phù hợp cho ứng dụng public, nhưng HVE chỉ có 20-30 người dùng, nhiều khả năng làm việc cùng 1-2 văn phòng — nếu họ dùng chung 1 địa chỉ IP công cộng (rất phổ biến với mạng văn phòng nhỏ dùng NAT), thì **100 request/60 giây tính chung cho TẤT CẢ nhân viên trong văn phòng đó**, không phải riêng từng người. Một dashboard tải nhiều widget cùng lúc (documents + tasks + notifications + dashboard) nhân với vài người bấm F5 cùng lúc dễ dàng vượt ngưỡng này, gây lỗi 429 cho người dùng hợp lệ.

**Đề nghị:** áp Throttler chặt cho các endpoint nhạy cảm cụ thể (login, forgot-password — kế hoạch đã làm đúng phần này với limit 5 và 3), nhưng **không nên áp giới hạn toàn cục 100/60s theo IP cho toàn bộ API** — nên nới rộng đáng kể (hoặc bỏ giới hạn toàn cục, chỉ giữ throttle ở các endpoint nhạy cảm) để tránh chặn nhầm cả văn phòng vì 1 vài người dùng bình thường.

### 7. Swagger UI `/api/docs` công khai — nên hạn chế trên production
Tài liệu API là hữu ích cho dev nhưng public hoá toàn bộ schema (bao gồm endpoint `/admin`, `/reports`) trên domain thật là rò rỉ thông tin không cần thiết cho người ngoài. Đề nghị: chỉ bật `/api/docs` ở môi trường staging, hoặc bọc thêm 1 lớp xác thực cơ bản (Basic Auth) nếu cần bật ở production.

---

## Điểm làm tốt, đáng ghi nhận

- 6 kịch bản negative RBAC test bao phủ đúng các module quan trọng đã có vấn đề thật ở các phase trước (admin, workflows, audit log, export hợp đồng, phân quyền bộ phận, tự duyệt) — đúng tinh thần "test lại các lỗ hổng đã từng sửa" thay vì chỉ test tính năng mới.
- CORS whitelist cụ thể domain thay vì mở toàn bộ — đúng, xác nhận hiện tại `main.ts` đang gọi `app.enableCors()` không tham số (cho phép mọi origin), sửa là cần thiết.
- Có hẳn 1 tài liệu biên bản test restore riêng (`BIEN_BAN_TEST_RESTORE.md`) — đúng yêu cầu "lập biên bản kết quả" ở checklist gốc, không chỉ chạy thử cho có.
- Popup hướng dẫn riêng cho iOS Safari (khác luồng `beforeinstallprompt` của Android/Chrome) — đúng vì Safari không hỗ trợ event này, cần hướng dẫn thủ công qua nút Chia sẻ.

---

## Tổng kết

Dev có thể tiến hành phần lớn kế hoạch. Trước khi code, cần bổ sung phạm vi cho mục 1 (Web Push thật hoặc báo rõ dời sang sau), mục 2 (script backup đa nền tảng), và điều chỉnh mục 6 (rate-limit toàn cục) trước khi áp dụng vì có thể ảnh hưởng người dùng thật ngay khi deploy. Mục 3-5 có thể làm song song, không chặn code nhưng đừng để quên tới cuối mới nhớ ra.
