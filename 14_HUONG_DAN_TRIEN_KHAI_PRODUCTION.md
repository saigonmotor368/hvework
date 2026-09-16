# Hướng dẫn triển khai Production — HVE Work

Cập nhật: 16/09/2026

## 1. Kiến trúc đang vận hành

| Thành phần | Nền tảng | Cấu hình chính |
|---|---|---|
| Frontend PWA | Vercel | `https://work.huyvoeducation.vn` |
| Backend API | Railway | `https://hve-work-backend-production.up.railway.app` |
| Database | Supabase PostgreSQL | Region Tokyo (`ap-northeast-1`) |
| Tệp đính kèm | Google Drive | Upload bằng URL ký, metadata lưu trong Supabase |

Backend chạy một replica tại Singapore. Không gắn Railway Volume vì tệp không lưu trên filesystem của container. Redis không được sử dụng.

Các hướng dẫn cũ về backend Vercel, VPS/Nginx, Railway Postgres và Railway Volume chỉ còn giá trị tham khảo, không được dùng để phát hành production hiện tại.

## 2. Nguyên tắc phát hành

- An viết và kiểm thử code; Long review rồi phát hành thủ công từ commit sạch.
- Chưa bật auto-deploy backend trực tiếp từ `main`.
- Không chạy migration database trong đợt cutover này.
- Production phải có `JWT_SECRET`; backend phải dừng an toàn nếu thiếu secret.
- Mock data chỉ được bật ở development với `VITE_ENABLE_MOCK_DATA=true`.
- Không ghi giá trị secret vào tài liệu hoặc Git. Dùng placeholder như `<JWT_SECRET>` và quản lý giá trị thật trên Railway/Vercel.

## 3. Phát hành backend Railway

Yêu cầu trước khi deploy:

```bash
cd hve-backend
npm run lint
npm test -- --runInBand
npm run build
```

Dockerfile dùng Node.js 22. Bước cài production dùng `npm ci --only=production --ignore-scripts`; Prisma Client đã được generate ở builder stage.

Railway production:

- Project: `09fc1acd-0893-44e9-bba5-f7e5cf81f59f`
- Environment: `f70ca10d-86bd-412b-aac6-eaac1e17a209`
- Service: `c3091f42-facb-4ba1-8914-eda84e3be2d9`
- Health endpoint: `/`
- Region/replica: Singapore, 1 replica

Sau khi upload source, phải theo dõi đúng deployment ID tới trạng thái `SUCCESS`; không coi lệnh upload thành công là deploy thành công.

## 4. Phát hành frontend Vercel

Yêu cầu trước khi deploy:

```bash
cd hve-frontend
npm test
npm run lint
npm run build
```

Biến production bắt buộc:

```text
VITE_API_URL=https://hve-work-backend-production.up.railway.app
VITE_ENABLE_MOCK_DATA=false
```

Deploy từ commit sạch. Sau deploy phải kiểm tra:

1. `work.huyvoeducation.vn` trỏ đúng deployment mới.
2. Bundle production chứa URL Railway, không chứa URL backend Vercel cũ.
3. Đăng nhập, dashboard, hồ sơ, công việc, thông báo và tải tệp đều hoạt động.

## 5. UAT production

- Chỉ dùng tài khoản test được cấp.
- Dữ liệu thử phải có tiền tố `TEST-`.
- Kiểm tra CORS từ `https://work.huyvoeducation.vn`.
- Kiểm tra login, `/auth/me`, dashboard, danh sách hồ sơ/công việc.
- Kiểm tra upload Google Drive, đăng ký attachment, tải xuống có JWT.
- Tạo, gửi và duyệt hồ sơ thử nếu đủ tài khoản theo workflow.
- Sau nghiệm thu, xóa record, attachment metadata và tệp Google Drive tương ứng.

## 6. Rollback

- Mốc frontend cutover Railway: Vercel deployment `dpl_36x5j4XrgiqE5J4xAVyNCbNFJzL7`.
- Nếu frontend bản sửa lỗi hỏng, rollback về mốc trên; mốc này vẫn gọi Railway.
- Nếu backend hỏng, redeploy Railway deployment thành công gần nhất.
- Không tự động quay lại backend Vercel cũ vì backend đó đã có hiện tượng timeout.
- Giữ project backend Vercel cũ trong 7 ngày để tham chiếu, không nhận traffic; chỉ tắt khi Railway ổn định và log không có lỗi nghiêm trọng.

## 7. Theo dõi sau phát hành

Theo dõi 30–60 phút: HTTP 5xx, thời gian phản hồi, lỗi CORS, lỗi xác thực, kết nối Supabase và Google Drive. Mục tiêu phản hồi warm median dưới 500 ms. Nếu xuất hiện lỗi nghiêm trọng, rollback trước rồi mới điều tra.
