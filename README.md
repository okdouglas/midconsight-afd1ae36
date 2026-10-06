# MidconSight

Oklahoma oil and gas permit intelligence. A product of Mayberry Advisory.

## Stack
Vite, React, TypeScript, Tailwind, shadcn/ui, Leaflet. Backend on Supabase (Postgres, auth, Edge Functions, pg_cron). Hosted on Cloudflare.

## Run locally
```
npm install
npm run dev
```
The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`.

## Deploy
Cloudflare (Workers with static assets) builds from `main`. Build command `npm run build`, deploy command `npx wrangler deploy`. Config is in `wrangler.jsonc`.

## Backend
`supabase/migrations` holds the schema. `supabase/functions` holds the four Edge Functions. Scheduled jobs read the shared secret from Supabase Vault (name: `cron_shared_secret`).
