-- Adding new columns to inventory_receipts
ALTER TABLE public.inventory_receipts DROP COLUMN IF EXISTS sub_type;
ALTER TABLE public.inventory_receipts ADD COLUMN sub_type TEXT;

ALTER TABLE public.inventory_receipts DROP COLUMN IF EXISTS attachment_url;
ALTER TABLE public.inventory_receipts ADD COLUMN attachment_url TEXT;

ALTER TABLE public.materials DROP COLUMN IF EXISTS avg_unit_price;
ALTER TABLE public.materials ADD COLUMN avg_unit_price DECIMAL DEFAULT 0;

-- Drop old triggers
DROP TRIGGER IF EXISTS trg_update_stock_on_receipt ON public.inventory_receipt_items;
DROP TRIGGER IF EXISTS trg_revert_stock_on_delete ON public.inventory_receipt_items;

-- New function for when an ITEM is inserted (and the receipt is already CONFIRMED/COMPLETED)
CREATE OR REPLACE FUNCTION public.handle_inventory_transaction_item()
RETURNS TRIGGER AS $$
DECLARE
    v_type TEXT;
    v_warehouse_id UUID;
    v_status TEXT;
    v_total_qty DECIMAL;
    v_new_avg DECIMAL;
BEGIN
    SELECT type, warehouse_id, status INTO v_type, v_warehouse_id, v_status
    FROM public.inventory_receipts 
    WHERE id = NEW.receipt_id;

    IF v_status IN ('CONFIRMED', 'COMPLETED') THEN
        INSERT INTO public.inventory_stocks (warehouse_id, material_id, quantity)
        VALUES (v_warehouse_id, NEW.material_id, 0)
        ON CONFLICT (warehouse_id, material_id) DO NOTHING;

        IF v_type = 'IN' THEN
            -- Calculate avg price
            SELECT COALESCE(SUM(quantity), 0) INTO v_total_qty
            FROM public.inventory_stocks WHERE material_id = NEW.material_id;

            IF v_total_qty = 0 AND NEW.quantity > 0 THEN
                v_new_avg := NEW.price;
            ELSIF NEW.quantity > 0 THEN
                v_new_avg := ((v_total_qty * COALESCE((SELECT avg_unit_price FROM public.materials WHERE id = NEW.material_id), 0)) + (NEW.quantity * NEW.price)) / (v_total_qty + NEW.quantity);
            ELSE
                v_new_avg := COALESCE((SELECT avg_unit_price FROM public.materials WHERE id = NEW.material_id), 0);
            END IF;

            UPDATE public.materials SET avg_unit_price = v_new_avg WHERE id = NEW.material_id;

            UPDATE public.inventory_stocks 
            SET quantity = quantity + NEW.quantity, last_updated = now()
            WHERE warehouse_id = v_warehouse_id AND material_id = NEW.material_id;

        ELSIF v_type = 'OUT' THEN
            UPDATE public.inventory_stocks 
            SET quantity = quantity - NEW.quantity, last_updated = now()
            WHERE warehouse_id = v_warehouse_id AND material_id = NEW.material_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock_on_item_insert
AFTER INSERT ON public.inventory_receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_transaction_item();

-- New function for when RECEIPT changes status to CONFIRMED
CREATE OR REPLACE FUNCTION public.handle_inventory_receipt_status()
RETURNS TRIGGER AS $$
DECLARE
    item_row RECORD;
    v_total_qty DECIMAL;
    v_new_avg DECIMAL;
BEGIN
    IF OLD.status = 'DRAFT' AND NEW.status IN ('CONFIRMED', 'COMPLETED') THEN
        FOR item_row IN SELECT * FROM public.inventory_receipt_items WHERE receipt_id = NEW.id LOOP
            INSERT INTO public.inventory_stocks (warehouse_id, material_id, quantity)
            VALUES (NEW.warehouse_id, item_row.material_id, 0)
            ON CONFLICT (warehouse_id, material_id) DO NOTHING;

            IF NEW.type = 'IN' THEN
                -- Calculate avg price
                SELECT COALESCE(SUM(quantity), 0) INTO v_total_qty
                FROM public.inventory_stocks WHERE material_id = item_row.material_id;

                IF v_total_qty = 0 AND item_row.quantity > 0 THEN
                    v_new_avg := item_row.price;
                ELSIF item_row.quantity > 0 THEN
                    v_new_avg := ((v_total_qty * COALESCE((SELECT avg_unit_price FROM public.materials WHERE id = item_row.material_id), 0)) + (item_row.quantity * item_row.price)) / (v_total_qty + item_row.quantity);
                ELSE
                    v_new_avg := COALESCE((SELECT avg_unit_price FROM public.materials WHERE id = item_row.material_id), 0);
                END IF;

                UPDATE public.materials SET avg_unit_price = v_new_avg WHERE id = item_row.material_id;

                UPDATE public.inventory_stocks 
                SET quantity = quantity + item_row.quantity, last_updated = now()
                WHERE warehouse_id = NEW.warehouse_id AND material_id = item_row.material_id;

            ELSIF NEW.type = 'OUT' THEN
                UPDATE public.inventory_stocks 
                SET quantity = quantity - item_row.quantity, last_updated = now()
                WHERE warehouse_id = NEW.warehouse_id AND material_id = item_row.material_id;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock_on_receipt_status
AFTER UPDATE OF status ON public.inventory_receipts
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_receipt_status();
