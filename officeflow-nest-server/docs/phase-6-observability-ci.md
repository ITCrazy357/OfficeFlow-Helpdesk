# Phase 6 — Observability và CI

## Phạm vi và trạng thái

Code đã có request ID, JSON logging, metrics có bảo vệ, instrumentation Redis/mail/outbox, coverage gate, cấu hình scanning và cảnh báo. Không thay schema, không chạy migration hoặc sửa database production.

**Chưa thể gọi là production-green:** dependency audit ngày 20/09/2026 báo 14 high và 2 moderate; Docker chưa chạy được trong môi trường kiểm tra; chưa xác nhận GitHub Actions, Prometheus/Alertmanager hoặc gửi cảnh báo ngoài thực tế. Không tự động nâng major NestJS/hạ Prisma theo `npm audit fix --force`.

Error monitoring ở đây là log lỗi đã lọc + counters + alert rules. Chưa tích hợp dịch vụ gom lỗi như Sentry, chưa có distributed tracing. Request ID hiện theo HTTP/async context trong process; không tự truyền qua bản ghi outbox sau khi request kết thúc. Worker có `outboxEventId` để tìm công việc lỗi.

## Bạn đã làm đúng và phần được sửa

- Giữ middleware ghi nhận HTTP finish/abort một lần, tạo request ID, AsyncLocalStorage, lọc thông tin nhạy cảm và token guard cho metrics.
- Giữ một registry metrics dùng chung qua MetricsModule; không dùng URL/user ID/request ID làm metric label.
- Sửa RedisService tự inject chính nó; sửa import `src/metrics` thành relative import.
- Thêm MetricsModule vào MailModule và DashboardModule để Nest resolve dependency đúng.
- Hoàn thiện collector outbox: đăng ký provider, lịch 30 giây, không chạy chồng, dùng thời điểm mới mỗi lần và drain khi shutdown.
- Đồng bộ điều kiện collector với worker: tối đa 8 lần thử, lease hết hạn sau 2 phút. Không dùng bộ tiêu chí 5 lần/5 phút khác worker.
- Khi lấy số liệu thất bại, giữ snapshot cũ và đánh dấu stale/failure; không biến lỗi DB thành backlog bằng 0.
- Đếm dashboard fallback khi Redis chưa ready hoặc đọc lỗi. Cache miss bình thường hay ghi cache lỗi không tự tính là read fallback.
- Metrics hỏng không được thay kết quả nghiệp vụ. Mail ném lại đúng lỗi gốc để retry, không log recipient, subject, body hoặc raw transport error.
- Thêm trạng thái xác minh SMTP để bắt lỗi khởi động xảy ra trước lần scrape đầu tiên.
- Khóa `@nestjs/config` ở 4.0.4 tương thích Nest 11 và bộ test CommonJS/Node 22; đồng bộ lockfile.

## Bản đồ file: nền tảng HTTP và metrics

Các đường dẫn bên dưới tính từ `officeflow-nest-server`, trừ workflow.

| File                                                        | Nhiệm vụ                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                                               | Bật JSON ConsoleLogger, gắn middleware và filter với cùng MetricsService; expose `X-Request-Id` qua CORS. |
| `src/app.module.ts`                                         | Ghép module toàn ứng dụng, trong đó có MetricsModule. Lần này chỉ sửa format tại file này.                |
| `src/common/diagnostics/request-diagnostics.ts`             | Tạo/đọc thông tin chẩn đoán request và lọc error details trước khi log.                                   |
| `src/common/diagnostics/request-context.ts`                 | Giữ request ID bằng AsyncLocalStorage trong async call chain.                                             |
| `src/common/diagnostics/safe-observation.ts`                | Bọc thao tác ghi metrics: nếu recorder lỗi thì cảnh báo, không làm nghiệp vụ thất bại.                    |
| `src/common/middleware/request-observability.middleware.ts` | Gắn request ID vào response, ghi duration/status/abort, bỏ query khỏi log và không tự đếm scrape metrics. |
| `src/common/filters/http-exception.filter.ts`               | Ghi lỗi HTTP an toàn, tăng error counter cho 5xx, giữ response contract.                                  |
| `src/metrics/metrics.module.ts`                             | Cấp cùng MetricsService cho các module tiêu thụ.                                                          |
| `src/metrics/metrics.service.ts`                            | Registry, counter, histogram, gauge và xuất Prometheus text.                                              |
| `src/metrics/metrics.controller.ts`                         | Cung cấp `/api/metrics` dạng text, không bọc response JSON nghiệp vụ.                                     |
| `src/metrics/metrics-token.guard.ts`                        | Chỉ cho scraper có Bearer token đúng vào endpoint; fail closed khi token cấu hình không hợp lệ.           |

