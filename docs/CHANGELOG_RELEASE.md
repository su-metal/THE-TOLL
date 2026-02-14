# THE TOLL Release Changelog

Last updated: 2026-02-13

## Summary
- Smartphone app moved from local/ngrok workflow to fixed hosted URL (`https://smartphone-app-pi.vercel.app`).
- Supabase security tightened for `squat_sessions` and `unlock_session`.
- Billing flow stabilized (Stripe + Supabase Edge Functions).
- Auth flow switched to Google OAuth-first on smartphone app.

## Changes Completed

### 1) Hosting / Runtime
- Smartphone web app deployed on Vercel.
- Chrome extension smartphone URL updated to Vercel URL.

### 2) Supabase Security Hardening
- Enabled RLS on `public.squat_sessions`.
- Removed wide-open policy (`Allow all operations`).
- Added minimal policies for:
  - `SELECT` (anon/authenticated)
  - `INSERT` limited to locked-session creation pattern
  - `UPDATE` limited to locked-state maintenance
- Reduced `unlock_session(text)` execution scope:
  - Revoked from `PUBLIC` and `anon`
  - Granted to `authenticated`
- Hardened function with `search_path=public`.

### 3) Smartphone App: Membership / UX
- Membership status handling stabilized with retry logic.
- Added explicit error surfaces for checkout failures.
- Added top-page onboarding text clarifying free account vs paid usage.
- Default language set to English; Japanese available with `?lang=ja`.

### 4) Billing Flow
- `create-checkout` now accepts `plan` and `currency`.
- Added `create-checkout-device` for linked-device checkout flow from extension.
- Dynamic secret key mapping added:
  - `STRIPE_PRICE_ID_USD_MONTHLY`
  - `STRIPE_PRICE_ID_USD_YEARLY`
  - `STRIPE_PRICE_ID_JPY_MONTHLY`
  - `STRIPE_PRICE_ID_JPY_YEARLY`
- Stripe SDK/runtime compatibility fixed for Supabase Edge Runtime.
- Checkout return URLs changed to avoid 404:
  - `/?checkout=success`
  - `/?checkout=cancel`
- Webhook entitlement sync extended:
  - `profiles` + `device_links` updated together
  - `cancel_at_period_end` and `current_period_end` persisted
  - popup shows `CANCEL SCHEDULED: PRO UNTIL YYYY-MM-DD`

### 5) Auth Flow
- Email/password auth UI removed from smartphone top page.
- Google OAuth login introduced (`CONTINUE WITH GOOGLE`).

### 6) Subscription Management
- Added `create-customer-portal` function support for explicit `return_url`.
- Added extension popup `MANAGE SUBSCRIPTION` action (PRO + logged-in users).
- Verified cancellation states:
  - cancel at period end keeps `PLAN: PRO` until period end
  - immediate cancel updates to `PLAN: FREE`

## Open Items (Next)
- Add success/cancel checkout UI on return.
- Enforce paid-user check in unlock path server-side (DB function/RPC).
- Finalize store submission details (public URLs, contact info, screenshots).
