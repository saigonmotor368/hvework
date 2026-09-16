# Go-live HVE Work

Tài liệu này thay thế quy trình VPS/Docker Compose cũ. Kiến trúc production hiện tại là:

```text
Vercel frontend -> Railway backend -> Supabase PostgreSQL + Google Drive
```

Hướng dẫn vận hành và rollback chính thức: [14_HUONG_DAN_TRIEN_KHAI_PRODUCTION.md](14_HUONG_DAN_TRIEN_KHAI_PRODUCTION.md).

## Checklist go-live

- [ ] Commit phát hành đã qua review và working tree triển khai sạch.
- [ ] Backend lint, build và toàn bộ unit test pass.
- [ ] Frontend test, lint và build pass.
- [ ] Railway có đủ `<DATABASE_URL>`, `<JWT_SECRET>`, `<GOOGLE_SERVICE_ACCOUNT_JSON>`, `<GOOGLE_DRIVE_FOLDER_ID>` và các biến ứng dụng cần thiết.
- [ ] Vercel production có `VITE_API_URL=https://hve-work-backend-production.up.railway.app`.
- [ ] CORS cho phép `https://work.huyvoeducation.vn`.
- [ ] Railway deployment đạt `SUCCESS`; một replica tại Singapore; không gắn volume.
- [ ] Alias frontend trỏ đúng deployment mới và bundle dùng URL Railway.
- [ ] UAT bằng dữ liệu `TEST-*`: login, dashboard, hồ sơ, công việc, thông báo, upload/register/download.
- [ ] Dọn toàn bộ record, metadata và file thử sau UAT.
- [ ] Ghi deployment ID, commit SHA và mốc rollback vào nhật ký công việc.
- [ ] Theo dõi lỗi 5xx và độ trễ trong 30–60 phút.

## Quy tắc secret

Không điền secret thật vào tài liệu. Chỉ dùng placeholder:

```text
DATABASE_URL=<SUPABASE_DATABASE_URL>
JWT_SECRET=<GENERATE_RANDOM_SECRET>
GOOGLE_SERVICE_ACCOUNT_JSON=<SERVICE_ACCOUNT_JSON>
GOOGLE_DRIVE_FOLDER_ID=<DRIVE_FOLDER_ID>
SWAGGER_PASSWORD=<GENERATE_STRONG_PASSWORD>
```

Các chuỗi từng xuất hiện trong bản nháp go-live không trùng với secret local hoặc Railway production tại thời điểm kiểm tra 16/09/2026; không cần xoay khóa production vì thay đổi tài liệu này.
