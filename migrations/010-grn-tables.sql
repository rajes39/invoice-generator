-- Migration 010: GRN Tables for Purchase Workflow

-- 0. Ensure purchase_orders and purchase_order_items tables exist
create table if not exists public.purchase_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  supplier_id text references public.suppliers(id),
  po_number text,
  date date default current_date,
  status text default 'Pending', -- 'Pending', 'Received', 'Cancelled'
  total_amount numeric(12,2) default 0,
  remarks text,
  created_at timestamptz default now()
);

-- Enable RLS for purchase_orders
alter table public.purchase_orders enable row level security;

do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'purchase_orders' and policyname = 'Users can only access their own purchase orders') then
    create policy "Users can only access their own purchase orders" 
      on public.purchase_orders for all using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.purchase_order_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  po_id uuid references public.purchase_orders(id) on delete cascade,
  product_id text references public.products(id),
  quantity numeric(12,2),
  unit_price numeric(12,2),
  amount numeric(12,2),
  created_at timestamptz default now()
);

-- Enable RLS for purchase_order_items
alter table public.purchase_order_items enable row level security;

do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'purchase_order_items' and policyname = 'Users can only access their own purchase order items') then
    create policy "Users can only access their own purchase order items" 
      on public.purchase_order_items for all using (auth.uid() = user_id);
  end if;
end $$;

-- 1. grn_headers table
create table if not exists public.grn_headers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  grn_no text not null,
  supplier_id text references public.suppliers(id),
  po_id uuid references public.purchase_orders(id),
  date date default current_date,
  warehouse_id text references public.warehouses(id),
  status text default 'Draft', -- 'Draft', 'Confirmed'
  remarks text,
  total_amount numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- Enable RLS for grn_headers
alter table public.grn_headers enable row level security;

do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'grn_headers' and policyname = 'Users can only access their own GRN headers') then
    create policy "Users can only access their own GRN headers" 
      on public.grn_headers for all using (auth.uid() = user_id);
  end if;
end $$;

-- 2. grn_items table
create table if not exists public.grn_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  grn_id uuid references public.grn_headers(id) on delete cascade,
  product_id text references public.products(id),
  ordered_qty numeric(12,2),
  received_qty numeric(12,2),
  unit_rate numeric(12,2),
  line_amount numeric(12,2),
  created_at timestamptz default now()
);

-- Enable RLS for grn_items
alter table public.grn_items enable row level security;

do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'grn_items' and policyname = 'Users can only access their own GRN items') then
    create policy "Users can only access their own GRN items" 
      on public.grn_items for all using (auth.uid() = user_id);
  end if;
end $$;
