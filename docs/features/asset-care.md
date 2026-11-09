# Bảo trì và bảo hành tài sản

## Sử dụng

- **Quản lý tài sản**: có tổng quan sắp hết bảo hành, đã hết bảo hành, lịch cần theo dõi; hai danh sách rút gọn 5 mục. Bộ lọc bảo hành trên danh sách tài sản cho phép xem đầy đủ các tài sản sắp hết/đã hết hạn, vẫn phân trang và kết hợp tìm kiếm/bộ lọc hiện có.
- **Tạo/sửa tài sản**: nhập tên và liên hệ nhà cung cấp. Có thể xóa hai trường này khi chỉnh sửa; không tạo thêm module nhà cung cấp riêng.
- **Chi tiết tài sản**: ADMIN và IT_STAFF lập lịch loại bảo trì, sửa chữa hoặc bảo hành; sửa lịch; ghi nhận hoàn tất; hủy lịch. Lịch sử có phân trang và lọc trạng thái.
- Khi hoàn tất, nhập ngày thực hiện, đơn vị cung cấp dịch vụ, kết quả/ghi chú và chi phí thực tế **VND**. Để trống chi phí nghĩa là chưa ghi nhận; `0` là chi phí thực tế bằng 0. Lưu bằng Decimal(12,0), truyền qua API dạng chuỗi số nguyên, không dùng số thực; giá trị từ 0 đến 999.999.999.999 VND.
- Lập lịch không tự thay đổi trạng thái vận hành, cấp phát hoặc người đang giữ tài sản. Luồng thu hồi trước khi chuyển trạng thái tài sản vẫn giữ nguyên. Tài sản LOST/RETIRED không lập lịch mới; lịch cũ vẫn được xem và chốt.
- Bản ghi COMPLETED/CANCELLED được giữ lại và không chỉnh sửa tiếp. Các lần thay đổi được ghi audit trong cùng giao dịch. Khi có người sửa trước, API trả 409; giao diện giữ bản nháp và tải lại danh sách để người dùng chọn bản mới nhất.

## Quy tắc đã thống nhất

Nhắc bảo hành trước **30 ngày**, thông báo **trong ứng dụng** cho các ADMIN/IT_STAFF đang hoạt động và không bị khóa; không gửi email. Chi phí bằng VND.

- Scheduler kiểm tra mỗi giờ, không cần giữ trang web mở. Cửa sổ bao gồm hạn bảo hành từ hôm nay đến ngày thứ 30; không nhắc hạn đã qua hoặc tài sản LOST/RETIRED. Dữ liệu ngày theo lịch `Asia/Ho_Chi_Minh`; các trường ngày mới chỉ nhận ngày YYYY-MM-DD hợp lệ. Ngày thực hiện không ở tương lai.
- Hạn bảo hành cũ là timestamp, nên lấy ngày Việt Nam cho cả truy vấn, hiển thị, chỉnh sửa và dấu nhắc; không cắt thẳng ngày UTC. Ngày dự kiến/thực hiện là SQL DATE và dùng khóa ngày riêng. Điều này tránh lệch một ngày đối với dữ liệu cũ có giờ UTC gần nửa đêm.
- Tài sản mới nhập có hạn còn dưới 30 ngày được xét ở lần kiểm tra tiếp theo. Nhắc **một lần cho mỗi cặp tài sản/ngày hết bảo hành**, không nhắc lặp hàng ngày. Đổi ngày bảo hành sẽ được xét theo ngày mới; quay lại ngày từng nhắc không gửi thêm lần nữa.
- Bảng đánh dấu riêng giữ việc chống gửi trùng sau khi outbox được dọn. Worker đọc theo lô 100, tra dấu đã gửi theo lô; tiếp tục qua các lô đã nhắc để tài sản phía sau không bị bỏ đói.
- Dấu đã gửi và outbox event được tạo trong transaction Serializable. Nếu ghi outbox thất bại, dấu cũng rollback. Nhiều instance cùng chạy vẫn chỉ có một dấu/event cho một mốc. Outbox xử lý retry theo cơ chế sẵn có; notification dùng sourceEventId để chống trùng khi giao lại.
- Trước khi phát thông báo, listener kiểm tra lại hạn/trạng thái tài sản và quyền/trạng thái người nhận. Không gửi thông báo cũ nếu ngày bảo hành đã được sửa. Nếu lúc tạo nhắc không có người nhận hợp lệ thì không ghi dấu; lần sau vẫn được xét.
- Lịch bảo trì đến hạn thể hiện trên tổng quan; việc lên lịch không tự tạo ticket hoặc tự đánh dấu thiết bị đang bảo trì.

## Phân quyền và API

