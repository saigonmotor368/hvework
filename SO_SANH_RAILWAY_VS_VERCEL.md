# SO SÁNH RAILWAY vs VERCEL — Backend HVE Work (đường dài)

**Ngày:** 16/09/2026
**Người viết:** Minh (AI assistant)
**Mục đích:** Giúp anh Định và Long ra quyết định có nên chuyển hẳn backend sang Railway hay giữ Vercel, dựa trên dữ liệu thực tế đã đo/gặp trong quá trình triển khai, không phải suy đoán.

---

## 1. TÓM TẮT 1 DÒNG

Không có bên nào "thắng tuyệt đối". Vercel rẻ hơn (hiện đang free) và đủ nhanh khi chạy ổn; Railway tốn phí cố định nhưng ổn định hơn về mặt vận hành lâu dài, ít lỗi vặt hơn với kiểu backend NestJS + kết nối DB liên tục như HVE Work.

---

## 2. CHI PHÍ — ĐÍNH CHÍNH QUAN TRỌNG

| | Vercel | Railway |
|---|---|---|
| Mô hình tính phí | Theo gói (free / Pro $20/tháng/người) | Theo mức sử dụng tài nguyên (usage-based), gói Hobby $5/tháng bao gồm sẵn $5 credit |
| Số lượng site/project | Không giới hạn số project trên 1 tài khoản | Không giới hạn service, nhưng TẤT CẢ service dùng chung 1 quỹ credit |
| Chi phí thực tế hiện tại của HVE Work | $0 (đang ở gói Hobby free) | ~$5/tháng (đã mua) |
| Rủi ro pháp lý/ToS | Gói Hobby free **chỉ dành cho cá nhân/phi thương mại** theo điều khoản Vercel — dùng cho công ty về lý thuyết cần nâng lên Pro | Không có ràng buộc "chỉ cá nhân" — trả phí là dùng thoải mái cho mục đích thương mại |
| Nếu vượt giới hạn free/credit | Vercel: cảnh báo, có thể bị giới hạn tính năng hoặc buộc nâng Pro | Railway: tự động tính thêm theo usage thực tế (pay-as-you-go), không có "tường chặn" cứng |

**Quan trọng:** "$5/tháng Railway" **không phải tính theo từng site** — đó là gói thuê bao có sẵn $5 credit dùng chung cho mọi service (backend, DB nếu tự host, worker...). Nếu công ty chỉ có 1 backend nhỏ như hiện tại, $5/tháng gần như đủ. Nếu mở rộng thêm nhiều service, chi phí sẽ tăng theo mức dùng thực tế — không phải nhân theo số lượng site một cách cơ học.

**Kết luận về chi phí:** Vercel đang rẻ hơn trên giấy tờ (free), nhưng thực tế công ty dùng cho mục đích thương mại nên về lâu dài nhiều khả năng vẫn phải trả phí (Pro $20/tháng/người dùng, có thể đắt hơn Railway nếu team IT có vài người). Railway $5/tháng cố định, minh bạch, không phụ thuộc số lượng người dùng trong team.

---

## 3. TỐC ĐỘ PHẢN HỒI (đã đo thực tế, không suy đoán)

Đo bằng `curl` gọi route thật `/notifications` (có yêu cầu xác thực, phản ánh đúng tải thực tế), 3 lần mỗi bên:

| Lần đo | Railway (Singapore) | Vercel (Hồng Kông, đã ghim region) |
|---|---|---|
| 1 | 0.331s | 0.273s |
| 2 | 0.216s | 0.236s |
| 3 | 0.228s | 0.234s |

**→ Không có khác biệt đáng kể khi cả 2 đang chạy ổn định.** (Lần đo đầu tiên của Minh từng báo nhầm Vercel "chết" do gọi sai route test — đã đính chính trong `BAN_GIAO_CHO_LONG_PHO_PHONG_IT.md`.)

**Điểm khác biệt thực sự về tốc độ nằm ở "cold start":**
- Vercel serverless: nếu không có ai gọi trong một khoảng thời gian, function "ngủ" — request đầu tiên sau đó phải khởi động lại container, chậm hơn đáng kể (thường thêm 1-3 giây) so với các lần gọi liên tục sau đó.
- Railway: server chạy liên tục (persistent), không có khái niệm "ngủ" — mọi request đều có tốc độ ổn định như nhau, kể cả lần gọi đầu tiên sau một khoảng im lặng.

Với HVE Work — các sếp thường mở app đột xuất để duyệt hồ sơ (không phải traffic liên tục 24/7) — đây chính là kiểu tải dễ gặp cold-start nhất trên Vercel.

---

## 4. ĐỘ ỔN ĐỊNH / VẬN HÀNH — DỰA TRÊN SỰ CỐ THỰC TẾ ĐÃ GẶP

