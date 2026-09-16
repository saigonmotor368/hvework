# Review Phase 3 — HVE App (Nghiệm thu)

Ngày review: 16/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 3 và [08_REVIEW_PHASE3_PLAN.md](08_REVIEW_PHASE3_PLAN.md) (review kế hoạch trước khi code)
**Kết luận: Phase 3 ĐẠT. 5/6 điểm khuyến nghị xử lý đúng và verify được bằng code thật. Còn 1 khoảng hở nhỏ (không chặn nghiệm thu) nên vá trong đợt code kế tiếp.**

---

## Đã xác minh thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` (backend) | ✅ Pass |
| `npm run lint` (backend) | 🟡 **2 warning** (không phải lỗi): `NotFoundException` import thừa trong test, tham số `ip` không dùng trong 1 hàm — báo cáo dev ghi "0 lỗi" là đúng về mặt kỹ thuật (oxlint coi đây là warning) nhưng nên dọn cho sạch |
| `npm run test` (backend) | ✅ **92/92 test pass** — khớp claim |
| `npm run build` (frontend) | ✅ Pass |

## 1. Cả 2 điểm ưu tiên cao (double-submit, phân quyền bộ phận) — verify đúng

- ✅ `confirmCompletion()` chặn ngay đầu hàm bằng `if (task.status !== 'Chờ duyệt') throw BadRequestException` ([tasks.service.ts:455-459](hve-backend/src/tasks/tasks.service.ts)) — đúng vị trí, chặn trước khi có bất kỳ side-effect nào (sinh task lặp lại). Có test riêng cho case double-submit và case sai quyền.
- ✅ Tab "Việc bộ phận" lọc rõ theo `OR: [{assignee.departmentId}, {createdBy.departmentId}] === user.departmentId` ([tasks.service.ts:562-570](hve-backend/src/tasks/tasks.service.ts)) — đúng logic đã đề xuất chốt trước khi code, có test cả trường hợp user không có phòng ban (trả về rỗng, không lỗi).

## 2. 3 điểm cần chốt rõ trước khi code — verify đều đã xử lý

- ✅ **Khoá tiến độ nhập tay khi có việc con**: `updateProgress()` chặn ngay nếu `task.subTasks.length > 0` ([tasks.service.ts:346-350](hve-backend/src/tasks/tasks.service.ts)), tính trung bình cộng đúng qua `recalculateParentProgress()`.
- 🟡 **Việc lặp lại độc lập với việc con — chặn 1 chiều, còn hở chiều ngược lại**: `createTask()` chặn đúng 2 chiều tại thời điểm tạo (không cho tạo con nếu cha có `recurrenceRule`; không cho gán `recurrenceRule` khi tạo có `parentTaskId`). Nhưng `updateTask()` **không kiểm tra lại** — nếu 1 task đã có sẵn việc con, gọi `PUT /tasks/:id` với `recurrenceRule: 'weekly'` sẽ **được chấp nhận**, tạo ra đúng trạng thái đã quyết định phải cấm (cha có con + có lặp lại). Rủi ro thấp vì UI có thể không hiển thị ô này khi task đã có con, nhưng ở tầng API vẫn hở — nên thêm lại điều kiện `if (dto.recurrenceRule && task.subTasks.length > 0) throw BadRequestException(...)` trong `updateTask()`.
- ✅ **Tịnh tiến hạn hoàn thành round-forward**: `calculateNextDueDate()` cộng đúng 1 chu kỳ trước, sau đó lặp cộng thêm cho tới khi ≥ `now` ([tasks.service.ts:31-64](hve-backend/src/tasks/tasks.service.ts)) — đúng như đề xuất, có test riêng cho trường hợp dueDate cũ đã ở quá khứ xa.
- ✅ **Quyền đổi `assigneeId`/`dueDate`**: giới hạn đúng 3 nhóm — người tạo, CEO, hoặc trưởng bộ phận **cùng phòng với người tạo** ([tasks.service.ts:250-263](hve-backend/src/tasks/tasks.service.ts)), có ghi audit log kèm before/after.

## 3. 2 lưu ý kỹ thuật nhỏ — verify đều đúng
- ✅ `dedupeKey` mention luôn duy nhất (`task_mention_${comment.id}_${mentionedUserId}_${Date.now()}`) — không vi phạm unique constraint. (Ghi chú: cách này đảm bảo không vỡ DB, nhưng không phải dedup nghiệp vụ thật vì luôn khác nhau theo timestamp — chấp nhận được vì Phase 3 không yêu cầu chống gửi trùng mention, khác với yêu cầu "không gửi trùng thông báo" ở Phase 4 cho nhắc hạn.)
- ✅ `addMonthsSafe()` xử lý đúng tràn tháng (31/1 → 28/2, 31/3 → 30/4), có test riêng cho cả 2 case.

## 4. Rà thêm ngoài phạm vi đã review — không phát hiện vấn đề nghiêm trọng mới
- Giới hạn 2 cấp việc con: chặn đúng ở `createTask()` khi `parent.parentTaskId` đã tồn tại.
- `UpdateProgressDto` có `@Min(0) @Max(100)` — chặn giá trị ngoài khoảng ở tầng validation, không chỉ tin logic service.
- `TasksController` toàn bộ route đều có `JwtAuthGuard`.
- 1 điểm khác biệt nhỏ so với plan ban đầu: kế hoạch ghi `PATCH /tasks/:id/progress`, code thực tế dùng `PUT /tasks/:id/progress` — không sai, chỉ khác verb, không ảnh hưởng chức năng.

---

## Việc nên làm (không chặn nghiệm thu, nên vá sớm)

1. Thêm lại guard chặn `recurrenceRule` khi task đã có `subTasks` trong `updateTask()` (mục 2, khoảng hở 1 chiều).
2. Dọn 2 warning lint (import thừa, param không dùng).

Phase 3 đủ điều kiện coi là **đạt**, có thể tiếp tục Phase 4 (Thông báo, báo cáo, dashboard) theo [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md). 2 việc trên có thể làm gộp vào đợt code Phase 4 mà không cần dừng lại.
