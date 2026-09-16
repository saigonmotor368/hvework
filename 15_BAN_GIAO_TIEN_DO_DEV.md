# Bàn giao tiến độ — Hệ Thống Quản Lý Công Việc (HVE Work)

Cập nhật lần cuối: 2026-09-16, cuối phiên làm việc với trợ lý AI.
Mục đích file này: để dev tiếp theo (hoặc phiên AI tiếp theo) nắm được chính xác trạng thái hiện tại, không phải dò lại từ đầu.

## 1. Trạng thái go-live

**Đã go-live thành công trên Vercel, có dữ liệu thật (Supabase), test qua trình duyệt thật.**

- Frontend: https://hve-work-frontend.vercel.app
- Backend API: https://hve-work-backend-pink.vercel.app
- Repo GitHub: https://github.com/saigonmotor368/hvework (nhánh `main`, đã push đầy đủ tới commit đổi tên app)
- Vercel account: `saigonmotor368` (2 project: `hve-work-frontend`, `hve-work-backend.` — chú ý project backend có dấu chấm cuối tên trong Vercel do đặt tên tự động)
- Database: Supabase project `kgzaeevuookpkgrqbgsg` (region ap-northeast-1), đã chạy đủ 3 migration + seed user mẫu. **Chưa có hồ sơ nghiệp vụ thật nào** (documents = 0), sẵn sàng cho các phòng ban dùng thật.
- Lưu trữ file đính kèm: Google Drive Shared Drive của TPS1 Workspace (ID `0AIZCj63QxtxxUk9PVA`), qua Service Account `hve-work-drive-storage@sigma-outcome-327608.iam.gserviceaccount.com`. Đã test upload/download thật thành công.

## 2. Việc vừa hoàn thành trong phiên này (thứ tự thời gian)

1. Tính năng **mã PIN xác nhận duyệt CEO** (6 số, tự đặt, bật/tắt được, khoá tạm sau 5 lần sai) — áp dụng bước duyệt cuối cùng, xác định động theo cấu hình luồng.
2. Chuyển backend NestJS chạy được trên **Vercel Serverless Functions** (`hve-backend/api/index.js`) — phải import từ `dist/` đã biên dịch sẵn, không để Vercel tự transpile TypeScript lúc chạy (lỗi DI ngầm).
3. Chuyển lưu trữ file đính kèm từ ổ đĩa server sang **Google Drive Shared Drive** (bắt buộc vì serverless không lưu file lâu dài).
4. Đổi DB sang **Supabase** (Postgres), có `DIRECT_URL` riêng cho migration (pooler port 6543 không chạy DDL được).
5. Rà soát & sửa văn phong tiếng Việt toàn app (sửa 2 lỗi tiếng Anh 100% lộ ra cho người dùng, chuẩn hoá thuật ngữ).
6. Gỡ bỏ `@nestjs/throttler` (không tương thích Vercel serverless, lỗi `ERR_REQUIRE_ESM`), **tự viết rate-limit riêng** (`hve-backend/src/common/simple-throttler.guard.ts`).
7. Sửa lỗi thật: đăng nhập qua nút "Chuyển nhanh vai trò" không tự chuyển vào hệ thống (thiếu `setIsAuthenticated(true)`).
8. Đổi tên hiển thị ứng dụng: "HVE Work" / "Điều hành & Phê duyệt" → **"Hệ Thống Quản Lý Công Việc"**, đồng bộ toàn app (sidebar, trang đăng nhập, tab trình duyệt, PWA manifest).

Toàn bộ đã commit + push lên `main`, KHÔNG có commit nào còn treo local chưa push (kiểm tra lại bằng `git status` / `git log` trước khi làm tiếp để chắc chắn).

## 3. File KHÔNG được đụng vào (việc riêng của dev "An", chưa review)

Các file này vẫn nằm Untracked trên máy, **cố tình chưa commit**, không phải bị quên:

- `docker-compose.prod.yml`
- `hve-frontend/src/mockData.ts`
- `hve-frontend/nginx.conf`
- `hve-frontend/Dockerfile`
- `hve-frontend/public/logo.png`
- `HUONG_DAN_TRIEN_KHAI_GOLIVE.md`
- `scripts/capture_remaining.ps1`, `scripts/capture_screenshots.ps1`, `scripts/copy_logo.ps1`, `scripts/export_pdf.ps1`

Nếu dev An xác nhận các file này ổn, hãy review rồi tự commit riêng — đừng gộp chung với các thay đổi khác mà không kiểm tra.

## 4. Kiến trúc & quyết định kỹ thuật quan trọng cần biết

