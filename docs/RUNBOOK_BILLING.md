# THE TOLL Billing Runbook

Last updated: 2026-02-12

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
   - `customer.subscription.deleted`
3. Verify `STRIPE_WEBHOOK_SECRET` is correct (`whsec_...`).
4. Re-deploy webhook function after secret changes.

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
select u.email, p.subscription_status, p.updated_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

## Incident Template
When reporting a billing incident, include:
- Timestamp (local + UTC if possible)
- Smartphone popup error text
- Edge Function status line (`create-checkout` / `stripe-webhook`)
- Whether Stripe test mode or live mode was used
- Which account email was tested

