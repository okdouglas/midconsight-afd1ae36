import { useState } from 'react';
import { Check, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'midconsight:first-run-dismissed';

interface FirstRunChecklistProps {
  dealCount: number;
  contactCount: number;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function goToTab(tab: string) {
  window.dispatchEvent(new CustomEvent('midconsight:goto-tab', { detail: { tab } }));
}

/** Three first steps for a new account. Check marks come from props, not stored state. */
export function FirstRunChecklist({ dealCount, contactCount }: FirstRunChecklistProps) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [openedCompany, setOpenedCompany] = useState(false);

  const hasContact = contactCount > 0;
  const hasDeal = dealCount > 0;
  if (dismissed || (hasContact && hasDeal)) return null;

  const steps = [
    {
      id: 'company',
      title: 'Open a hot company',
      body: 'Start with an operator that is permitting now.',
      done: openedCompany || hasContact || hasDeal,
      action: 'Open Companies',
      run: () => {
        setOpenedCompany(true);
        goToTab('companies');
      },
    },
    {
      id: 'contact',
      title: 'Add a contact',
      body: 'Save the person you plan to call.',
      done: hasContact,
      action: 'Add contact',
      run: () => goToTab('companies'),
    },
    {
      id: 'deal',
      title: 'Start a deal',
      body: 'Track the lead from first call to close.',
      done: hasDeal,
      action: 'Open Deals',
      run: () => goToTab('deals'),
    },
  ];

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Storage can be blocked. The card still closes for this visit.
    }
  };

  return (
    <section aria-labelledby="first-run-h" className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="first-run-h" className="font-semibold">Get started in three steps</h2>
          <p className="text-sm text-muted-foreground">Go from a hot permit to a deal.</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dismiss} aria-label="Dismiss checklist">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex items-start gap-2">
              {s.done ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {s.title}
                  <span className="sr-only">{s.done ? ' (done)' : ' (not done)'}</span>
                </p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="mt-auto self-start" onClick={s.run} disabled={s.done}>
              {s.action}
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
