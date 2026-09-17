# YÊU CẦU TÍNH NĂNG — Quản lý theo Dự án (Project) + thu hẹp phạm vi xem theo Dự án

**Người giao việc:** Sếp tổng (qua anh Định)
**Người thực hiện:** Long (Phó phòng IT) — đổi từ An sang Long theo yêu cầu 17/09/2026, do tính năng này đụng vào lõi phân quyền (RBAC), cần người kỹ năng cao hơn
**Người rà soát + deploy sau khi Long xong:** Minh
**Ngày giao:** 17/09/2026

---

## 1. BỐI CẢNH & YÊU CẦU GỐC (nguyên văn anh Định)

> "mình có 3 dự án hiện tại: Kỹ Năng Sống ở NVH, CCA ở SNA, TOUR du lịch → trưởng các bộ phận chỉ nhìn thấy công việc + đề xuất + đề nghị TT trong dự án mình thôi. Khi nào cần link công việc phối hợp các team thì mới nhìn thấy những cái gì chung (ví dụ tạo Project mới nào đó)."

**Kèm theo (đã chốt cùng lúc):** Quy trình duyệt Đề nghị thanh toán đổi thành **Lính → Trưởng Dự án → CEO duyệt → Kế toán duyệt chi tiền** (kế toán có quyền từ chối). **Phần này KHÔNG cần code** — CEO/IT Admin tự đổi thứ tự bước trong màn hình "⚙️ Cấu hình quy trình" (`AdminWorkflowView`) đã có sẵn, chỉ cần kéo bước "Kế toán" xuống dưới "CEO" cho loại "Đề nghị thanh toán". Phần rút gọn lưu chứng từ + thống kê (thay cho tính năng "Xác nhận chi tiền" cũ An đã viết, có lỗi bảo mật) xem thiết kế thay thế ở cuối file `YEU_CAU_TINH_NANG_XAC_NHAN_CHI_TIEN.md` — việc này nhỏ, Long tiện thể làm luôn cùng đợt.

**Việc thật sự cần Long code trong file này:** hệ thống hiện tại phân quyền xem dữ liệu theo **Phòng ban** (`Department` — IT, Tài chính-Kế toán, Kinh doanh, Pháp chế). Nhưng thực tế vận hành công ty theo **Dự án** (Kỹ Năng Sống, CCA, TOUR du lịch...) — đây là khái niệm khác, cần thêm vào hệ thống.

---

## 2. THIẾT KẾ DỮ LIỆU (Prisma schema)

Thêm 2 bảng mới, không đụng tới bảng `Department` hiện có (giữ nguyên cho mục đích tổ chức nhân sự/phòng ban):

```prisma
model Project {
  id          Int      @id @default(autoincrement())
  code        String   @unique // VD: KNS, CCA, TOUR
  name        String   // VD: "Kỹ Năng Sống", "CCA", "TOUR du lịch"
  location    String?  // VD: "NVH", "SNA" — theo cách anh Định gọi tên kèm địa điểm
  leadUserId  Int?     // Trưởng dự án
  lead        User?    @relation("ProjectLead", fields: [leadUserId], references: [id])
  isActive    Boolean  @default(true)
  members     ProjectMember[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ProjectMember {
  id        Int     @id @default(autoincrement())
  projectId Int
  project   Project @relation(fields: [projectId], references: [id])
  userId    Int
  user      User    @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
}
```

Cập nhật `Document` và `Task` — thêm field mới, **không xóa field cũ**:

```prisma
model Document {
  // ...giữ nguyên toàn bộ field hiện có...
  projectId        Int?    // dự án chính của hồ sơ — null = hồ sơ chung công ty (không thuộc dự án nào)
  project          Project? @relation(fields: [projectId], references: [id])
  linkedProjectIds Json?   // mảng project id được "chia sẻ xem" — dùng khi cần phối hợp liên team, VD [2, 3]
}

model Task {
  // ...giữ nguyên toàn bộ field hiện có...
  projectId        Int?
  project          Project? @relation(fields: [projectId], references: [id])
  linkedProjectIds Json?   // giống Document — tái dùng đúng pattern collaboratorIds đã có sẵn trong Task
}
```

> Lý do dùng `linkedProjectIds Json?` (mảng) thay vì bảng join riêng: `Task` đã có sẵn field `collaboratorIds Json?` dùng đúng pattern này — giữ nhất quán phong cách code hiện tại, không cần thêm bảng phụ.

**Migration dữ liệu cũ:** Tất cả `Document`/`Task` hiện có sẽ có `projectId = null` sau khi migrate (coi như "chung công ty", ai cũng xem được theo đúng luật hiện tại) — **không bắt buộc gán dự án cho dữ liệu cũ**, tránh rủi ro migrate sai. Chỉ áp dụng bắt buộc chọn dự án cho hồ sơ/công việc tạo MỚI sau khi tính năng này lên production (tùy anh Định quyết định có bắt buộc hay để tùy chọn — nên hỏi lại trước khi code phần validate bắt buộc).

---

## 3. LOGIC PHÂN QUYỀN XEM (RBAC) — trọng tâm của tính năng

Sửa `hve-backend/src/common/access-scope.ts`:

