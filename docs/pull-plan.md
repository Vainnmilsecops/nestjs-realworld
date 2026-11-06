# Kế hoạch 6 pull request

Pull 1 đã merge qua [PR #27](https://github.com/Vainnmilsecops/nestjs-realworld/pull/27); Pull 2 đang được triển khai. Local và remote giữ `main` cùng hai nhánh Pull 1 và Pull 2. Tên nhánh của Pull 3–6 dưới đây là kế hoạch, sẽ được tạo khi bắt đầu làm từng pull.

## Pull 1 — Init, i18n, Swagger · đã merge

- NestJS 11, TypeScript strict, cấu hình môi trường, validation và CORS.
- `GET /api/hello` hỗ trợ `name`, query `lang` và `Accept-Language`: `en`/`vi`, query được ưu tiên, fallback `en`, `lang` sai trả `422`.
- Swagger tại `/api/docs`, schema tại `/api/docs-json`.
- Unit test và HTTP smoke test bằng Node.js test runner và `ts-node`.

Mã nguồn đã nằm trên `main`; nhánh `feature/01-init-i18n-swagger` được giữ để tra cứu.

## Pull 2 — Database, auth, Redis · đang triển khai

Nhánh hiện tại: `feature/02-database-auth-redis`; base là `main`.

- PostgreSQL/TypeORM và User UUID entity; migration thủ công add/run/revert/reset.
- `POST /api/users`, `POST /api/users/login`, `GET /api/user`, `POST /api/users/logout`.
- JWT HS256 có `jti` riêng từng phiên; Redis blacklist giữ token logout đến đúng lúc token hết hạn. Lỗi Redis trả `503` để không bỏ qua kiểm tra thu hồi.
- Compose PostgreSQL 18 và Redis 7.4 có volume, healthcheck và Redis AOF/`noeviction`.
- Kiểm thử validation, xác thực, dữ liệu trùng và logout với PostgreSQL/Redis thực; thêm test cho scaffold và guard của migration reset.

Xem [cách chạy](../README.md) và [migration thủ công](database-migrations.md). Không merge trước khi mentor approve.

## Pull 3 — Người dùng, avatar, attachments · kế hoạch

Nhánh dự kiến: `feature/03-users-avatar-attachments`.

- Cập nhật người dùng, xem profile, follow và unfollow.
- Avatar lưu ở filesystem local; kiểm tra định dạng và kích thước upload.
- Bảng attachments có `id` kiểu UUID, `url`, `file_name`, `file_type`, `file_size` và thông tin chủ sở hữu đa hình.
- Endpoint quản lý hoặc truy cập attachment riêng tư kiểm tra quyền chủ sở hữu; hoàn thiện thiết kế quyền truy cập khi triển khai.

## Pull 4 — Articles · kế hoạch

Nhánh dự kiến: `feature/04-articles`.

- Tạo, xem, cập nhật và xóa bài viết; chỉ tác giả được sửa/xóa.
- Danh sách có phân trang, bộ lọc và feed từ người đang theo dõi.
- Favorite/unfavorite, validation, phân quyền và response theo RealWorld.

## Pull 5 — Comments · kế hoạch

Nhánh dự kiến: `feature/05-comments`.

- Thêm, xem danh sách và xóa bình luận trong bài viết; không có cập nhật bình luận.
- Kiểm tra bài viết tồn tại và quyền xóa của tác giả bình luận.

## Pull 6 — E2E · kế hoạch

Nhánh dự kiến: `test/06-e2e`.

- Kiểm thử tích hợp các luồng nghiệp vụ, có ít nhất một bộ C2C cho một controller.
- Dùng database test riêng; tạo fixture/fake data trước mỗi test và truncate sau mỗi test.
- Bao phủ thành công, validation, xác thực, phân quyền và tài nguyên không tồn tại.

## Quy tắc làm việc

Triển khai lần lượt theo thứ tự trên. Sau khi pull trước được mentor approve và merge, tạo nhánh tiếp theo từ `main`; không tạo PR trống hoặc các nhánh chờ chưa có việc. Trước khi gửi review, chạy typecheck, lint, test, Sunlint và build; sửa toàn bộ lỗi Sunlint mức `error` và đính kèm evidence theo yêu cầu trainer.

Bản thử nghiệm cũ được giữ bằng [tag `archive/previous-implementation-2026-11-04`](https://github.com/Vainnmilsecops/nestjs-realworld/tree/archive/previous-implementation-2026-11-04); nhánh `training/complete` đã xóa. Tham khảo `ThanhhBinh023` về cách tổ chức, không sao chép mã nguồn. Mail, queue và nội dung nâng cao ngoài danh sách trên chưa thuộc phạm vi 6 pull.

Nguồn: [hướng dẫn Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md), [RealWorld backend](https://realworld-docs.netlify.app/specifications/backend/endpoints/), [NestJS](https://docs.nestjs.com/).
