# KasiStock

Full-stack MVP for a South African spaza shop stock and sales book.

## What Is Built

- Owner login and shop registration
- Trial/payment status on shop accounts
- Master admin account for shop/payment/activity overview
- JWT access auth plus httpOnly refresh-session cookie
- SQLite database using Node 24 built-in `node:sqlite`
- Dashboard metrics: daily revenue, low stock, expiry risk, compliance score, inventory value
- Product stock book with reorder levels, margin tracking, expiry dates, categories, and suppliers
- Sales ledger that deducts inventory in a transaction
- Supplier price comparison board
- Compliance checklist for permits, food safety, pricing, and invoice traceability
- WhatsApp order message generator and order history
- Responsive React interface for desktop and mobile
- API health and readiness endpoints
- POPIA-style privacy and terms pages

## Brand

Name: **KasiStock**

Slogan: **Know your stock. Grow your shop.**

## Run It

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Demo login:

```text
Email: owner@spaza.local
Password: spaza12345
```

Local admin login:

```text
Email: admin@kasistock.local
Password: admin12345
```

Production admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

API:

```text
http://127.0.0.1:4100
```

Live Railway:

```text
Server/API: https://spaza-osserver-production.up.railway.app
Client:     https://spaza-osclient-production.up.railway.app
```

## Production-Style Run

This builds the React app and serves it from the Express server:

```powershell
npm install
npm run build
npm run start -w server
```

Open:

```text
http://127.0.0.1:4100
```

## Verify

```powershell
npm run check -w server
npm run build -w client
npm audit --audit-level=moderate
```

## Pilot Offer

```text
30 days free.
Then R99/month.
R299 once-off assisted setup.
```

Track prospects in:

```text
prospect-tracker.csv
```

## Important Files

- `server/src/index.js`: Express app, middleware, health checks, error handler
- `server/src/db.js`: SQLite schema, migrations, seed data
- `server/src/routes.js`: Authenticated product, sales, supplier, compliance, order APIs
- `server/src/auth.js`: JWT and refresh-cookie auth
- `client/src/main.jsx`: React app, screens, forms, dashboard logic
- `client/src/lib/api.js`: Authenticated fetch client
- `client/src/styles.css`: Responsive app styling
- `client/public/privacy.html`: POPIA-style privacy page
- `client/public/terms.html`: Pilot terms page

## Next Production Steps

- Replace dev JWT secrets in environment variables.
- Add password reset and email/phone verification.
- Add barcode scan support for stock items.
- Add CSV/PDF export for daily sales and supplier reorder lists.
- Add WhatsApp Business Cloud API integration once a Meta app and phone number are available.
- Move SQLite to hosted Postgres/Supabase when deploying for multiple shops.
- Add POPIA-facing privacy controls: consent, export, deletion, and retention settings.
