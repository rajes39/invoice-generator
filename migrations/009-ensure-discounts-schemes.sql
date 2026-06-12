-- Migration 009: Ensure Discounts, Schemes, and Category Discounts tables exist

-- 1. customer_category_discounts table
create table if not exists public.customer_category_discounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id text references public.customers(id) on delete cascade,
  category text,
  discount_percent numeric(5,2),
  created_at timestamptz default now()
);

-- Enable RLS for customer_category_discounts
alter table public.customer_category_discounts enable row level security;

do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'customer_category_discounts' and policyname = 'Users can only access their own category discounts') then
    create policy "Users can only access their own category discounts" 
      on public.customer_category_discounts for all using (auth.uid() = user_id);
  end if;
end $$;

-- 2. product_schemes table
create table if not exists public.product_schemes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id text references public.products(id) on delete cascade,
  min_qty numeric(12,2),
  scheme_price numeric(12,2),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS for product_schemes
alter table public.product_schemes enable row level security;

do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'product_schemes' and policyname = 'Users can only access their own product schemes') then
    create policy "Users can only access their own product schemes" 
      on public.product_schemes for all using (auth.uid() = user_id);
  end if;
end $$;
