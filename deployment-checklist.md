# Deployment Checklist

Use this order. Do not add services until this works.

## Required Env

Backend:

```text
NODE_ENV=production
PORT=4100
CLIENT_ORIGIN=https://YOUR-FRONTEND-DOMAIN
JWT_SECRET=LONG_RANDOM_SECRET
REFRESH_SECRET=ANOTHER_LONG_RANDOM_SECRET
DATABASE_PATH=./data/spaza-os.sqlite
```

Frontend:

For Vercel frontend, set:

```text
VITE_API_BASE_URL=https://spaza-osserver-production.up.railway.app
VITE_SQUARE_PAYMENT_LINK_URL=https://square.link/u/dqL35u4R
VITE_SQUARE_SETUP_LINK_URL=https://square.link/u/KzY6ujvy
```

No separate frontend env is needed if the Express server serves `client/dist`.

## Fastest Deploy

Use one VPS or Railway-style service with persistent disk.

1. Clone/upload `spaza-shop-os-full`.
2. Run `npm install`.
3. Set backend env above.
4. Run `npm run build`.
5. Start with `npm run start -w server`.
6. Point the public domain at port `4100`.

Docker path:

```powershell
docker build -t spaza-shop-os .
docker run -p 4100:4100 --env-file server/.env spaza-shop-os
```

Local note:

Docker CLI is installed, but Docker Desktop must be running before `docker build` works.

Railway note:

Railway CLI is installed, but this machine needs `railway login` before deploy.

Current Railway URLs:

```text
Server/API: https://spaza-osserver-production.up.railway.app
Client:     https://spaza-osclient-production.up.railway.app
```

Both currently return `200`; server `/api/auth/login` works with the demo account.

CORS:

`CLIENT_ORIGIN` can be one origin or a comma-separated list:

```text
CLIENT_ORIGIN=https://kasistock.vercel.app,https://spaza-osclient-production.up.railway.app
```

## Smoke Test

```powershell
Invoke-RestMethod https://YOUR-API-DOMAIN/health
```

Then test in browser:

- Open app.
- Create a shop.
- Add a product.
- Record a sale.
- Confirm stock deducts.
- Generate WhatsApp order text.

## Square Payment Path

Use Square hosted payment links first. It avoids storing card data in KasiStock.

1. In Square Dashboard, create a recurring payment link for `KasiStock Pro - R99/month`.
2. Add a required custom field called `KasiStock account email`.
3. Copy the payment link.
4. In Vercel, set `VITE_SQUARE_PAYMENT_LINK_URL` to that link and redeploy.
5. Customer signs up in KasiStock, then pays from the Billing tab.
6. Confirm payment in Square.
7. In the KasiStock admin tab, set the shop to `pro` and `paid`.

Current links:

```text
Monthly: https://square.link/u/dqL35u4R
Assisted setup: https://square.link/u/KzY6ujvy
```

CLI fallback:

```powershell
npm run set-plan -w server -- owner@example.com pro paid
```

## Delay

- Do not migrate to Supabase until hosting/persistence requires it.
- Do not add Square API/webhooks until manual Square confirmation becomes too slow.
- Do not add WhatsApp API until users copy/send order text.
