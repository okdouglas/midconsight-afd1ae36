# MidconSight — Lifecycle Marketing & Free/Paid Strategy
**Prepared as a senior lifecycle-marketing audit, pre-Lovable handoff**
**Tooling: Resend + Supabase Edge Functions (no external CRM/marketing platform)**

---

## 0. Architecture decision — why Resend + your own Edge Functions

HubSpot's real automation (branching, multi-step journeys) only exists in
Marketing Hub Professional: $890/month plus a mandatory $3,000 onboarding
fee. Not a fit for "low-cost, low-overhead."

The better fit, and the one this doc now builds around:

- **No external CRM.** MidconSight's own Companies and Deals tabs already
  are the CRM. Syncing contacts to a second CRM would just be a second
  system to keep consistent with the first — pure overhead, no benefit.
- **Resend** as the email layer — for two reasons at once:
  1. It's already the top recommended custom SMTP provider in Supabase's own
     docs, with an official one-click integration. You need this regardless
     of the marketing plan: Supabase's default email sending is capped at
     2/hour and isn't meant for production, so even signup confirmation
     emails need a real provider.
  2. Free tier is 3,000 emails/month, permanent, no time limit. At your
     stage that comfortably covers auth emails + lifecycle triggers +
     the weekly digest.
- **The journey/branching logic lives in your own Supabase Edge Functions**
  — the same architecture you already have working for the Monday ITD
  auto-import (a scheduled function that checks a condition and acts). A
  trigger email is the identical pattern: check a condition in the
  `profiles`/`permits`/`deals` tables, call Resend's API if it's met. No
  new platform, no new dashboard, nothing to learn that isn't already
  in the codebase.
- **One vendor total**, not two — Resend replaces both Supabase's default
  auth email *and* becomes the lifecycle/marketing send layer.

If you ever outgrow this (need a visual journey builder a non-technical
teammate can edit without touching code), Loops.so is the natural next
step — it's purpose-built for exactly this SaaS lifecycle pattern. Not
needed today.

---

## 1. Free vs. Paid — feature gate definition

Based on what you specified, mapped to the actual tabs in the app:

| Tab | Free | Paid |
|---|---|---|
| Dashboard (KPIs, new-this-week map) | ✅ | ✅ |
| Map (browse permits) | ✅ view-only | ✅ full filters + CSV/Excel export |
| Companies (CRM) | ❌ | ✅ |
| Lead Research (Research Desk) | ❌ | ✅ |
| Deals pipeline | ❌ | ✅ |
| Product Catalog | ❌ | ✅ |
| Data import (manual + auto ITD) | ❌ | ✅ |

