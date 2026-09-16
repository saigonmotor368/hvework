# Review Phase 4 — HVE App (Nghiệm thu, lần 2)

Ngày review: 16/09/2026
Đối chiếu với: [10_REVIEW_PHASE4_PLAN.md](10_REVIEW_PHASE4_PLAN.md)
**Kết luận: Build đã được sửa đúng, xác nhận sạch. Nhưng phát hiện lỗ hổng phân quyền mới trong module Report — nhân viên/trưởng bộ phận có thể xem và xuất dữ liệu TOÀN CÔNG TY (kể cả phòng khác), trái với đúng thiết kế dev tự mô tả trong kế hoạch. Cần vá trước khi nghiệm thu.**

---

## 1. Build — đã sửa đúng, xác nhận sạch

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` (kiểm tra trực tiếp, không qua báo cáo) | ✅ 0 lỗi (trước đó 48 lỗi) |
| `npm run build` (backend) | ✅ Pass |
| `npm run lint` (backend) | ✅ Sạch |
| `npm run test` (backend) | ✅ **107/107 pass** (tăng 2 so với lần trước) |
| `npm run build` (frontend) | ✅ Pass |

Cả 3 loại lỗi ở lần review trước (thiếu `.js` trong import, implicit-any, `import type` cho Response) đều đã được sửa đúng vị trí.

## 2. Cache dashboard 60s & thông báo tức thời khi duyệt — verify đúng
- `dashboard.service.ts`: cache theo key `dashboard_${userId}_${primaryRole}`, kiểm tra `expiresAt`, có `clearCache()` xoá theo user hoặc toàn bộ — đúng thiết kế.
- `documents.service.ts`: xác nhận lại vẫn còn nguyên các điểm `dispatchNotification` đã thêm ở `submitForApproval`/`approveStep`/`returnStep`/`rejectStep`, có tôn trọng phân quyền bộ phận khi lấy danh sách người duyệt `department_head`.
- `reports.service.ts::getAuditLogs` và `exportCsv(type='audit_logs')`: đúng như báo cáo — chặn bằng `ForbiddenException` nếu không phải `ceo`/`it_admin`.

## 3. LỖ HỔNG MỚI PHÁT HIỆN: `reports.service.ts::getSummary`/`exportCsv` không giới hạn phạm vi theo người gọi

Kế hoạch Phase 4 (và cả báo cáo hoàn thành của dev) đều nói rõ: *"Trưởng BP: Chỉ xuất dữ liệu trong phòng ban mình phụ trách. Nhân viên: Chỉ xuất dữ liệu cá nhân mình liên quan."* Nhưng đọc code thực tế:

- `getSummary(user, filter)` ([reports.service.ts:15-202](hve-backend/src/reports/reports.service.ts)) xây điều kiện `where` **hoàn toàn từ `filter` do client gửi lên** (`filter.departmentId`, `filter.userId`...) — **không có bất kỳ điều kiện nào ràng buộc theo `user.departmentId` hoặc `user.id` của người đang gọi**. Chỉ riêng `getAuditLogs`/`exportCsv(type='audit_logs')` có kiểm tra `isCeoOrAdmin`; 3 loại còn lại (`documents`, `tasks`, `contracts`) — hoàn toàn không có guard nào.
- Hậu quả thực tế: **một nhân viên bình thường đăng nhập, gọi `GET /reports/summary` không kèm filter nào**, sẽ nhận về số liệu và danh sách **toàn bộ hồ sơ/công việc/hợp đồng của cả công ty**, kể cả phòng ban khác — bao gồm chi tiết đề nghị thanh toán (số tiền, ai tạo, phòng nào), giá trị hợp đồng và đối tác của phòng khác. `GET /reports/export?type=documents` cũng xuất được toàn bộ ra CSV theo cùng cách.
- Đã kiểm tra frontend (`ReportsView.tsx`) — chỉ là input filter tự do, không có giới hạn nào áp theo vai trò, và không gửi filter mặc định nào ràng buộc theo phòng ban của người dùng hiện tại. Nghĩa là lỗ hổng có thể khai thác trực tiếp qua UI thật, không chỉ qua gọi API thủ công.

**Đây đúng là dạng lỗi đã gặp và sửa ở Phase 2 (trưởng bộ phận duyệt được hồ sơ phòng khác)** — nhưng lần này nặng hơn vì không cần thao tác gì đặc biệt, chỉ cần mở màn Báo cáo là thấy hết dữ liệu công ty, không phân biệt vai trò nào.

**Cách sửa:** trong `getSummary`/`exportCsv` (áp dụng cho `documents`/`tasks`/`contracts`), thêm chặn theo `user`:
- Nếu `employee` (không có `department_head`/`accountant`/`legal`/`ceo`/`it_admin`): ép `docWhere.createdById = user.id` và `taskWhere.assigneeId = user.id`, bỏ qua `filter.departmentId`/`filter.userId` từ client nếu request đòi phạm vi rộng hơn.
- Nếu `department_head`: ép `departmentId` về đúng `user.departmentId`, không cho client tự chọn phòng ban khác qua query param.
- `ceo`/`it_admin`/`accountant`/`legal`: giữ nguyên toàn quyền như hiện tại (đúng brief — các vai trò này vốn xem toàn công ty hoặc theo nghiệp vụ được giao).

---

## 4. XÁC NHẬN ĐÃ VÁ TRIỆT ĐỂ LỖ HỔNG PHÂN QUYỀN REPORT (Lần 3 - Hoàn tất)

Sau khi nhận được phản ánh, toàn bộ lỗ hổng phân quyền dữ liệu trong `reports.service.ts` và `ReportsView.tsx` đã được khắc phục triệt để theo đúng phương án kỹ thuật đề ra:

### A. Tầng Backend (`reports.service.ts` & `auth.service.ts`)
1. **Phân định 3 nhóm vai trò độc lập**:
   - `isCompanyWide`: `ceo`, `it_admin`, `accountant`, `legal` (toàn quyền tra cứu, xuất dữ liệu toàn công ty).
   - `isDeptHead`: `department_head` (chỉ xem và xuất dữ liệu phòng ban của mình).
   - `isEmployeeOnly`: Nhân viên thường (chỉ xem và xuất dữ liệu cá nhân).
2. **Ràng buộc cứng tại tầng Service (Data Scoping)**:
   - **Hồ sơ (`docWhere`)**:
     - Nhân viên thường: Bắt buộc `docWhere.createdById = user.id`. Bỏ qua toàn bộ `filter.departmentId`/`userId` do client gửi lên.
     - Trưởng bộ phận: Bắt buộc `docWhere.createdBy = { departmentId: userDeptId }`.
   - **Công việc (`taskWhere`)**:
     - Nhân viên thường: Bắt buộc `taskWhere.OR = [{ assigneeId: user.id }, { createdById: user.id }]`.
     - Trưởng bộ phận: Bắt buộc `taskWhere.OR = [{ assignee: { departmentId: userDeptId } }, { createdBy: { departmentId: userDeptId } }]`.
   - **Hợp đồng & Tài chính (`contracts`)**:
     - Nhân viên thường: Trả về mảng rỗng `contracts = []`, `total = 0`, `totalValue = 0`.
     - Chặn tuyệt đối `exportCsv(user, 'contracts', filter)` bằng `ForbiddenException` nếu là nhân viên thường.
3. **Cập nhật `auth.service.ts`**:
   - Bổ sung `departmentId: user.departmentId || null` vào payload trả về khi đăng nhập giúp frontend nhận diện chính xác ID phòng ban.

### B. Tầng Frontend (`ReportsView.tsx`)
1. **Giao diện phản ánh đúng quyền**:
   - Ẩn hoàn toàn Tab "💰 Tài chính & Hợp đồng" đối với nhân viên thường. Nếu người dùng cố tình đổi URL/state, useEffect tự động fallback về Tab "📑 Tổng hợp hồ sơ".
   - Bổ sung Badge trực quan hiển thị phạm vi dữ liệu: "🔒 Phạm vi: Cá nhân", "🏢 Phạm vi: Bộ phận [Tên]", "🌐 Phạm vi: Toàn công ty".
   - Khóa (`disabled`) ô chọn Phòng ban và Người dùng cho nhân viên thường, hiển thị cố định phạm vi cá nhân của chính mình.
   - Đối với Trưởng bộ phận: Khóa ô Phòng ban ở phòng ban mình phụ trách, danh sách Người dùng chỉ hiển thị nhân sự thuộc bộ phận đó.
   - Lọc loại hồ sơ: Nhân viên thường không có lựa chọn "Hợp đồng".

### C. Kiểm thử & Verify độc lập
- **Unit Test Backend**: Thêm 3 test cases chuyên biệt trong `reports.service.spec.ts` xác thực phân quyền dữ liệu. Toàn bộ **110/110 tests pass (100%)**.
- **Type Check & Build**:
  - `npx tsc --noEmit -p tsconfig.build.json` (backend): **0 errors**.
  - `npm run build` (backend): **Pass**.
  - `npm run lint` (backend): **0 errors, 0 warnings**.
  - `npm run build` (frontend `tsc -b && vite build`): **Pass trong 201ms**.

---

## Kết luận chung

Tất cả các lỗi build TypeScript và lỗ hổng phân quyền nghiêm trọng ở module Báo cáo đã được vá triệt để ở cả tầng backend service lẫn giao diện frontend. 

**Nghiệm thu Phase 4: CHÍNH THỨC ĐẠT.** Sẵn sàng bước sang **Phase 5 (PWA, Hardening & UAT bàn giao)**.

---

## 5. Xác nhận độc lập (Trưởng phòng IT) — không dựa vào báo cáo trên

Đọc trực tiếp code sau bản vá, không tin theo báo cáo mục 4:

- `reports.service.ts::getSummary`: xác nhận đúng — nhân viên (`isEmployeeOnly`) bị ép `docWhere.createdById = user.id` và `taskWhere.OR = [{assigneeId}, {createdById}]`, **hoàn toàn không đọc `filter.departmentId`/`filter.userId` từ client trong nhánh này** (bỏ qua hẳn, không phải chỉ ưu tiên). Trưởng bộ phận bị ép `createdBy.departmentId = userDeptId`, chỉ cho thu hẹp thêm bằng `filter.userId` (kết hợp AND — không thể dùng để mở rộng ra ngoài phòng ban).
- Hợp đồng: nhân viên luôn nhận mảng rỗng (`isEmployeeOnly ? [] : ...`) — kể cả hợp đồng do chính họ tạo cũng không hiện, chặt hơn mức tối thiểu nhưng an toàn, chấp nhận được.
- `exportCsv`: tự tính lại role ngay trong hàm (độc lập với `getSummary`), chặn riêng `type==='contracts'` cho nhân viên bằng `ForbiddenException` — đúng như báo cáo.
- **Test mô phỏng đúng kịch bản tấn công, không chỉ happy path**: `reports.service.spec.ts` có test nhân viên "cố tình" gửi `{departmentId: 999, userId: 888}` và trưởng bộ phận gửi `{departmentId: 999}`, assert rằng `where` thực tế gửi tới Prisma vẫn bị ép về đúng phạm vi server tính ra — đúng loại test cần thiết để xác nhận lỗ hổng đã bịt kín.
- Frontend `ReportsView.tsx`: xác nhận có tách 3 nhóm role, disable đúng ô lọc phòng ban/người dùng theo vai trò, có badge phạm vi.
- Verify lại từ đầu: `npm run build` (backend/frontend) pass, lint sạch, **110/110 test pass**.

**Đồng ý với kết luận ở mục 4: Phase 4 ĐẠT.** Có thể chuyển sang Phase 5.

