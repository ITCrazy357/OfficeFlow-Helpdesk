# Phase 2: Transactional Outbox

## Mục đích và thứ tự gọi

`enqueue` nghĩa là đưa một công việc vào hàng đợi. Ở đây hàng đợi là bảng MySQL
`Outbox_events`. Hàm này ghi bản ghi bằng transaction client mà service truyền vào;
nó không gửi mail hoặc gọi Cloudinary ngay.

1. Controller nhận request, guard kiểm tra quyền, rồi controller gọi service nghiệp vụ.
2. Service dùng `prisma.$transaction()`: ghi dữ liệu, audit/history và gọi
   `OutboxService.enqueue(transaction, { type, payload })` trước khi commit.
3. Prisma commit tất cả hoặc rollback tất cả. API trả kết quả nghiệp vụ.
4. `OutboxProcessor.poll()` chạy mỗi 5 giây trong tiến trình NestJS, lấy tối đa 20
   event đến hạn, dùng conditional `updateMany()` để nhận từng việc.
5. Worker gọi `emitAsync(type, { ...payload, outboxEventId })`. Các listener outbox
   dùng `{ suppressErrors: false }`, trả Promise để worker đợi được và nhận lỗi.
   Không thêm `async: true` vào các listener này: wrapper của Nest có thể khiến
   EventEmitter2 trả đối tượng lịch chạy thay vì Promise của công việc.
6. Listener notification gọi `NotificationsService`, ghi notification với
   `sourceEventId`; listener mail gọi `MailService.sendEmail()`;
   listener cleanup gọi `CloudinaryService.deleteFile()`.
7. Worker đánh dấu `PROCESSED` khi các listener thành công, hoặc `FAILED` và lên
   lịch retry khi một listener lỗi. `PROCESSED` không phải bằng chứng mail đã tới inbox.

Ví dụ xóa attachment: `TicketsController` → `TicketsService.deleteAttachment()`
→ transaction xóa metadata, ghi history và `enqueue(cloudinary.asset.delete)`
→ commit → worker → `CloudinaryCleanupListener.handle()` → `CloudinaryService.deleteFile()`.
Attachment biến mất trên ứng dụng sau commit; file vật lý được dọn sau đó.
Upload thất bại khi lưu metadata vẫn cleanup trực tiếp vì transaction đã rollback.

## Các file chính

- `src/prisma/schema.prisma`: OutboxEvent, OutboxStatus và unique notification.
- `src/outbox/outbox.constants.ts`: tên và kiểu payload từng event.
- `src/outbox/outbox.service.ts`: enqueue và chặn một số trường chứa bí mật.
- `src/outbox/outbox.processor.ts`: polling, claim, heartbeat, retry, retention.
- `src/outbox/cloudinary-cleanup.listener.ts`: xử lý công việc xóa file.
- `src/outbox/outbox.module.ts` và `src/app.module.ts`: đăng ký các provider.
- Service trong tickets, assets, users, leave-requests, sla và password-recovery:
  ghi event trong transaction thay cho emit sau commit.
- `src/notifications/notifications.service.ts` và các notification listener:
  dùng sourceEventId + userId + type, createMany/skipDuplicates để chống trùng.
- Các mail listener: truyền lỗi về worker để retry.

## Chính sách vận hành

- Worker nằm trong backend; backend dừng thì hàng đợi chờ trong MySQL.
- Mỗi lần claim tăng attempts; tối đa 8 lần tự động. Backoff bắt đầu 5 giây,
  tăng gấp đôi, tối đa 5 phút. Thời gian thực tế còn phụ thuộc polling và backlog.
- Lease 2 phút, heartbeat mỗi 30 giây trong khi xử lý. Claim dùng timestamp mới
  cho từng event và kiểm tra attempts; cập nhật kết quả cũng kiểm tra chủ sở hữu.
- Worker khác có thể lấy lại lease hết hạn. Crash ở lần cuối được chuyển FAILED
  để kiểm tra thủ công, không để PROCESSING mãi.
