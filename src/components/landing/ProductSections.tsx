import { COMPANIES, DATA_SECTION, FACTS, LEAD, MAP_SECTION, MONDAY, RESEARCH } from './content';
import { Brackets, Eyebrow } from './Frames';

/** Intent to Drill filings, scored hot or warm: a real lead card and the real score split. */
export function ScoredLeads() {
  const total = FACTS.hot + FACTS.warm + FACTS.steady;
  const seg = [
    { k: 'Hot', n: FACTS.hot, bg: '#c4262a', fg: '#c4262a' },
    { k: 'Warm', n: FACTS.warm, bg: '#c98a2e', fg: '#7a4b00' },
    { k: 'Steady', n: FACTS.steady, bg: '#005a9c', fg: '#005a9c' },
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
              <div className="flex h-5 overflow-hidden rounded-[3px]" role="img" aria-label={`${FACTS.hot} hot, ${FACTS.warm} warm, ${FACTS.steady} steady`}>
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
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold leading-tight tracking-tight text-[#0b2545]">{LEAD.operator}</h3>
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

const MAP_DOTS: [number, number, 'hot' | 'warm' | 'steady'][] = [
  [8, 20, 'warm'], [16, 12, 'warm'], [14, 38, 'steady'], [30, 26, 'steady'], [38, 44, 'hot'],
  [44, 18, 'steady'], [52, 36, 'warm'], [58, 60, 'steady'], [24, 62, 'steady'], [34, 74, 'hot'],
  [46, 80, 'steady'], [62, 46, 'hot'], [70, 30, 'steady'], [76, 56, 'warm'], [84, 40, 'steady'],
  [90, 70, 'steady'], [66, 78, 'hot'], [80, 84, 'steady'], [20, 82, 'warm'], [54, 54, 'steady'],
  [40, 62, 'steady'], [72, 18, 'steady'], [92, 24, 'warm'], [10, 56, 'steady'],
];

/** Every permit on a county map. A drawn panel, with a popup built from real filing fields. */
export function MapSection() {
  return (
    <section className="lp-on-dark bg-[#0b2545] lp-band" aria-labelledby="map-h2">
      <div className="lp-wrap grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <p className="lp-label mb-5 text-[#6fa3d3]">The county map</p>
          <h2 id="map-h2" className="lp-h2 lp-reveal">
            {MAP_SECTION.h2}
          </h2>
          <p className="lp-lead lp-reveal mt-6">{MAP_SECTION.lead}</p>
          <ul className="lp-reveal mt-8 flex flex-wrap gap-x-8 gap-y-3" aria-label="Map legend">
            {MAP_SECTION.legend.map((l) => (
              <li key={l.tone} className="flex items-center gap-3 text-lg font-medium text-white">
                <span className={`lp-dot hot-legend ${l.tone}`} style={{ position: 'static', transform: 'none' }} aria-hidden="true" />
                {l.label}
              </li>
            ))}
          </ul>
          <p className="lp-reveal mt-8 border-t border-[#1d3b66] pt-5 text-base text-[#c9d8e8]">{MAP_SECTION.note}</p>
        </div>

        <Brackets onDark className="lp-reveal">
          <div className="lp-panel" aria-hidden="true">
            {MAP_DOTS.map(([x, y, t], i) => (
              <span key={i} className={`lp-dot ${t}`} style={{ left: `${x}%`, top: `${y}%` }} />
            ))}
            <span className="lp-dot hot pulse" style={{ left: '62%', top: '58%' }} />
            <div className="lp-popup r" style={{ right: 'calc(38% - 1.9rem)', bottom: 'calc(42% + 16px)' }}>
              <p className="text-base font-semibold text-[#0b2545]">{MAP_SECTION.popup.title}</p>
              <dl className="mt-1.5 space-y-0.5">
                {MAP_SECTION.popup.rows.map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt className="font-semibold text-[#0b2545]">{k}:</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Brackets>
      </div>
    </section>
  );
}

/** County. Operator. Numbers. Real counts from the shared feed. */
export function DataSection() {
  const max = Math.max(...DATA_SECTION.counties.map((c) => c[1] as number));
  return (
    <section className="bg-white lp-band" aria-labelledby="data-h2">
      <div className="lp-wrap">
        <div className="max-w-3xl">
          <Eyebrow className="mb-5">Real counts</Eyebrow>
          <h2 id="data-h2" className="lp-h2 lp-reveal">
            {DATA_SECTION.h2}
          </h2>
          <p className="lp-lead lp-reveal mt-6">{DATA_SECTION.lead}</p>
        </div>

        <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div className="lp-reveal">
            <h3 className="lp-label mb-5 border-b-[1.5px] border-[#0b2545] pb-3 text-[#005a9c]">{DATA_SECTION.countiesTitle}</h3>
            <ul>
              {DATA_SECTION.counties.map(([name, n]) => (
                <li key={name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-4 border-b border-[#eef4fa] py-3 sm:grid-cols-[8rem_1fr_3rem]">
                  <span className="text-base text-[#2b3f5c]">{name}</span>
                  <span className="lp-bar-track" aria-hidden="true">
                    <span className="lp-bar-fill block" style={{ width: `${((n as number) / max) * 100}%` }} />
                  </span>
                  <span className="lp-num text-right text-xl text-[#0b2545]">{n}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-reveal">
            <h3 className="lp-label mb-5 border-b-[1.5px] border-[#0b2545] pb-3 text-[#005a9c]">{DATA_SECTION.operatorsTitle}</h3>
            <ol>
              {DATA_SECTION.operators.map(([name, n], i) => (
                <li key={name} className="grid grid-cols-[2rem_1fr_3rem] items-baseline gap-3 border-b border-[#eef4fa] py-3.5">
                  <span className="lp-num text-base text-[#5b6f8a]">{i + 1}</span>
                  <span className="text-base font-medium text-[#0b2545]">{name}</span>
                  <span className="lp-num text-right text-xl text-[#0b2545]">{n}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="mt-10 text-sm text-[#5b6f8a]">{DATA_SECTION.caption}</p>
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

export function MondayImport() {
  return (
    <section id="how-it-works" className="bg-[#eef4fa] lp-band" aria-labelledby="mon-h2">
      <div className="lp-wrap">
        <div className="max-w-3xl">
          <Eyebrow className="mb-5">How it works</Eyebrow>
          <h2 id="mon-h2" className="lp-h2 lp-reveal">
            {MONDAY.h2}
          </h2>
          <p className="lp-lead lp-reveal mt-6">{MONDAY.lead}</p>
        </div>
        <h3 className="lp-label mb-6 mt-16 text-[#5b6f8a]">{MONDAY.title}</h3>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {MONDAY.steps.map((s) => (
            <li key={s.n} className="lp-reveal border-t-[3px] border-[#005a9c] pt-6">
              <p className="lp-label text-[#005a9c]">
                {s.n} &middot; {s.when}
              </p>
              <p className="mt-4 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[#0b2545]">{s.title}</p>
              <p className="mt-3 text-lg leading-relaxed text-[#2b3f5c]">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
