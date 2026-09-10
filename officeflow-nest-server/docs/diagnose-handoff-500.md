# Điều tra lỗi 500 của bàn giao và lỗi thiếu Outbox

## Bằng chứng hiện có

- Ảnh Network: `PATCH /users/19/handoff` trả 500. HTTP 500 chỉ là triệu chứng, chưa chỉ ra truy vấn lỗi.
- Ảnh Render: `OutboxProcessor` gọi `outboxEvent.updateMany()` thất bại vì thiếu bảng `Outbox_events`. Đây là worker chạy mỗi 5 giây, không phải stack trace của request bàn giao.
- Ngày 10/09/2026, kiểm tra **chỉ đọc** bằng `prisma migrate status` với DATABASE_URL của checkout cho thấy 21 migrations, còn đúng `20260906170000_add_transactional_outbox` pending. Người dùng đã xác nhận local và Render dùng chung database; chưa xác nhận có backup/snapshot khôi phục được.
- `UsersService.handoff()` cập nhật Users, Leave_requests và Audit_logs; không gọi OutboxService. Vì vậy áp dụng migration Outbox sửa được lỗi thiếu bảng đã xác nhận, nhưng chưa chứng minh sẽ sửa được 500 bàn giao.

## Khôi phục schema an toàn

1. Xác nhận đúng backend/database đích, đúng branch/commit đang triển khai. Không gửi DATABASE_URL, mật khẩu hoặc token vào chat/log.
2. Có backup/snapshot khôi phục được trước khi thay đổi schema.
3. Trong thư mục `officeflow-nest-server`, ở môi trường trỏ đúng database:

   ```powershell
   npx --no-install prisma migrate status
   ```

4. Đọc SQL của **mọi migration pending** trước khi áp dụng. Outbox migration hiện tại tạo bảng `Outbox_events`, thêm `Notifications.sourceEventId` và unique index chống trùng. Nó không xóa bảng. Nhưng trong lịch sử có migration `20260729195212_updateinsert` chứa DROP TABLE; nếu migration cũ này còn pending thì dừng, không chạy deploy hàng loạt.
5. Chỉ sau khi xác nhận đích, backup và danh sách pending an toàn:

   ```powershell
   npm run migrate:deploy
   npx --no-install prisma migrate status
   ```

   `migrate:deploy` áp dụng toàn bộ migration pending, không chỉ migration Outbox. Không tạo bảng thủ công rồi đánh dấu applied tùy tiện. Nếu lịch sử báo applied mà bảng vẫn thiếu, cần điều tra schema drift/nhầm database, không ép resolve.
6. Nếu migration thất bại giữa chừng, giữ log và dừng; không giả định MySQL đã rollback toàn bộ DDL. Kiểm tra cột/index/bảng nào thực sự tồn tại trước khi phục hồi.
7. Xác nhận trạng thái up-to-date, khởi động lại backend theo quy trình deploy. Repo có `start:deploy` = `prisma migrate deploy && node dist/main.js`; Docker đã dùng script này. `start:prod` chỉ chạy Node, không áp dụng migration. Chỉ chuyển Start Command của Render sau khi đã duyệt lịch sử migration và cấu hình đúng Root Directory.
8. Kiểm tra hết lỗi Outbox trong log và chạy smoke test nghiệp vụ trên dữ liệu test có kiểm soát. `/health` hoặc `SELECT 1` thành công không chứng minh đủ schema.

Không dùng `migrate reset`, `db push`, `migrate dev` hoặc seed để chữa lỗi production này. Các bước ghi dữ liệu ở trên chưa được agent thực hiện.

Đã chuẩn bị `scripts/backup-database.cjs`, nhưng chưa chạy thành công/chưa có dump. Việc sao chép toàn bộ dữ liệu production xuống local cần phê duyệt rõ ràng. Script yêu cầu `ALLOW_PRODUCTION_BACKUP=true`, dùng mysqldump với TLS xác thực bằng `certs/ca.pem`, snapshot transaction cho bảng InnoDB và không đặt mật khẩu trong command arguments. Thư mục mới dưới `.backups` bị Git bỏ qua; trên Windows, script đặt ACL chỉ cho tài khoản đang chạy và SYSTEM. SQL dump vẫn là plaintext, không phải file mã hóa; cần bảo vệ máy và không chia sẻ dump. Dấu hoàn tất và SHA-256 chỉ kiểm tra file được tạo xong, không thay thế thử restore vào database test riêng. Không chạy migration khi script báo lỗi hoặc chỉ có `.partial`.

