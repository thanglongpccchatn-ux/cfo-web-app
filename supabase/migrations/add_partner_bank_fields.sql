-- ==============================================================================
-- MIGRATION: Thêm cột bank_branch và account_holder vào bảng partners
-- Mục đích: Các giá trị này trước đây bị nhét vào cột 'notes', nay tách riêng
-- ==============================================================================

-- 1. Thêm cột mới
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS account_holder TEXT;

-- 2. Migrate dữ liệu cũ: đọc từ notes và ghi vào cột đúng
UPDATE public.partners
SET
  bank_branch = trim((regexp_match(notes, 'Chi nhánh:\s*([^|\n]+)'))[1]),
  account_holder = trim((regexp_match(notes, 'Chủ TK:\s*([^|\n]+)'))[1])
WHERE notes IS NOT NULL AND (notes LIKE '%Chi nhánh:%' OR notes LIKE '%Chủ TK:%');

-- 3. Dọn dẹp phần đã migrate ra khỏi notes
UPDATE public.partners
SET notes = trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(notes, 'Mã (Đối tác|ĐT):\s*[^|\n]+\s*(\|\s*)?', '', 'g'),
      'Chủ TK:\s*[^|\n]+\s*(\|\s*)?', '', 'g'
    ),
    'Chi nhánh:\s*[^|\n]+\s*(\|\s*)?', '', 'g'
  ),
  '| \n'
)
WHERE notes IS NOT NULL AND (
  notes LIKE '%Chi nhánh:%'
  OR notes LIKE '%Chủ TK:%'
  OR notes LIKE '%Mã ĐT:%'
  OR notes LIKE '%Mã Đối tác:%'
);

-- 4. Bổ sung cột representative_title nếu chưa có (đề phòng migration cũ chưa chạy)
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS representative_title TEXT;
