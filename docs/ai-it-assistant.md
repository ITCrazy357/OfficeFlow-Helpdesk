# AI hỗ trợ nhân viên IT

Trong chi tiết ticket, ADMIN và IT_STAFF có thể yêu cầu:

- Tóm tắt ticket và tối đa 20 bình luận gần nhất.
- Soạn phản hồi dựa trên tối đa 3 bài kiến thức liên quan đã xuất bản.
- Soạn bài kiến thức từ ticket RESOLVED/CLOSED.

AI chỉ trả bản nháp. Phản hồi được chỉnh sửa rồi **thêm** vào ô bình luận,
giữ nguyên phần người dùng đang soạn; chỉ nút **Gửi bình luận** mới gửi.
Bài kiến thức có biểu mẫu kiểm tra, sửa và nút **Lưu bản nháp kiến thức**;
bài luôn được tạo với `isPublished=false`. Xuất bản qua Kho kiến thức sau khi
kiểm tra. Không tự cập nhật ticket, người phụ trách hoặc trạng thái.

## Cấu hình backend

Không có migration hay dependency mới. Mặc định AI tắt, các luồng thủ công
vẫn dùng được. Trên Render, đặt các biến môi trường của **backend**:

```dotenv
AI_ENABLED=true
OPENAI_API_KEY=<secret trong Render>
OPENAI_MODEL=<model được phép sử dụng trong OpenAI project>
OPENAI_TIMEOUT_MS=25000
OPENAI_MAX_OUTPUT_TOKENS=2500
```

Không đặt key trong biến `NEXT_PUBLIC_*`, frontend, Git hoặc log. Không có model
mặc định: chọn model hỗ trợ Responses API và Structured Outputs với JSON schema.
Nếu bật AI nhưng thiếu key/model, backend báo lỗi cấu hình khi khởi động.
Giới hạn timeout 5–60 giây, output 500–4000 token. Model/tài khoản không tương
thích được xử lý như lỗi dịch vụ; người dùng giữ bản nháp hiện tại và có thể
soạn thủ công. `AI_ENABLED=false` tắt tính năng mà không cần sửa dữ liệu.

Redis phải hoạt động để gọi AI. Dùng Redis riêng tư cùng vùng với API và prefix
riêng cho từng môi trường như runbook. Mỗi người tối đa 5 lần thử/phút và một
yêu cầu đang chạy trên toàn bộ replica; tối đa 4 yêu cầu đang chạy mỗi tiến trình.
Lỗi provider vẫn tính là một lần thử. Không tự retry, không xếp hàng nền.
Lease Redis hết hạn sau 120 giây; lỗi release có thể khiến người dùng phải chờ.
Đây không phải hạn mức chi phí tháng: đặt budget/alert và giới hạn model trong
OpenAI project theo nhu cầu vận hành.

## Chạy local bằng Docker Compose

Đặt các biến AI trong `officeflow-nest-server/.env`. Compose truyền chúng vào
service `nest-api` qua phần `environment`. Sau khi thay đổi `.env`, tạo lại riêng
container API để nhận giá trị mới (chạy trong `officeflow-nest-server`):

```bash
docker compose up -d --no-deps --force-recreate nest-api
```

Lệnh này dùng image hiện có, không build lại code và không tạo lại MySQL/Redis.
Nếu cần cập nhật code trong image, build riêng API trước khi tạo lại container.

Frontend local hiện dùng `NEXT_PUBLIC_API_URL=http://localhost:5001/api`; biến
trên Render không áp dụng cho backend ở URL này. Nếu muốn frontend local gọi
Render qua proxy, đặt `NEXT_PUBLIC_API_URL=/backend-api` và `API_PROXY_TARGET`
thành URL backend Render có hậu tố `/api`, rồi khởi động lại frontend.

Trên web deploy, kiểm tra Request URL và JSON của `/ai/status` trong Network.
`DISABLED` là cấu hình AI chưa bật/đủ; `UNAVAILABLE` là Redis chưa sẵn sàng.
Trên Render cần lưu biến ở đúng service backend và chọn **Save and deploy**;
**Save only** chưa áp dụng biến vào tiến trình đang chạy.

