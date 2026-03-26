# Quy trình Đối chiếu Công nợ (Reconciliation) - SATECO CFO

Tài liệu này cung cấp hướng dẫn chuyên môn để đối chiếu dữ liệu tài chính giữa các nguồn khác nhau trong hệ thống SATECO CFO.

## 1. Các loại đối chiếu quan trọng

### A. Đối chiếu Hợp đồng (Contract vs. Payments)
Đảm bảo tổng giá trị các đợt thanh toán (payment stages) khớp với giá trị hợp đồng gốc (original value) cộng với các phụ lục (addendas) đã duyệt.
- **Dấu hiệu lỗi**: Tổng giá trị đợt > Tổng giá trị HĐ (sau VAT).
- **Hành động**: Kiểm tra lại các phụ lục hoặc điều chỉnh tỷ lệ % các đợt.

### B. Đối chiếu Thực thu (Payments vs. Bank/Income)
Đối chiếu số tiền đã đề nghị thanh toán (requested) với số tiền thực tế đổ về tài khoản (external income).
- **Phân loại chênh lệch**:
    1.  **Chênh lệch tạm thời**: Tiền đang trên đường chuyển hoặc đã chuyển nhưng chưa cập nhật vào hệ thống.
    2.  **Điều chỉnh cần thiết**: Cấn trừ chi phí, sai lệch do phí ngân hàng hoặc tỷ giá.
    3.  **Cần điều tra**: CĐT đã báo chuyển nhưng kế toán chưa thấy tiền, hoặc thiếu hồ sơ nghiệm thu.

## 2. Phân tích tuổi nợ (Aging Analysis)
Các khoản công nợ cần được phân loại theo thời gian trễ:
- **0-30 ngày**: Theo dõi thông thường.
- **31-90 ngày**: Cần nhắc nợ qua điện thoại/email cho CĐT.
- **>90 ngày**: Cần công văn nhắc nợ chính thức hoặc can thiệp từ ban lãnh đạo.

## 3. Danh mục rà soát (Checklist)
- [ ] Tất cả các khoản thu đã được gán đúng vào mã dự án?
- [ ] Các phụ lục phát sinh (variations) đã được phê duyệt bộ phận chuyên môn trước khi đưa vào đối chiếu?
- [ ] Khoản giữ lại bảo hành (5%) đã được tách bạch rõ ràng khỏi công nợ đến hạn?
