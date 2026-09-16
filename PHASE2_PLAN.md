# Kế hoạch Triển khai Phase 2: Mở rộng Phê duyệt & Quản trị Workflow IT Admin (Đã cập nhật theo Review)

## Mục tiêu Phase 2
1. **Đa dạng hóa loại hồ sơ (3 loại)** trên cùng một **Core Approval Engine** thống nhất:
   - **Đề nghị thanh toán** (`payment_request`, mã `DNTT-YYYY-NNN`): 4 cấp duyệt (Người tạo → Trưởng BP → Kế toán → CEO). Bắt buộc chứng từ.
   - **Đề xuất** (`proposal`, mã `DX-YYYY-NNN`): 3 cấp duyệt (Người tạo → Trưởng BP → CEO). Tối thiểu mã, tiêu đề, người tạo, nội dung đề xuất. Chứng từ tùy chọn.
   - **Hợp đồng** (`contract`, mã `HD-YYYY-NNN`): 5 cấp duyệt (Người tạo → Trưởng BP → Pháp chế → Kế toán → CEO). Trường dữ liệu: đối tác, giá trị, ngày hiệu lực/hết hạn, người phụ trách, file hợp đồng bắt buộc.
2. **Theo dõi và Cảnh báo Hạn Hợp đồng**:
   - Tính toán trạng thái runtime: Hợp lệ, Sắp hết hạn (mặc định ≤ 30 ngày, có thể truyền param linh hoạt), hoặc Đã quá hạn.
   - Cảnh báo trực quan trên danh sách và chi tiết hợp đồng; cung cấp API lọc hợp đồng sắp hết hạn.
3. **Phân quyền duyệt theo Bộ phận (Vá lỗ hổng Phase 1)**:
   - Khi bước duyệt yêu cầu vai trò `department_head`, kiểm tra bắt buộc `document.createdBy.departmentId === user.departmentId`.
   - Các vai trò toàn công ty (`accountant`, `legal`, `ceo`) giữ nguyên phạm vi duyệt toàn hệ thống.
4. **Màn hình & API IT Admin (CRUD Workflow)**:
   - Quản trị viên (`it_admin`, `ceo`) có thể xem, thêm, bớt, sắp xếp lại thứ tự cấp duyệt và chọn vai trò phê duyệt cho từng loại hồ sơ trực tiếp trên giao diện mà không cần deploy lại code.
   - Validate nghiêm ngặt cấu hình workflow: `stepOrder` liên tục từ 1, không trùng, role hợp lệ trong hệ thống.
5. **Màn hình & API IT Admin (Quản lý User / Phân quyền)**:
   - Quản lý danh sách nhân sự, gán vai trò (`roles`), gán phòng ban (`department`), và khóa/mở khóa tài khoản (`active`/`locked`).
   - Chặn quản trị viên tự khóa tài khoản của chính mình.

---

## Danh mục thay đổi mã nguồn

### 1. Backend (`hve-backend`)
- DTOs: `CreateProposalDto`, `CreateContractDto`, `UpdateWorkflowTemplateDto`, `UpdateUserRolesDto`.
- `DocumentsService` & `DocumentsController`:
  - `POST /documents/proposals`
  - `POST /documents/contracts`
  - `GET /documents/contracts/expiring`
  - Phân quyền Trưởng bộ phận theo `departmentId`.
  - Validate gửi duyệt theo từng loại hồ sơ.
- `WorkflowsModule`:
  - `GET /workflows`
  - `GET /workflows/:type`
  - `PUT /workflows/:type` (Transaction cập nhật steps, validate thứ tự & role).
- `AdminModule`:
  - `GET /admin/users`
  - `GET /admin/roles`
  - `GET /admin/departments`
  - `PATCH /admin/users/:id/status` (Chặn tự khóa chính mình).
  - `PUT /admin/users/:id/roles`
- `seed.ts`: Seed templates cho proposal và contract, bổ sung tài khoản test cho Trưởng BP IT và Pháp chế.

### 2. Frontend (`hve-frontend`)
- `types.ts`: Mở rộng types cho Proposal, Contract, Workflow, Admin.
- `CreateDocumentForm.tsx`: Chọn loại hồ sơ (ĐNTT / Đề xuất / Hợp đồng) với fields tương ứng.
- `DocumentList.tsx`: Filter loại hồ sơ, badge phân loại, badge cảnh báo hạn hợp đồng.
- `DocumentDetailModal.tsx`: Render chi tiết động theo loại hồ sơ, banner cảnh báo hạn hợp đồng.
- `AdminWorkflowView.tsx`: Màn hình cấu hình quy trình duyệt.
- `AdminUserView.tsx`: Màn hình quản trị nhân sự & phân quyền.
- `Sidebar.tsx` & `App.tsx`: Tích hợp các tab mới, điều phối dữ liệu và gọi API.
