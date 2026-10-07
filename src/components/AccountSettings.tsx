import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { openBillingPortal, type DbProfile } from '@/lib/supabase-data';

const PLAN_LABEL = { free: 'Free', starter: 'Starter', pro: 'Pro' } as const;
const PLAN_NOTE = {
  free: 'Permits from the last 30 days, up to 3 deals and 3 products, and no data import.',
  starter: 'Full permit history, operator scores, unlimited deals and products.',
  pro: 'Everything in Starter, plus importing your own permit files and your product catalog.',
} as const;

interface Props {
  email: string | undefined;
  profile: DbProfile | null;
  plan: 'free' | 'starter' | 'pro';
  onProfileSaved: () => void;
  onUpgrade: () => void;
  onSignOut: () => void;
}

export function AccountSettings({ email, profile, plan, onProfileSaved, onUpgrade, onSignOut }: Props) {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setCompanyName(profile.company_name ?? '');
    setMarketing(profile.marketing_consent);
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null, company_name: companyName.trim() || null, marketing_consent: marketing })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save your changes. Please try again.");
      return;
    }
    toast.success('Saved.');
    onProfileSaved();
  };

  const manageBilling = async () => {
    const result = await openBillingPortal();
    if ('url' in result) window.location.href = result.url;
    else if ('notConfigured' in result) toast('Billing is not switched on yet.');
    else if (result.error === 'no_billing_account') {
      toast.error("There is no billing account on file for you yet. If you paid, email us and we'll sort it out.");
    } else toast.error("Couldn't open billing. Please try again.");
  };

  // These columns may not exist yet, so read them defensively.
  const periodEnd = profile?.current_period_end ? new Date(profile.current_period_end) : null;
  const periodEndText =
    periodEnd && !Number.isNaN(periodEnd.getTime())
      ? periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
  const cancelling = profile?.cancel_at_period_end === true;
  const pastDue = plan !== 'free' && profile?.subscription_status === 'past_due';

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plan <Badge variant="secondary">{PLAN_LABEL[plan]}</Badge>
          </CardTitle>
          <CardDescription>{PLAN_NOTE[plan]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pastDue && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
              <span>Your last payment failed. Update your card to keep your plan.</span>
              <Button size="sm" onClick={manageBilling}>Manage billing</Button>
            </div>
          )}
          {plan !== 'free' && periodEndText && (
            <p className="text-sm text-muted-foreground">
              {cancelling ? `Cancels on ${periodEndText}. You keep access until then.` : `Renews on ${periodEndText}.`}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
          {plan === 'pro' ? null : (
            <Button onClick={plan === 'free' ? onUpgrade : manageBilling}>{plan === 'free' ? 'Upgrade' : 'Change plan'}</Button>
          )}
          {plan !== 'free' && (
            <Button variant="outline" onClick={manageBilling}>Manage billing and invoices</Button>
          )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="acct-name">Full name</Label>
            <Input id="acct-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acct-company">Company</Label>
            <Input id="acct-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="acct-marketing" checked={marketing} onCheckedChange={(c) => setMarketing(c === true)} />
            <Label htmlFor="acct-marketing" className="text-sm font-normal text-muted-foreground leading-snug cursor-pointer">
              Send me occasional emails about new features and permit activity.
            </Label>
          </div>
          <Button onClick={save} disabled={saving || !profile}>Save changes</Button>
        </CardContent>
      </Card>

      <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
    </div>
  );
}
