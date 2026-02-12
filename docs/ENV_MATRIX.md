# THE TOLL Environment Matrix

Last updated: 2026-02-12

## Rule
- Never commit real secrets to Git.
- Keep this file as a key map + owner/reference.
- Store actual values only in secure vault / Supabase secrets / Stripe dashboard.

## Core Targets
- Supabase Project Ref: `qcnzleiyekbgsiyomwin`
- Smartphone App URL: `https://smartphone-app-pi.vercel.app`

## App Config (Client-side)
| Key | Used By | Location | Value Policy |
|---|---|---|---|
| `SUPABASE_URL` | smartphone app, extension | source code | public |
| `SUPABASE_ANON_KEY` | smartphone app, extension | source code | public (RLS required) |

## Supabase Secrets (Server-side)
| Secret Name | Purpose | Example Format | Source of Truth |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe server API | `sk_test_...` / `sk_live_...` | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | webhook signature verify | `whsec_...` | Stripe Webhook endpoint |
| `STRIPE_PRICE_ID_USD_MONTHLY` | checkout price mapping | `price_...` | Stripe Product/Price |
| `STRIPE_PRICE_ID_USD_YEARLY` | checkout price mapping | `price_...` | Stripe Product/Price |
| `STRIPE_PRICE_ID_JPY_MONTHLY` | checkout price mapping | `price_...` | Stripe Product/Price |
| `STRIPE_PRICE_ID_JPY_YEARLY` | checkout price mapping | `price_...` | Stripe Product/Price |

## Stripe Mode Matrix
| Mode | Secret Key | Price IDs | Webhook Secret |
|---|---|---|---|
| Test | `sk_test_...` | test `price_...` only | test `whsec_...` |
| Live | `sk_live_...` | live `price_...` only | live `whsec_...` |

Do not mix rows across modes.

## OAuth Matrix (Google)
| Item | Value |
|---|---|
| OAuth App Type | Web application |
| Redirect URI | `https://qcnzleiyekbgsiyomwin.supabase.co/auth/v1/callback` |
| Supabase Provider | Authentication > Providers > Google |
| Site URL | `https://smartphone-app-pi.vercel.app` |
| Redirect URLs | `https://smartphone-app-pi.vercel.app/**` |

## Deployment Checklist
1. Set/rotate Supabase secrets.
2. Deploy functions:
   - `create-checkout`
   - `stripe-webhook`
3. Deploy smartphone app.
4. Validate billing end-to-end in Stripe test mode.
5. Validate `profiles.subscription_status` transition.

