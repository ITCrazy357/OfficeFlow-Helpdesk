# OfficeFlow — khắc phục ECC, 2026-10-30

Tiến độ mới nhất: [xử lý tiếp ngày 2026-10-31](2026-10-31-ecc-followup.md). Nội dung bên dưới ghi lại đợt local ban đầu.

Tham chiếu: [review tại cc46d0a](2026-10-30-ecc-review.md). Các thay đổi dưới đây đang ở working copy, chưa commit/push/deploy.

## Trạng thái theo từng phần

| Phần | Thay đổi | Trạng thái |
| --- | --- | --- |
| F1 — SQL dump | Bỏ hai dump khỏi Git index, giữ nguyên file local; thêm ignore và CI chặn SQL export ngoài Prisma migration | Đã xử lý phần local. Lịch sử GitHub và tài khoản thực vẫn cần xử lý |
| F2 — backend dependencies | body-parser 2.4.0, Multer 2.5.0, fast-uri 3.1.9, qs 6.17.1, Nodemailer 10.3.1 | Đã vá local |
| F3 — frontend dependencies | Next.js/eslint-config-next 16.4.3, Sharp 0.35.5, Axios 1.21.0, Zod 4.6.7; cập nhật dependency gián tiếp tương thích | Đã vá local |
| F4 — quyền sửa ticket | Đọc ticket/phòng ban/category và ghi trong transaction Serializable; câu ghi kiểm tra status, assignee và updatedAt; giữ audit/history trong transaction | Đã sửa và có hồi quy MySQL thực |
| F5 — manager ownership | Cho manager đọc ticket của chính mình khi department null; giữ giới hạn phòng ban/escalation với ticket người khác | Đã sửa và có hồi quy MySQL thực |
| F6 — frontend CI | Workflow mới chạy install, production audit, lint, TypeScript, regression tests và build | YAML đã kiểm tra local; chưa có run GitHub của thay đổi này |
| F7 — E2E AI | Setup cố định AI disabled, key/model rỗng và giới hạn AI test | E2E chạy bằng lệnh thông thường đạt |

`shadcn` được chuyển sang devDependencies vì project chỉ dùng CSS của package ở lúc build. CLI/MCP của nó không phải dependency runtime ứng dụng. Bản dev đang khóa là 4.23.0 sau cập nhật semver tương thích. Không bỏ import CSS hay thay đổi giao diện để né audit.

Next.js 16.4.3 tự cập nhật block hướng dẫn trong `officeflow-client/AGENTS.md` khi chạy `next dev` cho browser tests; hành vi được xác minh tại `node_modules/next/dist/server/lib/generate-agent-files.js`. Đây là thay đổi sinh bởi Next trong đợt nâng phiên bản.

## F1 — lịch sử sạch đã chuẩn bị, chưa đưa lên GitHub

Mirror dùng riêng, bị ignore:

```text
.local-backups/ecc-history-cleanup.git
```

- Mirror được clone từ repo local bằng `--mirror --no-hardlinks`, sau đó chỉ loại hai đường dẫn dump khỏi lịch sử. Không sửa lịch sử working copy.
- HEAD gốc: `cc46d0ae3f98d4668f63cbe8aed93e4427b753fe`.
- HEAD main sạch: `14fb4bb12a4a085c14e5a7bec2e7e52ac8ab1317`.
- Cả hai bên có 131 commit reachable. Cây main chỉ khác đúng hai file SQL bị loại bỏ; mã ứng dụng trong mirror vẫn là snapshot cc46d0a, chưa chứa các bản sửa chưa commit của đợt này.
- Không còn commit reachable chứa hai đường dẫn đó trên bất kỳ ref nào trong mirror. Backup refs/reflog của mirror đã được bỏ và unreachable objects đã được GC trong mirror.
- Đã đọc branch/tag từ GitHub: có `main`, `chore/remove-legacy-server`, `hardening/backend-phase-1-attachments`, không có tag. Hai branch phụ giữ nguyên SHA sau lọc; chỉ main cần cập nhật lịch sử.
- Mirror không có remote được cấu hình để tránh push nhầm vào repo nguồn local.

Lệnh publish đã chuẩn bị cho **main**, chỉ dùng sau khi chủ repo duyệt việc thay lịch sử:

```powershell
git -C '.local-backups/ecc-history-cleanup.git' push --force-with-lease=refs/heads/main:cc46d0ae3f98d4668f63cbe8aed93e4427b753fe https://github.com/ITCrazy357/OfficeFlow-Helpdesk.git refs/heads/main:refs/heads/main
```

Lease sẽ từ chối nếu main trên GitHub đã đổi kể từ snapshot đã kiểm tra. Không dùng `push --mirror`: nó có thể xóa các ref không dự định xử lý. Sau publish phải đồng bộ working copy và các clone khác một cách có kiểm soát, giữ lại các bản sửa chưa commit hiện có. Không merge lại lịch sử cũ vì sẽ đưa dump trở lại.

