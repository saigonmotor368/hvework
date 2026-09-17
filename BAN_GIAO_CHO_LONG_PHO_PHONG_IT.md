# BÀN GIAO CÔNG VIỆC — HVE Work Backend Migration (Vercel → Railway)

**Người bàn giao:** Minh (AI assistant, Claude)
**Người nhận:** Long — Phó phòng IT
**Ngày:** 16/09/2026
**Lý do bàn giao:** Phiên làm việc gần hết context, cần người tiếp tục theo dõi và hoàn tất nốt các bước cuối của việc chuyển backend từ Vercel sang Railway.

---

## 1. BỐI CẢNH

Anh Định (Chủ tịch) yêu cầu chuyển backend HVE Work từ Vercel Serverless sang Railway (server chạy liên tục, ~5 USD/tháng) vì:
- Vercel serverless có độ trễ cao do cold-start + phải ghim vùng chạy (region) thủ công
- Gặp nhiều lỗi tương thích môi trường serverless (ERR_REQUIRE_ESM, TypeScript decorator resolution khác nhau giữa local và Vercel-Linux...)
- Railway chạy Docker bình thường như server truyền thống, ổn định và dễ debug hơn

**Quy tắc làm việc đã thống nhất với anh Định:** An (dev) viết code tính năng; Minh (AI) chỉ rà soát + deploy (GitHub/Supabase/Vercel/Railway), không tự viết tính năng mới để tiết kiệm context. Long tiếp nhận vai trò tương tự Minh: rà soát kỹ thuật + vận hành deploy.

---

## 2. TRẠNG THÁI HIỆN TẠI (đã xong)

### Railway backend — ĐÃ DEPLOY THÀNH CÔNG
- Project: `hve-work-backend` (ID: `09fc1acd-0893-44e9-bba5-f7e5cf81f59f`)
- Service: `hve-work-backend` (ID: `c3091f42-facb-4ba1-8914-eda84e3be2d9`)
- Domain public: **https://hve-work-backend-production.up.railway.app**
- Region: Southeast Asia / Singapore (`asia-southeast1-eqsg3a`) — đã sửa từ mặc định San Francisco
- Deploy status: `SUCCESS`, instance `RUNNING`
- Toàn bộ 14 biến môi trường đã set giống hệt bên Vercel (DATABASE_URL, JWT secrets, Google Drive service account, ALLOWED_ORIGINS gồm cả `work.huyvoeducation.vn` và `hve-work-frontend.vercel.app`, v.v.)
- Dockerfile (`hve-backend/Dockerfile`) đã sửa 2 lỗi build:
  1. `node:20-alpine` → `node:22-alpine`
  2. Thêm `--ignore-scripts` vào lệnh `npm ci --only=production` ở stage runner (tránh lỗi thiếu Prisma CLI khi chạy postinstall không cần thiết)

**Lưu ý về gói Railway:** log config báo `"Your plan can only deploy to a single region. Please upgrade to Pro to deploy to multiple regions."` — gói $5 hiện tại chỉ cho 1 region, ĐÃ ĐỦ DÙNG (không cần multi-region), không cần nâng cấp trừ khi có nhu cầu HA (high-availability) sau này.

### Các lỗi bảo mật/nghiệp vụ đã rà soát và fix trong buổi tối 16/09
(chi tiết đầy đủ xem file `NHAT_KY_CONG_VIEC.md` mục "PHIÊN RÀ SOÁT & KHẮC PHỤC SỰ CỐ SAU GO-LIVE")

