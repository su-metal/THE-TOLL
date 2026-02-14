# THE TOLL Chrome Web Store Submission Notes (Draft)

Last updated: 2026-02-13

Use this document as the source for Chrome Web Store listing and review answers.

## 1. Extension Summary
- Name: THE TOLL
- Category: Productivity / Focus
- One-line summary:
  - "Block distracting sites until you complete your exercise mission on your phone."

## 2. Detailed Description (Draft)
THE TOLL helps reduce distraction by temporarily locking selected websites in Chrome.
To unlock access, users complete an exercise session on their smartphone web app.

Core capabilities:
- Block preset and custom sites.
- Configure lock schedule and grace period.
- Unlock via smartphone exercise completion.
- Optional paid plan for advanced controls and features.
- Subscription and cancellation managed via Stripe.

## 3. Permissions Justification
### `storage`
- Used to store user settings (blocked sites, schedule, rep targets, lock duration, local state).

### `identity`
- Used for Google authentication from the extension popup.

### `host_permissions: <all_urls>`
- Required to detect and enforce lock overlays on user-selected blocked domains across websites.

### `content_scripts` on `<all_urls>`
- Required to render lock UI and pause media on blocked targets.

## 4. Single Purpose Statement
- "THE TOLL enforces user-configured website locks and unlocks them only after exercise completion through linked smartphone verification."

## 5. Privacy Links
- Privacy Policy URL: `https://example.com/privacy`
- Terms of Service URL: `https://example.com/terms`
- Support URL: `https://example.com/support`

Tip:
- Host `docs/PRIVACY_POLICY.md`, `docs/TERMS_OF_SERVICE.md`, and `docs/SUPPORT.md` on a public URL (for example GitHub Pages or project website) and paste final URLs here.

## 6. Data Safety / Disclosure Checklist
- Authentication data processed: Yes (Google/Supabase).
- Billing metadata processed: Yes (Stripe customer and subscription state).
- Sensitive personal data sold: No.
- Data sold to third parties: No.
- Data used for advertising: No.
- Data collection limited to functionality, billing, and operations: Yes.

## 7. Reviewer Test Notes (Draft)
- Test account: `reviewer-test@example.com` (prepare dedicated Google account for review)
- Test steps:
  1. Install extension and open popup.
  2. Log in with Google.
  3. Add/select blocked site and confirm lock overlay appears.
  4. Open smartphone app via QR/session and complete unlock flow.
  5. Confirm locked site unlocks.
  6. (Optional) Open subscription management from popup.
- Known expected console noise:
  - Some website-origin warnings (for example YouTube-side warnings) may appear and are unrelated to extension logic.

## 8. Assets Checklist
- Icon set (16/32/48/128): `READY (confirm final package before upload)`
- Screenshots for store listing: `Prepare at least 3 screenshots (popup settings / lock overlay / smartphone unlock flow)`
- Promotional tile(s): `Optional (prepare if marketing use is planned)`
- Support URL: `https://example.com/support`
- Developer contact email: `support@example.com`

## 9. Pre-Submission Final Checks
- Reload extension and validate current build behavior.
- Ensure no test keys/secrets are exposed in production release package.
- Confirm OAuth consent screen and privacy links are public.
- Confirm billing flow and cancellation flow in Stripe mode matching release.
