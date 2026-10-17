# Lịch nghỉ, số dư phép và xác nhận kết quả hỗ trợ

## Chức năng 6: nghỉ phép

Trang **Nghỉ phép** có số dư phép năm và lịch phòng ban. ADMIN chọn nhân viên/năm để nhập hạn mức, theo bước 0,5 ngày; không có hạn mức mặc định và không tự chuyển dư sang năm sau. Chưa nhập hiện **Chưa cấu hình**, khác với hạn mức thực tế bằng 0.

- Loại nghỉ: phép năm, không lương, nghỉ ốm. Chỉ phép năm trừ hạn mức.
- Nghỉ cả ngày hoặc nửa ngày sáng/chiều. Nghỉ nửa ngày chỉ áp dụng trong một ngày; có thể gửi riêng sáng và chiều nếu không trùng buổi.
- Ngày làm việc, ngày lễ và múi giờ lấy từ cấu hình SLA hiện hành; số giờ SLA không đổi tỷ lệ ngày phép. Cả ngày là 1 ngày công, mỗi buổi là 0,5 ngày. Nếu SLA không cấu hình ngày làm việc, cần ADMIN bổ sung trước khi gửi đơn.
- Bản chụp lịch và từng ngày công lưu cùng đơn. Thay đổi lịch SLA sau đó không tính lại đơn đã gửi. Đơn không có ngày công bị từ chối; mỗi đơn tối đa 366 ngày theo lịch, có thể đi qua hai năm.
- Phép năm PENDING giữ chỗ số dư. APPROVED chuyển phần giữ chỗ sang đã dùng, không trừ lần hai. REJECTED/CANCELLED không tính vào số dư. Luồng cũ chỉ cho hủy đơn PENDING; đơn đã duyệt không tự hoàn phép.
- Đơn đi qua năm mới cần hạn mức riêng cho từng năm. Không thể gửi vượt số dư hoặc giảm hạn mức xuống dưới tổng đã dùng và đang giữ chỗ. Ghi nửa ngày bằng số nguyên để tránh làm tròn.
- Đơn cũ được migration đánh dấu `LEGACY`, giữ nguyên ngày và trạng thái, không tự suy đoán loại phép hay trừ số dư. Giao diện báo số đơn chưa phân loại. Khi khởi tạo hạn mức, ADMIN phải đối chiếu phần phép năm đã dùng trong dữ liệu cũ và nhập hạn mức khả dụng tương ứng; hệ thống chỉ theo dõi phần sử dụng mới.

Mỗi người xem được lịch của phòng ban hiện tại; ADMIN có thể chọn phòng ban khác. Lịch chỉ trả về tên, ngày/buổi và trạng thái, **không trả lý do hoặc loại nghỉ**. Chi tiết đơn vẫn chỉ dành cho người gửi/người duyệt được chỉ định; quyền ADMIN không tự mở quyền đọc lý do. Số dư cá nhân chỉ người đó và ADMIN xem được.

Lịch hiển thị cảnh báo khi từ hai người nghỉ trùng buổi, gồm cả đơn chờ duyệt; đây là thông tin để bố trí công việc, không tự chặn duyệt. Lịch phân trang 100 đơn, nếu có nhiều trang thì số người/cảnh báo được ghi rõ chỉ tính trang đang xem. Đơn cũ chưa có lịch công được thể hiện theo khoảng ngày gốc và nhãn lịch cũ.

API mới, đều yêu cầu đăng nhập:

| API | Chức năng |
| --- | --- |
| `GET /api/leave-request/balance?year=2035&userId=1` | Số dư; `userId` khác mình chỉ dành cho ADMIN |
| `PUT /api/leave-request/entitlements/:userId?year=2035` | ADMIN ghi `{ days: 12.5, version: 0 }`; version 0 khi chưa cấu hình |
| `GET /api/leave-request/calendar?month=2035-01&page=1&departmentId=1` | Lịch phòng ban, phạm vi được kiểm tra ở server |
| `POST /api/leave-request/preview` | Tính ngày công và xem số dư trước khi gửi, không giữ chỗ |

`POST /api/leave-request` thêm `type: ANNUAL|UNPAID|SICK` và `period: FULL_DAY|MORNING|AFTERNOON`. Bỏ hai trường dùng ANNUAL/FULL_DAY cho đơn mới. Giữ chỗ, đơn, audit và outbox ghi trong cùng transaction Serializable có retry; từ chối/hủy giải phóng giữ chỗ theo trạng thái, không ghi sổ trừ/cộng lặp.

## Chức năng 7: kết quả ticket

