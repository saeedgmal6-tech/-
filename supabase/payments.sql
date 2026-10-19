-- Run this in Supabase SQL Editor before enabling paid gift creation.
create table if not exists public.gift_orders (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  gift jsonb not null,
  amount_cents integer not null default 2000 check (amount_cents = 2000),
  currency text not null default 'EGP' check (currency = 'EGP'),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  payer_phone text,
  paymob_intention_id text,
  paymob_order_id text unique,
  paymob_transaction_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists gift_orders_status_created_idx on public.gift_orders(status, created_at desc);
alter table public.gift_orders enable row level security;
-- No public policies: only server-side service-role code may read/write payment orders.
