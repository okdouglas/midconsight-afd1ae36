/**
 * Landing page content. One source for the page, the JSON-LD block and the
 * <noscript> copy in index.html (scripts/sync-landing-html.mjs writes those two).
 * Rules: Oklahoma only, weekly only, no customer logos, no testimonials, no
 * invented numbers. Real figures below come from the public shared feed
 * (1,394 permits, Oct 2024 to Oct 7, 2026). Update FACTS when the data moves.
 */

import { ACTIVE_DAYS, HOT_MIN, WARM_MIN } from '../../lib/scoring';

export const SITE = {
  url: 'https://midconsight.com/',
  title: 'Oklahoma Drilling Permits, Scored and Mapped | MidconSight',
  description:
    'Start the week with a list, not a search. MidconSight scores new Oklahoma Corporation Commission permits and tracks operators and deals.',
  ogTitle: 'New permits, scored and on a map. Every week.',
  ogDescription:
    'Oklahoma drilling permits, scored as leads and mapped for land and business development teams. Import runs every Monday.',
  twitterDescription: 'Oklahoma drilling permits, scored as leads and mapped. Import runs every Monday.',
} as const;

export const OCC_DATA_URL = 'https://oklahoma.gov/occ/divisions/oil-gas/oil-gas-data';

/** Counted from the shared feed in the database, as of Oct 7, 2026: two years of new-drill and amendment permits, scored with rule v4.1 (12 month lookback). Permit counts per tier are all of an operator's feed permits. */
export const FACTS = {
  asOf: 'Oct 7',
  permits: 1394,
  counties: 53,
  operators: 160,
  monthsOfHistory: 24,
  firstImport: 'Oct 2024',
  latestBatch: 17,
  hot: 630,
  warm: 570,
  cold: 194,
  hotOperators: 20,
  warmOperators: 44,
  coldOperators: 96,
} as const;

export const HERO = {
  eyebrow: 'Oklahoma drilling permits',
  h1Lines: ['Know which operators', 'are about to spend.'],
  h1Accent: 'Call them first.',
  support:
    'MidconSight scores every new Oklahoma drilling permit and rolls it up by operator. You see who is ramping up, so you call before the rig shows up.',
  microcopy: 'Import runs every Monday. No credit card to start.',
  mapAlt: 'MidconSight county map of new Oklahoma drilling permits, hot leads in red',
  mapCaption: `Real permits, Oklahoma Corporation Commission filings, imported through ${FACTS.asOf}.`,
} as const;

export const KPIS = [
  { value: FACTS.permits.toLocaleString('en-US'), label: 'permits on the map' },
  { value: FACTS.hotOperators, label: 'Hot operators this week' },
  { value: FACTS.monthsOfHistory, label: 'months of history' },
  { value: FACTS.latestBatch, label: 'in the latest import' },
] as const;

export const KPI_CAPTION = `Shared feed, ${FACTS.firstImport} to ${FACTS.asOf}. All counts as of ${FACTS.asOf}.`;

export const WEEK_START = {
  h2: 'Start the week with a list, not a search.',
  lead: 'The Corporation Commission posts filings daily. MidconSight imports them every Monday, so the list is ready when you sit down.',
  facts: [
    {
      n: '01',
      title: 'Imported every Monday.',
      body: 'New Intent to Drill filings arrive in one batch.',
    },
    {
      n: '02',
      title: 'Scored on arrival.',
      body: 'Hot operators sort first. Warm operators sort next.',
    },
    {
      n: '03',
      title: 'Mapped by county.',
      body: 'Open the map and see where the week’s permits sit.',
    },
    {
      n: '04',
      title: 'The call list is yours.',
      body: 'Pick the hot ones. Research each, then make the call.',
    },
  ],
  ladderTitle: 'How the page reads',
  ladder: [
    { tone: 'navy', sample: 'New permits, scored.', label: 'Navy. Read first.' },
    { tone: 'slate', sample: 'Operator, county and filing date, in order.', label: 'Slate. Read.' },
    { tone: 'muted', sample: 'Source: Oklahoma Corporation Commission.', label: 'Muted. Scan past.' },
    { tone: 'blue', sample: 'Open this permit', label: 'Blue. Act on.' },
    { tone: 'red', sample: 'Hot lead', label: 'Red. Heat only.' },
  ],
} as const;

/** A real hot permit from the latest import (public filing fields only). */
export const LEAD = {
  h2: 'Oklahoma Intent to Drill filings, scored hot or warm',
  lead: 'Every filing carries its operator’s score. Hot means actively permitting, with real volume on the way. Warm means wells still in the pipeline. Cold means most of the pipeline has played out.',
  eyebrow: 'A real lead',
  headline: `${FACTS.hotOperators} of ${FACTS.operators} operators are hot`,
  reason: `Hot means a pipeline of ${HOT_MIN} or more expected wells and a permit in the last ${ACTIVE_DAYS} days. This operator filed the permit below on Oct 2.`,
  score: 'Hot',
  operator: 'Camino Natural Resources LLC',
  well: 'Hartley S 0707 30-19-1WXH',
  rows: [
    ['County', 'Grady'],
    ['Location', 'Sec 25, 07N, 08W'],
    ['Total depth', '24,978 ft'],
    ['Approved', 'Oct 2, 2026'],
    ['API', '35-051-00726-0000'],
    ['Imported', 'Oct 5, 2026'],
  ],
  source: 'Oklahoma Corporation Commission filing, imported Oct 5.',
  barTitle: `The ${FACTS.permits.toLocaleString('en-US')} permits in the shared feed`,
  barCaption: `As of ${FACTS.asOf}.`,
} as const;

