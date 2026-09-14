# Phase 5 — Test và tách TicketsService

## Phạm vi và kết quả

Đã bổ sung test trước khi tách service, giữ nguyên route/controller/DTO/response và ranh giới transaction.
Không đổi schema, SQL migration, quyền nghiệp vụ hoặc timeout transaction trong phase này.
Các thay đổi Phase 4/config và Docker của người dùng được giữ riêng, không phải kết quả của refactor này.

Kiểm tra local ngày 13/09/2026:

- Unit: 49 suites, 420 tests qua.
- HTTP contract: 2 suites, 21 tests qua; authentication/persistence/dependency ngoài được mock.
- Integration: 13 tests qua với MySQL 8.4 và Redis 8 thật trong container tạm.
- Safety: 7 tests qua, chặn nhầm database/Redis/môi trường.
- Lint, build và kiểm tra TypeScript qua.

Máy thực hiện kiểm tra đang dùng Node 24.14.1, trong khi package khai báo Node 22 (`>=22 <23`).
Cần chạy lại trên Node 22 của môi trường CI/deploy để xác nhận tương thích môi trường đó.
Không deploy, commit hoặc push trong phase này. Không test API Cloudinary thật hoặc gửi mail thật.

## File nào làm gì?

Các đường dẫn dưới đây tương đối với `officeflow-nest-server`.

| File | Trách nhiệm |
|---|---|
| `src/tickets/tickets.service.ts` | Facade giữ tên hàm cho controller, chuyển lời gọi đến service chuyên trách |
| `src/tickets/ticket-query.service.ts` | Danh sách, chi tiết, lịch sử; pagination, filter SLA và response projection |
| `src/tickets/ticket-workflow.service.ts` | Tạo/sửa ticket, đổi trạng thái, giao người xử lý, xóa ticket, liên kết tài sản; điều phối transaction/audit/outbox/cache |
| `src/tickets/ticket-attachment.service.ts` | Upload, metadata, ký URL, download và xóa attachment |
| `src/tickets/ticket-comment.service.ts` | Đọc/thêm comment, ghi history và enqueue sự kiện trong transaction |
| `src/tickets/ticket-access-policy.service.ts` | Phạm vi danh sách và quyền đọc ticket cho employee/manager/admin/IT |
| `src/tickets/ticket-history.util.ts` | Ghi history bằng transaction được truyền vào; giới hạn old/new value 191 ký tự |
| `src/tickets/ticket-delivery.util.ts` | Diễn giải metadata Cloudinary/legacy và content type, không gọi API ngoài |
| `src/tickets/tickets.module.ts` | Đăng ký các service mới vào Nest DI |
| `src/tickets/tickets.service.spec.ts` | Giữ test hành vi cũ; chạy qua facade và các service thật với Prisma/Cloudinary mock |
| `src/tickets/ticket-access-policy.service.spec.ts` | Test ma trận vai trò, phòng ban, sở hữu và ticket không tồn tại |
| `src/redis/redis.service.spec.ts` | Test lifecycle, JSON, TTL options, version cache, lỗi command và shutdown với client mock |
| `src/assets/assets.operations.spec.ts` | Bổ sung create/read/update/return/status; kiểm tra transaction và conditional updates |
| `src/cloudinary/cloudinary.service.spec.ts` | Bổ sung lỗi metadata, destroy idempotent/lỗi, download thất bại, URL không tin cậy và kích thước thực tế |
| `test/integration/backend.integration-spec.ts` | Test thật DB transaction/rollback/concurrency/RBAC/attachment và Redis TTL/version/throttling |
| `test/integration/compose.yml` | MySQL/Redis riêng cho test, chỉ bind loopback, không dùng volume/bind mount của app |
| `test/integration/jest.config.cjs` | Chọn suite integration riêng, không trộn vào unit tests |
| `test/integration/safety.cjs` | Chặn chạy test nếu URL, prefix hoặc cờ môi trường không đúng target cách ly |
| `scripts/test-integration.cjs` | Tạo project Docker ngẫu nhiên, chờ health, migrate DB test, chạy Jest, finally dọn container test |
| `scripts/integration-safety.test.cjs` | Kiểm tra guard chặn production/URL khác mà không kết nối DB |
| `test/setup-env.cjs` | Đặt cấu hình giả trước khi HTTP test import AppModule; không dùng credentials ứng dụng |
| `test/app.e2e-spec.ts` | Override Prisma/Redis/Mail/worker để HTTP tests không truy cập dịch vụ thật |
| `test/jest-e2e.json` | Đăng ký setup môi trường HTTP test |
| `package.json` | Lệnh integration/safety mới; E2E dùng VM modules giống unit để hỗ trợ dependency ESM |

`assets.service.spec.ts` đã có test giao tài sản trước phase này và được giữ nguyên.
Các rule đổi trạng thái vẫn ở `ticket-status.policy.ts`; quyền ghi gắn với từng workflow vẫn được giữ trong workflow/attachment service.
Không dùng kế thừa một base service khổng lồ và không tạo vòng phụ thuộc giữa các service.

## Luồng tạo ticket

