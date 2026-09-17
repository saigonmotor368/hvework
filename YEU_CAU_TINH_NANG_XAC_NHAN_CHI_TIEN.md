> ## ⚠️ ĐÃ HỦY (bản gốc dưới đây) — THAY BẰNG THIẾT KẾ RÚT GỌN Ở CUỐI FILE
> **Ngày hủy:** 17/09/2026. Sếp tổng chốt: kế toán "Duyệt Chi Tiền" là một **bước duyệt thật** (có quyền từ chối) — đổi thứ tự bước Kế toán xuống sau CEO trong màn hình "⚙️ Cấu hình quy trình" có sẵn là đủ, CEO/IT Admin tự làm được, không cần code.
> Nhưng anh Định lưu ý thêm: **vẫn cần lưu chứng từ chi + thống kê số tiền đã chi cho kế toán/CEO tra cứu** — nên KHÔNG xóa sạch hoàn toàn, chỉ bỏ phần có lỗi bảo mật và làm gọn lại. Xem mục **"THIẾT KẾ RÚT GỌN (bản thay thế cuối cùng)"** ở cuối file này — đó mới là spec An cần làm, phần nội dung gốc bên dưới chỉ giữ lại để tham khảo bối cảnh, không code theo nữa.
>
> ---

# YÊU CẦU TÍNH NĂNG — Kế toán xác nhận "Đã chi tiền" (tách khỏi bước phê duyệt)

**Người giao việc:** anh Định (Chủ tịch)
**Người thực hiện:** An
**Người rà soát + deploy sau khi An xong:** Minh (theo đúng phân công đã thống nhất — An không tự deploy, báo cáo xong để Minh rà soát rồi đẩy lên GitHub/Railway/Vercel)
**Ngày giao:** 17/09/2026
**Độ ưu tiên:** Trung bình — không gấp bằng go-live, nhưng nên làm trong đợt tới vì ảnh hưởng đúng-sai số liệu báo cáo tài chính.

---

## 1. VẤN ĐỀ NGHIỆP VỤ (lý do làm tính năng này)

Anh Định phát hiện: hiện tại khi CEO phê duyệt xong 1 "Đề nghị thanh toán" (`payment_request`), hồ sơ chuyển thẳng sang trạng thái **`Đã duyệt`** và coi như hoàn tất — nhưng thực tế **tiền chưa chắc đã được chuyển**. Kế toán còn phải thực hiện việc chuyển khoản/chi tiền sau đó.

**Điểm mấu chốt cần phân biệt rõ:**
- **Phê duyệt (approval)** = có thẩm quyền đồng ý hoặc từ chối khoản chi → việc của CEO / người ký duyệt trong quy trình (`WorkflowTemplate`).
- **Xác nhận thực chi (execution confirmation)** = chỉ xác nhận "tôi đã chuyển tiền xong", **không có quyền từ chối khoản đã được duyệt** → việc của kế toán (role `accountant`).

Hiện hệ thống đang gộp 2 việc này làm một, dẫn tới báo cáo tài chính (`ReportsView` → tab "Tài chính & Hợp đồng") không phân biệt được đâu là khoản **đã duyệt nhưng chưa chi** (nghĩa vụ nợ phải trả) và đâu là khoản **đã chi thực tế** (tiền đã ra khỏi công ty).

---

## 2. YÊU CẦU CHỨC NĂNG

Chỉ áp dụng cho hồ sơ loại `payment_request` (Đề nghị thanh toán). Các loại `proposal` và `contract` giữ nguyên, không có bước này.

### Luồng trạng thái mới
```
Nháp → Chờ duyệt → Đã duyệt → Chờ chi tiền → Đã chi (hoàn tất)
                  ↘ Từ chối / Trả lại (như hiện tại, không đổi)
```

- Khi bước duyệt cuối cùng trong `WorkflowTemplate` được thông qua (giữ nguyên logic `approveStep`/`approveDirect` hiện có trong `documents.service.ts`), thay vì set `status = 'Đã duyệt'` là trạng thái cuối, đổi thành:
  - Nếu `docType === 'payment_request'` → set `status = 'Chờ chi tiền'` (KHÔNG phải `'Đã duyệt'`).
  - Các loại khác (`proposal`, `contract`) → giữ nguyên `status = 'Đã duyệt'` như cũ, không đổi gì.
