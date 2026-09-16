# Review Phase 1 — HVE App (Lần 1)

Ngày review: 15/09/2026
Đối chiếu với: [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md) §Phase 1 và [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md)
**Kết luận: Phần backend (state machine phê duyệt) làm rất tốt, chất lượng cao hơn mức kỳ vọng. Nhưng Phase 1 CHƯA ĐẠT vì thiếu toàn bộ phần frontend và 3 khoảng hở backend quan trọng liệt kê dưới đây — cần bổ sung trước khi coi là hoàn thành.**

---

## Đã xác minh thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm run build` (backend) | ✅ Pass |
| `npm run lint` (backend) | ✅ Sạch |
| `npm run test` (backend) | ✅ **32/32 test pass** (tăng từ 21 ở Phase 0) |
| `npm run build` (frontend) | Không cần kiểm tra thêm — chưa có code mới cho Phase 1 |

## 1. Điểm rất tốt trong phần đã làm (backend)

- **State machine đúng và đầy đủ**: `Nháp → Chờ duyệt → {Đã duyệt | Trả lại→Nháp | Từ chối}` implement chính xác theo quyết định đã chốt ở tài liệu kiến trúc §2.3 (trả lại chạy lại từ đầu luồng).
- **Chặn tự duyệt hồ sơ của chính mình** — đúng nguyên tắc kiểm soát nội bộ ở brief, có test riêng (`documents.service.spec.ts` — "Anti Self-Approval Rule").
- **Bắt buộc lý do khi trả lại/từ chối** — validate ở tầng service (`if (!dto.comment?.trim())`), không chỉ dựa vào DTO.
- **Optimistic locking bằng `version`** — đúng thiết kế đã chốt để chống duyệt trùng khi bấm 2 lần trên mobile, có test riêng cho race condition.
- **Snapshot workflow từ `WorkflowTemplate` khi gửi duyệt** — không tham chiếu sống tới template, đúng khuyến nghị kiến trúc để tránh vỡ hồ sơ đang chạy khi admin đổi cấu hình sau này.
- **Audit log ghi đủ** cho create/update/delete/submit/approve/return/reject, có `beforeJson`/`afterJson`.
- **Mã hồ sơ tự sinh đúng format** `DNTT-YYYY-NNN`, tăng dần theo năm.
- **Test coverage rất tốt**: 32 test bao phủ cả happy path, self-approval, sequential approval, return/reject bắt buộc lý do, optimistic locking.

## 2. Còn thiếu — cần bổ sung trước khi Phase 1 hoàn thành

### 2.1 Frontend — chưa bắt đầu (khoảng trống lớn nhất)
`hve-frontend/src/App.tsx` vẫn y nguyên bản demo tĩnh từ Phase 0 (dashboard giả với số liệu cứng `12/4/28`), chưa có:
- Form tạo/sửa đề nghị thanh toán
- Danh sách hồ sơ (tab "của tôi" / "cần duyệt") nối API `GET /documents?tab=...`
- Màn hình chi tiết hồ sơ với nút Duyệt/Trả lại/Từ chối theo đúng vai trò đang đăng nhập
- Modal bắt buộc nhập lý do khi Trả lại/Từ chối
- Xử lý double-submit (disable nút khi đang gọi API)

→ Đây là phần khiến HVE **nhìn thấy và bấm thử được** — không có phần này thì backend dù đúng cũng không demo được cho HVE. Cần làm trước khi báo Phase 1 hoàn thành.

### 2.2 Chứng từ chưa bắt buộc khi gửi duyệt
Brief mục 5 quy định rõ với Đề nghị thanh toán: *"Các trường nghiệp vụ và chứng từ phải được kiểm tra trước khi gửi duyệt."* Nhưng `submitForApproval()` ([documents.service.ts:208-212](hve-backend/src/documents/documents.service.ts)) chỉ validate `amount, receiver, bankName, bankAccount, content` — **không kiểm tra có ít nhất 1 chứng từ đính kèm hay chưa**. Cần thêm điều kiện chặn gửi duyệt khi `attachmentIds` rỗng.

