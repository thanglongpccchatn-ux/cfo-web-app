-- ==============================================================================
-- MIGRATION: PROCUREMENT WORKFLOW
-- Mở rộng inventory_requests + Tạo purchase_orders
-- ==============================================================================

-- ==============================================================================
-- 1. MỞ RỘNG BẢNG inventory_requests (Phiếu đề nghị vật tư)
-- ==============================================================================

-- Thêm trường duyệt 2 cấp
ALTER TABLE public.inventory_requests
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS approved_by_l1 UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at_l1 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by_l2 UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at_l2 TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Chuẩn hóa status mới: DRAFT, PENDING_L1, PENDING_L2, APPROVED, REJECTED_L1, REJECTED_L2, CANCELLED
-- (Giá trị cũ 'Chờ duyệt' sẽ tương đương PENDING_L1)
UPDATE public.inventory_requests SET status = 'PENDING_L1' WHERE status = 'Chờ duyệt';
UPDATE public.inventory_requests SET status = 'APPROVED' WHERE status = 'Đã duyệt';
UPDATE public.inventory_requests SET status = 'REJECTED_L1' WHERE status = 'Từ chối';

-- Thêm trường số lượng thực nhận vào request items (để so sánh)
ALTER TABLE public.inventory_request_items
ADD COLUMN IF NOT EXISTS quantity_ordered NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_received NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_name TEXT;

-- ==============================================================================
-- 2. TẠO BẢNG purchase_orders (Đơn đặt hàng)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,                          -- VD: PO-2026-001
    request_id UUID REFERENCES public.inventory_requests(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    order_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expected_delivery DATE,
    status TEXT DEFAULT 'ORDERED',                      -- ORDERED, PARTIAL, COMPLETED, CANCELLED
    total_amount NUMERIC DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on purchase_orders" ON public.purchase_orders;
CREATE POLICY "Allow all on purchase_orders" ON public.purchase_orders FOR ALL USING (true);

-- ==============================================================================
-- 3. CHI TIẾT ĐƠN ĐẶT HÀNG (purchase_order_items)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
    request_item_id UUID REFERENCES public.inventory_request_items(id) ON DELETE SET NULL,
    material_name TEXT,                                 -- Tên VT snapshot
    quantity_ordered NUMERIC NOT NULL DEFAULT 0,
    quantity_received NUMERIC DEFAULT 0,                -- Cập nhật khi nhập kho
    unit_price NUMERIC DEFAULT 0,
    unit TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Allow all on purchase_order_items" ON public.purchase_order_items FOR ALL USING (true);

-- ==============================================================================
-- 4. THÊM PERMISSIONS MỚI CHO PROCUREMENT
-- ==============================================================================
INSERT INTO public.permissions (code, name, module, description) VALUES
('create_material_request', 'Tạo đề nghị vật tư', 'Procurement', 'Kỹ sư tạo phiếu đề nghị VT'),
('approve_request_l1', 'Duyệt đề nghị VT cấp 1', 'Procurement', 'Chỉ huy trưởng duyệt lần 1'),
('approve_request_l2', 'Duyệt đề nghị VT cấp 2', 'Procurement', 'BP KSKL duyệt lần 2'),
('create_purchase_order', 'Tạo đơn đặt hàng', 'Procurement', 'BP Vật tư tạo PO mua hàng'),
('receive_goods', 'Nhập hàng vào kho', 'WMS', 'Kho dự án nhận hàng từ PO')
ON CONFLICT (code) DO NOTHING;

-- Phân quyền theo role
-- ROLE08 (Kỹ sư) → Tạo đề nghị
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE08', 'create_material_request')
ON CONFLICT DO NOTHING;

-- ROLE07 (Chỉ huy trưởng) → Duyệt L1
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE07', 'approve_request_l1'),
('ROLE07', 'create_material_request')
ON CONFLICT DO NOTHING;

-- ROLE04 (BP Kiểm soát KL) → Duyệt L2
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE04', 'approve_request_l2')
ON CONFLICT DO NOTHING;

-- ROLE03 (BP Vật tư) → Tạo PO
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE03', 'create_purchase_order'),
('ROLE03', 'create_material_request')
ON CONFLICT DO NOTHING;

-- ROLE09 (Kho dự án) → Nhập hàng
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE09', 'receive_goods')
ON CONFLICT DO NOTHING;

-- ROLE01 (Admin) → Tất cả quyền mới
INSERT INTO public.role_permissions (role_code, permission_code)
SELECT 'ROLE01', code FROM public.permissions 
WHERE code IN ('create_material_request', 'approve_request_l1', 'approve_request_l2', 'create_purchase_order', 'receive_goods')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 5. LIÊN KẾT inventory_receipts VỚI purchase_orders
-- ==============================================================================
ALTER TABLE public.inventory_receipts
ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_receipt_items
ADD COLUMN IF NOT EXISTS po_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE SET NULL;

-- ==============================================================================
-- 6. THANH TOÁN NCC THEO PO (po_payments)
-- Kế toán nội bộ thanh toán từng đợt cho NCC theo từng PO
-- ==============================================================================
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID',  -- UNPAID, PARTIAL, PAID
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.po_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT,                                -- Chuyển khoản, Tiền mặt, etc.
    reference_number TEXT,                              -- Số chứng từ / UNC
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.po_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on po_payments" ON public.po_payments;
CREATE POLICY "Allow all on po_payments" ON public.po_payments FOR ALL USING (true);

-- Thêm permission thanh toán NCC
INSERT INTO public.permissions (code, name, module, description) VALUES
('pay_supplier', 'Thanh toán NCC', 'Procurement', 'Kế toán nội bộ thanh toán đơn hàng cho NCC')
ON CONFLICT (code) DO NOTHING;

-- ROLE05 (BP Thanh toán thầu phụ) + ROLE06 (BP Theo dõi HĐ) → Thanh toán NCC
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE05', 'pay_supplier'),
('ROLE06', 'pay_supplier')
ON CONFLICT DO NOTHING;

-- Admin cũng có quyền thanh toán
INSERT INTO public.role_permissions (role_code, permission_code) VALUES
('ROLE01', 'pay_supplier')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 7. LỊCH SỬ SỬA ĐỔI ĐỀ NGHỊ VT (request_revisions)
-- Ghi nhận mỗi lần sửa đổi đề nghị vật tư
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.request_revisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID REFERENCES public.inventory_requests(id) ON DELETE CASCADE,
    revision_number INTEGER DEFAULT 1,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    change_type TEXT NOT NULL,                          -- EDIT, RESUBMIT, STATUS_CHANGE
    old_values JSONB,                                   -- Snapshot trước khi sửa
    new_values JSONB,                                   -- Snapshot sau khi sửa
    notes TEXT                                          -- Ghi chú thay đổi
);

ALTER TABLE public.request_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on request_revisions" ON public.request_revisions;
CREATE POLICY "Allow all on request_revisions" ON public.request_revisions FOR ALL USING (true);

-- Thêm cột revision_count vào inventory_requests
ALTER TABLE public.inventory_requests
ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