## API và dữ liệu

- `GET /api/ai/status`: trạng thái cấu hình và Redis, chỉ ADMIN/IT_STAFF.
- `POST /api/ai/tickets/:id/draft`: body `{ "task": "SUMMARY|REPLY|ARTICLE" }`.
  Không nhận prompt tùy ý, provider URL, API key hay model từ client.
- REPLY không có nguồn phù hợp trả 422 trước khi gọi provider. ARTICLE chỉ dùng
  ticket đã giải quyết/đóng. Nguồn không hợp lệ hoặc phản hồi sai định dạng trả 502.
- Kiểm tra lại quyền, phiên bản ticket/bình luận và trạng thái/phiên bản nguồn
  sau khi provider trả lời. Dữ liệu thay đổi trả 409, quyền bị thu hồi trả 403.

Nội dung gửi đi: tiêu đề tối đa 150 ký tự, mô tả 6000, 20 bình luận x 1200 ký tự
(theo thứ tự thời gian, kèm vai trò và thời điểm), tối đa 3 bài đã xuất bản
(tiêu đề 150, tóm tắt 300, nội dung 4000 ký tự/bài). SUMMARY không gửi bài kiến thức.
Giao diện báo khi nội dung bị rút gọn. Không tải/gửi tệp đính kèm, trường tên/email
tác giả, thông tin tài sản, nghỉ phép hoặc bài kiến thức chưa xuất bản.
Tên/email và dữ liệu nhạy cảm vẫn có thể nằm trong phần văn bản người dùng nhập.

Có che một số mẫu mật khẩu/token/API key phổ biến; đây không phải hệ thống DLP
và không bảo đảm che mọi bí mật. Nhân viên phải rà soát nội dung ticket trước
khi yêu cầu AI và kiểm tra lại đầu ra. Dữ liệu ticket/KB được coi là dữ liệu
không đáng tin trong prompt; AI không có công cụ thực thi. Nội dung trả về được
kiểm tra schema/kích thước và ID nguồn; hiển thị như văn bản thuần, không chạy HTML.
Các kiểm tra này không chứng minh lời giải đúng hoặc trích dẫn thực sự hỗ trợ
mọi câu trong phản hồi; nhân viên vẫn phải đối chiếu nguồn.

Backend gọi endpoint OpenAI cố định, gửi `store:false`, không lưu prompt/bản nháp
AI vào DB. `store:false` không đồng nghĩa Zero Data Retention: xem
[chính sách dữ liệu OpenAI](https://developers.openai.com/api/docs/guides/your-data).
Log chỉ ghi metadata (người yêu cầu, ticket, task, model, token nếu có, ID nguồn),
không ghi key, nội dung ticket hoặc lỗi thô của provider. Token thiếu được giữ
là chưa biết, không tính thành 0. Bản nháp ở bộ nhớ giao diện, mất khi rời trang;
không tự lưu vào localStorage. Hủy request phía trình duyệt khi rời trang không
bảo đảm hủy request provider đã nhận; timeout backend vẫn giới hạn thời gian.

## Kiểm tra trước khi phát hành

Chạy lint, unit/HTTP E2E, integration trên MySQL/Redis dùng riêng cho test và build
production theo CI. Test AI dùng provider giả, không dùng key thật hoặc dữ liệu
production. Browser fixture kiểm tra UI, giữ nội dung đang soạn và thao tác gửi/lưu
chủ động; không chứng minh lưu dữ liệu thật.

Sau khi cấu hình key/model trên môi trường đích, dùng một ticket giả không có dữ
liệu nhạy cảm để kiểm tra cả ba tác vụ bằng tài khoản IT. Kiểm tra nguồn dẫn, sửa
bản nháp và gửi/lưu thủ công; thử tắt AI để xác nhận luồng thủ công hoạt động.
Chỉ bước này mới xác minh model/key/project thật; test mock và build local không
chứng minh OpenAI hoặc CI/CD từ xa đã chấp nhận cấu hình.

Tham chiếu: [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
