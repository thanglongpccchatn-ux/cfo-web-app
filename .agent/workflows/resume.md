---
description: Nạp lại ngữ cảnh dự án CFO khi bắt đầu conversation mới. Dùng /resume để tôi nhớ lại mọi thứ.
---

# /resume — Khôi phục Ngữ cảnh Dự án CFO

Khi user gõ `/resume` hoặc bắt đầu conversation mới về CFO Web App, thực hiện các bước sau:

## Bước 1: Đọc Knowledge Item chính
// turbo
Đọc file `C:\Users\PC\.gemini\antigravity\knowledge\cfo-web-app-project-state\artifacts\project-state.md` để nạp lại toàn bộ ngữ cảnh dự án.

## Bước 2: Kiểm tra conversation gần nhất
Xem qua conversation summaries gần nhất (đã có sẵn ở đầu conversation) để biết công việc mới nhất đang làm gì.

## Bước 3: Tóm tắt cho user
Trình bày:
1. **Trạng thái hiện tại** — Đang làm gì, module nào đang phát triển
2. **Công việc dở dang** — Những TODO chưa xong từ lần cuối
3. **Gợi ý tiếp theo** — Nên làm gì tiếp

## Bước 4: Sẵn sàng
Hỏi user muốn tiếp tục công việc nào.

---

## Lưu ý quan trọng

- Đọc KI **TRƯỚC** khi bắt đầu code
- Sau mỗi session lớn, **CẬP NHẬT** Knowledge Item bằng cách chỉnh sửa file `project-state.md`
- Nếu user yêu cầu tính năng mới quan trọng, thêm vào mục TODO trong KI