1. `TicketsController.create()` nhận DTO đã validate, gọi `TicketsService.create()` như trước.
2. Facade gọi `TicketWorkflowService.create()`.
3. Workflow kiểm tra category rồi mở Prisma transaction.
4. Trong cùng callback: tạo ticket → `createTicketHistory(transaction, ...)` → `AuditLogsService.create(..., transaction)` → `OutboxService.enqueue(transaction, ...)`.
5. Nếu một bước lỗi, database rollback; không có ticket đã lưu nhưng thiếu history/outbox do commit một phần.
6. Sau commit, workflow phát sự kiện vô hiệu hóa dashboard cache. Facade trả nguyên kết quả về controller.

`enqueue` là ghi công việc/sự kiện chờ xử lý vào outbox, chưa phải gửi email ngay.
`OutboxProcessor` hiện có sẽ đọc các sự kiện đã commit và chuyển đến handler. Phase này không thay worker.

## Luồng đọc ticket và comment

`TicketsController` → `TicketsService` → `TicketQueryService` → `TicketAccessPolicyService` → Prisma.

Query gọi `getScope()` để giới hạn dữ liệu danh sách, hoặc `assertCanView()` khi đã đọc metadata của ticket.
Quy tắc manager không có phòng ban được giữ nguyên: list fallback về ticket của mình, nhưng detail không tự mở rộng quyền.

Khi thêm comment: `TicketCommentService` gọi `canAccessTicket()` trước, rồi transaction ghi comment + history + outbox.
Không gửi mail trong transaction; lỗi enqueue làm comment/history rollback (được kiểm tra bằng MySQL thật).

## Luồng attachment

### Upload

`TicketsService.uploadAttachment()` chuyển đến `TicketAttachmentService`.
Service kiểm tra quyền, chuẩn hóa tên, gọi `CloudinaryService.uploadFile()`, rồi lưu metadata/history trong DB transaction.
Nếu lưu DB thất bại, gọi cleanup Cloudinary với đúng publicId/resourceType/deliveryType. Hành vi này được giữ từ code cũ.

### Download

Attachment service kiểm tra quyền và quan hệ attachment–ticket trước khi ký URL.
Sau đó gọi `CloudinaryService.downloadFile()` và trả buffer, tên file gốc, content type.
Người không có quyền bị chặn trước khi gọi ký URL/download.

### Delete

Xóa metadata + ghi history + enqueue công việc xóa Cloudinary trong cùng transaction.
Không gọi destroy Cloudinary trực tiếp trước khi commit. Worker hiện có xử lý công việc sau đó.
Nếu enqueue thất bại thì metadata/history rollback; integration test xác nhận attachment vẫn còn.

## Integration test thực sự kiểm tra gì?

Không mock Prisma/database hoặc Redis client. Test dùng service thật và SQL/Redis commands thật.
Cloudinary được mock có chủ đích để tránh upload/download tài nguyên bên ngoài.
Một số test cố tình mock phương thức audit/enqueue để ép lỗi; rollback được xác nhận bằng đọc dữ liệu thật sau lỗi.

- Ticket/history/audit/outbox commit cùng nhau.
- Rollback create/comment khi outbox thất bại.
- Hai request tranh cùng asset: đúng một request thắng và chỉ có một lịch sử giao đang mở.
- Rollback asset/history khi audit thất bại; return đóng lịch sử giao.
- Người ngoài không đọc ticket và không ký URL attachment.
- Attachment deletion rollback khi enqueue lỗi; retry hợp lệ ghi job xóa cùng metadata deletion.
- Đổi trạng thái ghi history; transition không hợp lệ bị từ chối.
- Redis JSON, TTL thật, key hết hạn, version tăng đồng thời không trùng.
- Hai limiter dùng chung Redis cùng thấy giới hạn; client ngắt kết nối chuyển sang memory fallback.

## Cách chạy lại

Trong thư mục backend, dùng Node theo `package.json` và bật Docker Desktop (Linux containers):

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:integration:safety
npm run test:integration
npm run lint
npm run build:ci
```

Lệnh integration tự chạy 21 migrations hiện có trên database trống `officeflow_phase5_test`.
MySQL test dùng port `13307`; Redis test dùng `16380`, không dùng port ứng dụng `3307/6380`.
Nếu port test bận hoặc Docker không sẵn sàng, lệnh thất bại, không chuyển sang database khác.

Runner đặt project tên `officeflow-phase5-<random>` và environment test cố định; không lấy target từ `.env`.
Container MySQL dùng tmpfs, không có volume dữ liệu lâu dài. `finally` chỉ dọn project test của lần chạy.
Nếu process bị force-kill, cleanup có thể không chạy: kiểm tra đúng project test được in ra trước khi dọn thủ công.
Không dùng `docker compose down -v`, `migrate reset`, `db push` hay seed trên Compose/database ứng dụng.

## Phạm vi chưa được tuyên bố hoàn tất

- Phase 4 Redis/config/lifecycle/readiness còn lại không được tự động gộp vào phase này.
- Phase 6 coverage gate, monitoring, scanning và alerts chưa triển khai.
- Không xác nhận lỗi handoff trên Render đã hết chỉ dựa vào các test local.
- Đây không phải chứng nhận đã kiểm thử mọi race condition hoặc performance trên production.
- Chưa smoke-test Cloudinary thật, gửi mail thật hoặc deploy bản refactor.