Các file nền tảng đã đúng được giữ nguyên, không phải tất cả đều được tạo trong lần sửa này.

## Bản đồ file: theo dõi dependency

| File                                          | Nhiệm vụ                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/redis/redis.service.ts`                  | Kết nối Redis và ghi cảnh báo mất kết nối đã lọc; loại dependency tự tham chiếu.           |
| `src/redis/resilient-throttler.storage.ts`    | Đếm từng lần dùng rate limit memory fallback, vẫn thực thi giới hạn theo instance.         |
| `src/dashboard/dashboard.module.ts`           | Import MetricsModule.                                                                      |
| `src/dashboard/dashboard.service.ts`          | Theo dõi fallback khi đọc dashboard mà Redis không dùng được.                              |
| `src/mail/mail.module.ts`                     | Import MetricsModule cho MailService.                                                      |
| `src/mail/mail.service.ts`                    | Đếm accepted/partial/rejected/error/skipped, trạng thái bật mail và kết quả verify SMTP.   |
| `src/mail/listeners/asset-email.listener.ts`  | Log lỗi gửi mail tài sản bằng safe error details.                                          |
| `src/mail/listeners/ticket-email.listener.ts` | Log lỗi gửi mail ticket bằng safe error details.                                           |
| `src/mail/listeners/user-email.listener.ts`   | Log lỗi gửi mail tài khoản bằng safe error details.                                        |
| `src/mail/listeners/leave-email.listener.ts`  | Log lỗi gửi mail nghỉ phép bằng safe error details.                                        |
| `src/outbox/outbox-policy.ts`                 | Một nguồn định nghĩa retry/lease và điều kiện job sẵn sàng cho worker lẫn collector.       |
| `src/outbox/outbox-metrics.collector.ts`      | Đọc tổng số job sẵn sàng, hết retry và tuổi job cũ nhất mỗi 30 giây; quản lý freshness.    |
| `src/outbox/outbox.processor.ts`              | Theo dõi poll thành công/thất bại và lỗi handler/heartbeat; giữ nguyên cơ chế claim/retry. |
| `src/outbox/outbox.module.ts`                 | Đăng ký collector và MetricsModule.                                                        |

Collector thực hiện các query aggregate riêng, không phải snapshot transaction tuyệt đối. Đây là số liệu vận hành gần đúng; không dùng để ra quyết định tài chính hoặc claim job. Lần lấy đầu tiên sau khoảng 30 giây. Endpoint metrics không truy vấn DB trực tiếp.

## Bản đồ file: test, CI và vận hành

| File                                                                         | Nhiệm vụ                                                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/diagnostics/*.spec.ts`                                           | Test request ID, async context, redaction và structured logging sẵn có.                                                           |
| `src/common/middleware/request-observability.middleware.spec.ts`             | Test finish/abort, không đếm đôi và lỗi metrics không phá request.                                                                |
| `src/common/filters/http-exception.filter.spec.ts`                           | Test ánh xạ lỗi và response/log đã lọc.                                                                                           |
| `src/metrics/metrics.service.spec.ts`, `metrics-token.guard.spec.ts`         | Test metric labels/duration/registry và xác thực scrape.                                                                          |
| `src/mail/mail.service.spec.ts`                                              | Test disabled, verify, accepted/partial/rejected, giữ lỗi gốc và redaction.                                                       |
| `src/outbox/outbox-metrics.collector.spec.ts`                                | Test shared policy, thời gian mới, giữ snapshot khi DB lỗi, chống chạy chồng và shutdown.                                         |
| `src/dashboard/dashboard.service.spec.ts`                                    | Test cache nghiệp vụ và cách đếm fallback.                                                                                        |
| `src/redis/resilient-throttler.storage.spec.ts`                              | Test Redis atomic storage, memory limiter và fallback counter.                                                                    |
| `src/outbox/outbox.processor.spec.ts`, `outbox-dispatch.integration.spec.ts` | Cập nhật wiring MetricsService; bảo vệ hành vi worker/dispatch hiện có. Dispatch test này không chứng minh DB thật.               |
| `test/app.e2e-spec.ts`                                                       | Override collector để E2E dùng mock không khởi động truy vấn nền thật.                                                            |
| `test/metrics.http.test.cjs`                                                 | Kiểm tra module đã build, HTTP endpoint, token, scrape, status và error counter thực qua loopback.                                |
| `test/integration/backend.integration-spec.ts`                               | Cập nhật constructor limiter dùng metrics cho bộ test MySQL/Redis thật cách ly.                                                   |
| `package.json`, `package-lock.json`                                          | Khóa dependency config; coverage reports và ngưỡng global: statements 60%, branches 58%, functions 60%, lines 60%.                |
| `../.github/workflows/backend-ci.yml`                                        | Verify/lint/coverage/E2E/build/integration; npm audit, Gitleaks, Trivy, kiểm tra alert rules; deploy phải chờ verify và security. |
| `.dockerignore`                                                              | Loại `.backups`, SQL và monitoring/secrets khỏi build context.                                                                    |
| `monitoring/prometheus.yml`                                                  | Scrape 15 giây một lần, Bearer token đọc từ file; nạp rules và gửi alert sang Alertmanager.                                       |
| `monitoring/alerts.yml`                                                      | Rules cho backend down, backlog, exhausted, stale collector, stalled worker, Redis fallback, SMTP và HTTP 5xx.                    |
| `monitoring/alerts.test.yml`                                                 | Dữ liệu giả lập để promtool kiểm tra điều kiện và thời gian phát/khôi phục cảnh báo.                                              |
| `monitoring/alertmanager.example.yml`                                        | Route/group cảnh báo; mặc định chỉ local-review, chưa gửi ra ngoài.                                                               |
| `monitoring/compose.yml`                                                     | Chạy Prometheus và Alertmanager local, port chỉ bind loopback; dữ liệu có named volume.                                           |
| `monitoring/.gitignore`                                                      | Không commit thư mục secrets.                                                                                                     |
| `docs/phase-6-observability-ci.md`                                           | Tài liệu bàn giao này.                                                                                                            |

