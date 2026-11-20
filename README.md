# NestJS RealWorld

Backend học tập theo [hướng dẫn NestJS của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md), triển khai theo [kế hoạch 6 pull](docs/pull-plan.md).

## Chạy ứng dụng

Cần Node.js 22 trở lên, npm và Docker Compose:

```sh
npm ci
npm run setup
docker compose -p realworld-training up -d --wait
npm run migration:run
npm run start:dev
```

`npm run setup` tạo `.env` nếu chưa có, bổ sung biến còn thiếu và sinh JWT secret ngẫu nhiên nếu chưa được đặt; các giá trị hiện có được giữ lại. Kiểm tra `.env` trước khi chạy và không commit file này.

Compose dùng PostgreSQL 18 tại `127.0.0.1:5433` và Redis 7.4 tại `127.0.0.1:6380`, có volume lưu dữ liệu. User/password/database PostgreSQL local đều là `realworld`. Có thể đổi cổng qua `POSTGRES_PORT` và `REDIS_PORT`, đồng thời cập nhật các URL tương ứng trong `.env`.

- Hello: <http://localhost:3000/api/hello?name=An&lang=vi>
- Swagger UI: <http://localhost:3000/api/docs>
- OpenAPI JSON: <http://localhost:3000/api/docs-json>

Hello hỗ trợ `en`/`vi`; query `lang` ưu tiên hơn `Accept-Language`, mặc định/fallback là `en`, query `lang` sai trả `422`. Ví dụ trên trả `{"message":"Xin chào, An!","language":"vi"}`.

## Authentication

Các đường dẫn đều có tiền tố `/api`:

- `POST /users` → `201`: đăng ký bằng `{ "user": { "username": "trainee_an", "email": "an@example.com", "password": "Training-password-123!" } }`.
- `POST /users/login` → `200`: đăng nhập bằng `{ "user": { "email": "an@example.com", "password": "Training-password-123!" } }`.
- `GET /user` → `200`: lấy người dùng hiện tại, giữ nguyên token dùng trong request.
- `POST /users/logout` → `204`: thu hồi token hiện tại.

Response người dùng theo RealWorld: `{ "user": { "email": "...", "token": "...", "username": "...", "bio": null, "image": null } }`. Gửi token trong header `Authorization: Token <jwt>` hoặc `Authorization: Bearer <jwt>`.

JWT dùng HS256, `sub` là UUID người dùng và mỗi phiên đăng nhập có `jti` riêng. Token mặc định có hiệu lực 3.600 giây. Logout lưu `jti` vào Redis blacklist với thời điểm hết hạn `EXAT` bằng `exp` của token; các phiên đăng nhập khác vẫn hoạt động. Gọi logout lại bằng token đã thu hồi trả `401`. Redis bật AOF và `noeviction`; nếu không kiểm tra hoặc ghi được blacklist, API liên quan trả `503` thay vì cho token đi qua.

Validation envelope trả `422`; token sai/hết hạn/đã thu hồi hoặc sai thông tin đăng nhập trả `401`; email/username trùng trả `422`. Đăng ký và đăng nhập được giới hạn mặc định 10 request/phút theo IP cho từng route, cấu hình bằng `AUTH_RATE_LIMIT`.

## Hồ sơ và ảnh đại diện

- `PUT /api/user` nhận JSON `{ "user": { "bio": "..." } }` để cập nhật các trường được gửi. Đặt `user.image` thành `null` để xóa ảnh hiện tại.
- `GET /api/profiles/:username` trả hồ sơ công khai. Gửi token để biết tài khoản hiện tại có đang theo dõi hồ sơ đó hay không.
- `POST /api/profiles/:username/follow` và `DELETE /api/profiles/:username/follow` cần token và trả hồ sơ với trạng thái `following` sau thao tác.
- Để upload, gửi `PUT /api/user` dạng `multipart/form-data` với trường file `avatar`. Có thể gửi kèm trường text `user` chứa JSON, ví dụ `{"bio":"Tôi viết hướng dẫn."}`. API nhận JPEG, PNG hoặc WebP tối đa 2 MiB.
- Sau khi upload, `user.image` là đường dẫn `/api/attachments/<uuid>`. Chủ tài khoản gửi token khi tải ảnh qua đường dẫn này. Hồ sơ trả ảnh upload cho chính chủ và trả `image: null` cho khách hoặc tài khoản khác. URL ảnh HTTP(S) bên ngoài vẫn hiển thị trong hồ sơ công khai. File lưu trong `.local/uploads` theo mặc định hoặc theo `AVATAR_UPLOAD_DIR`.

