import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { requestUpgrade, startCheckout } from '@/lib/supabase-data';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the click came from — logged with the request so demand can be
   *  prioritized by which paywall is actually driving interest. */
  source: string;
}

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$10',
    yearPrice: '$100',
    annual: '$100/yr, two months free',
    features: [
      'Full permit history, not just 30 days',
      'Unlimited deals and products',
      'Data and product import',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    yearPrice: '$200',
    annual: '$200/yr, two months free',
    features: [
      'Everything in Starter',
      'Built for teams that work the pipeline daily',
    ],
  },
] as const;

export function UpgradeDialog({ open, onOpenChange, source }: UpgradeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Default to the tier that unlocks the feature the user clicked on.
  const [tier, setTier] = useState<'starter' | 'pro'>('starter');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  // Set once the server says Stripe is not switched on, so we fall back to the interest form.
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (open) {
      const proSources = ['companies_tab', 'deals_tab', 'products_tab'];
      setTier(proSources.includes(source) ? 'pro' : 'starter');
    }
  }, [open, source]);

  const handleRequest = async () => {
    setLoading(true);
    try {
      if (!manual) {
        const result = await startCheckout(tier, interval);
        if ('url' in result) {
          window.location.href = result.url;
          return;
        }
        if ('error' in result) {
          toast.error(
            result.error === 'already_subscribed'
              ? 'You already have a plan. Use Manage billing to change it.'
              : "Couldn't open checkout. Please try again.",
          );
          return;
        }
        // Billing is not switched on yet: keep the old "request access" path working.
        setManual(true);
      }
      await requestUpgrade(`${source}:${tier}`);
      setSent(true);
    } catch {
      toast.error("Couldn't send that. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSent(false); }}>
      <DialogContent className="sm:max-w-xl">
        {sent ? (
          <div className="py-4 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="mb-2">You're on the list</DialogTitle>
            <DialogDescription>
              We'll reach out to get you set up on {tier === 'pro' ? 'Pro' : 'Starter'}. In the meantime, keep browsing —
              your free plan access doesn't change.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Choose your plan</DialogTitle>
              <DialogDescription>
                {manual
                  ? "Checkout isn't open yet. Tell us you're interested and we'll set your account up directly."
                  : 'Pick a plan and pay securely with Stripe. Cancel any time.'}
              </DialogDescription>
            </DialogHeader>
            {!manual && (
              <div className="flex gap-2" role="group" aria-label="Billing period">
                {(['month', 'year'] as const).map((i) => (
                  <Button
                    key={i}
                    type="button"
                    size="sm"
                    variant={interval === i ? 'default' : 'outline'}
                    onClick={() => setInterval(i)}
                  >
                    {i === 'month' ? 'Monthly' : 'Annual, two months free'}
                  </Button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 my-4">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    tier === t.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'
                  }`}
                >
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-2xl font-semibold mt-1">
                    {interval === 'year' && !manual ? t.yearPrice : t.price}
                    <span className="text-sm font-normal text-muted-foreground">{interval === 'year' && !manual ? '/yr' : '/mo'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">{t.annual}</p>
                  <ul className="space-y-1.5">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <Button onClick={handleRequest} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {manual ? `Request ${tier === 'pro' ? 'Pro' : 'Starter'} access` : `Continue to checkout`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
