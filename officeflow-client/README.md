# OfficeFlow Client

Giao diện Next.js của OfficeFlow Helpdesk. Hướng dẫn cài đặt môi trường, cấu hình API và tài khoản mẫu nằm trong [README chung](../README.md).

## Tổ chức mã nguồn

- `src/app/`: route và layout.
- `src/features/`: màn hình, components, API, hooks, schemas và types theo nghiệp vụ.
- `src/components/`: UI và layout dùng chung.
- `src/lib/`: HTTP client, session và tiện ích kỹ thuật.
- `tests/*.test.mjs`: regression theo nghiệp vụ; helper ở `tests/helpers/`.
- `tests/browser/`: Playwright với API fixture.

Xem [quy tắc cấu trúc](../docs/architecture.md) trước khi thêm hoặc di chuyển file.

## Các lệnh chính

Chạy trong thư mục này: `npm run dev`, `npm run lint`, `npm test`, `npm run test:ui`, `npm run build`.
