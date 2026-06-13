CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  credit_note_no TEXT,
  original_invoice_id UUID,
  customer_id UUID,
  customer_name TEXT,
  date DATE,
  grand_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active',
  items JSONB,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_notes_policy" ON public.credit_notes FOR ALL USING (auth.uid() = user_id);
