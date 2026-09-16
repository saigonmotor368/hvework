---
description: Quy định bắt buộc ghi nhật ký và duy trì trạng thái sau mỗi phiên làm việc
globs: *
---

# QUY ĐỊNH DUY TRÌ TIẾN ĐỘ & NHẬT KÝ LÀM VIỆC (WORK CONTINUITY RULE)

Áp dụng cho toàn bộ các phiên làm việc của AI / Developer trên dự án HVE Work.

## 1. Nguyên tắc cốt lõi
- Mỗi khi thực hiện xong một phiên làm việc hoặc trước khi kết thúc tác vụ, AI **BẮT BUỘC** phải cập nhật file [NHAT_KY_CONG_VIEC.md](file:///e:/HUYVOEDUCATION/HVE%20Work/NHAT_KY_CONG_VIEC.md) ở thư mục gốc.
- Đảm bảo nếu phiên làm việc bị ngắt kết nối, crash, hoặc người dùng mở một phiên chat mới, AI phiên sau chỉ cần đọc file này là nắm bắt đầy đủ trạng thái và tiếp tục ngay lập tức mà không phải hỏi lại.

## 2. Các mục bắt buộc cập nhật trong mỗi phiên
1. **File `NHAT_KY_CONG_VIEC.md`**:
   - Ghi rõ ngày giờ phiên làm việc (Session Timestamp).
   - Nội dung công việc vừa hoàn thành (kèm đường dẫn file đã tạo/sửa).
   - Kết quả kiểm thử (unit test, build pass/fail).
   - Trạng thái hiện tại của hệ thống (Backend, Frontend, Database, CI).
   - Kế hoạch bước tiếp theo (Next Steps) thật cụ thể.
2. **File `03_TASKLIST_DEV.md`**:
   - Đánh dấu tick `[x]` các task đã thực sự hoàn thành và kiểm thử.
   - Giữ nguyên `[ ]` cho các task chưa hoàn thành.
3. **Quản lý phiên bản mã nguồn (Git)**:
   - Tạo commit git với thông điệp rõ ràng theo định dạng `feat:`, `fix:`, `docs:`, `test:` để người dùng theo dõi được toàn bộ lịch sử trong Source Control.
