import { COMPANIES, FACTS, LEAD, RESEARCH } from './content';
import { Eyebrow } from './Frames';

/** Intent to Drill filings, scored hot or warm: a real lead card and the real score split. */
export function ScoredLeads() {
  const total = FACTS.hot + FACTS.warm + FACTS.cold;
  const seg = [
    { k: 'Hot', n: FACTS.hot, bg: '#c4262a', fg: '#c4262a' },
    { k: 'Warm', n: FACTS.warm, bg: '#c98a2e', fg: '#7a4b00' },
    { k: 'Cold', n: FACTS.cold, bg: '#005a9c', fg: '#005a9c' },
  ];
  return (
    <section className="bg-white lp-band" aria-labelledby="lead-h2">
      <div className="lp-wrap">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <Eyebrow className="mb-5">Scored leads</Eyebrow>
            <h2 id="lead-h2" className="lp-h2 lp-reveal">
              {LEAD.h2}
            </h2>
            <p className="lp-lead lp-reveal mt-6">{LEAD.lead}</p>

            <div className="lp-reveal mt-12">
              <p className="lp-label mb-4 text-[#5b6f8a]">{LEAD.barTitle}</p>
              <div className="flex h-5 overflow-hidden rounded-[3px]" role="img" aria-label={`${FACTS.hot} hot, ${FACTS.warm} warm, ${FACTS.cold} cold`}>
                {seg.map((s) => (
                  <div key={s.k} style={{ width: `${(s.n / total) * 100}%`, background: s.bg }} />
                ))}
              </div>
              <ul className="mt-5 grid grid-cols-3 gap-4">
                {seg.map((s) => (
                  <li key={s.k}>
                    <p className="lp-num text-5xl md:text-6xl" style={{ color: s.fg }}>
                      {s.n}
                    </p>
                    <p className="mt-2 text-base font-medium text-[#2b3f5c]">{s.k}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-[#5b6f8a]">{LEAD.barCaption}</p>
            </div>
          </div>

          <div className="lp-reveal">
            <p className="lp-label mb-4 text-[#5b6f8a]">{LEAD.eyebrow}</p>
            <article className="overflow-hidden rounded-lg border border-[#d5dfea] bg-white shadow-[0_24px_48px_-28px_rgba(11,37,69,0.35)]">
              <div className="flex">
                <div className="w-2 shrink-0 bg-[#c4262a]" aria-hidden="true" />
                <div className="flex-1 p-6 md:p-8">
                  <p className="lp-num text-[clamp(1.75rem,1.2rem+1.6vw,2.5rem)] leading-tight text-[#c4262a]">{LEAD.headline}</p>
                  <p className="mt-3 text-base leading-relaxed text-[#2b3f5c]">{LEAD.reason}</p>
                  <div className="mt-8 flex items-start justify-between gap-4 border-t border-[#eef4fa] pt-6">
                    <div>
                      <h3 className="text-xl font-semibold leading-tight tracking-tight text-[#0b2545]">{LEAD.operator}</h3>
                      <p className="mt-1 text-base text-[#5b6f8a]">{LEAD.well}</p>
                    </div>
                    <span className="lp-label shrink-0 rounded-full bg-[#c4262a] px-3 py-1.5 text-white">{LEAD.score}</span>
                  </div>
                  <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-base">
                    {LEAD.rows.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="lp-label self-center text-[#005a9c]">{k}</dt>
                        <dd className="text-right font-medium tabular-nums text-[#0b2545]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-8 border-t border-[#eef4fa] pt-4 text-sm text-[#5b6f8a]">{LEAD.source}</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Operators, companies and deals: the real pipeline stages from the app. */
export function CompaniesDeals() {
  const shades = ['#d3e4f4', '#a9c8e8', '#6fa3d3', '#1f6db0', '#0b2545', '#5b6f8a'];
  const fg = ['#0b2545', '#0b2545', '#0b2545', '#fff', '#fff', '#fff'];
  return (
    <section className="bg-[#eef4fa] lp-band" aria-labelledby="co-h2">
      <div className="lp-wrap">
        <div className="max-w-3xl">
          <Eyebrow className="mb-5">Companies and deals</Eyebrow>
          <h2 id="co-h2" className="lp-h2 lp-reveal">
            {COMPANIES.h2}
          </h2>
          <p className="lp-lead lp-reveal mt-6">{COMPANIES.lead}</p>
        </div>
        <ol className="lp-reveal mt-14 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {COMPANIES.stages.map((s, i) => (
            <li
              key={s}
              className="flex min-h-[8.5rem] flex-col justify-between rounded-lg p-4"
              style={{ background: shades[i], color: fg[i] }}
            >
              <span className="lp-label">Stage {i + 1}</span>
              <span className="text-xl font-semibold leading-tight tracking-tight">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-[#5b6f8a]">{COMPANIES.note}</p>
      </div>
    </section>
  );
}

const STATUS_CHIPS = [
  { t: 'New', c: 'bg-[#d3e4f4] text-[#00467a]' },
  { t: 'Researching', c: 'bg-[#f6e3bf] text-[#7a4b00]' },
  { t: 'Verified', c: 'bg-[#dcebe1] text-[#245a39]' },
  { t: 'Current client', c: 'bg-[#0b2545] text-white' },
];

export function ResearchExport() {
  return (
    <section className="bg-white lp-band" aria-labelledby="rx-h2">
      <div className="lp-wrap">
        <h2 id="rx-h2" className="lp-h2 lp-reveal max-w-4xl">
          {RESEARCH.h2}
        </h2>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {RESEARCH.cards.map((c, i) => (
            <article key={c.title} className="lp-reveal flex flex-col rounded-lg border border-[#d5dfea] bg-[#eef4fa] p-7 md:p-10">
              <p className="lp-label text-[#005a9c]">{c.plan}</p>
              <h3 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[#0b2545]">{c.title}</h3>
              <p className="mt-3 max-w-md text-lg leading-relaxed text-[#2b3f5c]">{c.body}</p>
              <div className="mt-8 flex flex-wrap gap-2" aria-hidden="true">
                {i === 0
                  ? STATUS_CHIPS.map((s) => (
                      <span key={s.t} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${s.c}`}>
                        {s.t}
                      </span>
                    ))
                  : ['CSV', 'Excel'].map((t) => (
                      <span key={t} className="rounded-md border-2 border-[#005a9c] bg-white px-4 py-1.5 text-sm font-semibold text-[#005a9c]">
                        {t}
                      </span>
                    ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