## Bình luận bài viết

- `POST /api/articles/:slug/comments` cần đăng nhập. Gửi `{"comment":{"body":"Mình đã chạy thử ví dụ trong bài."}}`. API trả `201` cùng bình luận vừa tạo trong trường `comment`.
- `GET /api/articles/:slug/comments` trả mảng `comments`, mới nhất trước. Khách có thể đọc. Khi gửi token, trường `author.following` cho biết người xem có theo dõi tác giả bình luận hay không.
- `DELETE /api/articles/:slug/comments/:id` dùng ID số từ kết quả tạo bình luận. Tác giả bình luận xóa thành công nhận `204`. Tài khoản khác nhận `403`. Nếu bình luận không thuộc bài viết trong URL, API trả `404`.

## Cấu hình

Xem [.env.example](.env.example). Các biến chính: `APP_HOST`, `APP_PORT`, `CORS_ORIGINS`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (ít nhất 32 ký tự), `JWT_EXPIRES_IN_SECONDS` (60–604800, mặc định 3600), `AUTH_RATE_LIMIT` (mặc định 10). Timeout Redis cấu hình bằng `REDIS_TIMEOUT_MS` (mặc định 2000 ms) và giới hạn hàng đợi bằng `REDIS_QUEUE_LIMIT` (mặc định 1000). Nếu kết nối Redis đã bị đóng, khởi động lại API sau khi Redis sẵn sàng.

Schema chỉ thay đổi qua migration thủ công: không `synchronize`, không chạy migration tự động khi khởi động, không tự cài extension PostgreSQL. Xem [hướng dẫn add/run/revert/reset migration](docs/database-migrations.md).

## Kiểm tra và bản build

```sh
npm run typecheck
npm run lint
npm run sunlint
npm run build
npm run test:build
npm run start:prod
```

`test:build` kiểm tra ứng dụng đã biên dịch cùng locale và Swagger; PostgreSQL/Redis phải sẵn sàng. Sunlint phải không còn vi phạm mức `error` trước khi gửi review.

Unit test và kiểm thử tích hợp chạy bằng test runner của Node.js cùng `ts-node`, không dùng Jest. Các test HTTP sử dụng PostgreSQL và Redis thực, yêu cầu database test riêng có tên kết thúc bằng `_test` và Redis database index là số nguyên lớn hơn 0.

Tạo database test một lần:

```sh
docker compose -p realworld-training exec -T postgres createdb -U realworld realworld_test
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://realworld:realworld@127.0.0.1:5433/realworld_test'
$env:TEST_REDIS_URL = 'redis://127.0.0.1:6380/1'
npm test
```

macOS/Linux:

```sh
TEST_DATABASE_URL='postgresql://realworld:realworld@127.0.0.1:5433/realworld_test' TEST_REDIS_URL='redis://127.0.0.1:6380/1' npm test
```

Các bộ test HTTP chạy migration trên database test và dọn dữ liệu người dùng, bài viết, bình luận cùng các bảng liên quan trước và sau mỗi ca kiểm thử. Bộ test xác thực chỉ xóa các khóa Redis mà nó tạo.

## Tham khảo

- [Bài tập NestJS của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md)
- [RealWorld backend](https://realworld-docs.netlify.app/specifications/backend/endpoints/)
- [NestJS](https://docs.nestjs.com/) và [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)

Cách tổ chức của `ThanhhBinh023` chỉ là tham khảo; mã nguồn được triển khai độc lập. Mail và queue chưa thuộc phạm vi 6 pull.
