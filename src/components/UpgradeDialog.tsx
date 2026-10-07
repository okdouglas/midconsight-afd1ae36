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
import { openBillingPortal, requestUpgrade, startCheckout } from '@/lib/supabase-data';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the click came from — logged with the request so demand can be
   *  prioritized by which paywall is actually driving interest. */
  source: string;
  /** The user's current plan, so we can mark it and send subscribers to the billing portal. */
  currentPlan?: 'free' | 'starter' | 'pro';
}

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$10',
    yearPrice: '$100',
    yearSaving: '$20 less per year than paying monthly',
    features: [
      'Full permit history, not just 30 days',
      'Operator scores for every operator',
      'Unlimited deals and products',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$20',
    yearPrice: '$200',
    yearSaving: '$40 less per year than paying monthly',
    features: [
      'Everything in Starter',
      'Import your own permit files',
      'Import your product catalog from a spreadsheet',
    ],
  },
] as const;

export function UpgradeDialog({ open, onOpenChange, source, currentPlan = 'free' }: UpgradeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Default to the tier that unlocks the feature the user clicked on.
  const [tier, setTier] = useState<'starter' | 'pro'>('starter');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  // Set once the server says Stripe is not switched on, so we fall back to the interest form.
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (open) {
      const proSources = ['data_tab', 'product_import'];
      setTier(proSources.includes(source) ? 'pro' : 'starter');
    }
  }, [open, source]);

  const subscribed = currentPlan !== 'free';
  const isCurrent = subscribed && tier === currentPlan;

  const handleRequest = async () => {
    setLoading(true);
    try {
      // Subscribers change plans in the billing portal. Checkout would refuse them.
      if (subscribed) {
        const result = await openBillingPortal();
        if ('url' in result) {
          window.location.href = result.url;
          return;
        }
        toast.error(
          'error' in result && result.error === 'no_billing_account'
            ? "There is no billing account on file for you yet. If you paid, email us and we'll sort it out."
            : "Couldn't open billing. Please try again.",
        );
        return;
      }
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
              We'll reach out to get you set up on {tier === 'pro' ? 'Pro' : 'Starter'}. In the meantime, keep browsing. Your free plan access doesn't change.
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
                    aria-pressed={interval === i}
                    onClick={() => setInterval(i)}
                  >
                    {i === 'month' ? 'Monthly' : 'Annual (two months free)'}
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
                  aria-pressed={tier === t.id}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    tier === t.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'
                  }`}
                >
                  <p className="font-semibold flex items-center gap-2">
                    {t.name}
                    {currentPlan === t.id && (
                      <span className="text-xs font-medium rounded-full bg-primary/10 text-primary px-2 py-0.5">Current plan</span>
                    )}
                  </p>
                  <p className="text-2xl font-semibold mt-1">
                    {interval === 'year' && !manual ? t.yearPrice : t.price}
                    <span className="text-sm font-normal text-muted-foreground">{interval === 'year' && !manual ? '/yr' : '/mo'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mb-3 min-h-4">
                    {interval === 'year' && !manual ? t.yearSaving : ''}
                  </p>
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
            <Button onClick={handleRequest} disabled={loading || isCurrent} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCurrent
                ? 'This is your current plan'
                : subscribed
                  ? 'Change plan in billing'
                  : manual
                    ? `Request ${tier === 'pro' ? 'Pro' : 'Starter'} access`
                    : `Continue to checkout`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
