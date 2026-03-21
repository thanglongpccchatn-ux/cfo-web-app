-- 1. Create inventory_stocks table if not exists (to ensure schema consistency)
CREATE TABLE IF NOT EXISTS public.inventory_stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL DEFAULT 0,
    min_quantity DECIMAL DEFAULT 5,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(warehouse_id, material_id)
);

-- 2. Function to update stock on transaction
CREATE OR REPLACE FUNCTION public.handle_inventory_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_type TEXT;
    v_warehouse_id UUID;
BEGIN
    -- Get transaction type and warehouse from parent receipt
    SELECT type, warehouse_id INTO v_type, v_warehouse_id 
    FROM public.inventory_receipts 
    WHERE id = NEW.receipt_id;

    -- Upsert into inventory_stocks
    INSERT INTO public.inventory_stocks (warehouse_id, material_id, quantity)
    VALUES (v_warehouse_id, NEW.material_id, 0)
    ON CONFLICT (warehouse_id, material_id) DO NOTHING;

    -- Update quantity based on type
    IF v_type = 'IN' THEN
        UPDATE public.inventory_stocks 
        SET quantity = quantity + NEW.quantity, 
            last_updated = now()
        WHERE warehouse_id = v_warehouse_id AND material_id = NEW.material_id;
    ELSIF v_type = 'OUT' THEN
        UPDATE public.inventory_stocks 
        SET quantity = quantity - NEW.quantity, 
            last_updated = now()
        WHERE warehouse_id = v_warehouse_id AND material_id = NEW.material_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger for inventory_receipt_items
DROP TRIGGER IF EXISTS trg_update_stock_on_receipt ON public.inventory_receipt_items;
CREATE TRIGGER trg_update_stock_on_receipt
AFTER INSERT ON public.inventory_receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_transaction();

-- 4. Handing DELETION (to revert stock if receipt item is removed)
CREATE OR REPLACE FUNCTION public.handle_inventory_revert()
RETURNS TRIGGER AS $$
DECLARE
    v_type TEXT;
    v_warehouse_id UUID;
BEGIN
    SELECT type, warehouse_id INTO v_type, v_warehouse_id 
    FROM public.inventory_receipts 
    WHERE id = OLD.receipt_id;

    IF v_type = 'IN' THEN
        UPDATE public.inventory_stocks 
        SET quantity = quantity - OLD.quantity, 
            last_updated = now()
        WHERE warehouse_id = v_warehouse_id AND material_id = OLD.material_id;
    ELSIF v_type = 'OUT' THEN
        UPDATE public.inventory_stocks 
        SET quantity = quantity + OLD.quantity, 
            last_updated = now()
        WHERE warehouse_id = v_warehouse_id AND material_id = OLD.material_id;
    END IF;

-- 5. Add status to inventory_requests if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_requests' AND column_name='status') THEN
        ALTER TABLE public.inventory_requests ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- 6. Add po_id to inventory_receipts to link with Purchase Orders
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_receipts' AND column_name='po_id') THEN
        ALTER TABLE public.inventory_receipts ADD COLUMN po_id UUID REFERENCES public.purchase_orders(id);
    END IF;
END $$;

