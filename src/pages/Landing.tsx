import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Map, Users, DollarSign, Package, Search, ArrowRight, Check, BarChart3, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Sample rows for the hero "type log" — illustrative only, not live data.
const LOG_ROWS: { band: 'hot' | 'warm' | 'cold'; operator: string; county: string; meta: string }[] = [
  { band: 'hot', operator: 'Continental Resources', county: 'Grady Co, OK', meta: 'Filed 2d ago' },
  { band: 'warm', operator: 'Devon Energy', county: 'Canadian Co, OK', meta: 'Filed 4d ago' },
  { band: 'hot', operator: 'Marathon Oil', county: 'Kingfisher Co, OK', meta: 'Filed 5d ago' },
  { band: 'cold', operator: 'Cimarex / Coterra', county: 'Blaine Co, OK', meta: 'Filed 6d ago' },
  { band: 'warm', operator: 'Ovintiv USA', county: 'Grady Co, OK', meta: 'Filed 8d ago' },
  { band: 'hot', operator: 'Chaparral Energy', county: 'Garvin Co, OK', meta: 'Filed 9d ago' },
];

const bandColor: Record<string, string> = {
  hot: 'bg-score-hot',
  warm: 'bg-score-warm',
  cold: 'bg-score-cold',
};

const FEATURES = [
  {
    icon: Map,
    title: 'Permit mapping',
    body: 'Every new filing plotted by county the moment it lands, with layered filters for operator, formation, and status.',
  },
  {
    icon: BarChart3,
    title: 'Lead scoring',
    body: 'Permits are ranked hot, warm, or cold automatically, so your team works the filings most likely to convert first.',
  },
  {
    icon: Users,
    title: 'Company tracking',
    body: 'Every operator tied to their filing history, contacts, and deal status in one record — no more scattered spreadsheets.',
  },
  {
    icon: DollarSign,
    title: 'Deal pipeline',
    body: 'Move leads from filing to close with a pipeline built around how land and BD teams actually work permits.',
  },
  {
    icon: Search,
    title: 'Research desk',
    body: 'Pull operator and company background without leaving the platform — built for the diligence that precedes outreach.',
  },
  {
    icon: Package,
    title: 'Product catalog',
    body: 'Match your service or product lines to the operators and formations where they fit, so BD outreach targets itself.',
  },
];

export default function Landing() {
  const { user } = useAuth();
  const ctaHref = user ? '/app' : '/auth';
  const ctaLabel = user ? 'Go to dashboard' : 'Start free';

  const [subEmail, setSubEmail] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [subDone, setSubDone] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail) return;
    setSubLoading(true);
    try {
      const { error } = await supabase.functions.invoke('subscribe', {
        body: { email: subEmail },
      });
      if (error) throw error;
      setSubDone(true);
      setSubEmail('');
    } catch {
      toast.error('Something went wrong — please try again.');
    } finally {
      setSubLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Database className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-lg">MidconSight</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          </nav>
          <Button asChild size="sm">
            <Link to={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-plat-grid opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="container relative mx-auto px-4 py-20 md:py-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <p className="font-mono text-xs tracking-widest text-primary uppercase mb-5">
              Permit intelligence for land &amp; business development
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-[3.25rem] leading-[1.08] font-semibold tracking-tight mb-6">
              Every new Midcontinent permit — scored, mapped, and ready to work.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-xl">
              MidconSight pulls new drilling permits daily, ranks them as leads, and hands your
              team a working pipeline — permits, operators, and deals in one platform, instead
              of a folder of spreadsheets and a bookmarked ITD tab.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to={ctaHref}>
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#platform">See the platform</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">No credit card required to start.</p>
          </div>

          {/* Signature visual: the "type log" — a stratigraphy-style feed of scored permits */}
          <div className="relative rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/60">
              <span className="font-mono text-xs tracking-wide text-muted-foreground">PERMIT_LOG // sample</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-score-hot" />
                <span className="h-2 w-2 rounded-full bg-score-warm" />
                <span className="h-2 w-2 rounded-full bg-score-cold" />
              </div>
            </div>
            <div className="divide-y divide-border">
              {LOG_ROWS.map((row, i) => (
                <div key={i} className="flex items-stretch">
                  <div className={`w-1.5 shrink-0 ${bandColor[row.band]}`} />
                  <div className="flex-1 flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium leading-tight">{row.operator}</p>
                      <p className="text-xs text-muted-foreground">{row.county}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{row.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem framing */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
            Permit filings move fast. Most teams still track them by hand.
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              New drilling permits get filed daily across the Midcontinent, but turning a raw
              filing into a qualified lead still means checking state sites, cross-referencing
              operators, and updating a spreadsheet before anyone can act on it.
            </p>
            <p>
              By the time a permit is qualified by hand, a faster competitor has often already
              made the call. MidconSight closes that gap — permits are scored and mapped the
              day they're filed.
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section id="platform" className="border-y border-border bg-secondary/40">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-12">
            <p className="font-mono text-xs tracking-widest text-primary uppercase mb-3">Platform</p>
            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
              One place to find, score, and work every permit.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-border bg-card p-6">
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="container mx-auto px-4 py-16 md:py-20">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-xs tracking-widest text-primary uppercase mb-3">How it works</p>
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
            From filing to closed deal, in three steps.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { n: '01', title: 'Permits sync in', body: 'New ITD wells and formations data imports daily — no manual downloads or copy-paste.' },
            { n: '02', title: 'Leads get scored', body: 'Each permit is ranked hot, warm, or cold and plotted on the map, ready to triage.' },
            { n: '03', title: 'Deals move forward', body: 'Track outreach, company detail, and deal stage in the same platform where the lead surfaced.' },
          ].map((s) => (
            <div key={s.n}>
              <span className="font-mono text-sm text-primary">{s.n}</span>
              <h3 className="font-display font-semibold text-lg mt-2 mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden border-t border-border bg-foreground text-background">
        <div className="absolute inset-0 bg-plat-grid opacity-[0.08]" />
        <div className="container relative mx-auto px-4 py-16 md:py-20 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-4">
            Stop finding out about permits secondhand.
          </h2>
          <p className="text-background/70 mb-8 max-w-lg mx-auto">
            Start scoring and mapping filings the day they're recorded.
          </p>
          <Button asChild size="lg" className="gap-2">
            <Link to={ctaHref}>
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center justify-center gap-6 mt-6 text-xs text-background/60">
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Newsletter / waitlist capture — for visitors not ready to sign up yet */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 py-14">
          <div className="max-w-md mx-auto text-center">
            {subDone ? (
              <>
                <Mail className="h-8 w-8 mx-auto text-primary mb-3" />
                <h3 className="font-display font-semibold text-lg mb-1">You're on the list</h3>
                <p className="text-sm text-muted-foreground">
                  We'll send a weekly summary of new Midcontinent permits — no login required.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-display font-semibold text-lg mb-1">Not ready to sign up?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get a weekly summary of new permits in your inbox — no account needed.
                </p>
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={subEmail}
                    onChange={(e) => setSubEmail(e.target.value)}
                    className="bg-background"
                  />
                  <Button type="submit" disabled={subLoading} variant="outline" className="shrink-0">
                    {subLoading ? 'Sending…' : 'Subscribe'}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
            <Database className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-display font-medium text-foreground">MidconSight</span>
        </div>
        <p>&copy; {new Date().getFullYear()} MidconSight. All rights reserved.</p>
      </footer>
    </div>
  );
}
