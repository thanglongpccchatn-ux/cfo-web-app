-- Add final (winning) price columns to bids and bid_versions
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS final_price_before_vat numeric DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS final_price_after_vat numeric DEFAULT 0;

ALTER TABLE public.bid_versions ADD COLUMN IF NOT EXISTS final_price_before_vat numeric DEFAULT 0;
ALTER TABLE public.bid_versions ADD COLUMN IF NOT EXISTS final_price_after_vat numeric DEFAULT 0;
