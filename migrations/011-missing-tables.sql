CREATE TABLE IF NOT EXISTS public.backup_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  backup_date DATE,
  backup_time TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'success'
);
ALTER TABLE public.backup_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "backup_log_policy" ON public.backup_log FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.goods_receipt_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  grn_number TEXT,
  supplier_id UUID,
  receipt_date DATE,
  warehouse_id UUID,
  po_reference TEXT,
  status TEXT DEFAULT 'draft',
  remarks TEXT,
  total_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "grn_policy" ON public.goods_receipt_notes FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID REFERENCES public.goods_receipt_notes(id),
  user_id UUID REFERENCES auth.users(id),
  product_id UUID,
  ordered_qty NUMERIC DEFAULT 0,
  received_qty NUMERIC DEFAULT 0,
  unit_rate NUMERIC DEFAULT 0,
  line_amount NUMERIC DEFAULT 0
);
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "grn_items_policy" ON public.goods_receipt_items FOR ALL USING (auth.uid() = user_id);
