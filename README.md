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

## Chơi tự do và quản trò

- Quản trò mở `/start`, giữ tab mở; người chơi mở `/play`, nhập tên và chọn nhân vật. Quản trò bấm **BẮT ĐẦU** khi mọi người đã vào phòng.
- Người chơi dùng WASD / phím mũi tên để đi, kéo chuột để nhìn quanh, E để xem hiện vật. Các nhân vật và tên được đồng bộ trong cùng phòng.
- Có thể đi tới bất kỳ khu nào. Phải nghe hết nội dung của khu trước khi mở câu hỏi ở khu đó. Câu chuyện đã bật vẫn tiếp tục khi đi sang khu khác; ghi nhận nghe xong chỉ khi âm thanh kết thúc.
- Tìm biển vàng **?** ở đầu năm khu trưng bày. Đến gần biển sau khi nghe xong để trả lời lần lượt câu 1 đến 6 trong khu đó. Không thể mở câu sau khi câu trước chưa được chốt. Q đưa tiêu điểm tới câu kế tiếp được mở.
- Mỗi câu chỉ trả lời một lần, đúng được 100 điểm. Thời hạn theo khu 1–5 là 20 / 15 / 10 / 5 / 5 giây. Chỉ bắt đầu tính giờ khi mở câu. Khung câu hỏi khóa tương tác bên ngoài, không có nút đóng và không đóng bằng Escape; hoàn thành câu hoặc hết giờ mới trở lại khám phá. Rời cửa sổ, chuyển tab, thoát toàn màn hình hay điều hướng sẽ ghi câu đang mở là sai (+0 điểm), không loại khỏi toàn bộ phiên. Hết giờ chỉ chốt câu đang mở, không tự mở câu tiếp theo. Copy / cut, Ctrl+C / Cmd+C và bôi đen câu hỏi / đáp án bị chặn trong giao diện; ô số vẫn nhập/sửa được nhưng không sao chép khi câu đang mở.
- Quản trò bấm **KẾT THÚC PHIÊN** để chốt kết quả cho tất cả người chơi. Câu chưa gửi tại thời điểm kết thúc không được tính. Làm đủ 30 câu vẫn có thể tiếp tục tham quan cho đến khi quản trò kết thúc.
- Xếp hạng: điểm giảm dần, sau đó tổng `elapsedMs` của **các câu đúng** tăng dần. Không tính thời gian đi lại hay nghe. Bằng cả điểm và thời gian thì đồng hạng; bảng hiển thị tối đa năm người, file kết quả gồm toàn bộ người chơi.
- Mỗi lượt trả lời lưu mã câu, thời điểm mở/gửi, thời gian nguyên mili giây và kết quả đúng/sai/hết giờ. Thời gian do đồng hồ của máy quản trò ghi nhận khi nhận lệnh mở và gửi câu, vì vậy bao gồm độ trễ truyền tin. Client không quyết định điểm hoặc thời gian.
- Kết quả phiên gần nhất được lưu trong trình duyệt của quản trò. Bấm **TẢI KẾT QUẢ GẦN NHẤT** để tải JSON gồm bảng xếp hạng và từng lượt trả lời; bấm **MỞ PHIÊN MỚI** để đưa người đang kết nối về phòng chờ và đặt lại điểm. Chưa có cơ sở dữ liệu lưu lịch sử phiên trên máy chủ.
- Tab quản trò điều phối phiên qua Supabase Realtime. Đóng/mất kết nối tab này sẽ ngắt phiên; người vào sau khi bắt đầu chờ phiên tiếp theo. Sau cập nhật, mọi người cần tải lại trang để dùng cùng phiên bản.

Kiểm tra luật chơi: `npm run check:room`. Kiểm tra trình duyệt với `npm run dev` đang chạy: `npm run check:game` (mặc định dùng bộ truyền tin thử nghiệm); đặt `MOCK_REALTIME=0` để thử Supabase thật trên kênh riêng. Có thể đặt `BROWSER_PATH` để chọn Chrome/Chromium.
