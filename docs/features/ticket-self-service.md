# Gợi ý tự xử lý trước khi gửi ticket

Trang `/tickets/new` tìm bài trong kho kiến thức sau khi người dùng ngừng nhập tiêu đề/mô tả 450 ms. Hiển thị tối đa 5 bài đã xuất bản; yêu cầu tìm cũ được hủy khi chuyển truy vấn. Truy vấn gợi ý được cấu hình dọn cache bộ nhớ sau 1 phút không còn sử dụng.

API hiện có `POST /api/knowledge/suggest-for-ticket` được dùng lại. Payload gợi ý được giới hạn theo DTO (150 ký tự tiêu đề, 5.000 ký tự mô tả), còn toàn bộ nội dung form vẫn được giữ để gửi ticket. Có thể tìm bằng mô tả khi chưa nhập tiêu đề.

Tìm kiếm dùng tối đa 8 từ khóa, giữ từ ngắn như VPN/IP/PC và loại từ chung tiếng Việt/Anh. Server lấy tối đa 30 ứng viên đã xuất bản, xếp theo mức trùng từ trong tiêu đề/tag/tóm tắt, rồi trả 5 bài. Bài cùng điểm giữ thứ tự cập nhật mới trước. Không tải nội dung toàn bộ các ứng viên và không gọi dịch vụ AI. Đây là tìm theo từ khóa, không phải tìm kiếm ngữ nghĩa trên toàn bộ kho.

Người dùng mở hướng dẫn ngay trong form. Nội dung hiển thị như văn bản, không chạy HTML. API đọc bài vẫn kiểm tra quyền; bài vừa bị gỡ xuất bản hoặc lỗi tải có thông báo riêng. Lỗi gợi ý không chặn tạo ticket.

**Đã giải quyết** xác nhận trong phiên nhập hiện tại và khóa thao tác gửi ticket, kể cả gửi bằng Enter. **Vẫn cần hỗ trợ** bật lại form với nội dung đã nhập. Sửa tiêu đề/mô tả làm xác nhận cũ không còn áp dụng. Không tự tạo/đóng ticket, không ghi thống kê tự xử lý và không lưu nội dung đang gõ vào database.

Tính năng chỉ xuất hiện khi tạo ticket, không ở form chỉnh sửa. Phần ứng dụng dùng lại dependency hiện có và không cần migration mới.

## Kiểm chứng

- Backend: `npm run test:cov -- --runInBand`; kiểm thử integration MySQL/Redis có bài đã xuất bản, bản nháp, gỡ xuất bản và tìm tiếng Việt không dấu.
- Frontend: `npm test`, `npm run lint`, `npm run build`.
- Browser: `npm run test:ui -- tests/browser/ticket-self-service.spec.ts` kiểm tra debounce, giữ toàn bộ draft, xác nhận tự xử lý, lỗi gợi ý/quyền đọc, phản hồi đến muộn và màn hình hẹp.
- Image deploy được thử trên MySQL/Redis tạm: chạy migration, health/DB-health, đăng nhập bcrypt và API gợi ý/đọc hướng dẫn qua HTTP thật. Kiểm tra này không thay thế việc xác nhận CI hoặc Render sau khi push.
