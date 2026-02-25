-- THE TOLL: device_links entitlement guardrails
-- Make profiles the source of truth for subscription/trial state.
-- This prevents stale or buggy client-side upserts from persisting active/pro incorrectly.

alter table public.device_links
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.device_links
  add column if not exists current_period_end timestamptz;

create or replace function public.device_links_apply_profile_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_sub text;
begin
  if new.user_id is null then
    return new;
  end if;

  select
    p.subscription_status,
    p.trial_ends_at,
    p.cancel_at_period_end,
    p.current_period_end
  into v_profile
  from public.profiles p
  where p.id = new.user_id;

  if found then
    v_sub := case
      when lower(coalesce(v_profile.subscription_status, 'inactive')) = 'active' then 'active'
      else 'inactive'
    end;

    new.subscription_status := v_sub;
    new.plan_tier := case when v_sub = 'active' then 'pro' else 'free' end;
    new.trial_ends_at := v_profile.trial_ends_at;
    new.cancel_at_period_end := coalesce(v_profile.cancel_at_period_end, false);
    new.current_period_end := v_profile.current_period_end;
  else
    -- No profile row: normalize to safe defaults so entitlement cannot be escalated by client input.
    new.subscription_status := 'inactive';
    new.plan_tier := 'free';
    new.trial_ends_at := null;
    new.cancel_at_period_end := false;
    new.current_period_end := null;
  end if;

  new.updated_at := coalesce(new.updated_at, now());
  new.last_seen_at := coalesce(new.last_seen_at, now());

  return new;
end;
$$;

drop trigger if exists trg_device_links_apply_profile_entitlement on public.device_links;

create trigger trg_device_links_apply_profile_entitlement
before insert or update on public.device_links
for each row
execute function public.device_links_apply_profile_entitlement();

create or replace function public.sync_device_links_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub text;
begin
  v_sub := case
    when lower(coalesce(new.subscription_status, 'inactive')) = 'active' then 'active'
    else 'inactive'
  end;

  update public.device_links dl
  set
    subscription_status = v_sub,
    plan_tier = case when v_sub = 'active' then 'pro' else 'free' end,
    trial_ends_at = new.trial_ends_at,
    cancel_at_period_end = coalesce(new.cancel_at_period_end, false),
    current_period_end = new.current_period_end,
    updated_at = now()
  where dl.user_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_device_links_entitlement on public.profiles;

create trigger trg_profiles_sync_device_links_entitlement
after insert or update of subscription_status, plan_tier, trial_ends_at, cancel_at_period_end, current_period_end
on public.profiles
for each row
execute function public.sync_device_links_from_profile();

-- Backfill existing device rows from authoritative profile state.
update public.device_links dl
set
  subscription_status = case
    when lower(coalesce(p.subscription_status, 'inactive')) = 'active' then 'active'
    else 'inactive'
  end,
  plan_tier = case
    when lower(coalesce(p.subscription_status, 'inactive')) = 'active' then 'pro'
    else 'free'
  end,
  trial_ends_at = p.trial_ends_at,
  cancel_at_period_end = coalesce(p.cancel_at_period_end, false),
  current_period_end = p.current_period_end,
  updated_at = now()
from public.profiles p
where p.id = dl.user_id;

