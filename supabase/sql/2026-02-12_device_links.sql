-- THE TOLL: device linkage for extension entitlement
-- Run in Supabase SQL Editor (idempotent).

create table if not exists public.device_links (
  device_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_status text not null default 'inactive',
  plan_tier text not null default 'free',
  trial_ends_at timestamptz,
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_links_user_id_idx
  on public.device_links(user_id);

alter table public.device_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_links'
      and policyname = 'device_links_select_public'
  ) then
    create policy device_links_select_public
      on public.device_links
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_links'
      and policyname = 'device_links_insert_own'
  ) then
    create policy device_links_insert_own
      on public.device_links
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_links'
      and policyname = 'device_links_update_own'
  ) then
    create policy device_links_update_own
      on public.device_links
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
