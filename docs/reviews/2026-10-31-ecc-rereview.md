# OfficeFlow — ECC review lại tại 955a637

Ngày review: 2026-10-31, Asia/Bangkok. HEAD local và remote main cùng là
`955a6374cab5a5149daf8768a6b1b517eaa3cde4`; working tree sạch trước review.
Áp dụng checklist ECC security-review và các bước verification phù hợp với repo.
Không sửa mã ứng dụng, không commit/push/deploy trong lượt review này.

Cập nhật xử lý ngày 2026-11-01: xem [các bản sửa 77–80 và kiểm chứng](2026-11-01-ecc-fixes.md).
Báo cáo bên dưới giữ nguyên bằng chứng trước sửa tại `955a637`.

## Kết luận

Các bản vá dependency, quyền ticket, race đăng nhập và CI trước đây đã có hiệu
lực trên main, với kiểm thử hiện có và deployment thành công. Tuy nhiên có bốn
lỗi mới được tái hiện: một High, ba Medium. Chưa nên đánh dấu xử lý bảo mật đã
hoàn tất. F1 vẫn là mục vận hành chưa có bằng chứng đóng, tách khỏi bốn lỗi mới.

## R1 — HIGH: reset mật khẩu đang chờ vẫn hoàn tất sau khi người thực hiện mất quyền

