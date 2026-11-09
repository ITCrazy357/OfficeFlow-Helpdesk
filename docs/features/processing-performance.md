# Báo cáo hiệu quả xử lý

Dashboard bổ sung phần **Hiệu quả xử lý**, bộ lọc ngày tạo, CSV tổng hợp và hai biểu đồ. API: `GET /api/dashboard/performance?from=YYYY-MM-DD&to=YYYY-MM-DD`.

## Phạm vi và cách đọc

- Mặc định 30 ngày, bao gồm cả hai ngày đầu/cuối theo `Asia/Ho_Chi_Minh`. Tối đa 366 ngày; không nhận ngày không tồn tại, khoảng đảo ngược hoặc ngày kết thúc trong tương lai.
- Bộ lọc chọn **nhóm ticket theo ngày tạo**. Kết quả của nhóm được quan sát tại `generatedAt`, kể cả các phản hồi, xử lý, mở lại sau ngày kết thúc bộ lọc. Đây không phải ảnh chụp trạng thái tại một ngày trong quá khứ hoặc số lượt xử lý phát sinh trong kỳ.
- Phạm vi giữ nguyên quy tắc dashboard: ADMIN/IT_STAFF xem toàn bộ, EMPLOYEE xem ticket mình tạo, MANAGER xem ticket do người trong phòng ban hiện tại tạo. MANAGER chưa có phòng ban nhận 403. Ticket được chuyển cấp ngoài phòng ban vẫn có thể xem trong hàng đợi/chi tiết theo chính sách ticket; dashboard không gộp phạm vi đó.
- Các thống kê và biểu đồ cũ được ghi rõ là **toàn bộ ngày tạo**, không dùng bộ lọc của báo cáo mới.

## Chỉ số

| Chỉ số | Cách tính |
| --- | --- |
| Đã xử lý / đóng | Ticket trong nhóm hiện có trạng thái RESOLVED hoặc CLOSED / tổng ticket trong nhóm |
| Phản hồi đầu tiên TB | Từ `createdAt` đến `firstRespondedAt`, chỉ những ticket có mốc hợp lệ; phản hồi là bình luận đầu tiên của ADMIN/IT_STAFF khác người tạo |
| Giải quyết TB | Từ `createdAt` đến `resolveAt` của ticket hiện đã xử lý/đóng, dùng lần giải quyết cuối; có thể bao gồm nhiều chu kỳ mở lại |
| Tỷ lệ từng mở lại | Số ticket có lịch sử RESOLVED/CLOSED → OPEN/IN_PROGRESS / số ticket từng được xử lý. Mỗi ticket đếm một lần dù mở lại nhiều lần. Mẫu số lấy từ lịch sử hoặc trạng thái hoàn tất hiện tại |

Thời gian dùng **lịch SLA đã lưu trên từng ticket**, loại trừ giờ nghỉ, cuối tuần và ngày lễ có trong snapshot. Không áp dụng lịch ADMIN mới cho ticket cũ. Ticket chưa có snapshot giữ lịch 24/7 và hiện số lượng riêng. Đơn vị trên giao diện là giờ SLA; CSV dùng phút SLA. Mốc trống, trước ngày tạo hoặc trong tương lai không tính vào trung bình; hiển thị số mẫu, “—” khi không có mẫu. Khoảng thời gian hợp lệ bằng 0 vẫn là một mẫu. Không suy diễn mốc phản hồi từ bình luận cũ hoặc vai trò hiện tại của tác giả.

Lịch sử bị thiếu/xóa từ dữ liệu cũ không thể khôi phục số lượt mở lại; báo cáo chỉ dùng bằng chứng đã lưu.

## Biểu đồ, CSV và PDF

