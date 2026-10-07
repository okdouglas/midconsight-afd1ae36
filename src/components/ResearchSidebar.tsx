/**
 * Research Sidebar Component
 * Side panel for researching and enriching permit data
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  User,
  Package,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Mail,
  Phone,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type Permit } from '@/lib/schema-mapping';
import { type Company } from '@/hooks/useSupabaseData';
import {
  getSellingOptions,
  saveDeal,
  saveContact,
  getContactsByCompany,
  getDealsByCompany,
  isFreeLimitError,
  suggestBestProductForPermits,
  type DbSellingOption,
  type DbContact,
  type DbDeal
} from '@/lib/supabase-data';
import { ensureRealCompany } from '@/lib/research-company';
import { isNewDrill, permitDate } from '@/lib/scoring';
import { toast } from 'sonner';

type ResearchStatus = 'new' | 'researching' | 'verified' | 'current_client' | 'archived';

interface ResearchSidebarProps {
  /** The operator's latest permit. */
  permit: Permit;
  allPermits?: Permit[];
  companies: Company[];
  onClose: () => void;
  onStatusChange: (status: ResearchStatus) => void;
  onDealCreated: () => void;
  onRefresh: () => void;
}

const STAGE_LABEL: Record<DbDeal['stage'], string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

function goToProducts() {
  window.dispatchEvent(new CustomEvent('midconsight:goto-tab', { detail: { tab: 'products' } }));
}

function permitLine(p: Permit): string {
  const d = permitDate(p);
  const date = d ? new Date(d).toLocaleDateString() : 'No date';
  const depth = p.totalDepth ? `${p.totalDepth.toLocaleString()} ft` : null;
  return [date, p.drillType, p.formationName, depth, p.county].filter(Boolean).join(' · ');
}

