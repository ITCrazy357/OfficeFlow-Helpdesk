# 64. Quyền thao tác thảo luận và tệp ticket

## 64 — đọc/ghi bình luận

`TicketCommentService` kiểm tra quyền trước khi bắt đầu transaction hoặc đọc bình luận. Manager có thể đã chuyển phòng ban sau lần kiểm tra đó nhưng vẫn ghi bình luận, tạo history/outbox hoặc nhận nội dung thảo luận của phòng ban cũ.

Đã chuyển kiểm tra quyền và thao tác dữ liệu vào cùng transaction Serializable, dùng helper retry hiện có. Policy nhận database client tùy chọn để đọc ticket, phòng ban manager và scope escalation trên cùng transaction. Giữ nguyên quyền ADMIN/IT, quyền sở hữu và giới hạn escalation; không mở rộng phạm vi truy cập.

Hai unit test mới thất bại trước khi sửa, thành công sau sửa. Hai hồi quy trên MySQL thực tạm dừng yêu cầu trước transaction, chuyển phòng ban manager rồi tiếp tục: cả đọc và ghi đều bị từ chối; không phát sinh comment/history/outbox. Tổng integration tại phần 64: 44/44 đạt; các container kiểm thử UUID đã được dọn.
