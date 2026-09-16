# HVE App — Kế hoạch triển khai (Implementation Plan)

Phiên bản 1.0 | 15/09/2026
Đi kèm [01_KIEN_TRUC_KY_THUAT.md](01_KIEN_TRUC_KY_THUAT.md) và [03_TASKLIST_DEV.md](03_TASKLIST_DEV.md).

---

## 1. Nguyên tắc chia giai đoạn

Chia theo **giá trị nghiệp vụ chạy được sớm** (không chia theo lớp kỹ thuật), để mỗi giai đoạn HVE đều xem/dùng thử được thứ gì đó thật. Tổng 6 giai đoạn (Phase 0 → 5).

| Giai đoạn | Nội dung | Mục tiêu đạt được |
|---|---|---|
| Phase 0 | Nền tảng & hạ tầng | Auth, RBAC khung, DB schema, CI/CD, môi trường |
| Phase 1 | Lõi phê duyệt (1 luồng) | Đề nghị thanh toán chạy hết vòng đời |
| Phase 2 | Mở rộng phê duyệt | Đề xuất + Hợp đồng, workflow cấu hình được |
| Phase 3 | Quản lý công việc | Giao việc, task con, lặp lại, kiểm soát tiến độ |
| Phase 4 | Thông báo, báo cáo, dashboard | Nhắc hạn, dashboard theo vai trò, xuất báo cáo |
| Phase 5 | PWA, hardening, UAT, bàn giao | Cài đặt home screen, bảo mật, backup, đào tạo, nghiệm thu |

Ước lượng thời lượng theo **tuần tương đối** (không phải cam kết giá — brief nói rõ "ngân sách/thời hạn do developer đề xuất trong báo giá"), giả định team 2 dev (1 FE, 1 BE) + 1 QA bán thời gian:

| Giai đoạn | Ước lượng |
|---|---|
| Phase 0 | 1.5 tuần |
| Phase 1 | 2 tuần |
| Phase 2 | 1.5 tuần |
| Phase 3 | 2 tuần |
| Phase 4 | 1.5 tuần |
| Phase 5 | 1.5 tuần |
| **Tổng** | **~10 tuần** (điều chỉnh theo báo giá thực tế của dev) |

---

## 2. Chi tiết từng giai đoạn

### Phase 0 — Nền tảng & hạ tầng
**Đầu ra:** repo khởi tạo, CI/CD chạy, đăng nhập được, có user seed sẵn theo 6 vai trò, deploy được lên môi trường staging.

Điều kiện hoàn thành (Definition of Done của phase):
- Đăng nhập/đăng xuất hoạt động, JWT refresh hoạt động.
- RBAC middleware có (chưa cần đủ toàn bộ ma trận quyền, nhưng cơ chế phải chạy được và có test mẫu).
- Schema DB dựng theo mục 2 của tài liệu kiến trúc, có migration tool (Prisma/TypeORM/Knex...).
- CI chạy lint + test + build trên mỗi PR; CD deploy staging tự động khi merge vào `main`.
- Audit log ghi được ít nhất sự kiện login/logout để xác nhận cơ chế hoạt động.

**Việc cần HVE xác nhận trước khi bắt đầu Phase 1:** chốt các mục "[QUYẾT ĐỊNH CẦN CHỐT]" trong tài liệu kiến trúc (giới hạn file, retention backup, phương án OTP, hành vi "Trả lại").

### Phase 1 — Lõi phê duyệt: Đề nghị thanh toán
Chọn luồng này làm luồng đầu tiên vì dài nhất (4 cấp) — nếu chạy đúng, 2 luồng còn lại chỉ là cấu hình lại.

**Đầu ra:** tạo/sửa/xoá nháp → gửi duyệt → đi qua Trưởng BP → Kế toán → CEO → Đã duyệt; trả lại/từ chối có ghi lý do; audit log đầy đủ; đính kèm chứng từ hoạt động.

