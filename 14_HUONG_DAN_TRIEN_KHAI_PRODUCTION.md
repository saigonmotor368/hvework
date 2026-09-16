# Hướng dẫn triển khai Production — HVE Work

Ngày viết: 16/09/2026
Bối cảnh: An đề xuất triển khai lên VPS tự quản lý (nhiều bước cấu hình thủ công). Tài liệu này phân tích lại và đề xuất phương án đơn giản hơn, tận dụng đúng hạ tầng managed platform (giống cách `huyvoeducation.vn` đang chạy trên Vercel), không cần tự quản trị server.

---

## 1. Vì sao KHÔNG nên dùng VPS tự quản lý

VPS nghĩa là HVE tự chịu trách nhiệm: cài Docker, cấu hình Nginx reverse proxy, xin & gia hạn SSL, dựng firewall, patch OS định kỳ, tự lo backup hạ tầng (không phải backup DB) — khối lượng vận hành lớn cho 1 người IT kiêm nhiệm. Đây đúng là điều An đang ngại, và ngại đúng.

## 2. Vì sao KHÔNG thể đẩy backend lên Vercel như trang chủ

`huyvoeducation.vn` là site tĩnh — hợp với Vercel (serverless, không trạng thái). `hve-backend` thì khác hẳn:
- Lưu file đính kèm trực tiếp lên đĩa (`uploads/`) — hàm serverless của Vercel không có ổ đĩa bền vững giữa các lần gọi, file sẽ mất.
- Cần kết nối liên tục tới PostgreSQL, không phù hợp mô hình function chạy xong là tắt.

→ Backend cần một nơi chạy **liên tục, có ổ đĩa bền vững** — nhưng không nhất thiết phải là VPS tự quản lý.

## 3. Phương án đề xuất: Managed PaaS — không phải VPS, cũng không phải Vercel cho backend

| Thành phần | Nơi chạy | Vì sao |
|---|---|---|
| `huyvoeducation.vn` (trang chủ) | **Giữ nguyên trên Vercel** | Không đụng vào, đang chạy tốt |
| `hve-frontend` (PWA) | **Vercel — project mới** | Tĩnh, đúng sở trường Vercel, quy trình y hệt trang chủ (push GitHub → tự deploy) |
| `hve-backend` (API) | **Railway** | Nhận Docker trực tiếp từ GitHub, có Postgres quản lý sẵn (backup tự động), có ổ đĩa bền vững (Volume), không cần biết Nginx/SSL/systemd là gì |
| Database | **Railway Postgres add-on** | 1 click thêm vào project, tự cấp `DATABASE_URL`, tự backup |
| Redis | **Bỏ hẳn, không cần** | Đã kiểm tra code thật: không có chỗ nào trong `hve-backend` thực sự dùng Redis — `docker-compose.yml` khai báo nhưng chưa từng được kết nối tới. Không tốn tiền cho thứ không dùng. |

Đây chính là mô hình PaaS (Platform-as-a-Service) — vẫn "push code lên là chạy" như Vercel, nhưng hỗ trợ ứng dụng có trạng thái (stateful) mà Vercel không làm được. Không phải VPS.

## 4. Một lỗ hổng vận hành cần vá trước khi go-live: nhắc hạn không tự chạy

Kiểm tra code thật phát hiện: hàm gửi thông báo nhắc hạn (`triggerScheduledReminders`) **chỉ chạy khi có ai đó gọi API `POST /notifications/trigger-reminders`** — không có cơ chế tự động (không cron, không lịch nền) đứng sau nó. Nghĩa là nếu deploy nguyên trạng, tính năng "nhắc hạn hồ sơ/công việc/hợp đồng" đã review kỹ ở Phase 4 sẽ **không bao giờ tự chạy trong thực tế**.

**Cần chọn 1 trong 2 trước khi go-live:**
- **Cách A (khuyến nghị — không phụ thuộc nền tảng):** nhờ An thêm `@nestjs/schedule` vào backend, đặt `@Cron('0 * * * *')` (mỗi giờ) gọi thẳng hàm `triggerScheduledReminders()` trong tiến trình backend. Khoảng 15 phút code, không cần cấu hình gì thêm ở Railway.
- **Cách B:** dùng tính năng Cron Job có sẵn của Railway để tự gọi API endpoint đó mỗi giờ. Không cần sửa code nhưng phụ thuộc cấu hình ở nền tảng, dễ quên nếu sau này đổi nền tảng.

---

## 5. Các bước triển khai chi tiết

### Bước 0 — Đưa code lên GitHub (repo hiện tại chưa có remote)
```bash
# Tạo repo rỗng trên github.com trước (vd: huyvoeducation/hve-work), sau đó:
git remote add origin https://github.com/<org>/hve-work.git
git push -u origin main
```

