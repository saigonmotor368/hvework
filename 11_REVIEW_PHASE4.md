# Review Phase 4 — HVE App (Nghiệm thu)

Ngày review: 16/09/2026
Đối chiếu với: [10_REVIEW_PHASE4_PLAN.md](10_REVIEW_PHASE4_PLAN.md) (review kế hoạch trước khi code)
**Kết luận: CHƯA ĐẠT. Backend không build được (48 lỗi TypeScript ở 2 module mới) — mâu thuẫn trực tiếp với báo cáo của dev. Về mặt logic nghiệp vụ (thông báo tức thời, dashboard, report filter, audit log guard), phần đã đọc được cho thấy hướng đi đúng, nhưng không thể xác nhận toàn diện vì code không compile.**

---

## Vấn đề nghiêm trọng nhất: `npm run build` thất bại — 48 lỗi

Chạy trực tiếp không dựa vào báo cáo:

```
npx tsc --noEmit -p tsconfig.build.json
→ 48 lỗi TypeScript, khu trú ở 2 module mới: dashboard/ (14 lỗi) và reports/ (34 lỗi)
```

Phân loại lỗi:

| Mã lỗi | Số lượng | Nguyên nhân |
|---|---|---|
| TS2307 (Cannot find module) | 14 | **Thiếu đuôi `.js` trong import tương đối** — đúng y nguyên bug đã sửa ở Phase 0 (project dùng ESM `nodenext`, bắt buộc import phải có `.js`). Cả `dashboard.controller.ts`, `dashboard.module.ts`, `dashboard.service.ts`, `reports.controller.ts`, `reports.module.ts`, `reports.service.ts` đều mắc lại lỗi này. |
| TS7006 (implicit any) | 33 | Tham số callback (`.map()`, `.filter()`) trong `reports.service.ts` và `dashboard.service.ts` không khai kiểu, vi phạm `strict: true` đã cấu hình từ đầu dự án. |
| TS1272 | 1 | `reports.controller.ts` import `Response` từ `express` không dùng `import type` — vi phạm `isolatedModules`/`emitDecoratorMetadata`, đúng loại lỗi mà `attachments.controller.ts` đã né đúng cách (`import type { Response } from 'express'`) nhưng file mới này không theo pattern đó. |

**Vì sao dev không phát hiện:** báo cáo dựa vào `npm run test` (105/105 pass) và `npm run lint` (0 lỗi) — nhưng `vitest` dùng transform esbuild, không type-check nghiêm ngặt và không quan tâm đuôi `.js` trong import; `oxlint` cũng không kiểm tra type hay module resolution. Chỉ `npm run build` (chạy `tsc` thật) mới bắt được — và đây là lệnh duy nhất trong checklist nghiệm thu mà báo cáo *nói đã pass* nhưng thực tế fail hoàn toàn.

**Hệ quả:** `nest start:prod` sẽ không chạy được, CI (`.github/workflows/ci.yml` có bước `npm run build`) sẽ đỏ nếu code này được push — nghĩa là chưa từng chạy CI thành công với code Phase 4, hoặc CI chưa được chạy.

**Bắt buộc sửa trước khi nghiệm thu tiếp:** thêm `.js` vào mọi import tương đối trong 6 file thuộc `dashboard/` và `reports/`, khai kiểu rõ cho toàn bộ callback trong `reports.service.ts`/`dashboard.service.ts`, và đổi `import { Response }` thành `import type { Response }` trong `reports.controller.ts`.

---

## Đã xác minh được (phần không phụ thuộc vào build)

| Kiểm tra | Kết quả |
|---|---|
| `npm run test` (backend) | ✅ 105/105 pass (nhưng không đại diện cho khả năng build/chạy thật, xem trên) |
| `npm run lint` (backend) | ✅ Sạch (nhưng oxlint không bắt được lỗi build ở trên) |
| `npm run build` (backend) | ❌ **FAIL — 48 lỗi** |
| `npm run build` (frontend) | ✅ Pass |

## Điểm quan trọng nhất từ review kế hoạch — thông báo tức thời khi duyệt hồ sơ

Đọc trực tiếp `documents.service.ts` xác nhận **đã bổ sung đúng như yêu cầu**: `submitForApproval` gọi `notificationsService.dispatchNotification` cho toàn bộ người giữ vai trò ở bước 1 (có tôn trọng phân quyền bộ phận cho `department_head`, dòng 76 lọc theo `deptHeads`), và có thêm dispatch tương tự ở `approveStep`/`returnStep`/`rejectStep` (dòng 703, 817, 930). Về mặt logic, đây đúng hướng đã yêu cầu ở [10_REVIEW_PHASE4_PLAN.md](10_REVIEW_PHASE4_PLAN.md). Toàn bộ dispatch được bọc `try/catch` để không chặn transaction chính nếu gửi thông báo lỗi — thiết kế hợp lý.

*Lưu ý:* không thể chạy thử thực tế (integration/e2e) để xác nhận hành vi runtime vì backend không build được — đánh giá trên chỉ dừng ở mức đọc code tĩnh.

## Chưa verify được do build fail

Không thể xác nhận bằng cách chạy thực tế các claim sau (đọc code tĩnh không đủ tin cậy vì file đang lỗi type, có thể còn lỗi logic ẩn phía sau các lỗi type chưa lộ ra):
- Cơ chế cache in-memory 60s và endpoint `/dashboard/clear-cache`.
- 5 bộ lọc report và chặn quyền xem audit log (`ceo`/`it_admin` mới xem được) — cần chạy thử thật với các vai trò khác nhau sau khi build được sửa.
- Cơ chế leo thang quá hạn 1 ngày/3 ngày.

---

## Việc cần làm ngay

1. **Bắt buộc**: sửa 48 lỗi build (chi tiết ở trên) — việc này thường mất dưới 30 phút vì đều là lỗi cú pháp/import, không phải lỗi thiết kế.
2. Sau khi build pass, chạy lại `npm run build` để xác nhận, rồi báo lại để review tiếp — cần verify runtime thật cho phần cache, filter report, và phân quyền audit log vì chưa kiểm chứng được ở vòng này.
3. Khuyến nghị: thêm bước `npm run build` (không chỉ `lint` + `test`) vào quy trình tự-kiểm-tra trước khi báo cáo "sẵn sàng" — 2/3 phase gần đây (Phase 0 và Phase 4) đều có lỗi build bị bỏ lọt vì chỉ chạy test/lint.
