# Cấu trúc mã nguồn

OfficeFlow gồm hai ứng dụng cài đặt và build độc lập: `officeflow-client` và `officeflow-nest-server`. Tên thư mục ứng dụng được giữ ổn định để tránh đổi cấu hình hosting, CI và Docker khi chỉ sắp xếp mã nguồn nội bộ.

## Frontend

```text
officeflow-client/src/
├── app/                  # Route, layout và điểm vào của màn hình
├── features/             # Mã nguồn theo nghiệp vụ
│   └── tickets/
│       ├── pages/        # Điều phối query, state và các thao tác của màn hình
│       ├── components/   # Các phần giao diện có trách nhiệm cụ thể
│       ├── api.ts        # HTTP request và chuẩn hóa response
│       ├── hooks.ts      # Query, mutation và làm mới cache
│       ├── schemas.ts    # Validation và chuyển dữ liệu form
│       └── types.ts      # Hợp đồng dữ liệu của tính năng
├── components/           # UI và layout dùng chung
├── lib/                  # HTTP client, session và tiện ích kỹ thuật
└── types/                # Kiểu dữ liệu dùng chung
```

Các route lớn của ticket, users, knowledge và assets chuyển tiếp đến `features/*/pages/`. Feature page giữ quyền sở hữu query, mutation và bản nháp; component con nhận dữ liệu và callback qua props. Cách này giúp tách phần hiển thị mà không làm mất bản nháp khi refetch, retry hoặc thay đổi panel.

Kiểm tra quyền ở frontend phục vụ hiển thị và trải nghiệm. Backend vẫn kiểm tra quyền của mọi thao tác. Không chuyển kiểm tra quyền khỏi transaction khi sắp xếp code.

Feature nhỏ không cần tạo đủ mọi thư mục trong ví dụ. Chỉ đưa tiện ích vào phần dùng chung khi có nhiều nơi thực sự cần cùng một hành vi.

Regression tests chia theo nghiệp vụ trong `officeflow-client/tests/*.test.mjs`; helper dùng chung nằm ở `tests/helpers/`. Kiểm thử trình duyệt nằm trong `tests/browser/`. Các test sử dụng API fixture không thay thế kiểm chứng backend hoặc UAT.

## Backend

```text
officeflow-nest-server/src/
├── main.ts               # Khởi động HTTP, validation và middleware
├── app.module.ts         # Kết nối các module
├── app.controller.ts     # Thông tin API và health checks
├── modules/              # Module nghiệp vụ
├── platform/             # Redis, Cloudinary, metrics và outbox
├── contracts/events/     # Kiểu sự kiện và hợp đồng outbox dùng giữa module
├── common/               # Guard, decorator, filter và tiện ích dùng chung
├── config/               # Validation cấu hình môi trường
└── prisma/               # Prisma service, schema, migrations và seed
```

Các module nghiệp vụ giữ controller, DTO, service, policy và unit tests cùng nhau. Không gom tất cả controller hoặc service của ứng dụng vào một thư mục chung theo loại file.

`TicketsService` giữ API nội bộ cho controller; `TicketWorkflowService` chuyển tiếp phần giao việc tới `TicketAssignmentService`. `AssetsService` chuyển tiếp cấp phát, thu hồi và lịch sử cấp phát tới `AssetAssignmentService`. Các service mới được đăng ký qua Nest dependency injection. Transaction vẫn bao gồm cập nhật dữ liệu, history, audit và outbox như trước.

Hợp đồng sự kiện chia theo nghiệp vụ dưới `contracts/events/`. Phần này mô tả payload, tên sự kiện và metadata giao lại; không chứa thao tác gửi email hoặc tạo notification. Hàm định dạng hạn SLA nằm ở `common/formatting/`. Outbox xử lý lưu/giao lại; các listener nghiệp vụ quyết định tác động và người nhận.

Module `mail` có cả listener nghiệp vụ và SMTP transport, vì vậy hiện nằm trong `modules/`. Việc nằm trong nhóm `platform/` không tự làm một module thành độc lập với mọi phần còn lại; khi thêm phụ thuộc cần kiểm tra vai trò của code và tránh import vòng.

`src/prisma/` được giữ nguyên vì cấu hình Prisma, migrations trong Docker và kiểm tra CI đang dùng đường dẫn này. Thay đổi tổ chức module không sửa schema, lịch sử migration hoặc đường dẫn `dist/main.js`.

## Kiểm tra khi di chuyển file

1. Cập nhật import của source, unit tests, HTTP/integration tests và các `require` từ `dist/`.
2. Chạy lint, type check/build và kiểm thử tương ứng với phần thay đổi.
3. Với thay đổi DI hoặc transaction, chạy integration trên MySQL/Redis tạm bằng script hiện có.
4. Cập nhật liên kết tài liệu; giữ secrets, dữ liệu và báo cáo local ngoài Git.

Quy trình triển khai và rollback nằm trong [runbook backend](operations/backend-production-runbook.md).