### Bước 1 — Backend trên Railway
1. Vào railway.app → đăng nhập bằng GitHub → **New Project** → **Deploy from GitHub repo** → chọn repo vừa tạo.
2. Vì repo có 2 thư mục (`hve-backend`, `hve-frontend`), vào **Settings** của service vừa tạo → **Root Directory** → nhập `hve-backend`. Railway sẽ tự nhận diện `Dockerfile` có sẵn và build đúng theo đó — không cần viết gì thêm.
3. Trong project, bấm **+ New** → **Database** → **Add PostgreSQL**. Railway tự tạo biến `DATABASE_URL` và có thể tham chiếu thẳng vào service backend.
4. Vào service backend → **Variables**, thêm đầy đủ theo `.env.example`:
   - `DATABASE_URL` → chọn "Reference" tới biến của Postgres add-on (không gõ tay)
   - `JWT_SECRET` → tạo bằng `openssl rand -base64 48`, dán vào
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` → chạy `npx web-push generate-vapid-keys` trên máy, dán 2 giá trị vào
   - `VAPID_SUBJECT` → `mailto:admin@huyvoeducation.vn`
   - `SWAGGER_USER`, `SWAGGER_PASSWORD` → tự đặt
   - `ALLOWED_ORIGINS` → tạm để trống, quay lại điền sau khi có domain frontend ở Bước 3
   - `NODE_ENV` → `production`
   - `PORT` → `3000` (Railway tự map cổng ngoài, không cần đổi)
5. Vào **Settings → Volumes** → thêm 1 volume, mount vào đường dẫn `/app/uploads` (đúng thư mục Dockerfile đã tạo sẵn) — đảm bảo file đính kèm không mất khi Railway redeploy.
6. Bấm **Deploy**. Sau khi chạy lần đầu, vào tab **Shell** (hoặc dùng Railway CLI) của service, chạy lần lượt:
   ```bash
   npx prisma migrate deploy
   node dist/prisma/seed.js   # hoặc lệnh seed tương ứng An đang dùng
   ```
7. Chạy script vá quyền DB (`scripts/db_security_hardening.sql`) nhắm vào đúng Postgres của Railway — dùng thông tin kết nối Railway cấp (Railway có nút "Connect" hiện sẵn lệnh `psql`):
   ```bash
   psql "<connection string Railway cấp>" -v APP_PASS="<mật khẩu mới tự đặt>" -f scripts/db_security_hardening.sql
   ```
   Sau đó đổi `DATABASE_URL` ở Bước 4 sang dùng user `hve_app_user` vừa tạo (quyền hạn chế) thay vì user gốc Railway cấp — đúng nguyên tắc least-privilege đã làm ở Phase 5.
8. Ghi lại URL Railway cấp cho backend (dạng `https://hve-backend-production.up.railway.app`) — dùng ở Bước 2.

### Bước 2 — Frontend trên Vercel
1. Vercel → **Add New Project** → import cùng repo GitHub.
2. **Root Directory** → `hve-frontend`. Vercel tự nhận đây là dự án Vite, tự điền build command (`npm run build`) và output (`dist`).
3. **Environment Variables** → thêm `VITE_API_URL` = URL backend lấy ở Bước 1.8.
4. Deploy. Sau khi chạy được, vào **Settings → Domains**, thêm `work.huyvoeducation.vn` — Vercel cho hướng dẫn cụ thể loại bản ghi CNAME cần thêm ở nơi quản lý domain `huyvoeducation.vn` (chỗ đang trỏ DNS cho trang chủ hiện tại).

### Bước 3 — Nối lại 2 đầu
1. Quay lại Railway → sửa biến `ALLOWED_ORIGINS` = `https://work.huyvoeducation.vn` (đúng domain frontend vừa gắn).
2. Redeploy backend để áp dụng.

### Bước 4 — Kiểm tra trước khi thông báo go-live
- Đăng nhập thử bằng tài khoản seed, kiểm tra tạo/duyệt 1 hồ sơ, upload file thật, xem báo cáo.
- Xác nhận `GET /api/docs` (Swagger) hỏi mật khẩu Basic Auth đúng như đã cấu hình.
- Xác nhận đã làm xong mục 4 (nhắc hạn tự chạy) — không bỏ sót.
- Thử `psql` bằng user `hve_app_user` chạy `DELETE FROM "AuditLog"` phải bị từ chối quyền — xác nhận hardening có hiệu lực thật trên Postgres production, không chỉ trên máy dev.

---

## 6. Chi phí tham khảo (quy mô 20-30 người dùng)

- Railway: gói Hobby/Starter ~5 USD/tháng + phí theo usage thực tế (CPU/RAM/Postgres storage) — quy mô này thường rơi vào khoảng 10-20 USD/tháng.
- Vercel: gói Hobby miễn phí đủ dùng cho 1 SPA nội bộ lưu lượng thấp; nếu cần domain riêng ổn định lâu dài có thể cân nhắc gói Pro sau.
- Không phát sinh chi phí VPS, không cần thuê ai quản trị server riêng.

## 7. Nếu sau này cần mở rộng

Khi vượt quy mô hiện tại (nhiều phòng ban hơn, tải cao hơn), có thể cân nhắc chuyển file đính kèm từ Volume sang object storage thật (Cloudflare R2 — rẻ, tương thích S3) theo đúng định hướng ban đầu ở tài liệu kiến trúc — không bắt buộc ngay bây giờ, chỉ là hướng nâng cấp khi cần.