export const COMPANIES = {
  h2: 'Operators, companies and deals in one place',
  lead: 'Each operator gets a company record built from its permits. Link a permit to a deal and move it down the pipeline.',
  stages: ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost'],
  note: 'Free accounts track up to 3 deals. Paid plans have no limit.',
} as const;

export const PRICING = {
  h2: 'Plans: Free, Starter $10, Pro $20',
  lead: 'Start free with the last 30 days of permits. Move up for the full history and no limits.',
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      per: '',
      limit: 'Permits from the last 30 days.',
      features: ['Dashboard, map, companies and Lead Research', 'Up to 3 deals and 3 products', 'CSV and Excel export from the map'],
      cta: 'Start free',
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$10',
      per: '/mo',
      limit: 'Everything in Free, with the full history.',
      features: ['Full permit history', 'Operator scores for every operator', 'Unlimited deals and products'],
      cta: 'Get Starter',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$20',
      per: '/mo',
      limit: 'Everything in Starter.',
      features: ['Import your own permit files', 'Import your product catalog from a spreadsheet'],
      cta: 'Get Pro',
      featured: true,
    },
  ],
  note: 'Pay by card. Cancel any time from your account page. Annual billing saves two months.',
} as const;

export const FAQ_H2 = 'Questions';

/** Answers may be a string or parts with a link. Plain text of each must equal JSON-LD text. */
export const FAQ: { q: string; a: string; link?: { text: string; href: string } }[] = [
  {
    q: 'Where do the permits come from?',
    a: 'From Intent to Drill filings and related formation data published by the Oklahoma Corporation Commission.',
    link: { text: 'Oklahoma Corporation Commission', href: OCC_DATA_URL },
  },
  { q: 'How often does it update?', a: 'Weekly. The import runs every Monday.' },
  {
    q: 'Does it cover states other than Oklahoma?',
    a: 'Not today. MidconSight is built for Oklahoma and the Mid-Continent, and the data is Oklahoma permits.',
  },
  {
    q: 'What does a lead score mean?',
    a: `Each permit is weighted by how likely its well is still on the way, using the real permit-to-production timeline we measured from Oklahoma Corporation Commission data. An operator’s pipeline is the sum. Hot is a pipeline of ${HOT_MIN} wells or more with a permit in the last ${ACTIVE_DAYS} days. Warm is ${WARM_MIN} or more. Cold is everything else.`,
  },
  {
    q: 'What can I do with a lead?',
    a: 'See it on the county map, research it, link it to a company record, add it to the deals pipeline, and export to CSV.',
  },
  {
    q: 'What does the Free plan include?',
    a: 'Free shows permits from the last 30 days, with up to 3 deals and 3 products. Starter is $10 a month and Pro is $20 a month. Both give the full history, scores and no limits. Pro adds importing your own permit files and product catalog.',
  },
  {
    q: 'The OCC publishes this data. Why use MidconSight?',
    a: "The OCC posts the filings. MidconSight sorts each week's permits into scored leads on a map, with operators, companies and deals tracked beside them. Source files are the OCC's.",
  },
  {
    q: 'Can I cancel any time?',
    a: 'Yes. Cancel from the Account page. Your access runs to the end of the period you paid for.',
  },
  { q: 'How do I pay?', a: 'By card, through Stripe.' },
];

export const CLOSING = {
  h2: 'The list is ready every Monday.',
  lead: 'Start free and open it.',
} as const;

export const NEWSLETTER = {
  title: 'Not ready to sign up?',
  body: 'Get a weekly summary of new permits in your inbox. No account needed.',
  doneTitle: 'You’re on the list',
  doneBody: 'We’ll send a weekly summary of new permits. No login required.',
} as const;

export const FOOTER = {
  h2: 'Built by Mayberry Advisory',
  line: 'MidconSight is built by Mayberry Advisory.',
  links: [
    { href: '#platform', label: 'Platform' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'Questions' },
  ],
} as const;

export const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
] as const;

/** The scoring rule, as the app applies it today (src/lib/scoring.ts). */
export const SCORING = {
  eyebrow: 'How the score works',
  h2: 'Hot, warm, cold. Built on how long wells really take.',
  lead: 'No black box. We measured how long Oklahoma wells take to go from permit to first production. A permit is worth the chance its well is still coming, and that fades on the measured curve. An operator’s pipeline is the sum of its permits.',
  headers: { tier: 'Tier', rule: 'Pipeline (expected wells)', meaning: 'What it looks like' },
  tiers: [
    { tone: 'hot', name: 'Hot', rule: `${HOT_MIN} or more, with a permit in the last ${ACTIVE_DAYS} days`, meaning: '3 permits this week, or 2 this month' },
    { tone: 'warm', name: 'Warm', rule: `${WARM_MIN} or more`, meaning: '3 permits 3 months ago, or 1 this month' },
    { tone: 'steady', name: 'Cold', rule: `Under ${WARM_MIN}`, meaning: '1 permit 6 months ago' },
  ],
  example: {
    label: 'One real example',
    text: `Today, ${FACTS.hotOperators} of ${FACTS.operators} operators in the feed are hot, ${FACTS.warmOperators} are warm and ${FACTS.coldOperators} are cold.`,
    caption: `As of ${FACTS.asOf}.`,
  },
  notes: [
    'The median horizontal well takes about 6 months from permit to first production. About 1 in 6 permits never becomes a producing well. The weights come from 6,590 Oklahoma permits.',
    'Only new drills are scored. Amendments and recompletions re-approve a well that already has a permit, so they are left out.',
    'Each permit is scored for 12 months. After that it drops out of the score.',
    'The score belongs to the operator. Every permit it files carries that tier.',
    'Cold does not mean a bad operator. It means little of its pipeline is left. A new filing moves it back up.',
  ],
} as const;
