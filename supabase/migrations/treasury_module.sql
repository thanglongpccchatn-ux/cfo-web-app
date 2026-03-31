-- ==============================================================================
-- MIGRATION SCRIPT: TREASURY MANAGEMENT (SỔ QUỸ & NGÂN HÀNG)
-- Description: Quản lý Số dư Tài khoản Ngân hàng và Quỹ Tiền Mặt
-- ==============================================================================

-- 1. BẢNG DANH MỤC TÀI KHOẢN / QUỸ (treasury_accounts)
CREATE TABLE IF NOT EXISTS public.treasury_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                         -- Tên quỹ (VD: Quỹ tiền mặt, Techcombank TL)
    bank_name TEXT,                             -- Tên NH (nếu là tài khoản ngân hàng)
    account_number TEXT,                        -- Số tài khoản (nếu có)
    type TEXT NOT NULL DEFAULT 'bank' 
        CHECK (type IN ('bank', 'cash')),       -- Loại: Ngân hàng hoặc Tiền mặt
    currency TEXT DEFAULT 'VND',
    initial_balance NUMERIC(15,2) DEFAULT 0,    -- Số dư khởi tạo
    current_balance NUMERIC(15,2) DEFAULT 0,    -- Số dư hiện tại (Tự động tính toán)
    status TEXT DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS & Policies cho accounts
ALTER TABLE public.treasury_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép tất cả user đọc quỹ" ON public.treasury_accounts FOR SELECT USING (true);
CREATE POLICY "Chỉ người có quyền quản lý quỹ mới được sửa quỹ" ON public.treasury_accounts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.role_permissions rp ON p.role_code = rp.role_code WHERE p.id = auth.uid() AND (rp.permission_code = 'manage_treasury' OR p.role_code = 'ROLE01'))
);
CREATE POLICY "Chỉ role01 sửa quỹ" ON public.treasury_accounts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.role_permissions rp ON p.role_code = rp.role_code WHERE p.id = auth.uid() AND (rp.permission_code = 'manage_treasury' OR p.role_code = 'ROLE01'))
);

-- 2. BẢNG SỔ GIAO DỊCH (treasury_transactions)
CREATE TABLE IF NOT EXISTS public.treasury_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.treasury_accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL 
        CHECK (type IN ('IN', 'OUT', 'TRANSFER')), -- Thu / Chi / Rút-Chuyển nội bộ
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0), -- Số tiền luôn dương, dựa vào type để tính biến động
    category TEXT NOT NULL,                     -- Phân loại: Lãi ngân hàng, Thanh lý, Chi trả NCC, Nộp tiền mặt...
    party_name TEXT,                            -- Người nộp / Người nhận (Tên NCC, NV...)
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,                           -- Diễn giải
    created_by UUID REFERENCES auth.users(id),  -- Người lập phiếu
    linked_transaction_id UUID,                 -- (Nếu là TRANSFER, ID của giao dịch đối ứng ở quỹ kia)
    project_id UUID REFERENCES public.projects(id), -- (Tùy chọn: Gắn liền với 1 dự án như thanh lý phế liệu DA)
    ref_id TEXT,                                -- Mã tham chiếu chứng từ/ hợp đồng
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS & Policies cho transactions
ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép tất cả đọc giao dịch" ON public.treasury_transactions FOR SELECT USING (true);
CREATE POLICY "Cho phép kế toán / admin tạo giao dịch" ON public.treasury_transactions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.role_permissions rp ON p.role_code = rp.role_code WHERE p.id = auth.uid() AND (rp.permission_code = 'manage_treasury' OR p.role_code = 'ROLE01'))
);

-- 3. TRIGGER: TỰ ĐỘNG CẬP NHẬT `current_balance` KHI CÓ GIAO DỊCH MỚI
CREATE OR REPLACE FUNCTION public.update_treasury_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Khi Thêm giao dịch mới
    IF (TG_OP = 'INSERT') THEN
        IF NEW.type = 'IN' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF NEW.type = 'OUT' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    -- Khi Xóa giao dịch (Revert)
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.type = 'IN' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'OUT' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
        RETURN OLD;
    -- Đề phòng update
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Hoàn tác cũ
        IF OLD.type = 'IN' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
        ELSIF OLD.type = 'OUT' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
        END IF;
        -- Tính số mới
        IF NEW.type = 'IN' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF NEW.type = 'OUT' THEN
            UPDATE public.treasury_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_treasury_balance_trigger ON public.treasury_transactions;
CREATE TRIGGER update_treasury_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.treasury_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_treasury_balance();

-- 4. BỔ SUNG QUYỀN VÀ PHÂN QUYỀN
-- Thêm quyền vào bảng permissions trước (cột: code, name, module, description)
INSERT INTO public.permissions (code, name, module, description)
VALUES ('manage_treasury', 'Quản lý Sổ Quỹ & Ngân hàng', 'Tài chính', 'Toàn quyền sử dụng phân hệ Sổ Quỹ (Treasury)')
ON CONFLICT (code) DO NOTHING;

-- Bổ sung quyền manage_treasury vào ROLE01 (Admin) và ROLE06 (Kế toán Trưởng)
INSERT INTO public.role_permissions (role_code, permission_code)
VALUES 
    ('ROLE01', 'manage_treasury'),
    ('ROLE04', 'manage_treasury'), -- Kế toán nếu cần
    ('ROLE06', 'manage_treasury') 
ON CONFLICT DO NOTHING;

