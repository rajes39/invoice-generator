-- Migration 007: Advanced ERP Automation & Central Transaction Engine
-- Focus: Automated Accounting, Inventory, GST, and Barcode Support

-- 1. ENHANCED SCHEMA UPDATES

-- Products: Barcode and Batch Support
alter table public.products 
  add column if not exists barcode text,
  add column if not exists min_stock_level numeric(12,2) default 0,
  add column if not exists is_batch_tracked boolean default false;

-- Add unique constraint to barcode if it doesn't exist
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_barcode_key') then
    alter table public.products add constraint products_barcode_key unique (barcode);
  end if;
end $$;

-- Warehouses: Primary status
alter table public.warehouses 
  add column if not exists is_primary boolean default false;

-- Stock Ledger: Batch and Warehouse Transfers
alter table public.stock_ledger
  add column if not exists batch_no text,
  add column if not exists expiry_date date,
  add column if not exists to_warehouse_id text references public.warehouses(id);

-- System Notifications
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  message text,
  type text, -- 'stock_low', 'payment_due', 'system'
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text, -- 'INSERT', 'UPDATE', 'DELETE'
  table_name text,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

-- Enable RLS for new tables
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users can see their own notifications" on public.notifications for all using (auth.uid() = user_id);
create policy "Users can see their own audit logs" on public.audit_logs for all using (auth.uid() = user_id);

-- 2. CENTRAL TRANSACTION ENGINE FUNCTIONS

-- Function to get or create system accounts
create or replace function public.get_system_account(p_user_id uuid, p_account_name text, p_account_type text) 
returns text as $$
declare
  v_account_id text;
begin
  select id into v_account_id 
  from public.chart_of_accounts 
  where user_id = p_user_id and account_name = p_account_name;

  if v_account_id is null then
    v_account_id := uuid_generate_v4()::text;
    insert into public.chart_of_accounts (id, user_id, account_name, account_type, is_active)
    values (v_account_id, p_user_id, p_account_name, p_account_type, true);
  end if;

  return v_account_id;
end;
$$ language plpgsql;

-- Unified Transaction Processor
create or replace function public.process_transaction() returns trigger as $$
declare
  v_journal_id text;
  v_account_sales text;
  v_account_purchase text;
  v_account_debtors text;
  v_account_creditors text;
  v_account_gst_output text;
  v_account_gst_input text;
  v_account_cash text;
begin
  -- 1. Initialize System Accounts
  v_account_sales := public.get_system_account(new.user_id, 'Sales Account', 'Revenue');
  v_account_purchase := public.get_system_account(new.user_id, 'Purchase Account', 'Expense');
  v_account_debtors := public.get_system_account(new.user_id, 'Sundry Debtors', 'Asset');
  v_account_creditors := public.get_system_account(new.user_id, 'Sundry Creditors', 'Liability');
  v_account_gst_output := public.get_system_account(new.user_id, 'GST Output', 'Liability');
  v_account_gst_input := public.get_system_account(new.user_id, 'GST Input', 'Asset');
  v_account_cash := public.get_system_account(new.user_id, 'Cash In Hand', 'Asset');

  -- 2. Handle Invoices (Sales)
  if tg_table_name = 'invoices' then
    -- Only process accounting for confirmed/completed invoices
    if (tg_op = 'INSERT' and new.status = 'Confirmed') or 
       (tg_op = 'UPDATE' and old.status = 'Draft' and new.status = 'Confirmed') then
      
      -- Create Journal Entry
      v_journal_id := uuid_generate_v4()::text;
      insert into public.journal_entries (id, user_id, entry_number, date, description, reference)
      values (v_journal_id, new.user_id, 'JV-' || new.invoice_no, new.date, 'Sales Invoice: ' || new.invoice_no, new.id);

      -- Debit: Customer (Sundry Debtors)
      insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
      values (new.user_id, v_journal_id, v_account_debtors, new.grand_total, 0, 'To Sales ' || new.invoice_no);

      -- Credit: Sales
      insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
      values (new.user_id, v_journal_id, v_account_sales, 0, new.subtotal_basic, 'By Invoice ' || new.invoice_no);

      -- Credit: GST Output
      if (new.total_cgst + new.total_sgst + new.total_igst) > 0 then
        insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
        values (new.user_id, v_journal_id, v_account_gst_output, 0, (new.total_cgst + new.total_sgst + new.total_igst), 'GST on ' || new.invoice_no);
      end if;
    end if;

  -- 3. Handle Purchase Invoices
  elsif tg_table_name = 'purchase_invoices' then
    v_journal_id := uuid_generate_v4()::text;
    insert into public.journal_entries (id, user_id, entry_number, date, description, reference)
    values (v_journal_id, new.user_id, 'PV-' || new.bill_number, new.bill_date, 'Purchase Bill: ' || new.bill_number, new.id);

    -- Debit: Purchase
    insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
    values (new.user_id, v_journal_id, v_account_purchase, new.subtotal_basic, 0, 'By Bill ' || new.bill_number);

    -- Debit: GST Input
    if (new.total_cgst + new.total_sgst + new.total_igst) > 0 then
      insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
      values (new.user_id, v_journal_id, v_account_gst_input, (new.total_cgst + new.total_sgst + new.total_igst), 0, 'GST Input on ' || new.bill_number);
    end if;

    -- Credit: Supplier (Sundry Creditors)
    insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
    values (new.user_id, v_journal_id, v_account_creditors, 0, new.grand_total, 'To Bill ' || new.bill_number);

  -- 4. Handle Customer Payments
  elsif tg_table_name = 'customer_payments' then
    v_journal_id := uuid_generate_v4()::text;
    insert into public.journal_entries (id, user_id, entry_number, date, description, reference)
    values (v_journal_id, new.user_id, 'RCPT-' || new.id, new.payment_date, 'Payment Received', new.id);

    -- Debit: Cash/Bank
    insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
    values (new.user_id, v_journal_id, v_account_cash, new.amount, 0, 'Payment from customer');

    -- Credit: Customer (Sundry Debtors)
    insert into public.journal_entry_lines (user_id, entry_id, account_id, debit, credit, narration)
    values (new.user_id, v_journal_id, v_account_debtors, 0, new.amount, 'Customer payment received');
  end if;

  return new;
