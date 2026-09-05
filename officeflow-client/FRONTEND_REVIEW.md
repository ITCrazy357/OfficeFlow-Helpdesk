# Rà soát frontend OfficeFlow — 2026-09-05

Frontend có cấu trúc theo feature rõ: page → hook React Query → API → Axios dùng chung. Lint và TypeScript đã đạt ngay trước khi sửa, nhưng vẫn có lỗi ở xử lý lỗi mạng, tương tác thông báo, điều hướng và dữ liệu biểu mẫu. Đợt này tập trung sửa các lỗi có thể xác định từ code và đối chiếu API Nest hiện tại.

## Các lỗi đã sửa

| Mức độ | Vấn đề và tác động | Thay đổi |
| --- | --- | --- |
| Cao | Lỗi mạng/5xx khi lấy hồ sơ kích hoạt logout; refresh lỗi tạm thời xóa token và trả lại lỗi 401 ban đầu. Người dùng bị đăng xuất dù chưa xác nhận phiên hết hạn. | Chỉ xóa phiên khi nhận 401; giữ lỗi refresh thực tế; dashboard và trang đổi mật khẩu có màn hình thử lại. Không gọi logout qua mạng khi phiên đã bị từ chối. |
| Vừa | Đăng nhập thành công chỉ thay hồ sơ, có thể giữ cache dữ liệu từ phiên trước. | Xóa cache trước khi thiết lập tài khoản mới. |
| Vừa | Chuông thông báo lồng button trong button; thao tác bất đồng bộ không bắt lỗi; số chưa đọc chỉ được trừ dựa trên cache cục bộ. | Hai nút độc lập, báo lỗi thao tác, làm mới cả danh sách và số chưa đọc từ API. |
| Vừa | Trang Knowledge chỉ đọc URL lúc khởi tạo nên chuyển query trên cùng trang không cập nhật bài viết/bộ lọc. | Dùng useSearchParams, Suspense và khởi tạo lại nội dung khi query thay đổi. |
| Vừa | Xóa tóm tắt/tags rồi lưu bài viết vẫn giữ giá trị cũ vì payload bỏ trường rỗng. | Gửi chuỗi rỗng để cập nhật đúng ý định xóa. |
| Vừa | Xóa thương hiệu/model/serial/ghi chú tài sản cũng bị bỏ qua trong payload. | Tách payload cập nhật, gửi null cho trường văn bản bị xóa; giữ hành vi tạo tài sản. Serial rỗng không trở thành giá trị unique dùng chung. |
| Vừa | Mô tả ticket, bình luận, nội dung bài viết và tags có thể vượt giới hạn backend; kiểm tra ngày chấp nhận ngày không tồn tại. | Giới hạn nội dung 15.000 ký tự, tags 1.000 ký tự; kiểm tra ngày theo lịch thực tế cho nghỉ phép và tài sản. |
| Thấp | Sidebar mobile đã đóng vẫn có phần tử nhận focus bàn phím. | Dùng inert/aria-hidden, bỏ overlay khỏi thứ tự Tab khi đóng; đánh dấu mục điều hướng hiện tại bằng aria-current. |

## Giới hạn còn lại

- API cập nhật tài sản hiện chuyển ngày rỗng/null thành undefined nên chưa hỗ trợ xóa ngày mua/ngày bảo hành đã lưu (`officeflow-nest-server/src/assets/assets.service.ts`). Frontend đã chặn thao tác này với thông báo rõ; người dùng vẫn có thể giữ hoặc đổi ngày. Muốn hỗ trợ xóa thật cần bổ sung xử lý null ở backend.
- Chưa chạy kiểm thử tương tác trong trình duyệt hoặc E2E với API/database thật. Các bài kiểm tra refresh dùng Axios adapter giả lập; không chứng minh cấu hình cookie/proxy trên production.
- Không thay backend, schema, migration hoặc dữ liệu. Không commit/push.

## Kiểm chứng

Chạy trong `officeflow-client`:

- `npm run lint`: đạt.
- `npx --no-install tsc --noEmit`: đạt.
- `npm test`: 8/8 đạt, gồm refresh lỗi tạm thời, hết phiên, refresh đồng thời, đăng nhập thất bại, giới hạn nội dung, payload xóa trường và ngày không tồn tại.
- `npm run build`: đạt, biên dịch và sinh trang production thành công.
- `git diff --check`: đạt.

## File thay đổi

- Phiên đăng nhập: `src/lib/axios.ts`, `src/features/auth/hooks.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(auth)/change-password/page.tsx`; thêm `src/features/auth/components/session-error.tsx`.
- Thông báo: `src/features/notifications/components/notification-bell.tsx`, `src/features/notifications/hooks.ts`.
- Knowledge: `src/app/(dashboard)/knowledge/page.tsx`, `src/features/knowledge/schemas.ts`.
- Tài sản: `src/app/(dashboard)/assets/[id]/edit/page.tsx`, `src/features/assets/schemas.ts`, `src/features/assets/types.ts`.
- Nhập liệu: `src/features/tickets/schemas.ts`, `src/app/(dashboard)/tickets/[id]/page.tsx`, `src/features/leave-requests/schemas.ts`.
- Điều hướng: `src/components/layout/dashboard-sidebar.tsx`.
- Kiểm thử: thêm `tests/frontend-regressions.test.mjs`, thêm script `test` trong `package.json`; không thêm dependency.
- Thêm báo cáo này. Không xóa file có sẵn.