- Thêm 1 action/endpoint mới, KHÔNG nằm trong `DocumentApprovalStep` (đây không phải bước duyệt trong quy trình, không cộng thêm bước vào `WorkflowTemplate`):
  - `POST /documents/:id/confirm-disbursement`
  - Chỉ role `accountant` (hoặc `ceo`/`it_admin` để dự phòng) được gọi — dùng `@Roles('accountant', 'ceo', 'it_admin')` + `RolesGuard` sẵn có.
  - Điều kiện: hồ sơ phải đang ở `status === 'Chờ chi tiền'`, nếu không → `BadRequestException('Hồ sơ chưa ở trạng thái chờ chi tiền')`.
  - **Bắt buộc đính kèm chứng từ** (ủy nhiệm chi / biên lai chuyển khoản) trước khi xác nhận — áp dụng logic kiểm tra attachment giống `submitForApproval` đã có (xem dòng ~488 `documents.service.ts`).
  - Cho phép nhập ghi chú tùy chọn (ví dụ số bút toán, ngày chuyển khoản thực tế).
  - Khi xác nhận thành công: set `status = 'Đã chi'`, ghi `AuditLog` (dùng pattern audit log đã có ở các action approve/reject khác), gửi `Notification` cho người tạo hồ sơ (`eventType: 'document_disbursed'`, theo đúng pattern các eventType hiện có như `document_approved`).

### Cập nhật Prisma schema
- `Document.status` vẫn là `String` tự do (không cần enum cứng) — chỉ cần bổ sung 2 giá trị mới vào comment cho rõ: `// Nháp, Chờ duyệt, Trả lại, Từ chối, Đã duyệt, Chờ chi tiền, Đã chi`.
- Không cần thêm bảng mới. Có thể tận dụng `Attachment` (entityType: 'document') cho chứng từ chi, và `Comment`/ghi chú trong `dataJson` cho ghi chú xác nhận chi (ví dụ thêm field `disbursedAt`, `disbursedById`, `disbursementNote` vào `dataJson` của `payment_request`, tương tự cách `contract` đang lưu `partner`, `value`... trong `dataJson`).
- **Không cần migration phá vỡ dữ liệu cũ** — các hồ sơ `payment_request` cũ đã có `status = 'Đã duyệt'` trước khi tính năng này ra đời vẫn giữ nguyên, coi như đã hoàn tất (không bắt hồi tố).

### Cập nhật Frontend
- `TaskDetailModal.tsx` / `DocumentDetailModal.tsx` (component hiển thị chi tiết hồ sơ): khi `status === 'Chờ chi tiền'` và người xem có role `accountant`, hiển thị nút **"💰 Xác nhận đã chi tiền"** mở modal yêu cầu đính kèm chứng từ + ghi chú (có thể tái dùng pattern của `ActionReasonModal.tsx`).
- Badge trạng thái: thêm màu riêng cho `Chờ chi tiền` (gợi ý: cam/amber, khác với `Chờ duyệt` đang dùng màu khác) và `Đã chi` (xanh lá đậm, phân biệt với `Đã duyệt`).
- `ReportsView.tsx` tab "Tài chính & Hợp đồng": tách rõ 2 chỉ số — "Đã duyệt, chờ chi" (tổng giá trị) và "Đã chi thực tế" (tổng giá trị) thay vì gộp chung vào `totalContractValue` như hiện tại. Áp dụng tương tự cho `reports.service.ts` (`getSummary`) — cộng thêm field `pendingDisbursement` và `actuallyDisbursed` trong response `documents`/`contracts` summary (lưu ý: mục "Tài chính" hiện đang lấy dữ liệu từ `documents.filter(d => d.type === 'contract')`, cần kiểm tra xem `payment_request` có cần đưa vào phần tài chính này không — nếu có, phải làm tương tự cho cả 2 loại hồ sơ).
- File xuất Excel (`reports.service.ts` → `exportXlsx`, Minh vừa làm xong hôm nay) cũng cần thêm cột "Đã chi" tương ứng khi An hoàn thành phần này — Minh sẽ tự cập nhật phần Excel khi rà soát, An không cần động vào file đó.

