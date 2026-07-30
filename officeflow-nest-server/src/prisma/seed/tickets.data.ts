import { TicketPriority } from '@prisma/client';

export const ticketSeeds = [
  {
    title: 'Laptop không khởi động sau khi cập nhật',
    description:
      'Máy Dell Latitude hiển thị màn hình đen sau bản cập nhật tối qua, đèn nguồn vẫn sáng nhưng không vào được Windows.',
    category: 'Hardware',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Pin laptop tụt nhanh khi họp trực tuyến',
    description:
      'Pin giảm từ 100% xuống còn 30% sau khoảng một giờ họp Teams dù máy mới được sạc đầy vào đầu buổi.',
    category: 'Hardware',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Màn hình ngoài bị nhấp nháy',
    description:
      'Màn hình Dell P2422H nhấp nháy liên tục khi kết nối qua dock USB-C, đổi cáp HDMI vẫn còn lỗi.',
    category: 'Hardware',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Bàn phím laptop không nhận phím Enter',
    description:
      'Phím Enter và Backspace không phản hồi, bàn phím rời vẫn hoạt động bình thường trên cùng thiết bị.',
    category: 'Hardware',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Excel đóng đột ngột khi mở báo cáo',
    description:
      'Excel tự thoát khi mở báo cáo doanh thu tháng có nhiều PivotTable, các tệp nhỏ vẫn mở bình thường.',
    category: 'Software',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Không cài được bản cập nhật phần mềm kế toán',
    description:
      'Trình cài đặt báo thiếu quyền quản trị ở bước cập nhật cơ sở dữ liệu, cần IT hỗ trợ ngoài giờ chốt sổ.',
    category: 'Software',
    priority: TicketPriority.URGENT,
  },
  {
    title: 'Teams không nhận micro tai nghe',
    description:
      'Tai nghe Logitech được Windows nhận nhưng Teams không hiển thị trong danh sách thiết bị âm thanh.',
    category: 'Software',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Trình duyệt tự chuyển sang trang quảng cáo',
    description:
      'Chrome xuất hiện tab quảng cáo sau khi mở một số trang nội bộ, nghi ngờ có extension không an toàn.',
    category: 'Software',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Wi-Fi tầng 3 kết nối chập chờn',
    description:
      'Nhiều nhân viên khu vực phòng họp tầng 3 bị rớt Wi-Fi khoảng mỗi 10 phút trong buổi sáng.',
    category: 'Network',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Không truy cập được thư mục mạng Finance',
    description:
      'Máy vẫn truy cập Internet nhưng đường dẫn thư mục dùng chung của Finance báo Network path not found.',
    category: 'Network',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'VPN ngắt kết nối sau vài phút',
    description:
      'VPN kết nối thành công từ mạng gia đình nhưng tự ngắt sau ba đến năm phút, đã thử khởi động lại router.',
    category: 'Network',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Phòng họp mới chưa có cổng mạng hoạt động',
    description:
      'Hai ổ cắm mạng tại phòng họp Operations chưa cấp được địa chỉ IP cho laptop và thiết bị hội nghị.',
    category: 'Network',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Outlook không nhận thư mới',
    description:
      'Outlook hiển thị trạng thái Connected nhưng thư đến không cập nhật từ 9 giờ sáng, webmail vẫn có thư.',
    category: 'Email',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Email gửi khách hàng bị trả lại',
    description:
      'Các email gửi tới tên miền đối tác đều bị trả lại với mã lỗi 550, gửi nội bộ vẫn thành công.',
    category: 'Email',
    priority: TicketPriority.URGENT,
  },
  {
    title: 'Chữ ký email hiển thị sai logo',
    description:
      'Logo trong chữ ký Outlook bị vỡ tỷ lệ và không hiển thị khi người nhận mở thư trên điện thoại.',
    category: 'Email',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Hộp thư phòng ban gần đầy dung lượng',
    description:
      'Shared mailbox của Marketing đã dùng hơn 95% dung lượng và bắt đầu không nhận được tệp đính kèm lớn.',
    category: 'Email',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Tài khoản bị khóa sau nhiều lần đăng nhập',
    description:
      'Người dùng không thể đăng nhập máy tính và Outlook sau khi nhập sai mật khẩu nhiều lần vào sáng nay.',
    category: 'Account',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Không nhận được mã xác thực đa yếu tố',
    description:
      'Ứng dụng Authenticator không hiển thị yêu cầu xác nhận khi đăng nhập VPN từ thiết bị công ty.',
    category: 'Account',
    priority: TicketPriority.URGENT,
  },
  {
    title: 'Cập nhật số điện thoại khôi phục tài khoản',
    description:
      'Nhân viên đã đổi số điện thoại công việc và cần cập nhật thông tin xác thực cho tài khoản Microsoft 365.',
    category: 'Account',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Tên hiển thị trên Teams chưa đúng',
    description:
      'Tên hiển thị vẫn dùng thông tin cũ sau khi phòng HR đã cập nhật hồ sơ nhân sự từ tuần trước.',
    category: 'Account',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Máy in Finance bị kẹt giấy liên tục',
    description:
      'Máy in HP LaserJet báo kẹt giấy ở khay số 2 dù đã lấy hết giấy và vệ sinh con lăn.',
    category: 'Printer',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Không tìm thấy máy in màu Marketing',
    description:
      'Máy in mạng không còn xuất hiện sau khi laptop được cài lại Windows, cần thêm lại đúng driver.',
    category: 'Printer',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Bản in bị sọc đen dọc trang',
    description:
      'Tất cả tài liệu in từ Canon imageRUNNER đều có một sọc đen ở mép phải, bản scan không bị ảnh hưởng.',
    category: 'Printer',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Yêu cầu cài máy in cho nhân viên mới',
    description:
      'Nhân viên mới phòng HR cần được cài máy in gần khu vực làm việc và cấu hình in hai mặt mặc định.',
    category: 'Printer',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Cấp quyền thư mục báo cáo quý',
    description:
      'Cần quyền đọc và chỉnh sửa thư mục báo cáo quý của Finance trong thời gian chuẩn bị kiểm toán nội bộ.',
    category: 'Access Request',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Cấp quyền truy cập phần mềm CRM',
    description:
      'Nhân viên Marketing mới cần tài khoản CRM với phạm vi khách hàng khu vực miền Nam theo phê duyệt quản lý.',
    category: 'Access Request',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Thu hồi quyền của nhân viên nghỉ việc',
    description:
      'Cần khóa tài khoản và thu hồi quyền truy cập các thư mục dùng chung trước 17 giờ theo yêu cầu của HR.',
    category: 'Access Request',
    priority: TicketPriority.URGENT,
  },
  {
    title: 'Mở quyền xem dashboard vận hành',
    description:
      'Quản lý Operations cần quyền chỉ xem dashboard hiệu suất, không yêu cầu quyền chỉnh sửa cấu hình.',
    category: 'Access Request',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Phát hiện email yêu cầu thanh toán bất thường',
    description:
      'Email giả mạo giám đốc yêu cầu chuyển khoản khẩn, người nhận chưa nhấp liên kết và đã chuyển tiếp cho IT.',
    category: 'Security',
    priority: TicketPriority.URGENT,
  },
  {
    title: 'Máy tính cảnh báo phần mềm độc hại',
    description:
      'Windows Security phát hiện tệp đáng ngờ trong thư mục Downloads và đang yêu cầu khởi động lại để xử lý.',
    category: 'Security',
    priority: TicketPriority.URGENT,
  },
  {
    title: 'Thất lạc điện thoại công ty',
    description:
      'Điện thoại được cấp cho quản lý có thể đã thất lạc khi di chuyển, cần khóa thiết bị và tài khoản từ xa.',
    category: 'Security',
    priority: TicketPriority.URGENT,
  },
  {
    title: 'Kiểm tra đăng nhập từ vị trí lạ',
    description:
      'Người dùng nhận thông báo đăng nhập từ quốc gia khác nhưng xác nhận không thực hiện hoạt động này.',
    category: 'Security',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Chuẩn bị thiết bị cho nhân viên mới',
    description:
      'Cần chuẩn bị laptop, màn hình và tài khoản cơ bản cho nhân viên Operations bắt đầu làm việc vào thứ Hai.',
    category: 'Other',
    priority: TicketPriority.MEDIUM,
  },
  {
    title: 'Di chuyển thiết bị sang khu vực làm việc mới',
    description:
      'Bộ phận Marketing chuyển chỗ ngồi và cần IT hỗ trợ đấu nối lại màn hình, dock và cáp mạng.',
    category: 'Other',
    priority: TicketPriority.LOW,
  },
  {
    title: 'Kiểm tra phòng họp trước sự kiện',
    description:
      'Cần kiểm tra camera, micro, màn hình trình chiếu và kết nối Teams trước buổi họp toàn công ty.',
    category: 'Other',
    priority: TicketPriority.HIGH,
  },
  {
    title: 'Tư vấn tiêu chuẩn mua màn hình mới',
    description:
      'Phòng Finance cần tư vấn model màn hình phù hợp cho công việc báo cáo và thời hạn bảo hành tối thiểu.',
    category: 'Other',
    priority: TicketPriority.LOW,
  },
] as const;
