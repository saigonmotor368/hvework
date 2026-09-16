# Review Phase 2 — HVE App (Nghiệm thu)

Ngày review: 16/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 2 và [06_REVIEW_PHASE2_PLAN.md](06_REVIEW_PHASE2_PLAN.md) (review kế hoạch trước khi code)
**Kết luận: Phase 2 ĐẠT. Cả 5 điểm khuyến nghị ở bước review kế hoạch đều được xử lý đúng, verify bằng code thật + test, không chỉ dựa vào tự báo cáo.**

---

## Đã xác minh thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` (backend) | ✅ Pass |
| `npm run lint` (backend) | ✅ Sạch |
| `npm run test` (backend) | ✅ **71/71 test pass** |
| `npm run build` (frontend) | ✅ Pass |

## 1. Điểm ưu tiên cao nhất — Phân quyền duyệt theo bộ phận — đã xử lý đúng

Đọc code xác nhận cả 3 hàm `approveStep`/`returnStep`/`rejectStep` ([documents.service.ts:570-579, 688-697, 788-...](hve-backend/src/documents/documents.service.ts)) đều thêm điều kiện: nếu `step.roleRequired === 'department_head'`, so `doc.createdBy.departmentId` với `user.departmentId`, khác phòng thì `ForbiddenException`. Đúng phương án A đã đề xuất.

Không chỉ chặn hành động — `findAll()` tab `to_review` ([documents.service.ts:856-877](hve-backend/src/documents/documents.service.ts)) cũng lọc luôn ở tầng hiển thị: trưởng bộ phận chỉ thấy hồ sơ cần duyệt của phòng mình, không thấy hồ sơ phòng khác dù không bấm duyệt được — kỹ hơn yêu cầu tối thiểu, đúng tinh thần "phạm vi dữ liệu" ở brief.

Test coverage: có cả case dương (duyệt cùng phòng thành công, `documents.service.spec.ts:308-339`) và case âm (duyệt chéo phòng bị chặn, `documents.service.spec.ts:341-358`) — đúng như khuyến nghị thêm test.

## 2. Validate cấu hình workflow khi IT admin sửa — đã làm đúng
`workflows.service.ts::updateTemplate` chặn: danh sách rỗng, `stepOrder` không liên tục/trùng lặp (so với thứ tự kỳ vọng sau khi sort), và `roleRequired` không khớp role có thật trong bảng `Role`. Đúng cả 3 ý đã khuyến nghị.

## 3. Chặn IT admin tự khoá tài khoản mình — đã làm đúng
`admin.service.ts::updateUserStatus` dòng đầu tiên: `if (targetUserId === currentUserId && dto.status === 'locked') throw new BadRequestException(...)`. Chính xác như đề xuất.

## 4. Ngưỡng "sắp hết hạn" hợp đồng — đã tham số hoá
`calculateContractExpiry(dataJson, offsetDays: number = 30)` — 30 ngày là default nhưng nhận tham số, không hardcode cứng trong logic gọi. Đủ tốt cho Phase 2; vẫn nên nhắc HVE xác nhận số ngày này ở tài liệu bàn giao cuối (không chặn nghiệm thu).

## 5. Quyền admin cho cả CEO — đúng như kế hoạch, đã note
Cả `AdminController` và `WorkflowsController` đều `@Roles('it_admin', 'ceo')` — khớp kế hoạch đã duyệt, không phát sinh gì mới.

## 6. Rà thêm ngoài 5 điểm khuyến nghị — không phát hiện vấn đề mới
- `submitForApproval` validate đúng theo từng loại hồ sơ: payment_request (đủ field + chứng từ), proposal (nội dung bắt buộc, chứng từ tuỳ chọn), contract (đủ field + `endDate >= startDate` + file hợp đồng bắt buộc) — khớp mô tả kế hoạch, không thiếu điều kiện nào.
- Seed đã có `WorkflowTemplate` cho cả `proposal` (Trưởng BP → CEO) và `contract` (Trưởng BP → Pháp chế → Kế toán → CEO).
- Frontend có đủ `AdminUserView.tsx`, `AdminWorkflowView.tsx`, không còn hardcode `localhost:3000` (dùng `import.meta.env.VITE_API_URL` với fallback hợp lệ).
- `updateUserRoles` validate `roleIds` tồn tại thật trong DB và `departmentId` tồn tại thật trước khi gán — chặn được thao tác nhập sai ID.

---

## Không có mục nào cần sửa bắt buộc trước khi nghiệm thu

Đề nghị dev tiếp tục Phase 3 (Quản lý công việc) theo [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md). Việc duy nhất cần nhớ: ghi lại ngưỡng 30 ngày cảnh báo hợp đồng vào danh sách "cần HVE xác nhận" trước khi bàn giao cuối, không cần chặn tiến độ ngay bây giờ.
