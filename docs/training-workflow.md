# Quy trình Git và review cho bài tập NestJS

Repo thực hiện theo [hướng dẫn training của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md): khởi tạo repo, tạo PR codebase, tạo PR model/database, rồi triển khai từng API qua PR riêng. Không merge trước khi có ít nhất một thành viên **APPROVED**.

## Các nhánh

- `main`: điểm bắt đầu tối thiểu của repo, hiện có README và `.gitignore`.
- `chore/init-codebase`: cấu trúc NestJS, cấu hình TypeScript và công cụ phát triển.
- `chore/init-models`: kết nối PostgreSQL, entities, quan hệ và migration.
- `chore/api-foundation`: JWT guard, validation, exception filter và phần dùng chung cho API.
- Các nhánh chức năng: mỗi PR thêm một API, có thể kèm DTO, service và phần hỗ trợ cần thiết cho API đó.
- `training/complete`: bản tích hợp đầy đủ để chạy và kiểm thử toàn bộ 19 endpoint, kèm tài liệu và công cụ kiểm tra.

Nhánh đầy đủ giúp chạy bài tập ngay; trạng thái của nhánh này không thay thế việc review từng PR. Repo không tự gán reviewer hoặc tự merge thay cho thành viên nhóm.

## Review chuỗi PR

Các PR được xếp thành chuỗi phụ thuộc: PR đầu có base là `main`; PR tiếp theo dùng nhánh của PR ngay trước làm base. Nhờ vậy, diff mỗi PR chỉ thể hiện phần thay đổi mới, dù mã nguồn cần các bước trước để chạy.

1. Review từ PR codebase, sau đó đến model, phần dùng chung và các API theo thứ tự trong chuỗi.
2. Đọc mô tả PR để xác định base và điều kiện kiểm thử. Khi checkout nhánh của một PR, có thể chưa có các API nằm ở bước sau.
3. Self-review theo Sunlint và Google TypeScript Style Guide; kiểm tra validation, xác thực, phân quyền, response và trường hợp lỗi của API tương ứng.
4. Chạy các kiểm tra áp dụng được ở bước đó. Với bản tích hợp đầy đủ, dùng các lệnh bên dưới.
5. Đính kèm ảnh kết quả Sunlint trong comment review nếu trainer yêu cầu. [Ảnh evidence trong repo](evidence/sunlint.png) và báo cáo `reports/` là tài liệu hỗ trợ; nên chạy lại trên commit đang review.
6. Nhờ thành viên nhóm review chéo. Chỉ merge PR sau khi nhận ít nhất một **APPROVED**.
7. Sau khi PR trước đã merge, đổi base của PR kế tiếp về `main`, kiểm tra lại diff và CI, rồi tiếp tục review. Nếu squash hoặc rebase làm thay đổi lịch sử, cập nhật nhánh phụ thuộc để tránh đưa lại các commit đã merge vào diff.

Không cần merge toàn bộ chuỗi chỉ để chạy ứng dụng: checkout `training/complete` theo README. Không dùng bản tích hợp để bỏ qua điều kiện APPROVED của bài tập.

## Kiểm tra trước khi gửi review

```sh
npm ci
npm run typecheck
npm run lint
npm run build
npm run sunlint
npm audit --omit=dev
```

`npm run sunlint` chạy phiên bản đã khóa trong lockfile, gồm heuristic và ESLint engine. Wrapper chỉ xử lý tương thích Windows khi nạp plugin. Không chấp nhận kết quả “0 lỗi” nếu một engine bị lỗi hoặc bỏ qua; cần đọc cả log và báo cáo. Sửa toàn bộ vi phạm mức `error`; các `warning` cần được xem xét và nên xử lý.

Ở lần kiểm tra ban đầu, `npm audit --omit=dev` không phát hiện lỗ hổng trong dependency runtime. Bộ công cụ phát triển còn cảnh báo mức moderate ở dependency bắc cầu; cần theo dõi cập nhật từ nhà cung cấp và đọc lại báo cáo audit khi thay lockfile.

Thực hiện `npm test` với `TEST_DATABASE_URL` trỏ tới database riêng có tên kết thúc bằng `_test`; xem lệnh PowerShell và macOS/Linux trong [README](../README.md). Suite tự chạy migration, bao gồm 14 ca kiểm thử tích hợp trên PostgreSQL. Các nhánh ở đầu chuỗi có thể chưa chứa suite hoặc đủ module để chạy toàn bộ ca kiểm thử.

Không commit secret, `.env`, `node_modules`, dữ liệu database hoặc các báo cáo sinh tự động trong `reports/`. Những thay đổi sửa lỗi sau review nên giữ trong PR của API liên quan khi có thể; tránh ghép thêm API khác vào cùng PR.

## Tài liệu để đối chiếu

- [RealWorld backend endpoints](https://realworld-docs.netlify.app/specifications/backend/endpoints/)
- [RealWorld response format](https://realworld-docs.netlify.app/specifications/backend/api-response-format/)
- [NestJS](https://docs.nestjs.com/)
- [Sunlint](https://coding-standards.sun-asterisk.vn/docs/ai-agent-instructions/)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
