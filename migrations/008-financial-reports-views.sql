-- Migration 008: Financial Reporting Views
-- Purpose: Aggregate journal entries into standard financial statements

-- 1. TRIAL BALANCE VIEW
-- Provides total debits and credits for each account
create or replace view public.view_trial_balance as
select 
  coa.user_id,
  coa.id as account_id,
  coa.account_name,
  coa.account_type,
  coa.account_code,
  sum(jel.debit) as total_debit,
  sum(jel.credit) as total_credit,
  (sum(jel.debit) - sum(jel.credit)) as net_balance
from 
  public.chart_of_accounts coa
left join 
  public.journal_entry_lines jel on coa.id = jel.account_id
group by 
  coa.user_id, coa.id, coa.account_name, coa.account_type, coa.account_code;

-- 2. PROFIT & LOSS VIEW
-- Focuses on Revenue and Expense accounts
create or replace view public.view_profit_and_loss as
select 
  user_id,
  account_type,
  account_name,
  sum(credit) - sum(debit) as balance -- Revenue - Expense
from 
  public.chart_of_accounts coa
join 
  public.journal_entry_lines jel on coa.id = jel.account_id
where 
  coa.account_type in ('Revenue', 'Expense', 'Income')
group by 
  user_id, account_type, account_name;

-- 3. BALANCE SHEET VIEW
-- Focuses on Asset, Liability, and Equity accounts
create or replace view public.view_balance_sheet as
select 
  user_id,
  account_type,
  account_name,
  case 
    when account_type = 'Asset' then sum(debit) - sum(credit)
    else sum(credit) - sum(debit)
  end as balance
from 
  public.chart_of_accounts coa
join 
  public.journal_entry_lines jel on coa.id = jel.account_id
where 
  coa.account_type in ('Asset', 'Liability', 'Equity')
group by 
  user_id, account_type, account_name;

-- Enable RLS for views (Supabase handles this via the underlying table RLS usually, but good to be explicit where possible)
-- Note: Views in Postgres don't have their own RLS, they inherit from underlying tables.