### Phase 2 — Mở rộng phê duyệt
**Đầu ra:** Đề xuất và Hợp đồng dùng chung engine luồng của Phase 1 qua cấu hình `WorkflowTemplate`; màn hình IT admin để tạo/sửa luồng + vai trò không cần sửa code; hợp đồng có theo dõi ngày hiệu lực/hết hạn.

### Phase 3 — Quản lý công việc
**Đầu ra:** CEO/Trưởng BP giao việc, việc con, việc lặp lại, mức ưu tiên, thẻ phân loại, bình luận có gắn tên, trạng thái Chưa làm→Đang làm→Chờ duyệt→Hoàn thành, quy tắc "người giao xác nhận mới hoàn thành".

### Phase 4 — Thông báo, báo cáo, dashboard
**Đầu ra:** 6 loại sự kiện thông báo ở mục 7 brief (in-app + email, chống trùng), 4 dashboard theo vai trò, bộ báo cáo (6 loại ở mục 6 brief) với filter + export Excel/PDF + drill-down.

### Phase 5 — PWA, hardening, UAT, bàn giao
**Đầu ra:**
- Manifest + Service Worker, cài được lên home screen iOS/Android, test Web Push theo từng trình duyệt và ghi rõ giới hạn.
- Security pass: rate-limit, kiểm thử phân quyền âm tính (role X không được làm việc Y), pen-test cơ bản (OWASP top 10 tự kiểm hoặc thuê ngoài nếu HVE muốn).
- Backup tự động + 1 lần test restore thực tế có biên bản.
- UAT với HVE theo checklist "Nghiệm thu" mục 11 brief.
- Đào tạo người dùng (buổi demo theo vai trò) + tài liệu hướng dẫn + tài liệu quản trị + tài liệu API.
- Xác định thời gian bảo hành/hỗ trợ sau bàn giao (dev đề xuất trong báo giá).

---

## 3. Rủi ro & phụ thuộc theo tiến độ

| Rủi ro | Ảnh hưởng | Cách giảm thiểu |
|---|---|---|
| Chưa có asset logo vector | Chặn polish UI production ở Phase 5, không chặn code Phase 0-4 (dùng placeholder theo đúng mã màu) | Gửi yêu cầu logo cho HVE ngay từ Phase 0, deadline trước khi vào Phase 5 |
| Các mục "[QUYẾT ĐỊNH CẦN CHỐT]" chưa chốt | Có thể phải sửa lại logic đã code (vd hành vi "Trả lại") | Chốt toàn bộ trước khi merge code Phase 1 vào `main`, không để tồn đọng sang Phase 2 |
| OTP SMS ngoài phạm vi ban đầu | Không chặn tiến độ nếu đồng ý OTP email trước | Ghi rõ trong tài liệu bàn giao là hạng mục có thể nâng cấp sau |
| Zalo OA chưa có | Không chặn — đã thiết kế interface mở sẵn | Không làm gì thêm ở v1 ngoài để sẵn interface |
| Quy mô 20-30 user nhưng dùng cả di động lẫn máy tính đồng thời | Rủi ro thấp về tải, nhưng UX phải nhất quán 2 nền tảng | Test song song desktop + mobile mỗi Phase, không dồn về cuối |

---

## 4. Môi trường & quy trình release

- 2 môi trường tối thiểu: **staging** (dùng để UAT theo từng phase) và **production** (chỉ deploy sau khi HVE duyệt UAT của phase liên quan tới tính năng đó, hoặc dồn duyệt 1 lần cuối Phase 5 tuỳ thoả thuận).
- Mỗi phase kết thúc bằng 1 buổi demo ngắn với HVE (khớp nguyên tắc "trang chủ ưu tiên việc cần hành động" — nên demo bằng kịch bản thật, không chỉ liệt kê tính năng).
- Versioning: gắn tag git theo từng release lên production, changelog kèm theo.
