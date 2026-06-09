-- Complete Supabase schema for ERP Invoice Generator project
-- This schema includes tables for users, customers, products, invoices, inventory, accounting, and HR.
-- It also includes Row Level Security (RLS) policies and triggers for stock management.

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. TABLES

-- Users profile table (links to auth.users)
-- Note: id must be uuid to match auth.users(id)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'operator',
  name text,
  created_at timestamptz default now()
);

-- Company Settings
create table if not exists public.company_settings (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  company_name text,
  gstin text,
  address text,
  city text,
  pincode text,
  phone text,
  email text,
  state text,
  state_code text,
  logo_url text,
  bank_name text,
  account_number text,
  ifsc_code text,
  branch text,
  invoice_prefix text default 'INV',
  invoice_sequence integer default 0,
  financial_year text,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Customers
create table if not exists public.customers (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  mobile text,
  email text,
  gstin text,
  pan text,
  aadhar text,
  address text,
  city text,
  state text,
  state_code text,
  route_id text,
  root text,
  opening_balance numeric(12,2) default 0,
  opening_balance_type text, -- 'Dr' or 'Cr'
  balance numeric(12,2) default 0,
  balance_type text, -- 'Dr' or 'Cr'
  opening_balance_date date,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Suppliers
create table if not exists public.suppliers (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  contact_person text,
  mobile text,
  email text,
  gstin text,
  pan text,
  address text,
  city text,
  state text,
  state_code text,
  payment_terms text,
  opening_balance numeric(12,2) default 0,
  balance_type text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Brands
create table if not exists public.brands (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Categories
create table if not exists public.categories (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  parent_id text references public.categories(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Products
create table if not exists public.products (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  sku text,
  part_no text,
  brand_id text references public.brands(id),
  category_id text references public.categories(id),
  hsn_code text,
  unit text,
  purchase_price numeric(12,2) default 0,
  rate numeric(12,2) default 0, -- Selling price
  mrp numeric(12,2) default 0,
  gst_rate numeric(5,2) default 0,
  stock numeric(12,2) default 0,
  reorder_level integer default 0,
  net_rate_product boolean default false,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Warehouses
create table if not exists public.warehouses (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  location text,
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Stock Ledger
create table if not exists public.stock_ledger (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  warehouse_id text references public.warehouses(id),
  quantity numeric(12,2) not null,
  transaction_type text, -- 'In', 'Out'
  reference_id text,
  reference_type text, -- 'Invoice', 'Purchase', 'Return'
  date date default current_date,
  notes text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Current Stock
create table if not exists public.current_stock (
  product_id text references public.products(id) on delete cascade,
  warehouse_id text references public.warehouses(id) on delete cascade,
  quantity numeric(12,2) default 0,
  primary key (product_id, warehouse_id)
);

-- Discount Settings
create table if not exists public.discount_settings (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  type text, -- 'Customer', 'Category', 'Product'
  reference_id text,
  discount_percent numeric(5,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Customer Product Net Rates
create table if not exists public.customer_product_net_rates (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  customer_id text references public.customers(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  net_rate numeric(12,2),
  set_by_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Sales Orders
create table if not exists public.sales_orders (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  customer_id text references public.customers(id),
  so_number text,
  date date default current_date,
  status text,
  total_amount numeric(12,2) default 0,
  notes text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Invoices
create table if not exists public.invoices (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  invoice_no text not null,
  irn_no text,
  ack_no text,
  ack_date text,
  customer_id text references public.customers(id),
  customer_name text,
  customer_gstin text,
  customer_pan text,
  customer_aadhar text,
  customer_phone text,
  customer_email text,
  customer_address text,
  customer_city text,
  customer_state text,
  customer_state_code text,
  delivery_address text,
  delivery_city text,
  delivery_state text,
  delivery_state_code text,
  delivery_pincode text,
  so_id text references public.sales_orders(id),
  route_id text,
  date date default current_date,
  due_date date,
  order_no text,
  remark text,
  payment_status text default 'Pending',
  paid_amount numeric(12,2) default 0,
  subtotal_mrp numeric(12,2) default 0,
  total_discount_amount numeric(12,2) default 0,
  subtotal_basic numeric(12,2) default 0,
  total_cgst numeric(12,2) default 0,
  total_sgst numeric(12,2) default 0,
  total_igst numeric(12,2) default 0,
  round_off numeric(12,2) default 0,
  grand_total numeric(12,2) default 0,
  is_interstate boolean default false,
  status text default 'Draft',
  notes text,
  items jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Invoice Items
create table if not exists public.invoice_items (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  invoice_id text references public.invoices(id) on delete cascade,
  product_id text references public.products(id),
  product_name text,
  part_no text,
  hsn_code text,
  qty numeric(12,2) not null,
  mrp_per_unit numeric(12,2),
  effective_price numeric(12,2), -- Rate after discount
  discount_percent numeric(5,2),
  discount_amount numeric(12,2), -- Disc (Rs.)
  is_net_rate boolean default false,
  gst_rate numeric(5,2),
  basic_rate_per_unit numeric(12,2), -- Rate before GST
  basic_amount numeric(12,2), -- Taxable Amt
  gst_amount numeric(12,2), -- GST Tax
  line_total numeric(12,2), -- Amount
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Purchase Invoices
create table if not exists public.purchase_invoices (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  bill_number text not null,
  supplier_id text references public.suppliers(id),
  bill_date date default current_date,
  due_date date,
  subtotal_basic numeric(12,2) default 0,
  total_cgst numeric(12,2) default 0,
  total_sgst numeric(12,2) default 0,
  total_igst numeric(12,2) default 0,
  grand_total numeric(12,2) default 0,
  status text default 'Draft',
  notes text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Purchase Invoice Items
create table if not exists public.purchase_invoice_items (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  purchase_invoice_id text references public.purchase_invoices(id) on delete cascade,
  product_id text references public.products(id),
  qty numeric(12,2) not null,
  purchase_rate_incl_gst numeric(12,2),
  gst_rate numeric(5,2),
  basic_rate numeric(12,2),
  basic_amount numeric(12,2),
  gst_amount numeric(12,2),
  line_total numeric(12,2),
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Customer Payments
create table if not exists public.customer_payments (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  customer_id text references public.customers(id) on delete cascade,
  invoice_id text references public.invoices(id),
  payment_date date default current_date,
  amount numeric(12,2) not null,
  payment_mode text,
  reference_number text,
  notes text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Supplier Payments
create table if not exists public.supplier_payments (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  supplier_id text references public.suppliers(id) on delete cascade,
  purchase_invoice_id text references public.purchase_invoices(id),
  payment_date date default current_date,
  amount numeric(12,2) not null,
  payment_mode text,
  reference_number text,
  notes text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Credit Notes
create table if not exists public.credit_notes (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  credit_note_number text not null,
  original_invoice_id text references public.invoices(id),
  customer_id text references public.customers(id),
  reason text,
  items jsonb default '[]'::jsonb,
  total_basic numeric(12,2) default 0,
  total_gst numeric(12,2) default 0,
  total_amount numeric(12,2) default 0,
  status text default 'Pending',
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Routes
create table if not exists public.routes (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Key-Value Store
create table if not exists public.invoice_kv (
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  value text,
  created_at timestamptz default now(),
  primary key (user_id, key)
);

-- 3. ACCOUNTING TABLES

-- Chart of Accounts
create table if not exists public.chart_of_accounts (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  account_code text,
  account_name text not null,
  account_type text,
  parent_id text references public.chart_of_accounts(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Journal Entries
create table if not exists public.journal_entries (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  entry_number text,
  date date default current_date,
  description text,
  reference text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Journal Entry Lines
create table if not exists public.journal_entry_lines (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  entry_id text references public.journal_entries(id) on delete cascade,
  account_id text references public.chart_of_accounts(id),
  debit numeric(12,2) default 0,
  credit numeric(12,2) default 0,
  narration text,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Tax Ledger
create table if not exists public.tax_ledger (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  transaction_id text,
  transaction_type text,
  hsn_code text,
  taxable_value numeric(12,2) default 0,
  cgst numeric(12,2) default 0,
  sgst numeric(12,2) default 0,
  igst numeric(12,2) default 0,
  date date default current_date,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- 4. HR TABLES

-- Employees
create table if not exists public.employees (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  employee_code text,
  name text not null,
  designation text,
  department text,
  salary numeric(12,2) default 0,
  join_date date,
  status text default 'Active',
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Attendance
create table if not exists public.attendance (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  employee_id text references public.employees(id) on delete cascade,
  date date default current_date,
  status text,
  in_time time,
  out_time time,
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- Payroll
create table if not exists public.payroll (
  id text primary key default (uuid_generate_v4())::text,
  user_id uuid references auth.users(id) on delete cascade,
  employee_id text references public.employees(id) on delete cascade,
  month integer,
  year integer,
  basic numeric(12,2) default 0,
  allowances numeric(12,2) default 0,
  deductions numeric(12,2) default 0,
  net_pay numeric(12,2) default 0,
  status text default 'Pending',
  created_at timestamptz default now(),
  data jsonb default '{}'::jsonb
);

-- 5. TRIGGERS AND FUNCTIONS

-- Function to refresh current stock based on stock ledger
create or replace function public.refresh_current_stock() returns trigger as $$
declare
  current_product_id text;
  current_warehouse_id text;
begin
  if tg_op = 'DELETE' then
    current_product_id := old.product_id;
    current_warehouse_id := old.warehouse_id;
  else
    current_product_id := new.product_id;
    current_warehouse_id := new.warehouse_id;
  end if;

  if current_warehouse_id is not null then
    insert into public.current_stock (product_id, warehouse_id, quantity)
      values (current_product_id, current_warehouse_id, 0)
      on conflict (product_id, warehouse_id) do nothing;

    update public.current_stock
    set quantity = (
      select coalesce(sum(quantity), 0)
      from public.stock_ledger
      where product_id = current_product_id
        and warehouse_id = current_warehouse_id
    )
    where product_id = current_product_id
      and warehouse_id = current_warehouse_id;
  end if;

  update public.products
  set stock = (
    select coalesce(sum(quantity), 0)
    from public.stock_ledger
    where product_id = current_product_id
  )
  where id = current_product_id;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;

create trigger stock_ledger_refresh_current_stock
  after insert or update or delete on public.stock_ledger
  for each row execute function public.refresh_current_stock();

-- 6. ROW LEVEL SECURITY (RLS)
-- (Enable RLS and create policies remains the same, just ensured user_id is uuid)
alter table public.users enable row level security;
alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.warehouses enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.current_stock enable row level security;
alter table public.discount_settings enable row level security;
alter table public.customer_product_net_rates enable row level security;
alter table public.sales_orders enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_items enable row level security;
alter table public.customer_payments enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.credit_notes enable row level security;
alter table public.routes enable row level security;
alter table public.invoice_kv enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.tax_ledger enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.payroll enable row level security;

-- Policies (generic example)
create policy "Users can only access their own profile" on public.users for all using (auth.uid() = id);
create policy "Users can only access their own company settings" on public.company_settings for all using (auth.uid() = user_id);
create policy "Users can only access their own customers" on public.customers for all using (auth.uid() = user_id);
create policy "Users can only access their own suppliers" on public.suppliers for all using (auth.uid() = user_id);
create policy "Users can only access their own brands" on public.brands for all using (auth.uid() = user_id);
create policy "Users can only access their own categories" on public.categories for all using (auth.uid() = user_id);
create policy "Users can only access their own products" on public.products for all using (auth.uid() = user_id);
create policy "Users can only access their own warehouses" on public.warehouses for all using (auth.uid() = user_id);
create policy "Users can only access their own stock ledger" on public.stock_ledger for all using (auth.uid() = user_id);
create policy "Users can only access their own current stock" on public.current_stock for all using (exists (select 1 from public.products where products.id = current_stock.product_id and products.user_id = auth.uid()));
create policy "Users can only access their own discount settings" on public.discount_settings for all using (auth.uid() = user_id);
create policy "Users can only access their own net rates" on public.customer_product_net_rates for all using (auth.uid() = user_id);
create policy "Users can only access their own sales orders" on public.sales_orders for all using (auth.uid() = user_id);
create policy "Users can only access their own invoices" on public.invoices for all using (auth.uid() = user_id);
create policy "Users can only access their own invoice items" on public.invoice_items for all using (auth.uid() = user_id);
create policy "Users can only access their own purchase invoices" on public.purchase_invoices for all using (auth.uid() = user_id);
create policy "Users can only access their own purchase items" on public.purchase_invoice_items for all using (auth.uid() = user_id);
create policy "Users can only access their own customer payments" on public.customer_payments for all using (auth.uid() = user_id);
create policy "Users can only access their own supplier payments" on public.supplier_payments for all using (auth.uid() = user_id);
create policy "Users can only access their own credit notes" on public.credit_notes for all using (auth.uid() = user_id);
create policy "Users can only access their own routes" on public.routes for all using (auth.uid() = user_id);
create policy "Users can only access their own kv pairs" on public.invoice_kv for all using (auth.uid() = user_id);
create policy "Users can only access their own accounts" on public.chart_of_accounts for all using (auth.uid() = user_id);
create policy "Users can only access their own journal entries" on public.journal_entries for all using (auth.uid() = user_id);
create policy "Users can only access their own journal lines" on public.journal_entry_lines for all using (auth.uid() = user_id);
create policy "Users can only access their own tax records" on public.tax_ledger for all using (auth.uid() = user_id);
create policy "Users can only access their own employees" on public.employees for all using (auth.uid() = user_id);
create policy "Users can only access their own attendance" on public.attendance for all using (auth.uid() = user_id);
create policy "Users can only access their own payroll" on public.payroll for all using (auth.uid() = user_id);

