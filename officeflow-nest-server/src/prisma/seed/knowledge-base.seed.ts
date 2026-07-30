import type { KnowledgeArticle, PrismaClient, User } from '@prisma/client';
import { createRecordMap, shiftDays } from './seed.utils';

const knowledgeSeeds = [
  {
    slug: 'dat-lai-mat-khau-tai-khoan',
    title: 'Cách đặt lại mật khẩu tài khoản nội bộ',
    summary: 'Các bước xử lý khi quên mật khẩu hoặc tài khoản bị khóa.',
    content:
      'Truy cập trang đăng nhập và chọn yêu cầu hỗ trợ tài khoản. Xác nhận email công ty, mã nhân viên và phòng ban. Bộ phận IT sẽ xác minh danh tính trước khi cấp mật khẩu tạm thời. Sau khi đăng nhập, hãy đổi mật khẩu mới và không sử dụng lại mật khẩu gần nhất.',
    tags: 'account,password,security',
    author: 'it-linh',
    published: true,
  },
  {
    slug: 'xu-ly-khi-khong-ket-noi-duoc-wifi',
    title: 'Xử lý khi không kết nối được Wi-Fi văn phòng',
    summary: 'Kiểm tra nhanh kết nối mạng trước khi gửi ticket.',
    content:
      'Tắt và bật lại Wi-Fi, sau đó chọn đúng mạng OfficeFlow-Staff. Kiểm tra chế độ máy bay và thử quên mạng rồi kết nối lại bằng tài khoản công ty. Nếu nhiều thiết bị cùng mất mạng, hãy ghi rõ khu vực, tầng và thời điểm xảy ra để IT kiểm tra access point.',
    tags: 'network,wifi,connectivity',
    author: 'it-minh',
    published: true,
  },
  {
    slug: 'cau-hinh-vpn-lam-viec-tu-xa',
    title: 'Cấu hình VPN khi làm việc từ xa',
    summary: 'Hướng dẫn kết nối an toàn vào hệ thống nội bộ.',
    content:
      'Cài ứng dụng VPN theo gói cài đặt do IT cung cấp. Đăng nhập bằng email công ty và mã xác thực đa yếu tố. Chỉ kết nối VPN khi cần truy cập tài nguyên nội bộ. Nếu xuất hiện lỗi chứng chỉ, không bỏ qua cảnh báo mà hãy chụp màn hình và gửi ticket cho IT.',
    tags: 'vpn,network,remote-work,security',
    author: 'it-ha',
    published: true,
  },
  {
    slug: 'khac-phuc-outlook-khong-dong-bo-email',
    title: 'Khắc phục Outlook không đồng bộ email',
    summary: 'Các bước xử lý khi thư đến không cập nhật hoặc gửi thư thất bại.',
    content:
      'Kiểm tra trạng thái mạng và dung lượng hộp thư trước. Đóng Outlook hoàn toàn rồi mở lại, sau đó kiểm tra chế độ Work Offline. Nếu lỗi vẫn còn, ghi lại mã lỗi, thời điểm gửi nhận gần nhất và tên hộp thư bị ảnh hưởng để bộ phận IT kiểm tra cấu hình.',
    tags: 'email,outlook,sync',
    author: 'it-quang',
    published: true,
  },
  {
    slug: 'xu-ly-may-in-khong-nhan-lenh',
    title: 'Xử lý máy in không nhận lệnh',
    summary: 'Kiểm tra hàng đợi in, kết nối và trạng thái thiết bị.',
    content:
      'Xác nhận máy in đang bật, có giấy và không báo kẹt giấy. Mở hàng đợi in để xóa các lệnh bị treo, sau đó in lại một trang thử. Không tự tháo linh kiện bên trong máy. Khi gửi ticket, hãy cung cấp mã tài sản của máy in và thông báo lỗi trên màn hình.',
    tags: 'printer,hardware,office',
    author: 'it-minh',
    published: true,
  },
  {
    slug: 'yeu-cau-cap-quyen-thu-muc-dung-chung',
    title: 'Yêu cầu cấp quyền thư mục dùng chung',
    summary: 'Thông tin cần có để yêu cầu quyền truy cập dữ liệu phòng ban.',
    content:
      'Ticket cần ghi rõ đường dẫn thư mục, loại quyền cần cấp và thời hạn sử dụng. Người yêu cầu phải có xác nhận của quản lý trực tiếp hoặc chủ sở hữu dữ liệu. IT chỉ cấp đúng phạm vi đã được phê duyệt và sẽ thu hồi quyền khi hết thời hạn.',
    tags: 'access,permission,shared-folder',
    author: 'admin',
    published: true,
  },
  {
    slug: 'bao-cao-email-nghi-ngo-lua-dao',
    title: 'Cách báo cáo email nghi ngờ lừa đảo',
    summary: 'Xử lý an toàn khi nhận email có liên kết hoặc tệp đáng ngờ.',
    content:
      'Không nhấp vào liên kết, không mở tệp đính kèm và không trả lời người gửi. Sử dụng chức năng báo cáo phishing trong Outlook, sau đó tạo ticket Security kèm tiêu đề email và thời điểm nhận. Nếu đã nhập mật khẩu vào trang lạ, hãy liên hệ IT ngay để khóa phiên đăng nhập.',
    tags: 'security,email,phishing',
    author: 'it-ha',
    published: true,
  },
  {
    slug: 'kiem-tra-bao-hanh-thiet-bi',
    title: 'Kiểm tra bảo hành thiết bị được cấp',
    summary: 'Cách xem thông tin bảo hành và báo lỗi tài sản.',
    content:
      'Mở trang Quản lý tài sản và chọn thiết bị đang được cấp cho bạn. Kiểm tra mã tài sản, số serial và ngày hết hạn bảo hành. Khi thiết bị gặp lỗi, hãy tạo ticket và liên kết đúng tài sản để IT có đủ thông tin làm việc với nhà cung cấp.',
    tags: 'asset,warranty,hardware',
    author: 'it-linh',
    published: true,
  },
  {
    slug: 'cap-nhat-ung-dung-noi-bo',
    title: 'Cập nhật ứng dụng nội bộ an toàn',
    summary: 'Các lưu ý trước khi nâng cấp phần mềm trên máy công ty.',
    content:
      'Lưu công việc đang mở và kết nối nguồn điện trước khi cập nhật. Chỉ cài đặt bản cập nhật từ Software Center hoặc nguồn do IT công bố. Không tải bộ cài từ trang không xác định. Nếu cập nhật thất bại, hãy chụp mã lỗi và không gỡ ứng dụng thủ công.',
    tags: 'software,update,security',
    author: 'it-quang',
    published: true,
  },
  {
    slug: 'quy-trinh-ban-giao-thu-hoi-tai-san',
    title: 'Quy trình bàn giao và thu hồi tài sản',
    summary: 'Các bước cần thực hiện khi nhận hoặc trả thiết bị công ty.',
    content:
      'Khi nhận thiết bị, kiểm tra mã tài sản, phụ kiện và tình trạng thực tế. Không chuyển thiết bị cho người khác nếu chưa có xác nhận trên hệ thống. Khi thu hồi, sao lưu dữ liệu công việc, đăng xuất tài khoản cá nhân và bàn giao đầy đủ phụ kiện cho IT.',
    tags: 'asset,assignment,return',
    author: 'admin',
    published: true,
  },
  {
    slug: 'huong-dan-cai-dat-may-in-mac',
    title: 'Hướng dẫn cài đặt máy in trên macOS',
    summary: 'Bản nháp hướng dẫn thêm máy in mạng cho MacBook.',
    content:
      'Mở System Settings, chọn Printers and Scanners và thêm máy in theo địa chỉ IP nội bộ. Chọn đúng driver theo model thiết bị và in trang kiểm tra. Nội dung này đang được IT xác minh thêm danh sách driver tương thích trước khi xuất bản.',
    tags: 'printer,macos,draft',
    author: 'it-minh',
    published: false,
  },
  {
    slug: 'chinh-sach-thiet-bi-ca-nhan',
    title: 'Chính sách sử dụng thiết bị cá nhân',
    summary: 'Bản nháp về điều kiện kết nối thiết bị cá nhân vào mạng công ty.',
    content:
      'Thiết bị cá nhân phải được cập nhật hệ điều hành, bật khóa màn hình và không lưu dữ liệu nhạy cảm của công ty. Quy trình đăng ký và phạm vi mạng được phép truy cập đang chờ bộ phận An toàn thông tin phê duyệt chính thức.',
    tags: 'security,byod,draft',
    author: 'it-ha',
    published: false,
  },
] as const;

export async function seedKnowledgeBase(
  prisma: PrismaClient,
  users: Record<string, User>,
  now: Date,
) {
  const articles: Array<[string, KnowledgeArticle]> = [];

  for (const [index, seed] of knowledgeSeeds.entries()) {
    const data = {
      title: seed.title,
      summary: seed.summary,
      content: seed.content,
      tags: seed.tags,
      isPublished: seed.published,
      viewCount: seed.published ? 15 + index * 7 : 0,
      createdById: users[seed.author].id,
      createdAt: shiftDays(now, -(90 - index * 5)),
    };
    const article = await prisma.knowledgeArticle.upsert({
      where: { slug: seed.slug },
      update: data,
      create: {
        slug: seed.slug,
        ...data,
      },
    });

    articles.push([seed.slug, article]);
  }

  return createRecordMap(articles);
}