- Vị trí: [accounts.service.ts:305](../../officeflow-nest-server/src/users/accounts.service.ts#L305),
  [accounts.service.ts:310](../../officeflow-nest-server/src/users/accounts.service.ts#L310).
- `resetPassword()` xét quyền từ CurrentUserPayload trước khi await bcrypt.hash.
  Transaction sau đó chỉ ràng buộc ID/role của người bị reset, không đọc lại
  quyền, trạng thái active/locked của người thực hiện.
- Kịch bản: IT_STAFF bắt đầu reset một EMPLOYEE; trong lúc chờ hash, ADMIN hạ
  IT_STAFF xuống EMPLOYEE hoặc khóa tài khoản đó. Request cũ vẫn ghi mật khẩu
  mới, buộc đổi mật khẩu và thu hồi phiên của nạn nhân sau khi việc hạ quyền/khóa
  đã commit. Điều này làm thao tác thu hồi quyền chưa chặn được yêu cầu nhạy cảm
  đang chờ.
- Bằng chứng MySQL: dùng AuthService.login và JwtAuthGuard/RolesGuard thật để
  chụp actor hợp lệ. Trong lúc chờ hash, gọi UsersService.update để hạ quyền hoặc
  AccountService.lockUser để khóa. Guard từ chối request kế tiếp bằng 403/401,
  nhưng reset đang chờ vẫn thành công; bcrypt.compare xác nhận mật khẩu mới đã
  lưu đúng vào DB. Cả hai ca dùng DB dùng riêng và thay trạng thái bằng business
  service, không cập nhật trực tiếp bảng để giả lập kết quả thu hồi quyền.
- Cần sửa: đọc/xét lại actor có role ADMIN/IT_STAFF và còn được phép hoạt động
  bên trong transaction, với cơ chế đồng thời phù hợp. Giữ bcrypt bên ngoài để
  tránh giữ khóa lâu; áp dụng kiểm soát actor nhất quán cho các thao tác quản lý
  tài khoản. Thêm hai ca hồi quy cho actor bị hạ quyền/khóa khi reset đang chờ.

## R2 — MEDIUM: sự kiện SLA gửi tiêu đề ticket cho người nhận đã mất quyền

- Vị trí: [notifications.listener.ts:33](../../officeflow-nest-server/src/notifications/notifications.listener.ts#L33),
  [ticket-email.listener.ts:30](../../officeflow-nest-server/src/mail/listeners/ticket-email.listener.ts#L30).
- SLA lưu recipientIds vào payload outbox. Notification listener dùng nguyên
  danh sách đó; email listener chỉ lọc active/unlocked, không xét quyền đọc
  ticket hiện tại. NotificationsService.findMine chỉ lọc userId.
- Kịch bản: ADMIN được ghi trong event escalation, sau đó bị chuyển thành
  EMPLOYEE trước khi worker giao event hoặc thử lại. Người đó không còn là
  requester, nên API ticket trả 403, nhưng vẫn nhận tiêu đề ticket và hạn SLA
  qua notification mới; nếu email bật thì cùng nội dung được gửi qua email.
- Bằng chứng MySQL: thay role bằng UsersService.update, xác nhận
  TicketAccessPolicyService trả 403, rồi gọi listener thật. Notification chứa
  tiêu đề fixture được lưu và đọc lại bằng findMine. Email dispatcher cũng gọi
  mail fixture với tiêu đề đó; không gửi SMTP thật.
- Cần sửa: lọc recipient theo quyền hiện tại tại lúc giao sự kiện, áp dụng cho
  notification và email. Không coi snapshot recipientIds của event là quyền
  truy cập hiện tại. Thêm ca delayed delivery sau khi thay role/quan hệ quản lý.

## R3 — MEDIUM: refresh từ hai tab có thể thu hồi toàn bộ phiên dùng chung

- Vị trí: [axios.ts:33](../../officeflow-client/src/lib/axios.ts#L33),
  [auth.service.ts:203](../../officeflow-nest-server/src/auth/auth.service.ts#L203),
  [auth.service.ts:221](../../officeflow-nest-server/src/auth/auth.service.ts#L221).
- refreshRequest chỉ single-flight trong một mô-đun JavaScript của một tab.
  Các tab có access token riêng trong memory, nhưng dùng chung refresh cookie.
  Khi hai tab cùng khôi phục phiên, cả hai có thể gửi cùng refresh token.
- Backend cho một request rotate thành công, rồi xử lý request còn lại như
  replay và revoke cả token family, bao gồm token vừa cấp. AuthController còn
  clear cookie trong nhánh lỗi. Người dùng có thể bị mất phiên chỉ vì hai tab
  khôi phục đồng thời.
- Bằng chứng: nạp hai bản độc lập của lib/axios.ts và lib/token.ts thật, dùng
  axios adapter fixture để chia sẻ cookie. AuthService và JwtAuthGuard thật
  chạy với MySQL dùng riêng. Barrier bảo đảm hai lần đọc token diễn ra trước
  bước claim. Kết quả: hai refresh request, không còn session active trong
  family, cookie chung bị xóa, ít nhất một request me thất bại. Probe với mô
  hình DB cũng tái hiện cùng lỗi. Đây là kiểm chứng service/client-module;
  chưa phải kiểm tra hai tab trình duyệt với HTTP thật trên production.
- Cần sửa: điều phối refresh giữa các tab và chia sẻ kết quả/generation phù
  hợp, đồng thời giữ cơ chế phát hiện token reuse. Test hiện tại chỉ xác nhận
  các request song song trong cùng một mô-đun dùng một lần refresh.

## R4 — MEDIUM: đổi mật khẩu dài có thể vẫn cho đăng nhập bằng mật khẩu cũ

- Vị trí: [accounts.service.ts:428](../../officeflow-nest-server/src/users/accounts.service.ts#L428),
  [change-my-password.dto.ts:18](../../officeflow-nest-server/src/users/dto/change-my-password.dto.ts#L18).
- DTO chấp nhận tối đa 128 ký tự; bcrypt chỉ sử dụng 72 byte đầu. Kiểm tra
  newPassword === currentPassword không nhận ra hai chuỗi khác nhau nhưng có
  cùng 72 byte đầu. Giới hạn tính theo byte UTF-8, không phải số ký tự.
- Kịch bản: mật khẩu hiện tại có prefix dài 72 byte; người dùng chỉ đổi suffix
  phía sau prefix. Hai chuỗi đều qua DTO, service báo passwordChanged=true,
  thu hồi phiên, nhưng mật khẩu cũ vẫn được bcrypt chấp nhận khi đăng nhập mới.
- Bằng chứng bằng bcrypt thật và source thật: prefix 36 ký tự Unicode chiếm
  72 byte; hai mật khẩu khác suffix đều dài 44 ký tự/80 byte. Class-validator
  chấp nhận DTO; AccountService.changeOwnPassword thành công, rồi AuthService.login
  vẫn cấp phiên khi dùng mật khẩu cũ. DB trong probe này là fixture, không phải
  MySQL; tính tương đương của mật khẩu được kiểm tra bằng bcrypt thực tế.
- Cần sửa: nếu giữ bcrypt, giới hạn mật khẩu mới theo 72 byte UTF-8, đồng bộ
  backend/frontend và xét sự tương đương với hash hiện tại khi đổi mật khẩu.
  Giữ đường đăng nhập/đổi mật khẩu tương thích cho tài khoản lịch sử có mật khẩu
  dài; hoặc dùng hasher hỗ trợ mật khẩu dài với kế hoạch migration rõ ràng.

## Kiểm chứng trong lượt review này

| Hạng mục | Kết quả |
| --- | --- |
| Backend build, lint | Đạt |
| Backend unit + coverage gate | 76 suite, 821 test đạt |
| Coverage backend | Statements 65.96%; branches 66%; functions 66.13%; lines 66.29% |
| Backend E2E | 3 suite, 32 test đạt |
| Dependency safety | 8 backend + 8 frontend đạt |
| Isolation safety / metrics HTTP | 7 / 9 test đạt |
| Frontend lint, typegen, TypeScript, build | Đạt |
| Frontend regression | 38/38 đạt |
| npm audit gồm cả dev/runtime | 0 advisory ở cả hai lockfile |
| Probe R1 | Hai ca MySQL tái hiện reset sau khi actor bị hạ quyền/khóa |
| Probe R2 | MySQL tái hiện notification lộ tiêu đề; email chỉ fixture |
| Probe R3 | MySQL + hai client context tái hiện mất phiên; HTTP/cookie fixture |
| Probe R4 | DTO và bcrypt/service thật tái hiện đăng nhập bằng mật khẩu cũ sau khi đổi; DB fixture |

Các probe đọc và thực thi source thật qua TypeScript transpile trong memory.
MySQL chạy trong project Docker UUID `officeflow-ecc-review-*`, dùng tmpfs,
migration từ DB rỗng và kiểm tra SELECT DATABASE(). Runner chỉ khởi động MySQL
của project dùng riêng, đóng kết nối rồi dọn project sau mỗi lần kiểm tra;
không xóa volume ứng dụng hoặc khởi động API/outbox của ứng dụng. Không gọi AI,
Cloudinary hoặc SMTP. Bằng chứng và script cục bộ nằm trong `.verification/`:

- `ecc-rereview-probes.cjs`, `ecc-rereview-evidence.json`.
- `ecc-rereview-mysql.cjs`, `ecc-rereview-mysql-evidence.json`.
- `rereview-*` chứa log kiểm thử và audit.

## CI, deployment và F1

Đã đọc lại trạng thái của đúng SHA đang review:

- [Backend CI/CD](https://github.com/ITCrazy357/OfficeFlow-Helpdesk/actions/runs/41216402540):
  verify, security và deploy Render thành công; deploy job yêu cầu health đúng SHA.
- [Frontend CI](https://github.com/ITCrazy357/OfficeFlow-Helpdesk/actions/runs/41216402683): thành công.
- Vercel status và deployment Production của cùng SHA: success.

Các bằng chứng trên không chứng minh bốn lỗi mới không tồn tại. Không thay đổi
deployment hoặc kiểm thử tài khoản thật trong lượt này. Chưa có xác nhận hoàn
tất đổi/reset mật khẩu, thu hồi phiên cho tài khoản production liên quan F1;
chưa có bằng chứng GitHub Support hoàn tất purge cached/unreachable objects.
Không lấy Gitleaks/audit sạch hoặc các thao tác đang điền form làm bằng chứng
đã đóng F1. Không tải lại nội dung SQL nhạy cảm từ GitHub.

## Phạm vi và giới hạn

Review theo rủi ro, tập trung xác thực, quyền tài khoản/ticket, attachment,
outbox/notification, frontend session, dependency và CI. Đã đọc các nhánh liên
quan tới dashboard, AI và recovery nhưng không tuyên bố duyệt mọi dòng của mọi
module. Không UAT bằng tài khoản production, không đo tải hoặc kiểm tra mọi tích
hợp bên ngoài. Fork deepmerge vẫn là bản tự duy trì; audit 0 không thay thế
việc theo dõi upstream và kiểm thử tương thích.

Ưu tiên tiếp theo: xử lý F1 song song với R1; sửa R4, R2 và R3 kèm các ca hồi quy
đã tái hiện. Không nâng coverage threshold tùy tiện để thay thế test các lỗi này.
