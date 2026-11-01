# OfficeFlow — ECC re-review sau commit 77–80

Cập nhật xử lý: xem [các bản sửa 81–83](2026-11-01-ecc-fixes-2.md).
Bằng chứng bên dưới mô tả snapshot trước sửa `a18389a`.

ECC production audit: **60/100 — chưa nên merge/deploy**, vì còn lỗi tạo ADMIN sau
thu hồi quyền, mất cookie khi refresh gặp lỗi tạm thời và F1 chưa có bằng chứng đóng.

Ngày kiểm tra: 2026-11-01, Asia/Bangkok. Snapshot: `a18389a0e1101efef2b470b1107c13248eb92165`,
nhánh `fix/ecc-rereview-r1-r4`. Working tree sạch trước review. Áp dụng ECC
security-review và production-audit. Lượt này không sửa mã ứng dụng, không
commit/push/merge/deploy và không dùng tài khoản production.

## R5 — HIGH: tạo user vẫn hoàn tất sau khi ADMIN mất quyền

- Vị trí: `officeflow-nest-server/src/users/users.service.ts:74`, `:104`, `:106`.
  Controller hạn chế POST /users cho ADMIN, nhưng service không đọc lại actor
  khi ghi tài khoản mới. Đối tượng `currentUser` chỉ được dùng để ghi audit.
- Trigger: ADMIN vượt qua JwtAuthGuard/RolesGuard và bắt đầu tạo một ADMIN mới.
  Trong lúc bcrypt.hash đang chờ, một ADMIN khác hạ role hoặc vô hiệu hóa người
  thực hiện. Request cũ tiếp tục vào transaction và tạo user mới mà không xét
  lại quyền người thực hiện.
- Tác động: thao tác thu hồi quyền chưa chặn được việc tạo một tài khoản ADMIN
  mới với mật khẩu người thực hiện biết. Tài khoản mới đăng nhập và vượt guard
  ADMIN được. Bản sửa 77 bảo vệ AccountService; luồng UsersService.create vẫn hở.
- Tái hiện: chạy service, AuthService, JwtAuthGuard, RolesGuard và bcrypt thật với
  DB fixture. Hai ca demotion/deactivation: request tiếp theo của actor bị 403/401,
  nhưng create đang chờ vẫn thành công, ghi audit/outbox và tài khoản mới vượt
  guard ADMIN. Quan sát không có lần đọc lại actor trong create.
- Cần sửa: gọi assertActiveAdmin trong transaction Serializable khi tạo user;
  xét trạng thái buộc đổi mật khẩu theo quy tắc guard nếu cần; dùng helper retry
  hiện có và giữ bcrypt bên ngoài transaction. Thêm hồi quy cho cả hạ quyền và
  vô hiệu hóa khi hash đang chờ, xác nhận không tạo user/audit/outbox. Sau đó
  kiểm chứng lại trên MySQL dùng riêng để bao phủ thứ tự ghi/khóa thực.

## R6 — MEDIUM: lỗi refresh tạm thời xóa cookie và gây mất phiên

- Vị trí: `officeflow-nest-server/src/auth/auth.controller.ts:108–110`.
- Catch của refresh gọi clearRefreshCookie cho mọi lỗi từ AuthService, gồm
  lỗi DB/transaction tạm thời chưa tiêu thụ refresh token. Frontend bảo toàn
  access token với 429/503 không thể phục hồi cookie HttpOnly đã bị server xóa.
- Tái hiện: AuthService thật với DB fixture ném ServiceUnavailableException
  trước khi dùng token; controller trả lỗi 503 và gọi xóa cookie. Token còn
  chưa dùng, nhưng request refresh kế tiếp không còn cookie nên bị 401.
  Gửi lại cookie gốc khi storage hoạt động thì AuthService.refresh thành công.
