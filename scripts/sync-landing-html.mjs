#!/usr/bin/env node
/**
 * Writes the JSON-LD block and the <noscript> copy in index.html from
 * src/components/landing/content.ts, so crawler text can never drift from the page.
 *   node scripts/sync-landing-html.mjs          write
 *   node scripts/sync-landing-html.mjs --check  exit 1 if index.html is out of date
 * Runs automatically before `npm run build` (see package.json "prebuild").
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'landing-'));
const out = join(tmp, 'content.mjs');
await build({
  entryPoints: [join(root, 'src/components/landing/content.ts')],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'error',
});
const C = await import(pathToFileURL(out).href);
rmSync(tmp, { recursive: true, force: true });

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const URL = C.SITE.url;

// ---------- JSON-LD ----------
const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${URL}#org`,
      name: 'MidconSight',
      url: URL,
      logo: `${URL}brand/midconsight_mark_color.svg`,
      description: 'Weekly Oklahoma drilling permits, scored as leads and mapped for land and business development teams.',
      parentOrganization: { '@type': 'Organization', name: 'Mayberry Advisory' },
    },
    {
      '@type': 'WebSite',
      '@id': `${URL}#website`,
      url: URL,
      name: 'MidconSight',
      publisher: { '@id': `${URL}#org` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${URL}#app`,
      name: 'MidconSight',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: URL,
      description:
        'Web app for oil and gas land, leasing and business development teams in Oklahoma. Pulls new drilling permits every Monday, scores each as a lead, maps them, and tracks operators, companies and deals.',
      publisher: { '@id': `${URL}#org` },
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD', description: 'Shared permits older than 30 days.', url: `${URL}#pricing` },
        ...[['Starter', '10'], ['Pro', '20']].map(([name, price]) => ({
          '@type': 'Offer',
          name,
          price,
          priceCurrency: 'USD',
          priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'USD', billingDuration: 'P1M', unitCode: 'MON' },
          url: `${URL}#pricing`,
        })),
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${URL}#faq`,
      mainEntity: C.FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
};
const jsonld = `<script type="application/ld+json">\n${JSON.stringify(graph, null, 2).replace(/</g, '\\u003c')}\n    </script>`;

// ---------- noscript: a faithful copy of the page text ----------
const li = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const sec = (h2, body, id = '') => `<section${id ? ` id="${id}"` : ''}><h2>${esc(h2)}</h2>${body}</section>`;
const p = (t) => `<p>${esc(t)}</p>`;
const H = C.HERO, W = C.WEEK_START, L = C.LEAD, SC = C.SCORING, CO = C.COMPANIES;
const R = C.RESEARCH, MO = C.MONDAY, V = C.VOICE, PR = C.PRICING, CL = C.CLOSING, N = C.NEWSLETTER, F = C.FOOTER;
const noscript = [
  '<noscript>',
  '<header><nav aria-label="Primary">' + C.NAV_LINKS.map((l) => `<a href="/${l.href}">${esc(l.label)}</a>`).join(' ') + ' <a href="/auth">Sign in</a></nav></header>',
  '<main>',
  `<h1>${esc(H.h1Lead)} ${esc(H.h1Accent)}</h1>`,
  p(H.support),
  `<p><a href="/auth">Start free</a> <a href="/#platform">See the platform</a></p>`,
  p(H.microcopy),
  p(H.mapCaption),
  li(C.KPIS.map((k) => `${k.value} ${esc(k.label)}`)),
  p(C.KPI_CAPTION),
  sec(W.h2, p(W.lead) + li(W.facts.map((f) => `${esc(f.title)} ${esc(f.body)}`)) + p(W.ladderTitle) + li(W.ladder.map((t) => `${esc(t.sample)} ${esc(t.label)}`)), 'platform'),
  sec(L.h2, p(L.lead) + p(L.eyebrow) + p(`${L.operator}, ${L.well}. ${L.score}.`) + li(L.rows.map(([k, v]) => `${esc(k)}: ${esc(v)}`)) + p(L.source) + p(L.barTitle) + li([`${C.FACTS.hot} Hot`, `${C.FACTS.warm} Warm`, `${C.FACTS.steady} Steady`]) + p(L.barCaption)),
  sec(SC.h2, p(SC.lead) + li(SC.tiers.map((t) => `${esc(t.name)}: heat ${esc(t.rule)}. ${esc(t.meaning)}.`)) + p(`${esc(SC.windowsLabel)}: ${SC.windows.map(esc).join(', ')}.`) + p(`${SC.example.text} ${SC.example.caption}`) + li(SC.notes.map(esc)), 'scoring'),
  sec(CO.h2, p(CO.lead) + li(CO.stages.map(esc)) + p(CO.note)),
  sec(R.h2, R.cards.map((c) => `<h3>${esc(c.title)}</h3>${p(c.body)}${p(c.plan)}`).join('')),
  sec(MO.h2, p(MO.lead) + `<h3>${esc(MO.title)}</h3>` + li(MO.steps.map((s) => `${esc(s.n)} ${esc(s.when)}. ${esc(s.title)} ${esc(s.body)}`)), 'how-it-works'),
  sec(V.h2, li(V.lines.map((l) => `${esc(l.k)} ${esc(l.v)}`))),
  sec(PR.h2, p(PR.lead) + PR.plans.map((pl) => `<h3>${esc(pl.name)} ${esc(pl.price)}${esc(pl.per)}</h3>${p(pl.limit)}${li(pl.features.map(esc))}`).join('') + p(PR.note), 'pricing'),
  sec(C.FAQ_H2, '<dl>' + C.FAQ.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('') + '</dl>', 'faq'),
  sec(CL.h2, p(CL.lead) + '<p><a href="/auth">Start free</a></p>'),
  `<section><h2>${esc(N.title)}</h2>${p(N.body)}</section>`,
  '</main>',
  `<footer><h2>${esc(F.h2)}</h2>${p(F.line)}<p><a href="${C.OCC_DATA_URL}">Oklahoma Corporation Commission oil and gas data</a></p></footer>`,
  '</noscript>',
].join('\n    ');

function splice(html, name, content) {
  const re = new RegExp(`(<!-- landing:${name}:start -->)[\\s\\S]*?(<!-- landing:${name}:end -->)`);
  if (!re.test(html)) throw new Error(`marker ${name} missing in index.html`);
  return html.replace(re, `$1\n    ${content.replace(/\$/g, '$$$$')}\n    $2`);
}

const file = join(root, 'index.html');
const before = readFileSync(file, 'utf8');
let after = splice(before, 'jsonld', jsonld);
after = splice(after, 'noscript', noscript);
if (process.argv.includes('--check')) {
  if (after !== before) {
    console.error('index.html is out of date. Run: node scripts/sync-landing-html.mjs');
    process.exit(1);
  }
  console.log('index.html is in sync with landing content.');
} else if (after !== before) {
  writeFileSync(file, after);
  console.log('index.html updated.');
} else {
  console.log('index.html already in sync.');
}
