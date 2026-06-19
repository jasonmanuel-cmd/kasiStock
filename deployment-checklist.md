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
VITE_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN
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

## Pilot Payment Path

Manual first:

1. Shop finishes setup.
2. Trial starts automatically.
3. Before trial ends, ask for R99/month.
4. Confirm payment manually.
5. Mark the shop paid:

```powershell
npm run set-plan -w server -- owner@example.com pro paid
```

## Delay

- Do not migrate to Supabase until hosting/persistence requires it.
- Do not add payment gateway until a user is ready to pay manually.
- Do not add WhatsApp API until users copy/send order text.