### `buildDocumentAccessWhere` (hiện tại dòng 33-65)
- Giữ nguyên logic hiện có cho `ceo` (xem toàn bộ), `accountant`/`legal` (xem theo nghiệp vụ), và `steps.some(...)` (xem hồ sơ đang chờ mình duyệt) — **không đổi**, đây là nhu cầu khác (phê duyệt), không phải nhu cầu xem theo dự án.
- Sửa nhánh `department_head`: thay vì chỉ xem theo `createdBy.departmentId`, đổi thành xem theo **dự án mình phụ trách**:
  ```ts
  if (roles.includes('department_head')) {
    const userProjectIds = getUserProjectIds(user); // dự án mà user là leadUserId HOẶC là ProjectMember
    conditions.push({ projectId: { in: userProjectIds } });
    conditions.push({ linkedProjectIds: { array_contains: userProjectIds } }); // Prisma JSON filter — kiểm tra kỹ syntax đúng cho Postgres
    // Fallback: hồ sơ null projectId (chung công ty) vẫn theo department cũ để không phá vỡ dữ liệu hiện có
    if (departmentId) conditions.push({ AND: [{ projectId: null }, { createdBy: { departmentId } }] });
  }
  ```
- Viết hàm `getUserProjectIds(user)` mới trong `access-scope.ts`, cần load kèm `project` (nơi user là lead) và `projectMemberships` vào JWT payload hoặc query thêm — **cân nhắc kỹ hiệu năng**: có thể cần thêm `projectLeaderOf`/`projectMemberOf` vào object `user` được `JwtAuthGuard` gắn vào `req.user`, tương tự cách `roles`/`departmentId` đang được nạp sẵn (xem `auth.service.ts` phần validate/JWT payload).

### `buildTaskAccessWhere` (dòng 71-91)
- Áp dụng logic tương tự: `department_head` xem theo dự án mình phụ trách thay vì theo phòng ban.

### `describeBusinessScope` (dòng 93-117)
- Cập nhật `label`/`level` để hiển thị đúng: "Dự án Kỹ Năng Sống" thay vì "Phòng ban IT" khi user là trưởng dự án.

**Lưu ý quan trọng:** Role `department_head` giữ nguyên tên trong hệ thống (không đổi thành `project_lead`) — chỉ đổi **ý nghĩa phạm vi xem** từ "theo phòng ban" sang "theo dự án phụ trách". Đổi nhãn hiển thị trong `ROLE_LABELS` (`hve-frontend/src/types.ts` dòng 97) từ `'Trưởng bộ phận'` thành `'Trưởng Dự án'` nếu anh Định xác nhận muốn đổi tên gọi luôn (nên hỏi lại).

---

## 4. GIAO DIỆN CẦN THÊM

1. **Trang quản trị Dự án mới** (`AdminProjectsView.tsx`, tương tự `AdminWorkflowView.tsx`/`AdminUserView.tsx` đã có) — chỉ CEO/IT Admin truy cập:
   - Tạo/sửa/tắt Dự án (code, tên, địa điểm, trưởng dự án, danh sách thành viên).
   - Đây chính là nơi hiện thực câu "ví dụ tạo Project mới nào đó" anh Định nhắc tới.
2. **`CreateDocumentForm.tsx` / `CreateTaskModal.tsx`**: thêm dropdown chọn "Dự án" khi tạo hồ sơ/công việc mới. Mặc định chọn theo dự án user đang thuộc (nếu chỉ thuộc 1 dự án thì tự động chọn, ẩn dropdown cho gọn).
3. **`DocumentDetailModal.tsx` / `TaskDetailModal.tsx`**: hiển thị badge tên dự án. Nếu có `linkedProjectIds`, hiển thị thêm "Chia sẻ với: [tên các dự án khác]".
4. **`ReportsView.tsx`**: thêm bộ lọc theo Dự án (giống bộ lọc Phòng ban hiện có) cho CEO/IT Admin xem tổng hợp theo từng dự án.

---

## 5. CÂU HỎI CẦN HỎI LẠI ANH ĐỊNH TRƯỚC KHI CODE (Long nên hỏi, đừng tự đoán)

1. Một nhân viên có thể thuộc **nhiều hơn 1 dự án** cùng lúc không, hay mỗi người chỉ thuộc đúng 1 dự án? (ảnh hưởng thiết kế `ProjectMember` — hiện đang thiết kế cho phép nhiều, nhưng cần xác nhận).
2. Có bắt buộc phải chọn Dự án khi tạo hồ sơ/công việc mới không, hay để trống = "chung công ty" vẫn hợp lệ?
3. 4 phòng ban hiện có (IT, Tài chính-Kế toán, Kinh doanh, Pháp chế) có tiếp tục tồn tại song song với 3 Dự án không, hay phòng ban sẽ dần được thay thế hoàn toàn bằng dự án? (ảnh hưởng có cần giữ logic fallback theo `departmentId` hay không).
4. Đổi nhãn `department_head` → "Trưởng Dự án" trên toàn bộ giao diện, hay giữ nguyên "Trưởng bộ phận" và chỉ Dự án là khái niệm mới cộng thêm?

---

## 6. GHI CHÚ CHO LONG

- Đây là tính năng lớn, đụng vào lõi phân quyền (`access-scope.ts`) — nơi rất dễ gây lỗi bảo mật nếu làm ẩu (lộ dữ liệu dự án khác). Viết test kỹ cho từng trường hợp: user thuộc dự án A không được thấy hồ sơ/công việc chỉ thuộc dự án B, trừ khi có `linkedProjectIds` chứa dự án A.
- Tham khảo lại bài học từ lần trước: **không tự thêm logic reassign/update dữ liệu chỉ dựa vào ID client gửi lên mà không kiểm tra quyền sở hữu** (lỗi IDOR đã bị phát hiện ở tính năng `confirm-disbursement` trước đó).
- Sau khi code xong, báo cáo lại để Minh rà soát kỹ (đặc biệt phần RBAC) rồi mới deploy — không tự deploy.

---

*File này thay thế `YEU_CAU_TINH_NANG_XAC_NHAN_CHI_TIEN.md` (đã hủy phần chính, còn phần "Thiết kế rút gọn" ở cuối file đó) làm việc chính cần Long làm tiếp theo.*
