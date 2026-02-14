# THE TOLL Billing Runbook

Last updated: 2026-02-13

## Scope
Troubleshooting Stripe checkout and subscription status sync in:
- Smartphone app (`smartphone-app`)
- Supabase Edge Functions (`create-checkout`, `stripe-webhook`)
- Supabase `profiles.subscription_status`

## Expected Flow
1. User logs in on smartphone app.
2. User taps `SUBSCRIBE`.
3. `create-checkout` returns Stripe Checkout URL.
4. User completes checkout.
5. Stripe sends webhook (`checkout.session.completed`).
6. `profiles.subscription_status` updates to `active`.

## Quick Checks

### A. SUBSCRIBE button errors immediately
Check popup error text:
- `Invalid API Key provided ...`
  - Cause: wrong `STRIPE_SECRET_KEY` (publishable/mock key used).
  - Fix: set real `sk_test_...` / `sk_live_...`.
- `Missing secret: STRIPE_PRICE_ID_...`
  - Cause: missing price secret.
  - Fix: set all required price secrets.
- `No such price: price_...`
  - Cause: wrong price ID or mode mismatch (test/live).
  - Fix: use correct Stripe mode + matching `price_...`.

### B. Checkout page opens, but state doesn’t become active
1. Verify webhook endpoint exists in Stripe:
   - `https://qcnzleiyekbgsiyomwin.functions.supabase.co/stripe-webhook`
2. Verify webhook events include:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Verify `STRIPE_WEBHOOK_SECRET` is correct (`whsec_...`).
4. Re-deploy webhook function after secret changes.

## Webhook E2E Checklist
Run this in both Stripe Test mode and Live mode before release.

### 1) checkout.session.completed
- Action:
  - Start checkout from app/extension and complete payment.
- Stripe expectation:
  - Event delivery to webhook endpoint is `200`.
- DB expectation:
  - `profiles.subscription_status = active`
  - `profiles.plan_tier = pro`
  - `device_links.subscription_status = active` (if linked)
- UI expectation:
  - Extension popup shows `PLAN: PRO`.

### 2) customer.subscription.updated (cancel at period end ON)
- Action:
  - Open Customer Portal and select cancel at period end.
- Stripe expectation:
  - `customer.subscription.updated` is delivered as `200`.
  - Payload contains `cancel_at_period_end = true`.
- DB expectation:
  - `profiles.cancel_at_period_end = true`
  - `profiles.current_period_end IS NOT NULL`
  - `profiles.subscription_status = active` (still PRO until period end)
- UI expectation:
  - Extension popup shows:
    - `PLAN: PRO`
    - `CANCEL SCHEDULED: PRO UNTIL YYYY-MM-DD`

### 3) customer.subscription.updated (cancel OFF / resume)
- Action:
  - Resume subscription from Customer Portal.
- Stripe expectation:
  - `customer.subscription.updated` delivered as `200`.
  - Payload contains `cancel_at_period_end = false`.
- DB expectation:
  - `profiles.cancel_at_period_end = false`
- UI expectation:
  - Cancel-scheduled line disappears from popup.

### 4) customer.subscription.deleted (period ended)
- Action:
  - Wait period end in test setup, or use test clock / short cycle plan.
- Stripe expectation:
  - `customer.subscription.deleted` delivered as `200`.
- DB expectation:
  - `profiles.subscription_status = inactive`
  - `profiles.plan_tier = free`
  - `profiles.cancel_at_period_end = false`
- UI expectation:
  - Extension popup shows `PLAN: FREE`.

### Fast Path (for test environments)
If you need to validate `customer.subscription.deleted` immediately:
- In Stripe Test mode, cancel subscription immediately (not at period end).
- Confirm endpoint delivery shows `customer.subscription.deleted` with HTTP `200`.
- Re-check DB and popup right away.

## Required Secrets
Set in Supabase project:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_USD_MONTHLY`
- `STRIPE_PRICE_ID_USD_YEARLY`
- `STRIPE_PRICE_ID_JPY_MONTHLY`
- `STRIPE_PRICE_ID_JPY_YEARLY`

## Deployment Commands
Run from project root (`F:\App_dev\THE TOLL`):

```powershell
supabase link --project-ref qcnzleiyekbgsiyomwin
supabase functions deploy create-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

## Operational Notes
- `Listening on http://localhost:9999/` in Edge logs is normal boot output.
- Actionable data is request result lines (`POST ... 200/400/401/500`).
- After smartphone JS updates, run app reset (`System Hard Reset`) to avoid stale cache.

## Validation SQL
Use SQL Editor:

```sql
select
  u.email,
  p.subscription_status,
  p.plan_tier,
  p.cancel_at_period_end,
  p.current_period_end,
  p.updated_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

```sql
select
  dl.device_id,
  u.email,
  dl.subscription_status,
  dl.plan_tier,
  dl.cancel_at_period_end,
  dl.current_period_end,
  dl.updated_at
from public.device_links dl
join auth.users u on u.id = dl.user_id
order by dl.updated_at desc;
```

## Incident Template
When reporting a billing incident, include:
- Timestamp (local + UTC if possible)
- Smartphone popup error text
- Edge Function status line (`create-checkout` / `stripe-webhook`)
- Whether Stripe test mode or live mode was used
- Which account email was tested

## Verification Log Template
Copy and fill this for each run:

```text
[Billing Verification]
Date (UTC):
Tester:
Mode: TEST / LIVE
Account email:

Event 1: checkout.session.completed
- Stripe delivery status:
- Event ID:
- DB profiles status/tier:
- DB device_links status/tier:
- UI result:
- Notes:

Event 2: customer.subscription.updated (cancel ON)
- Stripe delivery status:
- Event ID:
- cancel_at_period_end in payload:
- DB cancel_at_period_end/current_period_end:
- UI cancel-scheduled line:
- Notes:

Event 3: customer.subscription.updated (cancel OFF)
- Stripe delivery status:
- Event ID:
- cancel_at_period_end in payload:
- DB cancel_at_period_end:
- UI result:
- Notes:

Event 4: customer.subscription.deleted
- Stripe delivery status:
- Event ID:
- DB profiles status/tier:
- DB device_links status/tier:
- UI result:
- Notes:
```
