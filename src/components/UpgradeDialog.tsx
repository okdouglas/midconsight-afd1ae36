import { useState } from 'react';
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
import { requestUpgrade } from '@/lib/supabase-data';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the click came from — logged with the request so demand can be
   *  prioritized by which paywall is actually driving interest. */
  source: string;
}

const UNLOCKS = [
  'Live permit feed — no 30-day delay',
  'Companies & deal pipeline',
  'Lead Research triage',
  'Product catalog',
  'Manual + automated data import',
];

export function UpgradeDialog({ open, onOpenChange, source }: UpgradeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      await requestUpgrade(source);
      setSent(true);
    } catch {
      toast.error("Couldn't send that — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSent(false); }}>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="py-4 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="mb-2">You're on the list</DialogTitle>
            <DialogDescription>
              We'll reach out to get you set up on paid. In the meantime, keep browsing —
              your free plan access doesn't change.
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Upgrade to paid</DialogTitle>
              <DialogDescription>
                Self-serve checkout is coming soon. For now, tell us you're interested and
                we'll set your account up directly.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2 my-4">
              {UNLOCKS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <Button onClick={handleRequest} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request access
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