// The parent keys this component by operator, so notes, the contact form and
// the product pick all reset when another lead opens.
export function ResearchSidebar({
  permit,
  allPermits = [permit],
  companies,
  onClose,
  onDealCreated,
  onRefresh
}: ResearchSidebarProps) {
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [existingContacts, setExistingContacts] = useState<DbContact[]>([]);
  const [existingDeal, setExistingDeal] = useState<DbDeal | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [dealValue, setDealValue] = useState<number>(0);
  const [dealNotes, setDealNotes] = useState<string>('');
  const pickedByUser = useRef(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRole, setContactRole] = useState('');

  const [isCreatingDeal, setIsCreatingDeal] = useState(false);

  // Find matching company
  const company = companies.find(c => c.name === permit.operator);
  const companyKey = company ? `${company.id}:${company.isPreview ? 'p' : 'r'}` : '';

  const totalPermits = allPermits.length;
  const newDrillCount = useMemo(() => allPermits.filter(isNewDrill).length, [allPermits]);
  const lastFive = useMemo(
    () => [...allPermits].sort((a, b) => permitDate(b).localeCompare(permitDate(a))).slice(0, 5),
    [allPermits]
  );

  // Best product across every permit this operator has, with the reason.
  const fit = useMemo(
    () => suggestBestProductForPermits(allPermits, sellingOptions),
    [allPermits, sellingOptions]
  );

  useEffect(() => {
    let cancelled = false;
    getSellingOptions()
      .then(opts => { if (!cancelled) setSellingOptions(opts); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCatalogLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // Pre-select the best fit until the user picks something themselves.
  const fitProductId = fit?.product.id;
  const fitPrice = fit?.product.default_price;
  useEffect(() => {
    if (pickedByUser.current || !fitProductId) return;
    setSelectedProductId(fitProductId);
    setDealValue(fitPrice ?? 0);
  }, [fitProductId, fitPrice]);

  // Contacts and any open deal exist only for a saved company.
  useEffect(() => {
    if (!company || company.isPreview) {
      setExistingContacts([]);
      setExistingDeal(null);
      return;
    }
    let cancelled = false;
    getContactsByCompany(company.id).then(c => { if (!cancelled) setExistingContacts(c); }).catch(() => {});
    getDealsByCompany(company.id)
      .then(ds => { if (!cancelled) setExistingDeal(ds.find(d => d.status === 'open') ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyKey]);

  const handleProductChange = (productId: string) => {
    pickedByUser.current = true;
    setSelectedProductId(productId);
    const product = sellingOptions.find(o => o.id === productId);
    if (product) {
      setDealValue(product.default_price);
    }
  };

  const canSaveContact = !!company && !!contactName.trim() && !!(contactEmail.trim() || contactPhone.trim());

  const handleAddContact = async () => {
    if (!company || !contactName.trim()) {
      toast.error('Please enter a contact name');
      return;
    }
    if (!contactEmail.trim() && !contactPhone.trim()) {
      toast.error('Add a phone number or an email');
      return;
    }

    try {
      const { id: companyId, promoted } = await ensureRealCompany(company);
      if (promoted) onRefresh();
      await saveContact({
        company_id: companyId,
        name: contactName.trim(),
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        role: contactRole.trim() || undefined,
      });

      toast.success('Contact added');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactRole('');

      const contacts = await getContactsByCompany(companyId);
      setExistingContacts(contacts);
    } catch (error) {
      toast.error('Failed to add contact');
    }
  };

  const handleConvertToDeal = async () => {
    if (!company) {
      toast.error('No company found for this operator');
      return;
    }
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }

    setIsCreatingDeal(true);
    try {
      const product = sellingOptions.find(o => o.id === selectedProductId);
      const dealName = `${company.name} - ${product?.name || 'New Deal'}`;

      // Calculate expected close date (30 days from now)
      const expectedClose = new Date();
      expectedClose.setDate(expectedClose.getDate() + 30);

      const { id: companyId, promoted } = await ensureRealCompany(company);
      if (promoted) onRefresh();

      // One open deal per company: point to it instead of making a copy.
      const open = (await getDealsByCompany(companyId)).find(d => d.status === 'open');
      if (open) {
        setExistingDeal(open);
        toast.info(`You already have an open deal for ${company.name}.`);
        return;
      }

      await saveDeal({
        company_id: companyId,
        name: dealName,
        stage: 'contacted', // Start in Contacted (30%)
        value: dealValue,
        expected_close_date: expectedClose.toISOString().split('T')[0],
        status: 'open',
        linked_permit_ids: allPermits.map(p => p.id),
        notes: dealNotes || `Created from Research Desk. ${allPermits.length} permits linked.`,
        selling_option_id: selectedProductId,
        probability: 30, // Contacted stage probability
      });

      toast.success('Deal created in pipeline!');
      onDealCreated();
    } catch (error) {
      // The free plan limit already opens the upgrade dialog. No error toast on top.
      if (isFreeLimitError(error)) return;
      console.error('Failed to create deal:', error);
      toast.error('Failed to create deal');
    } finally {
      setIsCreatingDeal(false);
    }
  };

  const hasCatalog = sellingOptions.length > 0;

  return (
    <div className="w-96 border border-border rounded-lg bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Research Panel</h3>
          <p className="text-xs text-muted-foreground">{permit.operator}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close research panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Operator Summary */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{permit.county}, {permit.state}</span>
          </div>

          <Badge variant="outline" className="text-xs">
            {totalPermits} permit{totalPermits === 1 ? '' : 's'} · {newDrillCount} new drill{newDrillCount === 1 ? '' : 's'}
          </Badge>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Last {lastFive.length} permit{lastFive.length === 1 ? '' : 's'}</Label>
            <ul className="space-y-1">
              {lastFive.map(p => (
                <li key={p.id} className="text-xs text-foreground rounded bg-muted/30 px-2 py-1">
                  {permitLine(p)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator />

        {/* Contacts */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Contacts</Label>

          {existingContacts.length > 0 && (
            <div className="space-y-2">
              {existingContacts.map(contact => (
                <div key={contact.id} className="text-sm p-2 bg-muted/30 rounded space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>{contact.name}</span>
                    {contact.role && <Badge variant="outline" className="text-xs ml-auto">{contact.role}</Badge>}
                  </div>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-primary hover:underline">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-primary hover:underline">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Input
              placeholder="Contact name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <Input
                placeholder="Phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <Input
              placeholder="Role (e.g. Operations Manager)"
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddContact}
              disabled={!canSaveContact}
            >
              <User className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
            <p className="text-xs text-muted-foreground">Name and a phone or email.</p>
          </div>
        </div>

        <Separator />

        {/* Product Matcher */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">{fit ? 'Recommended Product' : 'Product'}</Label>

          {fit && (
            <p className="text-xs text-muted-foreground">
              Best fit: {fit.product.name}. {fit.reason}.
            </p>
          )}
          {catalogLoaded && !fit && (
            <div className="rounded border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              {hasCatalog
                ? 'No product in your catalog matches this operator\'s permits. '
                : 'You have no products yet. '}
              <button type="button" onClick={goToProducts} className="text-primary font-medium hover:underline">
                Open the Products tab
              </button>
            </div>
          )}

          <Select value={selectedProductId} onValueChange={handleProductChange}>
            <SelectTrigger>
              <Package className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {sellingOptions.map(option => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name} - ${option.default_price.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Deal Value</Label>
            <Input
              type="number"
              value={dealValue}
              onChange={(e) => setDealValue(Number(e.target.value))}
              className="text-lg font-semibold"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
            <Textarea
              placeholder="Add notes about this opportunity..."
              value={dealNotes}
              onChange={(e) => setDealNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
        {existingDeal && (
          <div className="flex items-start gap-2 rounded border border-border bg-muted/30 p-2 text-xs">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <span>
              Open deal already exists: {existingDeal.name} ({STAGE_LABEL[existingDeal.stage]}). Find it in the Deals tab.
            </span>
          </div>
        )}
        <Button
          className="w-full"
          onClick={handleConvertToDeal}
          disabled={isCreatingDeal || !company || !!existingDeal}
        >
          {isCreatingDeal ? (
            <>Converting...</>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Convert to Deal
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          Creates deal in "Contacted (30%)" stage
        </p>
      </div>
    </div>
  );
}
