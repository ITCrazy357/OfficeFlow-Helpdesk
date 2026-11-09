# OfficeFlow Backend

REST API NestJS của OfficeFlow Helpdesk. Hướng dẫn cài đặt, biến môi trường, MySQL/Redis và seed nằm trong [README chung](../README.md).

## Tổ chức mã nguồn

- `src/modules/`: controller, DTO, service, policy và unit tests theo nghiệp vụ.
- `src/platform/`: Redis, Cloudinary, metrics và outbox.
- `src/contracts/events/`: hợp đồng sự kiện dùng giữa các module.
- `src/common/`: guard, decorator, filter và tiện ích dùng chung.
- `src/prisma/`: Prisma service, schema, migrations và seed; giữ nguyên vị trí.
- `test/`: HTTP E2E và integration MySQL/Redis dùng môi trường tạm riêng.

Xem [quy tắc cấu trúc](../docs/architecture.md), [tài liệu tính năng](../docs/features/) và [runbook production](../docs/operations/backend-production-runbook.md).

## Các lệnh chính

Chạy trong thư mục này: `npm run start:dev`, `npm run lint`, `npm run test:cov`, `npm run test:e2e`, `npm run test:integration` và `npm run build`.

`npm run start:deploy` chạy migration trước khi khởi động API; `npm run start:prod` chỉ chạy bản build. Chọn đúng database trước mọi lệnh migration hoặc seed.

Các ghi chép giai đoạn cũ nằm trong [lịch sử vận hành](../docs/operations/history/).
