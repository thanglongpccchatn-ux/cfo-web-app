-- 1. Bảng lưu trữ Danh sách Phát sinh (Contract Variations)
CREATE TABLE IF NOT EXISTS public.contract_variations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    variation_no TEXT,                         -- Số hiệu Phụ lục
    name TEXT NOT NULL,                        -- Tên/Nội dung phát sinh
    proposed_value NUMERIC DEFAULT 0,          -- Giá trị CĐT đề nghị
    approved_value NUMERIC DEFAULT 0,          -- Giá trị CĐT duyệt (Chốt)
    status TEXT DEFAULT 'Chờ duyệt',           -- Trạng thái: Chờ duyệt, Đang xử lý, Đã duyệt, Hủy
    approval_date DATE,                        -- Ngày duyệt chính thức
    notes TEXT,                                -- Ghi chú chung
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS cho contract_variations
ALTER TABLE public.contract_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contract_variations" ON public.contract_variations FOR ALL USING (true);


-- 2. Bảng lưu trữ Lịch sử thay đổi (Variation History)
CREATE TABLE IF NOT EXISTS public.variation_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variation_id UUID REFERENCES public.contract_variations(id) ON DELETE CASCADE,
    old_status TEXT,                           -- Trạng thái cũ
    new_status TEXT,                           -- Trạng thái mới
    old_value NUMERIC,                         -- Giá trị duyệt cũ
    new_value NUMERIC,                         -- Giá trị duyệt mới
    reason TEXT,                               -- Lý do thay đổi (CĐT ép giá, tính toán lại khối lượng...)
    changed_by TEXT,                           -- Người thay đổi (lưu tên cho đơn giản, hoặc UUID user)
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS cho variation_history
ALTER TABLE public.variation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on variation_history" ON public.variation_history FOR ALL USING (true);


NOTIFY pgrst, 'reload schema';

-- 3. Cập nhật bảng projects để lưu trữ giá trị Phát sinh đã duyệt
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS total_approved_variations NUMERIC DEFAULT 0;

-- 4. Trigger tự động tính tổng phát sinh đã duyệt cho dự án
CREATE OR REPLACE FUNCTION update_project_variations()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Tính lại tổng cho project của bản ghi mới
        UPDATE public.projects
        SET total_approved_variations = (
            SELECT COALESCE(SUM(approved_value), 0)
            FROM public.contract_variations
            WHERE project_id = NEW.project_id AND status = 'Đã duyệt'
        )
        WHERE id = NEW.project_id;
    END IF;

    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.project_id != NEW.project_id) THEN
        -- Tính lại tổng cho project của bản ghi cũ (nếu bị xóa hoặc đổi project)
        UPDATE public.projects
        SET total_approved_variations = (
            SELECT COALESCE(SUM(approved_value), 0)
            FROM public.contract_variations
            WHERE project_id = OLD.project_id AND status = 'Đã duyệt'
        )
        WHERE id = OLD.project_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_project_variations ON public.contract_variations;
CREATE TRIGGER trg_update_project_variations
AFTER INSERT OR UPDATE OR DELETE ON public.contract_variations
FOR EACH ROW EXECUTE FUNCTION update_project_variations();
