-- THE TOLL: cancellation visibility fields
-- Run in Supabase SQL Editor (idempotent).

alter table public.profiles
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.profiles
  add column if not exists current_period_end timestamptz;

alter table public.device_links
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.device_links
  add column if not exists current_period_end timestamptz;
