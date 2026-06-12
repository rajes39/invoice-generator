-- Migration 011: Backup Log Table
create table if not exists public.backup_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  backup_date date not null,
  backup_time timestamptz default now(),
  status text default 'success'
);

-- Enable RLS
alter table public.backup_log enable row level security;

-- Policies
do $$ 
begin
  if not exists (select 1 from pg_policies where tablename = 'backup_log' and policyname = 'Users can only access their own backup logs') then
    create policy "Users can only access their own backup logs"
      on public.backup_log for all using (auth.uid() = user_id);
  end if;
end $$;