Khi ticket RESOLVED, người tạo có thể **Xác nhận đã giải quyết** để chuyển CLOSED hoặc **Yêu cầu xử lý tiếp** kèm lý do 5–2.000 ký tự để chuyển IN_PROGRESS. ADMIN/IT_STAFF chuyển sang RESOLVED; việc đóng ticket mới cần người tạo xác nhận, kể cả khi người gọi là ADMIN. Không tự đóng theo thời gian. Ticket CLOSED/CANCELLED vẫn là trạng thái cuối.

- Mỗi lần chuyển RESOLVED tăng `resolutionVersion`. Phản hồi phải khớp phiên bản và trạng thái hiện tại; phản hồi từ lần xử lý trước trả 409, không tác động lần mới. Giao diện giữ bản nháp khi xung đột và tải lại thông tin.
- Xác nhận giữ thời điểm giải quyết thực tế. Yêu cầu xử lý tiếp xóa `resolveAt`, giữ người phụ trách và cam kết SLA ban đầu; lý do được lưu thành bình luận và có lịch sử trạng thái. Báo cáo mở lại hiện có tiếp tục nhận đúng lịch sử này.
- Ticket đóng cho phép người tạo đánh giá một lần từ 1–5 sao. Mức 1–2 cần lý do ít nhất 5 ký tự; nhận xét tối đa 2.000 ký tự. Đánh giá không sửa/xóa qua API. Người xem được ticket có thể đọc đánh giá.
- Dữ liệu đánh giá lưu người gửi, người phụ trách tại thời điểm đánh giá, phiên bản xử lý và thời gian. Ticket CLOSED từ trước migration vẫn có thể được người tạo đánh giá.
- Thay đổi trạng thái, lịch sử/bình luận, audit và outbox cùng transaction. Dùng thông báo trạng thái hiện có cho người liên quan; không tạo thêm cấu hình email. Lỗi audit/outbox rollback thay đổi.

| API | Chức năng |
| --- | --- |
| `POST /api/tickets/:id/confirm` | `{ resolutionVersion }` |
| `POST /api/tickets/:id/reopen` | `{ resolutionVersion, reason }` |
| `GET /api/tickets/:id/feedback` | Đánh giá hoặc null, áp dụng quyền xem ticket |
| `POST /api/tickets/:id/feedback` | `{ score, comment? }`; chỉ người tạo, ticket CLOSED |

## Triển khai

Migration mới: `20261018160000_add_leave_planning_and_ticket_feedback`. Chỉ bổ sung cột/bảng/chỉ mục và khóa ngoại, không xóa dữ liệu hoặc sửa migration cũ. Startup và `/db-health` yêu cầu schema mới.

Sao lưu và kiểm tra đúng database đích trước khi deploy. Lệnh `npm run start:deploy` có sẵn chạy `prisma migrate deploy` trước khi khởi động API. Deploy backend trước frontend. Không cần biến môi trường hay dependency mới. Sau deploy, ADMIN nhập hạn mức từng người/năm và kiểm tra danh sách ngày lễ trong SLA.

Các kết quả kiểm tra local và Docker dùng dữ liệu/container tạm, không chứng minh CI từ xa hay production đã triển khai thành công.

## Kiểm chứng local ngày 18/10/2026

- Backend: lint, Prisma validate/generate, build Nest và build image Linux đạt. 725 unit test / 68 suite; coverage statements 66,87%, branches 65,19%, đạt ngưỡng CI hiện hành.
- 31 kiểm thử HTTP E2E qua Nest/JWT/ValidationPipe thật; 9 kiểm thử metrics HTTP và 7 kiểm thử an toàn cô lập môi trường đạt.
- 32 kiểm thử integration trên MySQL 8.4/Redis tạm, chạy toàn bộ 24 migration từ database trống. Bao gồm gửi phép đồng thời không vượt số dư, giữ chỗ/giải phóng, không trừ lại khi duyệt, dữ liệu riêng tư, phản hồi ticket đồng thời, chống đánh giá trùng và rollback khi audit/outbox lỗi.
- Frontend: lint, build production kèm TypeScript, 38 kiểm thử hồi quy và toàn bộ 38 kiểm thử trình duyệt đạt. Sáu luồng mới kiểm tra cả sáng/tối và các chiều rộng 320/390/768/1440px; các kiểm thử form/dashboard/tài sản trước đó tiếp tục đạt.
- Image chạy bằng CMD mặc định `start:deploy` với database/Redis riêng: migration, `/health`, `/db-health`, Prisma schema diff không có khác biệt; HTTP thật kiểm tra đăng nhập, hạn mức hợp lệ, nửa ngày, duyệt/số dư, lịch không lộ lý do, lỗi trùng 409, chặn staff xác nhận 403, phiên bản cũ 409, đánh giá một lần và thông báo qua outbox.
- Không sửa lockfile, không thêm dependency/biến môi trường, không chạy migration trên database làm việc hoặc production. Chưa push/deploy và chưa có kết quả CI từ xa; không coi các kiểm tra local là xác nhận quét bảo mật từ xa.
