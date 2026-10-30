# OfficeFlow — ECC review, 2026-10-30

Snapshot: `cc46d0ae3f98d4668f63cbe8aed93e4427b753fe`.

Tiến độ xử lý sau review: [bản khắc phục theo từng phần](2026-10-30-ecc-remediation.md). Các phát hiện dưới đây ghi nhận snapshot gốc.

**Verdict: BLOCK — cần xử lý dữ liệu thực đã công khai trước khi tiếp tục phát hành.**

Áp dụng hướng dẫn ECC `code-reviewer`, `security-reviewer` và checklist `security-review` đang được cài. Đây là review toàn bộ snapshot theo yêu cầu, không chỉ commit cuối. Không sửa mã ứng dụng, dependency, cấu hình hay dữ liệu; không commit/push/deploy.

## Phát hiện theo mức độ

### F1 — CRITICAL: SQL dump công khai chứa dữ liệu/tài khoản từng dùng thực tế

- Vị trí: [officeflow-deploy.sql:604](../../officeflow-nest-server/officeflow-deploy.sql#L604), [officeflow-local-before-sync.sql:553](../../officeflow-nest-server/officeflow-local-before-sync.sql#L553). Bản deploy còn có dữ liệu `Audit_logs` ở dòng 131, `Refresh_tokens` ở dòng 381, bình luận ở dòng 477 và ticket ở dòng 559.
- Đã xác minh cả hai file vẫn được Git theo dõi. GitHub MCP xác nhận repository công khai; blob SHA trên `main` khớp file local: `862c3b70b857b1e8f642eff2c9516970d344a863` và `b7b5b3eb782da11f5b9f5881ff7df73cb10fb652`.
- Chủ repo xác nhận trong phiên review rằng có dữ liệu hoặc tài khoản dùng thực tế. Các lệnh kiểm tra chỉ xuất tên bảng, dòng và việc có bcrypt hash; báo cáo không sao chép giá trị nhạy cảm.
- Điều kiện/tác động: bất kỳ người đọc repo công khai nào cũng có thể tải dữ liệu tài khoản và nội dung nghiệp vụ. Bcrypt hash cho phép thử mật khẩu ngoại tuyến. Dữ liệu bảng phiên bị lộ không đồng nghĩa đã chứng minh có refresh token dạng thô hoặc phiên còn hiệu lực.
- Cần xử lý: hạn chế tiếp tục phân phối dump; xác định tài khoản/dữ liệu bị ảnh hưởng; đặt lại mật khẩu và thu hồi phiên liên quan; kiểm tra việc tái sử dụng mật khẩu. Loại bỏ dump khỏi phiên bản hiện tại và phối hợp làm sạch lịch sử Git. Bản clone/fork đã tải trước đó không được thu hồi chỉ bằng rewrite history. Thay dữ liệu mẫu bằng seed tổng hợp.
- Thêm `.gitignore`, thêm fingerprint vào `.gitleaksignore`, hoặc chỉ xóa file ở commit mới không xử lý dữ liệu đã nằm trong lịch sử. Chưa có bằng chứng về việc bên thứ ba đã khai thác.

### F2 — HIGH: Backend sử dụng body-parser có lỗi crash trước xác thực

- Vị trí: [package-lock.json:5218](../../officeflow-nest-server/package-lock.json#L5218), [main.ts:28](../../officeflow-nest-server/src/main.ts#L28).
- Lockfile và dependency local đều dùng `body-parser 2.3.0`. Bootstrap giữ body parser mặc định; đã kiểm tra Nest adapter đăng ký `express.json()`/`express.urlencoded()` trước routing, không đặt `inflate: false`.
- Theo [advisory chính thức của body-parser](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828), request nén có phần dữ liệu dư có thể gây uncaught exception và dừng tiến trình. Advisory áp dụng cho `>=2.0.0 <2.4.0`, sửa ở `2.4.0`.
- JWT, RBAC, DTO và route throttler không ngăn được lỗi ở tầng parse body chạy trước guard. Đã đối chiếu đường đi trong source/dependency; không gửi payload gây crash tới môi trường đang chạy hoặc production.
- Cần xử lý: cập nhật dependency tree/lockfile để mọi bản body-parser runtime đạt bản vá; hoặc chủ động tắt giải nén nếu nghiệp vụ không dùng compressed request body. Xác minh lại bằng test HTTP cô lập và audit sau thay đổi.

### F3 — HIGH: Frontend khóa Next.js/Sharp có advisory chưa được vá

- Vị trí: [package-lock.json:9040](../../officeflow-client/package-lock.json#L9040), [package.json:46](../../officeflow-client/package.json#L46).
- Bản khóa thực tế: `next 16.2.12`, `sharp 0.35.3`; override Sharp giữ cứng phiên bản cũ.
- [Advisory Next.js chính thức](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) mô tả RCE trên server dùng Windows filesystem và App/Pages Router không có Cache Components. Project dùng App Router, chưa bật Cache Components và workspace hiện tại là Windows. Không được mở server Windows này cho nguồn không tin cậy khi còn phiên bản bị ảnh hưởng. Chưa chứng minh điều kiện Windows tồn tại trên deployment production.
- [Advisory Sharp](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) có thêm điều kiện xử lý SVG/runtime Linux. Chưa xác lập đường đưa ảnh không tin cậy vào image processing của OfficeFlow; không khẳng định RCE Sharp đang khai thác được.
- Cần xử lý: nâng Next.js lên bản vá còn được hỗ trợ và cập nhật override Sharp, đồng thời tạo lại lockfile có kiểm soát. Các advisory Next đã đối chiếu bao gồm bản vá tới `16.4.1`; Sharp advisory trên sửa ở `0.35.5`. Chạy lại audit để chọn phiên bản đáp ứng toàn bộ advisory tại thời điểm sửa.
- Không dùng tổng số npm audit để suy ra toàn bộ lỗ hổng đều có thể khai thác trong runtime. Cây frontend có cả công cụ `shadcn` trong `dependencies`.

### F4 — MEDIUM: Kiểm tra quyền sửa ticket tách khỏi câu UPDATE

- Vị trí: [ticket-workflow.service.ts:237](../../officeflow-nest-server/src/tickets/ticket-workflow.service.ts#L237), [ticket-workflow.service.ts:256](../../officeflow-nest-server/src/tickets/ticket-workflow.service.ts#L256).
- Hàm `update()` đọc ticket và kiểm tra EMPLOYEE chỉ được sửa ticket `OPEN` trước transaction. Sau đó câu ghi chỉ dùng `where: { id }`; không kiểm tra lại status hoặc snapshot đã dùng để xét quyền.
- Kịch bản: nhân viên bắt đầu sửa ticket OPEN; nhân viên IT chuyển ticket sang IN_PROGRESS; request sửa của nhân viên chạy câu UPDATE và vẫn được chấp nhận. Tương tự, điều kiện assignee của IT_STAFF có thể trở nên cũ khi có chuyển người xử lý đồng thời.
- Đã tái hiện bằng mock gọi đúng `TicketWorkflowService`: đổi state sang IN_PROGRESS giữa lần đọc quyền và transaction; kết quả vẫn giữ mô tả mới của EMPLOYEE. Đây là bằng chứng ở service/mock, chưa phải kiểm tra race trên MySQL thực.
- Cần xử lý: đọc và xét quyền trong transaction với bảo vệ đồng thời phù hợp; đưa điều kiện trạng thái/quyền hoặc version snapshot vào câu ghi, trả 409 khi snapshot thay đổi. Chỉ bọc câu UPDATE hiện tại trong transaction không giải quyết lần đọc nằm ngoài nó.

### F5 — MEDIUM: Manager không có phòng ban thấy ticket của mình trong danh sách nhưng mở bị 403

- Vị trí: [ticket-access-policy.service.ts:36](../../officeflow-nest-server/src/tickets/ticket-access-policy.service.ts#L36), [ticket-access-policy.service.ts:74](../../officeflow-nest-server/src/tickets/ticket-access-policy.service.ts#L74), [ticket-access-policy.service.ts:131](../../officeflow-nest-server/src/tickets/ticket-access-policy.service.ts#L131).
- `getScope()` cố ý cho MANAGER không có phòng ban xem ticket có `createdById` bằng chính họ. Cả `assertCanView()` và `canAccessTicket()` lại từ chối khi thiếu department, trừ ticket có SLA escalation phù hợp; không có nhánh cho creator.
- `UpdateUserDto` cho phép `departmentId: null`, nên đây là trạng thái được API hỗ trợ.
- Đã tái hiện bằng mock: manager ID 3, department null, ticket do ID 3 tạo, không escalation; scope danh sách chứa ticket nhưng hai hàm đọc chi tiết/discussion cùng trả 403. Tests hiện kiểm tra nhánh list fallback và nhánh cấm manager ngoài phòng ban riêng lẻ, bỏ sót sự bất nhất này.
- Cần xử lý: đồng bộ quy tắc ownership giữa danh sách, chi tiết, bình luận và attachment; thêm trường hợp manager tự tạo ticket khi department null.

### F6 — MEDIUM: CI chưa có cổng kiểm tra frontend

- Vị trí: [.github/workflows/backend-ci.yml:11](../../.github/workflows/backend-ci.yml#L11), [.github/workflows/backend-ci.yml:47](../../.github/workflows/backend-ci.yml#L47).
- Đây là workflow duy nhất trong checkout. Các job chỉ cài/audit/lint/test/build backend. Push chỉ đổi `officeflow-client/**` không kích hoạt workflow; pull request có kích hoạt cũng không kiểm tra frontend.
- Tác động: lỗi build, hồi quy hoặc advisory frontend có thể vào main mà workflow này không phát hiện. Build frontend thành công tại local trong review không tạo ra bảo vệ cho commit sau.
- Cần xử lý: thêm workflow/job frontend với paths phù hợp, lockfile audit, lint, TypeScript, regression test và build; thêm browser fixtures nếu chọn dùng làm gate. Chưa kiểm tra cấu hình branch protection hoặc kết quả remote CI.

### F7 — MEDIUM: E2E phụ thuộc cấu hình AI từ môi trường local

- Vị trí: [test/setup-env.cjs:2](../../officeflow-nest-server/test/setup-env.cjs#L2), [test/app.e2e-spec.ts:178](../../officeflow-nest-server/test/app.e2e-spec.ts#L178), [app.module.ts:43](../../officeflow-nest-server/src/app.module.ts#L43).
- Setup ghi đè các biến DB/JWT/Redis/Mail nhưng không cố định `AI_ENABLED`, `OPENAI_API_KEY`, `OPENAI_MODEL`. `AppModule` vẫn nạp cấu hình `.env`; test lại yêu cầu trạng thái AI phải là DISABLED.
- Lần chạy E2E bình thường tại checkout hiện tại: 31/32 pass; test AI nhận UNAVAILABLE thay vì DISABLED. Redis trong test được mock `isReady() => false`.
- Chạy lại cùng 3 suite với `AI_ENABLED=false` và biến key/model rỗng: 32/32 pass. Không thay `.env`, không sửa test và không gọi API AI trả phí.
- Cần xử lý: đặt rõ cấu hình AI test ngay trong setup và/hoặc tắt nạp env file thật cho môi trường test; override provider trong các bài test cần trạng thái cụ thể. Không đổi expectation thành UNAVAILABLE chỉ để khớp máy local.

## Kiểm chứng đã thực hiện

Node chạy trực tiếp từ bản `v22.23.2`; shim NVM mặc định của máy báo chưa chọn phiên bản.

| Hạng mục | Kết quả |
| --- | --- |
| Backend unit tests | 71 suite, 792 test pass |
| Backend E2E theo môi trường thông thường | 31 pass, 1 fail — F7 |
| Backend E2E cố định AI disabled qua biến môi trường process | 3 suite, 32 test pass |
| Backend ESLint | Pass |
| Backend `nest build` | Pass; tương đương `build:ci`, không chạy lại Prisma generate |
| Frontend regression tests | 38/38 pass |
| Frontend ESLint | Pass |
| Frontend TypeScript `--noEmit --incremental false` | Pass |
| Frontend production build | Pass, Next.js 16.2.12 |
| Hai kịch bản service/mock F4, F5 | Tái hiện thành công bằng assertion, không lưu test vào source |
| Frontend `npm audit --omit=dev` trực tiếp npm registry | 24 package: 2 critical, 16 high, 5 moderate, 1 low |
| Backend `npm audit --omit=dev` trực tiếp npm registry | 6 package: 0 critical, 3 high, 3 moderate |
| GitHub metadata và SHA dump | Repo public, blob khớp local/main |
| `git diff --check` trước báo cáo | Pass; working tree sạch |

Số audit là số package được npm báo, bao gồm tác động lan truyền qua dependency; không phải số lỗ hổng độc lập hay số đường khai thác đã chứng minh. Ví dụ advisory Multer hiện tại cần async `fileFilter`; cấu hình upload đang đọc không dùng async `fileFilter`, nên không báo riêng nó là đường crash đã xác lập.

## Những kiểm soát đã đọc và giới hạn

JWT kiểm tra issuer/audience/HS256, tra lại session và trạng thái user trong DB; refresh token được hash và rotate. Các luồng trạng thái ticket, feedback, leave entitlement và asset maintenance có transaction/điều kiện trạng thái hoặc version. AI yêu cầu role ADMIN/IT_STAFF, trả bản nháp có thể sửa, kiểm tra lại nguồn/ticket sau khi sinh và có Redis limiter. Đây là bằng chứng từ source và tests local.

`.gitleaksignore` hiện dùng fingerprint cụ thể, không có wildcard bỏ qua toàn repo. Không thêm ngoại lệ trong review này. Gitleaks không phải công cụ xác nhận dump không có dữ liệu riêng tư.

Không chạy full-history Gitleaks, Trivy, Docker/disposable MySQL-Redis integration, browser UI suite, kiểm thử khai thác, kiểm tra Render/Vercel production hoặc đo hiệu năng thực tế. Review theo rủi ro không phải chứng minh đã duyệt mọi dòng hoặc hệ thống không còn lỗi khác. Build/tests pass không xóa bỏ F1–F3.

## Review summary

| Severity | Count | Status |
| --- | --- | --- |
| CRITICAL | 1 | Block — dữ liệu thực công khai |
| HIGH | 2 | Cần khắc phục dependency và kiểm tra điều kiện runtime |
| MEDIUM | 4 | Quyền ticket, concurrency, CI và test isolation |
| LOW | 0 | Không liệt kê sở thích style |

Ưu tiên: xử lý F1 trước; vá F2 và F3; sau đó sửa F4/F5 và bổ sung F6/F7 để giảm tái phát.