- Tác động: một lỗi hạ tầng ngắn hạn biến thành mất phiên; khi tải lại tab hoặc
  access token hết hạn, người dùng phải đăng nhập lại dù phiên DB vẫn hợp lệ.
- Cần sửa: chỉ xóa cookie khi xác nhận token không hợp lệ/hết hạn/reuse hoặc
  không có cookie; giữ cookie khi lỗi hạ tầng. Thêm controller/HTTP regression
  kiểm tra Set-Cookie trên 5xx và retry sau lỗi. Không bỏ phát hiện reuse.
- Khoảng trống kiểm thử: frontend-regressions.test.mjs:315 kiểm tra client giữ
  token với offline/429/503 bằng Axios adapter; không chạy controller hoặc mô
  phỏng response xóa cookie, nên test xanh không bao phủ lỗi này.

## L1 — LOW: retry SMTP từng phần có thể gửi email trùng

- Vị trí: `officeflow-nest-server/src/mail/listeners/ticket-email.listener.ts:32–52`.
- Một recipient nhận thành công, recipient tiếp theo lỗi SMTP: listener ném lỗi
  để outbox retry toàn sự kiện. Lần retry gửi lại cả người đã nhận; không dùng
  outboxEventId/recipient làm khóa ghi nhận gửi thành công.
- Fixture tái hiện cùng một sự kiện: người thứ nhất nhận 2 lần, người thứ hai
  nhận 1 lần sau retry. Đây là giới hạn của cơ chế giao ít nhất một lần hiện tại,
  không phải bằng chứng rằng kiểm tra quyền mới bị bỏ qua.
- Ưu tiên sau R5/R6: chốt mức chấp nhận email trùng; nếu cần giảm trùng khi retry
  từng phần, lưu kết quả gửi theo event + recipient. Không tuyên bố SMTP có thể
  được bảo đảm exactly-once chỉ bằng ghi nhận trong DB.

## Bằng chứng kiểm tra và giới hạn

- Chạy lại 5 bộ unit liên quan AccountService, password policy, ticket access,
  notifications và ticket email: **59/59 đạt**. Không sửa test/mã để tạo kết quả xanh.
- Hai lỗi mới và email trùng được tái hiện bởi
  `.verification/ecc-second-review-fixtures.cjs`; bằng chứng tại
  `.verification/ecc-second-review-fixture-evidence.json`. Các file này local,
  được ignore; DB, cookie response và SMTP đều là fixture. Không gọi SMTP thật.
- Docker daemon đang tắt: bước docker version thất bại trước khi khởi tạo
  container. **Không chạy lại MySQL/Redis integration ở lượt này** và không gọi
  bằng chứng fixture là MySQL hoặc browser thật.
- [PR #3](https://github.com/ITCrazy357/OfficeFlow-Helpdesk/pull/3) vẫn open,
  mergeable, head `a18389a`; main remote vẫn `955a637`.
- [Backend CI](https://github.com/ITCrazy357/OfficeFlow-Helpdesk/actions/runs/41225971598)
  và [Frontend CI](https://github.com/ITCrazy357/OfficeFlow-Helpdesk/actions/runs/41225971574)
  vẫn success khi đọc lại trạng thái remote. Đây là các run của head hiện tại,
  không phải run mới do review này tạo. Vercel deployment môi trường Preview
  success; Render production job skipped. Chưa có UAT production cho 77–80.
- F1 vẫn mở: chưa có bằng chứng xác nhận bảo vệ tài khoản/thu hồi phiên
  production và GitHub Support hoàn tất purge object/cache SQL cũ. Không suy ra
  đóng F1 từ việc xóa file, CI xanh hoặc test fixture.

Ưu tiên tiếp theo: xử lý R5 trước, rồi R6; kiểm chứng MySQL/HTTP ở môi trường dùng
riêng, cập nhật PR và CI. Chỉ sau đó đánh giá lại merge/deploy. Theo dõi F1 như
mục vận hành độc lập có bằng chứng đóng riêng.
