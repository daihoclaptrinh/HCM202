# Bảo tàng Tư tưởng Hồ Chí Minh

Bảo tàng ảo Three.js về quá trình hình thành và phát triển Tư tưởng Hồ Chí Minh, xây dựng theo cấu trúc năm giai đoạn của *Giáo trình Tư tưởng Hồ Chí Minh*, Bộ Giáo dục và Đào tạo, 2019.

## Cài đặt và chạy

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in trong terminal. Tạo bản production:

```bash
npm run build
npm run preview
```

Thư mục `dist/` là website tĩnh, có thể triển khai lên bất kỳ static host nào. Khi triển khai dưới tên miền con, cấu hình `base` trong Vite nếu nền tảng yêu cầu.

## Điều khiển

- `WASD` hoặc phím mũi tên: di chuyển
- Kéo chuột: quan sát
- `E`: khám phá tư liệu
- `ESC`: đóng bảng
- `M`: tắt/bật tiếng

## Cấu trúc

- `src/core/`: vòng lặp, renderer, camera và điều khiển
- `src/world/`: kiến trúc, triển lãm và tạo chữ 3D
- `src/systems/`: va chạm và âm thanh
- `src/ui/`: trạng thái giao diện và bảng thông tin
- `src/data/chapters.ts`: toàn bộ nội dung lịch sử, giai đoạn, tư liệu, mở đầu và nội dung phòng kết
- `src/data/museumConfig.ts`: màu sắc, kích thước, vị trí mốc năm và thông số người xem
- `src/styles/main.css`: giao diện, typography và responsive
- `public/`: âm thanh, ảnh, model và texture thay thế sau này

## Chỉnh nội dung

Mọi nội dung lịch sử nằm trong `src/data/chapters.ts`. Sửa các trường `period`, `academicTitle`, `museumCopy`, `statement`, `keywords` mà không cần thay đổi mã dựng cảnh. Không đặt nội dung do triển lãm biên soạn trong dấu ngoặc kép hoặc gán thành phát ngôn của Hồ Chí Minh.

Thêm hoặc bỏ tư liệu trong mảng `artifacts` của từng chương. Mỗi tư liệu cần `id`, `code`, `title`, `year`, `description`, `chapterId`, `side` và tọa độ `z`.

## Hình ảnh và tài liệu

Đặt ảnh tại `public/images/`, sau đó mở rộng trường dữ liệu tư liệu và material trong `Museum.ts` để dùng ảnh. Hiện tại tất cả tư liệu thiếu ảnh dùng bảng placeholder được tạo bằng CanvasTexture; không có biểu tượng ảnh hỏng. Có thể đặt GLB trong `public/models/`; khi chưa có model, triển lãm dùng hình học Three.js tối giản.

## Âm thanh

Bảy tệp narration dự kiến:

- `public/audio/00-introduction.mp3`
- `public/audio/01-before-1911.mp3`
- `public/audio/02-1911-1920.mp3`
- `public/audio/03-1920-1930.mp3`
- `public/audio/04-1930-1941.mp3`
- `public/audio/05-1941-1969.mp3`
- `public/audio/06-conclusion.mp3`

`AudioManager` kiểm tra tệp trước khi phát. Tệp thiếu không gây lỗi và trải nghiệm tiếp tục im lặng. Âm thanh môi trường tùy chọn đặt tại `public/audio/ambient/`; hiệu ứng tại `public/audio/sfx/`.

## Thay placeholder

- Ảnh/tài liệu: thêm file vào `public/images/` và ánh xạ từ dữ liệu tư liệu.
- Model: thêm GLB vào `public/models/` và thay nhóm geometry tương ứng trong `src/world/Museum.ts`.
- Nội dung credit: thay `[BỔ SUNG]` trong `exhibitionContent.credits` tại `src/data/chapters.ts`.
- Màu và kích thước toàn cục: `src/data/museumConfig.ts`.

## Hiệu năng

Pixel ratio giới hạn ở `1.5`, post-processing không được sử dụng, geometry/material được giữ đơn giản và chỉ một số đèn đổ bóng. CanvasTexture chỉ được tạo lúc dựng cảnh. Trên máy yếu có thể hạ pixel ratio trong `Experience.ts` hoặc tắt shadow của spotlight trung tâm.