1. **Nghiêm trọng — đã fix:** Backdoor mật khẩu trong `auth.service.ts` (An vô tình để lại code cho phép login bằng 2 mật khẩu mặc định bất kỳ tài khoản nào) → đã gỡ bỏ hoàn toàn, khôi phục so khớp bcrypt chuẩn.
2. **Nghiêm trọng — đã fix:** Tài khoản `tp_it@huyvoeducation.vn` (Trưởng phòng IT) bị gán nhầm quyền `it_admin` → đã thu hồi trực tiếp trên Supabase production + sửa `seed.ts` + gỡ đoạn code bypass hardcode email trong `Sidebar.tsx`.
3. Lỗi không đăng nhập được ở domain `work.huyvoeducation.vn` → do CORS callback throw Error thay vì reject sạch → đã fix trong `bootstrap.ts`.
4. Dropdown thông báo (NotificationBell) bị tràn màn hình mobile → đã fix responsive width.
5. Icon PWA không hiển thị khi cài trên iPhone (do dùng SVG, iOS Safari yêu cầu PNG cho apple-touch-icon) → đã tạo icon PNG thật, cập nhật manifest.
6. Thiếu thumbnail đẹp khi share link → đã thêm Open Graph/Twitter Card + ảnh `og-image.png`.
7. Nút "Cài đặt ứng dụng" bị mất khi gỡ cài lại → đã thêm nút cài đặt vào màn hình đăng nhập (trước đó chỉ có trong Sidebar sau khi đăng nhập).
8. Rà soát + chuẩn hoá tiếng Việt toàn ứng dụng (bỏ từ tiếng Anh lẫn, sửa ngữ pháp "không thể"→"không được", dịch thông báo lỗi RBAC).
9. Thay `@nestjs/throttler` (không tương thích Vercel serverless, gây crash `ERR_REQUIRE_ESM`) bằng bộ giới hạn tốc độ tự viết `SimpleThrottlerGuard` — đã test: 5 lần login sai qua, lần 6 trả về 429.
10. Ghim vùng chạy Vercel về Hồng Kông (`hkg1`) — bước đệm trước khi chuyển hẳn sang Railway.

---

## ĐÍNH CHÍNH — SO SÁNH TỐC ĐỘ RAILWAY vs VERCEL (đã đo lại đúng cách, 16/09)

**Lần đo đầu tiên của Minh bị SAI**: gọi vào route gốc `/` (không có handler xử lý trong NestJS) khiến Vercel bị treo tới 60s timeout, dẫn tới kết luận nhầm "Vercel backend đang chết". Sau khi Long đặt câu hỏi, Minh đo lại bằng route thật (`/notifications`) thì kết quả:

| | Railway (Singapore) | Vercel (hkg1 – Hồng Kông) |
|---|---|---|
| Lần 1 | 0.331s | 0.273s |
| Lần 2 | 0.216s | 0.236s |
| Lần 3 | 0.228s | 0.234s |

**→ Cả 2 bên tốc độ NGANG NHAU, không có khác biệt đáng kể.** Vercel backend vẫn đang chạy khỏe bình thường, KHÔNG hỏng như báo cáo trước đó của Minh.

**Vậy lý do nào để chuyển sang Railway (nếu vẫn muốn làm)?** Không phải vì tốc độ, mà vì các vấn đề vận hành đã gặp thực tế trong quá trình làm việc với Vercel serverless:
- Cold-start (lần gọi đầu sau khi "ngủ" sẽ chậm hơn các lần đo test liên tục ở trên)
- Từng gặp lỗi runtime `ERR_REQUIRE_ESM` và lỗi TypeScript decorator resolution chỉ xảy ra trên môi trường build của Vercel, không tái hiện được ở local — khó debug
- Phải tự ghim region (`regions: ["hkg1"]`) thủ công, dễ quên khi tạo project mới

Nếu Long/anh Định thấy các lý do trên chưa đủ thuyết phục để tốn thêm 5 USD/tháng, **hoàn toàn có thể giữ nguyên Vercel làm backend chính**, dùng Railway làm dự phòng/thử nghiệm. Đây là quyết định vận hành, không phải lỗi kỹ thuật bắt buộc phải chuyển.

**Nếu vẫn quyết định chuyển sang Railway**, lệnh chạy sẵn (thay đổi production, cần người có quyền tự chạy):
```bash
cd hve-frontend
vercel env rm VITE_API_URL production -y
vercel env add VITE_API_URL production
# Khi được hỏi nhập giá trị, dán: https://hve-work-backend-production.up.railway.app
vercel --prod
```
Sau khi chạy xong, test lại ngay trên `work.huyvoeducation.vn`: đăng nhập, xem danh sách công việc, thử phê duyệt 1 hồ sơ test.

---

## 3. VIỆC CẦN LONG LÀM TIẾP (theo thứ tự ưu tiên)

