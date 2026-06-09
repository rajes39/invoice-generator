-- Migration: Add missing columns to invoice_payments table

alter table if exists public.invoice_payments 
  add column if not exists customer_id text references public.customers(id),
  add column if not exists amount numeric(12,2),
  add column if not exists date date,
  add column if not exists type text,
  add column if not exists mode text;

-- Ensure RLS is enabled if needed (not requested but good practice)
-- alter table public.invoice_payments enable row level security;
