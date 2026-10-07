import { SCORING } from './content';

const TONE: Record<string, { dot: string; text: string }> = {
  hot: { dot: '#ef3e42', text: '#ffffff' },
  warm: { dot: '#c98a2e', text: '#ffffff' },
  steady: { dot: '#6fa3d3', text: '#ffffff' },
};

/** The scoring rule, listed in full. Mirrors calculateScore in src/lib/data-processor.ts. */
export function ScoringLogic() {
  return (
    <section id="scoring" className="lp-on-dark bg-[#0b2545] lp-band" aria-labelledby="score-h2">
      <div className="lp-wrap">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <p className="lp-label mb-5 text-[#6fa3d3]">{SCORING.eyebrow}</p>
            <h2 id="score-h2" className="lp-h2 lp-reveal">
              {SCORING.h2}
            </h2>
            <p className="lp-lead lp-reveal mt-6">{SCORING.lead}</p>
            <div className="lp-reveal mt-10 border-l-2 border-[#ef3e42] pl-5">
              <p className="lp-label mb-2 text-[#6fa3d3]">{SCORING.example.label}</p>
              <p className="text-lg font-medium leading-snug text-white">{SCORING.example.text}</p>
              <p className="mt-2 text-sm text-[#a9c0d8]">{SCORING.example.caption}</p>
            </div>
          </div>

          <div className="lp-reveal">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Score tiers and the permit counts that set them</caption>
              <thead>
                <tr className="border-b border-[#2b3f5c]">
                  <th scope="col" className="lp-label pb-4 pr-4 font-semibold text-[#6fa3d3]">{SCORING.headers.tier}</th>
                  <th scope="col" className="lp-label pb-4 pr-4 font-semibold text-[#6fa3d3]">{SCORING.headers.total}</th>
                  <th scope="col" className="pb-4 pr-4"><span className="sr-only">Joined by</span></th>
                  <th scope="col" className="lp-label pb-4 font-semibold text-[#6fa3d3]">{SCORING.headers.recent}</th>
                </tr>
              </thead>
              <tbody>
                {SCORING.tiers.map((t) => (
                  <tr key={t.tone} className="border-b border-[#2b3f5c] align-middle">
                    <th scope="row" className="py-6 pr-4">
                      <span className="flex items-center gap-3 text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: TONE[t.tone].text }}>
                        <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: TONE[t.tone].dot }} />
                        {t.name}
                      </span>
                    </th>
                    <td className="py-6 pr-4 text-lg font-medium tabular-nums text-white md:text-xl">{t.total}</td>
                    <td className="py-6 pr-4 text-base text-[#a9c0d8]">{t.joiner}</td>
                    <td className="py-6 text-lg font-medium tabular-nums text-white md:text-xl">{t.recent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-8 space-y-3 text-base leading-relaxed text-[#c9d8e8]">
              {SCORING.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