### Bước 1 — Xác minh Railway backend hoạt động đúng (ƯU TIÊN CAO)
```bash
curl -i https://hve-work-backend-production.up.railway.app/
```
Kiểm tra:
- Trả về đúng mã HTTP (không phải 500/502/504)
- Test thử đăng nhập thật (POST `/auth/login`) bằng 1 tài khoản test, xem có kết nối được Supabase DB không
- Kiểm tra Google Drive upload file đính kèm vẫn hoạt động (biến môi trường `GOOGLE_PRIVATE_KEY` dùng `--stdin` nên có rủi ro xuống dòng bị lỗi — cần test kỹ mục này)
- Xem log real-time nếu có lỗi: `railway logs --service hve-work-backend`

*(Tại thời điểm bàn giao, một lệnh đo latency đang chạy nền — có thể đã có kết quả, kiểm tra bằng `railway logs` hoặc test lại từ đầu cho chắc.)*

### Bước 2 — So sánh tốc độ Railway vs Vercel
```bash
# Railway (Singapore)
curl -s -o /dev/null -w "Time: %{time_total}s\n" https://hve-work-backend-production.up.railway.app/

# Vercel hiện tại (Hồng Kông)
curl -s -o /dev/null -w "Time: %{time_total}s\n" https://hve-work-backend-pink.vercel.app/
```
Chạy mỗi cái 3-5 lần lấy trung bình. Railway kỳ vọng nhanh hơn và ổn định hơn (không cold-start).

### Bước 3 — Nếu Railway ổn định và nhanh hơn: chuyển frontend sang trỏ Railway
Frontend đang deploy trên Vercel (`hve-work-frontend`), biến môi trường `VITE_API_URL` hiện trỏ về Vercel backend. Cần:
```bash
cd hve-frontend
vercel env rm VITE_API_URL production   # xoá giá trị cũ
vercel env add VITE_API_URL production  # nhập: https://hve-work-backend-production.up.railway.app
vercel --prod                            # redeploy frontend
```
Sau đó test lại toàn bộ flow trên `work.huyvoeducation.vn` (đăng nhập, tạo công việc, phê duyệt, đính kèm file...).

### Bước 4 — Quyết định số phận backend Vercel cũ
Sau khi Railway chạy ổn định ít nhất vài ngày, bàn với anh Định: tắt hẳn project Vercel backend (`hve-work-backend-pink`) hay giữ lại làm dự phòng. Nếu giữ, nhớ set biến môi trường tương tự để không bị lệch cấu hình.

### Việc phụ, không gấp
- Custom domain cho backend (ví dụ `api.huyvoeducation.vn` trỏ vào Railway) — anh Định có đề cập "sau này" làm, không gấp.
- Code-splitting frontend (React.lazy + Suspense cho AdminWorkflowView/AdminUserView để giảm bundle size) — đã giao việc này cho An trong `NHAT_KY_CONG_VIEC.md`, không cần Long làm, chỉ theo dõi An báo cáo.

---

## 4. LƯU Ý QUAN TRỌNG KHI VẬN HÀNH

- **Không tự ý sửa code tính năng của An** khi chưa xác nhận An đã làm xong/báo cáo — theo đúng quy tắc anh Định đã đặt ra.
- **Luôn rà soát kỹ code An viết trước khi deploy** — buổi tối nay đã phát hiện 2 lỗi nghiêm trọng (backdoor mật khẩu, gán nhầm quyền admin) mà An không tự báo cáo. Đừng tin 100% vào báo cáo "xong rồi" — kiểm tra bằng git diff thực tế.
- **File nhật ký công việc:** `NHAT_KY_CONG_VIEC.md` ở thư mục gốc — ghi lại toàn bộ lịch sử các phiên làm việc, nên đọc để nắm bối cảnh đầy đủ hơn.
- **Biến môi trường nhạy cảm** (DATABASE_URL, JWT secrets, Google service account key) hiện đã set trên cả Vercel và Railway — khi đổi 1 bên nhớ đồng bộ bên kia nếu còn giữ song song.
- **Git:** nhánh `main`, các commit gần nhất đã push lên GitHub đầy đủ. Còn vài file working-tree chưa commit ở thời điểm bàn giao (Dockerfile sửa lần cuối, vài file docker-compose/nginx cho môi trường khác) — Long kiểm tra `git status` trước khi làm gì thêm để không mất thay đổi.

Chúc Long triển khai thuận lợi. Có gì vướng cứ hỏi lại anh Định hoặc xem lại lịch sử chat trong Claude Code (project "HVE Work").