end;
$$ language plpgsql;

-- Drop existing triggers to avoid conflicts if rerunning
drop trigger if exists trg_invoice_accounting on public.invoices;
drop trigger if exists trg_purchase_accounting on public.purchase_invoices;
drop trigger if exists trg_payment_accounting on public.customer_payments;

-- Triggers for Financial Automation
create trigger trg_invoice_accounting after insert or update on public.invoices for each row execute function public.process_transaction();
create trigger trg_purchase_accounting after insert or update on public.purchase_invoices for each row execute function public.process_transaction();
create trigger trg_payment_accounting after insert or update on public.customer_payments for each row execute function public.process_transaction();

-- 3. INVENTORY AUTOMATION

-- Check Low Stock function
create or replace function public.check_low_stock(p_product_id text, p_user_id uuid) returns void as $$
declare
  v_current_stock numeric;
  v_min_stock numeric;
  v_product_name text;
begin
  select stock, min_stock_level, name into v_current_stock, v_min_stock, v_product_name 
  from public.products where id = p_product_id;

  if v_current_stock <= v_min_stock then
    insert into public.notifications (user_id, title, message, type)
    values (p_user_id, 'Low Stock Alert', 'Product ' || v_product_name || ' is low on stock (' || v_current_stock || ')', 'stock_low');
  end if;
end;
$$ language plpgsql;

-- Function to handle automated stock ledger entries from invoice items
create or replace function public.auto_stock_from_invoice_item() returns trigger as $$
declare
  v_warehouse_id text;
begin
  -- Use primary warehouse if not specified
  select id into v_warehouse_id from public.warehouses where user_id = new.user_id and is_primary = true limit 1;
  
  -- Fallback to any warehouse if no primary found
  if v_warehouse_id is null then
    select id into v_warehouse_id from public.warehouses where user_id = new.user_id limit 1;
  end if;

  if v_warehouse_id is not null then
    insert into public.stock_ledger (user_id, product_id, warehouse_id, quantity, transaction_type, reference_id, reference_type, date)
    values (new.user_id, new.product_id, v_warehouse_id, -new.qty, 'Out', new.invoice_id, 'Invoice', current_date);
  end if;

  -- Low stock alert
  perform public.check_low_stock(new.product_id, new.user_id);

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stock_from_invoice on public.invoice_items;
create trigger trg_stock_from_invoice after insert on public.invoice_items for each row execute function public.auto_stock_from_invoice_item();

-- 4. TAX LEDGER AUTOMATION
create or replace function public.auto_tax_ledger() returns trigger as $$
begin
  insert into public.tax_ledger (user_id, transaction_id, transaction_type, hsn_code, taxable_value, cgst, sgst, igst, date)
  values (new.user_id, new.invoice_id, 'Sales', new.hsn_code, new.basic_amount, (new.gst_amount/2), (new.gst_amount/2), 0, current_date);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tax_from_invoice on public.invoice_items;
create trigger trg_tax_from_invoice after insert on public.invoice_items for each row execute function public.auto_tax_ledger();
