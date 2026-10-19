-- Lahzetna admin analytics migration
-- Run this once in Supabase SQL Editor after deploying the admin dashboard.
create extension if not exists pgcrypto;

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  constraint site_visits_path_length check (char_length(path) between 1 and 500),
  constraint site_visits_referrer_length check (char_length(referrer) <= 1000)
);

create index if not exists site_visits_created_at_idx on public.site_visits(created_at desc);
create index if not exists site_visits_path_idx on public.site_visits(path);

alter table public.site_visits enable row level security;
-- No public SELECT/UPDATE/DELETE policies: only the server-side service key can read analytics.
-- Tracking writes are performed server-side so the service-role key never reaches the browser.