`ticket-comment.service.ts` và `ticket-workflow.service.ts` chỉ bỏ dòng trống dư để lint qua; không sửa nghiệp vụ.

## Luồng chạy, nói đơn giản

Ví dụ người dùng mở dashboard:

1. Middleware nhận request, gắn một mã theo dõi vào `X-Request-Id` và async context.
2. DashboardService thử đọc Redis. Redis hỏng thì service gọi `MetricsService.recordRedisFallback('dashboard_cache')`, sau đó vẫn lấy DB như trước.
3. Khi response xong, middleware ghi JSON log và gọi MetricsService để đếm request, thời gian và nhóm status. Nếu response bị ngắt, ghi aborted thay vì giả định thành công.
4. Prometheus gọi `/api/metrics` bằng token riêng. Nó lấy các con số trong bộ nhớ, không lấy email/body/token của người dùng.
5. Nếu rule thấy fallback xuất hiện đủ thời gian, nó tạo alert. Alertmanager gom các alert liên quan. Chỉ khi bạn cấu hình receiver thì thông báo mới tới người trực.

Ví dụ gửi mail thất bại: worker nhận job → listener gọi MailService → SMTP lỗi → service đếm `error`, log đã lọc và ném lại lỗi → worker giữ cơ chế retry. Collector định kỳ quan sát hàng chờ; nếu job cũ chờ quá lâu hoặc hết retry, alert được tạo. **Metrics chỉ quan sát, không thay worker làm retry.**