### Phân quyền (RBAC) — điểm quan trọng nhất, đúng như anh Định nói
- Role `accountant` **KHÔNG được thêm vào** `roleRequired` của bất kỳ bước nào trong `WorkflowTemplate` cho `payment_request` trừ khi công ty thực sự muốn kế toán có quyền phê duyệt (hiện tại theo mô tả của anh Định là KHÔNG).
- Endpoint `confirm-disbursement` phải là **action riêng biệt, không dùng chung logic với `approveStep`** — để tránh kế toán vô tình có được quyền từ chối/duyệt khoản chi thông qua nhầm lẫn code.
- Viết test (`documents.service.spec.ts`) xác nhận: (1) accountant không thể gọi `approve-step`/`approve-direct` cho payment_request nếu không nằm trong `WorkflowTemplate` hiện tại, (2) accountant KHÔNG thể xác nhận chi khi hồ sơ chưa ở trạng thái `Chờ chi tiền`, (3) role khác (employee, department_head...) không gọi được `confirm-disbursement`.

---

## 3. GHI CHÚ CHO AN

- Tham khảo pattern `approveStep`/`approveDirect` trong [documents.service.ts](hve-backend/src/documents/documents.service.ts) (dòng ~578, ~738) để viết `confirmDisbursement` theo đúng phong cách code hiện có (transaction, audit log, notification).
- Tham khảo `submitForApproval` (dòng ~461-512) cho phần validate attachment bắt buộc.
- Nhớ dùng tiếng Việt cho toàn bộ message lỗi/thông báo, đúng chuẩn đã rà soát trong phiên tối 16/09 (xem `NHAT_KY_CONG_VIEC.md`).
- Sau khi code xong, **không tự deploy** — báo cáo lại để Minh rà soát kỹ (test, build, kiểm tra RBAC) rồi mới đẩy lên Railway/Vercel, đúng quy tắc phân việc đã thống nhất với anh Định.
- Nếu có phần nào chưa rõ (ví dụ: `payment_request` có nên tính vào tab "Tài chính" cùng `contract` hay tách tab riêng), nên hỏi lại anh Định trước khi code để tránh làm sai hướng.

---

## THIẾT KẾ RÚT GỌN (bản thay thế cuối cùng — 17/09/2026)

**Người thực hiện:** Long (Phó phòng IT) — làm cùng đợt với `YEU_CAU_TINH_NANG_DU_AN.md`.
**Người rà soát + deploy sau khi Long xong:** Minh.

**Lý do đổi:** Bản gốc ở trên tạo hẳn 1 endpoint riêng `confirm-disbursement` cho phép client gửi `attachmentId` rồi backend tự gán (reassign) file đó vào hồ sơ — Minh rà soát phát hiện đây là lỗ hổng IDOR (ai đó có thể đoán ID file của hồ sơ/hợp đồng khác rồi "cướp" gán sang hồ sơ mình). Sau khi anh Định xác nhận kế toán sẽ **duyệt thật ở bước cuối** (không cần trạng thái `Chờ chi tiền`/`Đã chi` riêng), phần lưu chứng từ + thống kê chỉ cần tận dụng đúng cơ chế duyệt bước (`approveStep`) đã có sẵn và đã được test kỹ — không cần endpoint mới, không cần logic reassign nguy hiểm.

### Việc cần làm (rất nhỏ, không phải build lại từ đầu)

1. **Không tạo trạng thái mới.** `payment_request` vẫn chỉ có `Nháp → Chờ duyệt → Đã duyệt` (hoặc `Từ chối`/`Trả lại`) như nguyên bản ban đầu. Khi kế toán duyệt xong ở vị trí bước cuối (sau khi CEO/IT Admin đã đổi thứ tự trong "Cấu hình quy trình"), hồ sơ tự động chuyển `Đã duyệt` qua đúng logic `approveStep` hiện có — **không sửa gì ở đây cả**.

