const fs = require('fs');
const path = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\86f0e3b3-27d4-48ba-a7bf-8893a345c7af\\walkthrough.md';
let content = fs.readFileSync(path, 'utf8');

const target = `## Video Minh họa

![Video quay màn hình tính năng dòng mở rộng](/C:/Users/PC/.gemini/antigravity/brain/86f0e3b3-27d4-48ba-a7bf-8893a345c7af/expandable_row_check_v1_1773800559656.webp)

## Xác thực
- [x] Đã kiểm tra tính năng mở rộng/thu gọn trên localhost.
- [x] Đã xác minh tính duy nhất (chỉ mở 1 dòng tại một thời điểm).
- [x] Đã đảm bảo Edit/Delete vẫn hoạt động bình thường mà không gây mở rộng dòng ngoài ý muốn.
- [x] Đã sửa các lỗi cú pháp liên quan đến việc render hàng.`;

const replacement = `### 3. Sửa lỗi & Hỗ trợ Dữ liệu cũ
- **Sửa lỗi truy vấn:** Khắc phục lỗi không tải được lịch sử thanh toán do sai tên cột trong mã nguồn. Hiện tại, tất cả các hồ sơ đã có lịch sử sẽ hiển thị đầy đủ ngay khi mở rộng dòng.
- **Tính năng "Tạo nhanh bản ghi lịch sử":** Đối với các hồ sơ cũ chỉ có số tổng (Thực thu) mà chưa có chi tiết các lần thu, hệ thống sẽ hiển thị một nút thông minh. Bạn chỉ cần nhấp vào nút này để tự động tạo một bản ghi lịch sử khớp với số tổng, giúp dữ liệu trở nên nhất quán và dễ theo dõi.

## Video Minh họa (Tạo lịch sử nhanh)

![Video minh họa tính năng tạo lịch sử nhanh](/C:/Users/PC/.gemini/antigravity/brain/86f0e3b3-27d4-48ba-a7bf-8893a345c7af/verify_quick_history_gen_1773802853114.webp)

## Xác thực
- [x] Đã sửa lỗi truy vấn cột 'payment_stage_id'.
- [x] Đã kiểm tra tính năng "Tạo nhanh" trên dự án YADEA.
- [x] Đã đảm bảo dữ liệu lịch sử được đồng bộ ngay lập tức sau khi tạo.`;

// Escape special characters and handle whitespace
const escapedTarget = target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\+'); // Use \\+ to match at least one whitespace
const regex = new RegExp(escapedTarget);

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated walkthrough.md');
} else {
    console.log('Target not found in walkthrough.md. Current content contains:');
    console.log(content.substring(content.indexOf('## Video Minh họa')));
}
