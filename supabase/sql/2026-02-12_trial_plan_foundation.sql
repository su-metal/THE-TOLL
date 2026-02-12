-- THE TOLL: Trial + Plan foundation
-- Run in Supabase SQL Editor (idempotent).

alter table public.profiles
  add column if not exists plan_tier text not null default 'free';

alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

alter table public.profiles
  add column if not exists trial_used boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_plan_tier_check'
  ) then
    alter table public.profiles
      add constraint profiles_plan_tier_check
      check (plan_tier in ('free', 'pro'));
  end if;
end $$;

update public.profiles
set plan_tier = case
  when subscription_status = 'active' then 'pro'
  else 'free'
end
where plan_tier is null
   or plan_tier not in ('free', 'pro');

create or replace function public.is_trial_active(p_trial_ends_at timestamptz)
returns boolean
language sql
stable
as $$
  select p_trial_ends_at is not null and p_trial_ends_at > now();
$$;

create or replace function public.is_pro_entitled(
  p_subscription_status text,
  p_trial_ends_at timestamptz
)
returns boolean
language sql
stable
as $$
  select coalesce(lower(p_subscription_status), 'inactive') = 'active'
      or public.is_trial_active(p_trial_ends_at);
$$;
