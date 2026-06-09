-- Migration to add customer_discounts and customer_net_rates tables

-- 1. customer_discounts table
create table if not exists public.customer_discounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id text references public.customers(id) on delete cascade,
  type text check (type in ('BRAND', 'PRODUCT')),
  target text, -- brand name or product_id
  discount_percent numeric(5,2),
  created_at timestamptz default now()
);

-- Enable RLS for customer_discounts
alter table public.customer_discounts enable row level security;

create policy "Users can only access their own customer discounts" 
  on public.customer_discounts for all using (auth.uid() = user_id);

-- 2. customer_net_rates table
create table if not exists public.customer_net_rates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id text references public.customers(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  net_rate numeric(12,2),
  created_at timestamptz default now()
);

-- Enable RLS for customer_net_rates
alter table public.customer_net_rates enable row level security;

create policy "Users can only access their own customer net rates" 
  on public.customer_net_rates for all using (auth.uid() = user_id);
