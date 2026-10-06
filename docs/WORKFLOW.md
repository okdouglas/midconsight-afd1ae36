# Branch and deploy workflow

| Branch | Purpose | Cloudflare |
|---|---|---|
| `main` | Production, midconsight.com | Production build and deploy |
| `staging` | Pre-production check | Preview build, own preview URL |
| `feature/*` | One change each | Preview build (optional) |

Flow: feature branch, then merge to `staging`, check the preview URL, then merge `staging` to `main`.

Never commit straight to `main`. Staging shares the production Supabase project for now,
so test with your own account only. Give staging its own Supabase before real customers.

Cloudflare: Worker `midconsight`, Settings, Builds, Branch control: production branch `main`,
non-production branch builds on. Non-production deploy command: `npx wrangler versions upload`.
Add each preview URL to Supabase Auth redirect URLs.
