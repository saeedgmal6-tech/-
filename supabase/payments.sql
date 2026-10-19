-- Manual Orange Cash payment review for Lahzetna.
-- Run this in Supabase SQL Editor after the existing payments.sql migration.
create extension if not exists pgcrypto;

create table if not exists public.gift_orders (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  gift jsonb not null,
  amount_cents integer not null default 2000 check (amount_cents = 2000),
  currency text not null default 'EGP' check (currency = 'EGP'),
  status text not null default 'awaiting_review'
    check (status in ('awaiting_review','approved','rejected','pending','paid','failed')),
  payer_phone text,
  payment_reference text,
  paymob_intention_id text,
  paymob_order_id text unique,
  paymob_transaction_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text
);

alter table public.gift_orders add column if not exists payment_reference text;
alter table public.gift_orders add column if not exists reviewed_at timestamptz;
alter table public.gift_orders add column if not exists rejection_reason text;
alter table public.gift_orders drop constraint if exists gift_orders_status_check;
alter table public.gift_orders add constraint gift_orders_status_check
  check (status in ('awaiting_review','approved','rejected','pending','paid','failed'));

create index if not exists gift_orders_status_created_idx on public.gift_orders(status, created_at desc);
alter table public.gift_orders enable row level security;
-- No public policies: only server-side service-role code may read/write payment orders.
