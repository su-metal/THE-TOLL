# THE TOLL Support

Last updated: 2026-02-13

This page provides support contact information and common troubleshooting steps for THE TOLL.

## Contact
- Support email: `support@example.com`
- Response time target: within 2 business days

## Before Contacting Support
Please include:
- Account email used in THE TOLL
- Date/time when the issue happened (include UTC if possible)
- Error message text
- Screenshot or screen recording
- Environment details:
  - Chrome version
  - Extension version
  - Whether issue occurred in Test mode or Live mode (for billing)

## FAQ

### Q1. Google login does not complete
- Confirm popup was reloaded from `chrome://extensions`.
- Confirm OAuth redirect settings are correct in Supabase/Google console.
- Try sign-out and sign-in again.

### Q2. Plan status is not updated after billing action
- Wait a short time and reopen popup.
- Verify Stripe webhook delivery status is `200`.
- If needed, retry the event delivery from Stripe dashboard.

### Q3. How can I cancel subscription?
- Open extension popup.
- Click `MANAGE SUBSCRIPTION`.
- Use Stripe Customer Portal to cancel immediately or at period end.

### Q4. Why does it still show PRO after cancellation?
- If cancellation is set at period end, PRO remains active until `current_period_end`.
- Popup may show:
  - `CANCEL SCHEDULED: PRO UNTIL YYYY-MM-DD`

### Q5. How do I clear extension settings?
- Open extension popup and reset settings manually.
- You can also clear extension storage from Chrome extension settings if needed.

## Billing Notes
- Payment processing is handled by Stripe.
- Refund policy follows the Terms of Service.

## Policy Links
- Privacy Policy: `https://example.com/privacy`
- Terms of Service: `https://example.com/terms`

