# OfficeFlow — các phần còn lại sau 64.1

| Phần | Thay đổi | Bằng chứng |
| --- | --- | --- |
| 65 | Trả `resolutionVersion` và `confirmedAt` trong chi tiết ticket | Unit thất bại trước sửa; MySQL đọc chi tiết, reopen và confirm bằng phiên bản trả về đạt |
| 66 | Kiểm tra quyền và đọc danh sách/chi tiết/history/tệp/feedback cùng transaction | Bảy ca unit thất bại trước sửa; bảy ca MySQL chuyển phòng ban trước transaction đều không lộ dữ liệu |
| 67 | Đưa đọc quyền/metadata và xóa tệp vào cùng transaction | Giữ quy tắc manager/employee; MySQL xóa cạnh tranh chỉ ghi một history và một cleanup job |
| 68 | Outbox thử lại cleanup upload khi Cloudinary tạm lỗi | Unit tái hiện việc chỉ log trước sửa; MySQL xác nhận job PENDING, không lưu attachment/history trái quyền |
| 69 | Câu ghi đổi mật khẩu kiểm tra cả active/unlocked | Hai ca MySQL thất bại trước sửa: khóa hoặc vô hiệu hóa trong lúc chờ; sau sửa hash/cờ bắt buộc đổi mật khẩu giữ nguyên |
| 70 | Kiểm tra lại hash và trạng thái khi cấp token khôi phục | Ba unit tái hiện trước sửa; ba ca MySQL khóa/vô hiệu hóa/reset trong lúc chờ không tạo token hay phát sự kiện email |
| 71 | Cập nhật có phạm vi glob/minimatch cho công cụ hiện đại | Override glob >=9 lên 14.0.2 và minimatch >=9 lên 11.0.1; giữ API legacy dùng bởi ESLint/coverage |

## Phạm vi kiểm chứng

Trên lockfile cuối của phần 71: 76 suite / 821 unit test, coverage gate, 32 E2E và 61 MySQL/Redis integration test đạt. Các test DB chạy trên project Docker UUID dùng riêng, có migration từ DB rỗng; không dùng DB ứng dụng. Cloudinary và sự kiện email dùng fixture/listener kiểm thử, không gọi dịch vụ bên ngoài. Lint, Prisma validate, build và 20 kiểm tra phụ đạt.

Frontend qua lint, typegen/TypeScript, 38 regression test, hai prototype-safety test và production build. Production audit trên npm registry: 0 advisory ở cả backend và frontend. Audit gồm devDependencies vẫn báo backend 30 Moderate/3 Low và frontend 15 Moderate/3 Low, do minimatch legacy và deepmerge; không ghi các kết quả này thành audit sạch toàn bộ.

Image Docker đúng lockfile cuối build thành công; Trivy không có High/Critical. Smoke test với network bị tắt xác nhận đủ 24 migrations, bcrypt native, undici 6.29.1 và glob 14.0.2, đồng thời không có hai SQL export trong image. Kết quả CI từ GitHub phải được xác minh sau push; các bản sửa trên nhánh PR chưa được coi là đã deploy.

## Advisory phát hiện khi kiểm tra lại registry

- [Glob GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): bản vá 14.0.2, liên quan việc duyệt filesystem vẫn tiếp tục sau khi AbortSignal bị hủy.
- [Minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): bản vá 11.0.1, liên quan khuếch đại pattern khi preprocessing với optimizationLevel >=2.

Không áp dụng override cho mọi major: minimatch 3.1.5 đang resolve cho caller legacy xuất ra một hàm, còn bản 11 xuất ra object. Kiểm tra local xác nhận nhánh legacy không có `firstPhasePreProcess` mà advisory mô tả; đây là nhận định về đường chạy cụ thể, không phải tuyên bố mọi thuật toán của bản 3 đều không thể gây DoS. Audit vẫn có thể gắn range rộng của advisory cho các dependency legacy. Không suppression audit hoặc hạ major công cụ để làm số cảnh báo bằng 0.

[Deepmerge GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) vẫn ghi chưa có patched version; npm registry xác nhận latest 4.3.1 tại thời điểm kiểm tra. Workaround `--disable-proto=throw` và các gate safety đã có vẫn được giữ. Các cảnh báo dev này chưa được ghi là đã vá hoàn toàn.

## Mục vận hành vẫn cần chủ tài khoản/repository

F1 chưa đóng: đã loại dump khỏi lịch sử reachable và có draft yêu cầu GitHub Support, nhưng chưa có bằng chứng GitHub đã xử lý cached/unreachable objects. Cần chủ repo gửi yêu cầu đã soạn trong `.local-backups/github-support-request-20261031.md` qua tài khoản của mình.

Chưa có phiên ADMIN production trong trình duyệt kiểm tra nên chưa xác nhận việc đổi/reset mật khẩu các tài khoản thực đã hoàn tất. Không bypass API quản trị hoặc sửa trực tiếp DB để đánh dấu xong. Chủ ADMIN dùng luồng đổi mật khẩu của mình; các tài khoản còn lại dùng quyền reset hiện có rồi xác minh phiên/mật khẩu cũ bị từ chối.
