/**
 * Landing page content. One source for the page, the JSON-LD block and the
 * <noscript> copy in index.html (scripts/sync-landing-html.mjs writes those two).
 * Rules: Oklahoma only, weekly only, no customer logos, no testimonials, no
 * invented numbers. Real figures below come from the public shared feed
 * (120 permits, imports Aug 17 to Oct 7). Update FACTS when the data moves.
 */

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

export const HERO = {
  eyebrow: 'Oklahoma drilling permits',
  h1Lead: 'New permits, scored and on a map.',
  h1Accent: 'Every week.',
  support:
    'Oklahoma drilling permits from the Corporation Commission, ranked as leads for land and business development teams.',
  microcopy: 'Import runs every Monday. No credit card to start.',
  mapAlt: 'MidconSight county map of new Oklahoma drilling permits, hot leads in red',
  mapCaption: 'Real permits, Oklahoma Corporation Commission filings, imported through Oct 5.',
} as const;

/** Counted from the public shared feed export (permits-used.json), as of Oct 7, 2026, scored with a 12 month lookback. */
export const FACTS = {
  asOf: 'Oct 7',
  permits: 120,
  counties: 26,
  operators: 46,
  imports: 8,
  firstImport: 'Aug 17',
  latestBatch: 17,
  hot: 60,
  warm: 52,
  cold: 8,
  hotOperators: 11,
  warmOperators: 27,
  coldOperators: 8,
} as const;

export const KPIS = [
  { value: FACTS.permits, label: 'permits on the map' },
  { value: FACTS.counties, label: 'counties with a filing' },
  { value: FACTS.imports, label: 'weekly imports' },
  { value: FACTS.latestBatch, label: 'in the latest import' },
] as const;

export const KPI_CAPTION = `Shared feed, ${FACTS.firstImport} to ${FACTS.asOf}. All counts as of ${FACTS.asOf}.`;

