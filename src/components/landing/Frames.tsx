import type { ReactNode } from 'react';

/** Four corner brackets, drawn from the logo's sight corners. Decorative. */
export function Brackets({ children, onDark = false, className = '' }: { children: ReactNode; onDark?: boolean; className?: string }) {
  return (
    <div className={`lp-brackets ${onDark ? 'on-dark' : ''} ${className}`}>
      <span className="lp-b tl" aria-hidden="true" />
      <span className="lp-b tr" aria-hidden="true" />
      <span className="lp-b bl" aria-hidden="true" />
      <span className="lp-b br" aria-hidden="true" />
      {children}
    </div>
  );
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`lp-label text-[#005a9c] ${className}`}>{children}</p>;
}
