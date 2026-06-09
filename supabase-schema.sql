-- Supabase schema for invoice generator application
-- Extended for ERP: parties, inventory, purchase, sales, accounting, and HR.
-- Run this SQL in your Supabase SQL editor to create or migrate the required tables.

create table if not exists users (
  id text primary key,
  email text,
  role text,
  name text,
  password_hash text,
  created_at timestamptz default now()
);

create table if not exists customers (
  id text primary key,
  user_id text references auth.users(id),
  name text,
  mobile text,
  email text,
  gstin text,
  pan text,
  address text,
  city text,
  state text,
  state_code text,
  route_id text,
  opening_balance numeric(12,2),
  credit_limit numeric(12,2),
  balance numeric(12,2),
  balance_type text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists suppliers (
  id text primary key,
  user_id text references auth.users(id),
  name text,
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
  opening_balance numeric(12,2),
  balance_type text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists products (
  id text primary key,
  user_id text references auth.users(id),
  name text,
  sku text,
  part_no text,
  brand_id text,
  category text,
  category_id text,
  hsn_code text,
  unit text,
  purchase_price numeric(12,2),
  selling_price numeric(12,2),
  mrp numeric(12,2),
  rate numeric(12,2),
  gst_rate numeric(5,2),
  tax_rate numeric(5,2),
  stock integer,
  reorder_level integer,
  net_rate_product boolean default false,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists warehouses (
  id text primary key,
  name text,
  location text,
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists stock_ledger (
  id text primary key,
  product_id text references products(id),
  warehouse_id text references warehouses(id),
  quantity numeric(12,2),
  transaction_type text,
  reference_id text,
  reference_type text,
  date date,
  notes text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists current_stock (
  product_id text references products(id),
  warehouse_id text references warehouses(id),
  quantity numeric(12,2) default 0,
  primary key (product_id, warehouse_id)
);

create or replace function refresh_current_stock() returns trigger as $$
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

  insert into current_stock (product_id, warehouse_id, quantity)
    values (current_product_id, current_warehouse_id, 0)
    on conflict (product_id, warehouse_id) do nothing;

  update current_stock
  set quantity = (
    select coalesce(sum(quantity), 0)
    from stock_ledger
    where product_id = current_product_id
      and warehouse_id = current_warehouse_id
  )
  where product_id = current_product_id
    and warehouse_id = current_warehouse_id;

  if tg_op = 'UPDATE' and (old.product_id is distinct from new.product_id or old.warehouse_id is distinct from new.warehouse_id) then
    update current_stock
    set quantity = (
      select coalesce(sum(quantity), 0)
      from stock_ledger
      where product_id = old.product_id
        and warehouse_id = old.warehouse_id
    )
    where product_id = old.product_id
      and warehouse_id = old.warehouse_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql;

create trigger stock_ledger_refresh_current_stock
  after insert or update or delete on stock_ledger
  for each row execute function refresh_current_stock();

create table if not exists brands (
  id text primary key,
  name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists categories (
  id text primary key,
  name text,
  parent_id text references categories(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists discount_settings (
  id text primary key,
  type text,
  reference_id text,
  discount_percent numeric(5,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists customer_product_net_rates (
  id text primary key,
  customer_id text references customers(id),
  product_id text references products(id),
  net_rate numeric(12,2),
  set_by_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data jsonb not null
);

create table if not exists purchase_orders (
  id text primary key,
  supplier_id text references suppliers(id),
  po_number text,
  date date,
  status text,
  total_amount numeric(12,2),
  notes text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists purchase_order_items (
  id text primary key,
  po_id text references purchase_orders(id),
  product_id text references products(id),
  quantity numeric(12,2),
  unit_price numeric(12,2),
  tax_rate numeric(5,2),
  amount numeric(12,2),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists goods_receipt_notes (
  id text primary key,
  po_id text references purchase_orders(id),
  grn_number text,
  date date,
  warehouse_id text references warehouses(id),
  status text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists grn_items (
  id text primary key,
  grn_id text references goods_receipt_notes(id),
  product_id text references products(id),
  ordered_qty numeric(12,2),
  received_qty numeric(12,2),
  unit_price numeric(12,2),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists sales_orders (
  id text primary key,
  customer_id text references customers(id),
  so_number text,
  date date,
  status text,
  total_amount numeric(12,2),
  notes text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists sales_order_items (
  id text primary key,
  so_id text references sales_orders(id),
  product_id text references products(id),
  quantity numeric(12,2),
  unit_price numeric(12,2),
  tax_rate numeric(5,2),
  amount numeric(12,2),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists company_settings (
  id text primary key,
  user_id text references auth.users(id),
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
  pan text,
  bank_name text,
  account_number text,
  ifsc_code text,
  branch text,
  invoice_prefix text default 'INV',
  invoice_sequence integer default 0,
  financial_year text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists invoices (
  id text primary key,
  user_id text references auth.users(id),
  invoice_no text not null,
  irn_no text,
  ack_no text,
  ack_date text,
  customer_id text references customers(id),
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
  so_id text references sales_orders(id),
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
  freight_charges numeric(12,2) default 0,
  freight_gst numeric(12,2) default 0,
  round_off numeric(12,2) default 0,
  grand_total numeric(12,2) default 0,
  is_interstate boolean default false,
  status text default 'Draft',
  notes text,
  items jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists invoice_items (
  id text primary key,
  user_id text references auth.users(id),
  invoice_id text references invoices(id) on delete cascade,
  product_id text references products(id),
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
  data jsonb not null
);

create table if not exists purchases (
  id text primary key,
  user_id text references auth.users(id),
  purchase_no text,
  supplier_id text references suppliers(id),
  date date,
  items jsonb,
  subtotal numeric(12,2),
  tax numeric(12,2),
  total numeric(12,2),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists purchase_invoices (
  id text primary key,
  user_id text references auth.users(id),
  bill_number text,
  supplier_id text references suppliers(id),
  bill_date date,
  due_date date,
  subtotal_basic numeric(12,2),
  total_cgst numeric(12,2),
  total_sgst numeric(12,2),
  total_igst numeric(12,2),
  grand_total numeric(12,2),
  status text,
  notes text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists purchase_invoice_items (
  id text primary key,
  purchase_invoice_id text references purchase_invoices(id),
  product_id text references products(id),
  qty integer,
  purchase_rate_incl_gst numeric(12,2),
  gst_rate numeric(5,2),
  basic_rate numeric(12,2),
  basic_amount numeric(12,2),
  gst_amount numeric(12,2),
  line_total numeric(12,2),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists supplier_payments (
  id text primary key,
  supplier_id text references suppliers(id),
  payment_date date,
  amount numeric(12,2),
  payment_mode text,
  reference_number text,
  notes text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists customer_payments (
  id text primary key,
  customer_id text references customers(id),
  payment_date date,
  amount numeric(12,2),
  payment_mode text,
  reference_number text,
  notes text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists payments_received (
  id text primary key,
  invoice_id text references invoices(id),
  customer_id text references customers(id),
  amount numeric(12,2),
  payment_mode text,
  date date,
  reference_no text,
  notes text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists routes (
  id text primary key,
  name text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists credit_notes (
  id text primary key,
  credit_note_number text,
  original_invoice_id text references invoices(id),
  customer_id text references customers(id),
  reason text,
  items jsonb,
  total_basic numeric(12,2),
  total_gst numeric(12,2),
  total_amount numeric(12,2),
  status text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists invoice_credit_notes (
  id text primary key,
  user_id text references auth.users(id),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists invoice_payments (
  id text primary key,
  user_id text references auth.users(id),
  customer_id text references customers(id),
  amount numeric(12,2),
  date date,
  type text,
  mode text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists invoice_supplier_payments (
  id text primary key,
  user_id text references auth.users(id),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists invoice_kv (
  key text primary key,
  value text,
  created_at timestamptz default now()
);

create table if not exists chart_of_accounts (
  id text primary key,
  account_code text,
  account_name text,
  account_type text,
  parent_id text references chart_of_accounts(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists journal_entries (
  id text primary key,
  entry_number text,
  date date,
  description text,
  reference text,
  created_by text references auth.users(id),
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists journal_entry_lines (
  id text primary key,
  entry_id text references journal_entries(id),
  account_id text references chart_of_accounts(id),
  debit numeric(12,2),
  credit numeric(12,2),
  narration text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists tax_ledger (
  id text primary key,
  transaction_id text,
  transaction_type text,
  hsn_code text,
  taxable_value numeric(12,2),
  cgst numeric(12,2),
  sgst numeric(12,2),
  igst numeric(12,2),
  date date,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists employees (
  id text primary key,
  employee_code text,
  name text,
  designation text,
  department text,
  salary numeric(12,2),
  join_date date,
  status text,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists attendance (
  id text primary key,
  employee_id text references employees(id),
  date date,
  status text,
  in_time time,
  out_time time,
  created_at timestamptz default now(),
  data jsonb not null
);

create table if not exists payroll (
  id text primary key,
  employee_id text references employees(id),
  month integer,
  year integer,
  basic numeric(12,2),
  allowances numeric(12,2),
  deductions numeric(12,2),
  net_pay numeric(12,2),
  status text,
  created_at timestamptz default now(),
  data jsonb not null
);

-- Migration helpers: add new columns safely if tables already exist
alter table if exists customers add column if not exists pan text;
alter table if exists customers add column if not exists credit_limit numeric(12,2);
alter table if exists customers add column if not exists balance numeric(12,2);
alter table if exists suppliers add column if not exists pan text;
alter table if exists suppliers add column if not exists payment_terms text;
alter table if exists products add column if not exists sku text;
alter table if exists products add column if not exists category text;
alter table if exists products add column if not exists purchase_price numeric(12,2);
alter table if exists products add column if not exists selling_price numeric(12,2);
alter table if exists products add column if not exists tax_rate numeric(5,2);
alter table if exists products add column if not exists reorder_level integer;
alter table if exists company_settings add column if not exists city text;
alter table if exists company_settings add column if not exists pincode text;
alter table if exists company_settings add column if not exists state text;
alter table if exists company_settings add column if not exists state_code text;
alter table if exists company_settings add column if not exists bank_name text;
alter table if exists company_settings add column if not exists account_number text;
alter table if exists company_settings add column if not exists ifsc_code text;
alter table if exists company_settings add column if not exists branch text;
alter table if exists company_settings add column if not exists pan text;

alter table if exists invoices add column if not exists irn_no text;
alter table if exists invoices add column if not exists ack_no text;
alter table if exists invoices add column if not exists ack_date text;
alter table if exists invoices add column if not exists customer_name text;
alter table if exists invoices add column if not exists customer_gstin text;
alter table if exists invoices add column if not exists customer_pan text;
alter table if exists invoices add column if not exists customer_aadhar text;
alter table if exists invoices add column if not exists customer_phone text;
alter table if exists invoices add column if not exists customer_email text;
alter table if exists invoices add column if not exists customer_address text;
alter table if exists invoices add column if not exists customer_city text;
alter table if exists invoices add column if not exists customer_state text;
alter table if exists invoices add column if not exists customer_state_code text;
alter table if exists invoices add column if not exists delivery_address text;
alter table if exists invoices add column if not exists delivery_city text;
alter table if exists invoices add column if not exists delivery_state text;
alter table if exists invoices add column if not exists delivery_state_code text;
alter table if exists invoices add column if not exists delivery_pincode text;
alter table if exists invoices add column if not exists order_no text;
alter table if exists invoices add column if not exists remark text;
alter table if exists invoices add column if not exists subtotal_mrp numeric(12,2) default 0;
alter table if exists invoices add column if not exists total_discount_amount numeric(12,2) default 0;
alter table if exists invoices add column if not exists subtotal_basic numeric(12,2) default 0;
alter table if exists invoices add column if not exists total_cgst numeric(12,2) default 0;
alter table if exists invoices add column if not exists total_sgst numeric(12,2) default 0;
alter table if exists invoices add column if not exists total_igst numeric(12,2) default 0;
alter table if exists invoices add column if not exists freight_charges numeric(12,2) default 0;
alter table if exists invoices add column if not exists freight_gst numeric(12,2) default 0;
alter table if exists invoices add column if not exists round_off numeric(12,2) default 0;
alter table if exists invoices add column if not exists grand_total numeric(12,2) default 0;

alter table if exists invoice_items add column if not exists product_name text;
alter table if exists invoice_items add column if not exists part_no text;
alter table if exists invoice_items add column if not exists mrp_per_unit numeric(12,2);
alter table if exists invoice_items add column if not exists effective_price numeric(12,2);
alter table if exists invoice_items add column if not exists discount_percent numeric(5,2);
alter table if exists invoice_items add column if not exists discount_amount numeric(12,2);
alter table if exists invoice_items add column if not exists basic_rate_per_unit numeric(12,2);
alter table if exists invoice_items add column if not exists basic_amount numeric(12,2);
alter table if exists invoice_items add column if not exists gst_amount numeric(12,2);
alter table if exists invoice_items add column if not exists line_total numeric(12,2);
