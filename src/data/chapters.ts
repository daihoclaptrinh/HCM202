export type Artifact = {
  id: string
  code: string
  title: string
  year: string
  description: string
  image: string
  chapterId: string
  side: 'left' | 'right'
  z: number
}

export type ExhibitionType = 'desk' | 'journey-map' | 'document-case' | 'return-archive' | 'wall-timeline'

export type Transition = {
  entries: Array<{ text: string; z: number; side: 'left' | 'right' }>
}

export type Chapter = {
  id: string
  index: number
  period: string
  academicTitle: string
  museumCopy: string
  statement: string
  keywords: string[]
  side: 'left' | 'right'
  audio: string
  transcript: string
  start: number
  end: number
  brightness: number
  artifacts: Artifact[]
  board: {
    side: 'left' | 'right'
    period: string
    title: string
    content: string
  }
  exhibition: {
    side: 'left' | 'right'
    type: ExhibitionType
  }
  transitionAfter: Transition
}

export const chapters: Chapter[] = [
  {
    id: 'stage-01', index: 1, period: 'TRƯỚC 05.06.1911', start: -4, end: -12, brightness: .45, side: 'left',
    academicTitle: 'HÌNH THÀNH TƯ TƯỞNG YÊU NƯỚC\nVÀ CHÍ HƯỚNG CỨU NƯỚC MỚI',
    museumCopy: 'Sinh ra và lớn lên trong một gia đình nhà Nho yêu nước, trên quê hương giàu truyền thống đấu tranh, Nguyễn Tất Thành sớm hình thành tình cảm yêu nước, thương dân.\n\nQua thực tế xã hội và sự thất bại của các phong trào cứu nước đương thời, Người nhận thấy cần tìm một hướng đi mới cho dân tộc. Từ đó dần hình thành chí hướng ra đi tìm con đường cứu nước.',
    statement: 'MỘT CON ĐƯỜNG MỚI\nCẦN ĐƯỢC TÌM THẤY.', keywords: ['QUÊ HƯƠNG', 'GIA ĐÌNH', 'YÊU NƯỚC', 'THƯƠNG DÂN'], audio: '/audio/01-before-1911.mp3',
    transcript: 'Cuối thế kỷ mười chín, đầu thế kỷ hai mươi, Việt Nam đang trong tình trạng mất độc lập. Nhiều phong trào yêu nước đã diễn ra, nhưng vẫn chưa tìm được con đường đưa dân tộc đến thắng lợi.\n\nNguyễn Tất Thành lớn lên trong một gia đình nhà Nho yêu nước, trên quê hương Nghệ An giàu truyền thống đấu tranh.\n\nTừ gia đình, quê hương và những điều trực tiếp chứng kiến trong xã hội, ở Người sớm hình thành lòng yêu nước và thương dân.\n\nNgười khâm phục tinh thần của các bậc tiền bối, nhưng không hoàn toàn lựa chọn những con đường cứu nước đã có.\n\nMột chí hướng mới dần hình thành: phải tìm một con đường khác cho dân tộc Việt Nam.',
    artifacts: [{ id: 'que-huong', code: 'TƯ LIỆU 01.01', title: 'QUÊ HƯƠNG NGHỆ AN', year: 'Đầu thế kỷ XX', description: 'Hình ảnh tư liệu về quê hương Nghệ An, nơi Nguyễn Tất Thành lớn lên và sớm hình thành lòng yêu nước, thương dân.', image: '/images/artifacts/que-huong-nghe-an.webp', chapterId: 'stage-01', side: 'right', z: -9 }],
    board: { side: 'left', period: 'TRƯỚC 05.06.1911', title: 'HÌNH THÀNH TƯ TƯỞNG YÊU NƯỚC\nVÀ CHÍ HƯỚNG CỨU NƯỚC MỚI', content: 'Sinh ra và lớn lên trong một gia đình nhà Nho yêu nước, trên quê hương giàu truyền thống đấu tranh, Nguyễn Tất Thành sớm hình thành tình cảm yêu nước, thương dân.\n\nQua thực tế xã hội và sự thất bại của các phong trào cứu nước đương thời, Người nhận thấy cần tìm một hướng đi mới cho dân tộc. Từ đó dần hình thành chí hướng ra đi tìm con đường cứu nước.' },
    exhibition: { side: 'right', type: 'desk' },
    transitionAfter: { entries: [{ text: 'MỘT CON ĐƯỜNG MỚI\nCẦN ĐƯỢC TÌM THẤY.', z: -12.8, side: 'left' }] }
  },
  {
    id: 'stage-02', index: 2, period: 'GIỮA 1911 - CUỐI 1920', start: -15.5, end: -22.5, brightness: .55, side: 'right',
    academicTitle: 'DẦN HÌNH THÀNH TƯ TƯỞNG CỨU NƯỚC,\nGIẢI PHÓNG DÂN TỘC THEO CON ĐƯỜNG\nCÁCH MẠNG VÔ SẢN',
    museumCopy: 'Từ năm 1911, Nguyễn Tất Thành đi qua nhiều quốc gia, lao động và trực tiếp quan sát đời sống của nhân dân lao động cũng như xã hội thuộc địa.\n\nNăm 1919, dưới tên Nguyễn Ái Quốc, Người gửi Yêu sách của nhân dân An Nam tới Hội nghị Versailles.\n\nNăm 1920, sau khi tiếp cận Luận cương của V.I. Lênin về vấn đề dân tộc và thuộc địa, Nguyễn Ái Quốc xác định con đường giải phóng dân tộc theo cách mạng vô sản.',
    statement: 'TỪ KHẢO NGHIỆM THỰC TIỄN\nĐẾN LỰA CHỌN CON ĐƯỜNG.', keywords: ['1911 · RA ĐI', '1919 · YÊU SÁCH CỦA NHÂN DÂN AN NAM', '1920 · BƯỚC NGOẶT TRONG NHẬN THỨC'], audio: '/audio/02-1911-1920.mp3',
    transcript: 'Ngày 5 tháng 6 năm 1911, Nguyễn Tất Thành rời Bến Nhà Rồng, bắt đầu hành trình tìm đường cứu nước.\n\nTrong những năm tiếp theo, Người đi qua nhiều quốc gia, trực tiếp lao động và sống giữa những người lao động. Qua đó, Người từng bước nhận rõ hơn bản chất của chủ nghĩa thực dân và tình cảnh của nhân dân lao động ở nhiều nơi trên thế giới.\n\nNăm 1919, với tên gọi Nguyễn Ái Quốc, Người gửi Yêu sách của nhân dân An Nam tới Hội nghị Versailles.\n\nĐến năm 1920, sau khi tiếp cận Luận cương của V.I. Lênin về vấn đề dân tộc và thuộc địa, Nguyễn Ái Quốc tìm thấy lời giải cho vấn đề mà mình đã nhiều năm tìm kiếm.\n\nTừ đây, tư tưởng cứu nước và giải phóng dân tộc theo con đường cách mạng vô sản dần được xác lập.',
    artifacts: [{ id: 'yeu-sach', code: 'TƯ LIỆU 02.01', title: 'YÊU SÁCH CỦA NHÂN DÂN AN NAM', year: '1919', description: 'Bản Yêu sách của nhân dân An Nam do Nguyễn Ái Quốc gửi tới Hội nghị Versailles năm 1919.', image: '/images/artifacts/yeu-sach-nhan-dan-an-nam.webp', chapterId: 'stage-02', side: 'left', z: -21.1 }],
    board: { side: 'right', period: 'GIỮA 1911 - CUỐI 1920', title: 'DẦN HÌNH THÀNH TƯ TƯỞNG CỨU NƯỚC,\nGIẢI PHÓNG DÂN TỘC THEO CON ĐƯỜNG\nCÁCH MẠNG VÔ SẢN', content: 'Từ năm 1911, Nguyễn Tất Thành đi qua nhiều quốc gia, lao động và trực tiếp quan sát đời sống của nhân dân lao động cũng như xã hội thuộc địa.\n\nNăm 1919, dưới tên Nguyễn Ái Quốc, Người gửi Yêu sách của nhân dân An Nam tới Hội nghị Versailles.\n\nNăm 1920, sau khi tiếp cận Luận cương của V.I. Lênin về vấn đề dân tộc và thuộc địa, Nguyễn Ái Quốc xác định con đường giải phóng dân tộc theo cách mạng vô sản.' },
    exhibition: { side: 'left', type: 'journey-map' },
    transitionAfter: { entries: [{ text: 'TỪ KHẢO NGHIỆM THỰC TIỄN\nĐẾN LỰA CHỌN CON ĐƯỜNG.', z: -25.3, side: 'right' }] }
  },
  {
    id: 'stage-03', index: 3, period: 'CUỐI 1920 - ĐẦU 1930', start: -25, end: -33, brightness: .48, side: 'left',
    academicTitle: 'HÌNH THÀNH NHỮNG NỘI DUNG CƠ BẢN\nCỦA TƯ TƯỞNG VỀ CÁCH MẠNG VIỆT NAM',
    museumCopy: 'Sau khi lựa chọn con đường cách mạng vô sản, Nguyễn Ái Quốc đẩy mạnh hoạt động lý luận, chính trị và tổ chức; truyền bá chủ nghĩa Mác - Lênin vào phong trào cách mạng Việt Nam.\n\nNhững quan điểm cơ bản về mục tiêu, lực lượng, tổ chức và phương pháp cách mạng từng bước được hình thành.\n\nĐầu năm 1930, Nguyễn Ái Quốc chủ trì việc hợp nhất các tổ chức cộng sản, dẫn tới sự ra đời của Đảng Cộng sản Việt Nam và Cương lĩnh chính trị đầu tiên.',
    statement: 'TỪ CON ĐƯỜNG ĐÃ CHỌN\nĐẾN ĐƯỜNG LỐI CÁCH MẠNG VIỆT NAM.', keywords: ['ĐỘC LẬP', 'ĐẢNG', 'NHÂN DÂN', 'ĐOÀN KẾT', 'QUỐC TẾ'], audio: '/audio/03-1920-1930.mp3',
    transcript: 'Tìm thấy con đường cứu nước mới chỉ là bước khởi đầu.\n\nTừ cuối năm 1920, Nguyễn Ái Quốc tập trung vào một vấn đề quan trọng hơn: cách mạng Việt Nam phải được tổ chức và tiến hành như thế nào?\n\nNgười tích cực hoạt động lý luận, báo chí và tổ chức, đồng thời truyền bá chủ nghĩa Mác - Lênin vào phong trào cách mạng Việt Nam.\n\nNhững tác phẩm và hoạt động trong thời kỳ này từng bước hình thành các quan điểm cơ bản về mục tiêu, lực lượng, tổ chức và phương pháp của cách mạng.\n\nNăm 1925, Hội Việt Nam Cách mạng Thanh niên được thành lập. Năm 1927, tác phẩm Đường Kách mệnh được xuất bản.\n\nĐến đầu năm 1930, Nguyễn Ái Quốc chủ trì việc hợp nhất các tổ chức cộng sản, dẫn tới sự ra đời của Đảng Cộng sản Việt Nam và Cương lĩnh chính trị đầu tiên.\n\nTừ một con đường đã được lựa chọn, những nội dung cơ bản của tư tưởng về cách mạng Việt Nam từng bước được hình thành.',
    artifacts: [
      { id: 'ban-an', code: 'TƯ LIỆU 03.01', title: 'BẢN ÁN CHẾ ĐỘ THỰC DÂN PHÁP', year: '1925', description: 'Tác phẩm của Nguyễn Ái Quốc tố cáo chế độ thực dân và tình cảnh của nhân dân các nước thuộc địa.', image: '/images/artifacts/ban-an-che-do-thuc-dan-phap.webp', chapterId: 'stage-03', side: 'right', z: -26.2 },
      { id: 'duong-kach-menh', code: 'TƯ LIỆU 03.02', title: 'ĐƯỜNG KÁCH MỆNH', year: '1927', description: 'Tác phẩm tập hợp các bài giảng của Nguyễn Ái Quốc về lý luận và phương pháp cách mạng.', image: '/images/artifacts/duong-kach-menh.webp', chapterId: 'stage-03', side: 'right', z: -29.2 },
      { id: 'cuong-linh', code: 'TƯ LIỆU 03.03', title: 'CƯƠNG LĨNH CHÍNH TRỊ ĐẦU TIÊN', year: '1930', description: 'Các văn kiện do Nguyễn Ái Quốc soạn thảo, xác lập đường lối cơ bản của cách mạng Việt Nam.', image: '/images/artifacts/cuong-linh-chinh-tri-dau-tien.webp', chapterId: 'stage-03', side: 'right', z: -32.2 }
    ],
    board: { side: 'left', period: 'CUỐI 1920 - ĐẦU 1930', title: 'HÌNH THÀNH NHỮNG NỘI DUNG CƠ BẢN\nCỦA TƯ TƯỞNG VỀ CÁCH MẠNG VIỆT NAM', content: 'Sau khi lựa chọn con đường cách mạng vô sản, Nguyễn Ái Quốc đẩy mạnh hoạt động lý luận, chính trị và tổ chức; truyền bá chủ nghĩa Mác - Lênin vào phong trào cách mạng Việt Nam.\n\nNhững quan điểm cơ bản về mục tiêu, lực lượng, tổ chức và phương pháp cách mạng từng bước được hình thành.\n\nĐầu năm 1930, Nguyễn Ái Quốc chủ trì việc hợp nhất các tổ chức cộng sản, dẫn tới sự ra đời của Đảng Cộng sản Việt Nam và Cương lĩnh chính trị đầu tiên.' },
    exhibition: { side: 'right', type: 'document-case' },
    transitionAfter: { entries: [{ text: 'TỪ CON ĐƯỜNG ĐÃ CHỌN\nĐẾN ĐƯỜNG LỐI CÁCH MẠNG VIỆT NAM.', z: -36.1, side: 'left' }] }
  },
  {
    id: 'stage-04', index: 4, period: 'ĐẦU 1930 - ĐẦU 1941', start: -35.8, end: -43.8, brightness: .25, side: 'right',
    academicTitle: 'VƯỢT QUA THỬ THÁCH,\nGIỮ VỮNG ĐƯỜNG LỐI, PHƯƠNG PHÁP\nCÁCH MẠNG VIỆT NAM ĐÚNG ĐẮN, SÁNG TẠO',
    museumCopy: 'Những năm 1930 đặt cách mạng Việt Nam trước nhiều khó khăn và thử thách. Có thời điểm, một số quan điểm của Nguyễn Ái Quốc về vấn đề dân tộc và lực lượng cách mạng chưa được nhận thức đầy đủ.\n\nNgười tiếp tục nghiên cứu, hoạt động và theo dõi sát thực tiễn Việt Nam cũng như thế giới.\n\nTrước những biến động cuối thập niên 1930, yêu cầu đặt giải phóng dân tộc lên hàng đầu ngày càng được khẳng định trong thực tiễn cách mạng.',
    statement: 'THỬ THÁCH.\n\nKIÊN ĐỊNH.', keywords: ['1941', 'TRỞ VỀ TỔ QUỐC'], audio: '/audio/04-1930-1941.mp3',
    transcript: 'Những năm từ 1930 đến đầu năm 1941 là một thời kỳ nhiều thử thách.\n\nCách mạng Việt Nam phải đối mặt với những khó khăn lớn. Có thời điểm, một số quan điểm của Nguyễn Ái Quốc về vấn đề dân tộc và lực lượng cách mạng chưa được nhận thức đầy đủ.\n\nTrong hoàn cảnh ấy, Người vẫn tiếp tục nghiên cứu, hoạt động và theo dõi sát thực tiễn Việt Nam cũng như những biến động của tình hình thế giới.\n\nThực tiễn cách mạng từng bước khẳng định yêu cầu phải đặt nhiệm vụ giải phóng dân tộc lên vị trí hàng đầu.\n\nSau khoảng ba mươi năm hoạt động ở nước ngoài, đầu năm 1941, Nguyễn Ái Quốc trở về Tổ quốc.\n\nMột giai đoạn mới của cách mạng Việt Nam bắt đầu.',
    artifacts: [{ id: 'pac-bo', code: 'TƯ LIỆU 04.01', title: 'PÁC BÓ', year: '1941', description: 'Hình ảnh tư liệu về Pác Bó, nơi Nguyễn Ái Quốc trở về Tổ quốc và trực tiếp lãnh đạo cách mạng năm 1941.', image: '/images/artifacts/pac-bo-1941.webp', chapterId: 'stage-04', side: 'left', z: -40.3 }],
    board: { side: 'right', period: 'ĐẦU 1930 - ĐẦU 1941', title: 'VƯỢT QUA THỬ THÁCH,\nGIỮ VỮNG ĐƯỜNG LỐI, PHƯƠNG PHÁP\nCÁCH MẠNG VIỆT NAM ĐÚNG ĐẮN, SÁNG TẠO', content: 'Những năm 1930 đặt cách mạng Việt Nam trước nhiều khó khăn và thử thách. Có thời điểm, một số quan điểm của Nguyễn Ái Quốc về vấn đề dân tộc và lực lượng cách mạng chưa được nhận thức đầy đủ.\n\nNgười tiếp tục nghiên cứu, hoạt động và theo dõi sát thực tiễn Việt Nam cũng như thế giới.\n\nTrước những biến động cuối thập niên 1930, yêu cầu đặt giải phóng dân tộc lên hàng đầu ngày càng được khẳng định trong thực tiễn cách mạng.' },
    exhibition: { side: 'left', type: 'return-archive' },
    transitionAfter: { entries: [{ text: 'THỬ THÁCH.', z: -44.2, side: 'right' }, { text: 'KIÊN ĐỊNH.', z: -44.8, side: 'left' }, { text: '1941\nTRỞ VỀ TỔ QUỐC', z: -45.4, side: 'right' }] }
  },
  {
    id: 'stage-05', index: 5, period: 'ĐẦU 1941 - THÁNG 9.1969', start: -47.3, end: -59.3, brightness: .6, side: 'left',
    academicTitle: 'TƯ TƯỞNG HỒ CHÍ MINH TIẾP TỤC\nPHÁT TRIỂN, HOÀN THIỆN, SOI ĐƯỜNG\nCHO SỰ NGHIỆP CÁCH MẠNG CỦA ĐẢNG\nVÀ NHÂN DÂN TA',
    museumCopy: 'Từ năm 1941, Hồ Chí Minh trực tiếp cùng Trung ương Đảng lãnh đạo cách mạng Việt Nam.\n\nTrong thực tiễn đấu tranh giành và bảo vệ độc lập, kháng chiến, xây dựng đất nước và đấu tranh thống nhất dân tộc, tư tưởng Hồ Chí Minh tiếp tục được bổ sung và phát triển.\n\nNhiều vấn đề về độc lập dân tộc, xây dựng xã hội mới, Nhà nước, nhân dân, đại đoàn kết, đạo đức, văn hóa và con người ngày càng được thể hiện đầy đủ hơn.',
    statement: 'MỘT HÀNH TRÌNH KHÉP LẠI.\nMỘT DI SẢN TƯ TƯỞNG TIẾP TỤC.', keywords: ['1941 · GIẢI PHÓNG DÂN TỘC', '1945 · CÁCH MẠNG THÁNG TÁM', '02 · 09 · 1945 · TUYÊN NGÔN ĐỘC LẬP', '1946 - 1954 · BẢO VỆ ĐỘC LẬP', '1954 - 1969 · XÂY DỰNG VÀ THỐNG NHẤT'], audio: '/audio/05-1941-1969.mp3',
    transcript: 'Từ năm 1941, Hồ Chí Minh trực tiếp cùng Trung ương Đảng lãnh đạo cách mạng Việt Nam.\n\nTháng 5 năm 1941, Hội nghị Trung ương lần thứ tám tiếp tục hoàn thiện sự chuyển hướng chiến lược, đặt nhiệm vụ giải phóng dân tộc lên hàng đầu và quyết định thành lập Mặt trận Việt Minh.\n\nTháng Tám năm 1945, cuộc Tổng khởi nghĩa giành chính quyền thành công.\n\nNgày 2 tháng 9 năm 1945, tại Quảng trường Ba Đình, Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập, khai sinh nước Việt Nam Dân chủ Cộng hòa.\n\nNhưng giành được chính quyền và độc lập không phải là điểm kết thúc.\n\nTrong những năm tiếp theo, tư tưởng Hồ Chí Minh tiếp tục được bổ sung và phát triển qua thực tiễn bảo vệ chính quyền cách mạng, kháng chiến, xây dựng đất nước và đấu tranh vì sự nghiệp thống nhất dân tộc.\n\nNhững quan điểm về độc lập dân tộc và chủ nghĩa xã hội, về Nhà nước và nhân dân, đại đoàn kết, đạo đức, văn hóa và con người ngày càng được phát triển và hoàn thiện.\n\nTháng 9 năm 1969, Hồ Chí Minh qua đời, để lại một di sản tư tưởng gắn với toàn bộ hành trình cách mạng của dân tộc trong thời đại mới.',
    artifacts: [{ id: 'di-chuc', code: 'TƯ LIỆU 05.01', title: 'DI CHÚC', year: '1969', description: 'Bản Di chúc của Chủ tịch Hồ Chí Minh, kết tinh những suy nghĩ và tình cảm Người gửi lại cho toàn Đảng, toàn dân.', image: '/images/artifacts/di-chuc-1969.webp', chapterId: 'stage-05', side: 'right', z: -60.4 }],
    board: { side: 'left', period: 'ĐẦU 1941 - THÁNG 9.1969', title: 'TƯ TƯỞNG HỒ CHÍ MINH TIẾP TỤC\nPHÁT TRIỂN, HOÀN THIỆN, SOI ĐƯỜNG\nCHO SỰ NGHIỆP CÁCH MẠNG CỦA ĐẢNG\nVÀ NHÂN DÂN TA', content: 'Từ năm 1941, Hồ Chí Minh trực tiếp cùng Trung ương Đảng lãnh đạo cách mạng Việt Nam.\n\nTrong thực tiễn đấu tranh giành và bảo vệ độc lập, kháng chiến, xây dựng đất nước và đấu tranh thống nhất dân tộc, tư tưởng Hồ Chí Minh tiếp tục được bổ sung và phát triển.\n\nNhiều vấn đề về độc lập dân tộc, xây dựng xã hội mới, Nhà nước, nhân dân, đại đoàn kết, đạo đức, văn hóa và con người ngày càng được thể hiện đầy đủ hơn.' },
    exhibition: { side: 'right', type: 'wall-timeline' },
    transitionAfter: { entries: [{ text: 'MỘT HÀNH TRÌNH KHÉP LẠI.', z: -57.5, side: 'left' }, { text: 'MỘT DI SẢN TƯ TƯỞNG TIẾP TỤC.', z: -59.5, side: 'right' }] }
  }
]

