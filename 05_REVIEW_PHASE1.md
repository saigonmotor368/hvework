# Review Phase 1 — HVE App (Lần 3 — ĐÃ ĐẠT TOÀN DIỆN)

Ngày review: 16/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 1, [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) và HVE Developer Brief
**Kết luận: Phase 1 ĐÃ ĐẠT TOÀN DIỆN. Mọi lỗ hổng bảo mật, bug logic và các điểm nợ kỹ thuật chất lượng code đều đã được giải quyết triệt để. Đủ điều kiện nghiệm thu và bước sang Phase 2.**

---

## Đã xác minh thực tế

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `npm run test` (backend) | ✅ **47/47 test pass** | Tăng thêm 7 tests kiểm thử bảo mật upload, HMAC signature, size limit, path traversal, revision numbering |
| `npm run lint` (backend) | ✅ **Sạch 100%** | 0 lỗi, 0 cảnh báo (oxlint 35 files) |
| `npm run build` (backend) | ✅ **Pass** | NestJS build thành công không có cảnh báo ESM |
| `npm run build` (frontend) | ✅ **Pass** | TypeScript typecheck sạch, Vite build thành công trong 170ms |

---

## 1. Toàn bộ các vấn đề ở Lần 2 đã được khắc phục triệt để

### 1.1 Vá lỗ hổng bảo mật upload file (Mục 2.1 — BẮT BUỘC)
- ✅ **Bắt buộc xác thực**: Đã thêm `@UseGuards(JwtAuthGuard)` vào `PUT /attachments/upload-storage/:fileKey`. Chặn hoàn toàn người dùng ẩn danh/chưa đăng nhập.
- ✅ **Chữ ký Pre-signed URL bằng HMAC SHA-256**: Endpoint `POST /attachments/presigned-url` sinh token HMAC ràng buộc `fileKey`, `userId`, `expiresAt` (15 phút). Khi `PUT` ghi file, hệ thống xác thực chữ ký và kiểm tra hạn dùng, chống giả mạo hoặc gọi tắt.
- ✅ **Chống DoS ổ đĩa & bộ nhớ**: Lắng nghe stream data, nếu kích thước luồng vượt 10MB sẽ lập tức gọi `req.destroy()`, ngắt kết nối ngay lập tức trước khi kịp tốn RAM/disk.
- ✅ **Validate đa tầng**: Kiểm tra kích thước buffer, whitelist extension (`.pdf, .docx, .xlsx, .jpg, .png, .webp`) và chống path traversal bằng `path.basename(fileKey)`.

### 1.2 Cấu hình tải xuống & xem chứng từ (Mục 2.2 — BẮT BUỘC)
- ✅ **Serve Static Assets**: Trong `main.ts`, cấu hình `app.useStaticAssets(uploadDir, { prefix: '/uploads/' })` thông qua `NestExpressApplication`. Frontend xem chứng từ không còn bị 404.
- ✅ **Endpoint tải file có bảo mật**: Bổ sung endpoint `GET /attachments/file/:fileKey` có guard xác thực.

### 1.3 Sửa bug logic `createNewVersion` (Mục 3)
- ✅ **Tách độc lập Revision Number với Optimistic-locking Version**:
  - Không còn dùng `doc.version + 1` để đặt mã.
  - Hệ thống truy vấn DB đếm các bản ghi có cùng `baseCode` để tính số hiệu bản sửa đổi thực tế (`-v2`, `-v3`...).
  - Đã có unit test mô phỏng thực tế với hồ sơ có `version: 6` (sau khi đi qua 4 cấp duyệt) -> tạo bản sửa đổi đầu tiên sinh đúng mã `DNTT-2026-001-v2` và `version` khoá lạc quan của bản nháp mới khởi tạo lại từ `1`.

### 1.4 Dọn dẹp chất lượng & Nợ kỹ thuật (Mục 4)
- ✅ **Module hóa Frontend**: `App.tsx` (từng có 1471 dòng) đã được tách thành các component chuyên trách trong `src/components/` (`LoginPage`, `Sidebar`, `OverviewDashboard`, `DocumentList`, `DocumentDetailModal`, `CreateDocumentForm`, `ActionReasonModal`, `Toast`) và `src/types.ts`.
- ✅ **Xóa bỏ hardcode `localhost:3000`**: Toàn bộ 13 vị trí hardcode API URL trên frontend đã được thay thế bằng biến môi trường `import.meta.env.VITE_API_URL` (fallback `http://localhost:3000`). Đã tạo sẵn `.env.example` cho cả backend và frontend.
- ✅ **Bổ sung `.gitignore`**: Cả root `.gitignore` và `hve-backend/.gitignore` đều đã loại trừ `uploads/` và `*.db` để tránh commit dữ liệu người dùng lên git.

---

## Nghiệm thu Phase 1: ĐẠT TOÀN DIỆN
Hệ sinh thái cốt lõi của Đề nghị thanh toán (quy trình 4 cấp, state machine, anti self-approval, reason enforcement, optimistic locking, file attachment, revisioning, UI dashboard + list + detail + create) đã hoàn thiện và đạt tiêu chuẩn an toàn dữ liệu.

Sẵn sàng chuyển sang **Phase 2 — Mở rộng phê duyệt (Đề xuất & Hợp đồng)**.
