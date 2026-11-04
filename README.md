# NestJS RealWorld

Backend học tập theo [hướng dẫn NestJS của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md). Quy trình hiện tại gồm **6 pull request theo thứ tự**; chỉ triển khai **Pull 1: init, i18n và Swagger** ở bước này.

Pull 1 dùng NestJS 11, TypeScript strict và API Hello để kiểm tra cấu trúc dự án, lựa chọn ngôn ngữ, validation và tài liệu API. Chưa tích hợp database hoặc Redis.

## Chạy Pull 1

Cần Node.js 22 trở lên và npm. Sau khi clone repo, chuyển sang nhánh đang triển khai:

```sh
git switch feature/01-init-i18n-swagger
npm ci
```

Tạo file cấu hình bằng PowerShell:

```powershell
Copy-Item .env.example .env
```

Hoặc macOS/Linux:

```sh
cp .env.example .env
```

Chạy ứng dụng:

```sh
npm run start:dev
```

Cấu hình mặc định trong `.env.example`: `APP_HOST=127.0.0.1`, `APP_PORT=3000`, `CORS_ORIGINS=http://localhost:5173`. Không commit `.env`.

- Hello: <http://localhost:3000/api/hello?name=An&lang=vi>
- Swagger UI: <http://localhost:3000/api/docs>
- OpenAPI JSON: <http://localhost:3000/api/docs-json>

## API Hello và ngôn ngữ

`GET /api/hello?name=An&lang=vi` trả:

```json
{"message": "Xin chào, An!", "language": "vi"}
```

Hỗ trợ `en` và `vi`. Query `lang` được ưu tiên hơn header `Accept-Language`. Khi không chọn được ngôn ngữ hỗ trợ, ứng dụng dùng `en`; gọi `/api/hello` mặc định trả `{"message":"Hello, World!","language":"en"}`. Query `lang` không hợp lệ, ví dụ `lang=fr`, trả HTTP `422`.

## Kiểm tra và chạy bản build

```sh
npm run typecheck
npm run lint
npm test
npm run sunlint
npm run build
npm run test:build
npm run start:prod
```

Pull 1 có unit test và HTTP smoke test cho Hello. Test chạy bằng test runner tích hợp của Node.js cùng `ts-node`; dự án không dùng Jest. Sunlint phải không còn vi phạm mức `error` trước khi gửi review.

## Các pull tiếp theo

Xem [kế hoạch 6 pull](docs/pull-plan.md) để biết phạm vi từng nhánh. Năm nhánh tương lai hiện dùng cùng snapshot với Pull 1, chưa có thay đổi chức năng và chưa mở PR. Pull 1 mở PR vào `main`; chỉ merge sau khi mentor phê duyệt.

Nhánh `training/complete` lưu bản thử nghiệm trước đó để tham khảo; quy trình đang áp dụng là kế hoạch 6 pull trong tài liệu này. Cách tổ chức của `ThanhhBinh023` chỉ là tham khảo; mã nguồn được triển khai độc lập. Mail và queue chưa thuộc phạm vi 6 pull.

## Tham khảo

- [Bài tập NestJS của Sun*](https://github.com/framgia/Training-Guideline/blob/master/Nodejs/tutorial.md)
- [Tài liệu NestJS](https://docs.nestjs.com/)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
