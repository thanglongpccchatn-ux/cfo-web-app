-- Add warranty-related fields to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS handover_date DATE,
ADD COLUMN IF NOT EXISTS has_warranty_guarantee BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS warranty_duration_months INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS warranty_percentage DECIMAL DEFAULT 5,
ADD COLUMN IF NOT EXISTS warranty_schedule JSONB DEFAULT '[]';

COMMENT ON COLUMN projects.handover_date IS 'Ngày nghiệm thu bàn giao thực tế';
COMMENT ON COLUMN projects.has_warranty_guarantee IS 'Có bảo lãnh bảo hành hay không';
COMMENT ON COLUMN projects.warranty_duration_months IS 'Thời gian bảo hành (tháng)';
COMMENT ON COLUMN projects.warranty_percentage IS 'Tỷ lệ % giữ lại bảo hành';
COMMENT ON COLUMN projects.warranty_schedule IS 'Lịch trình thu hồi bảo hành chi tiết cho trường hợp đặc biệt';
