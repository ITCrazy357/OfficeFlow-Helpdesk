# Frontend cho Phase 3A–3C

## Đã kết nối

- `/users`: ADMIN có nút **Bàn giao** ở từng tài khoản và trong phần hướng dẫn trước khi vô hiệu hóa/đổi quyền.
- Form chỉ liệt kê MANAGER/ADMIN đang hoạt động, không bị khóa và khác người bàn giao. Không chọn sẵn người nhận; bắt buộc xác nhận trước khi gửi.
- Form gọi `PATCH /users/:id/handoff`, hiển thị `reportsTransferred` và `approvalsTransferred` backend trả về. Không tự vô hiệu hóa tài khoản hay gửi email.
- Backend kiểm tra tuyến quản lý, tự duyệt và các thay đổi đồng thời. Frontend không có đầy đủ cây quản lý nên không thể loại trước tất cả người nhận gây vòng lặp; lỗi server được giữ trong form để chọn lại.
- Khi bị chặn vô hiệu hóa, thông báo tiếng Việt giữ nguyên số ticket, tài sản, đơn nghỉ và nhân viên còn phải bàn giao.
- Không cho tự hạ quyền ADMIN; cảnh báo/bảo vệ ADMIN khả dụng cuối cùng theo danh sách hiện tại. Backend vẫn là nguồn quyết định cuối cùng.
- Các mutation vòng đời user làm mới cache user, phiên hiện tại, đơn nghỉ, ticket, tài sản và dashboard cả khi thành công lẫn thất bại. Không dùng optimistic update cho bàn giao.
- `/tickets/[id]`: chỉ hiện trạng thái hiện tại và các bước chuyển hợp lệ theo policy 3A. CLOSED/CANCELLED không thể đổi tiếp. Bắt đầu/mở lại công việc có người phụ trách không hợp lệ thì hướng dẫn giao lại.
- `/assets/[id]`: không chọn được người inactive hoặc bị khóa; kiểm tra lại lựa chọn trước khi gửi. Backend xử lý trường hợp trạng thái thay đổi sau đó.
- Khóa bảo mật vẫn độc lập: ADMIN/IT_STAFF dùng theo quyền cũ, không phải bàn giao trước khi khóa.

## Luồng code

`app/(dashboard)/users/page.tsx` quản lý panel, quyền hiển thị và thông báo.
`user-handoff-form.tsx` quản lý người nhận và xác nhận; gọi callback của page.
Page gọi `useHandoffUser()` trong `features/users/hooks.ts`.
Hook gọi `handoffUserApi()` trong `api.ts`; API dùng Axios chung và bóc response envelope.
Sau khi server trả lời, hook làm mới các query liên quan rồi page hiện kết quả hoặc lỗi.

`features/users/lifecycle.ts` chứa quy tắc hỗ trợ UI và bản dịch lỗi; không thay thế kiểm tra backend.
`features/tickets/status-policy.ts` chứa bảng chuyển trạng thái phía client; test đối chiếu trực tiếp 25 cặp với source policy backend để phát hiện lệch hợp đồng.

## Kiểm tra

```powershell
npm test
npm run lint
npx --no-install tsc --noEmit
npm run build
```

Test hiện dùng module thật với mock API/hook và sự kiện form; chưa phải browser E2E kết nối database thật. Test parity trạng thái cần source backend cùng checkout nhưng không cần cài dependency backend.

## Checklist trên môi trường test

1. Đăng nhập ADMIN → Người dùng → Bàn giao. Chọn người nhận, tick xác nhận, gửi; kiểm tra số lượng trả về.
2. Đăng nhập IT_STAFF: không có nút bàn giao/đổi quyền/vô hiệu hóa; chức năng khóa vẫn theo quyền cũ.
3. Chọn người nhận bị vô hiệu hóa từ một phiên khác: server từ chối; form giữ lỗi, danh sách được tải lại.
4. Chọn quản lý gây vòng lặp hoặc tự duyệt: thấy giải thích và có thể chọn lại. Không mất dữ liệu khi thất bại.
5. Vô hiệu hóa người còn ticket/tài sản: thấy số việc tồn đọng. Giao lại ticket, thu hồi/cấp lại tài sản bằng màn hình tương ứng; không mặc định bàn giao quản lý sẽ chuyển cả hai loại này.
6. Thử tự đổi role ADMIN và thử sửa ticket CLOSED/CANCELLED: UI không cho thao tác không hợp lệ.
7. Thu nhỏ màn hình, dùng Tab/Enter để chọn và xác nhận; kiểm tra lỗi, trạng thái pending và đường dẫn sang ticket/tài sản.

Triển khai backend có endpoint handoff cùng frontend. Chưa có realtime push giữa các trình duyệt; dữ liệu được kiểm tra lại khi refetch và khi server xử lý mutation.
