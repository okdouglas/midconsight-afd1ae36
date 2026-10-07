import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CLOSING, FAQ, FAQ_H2, NEWSLETTER, PRICING } from './content';
import { Eyebrow } from './Frames';
import { useCta } from './useCta';

export function Pricing() {
  const cta = useCta();
  return (
    <section id="pricing" className="bg-[#eef4fa] lp-band" aria-labelledby="pricing-h2">
      <div className="lp-wrap">
        <div className="max-w-3xl">
          <Eyebrow className="mb-5">Pricing</Eyebrow>
          <h2 id="pricing-h2" className="lp-h2 lp-reveal">
            {PRICING.h2}
          </h2>
          <p className="lp-lead lp-reveal mt-6">{PRICING.lead}</p>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {PRICING.plans.map((p) => {
            const featured = 'featured' in p && p.featured;
            const paid = p.id !== 'free';
            const href = cta.signedIn
              ? paid ? `/app?upgrade=${p.id}` : '/app'
              : paid ? `/auth?mode=signup&plan=${p.id}` : '/auth?mode=signup';
            return (
              <article
                key={p.id}
                className={`lp-reveal flex flex-col rounded-lg bg-white p-7 md:p-9 ${
                  featured ? 'border-2 border-[#005a9c] shadow-[0_28px_50px_-30px_rgba(0,90,156,0.55)]' : 'border border-[#d5dfea]'
                }`}
              >
                <h3 className="lp-label text-[#005a9c]">{p.name}</h3>
                <p className="lp-num mt-5 text-[4.5rem] text-[#0b2545]">
                  {p.price}
                  {p.per && <span className="ml-1 text-xl font-medium tracking-normal text-[#5b6f8a]">{p.per}</span>}
                </p>
                <p className="mt-4 min-h-[3.25rem] text-base leading-relaxed text-[#2b3f5c]">{p.limit}</p>
                <ul className="mt-6 flex-1 space-y-3 border-t border-[#eef4fa] pt-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-base text-[#0b2545]">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-[#005a9c]" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={href}
                  className={`lp-btn mt-8 ${featured ? 'lp-btn-primary' : 'lp-btn-outline'}`}
                >
                  {cta.signedIn ? (paid ? `Upgrade to ${p.name}` : 'Go to dashboard') : p.cta}
                </Link>
              </article>
            );
          })}
        </div>
        <p className="mt-8 text-base text-[#5b6f8a]">{PRICING.note}</p>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="bg-white lp-band" aria-labelledby="faq-h2">
      <div className="lp-wrap grid gap-10 lg:grid-cols-[0.8fr_1.4fr] lg:gap-20">
        <div>
          <Eyebrow className="mb-5">FAQ</Eyebrow>
          <h2 id="faq-h2" className="lp-h2">
            {FAQ_H2}
          </h2>
        </div>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <div className="lp-faq-a text-[#2b3f5c]">
                <FaqAnswer a={f.a} link={f.link} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqAnswer({ a, link }: { a: string; link?: { text: string; href: string } }) {
  if (!link) return <p>{a}</p>;
  const i = a.indexOf(link.text);
  return (
    <p>
      {a.slice(0, i)}
      <a href={link.href} target="_blank" rel="noopener noreferrer">
        {link.text}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {a.slice(i + link.text.length)}
    </p>
  );
}

export function ClosingCta() {
  const cta = useCta();
  return (
    <section className="lp-on-dark bg-[#005a9c] lp-band-sm" aria-labelledby="close-h2">
      <div className="lp-wrap flex flex-col gap-8 py-6 md:flex-row md:items-center md:justify-between md:py-10">
        <div>
          <h2 id="close-h2" className="lp-h2 !text-[clamp(2.25rem,1.2rem+4vw,4.25rem)]">
            {CLOSING.h2}
          </h2>
          <p className="mt-4 text-xl text-[#d3e4f4]">{CLOSING.lead}</p>
        </div>
        <Link to={cta.href} className="lp-btn lp-btn-white shrink-0 !min-h-14 !px-8 !text-lg">
          {cta.label}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

/** Weekly summary sign-up for visitors who are not ready to create an account. */
export function Newsletter() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('subscribe', { body: { email } });
      if (error) throw error;
      setDone(true);
      setEmail('');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#eef4fa] lp-band-sm" aria-labelledby="news-h2">
      <div className="lp-wrap">
        <div className="mx-auto max-w-xl text-center">
          {done ? (
            <div role="status">
              <h2 id="news-h2" className="text-2xl font-semibold tracking-tight text-[#0b2545]">
                {NEWSLETTER.doneTitle}
              </h2>
              <p className="mt-2 text-base text-[#2b3f5c]">{NEWSLETTER.doneBody}</p>
            </div>
          ) : (
            <>
              <h2 id="news-h2" className="text-2xl font-semibold tracking-tight text-[#0b2545]">
                {NEWSLETTER.title}
              </h2>
              <p className="mt-2 text-base text-[#2b3f5c]">{NEWSLETTER.body}</p>
              <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                <label htmlFor="news-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="news-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-12 flex-1 rounded-md border border-[#9db4ce] bg-white px-4 text-base text-[#0b2545] placeholder:text-[#5b6f8a]"
                />
                <button type="submit" disabled={loading} className="lp-btn lp-btn-outline shrink-0 disabled:opacity-60">
                  {loading ? 'Sending' : 'Subscribe'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
