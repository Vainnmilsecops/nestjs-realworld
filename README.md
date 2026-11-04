# NestJS RealWorld

Backend API cho ứng dụng kiểu Medium theo [hướng dẫn NestJS của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md), dùng NestJS 11, TypeScript, PostgreSQL, TypeORM và JWT. Dự án không có frontend.

Repo riêng tư: [Vainnmilsecops/nestjs-realworld](https://github.com/Vainnmilsecops/nestjs-realworld). Nhánh `training/complete` chứa toàn bộ mã nguồn để chạy thử. Nhánh `main` bắt đầu từ README; các thay đổi được chia thành chuỗi PR để review theo bài tập. Chỉ merge khi có ít nhất một thành viên **APPROVED**. Xem [quy trình training](docs/training-workflow.md).

## Chạy nhanh

Cần Node.js 22 trở lên, npm và Docker Compose. Sau khi clone repo:

```sh
git switch training/complete
npm ci
npm run setup
docker compose up -d
npm run migration:run
npm run start:dev
```

`npm run setup` tạo `.env` với JWT secret ngẫu nhiên và giữ nguyên file nếu đã tồn tại. Chờ PostgreSQL báo sẵn sàng bằng `docker compose ps` trước khi chạy migration. Compose mở database tại `127.0.0.1:5433`, database/user/password local đều là `realworld`.

- API: <http://localhost:3000/api>
- Swagger: <http://localhost:3000/docs>
- Dừng database: `docker compose down`; dữ liệu được giữ trong volume.

Nếu dùng PostgreSQL đã cài trên máy, tạo database và user riêng, sửa `DATABASE_URL` trong `.env`, rồi chạy migration và ứng dụng. Ví dụ:

```dotenv
DATABASE_URL=postgresql://your_user:your_password@127.0.0.1:5432/realworld
```

Schema được quản lý bằng migration; `synchronize` bị tắt. `npm run migration:revert` hoàn tác migration gần nhất. Để chạy bản đã biên dịch:

```sh
npm run build
npm start
```

## Chức năng

Đã triển khai đủ 7 nhóm chức năng, tổng cộng **19 endpoint** theo RealWorld. Các đường dẫn dưới đây đều có tiền tố `/api`:

- Người dùng và profile: `POST /users`, `POST /users/login`, `GET /user`, `PUT /user`, `GET /profiles/:username`, `POST /profiles/:username/follow`, `DELETE /profiles/:username/follow`.
- Bài viết: `POST /articles`, `GET /articles/:slug`, `PUT /articles/:slug`, `DELETE /articles/:slug`, `GET /articles`, `GET /articles/feed`.
- Yêu thích và tag: `POST /articles/:slug/favorite`, `DELETE /articles/:slug/favorite`, `GET /tags`.
- Bình luận: `POST /articles/:slug/comments`, `GET /articles/:slug/comments`, `DELETE /articles/:slug/comments/:id`.

Đăng ký và đăng nhập trả token trong `user.token`. Gửi header `Authorization: Token <jwt>`; dạng `Bearer <jwt>` cũng được hỗ trợ. Logout được thực hiện bằng cách xóa token ở client; RealWorld không yêu cầu endpoint logout hoặc thu hồi token trên server.

Request dùng envelope như `{ "user": {...} }`, `{ "article": {...} }`, `{ "comment": {...} }`; lỗi có dạng `{ "errors": { "body": [...] } }`. Validation trả `422`, thiếu/sai token trả `401`, sửa hoặc xóa nội dung của người khác trả `403`, tài nguyên không tồn tại trả `404`.

Danh sách bài viết hỗ trợ `tag`, `author`, `favorited`, `limit` (mặc định 20, tối đa 100), `offset` (mặc định 0). `articlesCount` là tổng số kết quả trước phân trang; danh sách sắp theo thời gian mới nhất. Theo [đặc tả RealWorld hiện hành](https://realworld-docs.netlify.app/specifications/backend/api-response-format/), `/articles` và `/articles/feed` không trả `body`; lấy nội dung đầy đủ qua `/articles/:slug`. Slug đổi khi tiêu đề đổi. Follow và favorite có thể gọi lặp lại mà không tạo bản ghi trùng.

## Kiểm thử và kiểm tra mã nguồn

```sh
npm run typecheck
npm run lint
npm run build
npm run sunlint
npm audit --omit=dev
```

Sunlint chạy cả heuristic và ESLint engine qua wrapper tương thích Windows, ghi báo cáo vào `reports/sunlint.json` và `reports/sunlint.html`. Phải sửa toàn bộ lỗi mức `error`; nên xử lý cả `warning`. Xem [ảnh evidence Sunlint](docs/evidence/sunlint.png). Các công cụ dev có thể còn cảnh báo dependency bắc cầu; kiểm tra báo cáo `npm audit` và không tự động nâng major bằng `--force`.

Suite gồm **14 ca kiểm thử tích hợp**, đã chạy trên PostgreSQL 18, bao phủ luồng người dùng, bài viết, bình luận, phân trang, follow/favorite, validation, phân quyền, đổi mật khẩu và giới hạn đăng nhập. Suite tự chạy migration trên database test riêng; tên database bắt buộc kết thúc bằng `_test`.

Tạo database test một lần khi dùng Compose:

```sh
docker compose exec postgres createdb -U realworld realworld_test
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://realworld:realworld@127.0.0.1:5433/realworld_test'
npm test
```

macOS/Linux:

```sh
TEST_DATABASE_URL='postgresql://realworld:realworld@127.0.0.1:5433/realworld_test' npm test
```

Nếu dùng PostgreSQL ngoài Compose, thay host, port và thông tin đăng nhập tương ứng. Suite tạo dữ liệu riêng cho từng lần chạy và dọn các user đó sau khi kết thúc.

## Cấu hình và triển khai

Các biến môi trường được liệt kê trong [.env.example](.env.example): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN_SECONDS`, `HOST`, `PORT`, `CORS_ORIGINS`. JWT secret phải có ít nhất 32 ký tự; không commit `.env`.

Ứng dụng có Helmet, validation và giới hạn request theo IP/từng route: 10 request/phút cho đăng ký/đăng nhập, 100 request/phút cho các route còn lại. Bộ đếm nằm trong bộ nhớ của từng tiến trình. Khi triển khai nhiều instance, dùng kho đếm chung; cấu hình HTTPS qua proxy, CORS, tài khoản database và secret phù hợp môi trường thực tế.

## Tài liệu tham khảo

- [Bài tập gốc của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md)
- [RealWorld backend endpoints](https://realworld-docs.netlify.app/specifications/backend/endpoints/) và [response format](https://realworld-docs.netlify.app/specifications/backend/api-response-format/)
- [Tài liệu NestJS](https://docs.nestjs.com/)
- [Sunlint](https://coding-standards.sun-asterisk.vn/docs/ai-agent-instructions/)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
