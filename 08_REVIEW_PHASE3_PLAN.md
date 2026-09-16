# Review kế hoạch Phase 3 (trước khi code)

Ngày review: 16/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 3, [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) §2.4, HVE Developer Brief mục 4

**Kết luận: Kế hoạch bám sát brief và tái dùng đúng pattern đã học được từ Phase 1-2. Có 2 điểm nên xử lý ngay từ đầu vì đã từng là bug thật ở các phase trước (double-submit, thiếu phân quyền theo bộ phận) — làm lại lỗi cũ ở module mới sẽ tốn công hơn sửa sau. Còn vài điểm cần chốt rõ trước khi code để tránh hiểu lầm giữa dev và HVE.**

---

## Điểm làm tốt

- Đúng state machine brief mục 4: `0%→Chưa làm, >0%→Đang làm, 100%→Chờ duyệt`, và chỉ người giao (`createdById`) mới chuyển `Chờ duyệt→Hoàn thành` — khớp chính xác nguyên tắc "người thực hiện không tự đóng việc".
- `is_overdue` tính runtime, không lưu cột tĩnh — đúng quyết định kiến trúc đã chốt.
- Audit log riêng cho thay đổi `assigneeId`/`dueDate` — đúng yêu cầu brief.
- Giới hạn việc con không lồng quá 2 cấp — ràng buộc kỹ thuật hợp lý, brief không cấm nhưng nên có để tránh đệ quy vô hạn ở UI cây việc con.
- Kế hoạch test khá đầy đủ, có cả kịch bản E2E thủ công lẫn unit test cho từng nhánh logic quan trọng.

## Cần xử lý ngay từ đầu — 2 điểm này đã từng là bug thật ở phase trước

### 1. Double-submit / gọi API 2 lần cho `confirmCompletion` — chưa thấy cơ chế chặn
`confirmCompletion()` vừa đổi trạng thái `Hoàn thành` **vừa** có side-effect tạo task kỳ mới nếu có `recurrenceRule`. Đây đúng dạng bug đã gặp ở Phase 1 (bấm duyệt 2 lần tạo 2 lần side-effect) — lúc đó phải thêm optimistic locking (`version`) trên `Document` mới chặn được. `Task` trong schema hiện **không có cột `version`** để làm optimistic lock, và kế hoạch cũng không nhắc tới việc chặn gọi trùng.

**Rủi ro cụ thể:** người giao việc bấm 2 lần (mạng chậm, hoặc double-click) → sinh **2 task kỳ mới trùng lặp** cho cùng 1 việc lặp lại.

**Đề xuất:** thêm guard đơn giản trong `confirmCompletion()` — kiểm tra `task.status !== 'Chờ duyệt'` thì chặn ngay từ đầu (`BadRequestException`) trước khi làm gì khác, tương tự cách `approveStep` chặn khi hồ sơ không còn ở `Chờ duyệt`. Không cần thêm cột `version` mới nếu chỉ cần chặn gọi trùng ở hành động 1 lần/1 task (khác với approve nhiều bước tuần tự của Document).

### 2. Tab "Việc bộ phận" — cần nói rõ logic lọc theo bộ phận
Phase 2 vừa mất 1 vòng review để phát hiện và sửa lỗi "trưởng bộ phận duyệt được hồ sơ phòng khác". Kế hoạch Phase 3 có tab "Việc bộ phận" nhưng **không nói rõ lọc theo bộ phận của ai** (người tạo? người thực hiện? người xem?). Nên chốt rõ trước khi code, ví dụ: *"Việc bộ phận" hiển thị các việc mà người thực hiện HOẶC người giao thuộc cùng bộ phận với người đang xem, chỉ hiện tab này cho vai trò `department_head`/`ceo`*. Nếu không chốt trước, dễ lặp lại kiểu lỗi "thấy/sửa được việc phòng khác" giống Phase 2.

## Cần chốt rõ trước khi code (tránh hiểu lầm, không phải bug)

