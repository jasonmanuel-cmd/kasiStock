# Spaza Shop OS 48-Hour Plan

**Goal:** get a working public demo, a clear paid offer, and first pilot conversations within 48 hours.

## Price

Use this. Do not overthink it.

| Offer | Price |
|---|---:|
| 30-day trial | Free |
| Main plan | R99/month |
| Setup help | R299 once-off |

Keep `R49/month` only as a temporary save offer for price pushback:

```text
R49/month for 3 months, then R99/month.
```

Pitch:

```text
The R99/month shop book for spaza owners. Know what sold, what is running out, what is expiring, and what to reorder.
```

## Ship Only This

- Public app URL
- Demo login
- Signup/login
- Stock book
- Sales ledger
- Dashboard
- Supplier board
- Compliance checklist
- WhatsApp order text generator
- Landing page with pricing
- Manual payment path
- Outreach script

Skip for now:

- WhatsApp Business API
- Payment gateway subscriptions
- Native mobile app
- Barcode scanner
- AI forecasting
- Multi-employee roles
- Complex reports
- Paid ads

## System

```text
Landing page
  -> Start free trial
  -> App signup
  -> Add 10 products
  -> Record 5 sales
  -> See reorder/expiry alerts
  -> Ask for R99/month before trial ends
```

Current app:

```text
React client -> Express API -> SQLite
```

Ponytail decision:

Keep SQLite for the 48-hour pilot if deploying to a VPS or persistent disk. Move to Supabase/Postgres only when public hosting requires it or real users are active.

## 48-Hour Checklist

### Hours 0-6: Make It Sellable

- Freeze the feature set.
- Add/confirm production `.env` support.
- Add landing page copy.
- Add pricing section.
- Add one CTA: `Start Free Trial`.
- Add second CTA: `Get Setup Help on WhatsApp`.

Done when:

- A stranger can understand the offer in 30 seconds.

### Hours 6-18: Make It Deployable

- Pick hosting.
- Set real `JWT_SECRET` and `REFRESH_SECRET`.
- Set production CORS origin.
- Deploy backend.
- Deploy frontend.
- Smoke test:
  - login
  - signup
  - add product
  - record sale
  - stock deducts
  - create WhatsApp order

Done when:

- Public app URL works on mobile.

### Hours 18-26: Add Payment Path

Do manual first.

- Add copy: `After 30 days: R99/month`.
- Add payment/status field only if it is quick.
- Use manual EFT/payment link/WhatsApp confirmation.
- Do not integrate Yoco/PayFast/Ozow yet.

Done when:

- A paying shop has a clear way to pay you.

### Hours 26-34: Create Sales Assets

Make only these:

- 1 WhatsApp pitch
- 1 objection reply
- 1 onboarding checklist
- 3 screenshots

WhatsApp pitch:

```text
Hi, I built a simple shop book for spaza owners. It tracks stock, daily sales, expiry dates, supplier prices, and reorder reminders from your phone.

First 30 days are free. After that it is R99/month.

Do you want me to set up a demo shop for you?
```

Objection reply:

```text
Try it free first. If it does not help you avoid at least one stock mistake, expired item, or missed reorder, do not pay.
```

Onboarding checklist:

```text
1. Create shop account
2. Add 10 common products
3. Set reorder levels
4. Record first sale
5. Check dashboard
6. Save supplier prices
```

Done when:

- You can send the offer without explaining from scratch every time.

### Hours 34-48: Sell It

- Contact 20-50 real prospects.
- Do not start with broad social posting.
- Track replies in a spreadsheet.
- Offer setup help to the first 10 serious shops.
- Record objections word-for-word.

Targets:

| Metric | Target |
|---|---:|
| Prospects contacted | 20-50 |
| Trial accounts | 10 |
| Activated shops | 3 |
| Paid commitment | 1 |

Activated means:

```text
10 products added + 5 sales recorded
```

## Support Rules

- No custom feature work during pilot.
- No personal support for `R49/month`.
- No unpaid in-person setup.
- No paid ads until 3 shops actively use it.
- No payment gateway until someone is ready to pay manually.
- No WhatsApp API until users actually copy/send WhatsApp orders.

## Next Build After First Users

Only after 3 active shops:

1. Trial expiration and payment status.
2. CSV export for stock/sales.
3. Admin list of shops.
4. Supabase/Postgres migration.
5. Payment gateway.
6. WhatsApp Business API.

## Definition Of Done

48 hours is successful if:

- App is public.
- Landing page is public.
- Pricing is visible.
- Demo login works.
- New signup works.
- Product and sale flow works.
- Payment path exists, even if manual.
- 20 prospects contacted.
- 1 shop agrees to trial or pay.

Skipped: payment gateway, WhatsApp API, native app, analytics stack. Add them only after pilot users prove demand.
