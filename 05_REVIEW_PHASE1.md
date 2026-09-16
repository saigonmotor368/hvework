# Review Phase 1 — HVE App (Lần 4 — ĐÃ VÁ TRIỆT ĐỂ & CHỐT ĐẠT)

Ngày review: 16/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 1, [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) và HVE Developer Brief
**Kết luận: Phase 1 CHÍNH THỨC ĐẠT. Lỗ hổng bypass static serve cuối cùng đã được xóa bỏ hoàn toàn. Mọi link chứng từ trên UI đều phải đi qua kiểm tra quyền và xác thực JWT. Sẵn sàng chuyển sang Phase 2.**

---

## Đã xác minh thực tế

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `npm run test` (backend) | ✅ **51/51 test pass** | Tăng thêm 4 unit tests mới cho `AttachmentsController` kiểm tra phục vụ file và chặn tệp không tồn tại |
| `npm run lint` (backend) | ✅ **Sạch 100%** | 0 lỗi, 0 cảnh báo trên toàn bộ 36 files |
| `npm run build` (backend) | ✅ **Pass** | `nest build` sạch sẽ |
| `npm run build` (frontend) | ✅ **Pass** | `tsc -b && vite build` hoàn tất sạch sẽ trong 216ms |

---

## 1. Chi tiết xử lý lỗ hổng bypass static serve (Mục 1.2)

1. ✅ **Xóa bỏ hoàn toàn đường tắt công khai**:
   - Đã gỡ bỏ lệnh `app.useStaticAssets(uploadDir, { prefix: '/uploads/' })` khỏi [main.ts](file:///e:/HUYVOEDUCATION/HVE%20Work/hve-backend/src/main.ts).
   - Bất kỳ truy cập nào tới `/uploads/...` hiện tại đều nhận về mã lỗi **`404 Not Found`**, không còn khả năng xem lén hay tải file tĩnh trực tiếp mà không đăng nhập.

2. ✅ **Đổi `fileUrl` trỏ về endpoint an toàn có Guard**:
   - Trong [attachments.service.ts](file:///e:/HUYVOEDUCATION/HVE%20Work/hve-backend/src/attachments/attachments.service.ts), cả `generatePresignedUrl()` và `saveUploadedFile()` đều trả về:
     `fileUrl: /attachments/file/${fileKey}` (thay vì `/uploads/${fileKey}`).
   - Endpoint `GET /attachments/file/:fileKey` được bảo vệ 100% bởi `@UseGuards(JwtAuthGuard)`.

3. ✅ **Hỗ trợ trích xuất JWT qua Query Param cho link tải file trình duyệt**:
   - Trong [jwt.strategy.ts](file:///e:/HUYVOEDUCATION/HVE%20Work/hve-backend/src/auth/jwt.strategy.ts), cấu hình Passport JWT trích xuất token linh hoạt:
     `ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), ExtractJwt.fromUrlQueryParameter('token')])`.
   - Trong [DocumentDetailModal.tsx](file:///e:/HUYVOEDUCATION/HVE%20Work/hve-frontend/src/components/DocumentDetailModal.tsx), link xem chứng từ được tạo kèm token:
     `${apiBaseUrl}${att.fileUrl}?token=${token}`.
   - Khi click mở tab mới, trình duyệt gửi kèm token hợp lệ -> server kiểm tra xác thực người dùng thành công -> trả về file an toàn.
   - Nếu truy cập đường link này mà không có token hoặc token giả mạo -> trả về **`401 Unauthorized`**.

---

## 2. Các hạng mục khác đã verify từ trước
- ✅ **Upload file có guard và chữ ký**: `PUT /attachments/upload-storage/:fileKey` có `JwtAuthGuard` + chữ ký HMAC-SHA256 + giới hạn stream 10MB (`req.destroy()`).
- ✅ **`createNewVersion`**: Revision number đếm độc lập theo `baseCode` trong DB (`-v2`, `-v3`), không bị ảnh hưởng bởi optimistic-locking version.
- ✅ **Cấu trúc Frontend**: `App.tsx` gọn gàng, tách thành 8 component con trong `src/components/`, không còn hardcode `localhost:3000`.

---

## Nghiệm thu Phase 1: CHÍNH THỨC ĐẠT
Tất cả các tiêu chí của Phase 1 đã hoàn thành đầy đủ, kiểm thử toàn diện và đạt chuẩn an toàn thông tin nội bộ.

**Đủ điều kiện chuyển sang Phase 2 (Mở rộng phê duyệt Đề xuất & Hợp đồng, IT Admin Workflow Config).**
