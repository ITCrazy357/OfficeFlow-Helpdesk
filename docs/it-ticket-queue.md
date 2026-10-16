# Hàng đợi công việc IT

Trang `/tickets` có hàng đợi dành cho ADMIN và IT_STAFF:

- **Việc của tôi**, **Chưa được giao** và lọc theo từng người xử lý.
- Khi chọn hàng đợi hoặc một người, bộ lọc trạng thái chuyển sang **Đang cần xử lý** (OPEN và IN_PROGRESS). Có thể chọn trạng thái khác trong bộ lọc.
- Khối lượng công việc đếm riêng ticket OPEN và IN_PROGRESS. Nhân sự bị khóa/ngừng hoạt động vẫn xuất hiện để thấy công việc còn tồn, nhưng không thể nhận ticket mới.
- Chọn tối đa 10 ticket trên trang hiện tại, chọn người nhận và xác nhận giao. Đổi trang/bộ lọc sẽ bỏ lựa chọn cũ. Desktop và mobile đều hỗ trợ chọn ticket.
- Ticket RESOLVED, CLOSED và CANCELLED không được giao theo nhóm.

## API

`GET /api/tickets` bổ sung các query tùy chọn:

| Query | Ý nghĩa |
| --- | --- |
| `queue=MINE` | Người xử lý là tài khoản hiện tại |
| `queue=UNASSIGNED` | Chưa có người xử lý |
| `assignedToId=123` | Lọc theo người xử lý cụ thể |
| `activeOnly=true` | Chỉ lấy OPEN và IN_PROGRESS |

Không kết hợp `queue` với `assignedToId`, hoặc `activeOnly=true` với `status`; API trả 400 khi bộ lọc mâu thuẫn. Các bộ lọc vẫn áp dụng phạm vi đọc hiện có của EMPLOYEE/MANAGER, không mở rộng quyền xem ticket.

`GET /api/tickets/workload` dành cho ADMIN/IT_STAFF, trả `{ unassignedTickets, items }`. Mỗi item có thông tin nhân sự, `openTickets`, `inProgressTickets` và `totalTickets`. Dữ liệu được lấy bằng một query nhân sự và một query tổng hợp ticket, không đếm riêng cho từng người.

`PATCH /api/tickets/bulk-assign` dành cho ADMIN/IT_STAFF:

```json
{ "ticketIds": [1, 2], "assignedToId": 123 }
```

Danh sách chứa 1–10 ID nguyên dương, không trùng nhau. Người nhận phải là ADMIN/IT_STAFF đang hoạt động và không bị khóa. Mọi ticket phải còn tồn tại và đang OPEN/IN_PROGRESS.

Toàn bộ nhóm chạy trong một transaction Serializable, dùng cơ chế thử lại khi xung đột hiện có. Mỗi thay đổi giữ lịch sử, audit và sự kiện outbox như giao một ticket. Bất kỳ bước nào thất bại sẽ hoàn tác cả nhóm; ticket đã thuộc người nhận được bỏ qua, không tạo thêm thông báo.

Kết quả: `{ assignedCount, unchangedCount }`. Không cần migration database. Đây là thao tác giao lại rõ ràng: nhóm ticket đã có người xử lý có thể được chuyển sang người nhận mới.

## Kiểm chứng

- Unit/HTTP: phạm vi đọc, phân quyền, bộ lọc, giới hạn nhóm và người nhận không hợp lệ.
- MySQL/Redis dùng container tạm riêng: commit, tính lặp lại an toàn và rollback cả nhóm khi ghi outbox cho ticket thứ hai thất bại.
- Frontend: hợp đồng API và làm mới cache sau mutation.