export const exhibitionContent = {
  prologue: {
    lead: 'MỘT TƯ TƯỞNG\nKHÔNG HÌNH THÀNH\nTRONG MỘT NGÀY.\n\nĐó là kết quả của một hành trình.',
    stages: '05 GIAI ĐOẠN\n\nQUÁ TRÌNH HÌNH THÀNH\nVÀ PHÁT TRIỂN\nTƯ TƯỞNG HỒ CHÍ MINH',
    audio: '/audio/00-introduction.mp3',
    transcript: 'Tư tưởng Hồ Chí Minh không hình thành trong một thời điểm duy nhất.\n\nĐó là kết quả của một hành trình lâu dài, từ truyền thống của gia đình, quê hương và dân tộc, đến quá trình trải nghiệm thực tiễn, tiếp thu những giá trị của nhân loại và hoạt động cách mạng.\n\nHành trình phía trước sẽ đưa chúng ta qua năm thời kỳ hình thành và phát triển của hệ thống tư tưởng ấy.'
  },
  map: {
    labels: 'SÀI GÒN · 1911                                    PARIS · 1920\n\nHÀNH TRÌNH TÌM ĐƯỜNG CỨU NƯỚC'
  },
  finalHall: {
    title: 'TƯ TƯỞNG\nHỒ CHÍ MINH',
    definition: 'Một hệ thống quan điểm toàn diện và sâu sắc về những vấn đề cơ bản của cách mạng Việt Nam.',
    themes: [
      { title: 'ĐỘC LẬP', subtitle: 'DÂN TỘC & CHỦ NGHĨA XÃ HỘI', copy: 'Giải phóng dân tộc, giành độc lập và xây dựng một xã hội mới là những vấn đề xuyên suốt trong tư tưởng Hồ Chí Minh.' },
      { title: 'NHÂN DÂN', subtitle: 'ĐẢNG · NHÀ NƯỚC · NHÂN DÂN', copy: 'Nhân dân là lực lượng to lớn của cách mạng; tổ chức lãnh đạo và Nhà nước phải gắn bó với nhân dân, phát huy quyền làm chủ và hướng tới lợi ích của nhân dân.' },
      { title: 'ĐOÀN KẾT', subtitle: 'DÂN TỘC · QUỐC TẾ', copy: 'Đại đoàn kết toàn dân tộc là nguồn sức mạnh quan trọng của cách mạng, đồng thời cần kết hợp sức mạnh dân tộc với sức mạnh của thời đại.' },
      { title: 'CON NGƯỜI', subtitle: 'VĂN HÓA · ĐẠO ĐỨC · CON NGƯỜI', copy: 'Con người vừa là mục tiêu, vừa là động lực của sự nghiệp cách mạng; văn hóa và đạo đức giữ vị trí quan trọng trong quá trình xây dựng xã hội.' }
    ],
    closing: 'MỖI THỜI ĐẠI\nĐỀU ĐẶT RA\nNHỮNG CÂU HỎI MỚI.',
    question: 'Thế hệ hôm nay sẽ đóng góp như thế nào\nvào hành trình phát triển của đất nước?',
    audio: '/audio/06-conclusion.mp3',
    transcript: 'Bạn vừa đi qua năm thời kỳ trong quá trình hình thành và phát triển tư tưởng Hồ Chí Minh.\n\nĐó không phải là một quá trình diễn ra trong một thời điểm duy nhất, mà là kết quả của nhiều thập kỷ trải nghiệm, nghiên cứu, hoạt động và trực tiếp kiểm nghiệm trong thực tiễn cách mạng Việt Nam.\n\nTừ lòng yêu nước và khát vọng giải phóng dân tộc, Hồ Chí Minh đi ra thế giới để tìm kiếm một con đường mới.\n\nTừ con đường được lựa chọn, những quan điểm về cách mạng Việt Nam từng bước hình thành, được giữ vững qua thử thách, rồi tiếp tục bổ sung và phát triển trong quá trình lãnh đạo cách mạng.\n\nTừ hành trình ấy hình thành một hệ thống tư tưởng bao gồm nhiều vấn đề lớn.\n\nĐó là độc lập dân tộc gắn với chủ nghĩa xã hội.\n\nLà vai trò của Đảng, Nhà nước và nhân dân.\n\nLà sức mạnh của đại đoàn kết dân tộc và đoàn kết quốc tế.\n\nVà là những quan điểm về văn hóa, đạo đức và con người.\n\nHành lang phía sau kể câu chuyện về một tư tưởng đã hình thành như thế nào.\n\nCòn căn phòng này mở ra câu hỏi về những giá trị mà hệ thống tư tưởng ấy để lại.'
  },
  credits: {
    project: 'BẢO TÀNG TƯ TƯỞNG HỒ CHÍ MINH',
    subtitle: 'Bảo tàng ảo về quá trình hình thành và phát triển Tư tưởng Hồ Chí Minh',
    course: 'HCM202 - TƯ TƯỞNG HỒ CHÍ MINH',
    team: 'Nhóm 1',
    lecturer: 'LyNT36',
    source: 'Giáo trình Tư tưởng Hồ Chí Minh\nBộ Giáo dục và Đào tạo, 2019'
  }
} as const

export const audioAssets = {
  narration: [exhibitionContent.prologue.audio, ...chapters.map((chapter) => chapter.audio), exhibitionContent.finalHall.audio],
  ambient: { corridor: '/audio/ambient/corridor.wav', finalHall: '/audio/ambient/final-hall.wav' },
  sfx: { mapPoint: '/audio/sfx/map-point.wav', finalReveal: '/audio/sfx/final-reveal.wav', transition: '/audio/sfx/transition.wav' }
} as const

export const narrationPaths = audioAssets.narration