### 3. Việc cha có việc con + tự cập nhật tiến độ trực tiếp — xung đột chưa được giải quyết
Kế hoạch: tiến độ cha = trung bình việc con. Nhưng nếu việc cha **cũng có `assigneeId` riêng** và người đó gọi `PATCH /tasks/:id/progress` trực tiếp trên việc cha đang có việc con, giá trị nhập tay sẽ bị ghi đè bởi lần tính trung bình tiếp theo (hoặc ngược lại) — gây khó hiểu cho người dùng ("tôi vừa sửa sao lại đổi lại"). Đề xuất: khi task đã có ≥1 việc con, **khoá field tiến độ nhập tay** (chỉ tính tự động từ con), disable input đó ở UI và trả lỗi rõ ràng nếu gọi API trực tiếp.

### 4. Việc lặp lại có việc con — kỳ mới có copy theo việc con không?
Kế hoạch không nói khi 1 task có cả `recurrenceRule` VÀ việc con, task kỳ mới sinh ra có copy luôn cây việc con hay chỉ sinh task cha trống. Đề xuất cho Phase 3 (đơn giản, đủ dùng): **chỉ cho phép `recurrenceRule` trên task KHÔNG có việc con** — validate chặn ở `createTask`/`updateTask` nếu cả 2 field cùng được set. Tránh phải thiết kế logic "nhân bản cây con" phức tạp không cần thiết ở MVP.

### 5. Tịnh tiến hạn hoàn thành của kỳ mới — tính từ đâu?
"+7 ngày" tính từ `dueDate` cũ hay từ ngày xác nhận hoàn thành thực tế? Nếu người giao xác nhận trễ 10 ngày so với hạn cũ, tính từ `dueDate` cũ sẽ ra kỳ mới **đã quá hạn ngay lúc sinh ra** — vô lý. Đề xuất: tính `dueDate cũ + interval`, nhưng nếu kết quả vẫn nhỏ hơn thời điểm hiện tại thì cộng thêm chu kỳ cho tới khi ra ngày tương lai gần nhất (round-forward). Nên ghi rõ quyết định này trong code/comment vì đây là loại quyết định "brief không nói rõ, dev tự chọn" giống các mục đã note ở tài liệu kiến trúc.

### 6. `updateTask` — ai được phép đổi người thực hiện/hạn hoàn thành?
Kế hoạch chưa nói rõ quyền gọi `PUT /tasks/:id`. Nên giới hạn: chỉ người giao (`createdById`) hoặc `department_head`/`ceo` được đổi `assigneeId`/`dueDate` — không nên để chính người thực hiện tự đổi hạn hoàn thành hoặc tự chuyển việc cho người khác (rủi ro tương tự nguyên tắc "không tự duyệt hồ sơ mình tạo", dù mức độ nhẹ hơn).

## Việc nhỏ, không chặn tiến độ

- `Notification.dedupeKey` là cột `@unique` trong schema — khi sinh notification cho mention trong bình luận, nhớ tạo `dedupeKey` duy nhất (vd hash theo `commentId + userId`), không để trống hoặc trùng giữa 2 lần mention khác nhau, sẽ vỡ do vi phạm unique constraint.
- Tính "+1 tháng" bằng `Date` của JS cần lưu ý ngày cuối tháng (task hạn 31/1 + 1 tháng → JS có thể ra 2-3/3 thay vì 28/2 hoặc 31/2 không hợp lệ). Nên viết helper riêng, không dùng phép cộng tháng ngây thơ.

---

## Tổng kết

Dev có thể tiến hành code theo kế hoạch. Ưu tiên xử lý mục 1 và 2 (đã từng là bug thật ở phase trước, nên phòng từ đầu). Mục 3-6 nên chốt cách xử lý trước khi viết code phần liên quan để không phải sửa lại giữa chừng, nhưng không cần dừng cả kế hoạch lại.
