# 64. Quyền thao tác thảo luận và tệp ticket

## 64 — đọc/ghi bình luận

`TicketCommentService` kiểm tra quyền trước khi bắt đầu transaction hoặc đọc bình luận. Manager có thể đã chuyển phòng ban sau lần kiểm tra đó nhưng vẫn ghi bình luận, tạo history/outbox hoặc nhận nội dung thảo luận của phòng ban cũ.

Đã chuyển kiểm tra quyền và thao tác dữ liệu vào cùng transaction Serializable, dùng helper retry hiện có. Policy nhận database client tùy chọn để đọc ticket, phòng ban manager và scope escalation trên cùng transaction. Giữ nguyên quyền ADMIN/IT, quyền sở hữu và giới hạn escalation; không mở rộng phạm vi truy cập.

Hai unit test mới thất bại trước khi sửa, thành công sau sửa. Hai hồi quy trên MySQL thực tạm dừng yêu cầu trước transaction, chuyển phòng ban manager rồi tiếp tục: cả đọc và ghi đều bị từ chối; không phát sinh comment/history/outbox. Tổng integration tại phần 64: 44/44 đạt; các container kiểm thử UUID đã được dọn.

## 64.1 — lưu tệp sau khi upload

`TicketAttachmentService.uploadAttachment()` kiểm tra quyền trước khi gọi Cloudinary nhưng không kiểm tra lại khi lưu metadata. Manager chuyển phòng ban trong thời gian upload vẫn có thể thêm tệp vào ticket cũ.

Giữ bước kiểm tra sớm để chặn upload trái quyền; kiểm tra lại quyền trong cùng transaction Serializable với việc lưu metadata/history. Upload vẫn nằm ngoài transaction và ngoài vòng retry. Nếu quyền bị thu hồi hoặc ticket bị xóa trong lúc upload, transaction không lưu metadata/history và cơ chế bù trừ hiện có xóa asset vừa upload.

Ba unit test kiểm tra quyền bị mất, từ chối trước upload và retry xung đột mà không upload hai lần. Hai test MySQL thực thay phòng ban hoặc xóa ticket ngay trong callback upload; cả hai từ chối lưu và gọi cleanup. Cloudinary được thay bằng fixture; không gọi dịch vụ bên ngoài.

## Kiểm chứng trước push

- 74 suite / 807 unit test; coverage vượt các ngưỡng CI.
- 32 E2E và 46 kiểm thử MySQL/Redis thực đạt; 24 migrations áp dụng thành công trên DB rỗng dùng riêng.
- Lint, Prisma generate/validate, build, 20 kiểm tra prototype/SQL-export/isolation/metrics đạt.
- Production audit backend: 0 advisory. Docker image build thành công; smoke test xác nhận đủ 24 migrations, bcrypt native hoạt động, undici 6.29.1, hai SQL export bị loại khỏi image.
- Prometheus kiểm tra 10 rules và bộ test thành công; Alertmanager example hợp lệ, kiểm tra bằng network bị tắt.

Trivy và Gitleaks phải đạt trước khi push. CI trên GitHub xác minh riêng sau khi nhánh được push; kết quả local không được ghi thành kết quả remote hoặc production.
