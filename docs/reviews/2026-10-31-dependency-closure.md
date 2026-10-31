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

## 74 — vá deepmerge và mở audit gate cho cả devDependencies

Fork private `@officeflow/deepmerge-safe@1.0.0` giữ mã deepmerge 4.3.1, type và
license MIT gốc. Hai thay đổi thuật toán bỏ qua khóa literal `__proto__` trước
khi đọc/ghi ở cả vòng sao chép target và vòng merge source. README ghi SHA-256
nguồn gốc và trách nhiệm đồng bộ hai bản fork. Đây là bản vá tự duy trì, không
phải tuyên bố upstream đã phát hành patched version.

Payload thực làm đối tượng kết quả của bản gốc bị đầu độc ở ba dạng target:
null, null-prototype và có own `__proto__`. Cùng payload không đầu độc kết quả
của fork. Gate còn kiểm tra target-copy, lồng object/array, getter bẫy, `.all`,
symbols và các tùy chọn merge. Tiến trình con tắt NODE_OPTIONS và chứng minh
setter `__proto__` vẫn hoạt động để xác nhận bản vá không dựa vào workaround.

Audit đầy đủ qua npm registry của cả hai lockfile: **0 Info/Low/Moderate/High/
Critical**, gồm devDependencies. Hai CI nâng gate thành `npm audit
--audit-level=low`; security job cũng dùng npm 12.2.0. Không có audit ignore.

Kiểm chứng cuối phần 74: clean Linux/npm 12.2.0 qua build/lint, 8 dependency
safety test, 821 unit/coverage, 32 E2E, 7 isolation-safety và 9 metrics HTTP test.
Frontend local qua 8 dependency safety, lint/type, 38 regression và build.
61 integration test qua MySQL/Redis dùng riêng với migration từ DB rỗng.
Image Docker build thành công, Trivy không có High/Critical; smoke test network
none kiểm tra 24 migrations đúng byte, không chứa dump, bcrypt native và các
engine/fork đúng bản. Các kết quả này là local; CI/deploy của PR mới phải được
xác nhận sau push.

Vercel deployment của commit merge phần 72 cũng đã được xác nhận success qua
GitHub status và deployment environment Production. Chưa dùng điều này làm
bằng chứng đã deploy phần 73–74.

## 75 — đồng bộ cài dependency trên Vercel

`officeflow-client/vercel.json` chạy `npx --yes --package=npm@12.2.0 -- npm ci`,
để cùng phiên bản npm và lockfile với CI/Docker. Không dựa riêng vào trường
packageManager vì [Vercel chỉ dùng trường đó khi có Corepack](https://vercel.com/docs/package-managers).
Không sửa thiết lập môi trường hay bí mật trên Vercel.

Chạy đúng installCommand trong Linux sạch rồi qua 8 dependency safety test,
lint, typegen/TypeScript, 38 regression test và production build. Test đối chiếu
25 trạng thái ticket có mount đúng contract backend chỉ đọc. CLI shadcn cũng
khởi động và trả phiên bản thành công với workaround bảo vệ prototype đang có.
Hai workflow YAML parse hợp lệ; các bản vendor ở hai ứng dụng giống nhau.
Quét toàn lịch sử tới phần 74: 145 commit, không phát hiện leak mới.

## F1 — trạng thái vận hành

Chưa có phiên ADMIN production hợp lệ để xác minh đổi/reset mật khẩu và thu hồi
phiên của tài khoản thực. Người dùng đã ủy quyền gửi bản nháp GitHub Support,
nhưng chưa gửi được qua công cụ: cửa sổ đăng nhập không hiển thị cho người dùng,
sau đó trình duyệt bị lỗi hạn mức duyệt tự động. Đã hướng dẫn chủ repo gửi bản
`.local-backups/github-support-request-20261031.md` bằng trình duyệt của mình.
Chưa có số ticket hoặc xác nhận purge; không đánh dấu F1 đã đóng.
