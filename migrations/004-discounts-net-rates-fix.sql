-- Migration to ensure customer_discounts and customer_net_rates tables match exactly

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
do $$ 
begin
  execute 'alter table public.customer_discounts enable row level security';
exception when others then 
  null;
end $$;

-- Create policy
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'customer_discounts' and policyname = 'Users can only access their own customer discounts') then
    create policy "Users can only access their own customer discounts" 
      on public.customer_discounts for all using (auth.uid() = user_id);
  end if;
end $$;

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
do $$ 
begin
  execute 'alter table public.customer_net_rates enable row level security';
exception when others then 
  null;
end $$;

-- Create policy
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'customer_net_rates' and policyname = 'Users can only access their own customer net rates') then
    create policy "Users can only access their own customer net rates" 
      on public.customer_net_rates for all using (auth.uid() = user_id);
  end if;
end $$;
