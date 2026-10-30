# OfficeFlow — xử lý tiếp ECC, 2026-10-31

## Lịch sử GitHub

Đã force-push duy nhất `main` bằng `--force-with-lease`, từ commit người dùng đã push `0d0ef5c` sang lịch sử sạch `6b6c1d0`. Git tree hai HEAD giống hệt nhau: giữ nguyên toàn bộ F2–F7 đã commit. Hai branch phụ giữ nguyên SHA, không có tag hoặc ref pull request được quảng bá bởi remote tại thời điểm kiểm tra.

Đã kiểm tra không còn commit reachable chứa hai SQL dump trong các branch/tag hiện tại. Local đã đồng bộ bằng `reset --keep` trên hai cây giống nhau; các thay đổi đang làm và hai file SQL bị ignore vẫn được giữ nguyên.

**Giới hạn đã xác minh:** HEAD request tới một object dump theo SHA cũ vẫn trả HTTP 200 sau rewrite. Chỉ đọc status, không tải nội dung. Vì vậy chưa thể coi dữ liệu đã biến mất hoàn toàn khỏi GitHub. Cần chủ repo gửi yêu cầu xử lý cached views/unreachable sensitive objects qua [GitHub Support](https://support.github.com/), theo [hướng dẫn của GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Bản nháp yêu cầu nằm trong `.local-backups/github-support-request-20261031.md`, không đưa thêm đường dẫn trực tiếp tới object nhạy cảm vào tài liệu public này.

Các clone cũ cần đồng bộ lại lịch sử sạch hoặc clone mới. Không merge lịch sử cũ trở lại.

## CI sau rewrite

[Frontend CI của lịch sử sạch](https://github.com/ITCrazy357/OfficeFlow-Helpdesk/actions/runs/41097723878) đã thành công. [Backend verify](https://github.com/ITCrazy357/OfficeFlow-Helpdesk/actions/runs/41097723542/job/124207717714) cũng thành công, nhưng security job dừng ở Gitleaks.

Đã tái hiện bằng Gitleaks v8.30.1 với report redacted: chỉ có một finding ở fixture metrics. Rewrite đổi commit ID từ `ab55d88` sang `ca6145b`, làm fingerprint cũ không còn khớp. Đã so sánh Git blob và xác nhận fixture giống hệt, rồi remap đúng fingerprint của fixture, không bỏ qua file/rule chung hoặc secret mới. Ngoại lệ của SQL dump đã được bỏ vì đường dẫn đó không còn trong lịch sử reachable. Các ngoại lệ JWT đã được xác nhận retired trước đây vẫn giữ nguyên phạm vi.

Gitleaks local sau remap: **130 commit được quét, không còn finding**. Đây là kiểm tra secret, không phải bằng chứng xóa dữ liệu khỏi cache GitHub.

## Cảnh báo Low của công cụ phát triển

11 package warning (3 frontend, 8 backend) đều lan truyền từ cùng advisory `deepmerge` 4.3.1, không phải 11 lỗ hổng runtime độc lập. [Advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) hiện ghi chưa có phiên bản vá. Không hạ Jest/Nest CLI/shadcn về major cũ để làm số audit biến mất.

Đã áp dụng workaround `--disable-proto=throw` được nêu trong [báo cáo upstream](https://github.com/TehShrike/deepmerge/issues/273):

- Backend: `.npmrc` truyền flag cho các npm lifecycle/script và process con. Đã kiểm chứng lint, Prisma generate, build, 799 unit test/coverage, 32 E2E và 38 MySQL/Redis integration test dưới cấu hình này.
- Frontend: flag toàn cục làm Next.js build lỗi vì framework dùng `__proto__` hợp lệ. Vì vậy guard chỉ áp dụng cho CLI shadcn qua `npm run ui -- <arguments>` và bài test safety; Next build giữ cấu hình bình thường. CLI `--help` và production build đã chạy thành công.
- Bài test safety dùng đúng deepmerge được mỗi project resolve: merge cấu hình bình thường vẫn đúng; các target null/null-prototype/own `__proto__` và nested placeholder bị chặn bằng `ERR_PROTO_ACCESS`. Hai workflow CI chạy gate này.

**Npm vẫn sẽ hiển thị advisory Low** vì version upstream chưa thay đổi. Đây là workaround có kiểm chứng, không phải bản vá upstream hay suppression audit. Dùng wrapper `npm run ui -- ...` khi chạy shadcn; gọi `npx shadcn` trực tiếp không đi qua wrapper. Dependency production không thay đổi trong đợt này.

## Kiểm kê tài khoản và production

Đã xác minh cấu hình DB local và container/volume hiện hữu tại localhost:3307. Tạm khởi động duy nhất container MySQL, chờ server sẵn sàng, đối chiếu trong transaction READ ONLY rồi dừng lại. Không chạy API/outbox hoặc migration lên DB ứng dụng; không đổi tài khoản, không xuất email, password/hash, token hoặc DATABASE_URL.

Kết quả: trong 23 email phân biệt ở hai dump, có **18 tài khoản local còn hoạt động và hash đang dùng trùng hash từng công khai, gồm một ADMIN**. Cả 18 chưa bị khóa, chưa yêu cầu đổi mật khẩu, không có refresh session còn hạn tại thời điểm đọc. Đây là bằng chứng local; chưa xác minh dữ liệu tài khoản production.

Đã hỏi người dùng về quyền truy cập ADMIN/URL bản thực tế để tiếp tục đúng business API. Không tạo mật khẩu mới hoặc sửa trực tiếp DB khi chưa có đường xác thực quản trị và kế hoạch bàn giao. Luồng hiện tại không cho ADMIN/IT reset một ADMIN, nên việc bảo vệ ADMIN phải dùng luồng đổi mật khẩu của chính người đó hoặc quy trình recovery phù hợp.

Public liveness production trả 200 nhưng báo release cũ `cc46d0a` tại thời điểm kiểm tra. Chưa thể coi F2–F7 đã có hiệu lực production. Pipeline deploy trước đó bị skip vì security job thất bại; cần xem kết quả CI/deploy của commit tiếp theo.
