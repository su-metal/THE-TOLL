# THE TOLL Billing Verification Log

## Run #1
- Date (UTC): 2026-02-13
- Tester: machinami0924
- Mode: TEST
- Account email: machinami0924@gmail.com

### Event 1: `checkout.session.completed`
- Stripe delivery status: 200 (confirmed in webhook deliveries)
- Event ID: `TODO (copy from Stripe delivery detail)`
- DB profiles status/tier: `active / pro`
- DB device_links status/tier: `N/A (no linked device row)`
- UI result: `PLAN: PRO`
- Notes: Checkout and activation flow is working.

### Event 2: `customer.subscription.updated` (cancel ON)
- Stripe delivery status: 200 (confirmed)
- Event ID: `evt_1T0A1MBiIB8vdrjne4ARxG7l`
- Payload key: `cancel_at_period_end = true`
- DB cancel/current_period_end: `true / 2027-02-12 09:54:05+00`
- UI result: `PLAN: PRO` + `CANCEL SCHEDULED: PRO UNTIL 2027-02-12`
- Notes: Webhook parser updated to read period end from fallback paths.

### Event 3: `customer.subscription.updated` (cancel OFF / resume)
- Stripe delivery status: 200 (confirmed)
- Event ID: `evt_1T0A11BiIB8vdrjnntzLqePk`
- Payload key: `cancel_at_period_end = false`
- DB cancel_at_period_end: `false` at that time (confirmed by payload and behavior)
- UI result: cancel-scheduled line disappeared
- Notes: Toggle ON/OFF in Portal reflects correctly.

### Event 4: `customer.subscription.deleted`
- Stripe delivery status: 200 (confirmed in webhook deliveries)
- Event ID: `TODO (copy Stripe event id from Dashboard delivery)` / Edge log id `e8b0e21d-2768-409e-ae85-e4f6ff872f61`
- DB profiles status/tier: `inactive / free`
- DB device_links status/tier: `N/A (no linked device row)`
- UI result: `PLAN: FREE` (expected after popup refresh)
- Notes: Executed via immediate cancel in Stripe Test mode.

## Follow-ups
- Link extension device to account once, then re-run checks including `device_links` propagation.
- Execute a controlled `customer.subscription.deleted` test in Stripe test mode.