Mọi endpoint quản trị dưới đây yêu cầu JWT/session hợp lệ và vai trò ADMIN hoặc IT_STAFF. EMPLOYEE/MANAGER không được đọc lịch sử, chi phí hoặc tổng quan quản trị, kể cả khi đang giữ tài sản. Các quyền xem tài sản cá nhân hiện có không thay đổi.

| Endpoint | Ý nghĩa |
| --- | --- |
| `GET /api/assets/care-overview` | Đếm và 5 mục bảo hành/lịch gần nhất |
| `GET /api/assets?warranty=EXPIRING` hoặc `EXPIRED` | Lọc danh sách tài sản theo hạn bảo hành |
| `GET /api/assets/:id/maintenance?page=1&limit=10&status=PLANNED` | Lịch sử, tối đa 100 bản ghi/trang |
| `POST /api/assets/:id/maintenance` | Lập lịch: title, kind, scheduledFor, vendor?, notes? |
| `PATCH /api/assets/:id/maintenance/:recordId` | Sửa lịch PLANNED, bắt buộc version |
| `PATCH /api/assets/:id/maintenance/:recordId/complete` | Chốt: version, performedOn, cost?, vendor?, notes? |
| `PATCH /api/assets/:id/maintenance/:recordId/cancel` | Hủy lịch: version |

Version khởi tạo 0, tăng mỗi lần sửa/chốt; điều kiện claim gồm cả assetId, recordId, trạng thái PLANNED và version. Không thể dùng record của tài sản khác để ghi chi phí. Giao diện không cập nhật lạc quan kết quả/chi phí; thành công hoặc thất bại đều tải lại dữ liệu tài sản liên quan. Mất quyền 401/403 xóa cache quản trị bảo trì/bảo hành.

## Migration và triển khai

Migration thêm: `20261018120000_add_asset_care` (hai cột nhà cung cấp, index hạn bảo hành, bảng lịch sử và bảng chống nhắc trùng; thêm loại notification). Không sửa/xóa migration cũ, không backfill lịch sử giả và không dùng dữ liệu demo trong ứng dụng.

1. Sao lưu và rà migration pending trên đúng database trước khi triển khai.
2. Sinh Prisma Client và build như quy trình hiện tại. `start:deploy` của image chạy `prisma migrate deploy` trước khi khởi động Nest; nếu chạy native `start:prod` thì cần thực hiện migration ở bước triển khai trước đó.
3. `/api/db-health` và startup kiểm tra cả schema tài sản mới; thiếu migration sẽ fail readiness, không báo khỏe chỉ vì kết nối được MySQL.
4. Không có dependency hoặc biến môi trường mới bắt buộc. Giữ outbox processor chạy để phân phối nhắc trong ứng dụng.

Kiểm thử dùng database/container tạm. Chưa áp dụng migration vào database đang sử dụng hoặc production; kết quả cục bộ không thay thế GitHub Actions/kiểm chứng triển khai thực tế.

## Kết quả kiểm tra cục bộ ngày 18/10/2026

- Backend: lint, Prisma validate, build; 675 unit test / 65 suite, coverage 66,55% statements và 64,84% branches, đạt gate CI. HTTP E2E 30 test với JWT/role guard thật và database giả lập; metrics HTTP 9 test, kiểm tra cách ly database 7 test.
- MySQL 8.4/Redis thật: đủ 23 migration và 28 integration test. Bao gồm tranh chấp hoàn tất, rollback khi audit lỗi, nhiều worker nhắc trùng, dọn outbox rồi kiểm tra không gửi lại, đổi hạn, và timestamp UTC ở ranh giới ngày thứ 30. Container/network kiểm thử đã dọn riêng.
- Frontend: lint, production build/TypeScript, 33 regression test. Toàn bộ 32 Playwright test đã qua; sau khi đồng bộ ngày bảo hành Việt Nam, chạy lại 5 trường hợp tài sản cũng qua. Các test trình duyệt dùng API mô phỏng; đã xem ảnh giao diện sáng/tối, desktop/mobile.
- Docker: build image từ mã cuối cùng, chạy CMD mặc định với MySQL/Redis tạm; tự migrate và khởi động được API; `/health`, `/db-health` đạt và schema diff không có khác biệt. HTTP với database/JWT thật đã kiểm tra đăng nhập bcrypt, thông tin nhà cung cấp, lập lịch, hoàn tất với cost dạng chuỗi chính xác, 409 khi dùng phiên bản cũ, 403 khi EMPLOYEE đọc lịch sử, tổng quan bảo hành và giao thông báo qua outbox processor thật.

Không push commit/image, không chạy GitHub Actions hoặc triển khai production trong lần kiểm tra này.