### 4.1. Backend trên Vercel — 3 cái bẫy đã gặp, đừng lặp lại
- **KHÔNG** để `api/index.*` là file `.ts` — TypeScript transpile trên Vercel (Linux) xử lý decorator metadata khác máy Windows local, gây lỗi DI ngầm khó hiểu ("Nest can't resolve dependencies"). Phải là `api/index.js` (JS thuần), import từ `dist/app.module.js` + `dist/bootstrap.js` đã biên dịch sẵn bằng `tsc`/`nest build`.
- **KHÔNG** dùng package NestJS nào chỉ hỗ trợ NestJS ≤11 nếu nó biên dịch ra CommonJS gọi `require()` thẳng `@nestjs/common` (NestJS 12 là ESM thuần) — sẽ lỗi `ERR_REQUIRE_ESM` khi chạy thật trên Vercel dù build/test local pass 100%. Đã gặp với `@nestjs/throttler`, đã gỡ bỏ.
- File `hve-backend/.npmrc` có `legacy-peer-deps=true` — bắt buộc phải có, nếu xoá sẽ lại lỗi ERESOLVE khi Vercel cài dependency.

### 4.2. Rate limiting hiện tại
`hve-backend/src/common/simple-throttler.guard.ts` — tự viết, lưu đếm trong bộ nhớ (`Map`), theo IP + route. **Giới hạn thật cần biết**: trên serverless có nhiều instance chạy song song, bộ đếm này KHÔNG dùng chung giữa các instance — chỉ là lớp bảo vệ cơ bản, không phải rate-limit phân tán chính xác 100%. Nếu sau này traffic lớn, cân nhắc chuyển sang Redis/Upstash.

### 4.3. Cron nhắc việc quá hạn
`GET /internal/cron/reminders` (bảo vệ bằng header `Authorization: Bearer $CRON_SECRET`), cấu hình trong `hve-backend/vercel.json` chạy **1 lần/ngày lúc 2h sáng** (theo yêu cầu anh Định, ưu tiên tiết kiệm chi phí — Vercel Cron Jobs gói Hobby chỉ cho 1 lần/ngày).

### 4.4. Backup dữ liệu
**Chưa có tự động** — anh Định chọn phương án nhờ backup thủ công (`pg_dump`) khi cần, thay vì tự động hoá. Nếu dev muốn tự động sau này, cần thêm cron + script riêng.

### 4.5. Email thật
`EmailChannel` (trong `hve-backend/src/notifications/channels/email.channel.ts`) hiện **chỉ là `console.log` stub**, chưa gửi email thật. Cần tích hợp dịch vụ email thật (Resend/SendGrid...) trước khi phụ thuộc vào kênh này cho thông báo quan trọng.

## 5. Biến môi trường đã cấu hình trên Vercel

Đã set trực tiếp qua Vercel CLI cho cả 2 project (xem `vercel env ls --project <tên>` để kiểm tra lại). Backend có 15 biến (DB, JWT, VAPID, Google Drive, CRON_SECRET, ALLOWED_ORIGINS...), frontend có 1 biến (`VITE_API_URL` trỏ về backend). Toàn bộ giá trị gốc (kể cả JWT_SECRET/SWAGGER_PASSWORD bản production) nằm trong `hve-backend/.env` cục bộ — **file này KHÔNG được commit** (đã gitignore), giữ riêng, không share công khai.

⚠️ **Lưu ý bảo mật**: `GOOGLE_PRIVATE_KEY` và các secret khác đã từng được dán trực tiếp trong chat với AI — nên cân nhắc xoay vòng (rotate) key này sau khi ổn định, đặc biệt nếu transcript chat từng được chia sẻ ra ngoài.

## 6. Việc còn lại / gợi ý bước tiếp theo

- [ ] Gắn subdomain riêng `work.huyvoeducation.vn` (hoặc `api.huyvoeducation.vn` cho backend) — làm qua Vercel Dashboard → Project Settings → Domains, không cần đổi code.
- [ ] Tích hợp email thật thay `console.log` stub.
- [ ] Cân nhắc backup tự động định kỳ (hiện là thủ công theo yêu cầu).
- [ ] Dev An review + commit các file riêng ở mục 3 nếu đã sẵn sàng.
- [ ] Theo dõi thực tế vài ngày đầu công ty dùng thật trước khi thông báo chính thức toàn công ty.
- [ ] Cân nhắc rotate `GOOGLE_PRIVATE_KEY` / `JWT_SECRET` production sau khi ổn định (đã từng gõ trực tiếp trong chat).

## 7. Cách xác minh nhanh hệ thống vẫn ổn (health check thủ công)

```bash
# Backend còn sống + kết nối DB đúng
curl -s https://hve-work-backend-pink.vercel.app/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"ceo@huyvoeducation.vn","password":"123456"}'

# Frontend còn đúng bản mới nhất
curl -s https://hve-work-frontend.vercel.app/ | grep -o '<title>[^<]*</title>'
```
Nếu backend trả lỗi 500 `FUNCTION_INVOCATION_FAILED`, xem log bằng:
```bash
vercel logs hve-work-backend-pink.vercel.app
```
