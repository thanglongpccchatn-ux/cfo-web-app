---
description: Lưu lại trạng thái công việc sau mỗi session. Dùng /save khi kết thúc phiên làm việc.
---

# /save — Lưu Trạng thái Session

Khi user gõ `/save` hoặc yêu cầu lưu lại tiến độ, thực hiện:

## Bước 1: Tổng hợp những gì đã làm trong session này
Liệt kê:
- Files đã tạo mới
- Files đã chỉnh sửa
- Migrations đã chạy
- Bugs đã fix
- Features đã hoàn thành

## Bước 2: Cập nhật Knowledge Item
Chỉnh sửa file `C:\Users\PC\.gemini\antigravity\knowledge\cfo-web-app-project-state\artifacts\project-state.md`:

1. **Cập nhật ngày** `lastUpdated` trong metadata.json
2. **Cập nhật trạng thái module** — nếu có module nào đã hoàn thành hoặc tiến triển
3. **Cập nhật TODO** — xóa các item đã xong, thêm item mới nếu có
4. **Thêm bảng DB mới** nếu đã tạo migration mới
5. **Ghi chú đặc biệt** nếu có business logic mới hoặc pattern mới

## Bước 3: Xác nhận
Trình bày cho user:
- ✅ Những gì đã lưu
- 📋 Trạng thái TODO cập nhật
- 💡 Gợi ý cho session tiếp theo

---

## Format cập nhật TODO

```markdown
### Ưu tiên Cao
- [x] ~~Task đã xong~~ ✅ (hoàn thành ngày DD/MM)
- [ ] Task mới thêm
```