Open question for you: should Free see **all** permits or a delayed/limited
window (e.g. 30-day-old data, or last 10 permits)? Giving free users the full
live feed removes a natural upgrade trigger ("see the other 40 permits from
this week, upgrade"). I'd recommend a limit — it's also a cleaner story for
the SEO plan in Section 5.

---

## 2. Phase 0 — data model (build this regardless of email tool choice)

New `profiles` table (Supabase), one row per user, created on signup via a
trigger:

- `plan` — `'free' | 'paid'`, default `'free'`
- `trial_ends_at` — nullable timestamp, for a future trial if you want one
- `stripe_customer_id`, `stripe_subscription_id` — nullable, filled in once
  Stripe is built
- `marketing_consent` — boolean, captured at signup (see Section 4 on the
  signup form)
- `company_name`, `full_name` — currently not captured at all; needed for
  any usable lead record
- `activated_at` — nullable timestamp, set the first time a user views a
  permit (your real "aha moment" event)
- `paywall_hits` — integer, default 0; incremented each time a free user
  clicks into a gated tab (drives trigger #5 below)
- `last_digest_sent_at` — nullable timestamp, prevents double-sending the
  weekly digest if the cron fires more than once

This table is the single source of truth your Edge Functions read from to
decide which emails to fire. No external sync target — Resend just needs
an email address and a template at send time, not a stored contact record.

---

## 3. Trigger inventory

Each row = one behavioral event → what checks it → what Resend sends.
Everything in the "Mechanism" column is a Supabase Edge Function you
(or I) write once; no external workflow builder involved.

| # | Trigger event | Mechanism | Resend action | Goal |
|---|---|---|---|---|
| 1 | Landing page visit (no signup) | Analytics script only (Section 4) — no email possible pre-signup | — | Funnel visibility, retargeting audience later |
| 2 | Newsletter/waitlist signup (new — see 4.1) | Frontend form → Edge Function → insert into `subscribers` table | Welcome email + weekly "what's new" digest | Warm leads before they're ready to sign up |
| 3 | Account created (free signup) | Supabase `auth` trigger → Edge Function, creates `profiles` row | Welcome email: what free unlocks, 1 clear CTA to view permits | Get to first activation fast |
| 4 | First permit viewed (`activated_at` set) | Frontend event → Edge Function sets `activated_at` | "You found your first lead — here's what paid unlocks" (delay 1 hour) | Convert activation into paywall curiosity |
| 5 | Paywall hit (clicked Companies/Deals/Products/Research while on free plan) | Frontend event → Edge Function increments `paywall_hits` | 1st–2nd hit: log only, no email. 3rd hit within 7 days: "You keep trying to do X — here's paid" | Trigger on *intent*, not just time |
| 6 | 7 days on free plan, never hit a paywall | Daily cron Edge Function (same pattern as ITD import), queries `profiles` | Educational nudge: "3 things paid users do with this data" | Re-engage before silent churn |
| 7 | Upgrade started (Stripe Checkout session created) | Stripe webhook → Edge Function | none (transactional, not lifecycle) | — |
| 8 | Payment succeeded | Stripe webhook → Edge Function sets `plan = paid` | Paid welcome/onboarding sequence (3 emails over 2 weeks — see 3.1) | Fast time-to-value on paid features |
| 9 | Payment failed / card declined | Stripe webhook → Edge Function | Dunning email immediately, follow-up at 3 days | Recover revenue before involuntary churn |
| 10 | Subscription canceled | Stripe webhook → Edge Function sets `plan = free` | Exit survey (1 question) + winback offer at 30 days | Learn why, recover if possible |
| 11 | Paid but inactive 14+ days | Daily cron Edge Function, checks last login | "Here's what's new since you last logged in" | Reduce paid churn |
| 12 | Weekly permit digest (all active users) | Cron Edge Function, Monday after ITD auto-import, checks `last_digest_sent_at` | "X new permits in your area this week" (free: teaser count only, paid: full breakdown) | Recurring re-engagement hook, reinforces both tiers |

### 3.1 Paid onboarding sequence (detail on trigger #8)

This is the one sequence worth hand-crafting rather than leaving generic,
since it's your highest-leverage moment:

- **Immediately:** Receipt + "you're in" + direct link to Companies tab
  (skip the dashboard, go straight to the feature they just paid for)
- **Day 2:** "Set up your first deal" — short how-to, tied to the Deals tab
- **Day 7:** "Import your first dataset" if they haven't yet (conditional —
  check `datasets` table via the Edge Function before sending)

Mechanically, each of these is a row in a small `scheduled_emails` table
(user_id, send_after, template, sent boolean) that trigger #8 inserts into,
and a daily cron function that sends anything due and marks it sent. Simple
queue, no external tool.

---

## 4. Concrete gaps found in the current site

1. **No lead capture above the signup wall.** The landing page has no
   newsletter/waitlist form — every visitor who isn't ready to create an
   account today is lost with no way back. This is trigger #2 above and
   should be the first thing added; it's a single form + one Edge Function.
2. **Signup form only captures email + password.** No name, no company, no
   marketing consent checkbox. A record with no name and no company is hard
   to personalize email around. Needs 2 more fields minimum.
3. **No analytics or tracking script installed anywhere** — not GA4, not
   Plausible, nothing. Right now you have no visibility into landing page
   conversion rate, drop-off, or traffic sources. This should land before
   the SEO push in Section 5, or you won't be able to tell if it's working.
   (Recommend a lightweight, privacy-respecting option like Plausible or
   Umami over GA4 — consistent with the low-overhead theme, and neither
   requires a cookie consent banner in most jurisdictions.)
4. **No consent checkbox** on signup — worth adding alongside the marketing
   consent field for compliance (CAN-SPAM requires it for marketing email
   in the US; GDPR if you ever get EU signups).

---

## 5. SEO strategy — the differentiated angle

Generic SaaS SEO advice doesn't apply well here because you have something
most competitors don't: **proprietary, structured permit data updated
weekly.** That's a real programmatic SEO asset, not just a blog.

- **Programmatic county pages:** auto-generate a public (no-login) page per
  Oklahoma county — `/permits/grady-county-ok` — showing recent permit
  activity, top operators, and a teaser of the map. This is genuinely useful
  content search engines reward (real, current, local data), it's a natural
  page-per-search-term structure ("grady county drilling permits"), and it
  doubles as your free-tier limited view from Section 1 — the same gated
  data becomes SEO surface area instead of only living behind login.
- **Weekly "new permits" digest as a public blog post**, auto-published from
  the same Monday ITD auto-import data — near-zero marginal effort since
  the data pipeline already exists, and it's fresh content weekly (a real
  ranking signal) without anyone writing anything by hand.
- **Performance is currently a real SEO liability**: the production JS
  bundle is 1.4MB, flagged by Vite's own build warning. Core Web Vitals
  affect ranking. Worth a code-splitting pass before or shortly after
  launch — I can do this separately if you want.
- **Basics not yet in place:** no `sitemap.xml`, no `robots.txt` beyond the
  Lovable default, no structured data (Organization/SoftwareApplication
  schema.org markup) on the landing page. All small, all worth doing before
  the content strategy above, since they're prerequisites for any of it to
  index well.

---

## 6. Suggested build order (relative to the Lovable push)

1. **Before shipping:** `profiles` table + signup form fields (name,
   company, consent) — this is schema, low risk, and everything else
   depends on it.
2. **Before shipping:** Resend account + Supabase SMTP integration —
   replaces the rate-limited default, needed for even basic auth emails.
3. **Before shipping:** newsletter/waitlist capture on the landing page —
   highest ROI, smallest lift, stops losing visitors today.
4. **After Stripe is built (next session):** triggers #7–11, since they're
   literally Stripe webhook events.
5. **Parallel, anytime:** analytics script + sitemap/robots/schema markup —
   independent of everything else.
6. **Once you have real traffic:** county pages + weekly digest blog —
   these want real usage data behind them to be worth the polish.

---

## 7. What I'd need from you to build Phase 0 now

- Confirm the free-tier permit limit (full feed vs. delayed/capped — see
  Section 1)
- A Resend account (free to create) so I can walk you through connecting
  it to Supabase — this needs to happen in your Supabase dashboard, I can't
  do it from here, but I'll give you the exact steps
- A domain (or subdomain) you're willing to send email from, for Resend's
  domain verification (SPF/DKIM records) — sending from a verified domain
  instead of Resend's shared one matters for deliverability
- Confirm whether you want the marketing consent checkbox required or
  optional at signup