## Theo dõi request bàn giao sau bản vá chẩn đoán

- `RequestLoggingInterceptor` tạo ID nội bộ và trả header `X-Request-Id`.
- `HttpExceptionFilter` dùng cùng ID trong error response và log `http_request_failed`, kèm method/path/status/duration/code Prisma và gợi ý cố định.
- Interceptor chỉ log request thành công; filter log lỗi một lần với status cuối cùng. Không log body, cookie, Authorization, thông báo lỗi Prisma nguyên bản hoặc metadata truy vấn.
- Lấy `requestId` trong Network → Response rồi tìm ID đó trên Render. Nếu request bị chặn ở proxy trước khi vào Nest, có thể không có ID này.
- `PrismaService.onModuleInit()` giờ kiểm tra cả schema Outbox/Notifications trước khi báo ready. Nếu thiếu bảng/cột, startup thất bại với tên migration cần kiểm tra; không tự tạo schema hoặc vô hiệu hóa worker để che lỗi.
- Hệ thống vẫn giữ lỗi 500 cho lỗi không được ánh xạ. Chưa tăng timeout hay retry P2028: P2028 chỉ nói lỗi transaction API, không phải mọi trường hợp đều có cùng nguyên nhân.

## Cách điều tra khi đi làm

### 1. Thu thập sự kiện cụ thể

Ghi môi trường, commit, thời điểm/timezone, method/path, payload không chứa bí mật, kết quả mong đợi và kết quả thực tế. Dùng request ID thay vì đoán theo một dòng log đỏ gần thời điểm đó.

### 2. Đi theo đúng luồng thực thi

`Trình duyệt → proxy → guard/DTO → controller → service → transaction → database → filter → response`.

Ở ca này: `users/page.tsx` → `useHandoffUser` → `handoffUserApi` → `UsersController.handoff` → `UsersService.handoff`. Chỉ theo các hàm thực sự được gọi; OutboxProcessor là một nhánh chạy nền riêng.

### 3. Tách sự thật khỏi giả thuyết

Ví dụ sự thật: database báo thiếu bảng Outbox. Giả thuyết: Render chưa áp dụng migration, hoặc trỏ nhầm database. Dùng `migrate status` và đối chiếu cấu hình để kiểm chứng. Giả thuyết khác: request bàn giao hết hạn transaction; chỉ xử lý như timeout khi log của chính request xác nhận.

### 4. Đặt câu hỏi có phép kiểm tra

| Câu hỏi | Kiểm tra |
|---|---|
| Request đã vào Nest chưa? | Có request ID/log cùng path không? |
| Bị từ chối nghiệp vụ hay lỗi hạ tầng? | Status cuối cùng, mã Prisma, stack vị trí nào? |
| Schema thiếu hay code truy vấn sai? | Migration history, schema hiện có, đúng database/commit? |
| Chỉ production bị hay local cũng bị? | So sánh cấu hình, version, latency, dữ liệu và quyền DB |
| Một lỗi trong worker có phải nguyên nhân HTTP 500? | Có nằm trong call chain/request ID đó không? |

### 5. Tái hiện an toàn và sửa nhỏ

Test policy với mock để kiểm tra nhánh; test transaction trên database test riêng để kiểm tra rollback/deadlock; test HTTP để kiểm tra guard/DTO/response. Không gửi lại thao tác bàn giao trên production một cách mù quáng: request có thể đã commit nhưng response bị mất trên đường về.

### 6. Xác minh sau sửa, không dừng ở build xanh

Chạy test hồi quy → deploy commit đã kiểm tra → xác nhận migration/schema → tái hiện có kiểm soát → kiểm tra dữ liệu/audit/số lượng trả về → theo dõi log. Nếu mới qua unit test thì báo đúng là unit test đã qua, không gọi là đã sửa production.

Mẫu báo cáo ngắn: **Triệu chứng → bằng chứng → nguyên nhân đã xác nhận → thay đổi → kiểm thử → phần chưa xác minh**.
