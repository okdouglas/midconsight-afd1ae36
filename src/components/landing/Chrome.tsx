import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { FOOTER, NAV_LINKS, OCC_DATA_URL } from './content';
import { useCta } from './useCta';

export function SkipLink() {
  return (
    <a href="#main" className="lp-skip">
      Skip to content
    </a>
  );
}

export function SiteNav() {
  const cta = useCta();
  return (
    <header className="sticky top-0 z-50 border-b border-[#d5dfea] bg-white/95 backdrop-blur">
      <div className="lp-wrap flex h-16 items-center justify-between gap-4">
        <a href="#top" aria-label="MidconSight, back to top" className="flex min-h-11 items-center">
          <Logo height={26} />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center px-3 text-[0.9375rem] font-medium text-[#2b3f5c] hover:text-[#005a9c]"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!cta.signedIn && (
            <Link
              to="/auth"
              className="hidden min-h-11 items-center px-3 text-[0.9375rem] font-medium text-[#2b3f5c] hover:text-[#005a9c] sm:inline-flex"
            >
              Sign in
            </Link>
          )}
          <Link to={cta.href} className="lp-btn lp-btn-primary !min-h-11 !px-5 !py-2 !text-[0.9375rem]">
            {cta.label}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="lp-on-dark bg-[#0b2545] text-[#c9d8e8]">
      <div className="lp-wrap py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <h2 className="sr-only">{FOOTER.h2}</h2>
            <Logo variant="reversed" showCredit width={300} />
            <p className="mt-6 max-w-sm text-[0.9375rem] leading-relaxed">{FOOTER.line}</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 md:justify-items-start">
            {FOOTER.links.map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center text-[0.9375rem] text-white hover:underline">
                {l.label}
              </a>
            ))}
            <Link to="/auth" className="inline-flex min-h-11 items-center text-[0.9375rem] text-white hover:underline">
              Sign in
            </Link>
            <a
              href={OCC_DATA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[0.9375rem] text-white hover:underline"
            >
              OCC data<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>
        <p className="mt-12 border-t border-[#1d3b66] pt-6 text-sm text-[#9db4ce]">
          &copy; {new Date().getFullYear()} MidconSight. Oklahoma permit data from the Oklahoma Corporation Commission.
        </p>
      </div>
    </footer>
  );
}
