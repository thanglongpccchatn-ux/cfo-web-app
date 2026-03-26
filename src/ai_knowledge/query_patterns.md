# Mẫu Truy vấn & Cấu trúc Dữ liệu (Query Patterns) - SATECO CFO (Supabase/PostgreSQL)

Tài liệu hướng dẫn cách truy xuất dữ liệu tối ưu cho các báo cáo tài chính trên hệ thống Supabase.

## 1. Truy vấn Dòng tiền (Cash Flow)
Để lấy dòng tiền thực thu theo tháng trong năm hiện tại:

```sql
SELECT 
  date_trunc('month', payment_date) as month,
  sum(amount) as total_income
FROM external_payment_history
WHERE extract(year from payment_date) = extract(year from now())
GROUP BY 1
ORDER BY 1;
```

## 2. Tính toán Giá trị Hợp đồng thực tế (True Contract Value)
Giá trị hợp đồng thực tế = Giá trị gốc + Các phụ lục phát sinh (Variations) đã duyệt.

```sql
SELECT 
  p.id, p.code,
  p.total_value_post_vat + COALESCE(SUM(v.approved_value), 0) as effective_value
FROM projects p
LEFT JOIN contract_variations v ON v.project_id = p.id AND v.status = 'Đã duyệt'
GROUP BY p.id;
```

## 3. Kiểm tra Công nợ quá hạn
Dựa trên bảng `payments` và so sánh `due_date` với `external_income`.

```sql
SELECT *
FROM payments
WHERE status = 'Đã duyệt'
  AND due_date < now()
  AND COALESCE(external_income, 0) < invoice_amount;
```

## 4. Lưu ý về Hiệu năng
- Luôn sử dụng `.select('*')` một cách cẩn trọng, chỉ lấy các cột cần thiết cho báo cáo.
- Sử dụng `.rpc()` (Remote Procedure Call) cho các tính toán tài chính phức tạp đòi hỏi sự nhất quán ở mức Database.
- Đảm bảo các cột `project_id`, `status`, `payment_date` được đánh Index để báo cáo Dashboard load nhanh.