export const WEEK_START = {
  h2: 'Start the week with a list, not a search.',
  lead: 'Monday morning, the new permits are already in. Sorted, scored and on the map.',
  facts: [
    {
      n: '01',
      title: 'Imported every Monday.',
      body: 'New Intent to Drill filings from the Corporation Commission land in one list.',
    },
    {
      n: '02',
      title: 'Scored on arrival.',
      body: 'Hot leads sort first. Warm leads sort next.',
    },
    {
      n: '03',
      title: 'Mapped by county.',
      body: 'Open the map and see where the week’s permits sit.',
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
  lead: 'Every filing carries its operator’s score. Hot means actively permitting. Warm means recent activity. Cold means the filings are old.',
  eyebrow: 'A real lead',
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
  barTitle: `The ${FACTS.permits} permits in the shared feed`,
  barCaption: `As of ${FACTS.asOf}.`,
} as const;

export const MAP_SECTION = {
  h2: 'Every permit on a county map',
  lead: 'Hot in red. Warm in amber. Cold in blue. Click a dot for the operator, the API number, the county and the approval date.',
  legend: [
    { tone: 'hot', label: 'Hot' },
    { tone: 'warm', label: 'Warm' },
    { tone: 'steady', label: 'Cold' },
  ],
  note: 'Filter the map. Export what you see to CSV or Excel.',
  popup: {
    title: 'Wilson 4-29',
    rows: [
      ['Operator', 'KODA OPERATING LLC'],
      ['API', '35071004170000'],
      ['County', 'KAY'],
      ['Well type', 'OG'],
      ['Approval date', '2026-09-28'],
    ],
  },
} as const;

export const DATA_SECTION = {
  h2: 'County. Operator. Numbers.',
  lead: 'Three columns do most of the work. These are the real ones from the shared feed.',
  countiesTitle: 'Permits by county',
  counties: [
    ['Canadian', 17],
    ['Custer', 16],
    ['Roger Mills', 11],
    ['Grady', 8],
    ['Oklahoma', 7],
    ['Kay', 6],
    ['Kingfisher', 6],
    ['Garvin', 5],
  ],
  operatorsTitle: 'Most active operators',
  operators: [
    ['Validus Energy II Midcon LLC', 10],
    ['Koda Operating LLC', 7],
    ['Devon Energy Production Company LP', 6],
    ['Camino Natural Resources LLC', 5],
    ['FW Midcon I, LLC', 5],
  ],
  caption: `Eight weekly imports, ${FACTS.firstImport} to ${FACTS.asOf}. Counts as of ${FACTS.asOf}.`,
} as const;

export const COMPANIES = {
  h2: 'Operators, companies and deals in one place',
  lead: 'Each operator gets a company record built from its permits. Link a permit to a deal and move it down the pipeline.',
  stages: ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Closed Won', 'Closed Lost'],
  note: 'Company records and the deals pipeline are on Pro.',
} as const;

export const RESEARCH = {
  h2: 'Research a lead, then export it to CSV',
  cards: [
    {
      title: 'Research',
      body: 'Triage new permits in Lead Research. Mark each one new, researching, verified or current client.',
      plan: 'Starter and Pro',
    },
    {
      title: 'Export',
      body: 'Export the map view to CSV or Excel. Take the list to your call sheet.',
      plan: 'Every plan',
    },
  ],
} as const;

export const MONDAY = {
  h2: 'Import runs every Monday.',
  lead: 'The Corporation Commission posts filings daily. MidconSight imports them once a week and sorts them for you.',
  title: 'How a Monday goes',
  steps: [
    { n: '01', when: 'Monday', title: 'The import runs.', body: 'New Oklahoma filings arrive in one batch.' },
    { n: '02', when: 'Then', title: 'The list is scored.', body: 'Hot first. Warm next. Everything on the map.' },
    { n: '03', when: 'Then', title: 'The call list is yours.', body: 'Pick the hot ones. Research each, then make the call.' },
  ],
} as const;

export const VOICE = {
  h2: 'Voice you can count on.',
  lines: [
    { k: 'County.', v: 'Where the well will be.' },
    { k: 'Operator.', v: 'Who filed it.' },
    { k: 'Numbers.', v: 'Depth, dates and API. As filed.' },
    { k: 'Weekly.', v: 'The import runs every Monday.' },
  ],
  sceneLabel: 'A pumpjack silhouetted against a dusk sky over an Oklahoma field',
} as const;

export const PLAIN = {
  h2: 'Say it plain.',
  lines: [
    'Short sentences.',
    'Numbers over adjectives.',
    'Weekly, not real time.',
    'Oklahoma, nothing else.',
  ],
  last: 'Facts you can act on.',
} as const;

export const PRICING = {
  h2: 'Plans: Free, Starter $10, Pro $20',
  lead: 'Start free. Move up when you want current permits or the deals pipeline.',
  plans: [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      per: '',
      limit: 'Shared permits older than 30 days.',
      features: ['Dashboard and county map', 'CSV and Excel export from the map'],
      cta: 'Start free',
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$10',
      per: '/mo',
      limit: 'Everything in Free, with current permits.',
      features: ['No 30-day delay on permits', 'Lead Research', 'Data import'],
      cta: 'Get Starter',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$20',
      per: '/mo',
      limit: 'Everything in Starter, with the full pipeline.',
      features: ['Company records', 'Deals pipeline', 'Product catalog and matching'],
      cta: 'Get Pro',
      featured: true,
    },
  ],
  note: 'Paid plans are set up by request inside the app. Self-serve checkout is coming.',
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
    a: 'Each permit is worth 1 point the day it is approved and loses half its weight every 60 days. An operator’s heat is the sum. Hot is 2.5 points or more, warm is 0.75 to 2.5, and cold is under 0.75. Wells take months to go from permit to producing well, so a permit fades instead of dropping off.',
  },
  {
    q: 'What can I do with a lead?',
    a: 'See it on the county map, research it, link it to a company record, add it to the deals pipeline, and export to CSV.',
  },
  {
    q: 'What does the Free plan include?',
    a: 'Free users see shared permits older than 30 days. Starter is $10 a month and Pro is $20 a month.',
  },
  {
    q: 'The OCC publishes this data. Why use MidconSight?',
    a: "The OCC posts the filings. MidconSight sorts each week's permits into scored leads on a map, with operators, companies and deals tracked beside them. Source files are the OCC's.",
  },
  { q: 'Who builds MidconSight?', a: 'Mayberry Advisory.' },
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
    { href: '#how-it-works', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#faq', label: 'Questions' },
  ],
} as const;

export const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
] as const;

/** The scoring rule, as the app applies it today (src/lib/scoring.ts). */
export const SCORING = {
  eyebrow: 'How the score works',
  h2: 'Hot, warm, cold. Heat that fades.',
  lead: 'No black box. A permit is worth 1 point the day it is approved. It loses half its weight every 60 days. An operator’s heat is the sum of its permits.',
  headers: { tier: 'Tier', rule: 'Heat points', meaning: 'What it looks like' },
  tiers: [
    { tone: 'hot', name: 'Hot', rule: '2.5 or more', meaning: '3 permits this week, or 5 this month' },
    { tone: 'warm', name: 'Warm', rule: '0.75 to 2.5', meaning: '3 permits 3 months ago, or 1 this month' },
    { tone: 'steady', name: 'Cold', rule: 'Under 0.75', meaning: '1 permit 6 months ago' },
  ],
  windows: ['7 days', '14 days', '30 days', '60 days', '90 days', '6 months', '12 months'],
  windowsLabel: 'Pick a lookback',
  example: {
    label: 'One real example',
    text: `Today, ${FACTS.hotOperators} of ${FACTS.operators} operators in the feed are hot, ${FACTS.warmOperators} are warm and ${FACTS.coldOperators} are cold.`,
    caption: `As of ${FACTS.asOf}.`,
  },
  notes: [
    'Wells take months to go from permit to producing well. A permit stays on the board while it fades. It drops out only when it expires.',
    'The lookback at the top of every screen caps how far back permits count. It starts at 12 months.',
    'The score belongs to the operator. Every permit it files carries that tier.',
    'Cold does not mean a bad lead. It means the filings are old.',
  ],
} as const;
