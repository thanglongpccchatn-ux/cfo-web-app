-- =============================================
-- SATECO CFO - Module Đấu thầu / Báo giá
-- Chạy script này trên Supabase SQL Editor
-- =============================================

-- 1. Bảng chính: bids
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_code TEXT,                              -- Mã báo giá (BG-2026-001)
  requester TEXT,                             -- Người yêu cầu
  partner_id UUID REFERENCES partners(id),    -- Đối tác (FK)
  du_an_id TEXT,                              -- Dự án ID
  location TEXT,                              -- Địa điểm
  investor TEXT,                              -- Chủ đầu tư
  current_version INT DEFAULT 1,              -- Phiên bản hiện tại
  status TEXT DEFAULT 'Theo dõi',             -- Trạng thái
  assigned_to TEXT,                           -- Người phụ trách
  change_description TEXT,                    -- Nội dung thay đổi gần nhất
  price_before_vat NUMERIC DEFAULT 0,         -- Giá chào trước VAT
  price_after_vat NUMERIC DEFAULT 0,          -- Giá chào sau VAT
  total_cost_before_vat NUMERIC DEFAULT 0,    -- Tổng giá vốn trước VAT
  total_cost_after_vat NUMERIC DEFAULT 0,     -- Tổng giá vốn sau VAT
  rejection_reason TEXT,                      -- Lý do trượt thầu
  submission_deadline TIMESTAMPTZ,            -- Hạn nộp hồ sơ
  result_date TIMESTAMPTZ,                    -- Ngày công bố kết quả
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng lịch sử phiên bản: bid_versions
CREATE TABLE IF NOT EXISTS bid_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID REFERENCES bids(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  price_before_vat NUMERIC DEFAULT 0,
  price_after_vat NUMERIC DEFAULT 0,
  total_cost_before_vat NUMERIC DEFAULT 0,
  total_cost_after_vat NUMERIC DEFAULT 0,
  change_description TEXT,
  old_status TEXT,
  new_status TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access on bids" ON bids
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access on bid_versions" ON bid_versions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_bids_status ON bids(status);
CREATE INDEX IF NOT EXISTS idx_bids_partner ON bids(partner_id);
CREATE INDEX IF NOT EXISTS idx_bid_versions_bid_id ON bid_versions(bid_id);

-- 5. Permissions cho module Đấu thầu
INSERT INTO permissions (code, name, module, description) VALUES
  ('view_bids',   'Xem Đấu thầu',    'ĐẤU THẦU', 'Quyền xem danh sách báo giá, đấu thầu'),
  ('create_bids', 'Tạo Báo giá',      'ĐẤU THẦU', 'Quyền tạo mới gói thầu / báo giá'),
  ('edit_bids',   'Sửa Báo giá',      'ĐẤU THẦU', 'Quyền cập nhật giá, trạng thái, tăng version'),
  ('delete_bids', 'Xóa Báo giá',      'ĐẤU THẦU', 'Quyền xóa gói thầu / báo giá')
ON CONFLICT (code) DO NOTHING;
