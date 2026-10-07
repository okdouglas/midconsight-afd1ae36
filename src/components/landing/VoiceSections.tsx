import { WEEK_START } from './content';
import { Eyebrow } from './Frames';

/** A list, not a search. How a Monday goes, beside a laptop holding the real map. */
export function WeekStart() {
  return (
    <section id="platform" className="bg-[#eef4fa] lp-band" aria-labelledby="week-h2">
      <div className="lp-wrap grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-20">
        <div>
          <div id="how-it-works" className="scroll-mt-24" />
          <Eyebrow className="mb-5">The Monday list</Eyebrow>
          <h2 id="week-h2" className="lp-h2 lp-reveal">
            {WEEK_START.h2}
          </h2>
          <p className="lp-lead lp-reveal mt-6">{WEEK_START.lead}</p>

          <ol className="mt-10 divide-y divide-[#d5dfea] border-y border-[#d5dfea]">
            {WEEK_START.facts.map((f) => (
              <li key={f.n} className="lp-reveal grid grid-cols-[3.25rem_1fr] gap-4 py-5">
                <span className="lp-num pt-1 text-2xl text-[#005a9c]">{f.n}</span>
                <div>
                  <p className="text-xl font-semibold leading-snug tracking-tight text-[#0b2545]">{f.title}</p>
                  <p className="mt-1 text-base leading-relaxed text-[#2b3f5c]">{f.body}</p>
                </div>
              </li>
            ))}
          </ol>

        </div>

        <div className="lp-reveal">
          <div className="lp-laptop-screen aspect-[16/10]">
            <picture>
              <img
                src="/img/map-hero-desktop.webp"
                width={1600}
                height={1000}
                alt="Close view of the county map with new Oklahoma permits in red, amber and blue"
                loading="lazy"
                decoding="async"
                className="lp-zoom"
              />
            </picture>
          </div>
          <div className="lp-laptop-base" aria-hidden="true" />
          <div className="lp-reveal mt-12 rounded-lg border border-[#d5dfea] bg-white p-6 md:p-8">
            <p className="lp-label mb-5 text-[#5b6f8a]">{WEEK_START.ladderTitle}</p>
            <ul className="space-y-4">
              {WEEK_START.ladder.map((t) => (
                <li key={t.tone} className="grid items-baseline gap-x-6 gap-y-1 sm:grid-cols-[1fr_9.5rem]">
                  <p
                    className={`lp-tone-${t.tone} ${
                      t.tone === 'navy' ? 'text-[1.75rem] font-semibold tracking-tight' : t.tone === 'muted' ? 'text-[0.9375rem]' : t.tone === 'slate' ? 'text-lg' : 'text-lg font-semibold'
                    } leading-snug`}
                  >
                    {t.sample}
                  </p>
                  <p className="lp-label text-[#5b6f8a] sm:text-right">{t.label}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
