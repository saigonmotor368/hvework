# Review kế hoạch Phase 2 (trước khi code)

Ngày review: 16/09/2026
Nguồn: nội dung `implementation_plan.md` dev gửi qua chat (không thấy file trên đĩa — lưu ý nhắc dev commit/lưu file này vào `HVE Work` để lần sau review trực tiếp được).

**Kết luận: Kế hoạch tốt, đúng hướng, tái sử dụng Core Engine hợp lý. Có 1 khoảng hở quan trọng cần quyết định trước khi code (phân quyền theo bộ phận), và vài điểm nhỏ nên bổ sung vào lúc code để đỡ phải sửa lại sau.**

---

## Điểm làm tốt trong kế hoạch

- Đúng số cấp duyệt cho cả 3 loại theo brief (payment_request 3 bước duyệt + người tạo, proposal 2 bước duyệt + người tạo, contract 4 bước duyệt + người tạo).
- Tái dùng 100% Core Engine (`submitForApproval/approveStep/returnStep/rejectStep/createNewVersion`, optimistic locking, audit log) thay vì viết riêng cho từng loại — đúng khuyến nghị ở [02_KE_HOACH_TRIEN_KHAI.md](02_KE_HOACH_TRIEN_KHAI.md) §Phase 2 ("không copy-paste logic 3 lần").
- Validate bắt buộc theo từng loại hồ sơ (chứng từ cho payment, file hợp đồng cho contract) — đúng pattern đã sửa ở Phase 1 review, mở rộng hợp lý sang loại mới.
- `WorkflowTemplate` chỉnh được qua UI nhưng vẫn snapshot vào `DocumentApprovalStep` lúc submit (đã có sẵn từ Phase 1) — đúng nguyên tắc "đổi cấu hình không phá hồ sơ đang chạy dở" ở [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) §8.
- `AdminModule`/`WorkflowsModule` dùng đúng pattern guard đã có (`JwtAuthGuard` + `RolesGuard` + `@Roles(...)`), không phát minh cơ chế mới.
- Kế hoạch test khá đầy đủ: unit test theo service mới + build/lint + kịch bản E2E thủ công cho cả 3 luồng và 2 màn admin.

## Cần quyết định trước khi code (quan trọng nhất)

### Phân quyền duyệt theo bộ phận — hiện đang thiếu, Phase 2 sẽ khuếch đại lỗ hổng này
Brief mục 2 (bảng vai trò) ghi rõ: *"Trưởng bộ phận: duyệt cấp bộ phận... | Phạm vi dữ liệu: Toàn bộ dữ liệu của bộ phận phụ trách."* — nghĩa là quyền duyệt của Trưởng BP phải giới hạn trong bộ phận mình phụ trách.

Nhưng code hiện tại (`approveStep`/`returnStep`/`rejectStep` trong `documents.service.ts`) chỉ kiểm tra **vai trò** (`user.roles.includes(step.roleRequired)`), **không kiểm tra bộ phận** — nghĩa là bất kỳ ai mang vai trò `department_head` (dù ở phòng IT) hiện có thể duyệt/trả lại/từ chối hồ sơ của nhân viên phòng Tài chính. Đây là lỗ hổng có sẵn từ Phase 1 (chưa bị phát hiện ở các lần review trước vì lúc đó chỉ test với 1 trưởng bộ phận).

**Vì sao phải xử lý ngay ở Phase 2, không để dồn:** Phase 2 thêm Đề xuất và Hợp đồng — cả 2 đều đi qua bước `department_head`, nghĩa là phạm vi ảnh hưởng của lỗ hổng này tăng gấp 3 lần loại hồ sơ nếu không sửa bây giờ.

**Đề xuất cách xử lý** (chọn 1, nên hỏi HVE nếu không chắc):
- **Phương án A (khuyến nghị, chi phí thấp):** Thêm điều kiện `step.roleRequired === 'department_head'` thì so thêm `document.createdBy.departmentId === user.departmentId`. Các vai trò khác (kế toán, pháp chế, CEO) giữ nguyên logic hiện tại vì các vai trò đó vốn duyệt toàn công ty theo đúng brief (không giới hạn bộ phận).
- **Phương án B:** Gắn `assigneeId` cụ thể vào từng `DocumentApprovalStep` khi snapshot (chọn đúng trưởng bộ phận của người tạo) thay vì chỉ gắn `roleRequired`. Chuẩn hơn nhưng tốn công hơn — có thể để dành cho Phase 3+ nếu công ty có nhiều hơn 1 trưởng bộ phận/phòng sau này.

Nên chọn phương án A cho Phase 2 vì đủ đúng với quy mô hiện tại (mỗi phòng 1 trưởng bộ phận) và không làm chậm tiến độ.

## Điểm nên bổ sung vào lúc code (không chặn, nhưng rẻ hơn nếu làm ngay)

1. **Validate cấu hình workflow khi IT admin sửa** (`PUT /workflows/:type`): chặn lưu nếu `stepOrder` trùng nhau, không liên tục từ 1, danh sách rỗng, hoặc `roleRequired` không khớp role nào có thật trong bảng `Role`. Nếu không chặn, IT admin thao tác nhầm có thể làm toàn bộ hồ sơ loại đó không gửi duyệt được cho tới khi phát hiện.
2. **Test case "sửa workflow template không ảnh hưởng hồ sơ đang chạy dở"** — nên thêm rõ vào `workflows.service.spec.ts` hoặc `documents.service.spec.ts`: tạo hồ sơ → gửi duyệt (snapshot) → đổi `WorkflowTemplate` → xác nhận hồ sơ cũ vẫn duyệt theo step đã snapshot, không bị vỡ.
3. **Chặn IT admin tự khoá tài khoản của chính mình** ở `PATCH /admin/users/:id/status` — tương tự nguyên tắc "không tự duyệt hồ sơ mình tạo", tránh tự khoá nhầm rồi không ai mở lại được (trừ khi chắc chắn luôn có ≥2 tài khoản it_admin/ceo hoạt động).
4. **Ngưỡng "sắp hết hạn" 30 ngày cho hợp đồng** — brief không quy định số ngày cụ thể, 30 ngày là lựa chọn hợp lý nhưng nên ghi rõ đây là giá trị mặc định có thể cần HVE xác nhận (giống các mục "cần chốt" ở tài liệu kiến trúc), tránh phải sửa cứng trong code khi HVE muốn đổi.
5. **Việc cấp quyền admin (`/admin`, `/workflows`) cho cả `ceo` lẫn `it_admin`** — brief chỉ định rõ "IT công ty mẹ" là vai trò quản trị hệ thống; cho CEO cùng quyền không sai nhưng là mở rộng ngoài mô tả gốc. Hợp lý cho vai trò lãnh đạo, nhưng nên note lại trong tài liệu bàn giao để HVE biết đây là quyết định triển khai, không phải yêu cầu gốc.

## Việc rất nhỏ, không cần sửa kế hoạch

- Nhớ commit/lưu `implementation_plan.md` vào thư mục `HVE Work` (hiện chỉ có trong chat) để các review sau đối chiếu trực tiếp được, không phải paste lại thủ công.

---

## Tổng kết

Dev có thể tiến hành code theo kế hoạch này. Ưu tiên xử lý mục "Phân quyền duyệt theo bộ phận" — nên sửa cùng đợt Phase 2 vì làm sau sẽ phải sửa lại ở cả 3 loại hồ sơ thay vì 1. Các mục còn lại có thể làm song song trong quá trình code, không cần dừng lại chờ quyết định.
