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
  free: 'Permits 30+ days old, with a small starter set of tools.',
  starter: 'Live permit feed, Lead Research and data import.',
  pro: 'Everything in Starter, plus Companies, Deals and the Product Catalog.',
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
    else toast.error("Couldn't open billing. Please try again.");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plan <Badge variant="secondary">{PLAN_LABEL[plan]}</Badge>
          </CardTitle>
          <CardDescription>{PLAN_NOTE[plan]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {plan === 'pro' ? null : <Button onClick={onUpgrade}>{plan === 'free' ? 'Upgrade' : 'Change plan'}</Button>}
          {plan !== 'free' && (
            <Button variant="outline" onClick={manageBilling}>Manage billing and invoices</Button>
          )}
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
