# OfficeFlow — đóng cảnh báo dependency dev legacy

## 72 — merge và triển khai bản sửa trước

PR #1 được merge vào `main` tại `0698bdd0bf562ac30721c54307ac2d68616f9b19`.
Backend run `41191591917` qua Verify Backend, Security và Deploy Backend to Render;
frontend run `41191591887` thành công. Đây là bằng chứng pipeline của commit merge,
không phải bằng chứng đã hoàn tất xử lý tài khoản thực trong F1.

## 73 — thay engine glob/minimatch legacy

Hai ứng dụng dùng adapter private có tên riêng, nối trực tiếp tới engine upstream
`glob@14.0.2` và `minimatch@11.0.1` được pin bằng npm alias. Không giữ thuật toán
glob 7/minimatch 3 hoặc giả mạo phiên bản của chúng. Adapter giữ CommonJS callable,
callback/promisify, `.sync`, constructor và named ESM exports đang được toolchain
sử dụng; đường gọi glob legacy giữ dấu `/` trên Windows. API tạo RegExp đã bị
upstream loại bỏ không được mô phỏng lại.

Root dependency và override cùng tên giúp mọi caller dùng cùng adapter. Lockfile
không chứa link tới vendor bên trong node_modules của dependency. Backend Docker
copy vendor trước npm ci. Hai bản adapter giống nhau để dùng được với build context
riêng của backend; engine upstream vẫn giữ license BlueOak-1.0.0.

Kiểm chứng local: cài sạch bằng npm 12.2.0; backend lint/build, 76 suite / 821 unit
test với coverage gate, 32 E2E, 7 isolation-safety và 9 metrics HTTP test đạt.
Frontend lint, typegen/TypeScript, 38 regression test và production build đạt.
Gate dùng caller ESLint/coverage thực kiểm tra callable/named exports, chọn tệp,
callback/promisify, lockfile và API matching. Gate chạy ở cả hai workflow.

Audit gồm devDependencies sau phần 73: backend còn 8 Low, frontend còn 3 Low,
đều do deepmerge và dependency phụ thuộc nó; không còn Moderate/High/Critical.
Các dependency ngoài phạm vi được giữ nguyên phiên bản trong lockfile. Đây chưa
phải audit sạch toàn bộ; phần deepmerge được xử lý riêng tiếp theo.

## F1 — trạng thái vận hành

Chưa có phiên ADMIN production hợp lệ để xác minh đổi/reset mật khẩu và thu hồi
phiên của tài khoản thực. Người dùng đã ủy quyền gửi bản nháp GitHub Support,
nhưng chưa gửi được qua công cụ: cửa sổ đăng nhập không hiển thị cho người dùng,
sau đó trình duyệt bị lỗi hạn mức duyệt tự động. Đã hướng dẫn chủ repo gửi bản
`.local-backups/github-support-request-20261031.md` bằng trình duyệt của mình.
Chưa có số ticket hoặc xác nhận purge; không đánh dấu F1 đã đóng.