Đây là phần quan trọng nhất, vì các vấn đề dưới đây **đã thực sự xảy ra** trong quá trình triển khai HVE Work trên Vercel, không phải giả định:

| Sự cố | Nguyên nhân gốc | Xảy ra trên Vercel? | Xảy ra trên Railway? |
|---|---|---|---|
| Crash `ERR_REQUIRE_ESM` | Thư viện `@nestjs/throttler` compiled CJS `require()` một package thuần ESM — môi trường runtime serverless của Vercel không hỗ trợ `require(esm)` đồng bộ như Node local | Có (đã fix bằng cách viết lại rate-limiter tự code) | Không áp dụng (Railway chạy Docker/Node bình thường, không có giới hạn runtime đặc thù này) |
| Lỗi build "expression is not callable" (helmet) | TypeScript resolution khác nhau giữa Windows-local và môi trường build Linux của Vercel | Có (phải fix bằng ép kiểu thủ công) | Không tái hiện (build bằng Dockerfile tự kiểm soát toàn bộ môi trường, giống hệt local) |
| Function chạy sai vùng địa lý (region) | Vercel mặc định chạy ở Mỹ (iad1) dù đã cấu hình gần Việt Nam | Có (phải tự thêm `"regions": ["hkg1"]` vào vercel.json) | Đã tự chọn Singapore ngay từ đầu, ít phải tinh chỉnh |
| ERESOLVE khi `npm install` | Xung đột phiên bản peer dependency giữa NestJS 12 và thư viện cũ | Có (phải thêm `.npmrc` với `legacy-peer-deps`) | Không gặp (Docker build kiểm soát chặt hơn) |
| Cold-start làm chậm request đầu tiên | Bản chất serverless — container "ngủ" khi không có traffic | Có (không thể khắc phục hoàn toàn, chỉ giảm bớt) | Không có khái niệm này |

**Nhận xét khách quan:** phần lớn các sự cố trên là do bản chất kiến trúc **serverless** của Vercel (môi trường chạy code bị đóng gói/giới hạn khác với máy thật), không phải Vercel "kém" — nó đánh đổi để lấy chi phí thấp và tự động mở rộng. Với một ứng dụng NestJS truyền thống có kết nối DB liên tục như HVE Work, mô hình server chạy liên tục (Railway) tự nhiên hợp hơn, ít phải "vá" các vấn đề tương thích.

---

## 5. ĐIỂM VERCEL VẪN LÀM TỐT HƠN

- **Miễn phí (hiện tại)** — nếu công ty không quan tâm vấn đề ToS thương mại, đây vẫn là lợi thế chi phí rõ ràng.
- **CDN toàn cầu cho tài nguyên tĩnh** — nếu sau này mở rộng ra nhiều khu vực/nhiều người dùng quốc tế, Vercel có hạ tầng CDN mạnh hơn hẳn.
- **Tự động scale theo traffic** — nếu số lượng người dùng tăng đột biến, Vercel tự nhân bản container, không cần cấu hình gì thêm. Railway ở gói Hobby chỉ chạy 1 replica cố định (gói $5 giới hạn 1 vùng, phải nâng Pro mới multi-region/nhiều replica).
- **Phù hợp cho frontend** — đây là lý do mình **vẫn giữ frontend HVE Work trên Vercel**, chỉ chuyển phần backend.

---

## 6. KHUYẾN NGHỊ

Cho quy mô hiện tại của HVE Work (vài chục người dùng nội bộ, không phải traffic công khai lớn):

1. **Giữ kiến trúc lai (đã làm):** Frontend trên Vercel (đúng sở trường, miễn phí, CDN tốt) + Backend trên Railway (server liên tục, ổn định hơn cho NestJS + DB).
2. **$5/tháng là chi phí hợp lý** để đổi lấy việc giảm hẳn các lớp vá lỗi tương thích serverless đã liệt kê ở mục 4 — tính theo giờ công debug các lỗi đó trong buổi triển khai vừa qua, $5/tháng là rẻ.
3. **Không cần vội tắt Vercel backend cũ** — giữ lại vài tuần làm dự phòng, theo dõi Railway chạy ổn định trước khi quyết định tắt hẳn (đỡ tốn thêm phí gì vì Vercel vẫn đang free).
4. Nếu sau này công ty cần Vercel Pro vì lý do khác (ví dụ: cần thêm băng thông cho frontend), lúc đó nên tính lại tổng chi phí Pro ($20/người/tháng) so với Railway ($5/tháng cố định) — khi đó Railway sẽ càng có lợi thế chi phí rõ ràng hơn.

---

*File này bổ sung cho `BAN_GIAO_CHO_LONG_PHO_PHONG_IT.md` — Long dùng cả 2 file khi báo cáo lại anh Định.*
