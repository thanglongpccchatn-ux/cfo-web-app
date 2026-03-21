-- Tạo bảng lưu lịch sử thay đổi giá vật tư
CREATE TABLE IF NOT EXISTS material_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    old_base_price NUMERIC,
    new_base_price NUMERIC,
    old_discount_percentage NUMERIC,
    new_discount_percentage NUMERIC,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    changed_by UUID REFERENCES profiles(id), -- Ghi nhận ai là người sửa (nếu có thể lấy được từ phiên)
    reason TEXT DEFAULT 'Cập nhật từ hệ thống'
);

-- Kích hoạt mã hóa RLS để bảo mật
ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;

-- Policy: Chỉ ai đăng nhập mới được xem lịch sử giá
CREATE POLICY "Cho phép User xem lịch sử giá" 
ON material_price_history FOR SELECT 
TO authenticated 
USING (true);

-- Policy: Insert chỉ được thực hiện bởi Trigger (không cho người dùng xóa sửa lịch sử)
-- Không tạo policy cho Insert/Update từ Client.

-- Viết hàm (Function) bắt sự kiện tự động Log Lịch sử Giá
CREATE OR REPLACE FUNCTION log_material_price_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Chỉ ghi log khi có SỰ THAY ĐỔI thực sự về mặt Đơn giá hoặc Chiết khấu
    IF (OLD.base_price IS DISTINCT FROM NEW.base_price) OR 
       (OLD.discount_percentage IS DISTINCT FROM NEW.discount_percentage) THEN
        
        INSERT INTO material_price_history (
            material_id, 
            old_base_price, 
            new_base_price, 
            old_discount_percentage, 
            new_discount_percentage
        ) VALUES (
            NEW.id, 
            OLD.base_price, 
            NEW.base_price,
            OLD.discount_percentage, 
            NEW.discount_percentage
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn cò (Trigger) vào bảng materials
DROP TRIGGER IF EXISTS trg_log_material_price_update ON materials;

CREATE TRIGGER trg_log_material_price_update
AFTER UPDATE ON materials
FOR EACH ROW
EXECUTE FUNCTION log_material_price_change();
