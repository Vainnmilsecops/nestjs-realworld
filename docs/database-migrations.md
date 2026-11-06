# Migration database thủ công

Pull 2 dùng PostgreSQL và TypeORM. Entity `User` nằm tại `src/users/entities/user.entity.ts`, migration tại `src/database/migrations/`. Database dùng UUID sinh bởi hàm `gen_random_uuid()` có sẵn trong PostgreSQL 18.

`synchronize`, `migrationsRun` và `installExtensions` đều là `false`: ứng dụng không tự sửa schema, chạy migration hoặc cài extension khi khởi động. CLI dùng source TypeScript qua `ts-node`; cấu hình cũng hỗ trợ tìm migration JavaScript trong bản build.

## Chuẩn bị

```sh
npm ci
npm run setup
docker compose -p realworld-training up -d --wait
```

Kiểm tra `DATABASE_URL` trong `.env` trỏ đúng database cần thao tác. Mặc định local là `postgresql://realworld:realworld@127.0.0.1:5433/realworld`. Nếu dùng PostgreSQL đã cài trên máy, tạo database/user riêng và đổi URL tương ứng.

## Add — tạo scaffold

```sh
npm run migration:add -- AddProfileFields
```

Tên migration phải là PascalCase gồm chữ và số, bắt đầu bằng chữ hoa. Lệnh tạo file `<timestamp>-AddProfileFields.ts` có hai hàm `up`/`down` chưa triển khai; cả hai chủ động throw lỗi để scaffold không bị chạy nhầm như một migration hoàn chỉnh. Tự viết SQL cho thay đổi và cách hoàn tác, thay các câu throw tương ứng; lệnh không so sánh entity hoặc tự sinh schema. Viết xong cả hai chiều trước khi chạy.

## Run — áp dụng các migration còn thiếu

```sh
npm run migration:run
```

TypeORM đọc danh sách migration, thực hiện theo thứ tự timestamp và ghi lịch sử trong bảng `migrations`. Lần chạy đầu tạo bảng `users` với UUID, username/email unique, password hash, bio/image và timestamps.

### Chạy bản đã biên dịch trên production

Build ở môi trường có đầy đủ devDependencies:

```sh
npm ci
npm run build
```

Ở môi trường runtime, giữ thư mục `dist/`, `package.json` và lockfile từ cùng bản build, cấu hình `NODE_ENV=production` cùng các biến kết nối/secret, rồi chạy:

```sh
npm ci --omit=dev
npm run migration:run:prod
npm run start:prod
```

`migration:run:prod` dùng TypeORM CLI với `dist/database/data-source.js`, chỉ nạp migration JavaScript đã biên dịch và không cần `ts-node` hoặc devDependencies. Chỉ áp dụng migration đã review; reset vẫn bị từ chối ở production.

## Revert — hoàn tác migration gần nhất

```sh
npm run migration:revert
```

Lệnh chạy `down` của migration gần nhất đã áp dụng. Migration tạo `users` có `down` xóa bảng đó cùng dữ liệu, vì vậy phải xem SQL và `DATABASE_URL` trước khi hoàn tác.

## Reset — hoàn tác tất cả rồi chạy lại

Reset yêu cầu đồng thời `NODE_ENV=development` hoặc `test` và cờ `--confirm-reset`. CLI hoàn tác toàn bộ migration đã áp dụng, sau đó áp dụng lại; không dùng `DROP DATABASE`. Dữ liệu trong các bảng bị migration hoàn tác sẽ mất.

PowerShell:

```powershell
$env:NODE_ENV = 'development'
npm run migration:reset -- --confirm-reset
```

macOS/Linux:

```sh
NODE_ENV=development npm run migration:reset -- --confirm-reset
```

Reset bị từ chối ở `production`, môi trường khác hoặc thiếu cờ xác nhận, trước khi kết nối database. Không dùng reset để triển khai production; môi trường đó chỉ áp dụng các migration đã được review bằng `migration:run:prod` từ bản build.

## Kiểm thử

Test scaffold/guard không cần reset database thật. Kiểm thử tích hợp dùng `TEST_DATABASE_URL` có tên database kết thúc bằng `_test` và `TEST_REDIS_URL` có database index lớn hơn 0; xem [README](../README.md). Suite auth tự chạy migration và chỉ truncate `public.users` trong database test đã xác nhận, đồng thời xóa những blacklist key do suite tạo; không flush dữ liệu Redis khác.