- Cron 03:00 theo timezone server chỉ xóa PROCESSED cũ hơn 30 ngày.
- FAILED đủ 8 lần cần kiểm tra lastError, sửa nguyên nhân rồi replay có kiểm soát.
- Đây là at-least-once: sự cố sau khi SMTP nhận mail nhưng trước khi DB ghi kết quả
  có thể làm gửi mail lại. Một listener/recipient thất bại cũng có thể khiến listener/
  recipient đã thành công được chạy lại. Notification có unique key; SMTP chưa có
  cơ chế exactly-once. Xóa file Cloudinary trả `not found` được coi là thành công.
- `MAIL_ENABLED=false` chủ động bỏ qua mail; bật lại không tự gửi bù event PROCESSED.
- Link reset mật khẩu vẫn dùng event trực tiếp vì mang rawToken; chỉ sự kiện
  khôi phục thành công dùng outbox. Không ghi rawToken/password vào payload.
- Dashboard cache invalidation vẫn dùng event trực tiếp.

## Kiểm tra trước khi triển khai

Chạy từ thư mục `officeflow-nest-server`:

```powershell
npm run build
npx prisma validate
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

`outbox-dispatch.integration.spec.ts` dùng EventEmitterModule và listener thật,
mock DB/SMTP/Cloudinary. Test chờ handler hoàn tất, retry lỗi và truyền sourceEventId.
Unit test không chứng minh rollback/unique constraint trên MySQL thật hoặc mail tới inbox.

Trên môi trường staging đã backup và kiểm tra đúng DATABASE_URL, áp migration trước
khi chạy backend mới:

```powershell
npm run migrate:deploy
```

Migration `20260906170000_add_transactional_outbox` chỉ thêm bảng/cột/index.
Không dùng migrate reset, db push hoặc migrate dev trên dữ liệu thật.

Smoke test staging:

1. Tạo ticket/phân công tài sản/nghỉ phép: thấy dữ liệu và event được commit cùng nhau;
   worker chuyển event PROCESSED và xuất hiện thông báo đúng người.
2. Giả lập SMTP/Cloudinary lỗi trong staging: thấy FAILED, attempts tăng và availableAt
   lùi ra sau; khôi phục dịch vụ thì job thành công. Không gửi mail thử tới người dùng thật.
3. Xóa attachment: API trả thành công sau commit, metadata mất, event cleanup vẫn còn;
   worker xử lý rồi file Cloudinary bị xóa.
4. Dừng backend rồi chạy lại: PENDING vẫn được xử lý, PROCESSING cũ lấy lại sau hết lease.
5. Khôi phục mật khẩu hai lần với hai token hợp lệ: không xung đột deduplicationKey.
6. Trên DB thử nghiệm, làm outbox insert lỗi bên trong transaction: xác nhận dữ liệu
   nghiệp vụ không commit. Replay cùng event notification: số notification không tăng.

Truy vấn theo dõi (chỉ đọc):

```sql
SELECT status, COUNT(*) AS total, MIN(createdAt) AS oldest
FROM Outbox_events GROUP BY status;

SELECT id, type, attempts, availableAt, lockedAt, lastError
FROM Outbox_events
WHERE status = 'FAILED'
ORDER BY createdAt ASC LIMIT 50;
```

Replay đúng một event sau khi xem lỗi và xác nhận chấp nhận khả năng mail bị gửi lại.
Thay placeholder bằng ID đã kiểm tra, giữ điều kiện FAILED/attempts để tránh đụng job đang chạy:

```sql
UPDATE Outbox_events
SET status = 'PENDING', attempts = 0, availableAt = CURRENT_TIMESTAMP(3),
    lockedAt = NULL, lockedBy = NULL, lastError = NULL,
    updatedAt = CURRENT_TIMESTAMP(3)
WHERE id = '<verified-event-id>' AND status = 'FAILED' AND attempts >= 8;
```

Các bước staging/deployment là kiểm tra riêng; không tự suy ra đã chạy từ kết quả unit test.
