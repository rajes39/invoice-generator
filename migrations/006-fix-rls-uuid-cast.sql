-- Migration to fix RLS policies for text-based user_id columns
-- This ensures that auth.uid() (uuid) is correctly compared with user_id (text)

DO $$
BEGIN
    -- Update policies for all relevant tables
    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own profile" ON public.users';
    CREATE POLICY "Users can only access their own profile" ON public.users FOR ALL USING (auth.uid()::text = id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own company settings" ON public.company_settings';
    CREATE POLICY "Users can only access their own company settings" ON public.company_settings FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own customers" ON public.customers';
    CREATE POLICY "Users can only access their own customers" ON public.customers FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own suppliers" ON public.suppliers';
    CREATE POLICY "Users can only access their own suppliers" ON public.suppliers FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own brands" ON public.brands';
    CREATE POLICY "Users can only access their own brands" ON public.brands FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own categories" ON public.categories';
    CREATE POLICY "Users can only access their own categories" ON public.categories FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own products" ON public.products';
    CREATE POLICY "Users can only access their own products" ON public.products FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own warehouses" ON public.warehouses';
    CREATE POLICY "Users can only access their own warehouses" ON public.warehouses FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own stock ledger" ON public.stock_ledger';
    CREATE POLICY "Users can only access their own stock ledger" ON public.stock_ledger FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own invoices" ON public.invoices';
    CREATE POLICY "Users can only access their own invoices" ON public.invoices FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own invoice items" ON public.invoice_items';
    CREATE POLICY "Users can only access their own invoice items" ON public.invoice_items FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own purchase invoices" ON public.purchase_invoices';
    CREATE POLICY "Users can only access their own purchase invoices" ON public.purchase_invoices FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own customer payments" ON public.customer_payments';
    CREATE POLICY "Users can only access their own customer payments" ON public.customer_payments FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own supplier payments" ON public.supplier_payments';
    CREATE POLICY "Users can only access their own supplier payments" ON public.supplier_payments FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own credit notes" ON public.credit_notes';
    CREATE POLICY "Users can only access their own credit notes" ON public.credit_notes FOR ALL USING (auth.uid()::text = user_id);

    EXECUTE 'DROP POLICY IF EXISTS "Users can only access their own routes" ON public.routes';
    CREATE POLICY "Users can only access their own routes" ON public.routes FOR ALL USING (auth.uid()::text = user_id);
END $$;
