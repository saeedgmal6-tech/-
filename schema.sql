-- Lahzetna database schema
-- Run this entire file in Supabase > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default 'حكايتنا لسه مكملة',
  from_name text not null,
  to_name text not null,
  message text not null,
  date date,
  occasion text not null default 'مجرد إني بحبك',
  theme text not null default 'rose' check (theme in ('rose','night','cream','garden')),
  photos jsonb not null default '[]'::jsonb,
  cover text,
  music boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists gifts_slug_idx on public.gifts(slug);
alter table public.gifts enable row level security;

-- Public gifts are readable by anyone who has the unique link.
create policy "Public can read gifts by link"
on public.gifts for select
to anon, authenticated
using (true);

-- Gift creation works without user accounts in this starter.
create policy "Public can create gifts"
on public.gifts for insert
to anon, authenticated
with check (
  length(from_name) between 1 and 60
  and length(to_name) between 1 and 60
  and length(message) between 1 and 1800
  and length(slug) between 6 and 40
);

-- NOTE: For production privacy, add user authentication and owner_id,
-- then replace public read/insert policies with owner-aware policies.
-- The anonymous insert policy means anyone can create a gift; add rate limiting
-- or CAPTCHA before opening this publicly to prevent spam.
