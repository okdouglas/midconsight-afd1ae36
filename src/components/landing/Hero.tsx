import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HERO, KPIS, KPI_CAPTION } from './content';
import { Brackets, Eyebrow } from './Frames';
import { useCta } from './useCta';
import { PumpjackScene } from './PumpjackScene';

export function Hero() {
  const cta = useCta();
  return (
    <>
      <section id="top" className="lp-hero lp-on-dark relative overflow-hidden pb-16 pt-14 md:pb-24 md:pt-24" aria-labelledby="hero-h1">
        <PumpjackScene align="xMaxYMax slice" />
        <div className="lp-hero-shade" aria-hidden="true" />
        <div className="lp-wrap relative">
          <Eyebrow className="lp-enter mb-6">{HERO.eyebrow}</Eyebrow>
          <h1 id="hero-h1" className="lp-h1 lp-enter d1 max-w-5xl">
            {HERO.h1Lines.map((line) => (
              <span key={line} className="md:block">
                {line}{' '}
              </span>
            ))}
            <span className="lp-hero-accent md:block">{HERO.h1Accent}</span>
          </h1>
          <div className="lp-enter d2 mt-10 flex flex-col gap-8 md:mt-14 md:flex-row md:items-end md:justify-between md:gap-16">
            <p className="lp-lead max-w-xl">{HERO.support}</p>
            <div className="shrink-0">
              <div className="flex flex-wrap gap-3">
                <Link to={cta.href} className="lp-btn lp-btn-primary">
                  {cta.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="#platform" className="lp-btn lp-btn-ghost">
                  See the platform
                </a>
              </div>
              <p className="mt-4 text-sm text-[#c9d8e8]">{HERO.microcopy}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eef4fa] pb-16 pt-12 md:pb-24 md:pt-16" aria-label="Permit map preview">
        <div className="lp-wrap">
          <figure className="lp-enter d3">
            <Brackets>
              <div className="lp-frame">
                <div className="lp-frame-bar" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <picture>
                  <source media="(max-width: 767px)" srcSet="/img/map-hero-mobile.webp" width={800} height={1067} />
                  <img
                    src="/img/map-hero-desktop.webp"
                    width={1600}
                    height={1000}
                    alt={HERO.mapAlt}
                    fetchPriority="high"
                    decoding="async"
                    className="block h-auto w-full"
                  />
                </picture>
              </div>
            </Brackets>
            <figcaption className="mt-6 text-sm text-[#5b6f8a]">{HERO.mapCaption}</figcaption>
          </figure>
        </div>
      </section>

      <section aria-label="Permit counts" className="border-b border-[#d5dfea] bg-white">
        <div className="lp-wrap py-14 md:py-20">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
            {KPIS.map((k) => (
              <li key={k.label} className="lp-reveal border-t-[3px] border-[#005a9c] pt-5">
                <p className="lp-num text-[clamp(3.75rem,2rem+7vw,6.5rem)] text-[#0b2545]">{k.value}</p>
                <p className="mt-3 text-base text-[#2b3f5c] md:text-lg">{k.label}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-[#5b6f8a]">{KPI_CAPTION}</p>
        </div>
      </section>
    </>
  );
}
