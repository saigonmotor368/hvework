# Review kế hoạch Phase 4 (trước khi code)

Ngày review: 16/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 4, [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md), HVE Developer Brief mục 6-7

**Kết luận: Kế hoạch chi tiết, đúng hướng ở phần reminder/dashboard/report. Nhưng có 1 khoảng hở quan trọng cần bổ sung vào phạm vi trước khi code — thiếu đúng 2 trong 5 loại thông báo brief yêu cầu (loại thông báo "ngay lúc xảy ra", không phải loại "nhắc theo mốc thời gian"). Vài điểm khác cần chốt rõ hoặc bổ sung nhỏ.**

---

## Điểm quan trọng nhất — thiếu 2/5 loại thông báo tức thời của brief

Brief mục 7 quy định 5 loại sự kiện cần thông báo:

| Sự kiện | Người nhận | Loại |
|---|---|---|
| 1. Có hồ sơ cần duyệt | Người đang giữ bước duyệt | **Tức thời** (ngay khi hồ sơ chuyển sang chờ họ) |
| 2. Hồ sơ được duyệt/trả lại/từ chối | Người tạo và người liên quan | **Tức thời** |
| 3. Công việc sắp đến hạn | Người thực hiện | Theo mốc lịch (cron) |
| 4. Công việc quá hạn | Người thực hiện + leo thang | Theo mốc lịch (cron) |
| 5. Hợp đồng sắp hết hạn | Người phụ trách, pháp chế | Theo mốc lịch (cron) |

Kế hoạch Phase 4 mô tả kỹ phần **"Job quét mốc tự động"** (đúng cho sự kiện 3, 4, 5 — dựa trên lịch/offset ngày), nhưng **không đề cập việc bắn thông báo tức thời cho sự kiện 1 và 2** — loại này phải kích hoạt ngay tại thời điểm `submitForApproval`/`approveStep`/`returnStep`/`rejectStep` chạy, không phải chờ cron quét.

Đã kiểm tra thực tế: `documents.service.ts` (từ Phase 1 đến giờ) **chưa từng tạo `Notification` nào** ở bất kỳ hàm nào trong đó. Nếu Phase 4 chỉ làm đúng như mô tả kế hoạch (chỉ có cron job), 2 sự kiện quan trọng nhất trong brief — "có hồ sơ cần duyệt" và "hồ sơ được duyệt/trả lại/từ chối" — **sẽ không bao giờ thông báo được**, dù toàn bộ hạ tầng Notification/reminder khác chạy đúng.

**Cần bổ sung vào phạm vi Phase 4 (không phải lỗi kế hoạch, là thiếu phạm vi):**
- Thêm gọi tạo `Notification` (qua `NotificationChannel`/`InAppChannel`+`EmailChannel`) ngay trong `submitForApproval()` (báo người giữ step đầu tiên), `approveStep()` (báo người giữ step kế tiếp nếu còn, hoặc báo người tạo nếu đã "Đã duyệt"), `returnStep()` và `rejectStep()` (báo người tạo + lý do).
- Vì đây đụng vào `documents.service.ts` đã ổn định qua 3 phase review — nên thêm cẩn thận, không đổi logic state machine hiện có, chỉ chèn thêm lời gọi tạo notification vào cùng transaction đã có sẵn.

## Điểm cần bổ sung vào UI/API báo cáo — thiếu 2 bộ lọc brief yêu cầu rõ

Brief mục 6: *"Lọc theo khoảng thời gian, bộ phận, **người dùng**, trạng thái và **loại hồ sơ**."* Mô tả màn `ReportsView.tsx` trong kế hoạch chỉ nêu "thời gian, Bộ phận, Trạng thái" — thiếu bộ lọc theo **người dùng cụ thể** và **loại hồ sơ**. Nên bổ sung 2 filter này vào cả API `GET /reports/summary` và UI, tránh phải thêm sau khi HVE test UAT phát hiện thiếu.

## Cần chốt rõ trước khi code (default value, nên ghi lại quyết định)

- **Ngưỡng leo thang "quá hạn ≥3 ngày mới báo CEO"**: brief không quy định số ngày cụ thể, đây là lựa chọn hợp lý của dev nhưng nên ghi vào danh sách "mặc định cần HVE xác nhận" — giống các mục ngưỡng số ngày đã note ở tài liệu kiến trúc và Phase 2 (ví dụ ngưỡng hợp đồng sắp hết hạn 30 ngày).
- **Phân quyền xem tab "Nhật ký hệ thống"**: kế hoạch có mục "Kiểm soát phân quyền xuất" theo 4 nhóm vai trò, nhưng không nói rõ tab Audit Log trong `ReportsView.tsx` có giới hạn chỉ CEO/IT Admin xem được không. Nhật ký thao tác chứa `beforeJson`/`afterJson` khá chi tiết (có thể lộ dữ liệu nghiệp vụ của người khác) — nên giới hạn tab này chỉ hiện cho `ceo`/`it_admin`, không public cho toàn bộ vai trò như 3 tab báo cáo khác.
- **In-memory cache thay vì Redis**: tài liệu kiến trúc gốc ([01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) mục 1.1, 6) đã đề xuất dùng Redis cho cache dashboard (Redis đã có sẵn trong `docker-compose.yml` từ Phase 0, hiện chưa dùng tới). Dùng in-memory cho MVP không sai và đơn giản hơn, nhưng nên ghi lại đây là 1 lựa chọn triển khai khác kiến trúc gốc (không phải sai, chỉ khác), để không ai hỏi lại "sao có Redis mà không dùng".

## Điểm làm tốt, đáng ghi nhận

- CSV export tính sẵn "UTF-8 kèm BOM" — đúng vấn đề kinh điển khi mở CSV tiếng Việt trong Excel bị lỗi font, dev đã lường trước đúng chỗ hay sai nhiều dự án khác.
- Nguyên tắc "khối cần hành động ngay lên trước biểu đồ số liệu" đúng tinh thần wireframe brief mục 8.
- `dedupeKey` chuẩn hoá theo `entityType_entityId_offsetDays_dateString` — đúng thiết kế chống gửi trùng brief yêu cầu, khác với cách làm ở Phase 3 (mention dùng timestamp nên luôn unique) — ở đây đúng là cần dedup theo ngày, không phải theo lần gọi, thiết kế đúng bài toán.
- Interface `NotificationChannel` đa kênh, để sẵn `ZaloChannel` stub — đúng khuyến nghị kiến trúc mục 4.

---

## Tổng kết

Dev có thể tiến hành code theo kế hoạch, nhưng **bắt buộc bổ sung phần thông báo tức thời cho sự kiện duyệt/trả lại/từ chối** vào phạm vi Phase 4 trước khi code — đây không phải lỗi mà là thiếu 1 nhánh yêu cầu gốc của brief, nếu để sang Phase 5 mới phát hiện sẽ phải quay lại sửa `documents.service.ts` đã ổn định. Các điểm filter báo cáo và phân quyền xem nhật ký nên bổ sung cùng đợt vì chi phí thấp nếu làm ngay, tốn công hơn nếu để UAT phát hiện.
