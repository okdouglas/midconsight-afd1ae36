/**
 * Research Sidebar Component
 * Side panel for researching and enriching permit data
 */

import { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Package,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Calendar,
  FileText
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
  promoteCompanyPreview,
  suggestBestProduct,
  type DbSellingOption,
  type DbContact 
} from '@/lib/supabase-data';
import { toast } from 'sonner';

type ResearchStatus = 'new' | 'researching' | 'verified' | 'current_client' | 'archived';

interface ResearchSidebarProps {
  permit: Permit;
  allPermits?: Permit[];
  companies: Company[];
  onClose: () => void;
  onStatusChange: (status: ResearchStatus) => void;
  onDealCreated: () => void;
  onRefresh: () => void;
}

export function ResearchSidebar({ 
  permit, 
  allPermits = [permit],
  companies, 
  onClose, 
  onStatusChange,
  onDealCreated,
  onRefresh 
}: ResearchSidebarProps) {
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);
  const [existingContacts, setExistingContacts] = useState<DbContact[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [dealValue, setDealValue] = useState<number>(0);
  const [dealNotes, setDealNotes] = useState<string>('');
  
  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRole, setContactRole] = useState('');
  
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);

  // Find matching company
  const company = companies.find(c => c.name === permit.operator);

  // Companies built from the shared feed are previews with no database row yet.
  // Save one before writing a contact or deal against it.
  const ensureRealCompanyId = async (): Promise<string | null> => {
    if (!company) return null;
    if (!company.isPreview) return company.id;
    const real = await promoteCompanyPreview({
      name: company.name,
      operatorNumber: company.operatorNumber,
      permitCount: company.permitCount,
      totalValue: company.totalValue,
      score: company.score,
      lastPermitDate: company.lastPermitDate,
      city: company.city,
      state: company.state,
    });
    onRefresh();
    return real.id;
  };

  // Calculate totals for this operator
  const totalPermits = allPermits.length;
  const estimatedValue = allPermits.reduce((sum, p) => sum + (p.estimatedValue || 5000), 0);

  useEffect(() => {
    getSellingOptions().then(opts => {
      setSellingOptions(opts);
      // Auto-suggest the best-fit product based on the permit's actual
      // formation/well type/depth — matched against whatever criteria
      // this account's own catalog has set, not hardcoded product names.
      const match = suggestBestProduct(permit, opts);
      if (match) {
        setSelectedProductId(match.product.id);
        setDealValue(match.product.default_price);
      }
    });

    if (company && !company.isPreview) {
      getContactsByCompany(company.id).then(setExistingContacts);
    }
  }, [permit, company]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = sellingOptions.find(o => o.id === productId);
    if (product) {
      setDealValue(product.default_price);
    }
  };

  const handleAddContact = async () => {
    if (!company || !contactName.trim()) {
      toast.error('Please enter a contact name');
      return;
    }

    try {
      const companyId = await ensureRealCompanyId();
      if (!companyId) throw new Error('No company');
      await saveContact({
        company_id: companyId,
        name: contactName,
        email: contactEmail || undefined,
        phone: contactPhone || undefined,
        role: contactRole || undefined,
      });
      
      toast.success('Contact added');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactRole('');
      
      // Refresh contacts
      const contacts = await getContactsByCompany(companyId);
      setExistingContacts(contacts);
      onRefresh();
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

      const companyId = await ensureRealCompanyId();
      if (!companyId) throw new Error('No company');
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
      console.error('Failed to create deal:', error);
      toast.error('Failed to create deal');
    } finally {
      setIsCreatingDeal(false);
    }
  };

  return (
    <div className="w-96 border border-border rounded-lg bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Research Panel</h3>
          <p className="text-xs text-muted-foreground">{permit.operator}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Operator Summary */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{permit.county}, {permit.state}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {permit.approvalDate 
                  ? new Date(permit.approvalDate).toLocaleDateString()
                  : 'No date'
                }
              </span>
            </div>
            {permit.wellName && (
              <div className="flex items-center gap-2 col-span-2">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground truncate">{permit.wellName}</span>
              </div>
            )}
          </div>

          <Badge variant="outline" className="text-xs">
            {totalPermits} total permit{totalPermits > 1 ? 's' : ''} • ${estimatedValue.toLocaleString()} est. value
          </Badge>
        </div>

        <Separator />

        {/* Contact Finder */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Contact Information</Label>
          
          {existingContacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Existing contacts:</p>
              {existingContacts.slice(0, 3).map(contact => (
                <div key={contact.id} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{contact.name}</span>
                  {contact.role && <Badge variant="outline" className="text-xs ml-auto">{contact.role}</Badge>}
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
              disabled={!company || !contactName.trim()}
            >
              <User className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        <Separator />

        {/* Product Matcher */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">Recommended Product</Label>
          
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
        <Button 
          className="w-full"
          onClick={handleConvertToDeal}
          disabled={isCreatingDeal || !company}
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
