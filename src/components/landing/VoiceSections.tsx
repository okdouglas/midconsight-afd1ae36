import { PLAIN, VOICE, WEEK_START } from './content';
import { Eyebrow } from './Frames';
import { PumpjackScene } from './PumpjackScene';

/** Slide 1: a list, not a search. Text and tone ladder beside a laptop holding the real map. */
export function WeekStart() {
  return (
    <section id="platform" className="bg-[#eef4fa] lp-band" aria-labelledby="week-h2">
      <div className="lp-wrap grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-20">
        <div>
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

/** Slide 2: Voice you can count on. Navy panel of proof lines beside the dusk scene. */
export function VoiceCount() {
  return (
    <section className="lp-on-dark bg-[#0b2545]" aria-labelledby="voice-h2">
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col justify-center px-5 py-16 md:px-12 md:py-24 lg:pl-[max(2rem,calc((100vw-75rem)/2+2rem))] lg:pr-16">
          <p className="lp-label mb-5 text-[#6fa3d3]">What you can count on</p>
          <h2 id="voice-h2" className="lp-h2 !text-[clamp(2.5rem,1.4rem+4.6vw,4.75rem)]">
            {VOICE.h2}
          </h2>
          <ul className="mt-10 divide-y divide-[#1d3b66] border-y border-[#1d3b66]">
            {VOICE.lines.map((l) => (
              <li key={l.k} className="lp-reveal flex flex-wrap items-baseline gap-x-5 gap-y-1 py-4">
                <span className="w-32 text-2xl font-semibold tracking-tight text-white sm:w-40">{l.k}</span>
                <span className="text-lg text-[#c9d8e8]">{l.v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative min-h-[22rem] lg:min-h-[36rem]">
          <PumpjackScene />
        </div>
      </div>
    </section>
  );
}

/** A short principles band. Big type, five lines at most. */
export function SayItPlain() {
  return (
    <section className="bg-white lp-band" aria-labelledby="plain-h2">
      <div className="lp-wrap">
        <h2 id="plain-h2" className="lp-label mb-8 text-[#5b6f8a]">
          {PLAIN.h2}
        </h2>
        <ul className="space-y-1 md:space-y-2">
          {PLAIN.lines.map((l) => (
            <li key={l} className="lp-reveal text-[clamp(2.25rem,1rem+6vw,5.5rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-[#0b2545]">
              {l}
            </li>
          ))}
          <li className="lp-reveal text-[clamp(2.25rem,1rem+6vw,5.5rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-[#005a9c]">
            {PLAIN.last}
          </li>
        </ul>
      </div>
    </section>
  );
}
