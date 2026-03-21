CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

/* 1. INVENTORY WAREHOUSES */
CREATE TABLE IF NOT EXISTS public.inventory_warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    type TEXT DEFAULT 'site',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

/* 2. INVENTORY STOCKS (AGGREGATED) */
CREATE TABLE IF NOT EXISTS public.inventory_stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL DEFAULT 0,
    min_quantity DECIMAL DEFAULT 5,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(warehouse_id, material_id)
);

/* 3. INVENTORY RECEIPTS (HEADER) */
CREATE TABLE IF NOT EXISTS public.inventory_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT UNIQUE NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    type TEXT NOT NULL, /* 'IN' (Nhập), 'OUT' (Xuất) */
    warehouse_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES public.partners(id),
    po_id UUID REFERENCES public.purchase_orders(id),
    notes TEXT,
    status TEXT DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id)
);

/* 4. INVENTORY RECEIPT ITEMS (DETAILS) */
CREATE TABLE IF NOT EXISTS public.inventory_receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id UUID REFERENCES public.inventory_receipts(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL NOT NULL,
    uom TEXT,
    price DECIMAL DEFAULT 0,
    notes TEXT
);

/* 5. INVENTORY REQUESTS (SITE REQUESTS) */
CREATE TABLE IF NOT EXISTS public.inventory_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT UNIQUE NOT NULL,
    project_id UUID REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
    notes TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id)
);

/* 6. INVENTORY REQUEST ITEMS */
CREATE TABLE IF NOT EXISTS public.inventory_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES public.inventory_requests(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    product_name TEXT,
    quantity DECIMAL NOT NULL,
    uom TEXT,
    notes TEXT
);

/* AUTOMATION: STOCK LEVEL TRIGGERS */

CREATE OR REPLACE FUNCTION public.handle_inventory_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_type TEXT;
    v_warehouse_id UUID;
BEGIN
    SELECT type, warehouse_id INTO v_type, v_warehouse_id 
    FROM public.inventory_receipts 
    WHERE id = NEW.receipt_id;

    INSERT INTO public.inventory_stocks (warehouse_id, material_id, quantity)
    VALUES (v_warehouse_id, NEW.material_id, 0)
    ON CONFLICT (warehouse_id, material_id) DO NOTHING;

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

DROP TRIGGER IF EXISTS trg_update_stock_on_receipt ON public.inventory_receipt_items;
CREATE TRIGGER trg_update_stock_on_receipt
AFTER INSERT ON public.inventory_receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_transaction();

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

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revert_stock_on_delete ON public.inventory_receipt_items;
CREATE TRIGGER trg_revert_stock_on_delete
AFTER DELETE ON public.inventory_receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_revert();

