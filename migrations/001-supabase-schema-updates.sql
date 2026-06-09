-- Migration: Add GST-aware invoice tables, discount settings, brands/categories, net rate support

create table if not exists routes (
  id text primary key,
  name text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  data jsonb not null
);

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

create table if not exists purchase_invoices (
  id text primary key,
  user_id text references auth.users(id),
  bill_number text,
  supplier_id text,
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

create table if not exists invoice_items (
  id text primary key,
  invoice_id text references invoices(id),
  product_id text references products(id),
  qty integer,
  mrp_per_unit numeric(12,2),
  effective_price numeric(12,2),
  discount_percent numeric(5,2),
  is_net_rate boolean default false,
  gst_rate numeric(5,2),
  basic_rate_per_unit numeric(12,2),
  basic_amount numeric(12,2),
  gst_amount numeric(12,2),
  line_total numeric(12,2),
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

alter table customers
  add column if not exists city text,
  add column if not exists state_code text,
  add column if not exists route_id text,
  add column if not exists opening_balance numeric(12,2),
  add column if not exists balance_type text;

alter table suppliers
  add column if not exists contact_person text,
  add column if not exists city text,
  add column if not exists state_code text,
  add column if not exists opening_balance numeric(12,2),
  add column if not exists balance_type text;

alter table products
  add column if not exists brand_id text,
  add column if not exists category_id text,
  add column if not exists net_rate_product boolean default false;

alter table invoices
  add column if not exists invoice_number text,
  add column if not exists route_id text,
  add column if not exists invoice_date date,
  add column if not exists due_date date,
  add column if not exists subtotal_basic numeric(12,2),
  add column if not exists total_discount_amount numeric(12,2),
  add column if not exists total_cgst numeric(12,2),
  add column if not exists total_sgst numeric(12,2),
  add column if not exists total_igst numeric(12,2),
  add column if not exists grand_total numeric(12,2),
  add column if not exists is_interstate boolean default false,
  add column if not exists notes text;