- **Tiến độ theo ngày tạo**: hai đường là ticket được tạo mỗi ngày và số trong cùng nhóm ngày đó hiện đã xử lý/đóng. Không phải số lượt giải quyết phát sinh mỗi ngày. Ngày không có ticket vẫn hiện 0.
- **Tuổi ticket tồn đọng**: tất cả OPEN/IN_PROGRESS trong phạm vi quyền, kể cả trước khoảng đã chọn. Tuổi thực tế từ ngày tạo, một ngày = 24 giờ, các nhóm `[0,1)`, `[1,3)`, `[3,7)`, `[7,14)`, từ 14 ngày. Không lẫn tuổi thực tế với thời gian SLA.
- Có bảng số liệu thay thế, trạng thái rỗng/lỗi, tải lại, hỗ trợ sáng/tối và màn hình nhỏ. Biểu đồ không chạy animation.
- CSV tổng hợp đúng bản báo cáo đang hiển thị, kèm ngày lọc, múi giờ, thời điểm quan sát, đơn vị, số mẫu và mẫu số. UTF-8 BOM cho Excel, CRLF, escape dấu nháy/xuống dòng và công thức bảng tính. Không xuất tiêu đề, nội dung hoặc thông tin cá nhân của ticket.
- **Xuất PDF** mở hộp thoại in của trình duyệt: chọn **Lưu dưới dạng PDF** (hoặc Microsoft Print to PDF). Bản in A4 riêng chứa đúng snapshot đang hiển thị, chỉ số/số mẫu, hai biểu đồ vector và đầy đủ bảng số liệu; không in sidebar, nút bấm hay bộ lọc đang sửa chưa áp dụng. Có tiếng Việt, phân trang và lặp tiêu đề bảng. Không gọi lại API hay thêm dependency. Tắt tùy chọn đầu/chân trang của trình duyệt nếu không muốn in URL và ngày in tự động.
- Lỗi mạng/5xx giữ bản tải thành công trước đó cùng thời điểm quan sát. Khi nhận 401/403, xóa bản báo cáo đã lưu ở mọi khoảng ngày; một lần tải lại bị 5xx sau đó không được làm hiện lại dữ liệu trước khi mất quyền.

## Triển khai

Không thêm dependency, biến môi trường hoặc migration. Tái sử dụng cache dashboard theo phiên bản dữ liệu, phạm vi quyền và khoảng ngày; TTL mặc định 60 giây (`DASHBOARD_CACHE_TTL_SECONDS` hiện hỗ trợ 5–300 giây). Nút làm mới đọc lại API nhưng có thể vẫn nhận bản cache cùng `generatedAt`. Bình luận mới có thể chờ hết TTL để cập nhật mốc phản hồi. Lỗi Redis đọc trực tiếp từ MySQL.

Một transaction MySQL `RepeatableRead` giữ dữ liệu nhất quán trong mỗi bản báo cáo. Ticket đọc theo lô 500 và cursor ID; lịch sử group theo ticket/chuyển trạng thái để không tải toàn bộ lịch sử hoặc query từng ticket. Tồn đọng dùng 5 truy vấn count; timeout transaction 30 giây. Không cắt âm thầm dữ liệu khi vượt một lô. Nếu dữ liệu lớn làm timeout, API trả lỗi và UI cho tải lại; không trả báo cáo thiếu.

## Kiểm tra cục bộ ngày 18/10/2026

- Backend: lint, build, 640 unit test / 63 suite; coverage 65,53% statements, 64,77% branches, đạt gate hiện tại. HTTP E2E 29 test với JWT guard/validation thật và Prisma giả lập; metrics HTTP 9 test.
- MySQL 8.4/Redis thật: 26 integration test, migrate đủ 22 migration trên database/container tạm; thêm 7 kiểm tra chống dùng nhầm database. Container kiểm thử đã dọn riêng sau chạy.
- Frontend: lint, TypeScript, production build, 29 regression test. Toàn bộ 26 Playwright test đã qua; chạy lại 3 test báo cáo sau thay đổi xử lý cache khi mất quyền cũng qua.
- Kiểm thử trình duyệt dùng API mô phỏng, kiểm tra dữ liệu/số mẫu, chọn ngày, CSV, ngày sai, trạng thái rỗng/lỗi, mất quyền rồi 503, bảng thay thế, không tràn ngang và ô ngày đủ rộng tại 320/390/768/1440px, cả sáng/tối. Đã xem ảnh desktop và mobile.
- Bổ sung PDF: 30 regression test frontend và 4 tình huống UI báo cáo đã qua (3 trường hợp báo cáo hiện có và 1 trường hợp PDF). Kiểm tra bản lọc đã áp dụng dù ô ngày đang sửa, vô hiệu hóa khi mất quyền, escape HTML, thiếu mẫu, dọn frame sau in. Hộp thoại in được giả lập trong automation; Edge tạo một file PDF thật từ bản in gồm đủ 366 dòng năm nhuận 2024, 14 trang A4. Đã xem ảnh bản in, xác minh khổ trang và font có bảng ánh xạ Unicode.

Các kết quả trên là kiểm tra cục bộ; chưa push, chạy GitHub Actions hoặc triển khai production. Không thay đổi dependency/schema/migration cho chức năng này. ESLint bỏ qua artifact kiểm thử sinh tự động để tránh lỗi thư mục `test-results` bị Playwright tạo lại trong lúc lint.
