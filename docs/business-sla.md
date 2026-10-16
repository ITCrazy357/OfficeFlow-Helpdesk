# SLA theo giờ hành chính

## Lịch mặc định đã thống nhất

- Thứ 2–6, 08:00–12:00 và 13:00–17:00; múi giờ `Asia/Ho_Chi_Minh`.
- Khẩn: 4 giờ làm việc; Cao: 1 ngày công; Trung bình: 3 ngày công; Thấp: 7 ngày công.
- Một ngày công mặc định là 8 giờ: các hạn tương ứng 240 / 480 / 1440 / 3360 phút.
- ADMIN nhập từng ngày lễ, Tết và nghỉ bù theo `YYYY-MM-DD` tại `/sla`. Không suy ra ngày nghỉ từ tổng số ngày hay lịch âm.
- Chưa có quy định về hạn phản hồi đầu tiên và thời gian báo trước: mặc định phản hồi để trống, cảnh báo bằng 0 (tắt). ADMIN có thể cấu hình riêng theo độ ưu tiên.
- Quá hạn sẽ thông báo ADMIN khả dụng và quản lý khả dụng của người xử lý, giữ nguyên người phụ trách.

Ví dụ theo lịch mặc định, không có ngày nghỉ bổ sung: ticket Khẩn tạo thứ 6 lúc 16:00 có hạn lúc 11:00 thứ 2. Nếu thứ 2 là ngày nghỉ được nhập trong cấu hình thì hạn chuyển sang 11:00 thứ 3.

## Quy tắc

Chính sách được lưu cùng ticket khi tạo. Sửa cấu hình chỉ áp dụng cho ticket mới; sửa độ ưu tiên và mở lại ticket không tự gia hạn hoặc xóa lịch sử vi phạm SLA. Các ticket cũ giữ nguyên hạn. Migration chỉ bổ sung thời điểm cảnh báo hiển thị cũ (24 giờ trước hạn), không bật email cảnh báo mới cho ticket cũ.

Phản hồi đầu tiên là bình luận đầu tiên của ADMIN/IT_STAFF khác người gửi yêu cầu. Giao ticket hoặc chuyển trạng thái chưa được tính là phản hồi. Thời điểm phản hồi và lịch sử bình luận được ghi trong cùng transaction. Phản hồi muộn vẫn được ghi nhận là vi phạm, kể cả khi worker chưa chạy.

Hoàn tất xử lý sau hạn cũng được đánh dấu vi phạm ngay khi chuyển sang RESOLVED. Chuyển CLOSED hoặc mở lại không xóa vi phạm đã ghi nhận.

Worker chạy mỗi phút, tối đa 100 ticket mỗi lượt. Cảnh báo trước hạn cũng tính theo phút làm việc; khoảng nghỉ trưa, cuối tuần và ngày nghỉ cấu hình không được tính. Mỗi mốc phản hồi/xử lý có cảnh báo và chuyển cấp riêng.

Cảnh báo dùng marker trong MySQL và sự kiện outbox trong cùng transaction. Nhiều worker không tạo cảnh báo trùng; marker được giữ sau khi outbox hết thời gian lưu. Thông báo trong ứng dụng chống trùng bằng `sourceEventId`. Email sử dụng cơ chế retry hiện có, vì vậy email đã gửi trước khi một người nhận khác lỗi có thể được gửi lại.

Quản lý ngoài phòng ban người gửi chỉ được đọc/thảo luận ticket khi thực sự nhận chuyển cấp và còn là quản lý của người xử lý. Chính sách chỉ chuyển cấp ADMIN không cấp quyền này cho quản lý. Quyền sửa ticket và đổi trạng thái vẫn tuân theo policy hiện có.

## Cấu hình và API

ADMIN mở **Chính sách SLA** trên sidebar (`/sla`) để chỉnh lịch, ngày nghỉ, hạn phản hồi/xử lý, thời gian cảnh báo và người nhận chuyển cấp.

- `GET /api/sla/policy`: đọc `{ version, config, updatedAt }`.
- `PUT /api/sla/policy`: lưu `{ version, config }`; bản chỉnh sửa cũ trả 409, cần tải lại cấu hình. Lưu chính sách và audit là một transaction.
- Các thời hạn dùng phút. `responseMinutes: null` tắt hạn phản hồi; `warningMinutes: 0` tắt cảnh báo trước hạn.
- Các khung giờ phải theo thứ tự, không trùng nhau, dài ít nhất 15 phút. Ngày nghỉ phải là ngày thực, không trùng. Múi giờ phải hợp lệ.
- `GET /api/tickets` và các mutation trả thêm hạn phản hồi, thời điểm phản hồi, vi phạm phản hồi và thời điểm cảnh báo xử lý. Bộ lọc Sắp quá hạn dùng thời điểm cảnh báo lưu trên ticket.

## Database và kiểm chứng

Migration: `officeflow-nest-server/src/prisma/migrations/20261017120000_add_business_sla/migration.sql`.

Sau khi chọn đúng database triển khai, chạy `npm run migrate:deploy` trong `officeflow-nest-server` trước khi chạy phiên bản ứng dụng mới. Script `npm run start:deploy` đã chạy migration trước khi khởi động API. Không chạy seed/reset để thêm tính năng này.

Kiểm thử tập trung bao gồm lịch nghỉ trưa/cuối tuần/ngày lễ/DST, các mức hạn mặc định, DTO và quyền ADMIN, cấu hình có version, phản hồi đầu tiên, snapshot, rollback, cảnh báo đồng thời và phạm vi đọc của quản lý nhận chuyển cấp. Kiểm thử MySQL/Redis dùng container riêng; kiểm tra Edge dùng API giả lập, không gửi email thật.