`accepted` chỉ có nghĩa SMTP server chấp nhận người nhận, không chứng minh thư đã vào inbox. `officeflow_errors_total` đếm lỗi được quan sát theo layer, không phải số sự cố duy nhất. `smtp_verify_success` là kết quả verify lúc khởi động, không phải probe SMTP liên tục.

## Kích hoạt monitoring local an toàn

1. Chạy backend local với `METRICS_TOKEN` là chuỗi hex lowercase 64 ký tự. Không dùng JWT người dùng làm token scrape.
2. Tự tạo `monitoring/secrets/metrics_token`, nội dung là cùng token, giới hạn quyền đọc. Không commit file này.
3. Sao chép `alertmanager.example.yml` thành `monitoring/secrets/alertmanager.yml`. Bản mặc định chưa có kênh gửi ngoài.
4. Mở Docker Desktop. Từ thư mục backend chạy:

```powershell
docker compose -f monitoring/compose.yml config --quiet
docker compose -f monitoring/compose.yml up -d
docker compose -f monitoring/compose.yml ps
```

5. Mở `http://localhost:9090/targets`: job phải UP; xem trang Alerts. Chờ ít nhất một lần collector cập nhật. Alertmanager ở `http://localhost:9093`.
6. Muốn nhận thông báo thật: chọn receiver, cấu hình trong file secret, mount file URL/token tương ứng nếu dùng `url_file`, rồi kiểm tra một alert thử trên môi trường test. Không đưa webhook thật vào file mẫu.

Compose này dành cho backend chạy trên host port 5001. Triển khai production phải đổi scrape target cho đúng topology; kết nối qua Internet cần HTTPS. Không public cổng Prometheus/Alertmanager trực tiếp. Nếu nhiều API replica cùng đọc một DB, không SUM backlog các replica vì sẽ đếm trùng; theo dõi từng instance hoặc lấy MAX với freshness phù hợp.

Không chạy `down -v`, reset DB hoặc thử làm hỏng Redis/SMTP production để test cảnh báo. Ngưỡng trong rules là điểm xuất phát, cần chỉnh theo tải và yêu cầu thực tế.

## Kiểm tra trước khi merge

Kết quả kiểm tra local ngày 20/09/2026:

- Build và ESLint: pass.
- 57 unit suites, 514 tests: pass.
- E2E dùng dependency mock: 3 suites, 26 tests pass.
- Native HTTP metrics: 9 tests pass; integration safety: 7 tests pass.
- Coverage: statements 61.19%, branches 59.72%, functions 61.68%, lines 61.48%; qua ngưỡng cấu hình.
- YAML parse và `git diff --check`: pass. YAML parse không thay cho promtool kiểm tra PromQL/rule semantics.
- Dependency audit: fail, 14 high và 2 moderate. Chưa chạy được Docker integration, Gitleaks, Trivy, promtool/amtool hoặc toàn workflow GitHub Actions tại máy này.

Máy local có Node shim báo chưa chọn phiên bản. Các kiểm tra trên dùng trực tiếp Node 22.23.2 đã cài. Trước khi dùng các lệnh npm dưới đây, bảo đảm `node --version` và `npm --version` chạy đúng trong terminal của bạn.

```powershell
npm run lint
npm run test:cov -- --runInBand
npm run test:e2e -- --runInBand
npm run test:metrics:http
npm run test:integration:safety
# Cần Docker, chỉ chạy runner cách ly; không trỏ test vào DB Render/Aiven:
npm run test:integration
npm audit --omit=dev --audit-level=high
```

CI có thể đỏ vì vulnerability đã tồn tại trước khi thêm scanner. Đó là gate hoạt động đúng, không nên giảm ngưỡng hoặc bỏ scanner để qua. Cần nâng dependency có kiểm soát và test tương thích, đặc biệt Prisma adapter, Multer/Nest, mail và parsing libraries. Nếu Render bật auto-deploy độc lập GitHub workflow, phải cấu hình Render chờ CI hoặc tắt auto-deploy để tránh đi vòng gate.
