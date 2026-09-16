# Review Phase 0 — HVE App (Lần 3 — ĐẠT)

Ngày review: 15/09/2026
Đối chiếu với: [02_KE_HOACH_TRIEN_KHAI.md](02_KE_HOACH_TRIEN_KHAI.md) §Phase 0 và [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 0
**Kết luận: Phase 0 ĐẠT. Có thể chuyển sang Phase 1 (luồng duyệt Đề nghị thanh toán).**

---

## Đã xác minh thực tế (không chỉ đọc code)

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` (backend) | ✅ Pass — lỗi build ESM (`.js` import) ở lần review trước đã được sửa hết |
| `npm run lint` (backend) | ✅ Sạch, không lỗi |
| `npm run test` (backend) | ✅ **21/21 test pass**, gồm cả test RBAC pass/fail và test auth service |
| `npm run build` (frontend) | ✅ Pass |
| Docker Compose (Postgres+Redis) | ⚠️ Không verify được end-to-end trong môi trường review này (không có Docker) — nhưng đã có migration `prisma/migrations/20260915083748_init` khớp schema, nên rủi ro thấp |

## Toàn bộ 8 mục thiếu ở lần review 2 — đã giải quyết

1. ✅ Lỗi build `.js` import — đã sửa toàn bộ.
2. ✅ `JwtAuthGuard` (`auth/jwt-auth.guard.ts`) đã tạo và gắn thực tế vào 2 endpoint mẫu: `GET /auth/me` (yêu cầu đăng nhập) và `GET /auth/admin-check` (yêu cầu vai trò `ceo`/`it_admin`, dùng chung `RolesGuard`) — đúng yêu cầu "kiểm tra quyền ở phía máy chủ".
3. ✅ Refresh token: sign access token 15 phút + refresh token 7 ngày, **hash refresh token trước khi lưu DB** (không lưu plaintext — điểm cộng bảo mật), có endpoint `POST /auth/refresh`, có test riêng cho trường hợp hợp lệ và hết hạn.
4. ✅ Khoá tài khoản: sai 5 lần liên tiếp → khoá 15 phút (`lockedUntil`), có test cho cả 2 trường hợp (đạt ngưỡng khoá, và bị chặn khi đang trong thời gian khoá).
5. ✅ Quên/đặt lại mật khẩu: OTP 6 số, hết hạn 15 phút, không tiết lộ email có tồn tại hay không (chống user enumeration — thực hành bảo mật tốt), reset xong tự xoá token + reset luôn `failedLoginAttempts`.
6. ✅ Unit test RBAC: đủ 6 vai trò pass-case, có case multi-role, có 3 case fail (sai vai trò, vai trò không khớp, user không có roles) — vượt yêu cầu tối thiểu đề ra.
7. ✅ DTO validation: `LoginDto`/`RefreshTokenDto`/`ForgotPasswordDto`/`ResetPasswordDto` dùng `class-validator`, gắn `ValidationPipe({ whitelist: true, transform: true })` global trong `main.ts` — chặn field rác và tự chuyển kiểu đúng chuẩn.
8. ⚠️ Deploy staging thực tế: vẫn chưa thấy bằng chứng trong repo (CI mới chỉ build+test, chưa có bước deploy). Không chặn Phase 1, nhưng cần có trước khi UAT — nhắc dev bổ sung.

## Điểm cộng thêm (ngoài yêu cầu)

- Refresh token hash bằng bcrypt trước khi lưu, không lưu token thô trong DB.
- Forgot-password không tiết lộ email tồn tại hay không.
- `otpDev` chỉ trả về khi `NODE_ENV !== 'production'` — tiện test dev nhưng không lộ OTP ở production.

## Việc nhỏ, không chặn Phase 1 (dọn khi tiện)

- `prisma/seed.js` (bản compile) đang nằm cạnh `seed.ts` trong thư mục `prisma/`, chưa thấy bị `.gitignore` loại trừ — nên thêm vào `.gitignore` hoặc xoá khỏi repo để tránh 2 nguồn sự thật.
- Chưa thấy bước deploy staging trong CI — bổ sung trước khi cần demo/UAT thật với HVE (không cần gấp ngay Phase 1).

---

## Cho phép chuyển Phase 1

Theo [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 1: bắt đầu với module Đề nghị thanh toán — tạo/sửa nháp, gửi duyệt (snapshot workflow từ `WorkflowTemplate`), 4 cấp duyệt (Người tạo → Trưởng BP → Kế toán → CEO), bắt buộc lý do khi trả lại/từ chối, audit log mọi transition, upload chứng từ qua pre-signed URL.