Force-push không thu hồi dữ liệu đã được tải, các fork hoặc cached views. Cần kiểm tra khả năng xử lý cached sensitive data qua GitHub Support nếu còn truy cập được theo commit cũ. Việc bảo vệ tài khoản vẫn cần làm dù lịch sử đã sạch.

## F1 — tài khoản thực chưa xác định môi trường

Chủ repo xác nhận dump có tài khoản/dữ liệu dùng thực tế nhưng không nhớ môi trường nào hiện còn dùng. Vì vậy chưa đặt lại mật khẩu, khóa user, thu hồi phiên, đọc hoặc ghi database ứng dụng/production trong đợt sửa này.

Các bước khi đã xác định được môi trường đúng:

1. Đối chiếu tài khoản trong dump với danh sách user đang dùng ở từng môi trường; giữ việc đối chiếu trên máy tin cậy, không đưa email/hash vào issue hoặc log công khai.
2. Dùng chức năng quản trị reset password cho từng tài khoản bị ảnh hưởng với mật khẩu mới riêng biệt. `AccountService.resetPassword()` hiện đặt `mustChangePassword=true`, thu hồi refresh sessions và vô hiệu password-reset token trong cùng transaction. Giữ nguyên kiểm tra quyền của API.
3. Với tài khoản quản trị của chính người thao tác, dùng luồng đổi mật khẩu của bản thân hoặc một quản trị viên khác có quyền; không bypass quy tắc quản lý tài khoản.
4. Nếu mật khẩu từng tái sử dụng cho email, DB hoặc dịch vụ khác, đổi ở các dịch vụ đó. Chỉ xoay API/JWT/DB secret khi xác định có giá trị thực đã lộ; không kết luận dump chứa token thô còn dùng được chỉ từ tên bảng Refresh_tokens.
5. Xác minh đăng nhập cũ/phiên cũ bị từ chối và ghi nhận hoàn tất ở từng môi trường. Chưa thể đóng F1 khi mới sửa Git ở local.

## Bằng chứng kiểm chứng

- Backend: 72 suite / 799 unit test đạt.
- Coverage gate của CI đạt: statements 68.36%, branches 67.67%, functions 68.37%, lines 68.72%.
- Backend E2E: 3 suite / 32 test đạt bằng lệnh thông thường, không cần sửa biến AI thủ công ở shell.
- MySQL 8.4/Redis 8 dùng riêng: 38 integration test đạt, gồm hai ca mới cho F4/F5. Runner tạo project UUID và đã dọn đúng container/network của project đó; không nhắm container/volume ứng dụng.
- Frontend regression: 38/38 đạt.
- Frontend lint và production build trên Next.js 16.4.3 đạt; build có bước kiểm tra TypeScript.
- Frontend `next typegen` rồi TypeScript `--noEmit --incremental false` đạt. Workflow tạo route types trước khi chạy TypeScript để hoạt động trên checkout mới.
- Browser UI: 44/44 đạt, exit code 0. Bao gồm layout ở 320px/390px/768px/desktop, hai theme, AI draft, asset care, leave, ticket result và knowledge suggestions. Các API được intercept bằng fixture, không chứng minh persistence production. Bước đóng server trên Windows bị treo; đã xác minh rồi dừng đúng ba tiến trình của server test 3016, sau đó Playwright kết thúc với kết quả thành công. Không dừng server ứng dụng khác.
- Backend lint và build đạt. Một assertion mới trong integration test ban đầu bị ESLint báo unsafe assignment; đã đổi assertion và kiểm tra lại thành công.
- Native metrics HTTP/module wiring: 9/9 đạt trên các module đã build và dependency thực.
- Kiểm tra SQL export: 2 test đạt; index hiện không còn SQL export ngoài migrations.
- Kiểm tra an toàn integration target: 7 test đạt.
- YAML hai workflow parse thành công. Chưa kiểm chứng run CI từ GitHub hoặc deployment production.
- `git diff --check` và `git diff --cached --check` đạt. Hash blob hai dump local vẫn khớp bản gốc: file không bị sửa hoặc xóa trên máy.
- Mirror qua `git fsck --no-reflogs` và giữ nguyên HEAD working copy. Thư mục mirror và hai dump local đều được ignore.

Audit production cuối cùng từ npm registry: **0 ở frontend, 0 ở backend**, cả hai lệnh exit 0. Audit bao gồm devDependencies còn 3 cảnh báo Low frontend (`deepmerge`/shadcn) và 8 Low backend (chuỗi Jest/Nest CLI dùng deepmerge); không có Moderate/High/Critical. Không dùng `audit fix --force` để hạ hoặc đổi major công cụ chỉ nhằm xóa số cảnh báo.

Chưa commit/push các bản sửa, chưa force-push lịch sử, chưa deploy và chưa xử lý tài khoản thực. **F1 vẫn mở** vì dữ liệu trên GitHub và trạng thái tài khoản chưa được giải quyết, dù các phần sửa mã local đã kiểm chứng.
