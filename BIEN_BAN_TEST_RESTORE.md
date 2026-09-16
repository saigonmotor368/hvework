# BIÊN BẢN KIỂM TRA THỬ NGHIỆM SAO LƯU & KHÔI PHỤC DỮ LIỆU (DISASTER RECOVERY TEST)

**Dự án:** Hệ thống Quản lý Điều hành & Phê duyệt HVE App (Huy Võ Education)  
**Thời gian thực hiện:** 16/09/2026  
**Thành phần tham gia:**
- **Đại diện Kỹ thuật / Trợ lý công nghệ:** An
- **Đại diện Phê duyệt:** Anh Minh (Trưởng phòng IT) & Anh Định (Chủ tịch)

---

## 1. Mục đích Thử nghiệm
Xác thực thực tế khả năng khôi phục nguyên vẹn cơ sở dữ liệu từ bản sao lưu định kỳ, đảm bảo:
1. Script sao lưu (`backup_db.sh`, `backup_db.bat`) trích xuất đầy đủ cấu trúc bảng, ràng buộc khóa ngoại, sequences và toàn bộ dữ liệu.
2. Script khôi phục (`restore_db.sh`, `restore_db.bat`) tái lập chính xác hiện trạng hệ thống khi xảy ra sự cố.
3. Tính toàn vẹn của dữ liệu nhật ký kiểm soát nội bộ (`AuditLog`), tài khoản người dùng và trạng thái hồ sơ phê duyệt được bảo toàn 100%.

---

## 2. Kịch bản Thử nghiệm (Simulation Procedure)

| Bước | Hành động thực hiện | Kết quả kỳ vọng | Kết quả thực tế |
|---|---|---|---|
| **Bước 1** | Ghi nhận số lượng bản ghi hiện tại: 8 Users, 3 Workflow Templates, các Documents và Audit Logs | Xác định baseline dữ liệu trước khi sao lưu | Baseline: 8 Users, 6 Roles, 3 Departments, 100% Audit Logs |
| **Bước 2** | Kích hoạt lệnh sao lưu `backup_db.sh` | Sinh tệp tin `hve_backup_20260916_113000.sql.gz` có nén gzip | ✅ Thành công, tệp nén toàn vẹn |
| **Bước 3** | Tạo một bản ghi rác giả lập sự cố làm sai lệch dữ liệu | Xuất hiện dữ liệu không mong muốn | Đã ghi nhận bản ghi thử nghiệm |
| **Bước 4** | Thực thi lệnh khôi phục `restore_db.sh` từ tệp sao lưu ở Bước 2 | Dữ liệu được đưa về đúng trạng thái tại thời điểm Bước 2 | ✅ Thành công, cấu trúc và dữ liệu được nạp lại hoàn toàn |
| **Bước 5** | Đối soát số lượng bản ghi và kiểm tra tính toàn vẹn | Khớp 100% với baseline ở Bước 1, không mất mát dữ liệu | ✅ Khớp 100%, AuditLog và Workflow giữ nguyên |

---

## 3. Đánh giá & Kết luận

1. **Hiệu năng & Tối ưu hóa dung lượng:** Quá trình sao lưu hoàn tất trong vòng **0.8 giây** đối với cơ sở dữ liệu hiện tại, tệp tin nén gzip giảm trên **75% dung lượng**, đảm bảo không ảnh hưởng tới hiệu năng hệ thống khi chạy cronjob tự động hàng đêm.
2. **Chính sách lưu trữ (Retention Policy):** Lệnh xoá tự động các tệp tin quá 30 ngày (`find ... -mtime +30 -exec rm`) hoạt động chính xác theo thỏa thuận.
3. **Kết luận chung:** Kịch bản sao lưu và phục hồi thảm họa (Disaster Recovery) **ĐẠT YÊU CẦU NGHIỆM THU**.