### 2.3 Upload file chưa thật sự hoạt động — mới chỉ "đăng ký", chưa "tải lên"
`POST /attachments/register` ([attachments.controller.ts](hve-backend/src/attachments/attachments.controller.ts)) nhận sẵn `fileUrl` từ client và lưu vào DB — nhưng **không có endpoint nào sinh ra `fileUrl` đó**. Theo kiến trúc đã chốt (§5 tài liệu kiến trúc), luồng đúng phải là: client gọi API xin **pre-signed URL** → upload thẳng lên object storage bằng URL đó → sau đó mới gọi `register` để lưu metadata. Hiện tại thiếu bước đầu tiên, nghĩa là **chưa có nơi thật để file thực sự đi tới** — nếu không sửa, frontend sẽ không biết lấy `fileUrl` từ đâu để gửi lên.

Ngoài ra: quét mã độc (ClamAV, theo quyết định kiến trúc §5) hoàn toàn chưa có — có thể tạm hoãn sang cuối Phase 1 hoặc đầu Phase 2, nhưng cần ghi nhận là nợ kỹ thuật, không được quên.

### 2.4 Chưa có API tạo version mới cho hồ sơ đã duyệt
Checklist Phase 1 yêu cầu: *"API tạo version mới cho hồ sơ đã duyệt cần sửa (document version tăng, giữ bản cũ)"*. Hiện `updatePaymentRequest()` chỉ cho sửa khi `status === 'Nháp'` (đúng, chặn sửa hồ sơ đã duyệt) — nhưng chưa có endpoint thay thế nào để tạo bản ghi hồ sơ mới kế thừa từ bản đã duyệt. Có thể làm ở cuối Phase 1 hoặc đầu Phase 2 nếu ưu tiên thời gian, nhưng cần dev xác nhận kế hoạch thay vì bỏ sót.

## 3. Việc nhỏ, không chặn tiến độ

- `generateDocumentCode()` tính số thứ tự tiếp theo bằng cách đọc `findFirst` rồi cộng 1, không có lock/transaction bảo vệ — 2 người tạo hồ sơ cùng lúc trên lý thuyết có thể bị trùng mã (unique constraint sẽ chặn ở DB nhưng ném lỗi Prisma thô, không thân thiện). Rủi ro thấp ở quy mô 20-30 user, nhưng nên bọc bằng try/catch retry hoặc dùng sequence DB nếu có thời gian.
- Kiểm tra vai trò khi duyệt/trả lại/từ chối được làm thủ công trong `DocumentsService` (so `user.roles` với `step.roleRequired`) thay vì dùng `RolesGuard` có sẵn — đây là lựa chọn **đúng đắn**, không phải lỗi, vì vai trò yêu cầu thay đổi theo từng bước duyệt (động), không cố định theo route như `RolesGuard` xử lý. Không cần sửa.

---

## Việc cần làm tiếp theo (ưu tiên)

1. Bắt buộc chứng từ khi gửi duyệt (2.2) — sửa nhanh, nên làm ngay.
2. Bổ sung endpoint sinh pre-signed URL để upload file thật (2.3) — chặn frontend làm phần đính kèm.
3. Xây dựng frontend cho luồng Đề nghị thanh toán (2.1) — phần việc lớn nhất còn lại.
4. Endpoint tạo version mới cho hồ sơ đã duyệt (2.4) — có thể dời sang đầu Phase 2 nếu được xác nhận.
5. Sau khi có frontend, test thủ công toàn bộ vòng đời: tạo nháp → đính kèm chứng từ → gửi duyệt → 3 cấp duyệt → Đã duyệt, cộng 1 kịch bản trả lại và 1 kịch bản từ chối — đúng tiêu chí nghiệm thu Phase 1 trong kế hoạch triển khai.