2. **Ghi chú kế toán:** đã có sẵn field `comment` trong `ActionStepDto` (`hve-backend/src/documents/dto/action-step.dto.ts`) — khi kế toán duyệt bước cuối, họ gõ ghi chú (VD: "Đã chuyển khoản UNC 88291 qua Vietcombank") vào đúng ô "Ý kiến" đang có sẵn trong `ActionReasonModal.tsx`. Ghi chú này đã được lưu vào `DocumentApprovalStep.comment` tự động — **không cần code thêm**, chỉ cần đảm bảo UI hiển thị placeholder gợi ý phù hợp khi bước đang duyệt có `roleRequired === 'accountant'` (đổi placeholder text trong `ActionReasonModal.tsx`, ví dụ: "Nhập số bút toán / ghi chú chuyển khoản...").

3. **Đính kèm chứng từ chi (PHẦN DUY NHẤT CẦN CODE THẬT):**
   - Cách làm AN TOÀN: khi kế toán đang ở màn hình duyệt bước cuối cho `payment_request`, cho phép họ **tải file chứng từ lên NGAY VỚI `entityType`/`entityId` đã gắn đúng vào hồ sơ đang xem** — giống hệt cách `CreateDocumentForm.tsx` đã làm khi tạo hồ sơ mới (xem cách `submitForApproval` kiểm tra `Attachment` theo `entityType: 'document', entityId: documentId` — file đã được gắn đúng chỗ *ngay từ lúc upload*, không cần bước "gán lại" nào sau đó).
   - Kiểm tra hàm `uploadAttachment` trong `hve-frontend/src/api/client.ts` (dòng ~116) — hiện tại nó **không** truyền `entityType`/`entityId` khi gọi `/attachments/presigned-url`. Cần thêm 2 tham số tùy chọn để hàm này có thể gọi kèm `entityType: 'document', entityId: doc.id` khi kế toán upload chứng từ ngay tại màn hình duyệt.
   - **Không thêm field `attachmentId` vào `ActionStepDto` để "reassign" — tuyệt đối không lặp lại lỗi cũ.** Chỉ cần: file đã tự động nằm đúng `entityId` từ lúc tạo, `DocumentDetailModal.tsx` (đã có sẵn phần hiển thị danh sách đính kèm của hồ sơ) sẽ tự hiển thị luôn, CEO/kế toán tra cứu lại sau này chỉ cần mở hồ sơ như bình thường — **không cần UI mới, không cần trường dữ liệu mới**.
   - (Tùy chọn, nên làm) Ở `documents.service.ts` → `approveStep`, khi `step.roleRequired === 'accountant'` và `doc.type === 'payment_request'`, có thể validate bắt buộc phải có ít nhất 1 `Attachment` (`entityType: 'document', entityId: documentId`) trước khi cho duyệt — tái dùng đúng pattern kiểm tra đã có ở `submitForApproval` (dòng ~488), tránh kế toán duyệt mà quên đính kèm chứng từ.

4. **Thống kê số tiền đã chi cho CEO/kế toán xem:** Sửa `reports.service.ts` → `getSummary()`, thêm tổng hợp cho `payment_request` tương tự cách đang làm cho `contract` (`totalContractValue`):
   ```ts
   const disbursedPayments = documents.filter(
     (d: any) => d.type === 'payment_request' && d.status === 'Đã duyệt',
   );
   const totalDisbursedValue = disbursedPayments.reduce(
     (sum: number, d: any) => sum + (Number((d.dataJson as any)?.amount) || 0),
     0,
   );
   ```
   Trả thêm `totalDisbursedValue`/`disbursedCount` trong response (đặt cạnh phần `contracts` hiện có, hoặc gộp chung 1 mục "Tài chính"). Hiển thị lên `ReportsView.tsx` tab "Tài chính & Hợp đồng" dạng thẻ số liệu giống các thẻ đang có. File xuất Excel (`exportXlsx`) Minh sẽ tự cập nhật thêm cột này khi rà soát — An không cần đụng vào phần Excel.

### Việc An KHÔNG cần làm nữa (so với bản gốc)
- ❌ Không tạo endpoint `POST /documents/:id/confirm-disbursement`.
- ❌ Không tạo `ConfirmDisbursementModal.tsx` riêng — dùng lại `ActionReasonModal.tsx` sẵn có.
- ❌ Không thêm trạng thái `Chờ chi tiền`/`Đã chi` vào schema.
- ❌ Không có logic reassign `attachmentId` từ client.

*File này để anh Định giao trực tiếp cho An. Khi An báo cáo xong, gọi Minh rà soát + deploy.*
