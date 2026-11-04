# Kế hoạch 6 pull request

Triển khai từng pull theo thứ tự dưới đây. **Hiện chỉ Pull 1 được triển khai.** Năm nhánh còn lại được chuẩn bị từ snapshot của Pull 1, chưa có diff và chưa mở PR; chức năng mô tả bên dưới là kế hoạch cho các bước sau.

## Pull 1 — Init, i18n, Swagger

Nhánh: `feature/01-init-i18n-swagger`; PR có base là `main`.

- Khởi tạo NestJS 11 và TypeScript strict, cấu hình môi trường, validation và CORS.
- `GET /api/hello` hỗ trợ `name`, query `lang` và header `Accept-Language`; ngôn ngữ `en`/`vi`, query được ưu tiên, fallback `en`, `lang` sai trả `422`.
- Swagger tại `/api/docs`, schema tại `/api/docs-json`.
- Unit test và HTTP smoke test cho Hello bằng Node.js test runner và `ts-node`.
- Chưa có database, Redis hoặc các API nghiệp vụ.

## Pull 2 — Database, auth, Redis

Nhánh: `feature/02-database-auth-redis`.

- Kết nối database và xây dựng model người dùng.
- Migration thủ công với các thao tác add, run, revert và reset; reset chỉ dành cho database phát triển hoặc kiểm thử.
- Đăng ký, đăng nhập, lấy người dùng hiện tại và đăng xuất.
- JWT kết hợp Redis blacklist để token đã logout không tiếp tục được sử dụng; bản ghi blacklist hết hạn cùng token.

## Pull 3 — Người dùng, avatar, attachments

Nhánh: `feature/03-users-avatar-attachments`.

- Cập nhật người dùng, xem profile, follow và unfollow.
- Avatar lưu ở filesystem local; kiểm tra định dạng và kích thước khi upload.
- Bảng attachments có `id` kiểu UUID, `url`, `file_name`, `file_type`, `file_size` và thông tin chủ sở hữu đa hình.
- Endpoint quản lý hoặc truy cập attachment riêng tư phải kiểm tra quyền chủ sở hữu. Thiết kế quyền truy cập được hoàn thiện khi triển khai pull này.

## Pull 4 — Articles

Nhánh: `feature/04-articles`.

- Tạo, xem, cập nhật và xóa bài viết; chỉ tác giả được sửa/xóa.
- Danh sách có phân trang, bộ lọc và feed từ người đang theo dõi.
- Favorite và unfavorite; kiểm tra dữ liệu, phân quyền và response theo đặc tả RealWorld.

## Pull 5 — Comments

Nhánh: `feature/05-comments`.

- Thêm, xem danh sách và xóa bình luận trong bài viết; không có cập nhật bình luận.
- Kiểm tra bài viết tồn tại và quyền xóa của tác giả bình luận.

## Pull 6 — E2E

Nhánh: `test/06-e2e`.

- Kiểm thử tích hợp các luồng nghiệp vụ và viết ít nhất một bộ C2C cho một controller.
- Dùng database test riêng; tạo fixture/fake data trước mỗi test và truncate database sau mỗi test.
- Bao phủ luồng thành công, validation, xác thực, phân quyền và tài nguyên không tồn tại.

## Quy tắc làm việc

Không mở PR trống cho các nhánh tương lai. Sau khi pull trước được mentor phê duyệt và merge, cập nhật nhánh tiếp theo từ `main`, triển khai đúng phạm vi rồi mới mở PR. Không merge Pull 1 hoặc các pull sau trước khi được mentor approve.

Trước khi gửi review, chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run sunlint` và `npm run build`; điều chỉnh phần kiểm thử theo chức năng đã có ở từng bước. Sửa toàn bộ lỗi Sunlint mức `error` và cung cấp evidence theo yêu cầu của trainer.

Nhánh `training/complete` là bản thử nghiệm cũ được giữ lại, không phải nhánh triển khai của kế hoạch này. Tham khảo `ThanhhBinh023` về cách tổ chức; không sao chép mã nguồn. Mail, queue và các nội dung training nâng cao ngoài danh sách trên chưa thuộc phạm vi 6 pull.

Nguồn: [hướng dẫn NestJS của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md), [RealWorld backend](https://realworld-docs.netlify.app/specifications/backend/endpoints/), [NestJS](https://docs.nestjs.com/).
