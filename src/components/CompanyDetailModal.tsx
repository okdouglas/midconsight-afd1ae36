/**
 * Company Detail Modal with CRM Intelligence
 * Enterprise CRM functionality for managing company contacts, licenses, and client status
 */

import { useState, useEffect } from 'react';
import { 
  X, Plus, User, Phone, Mail, Briefcase, Building2, FileText, 
  Flame, Thermometer, Snowflake, Calendar, MapPin, Edit2, Check, 
  Package, Trash2 
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Company, type Deal } from '@/hooks/useSupabaseData';
import type { Permit } from '@/lib/schema-mapping';
import { cn } from '@/lib/utils';
import { 
  saveContact, 
  saveDeal, 
  getContactsByCompany, 
  getDealsByCompany,
  getSellingOptions,
  updateCompany,
  getLicensePurchases,
  saveLicensePurchase,
  deleteLicensePurchase,
  type DbContact,
  type DbDeal,
  type DbSellingOption,
  type DbLicensePurchase
} from '@/lib/supabase-data';

interface CompanyDetailModalProps {
  company: Company | null;
  companyPermits?: Permit[];
  onClose: () => void;
  onUpdate?: () => void;
}

export function CompanyDetailModal({ company, companyPermits = [], onClose, onUpdate }: CompanyDetailModalProps) {
  const [contacts, setContacts] = useState<DbContact[]>([]);
  const [deals, setDeals] = useState<DbDeal[]>([]);
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);
  const [licensePurchases, setLicensePurchases] = useState<DbLicensePurchase[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', role: '', notes: '' });
  const [newDeal, setNewDeal] = useState({ 
    name: '', 
    value: '', 
    expectedCloseDate: '',
    notes: '',
    sellingOptionId: ''
  });
  const [newLicense, setNewLicense] = useState({ 
    sellingOptionId: '', 
    purchaseDate: new Date(),
    notes: '' 
  });

  // Editable company fields
  const [isCurrentClient, setIsCurrentClient] = useState(false);
  const [hqAddress, setHqAddress] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempHqAddress, setTempHqAddress] = useState('');

  useEffect(() => {
    if (company) {
      loadCompanyData();
      // Initialize editable fields from company data
      setIsCurrentClient(company.isCurrentClient || false);
      setHqAddress(company.hqAddress || '');
      setPrimaryContactId(company.primaryContactId || null);
    }
    loadSellingOptions();
  }, [company]);

  const loadSellingOptions = async () => {
    const options = await getSellingOptions();
    const sortedOptions = [...options].sort((a, b) => {
      const categoryOrder = ['Standard Packages', 'GGX Add-on'];
      const aCatIndex = categoryOrder.indexOf(a.category || 'Standard Packages');
      const bCatIndex = categoryOrder.indexOf(b.category || 'Standard Packages');
      if (aCatIndex !== bCatIndex) {
        return aCatIndex - bCatIndex;
      }
      const aRental = Number(a.annual_rental) || 0;
      const bRental = Number(b.annual_rental) || 0;
      return aRental - bRental;
    });
    setSellingOptions(sortedOptions);
  };

  const loadCompanyData = async () => {
    if (!company) return;
    const [contactsData, dealsData, licensesData] = await Promise.all([
      getContactsByCompany(company.id),
      getDealsByCompany(company.id),
      getLicensePurchases(company.id),
    ]);
    setContacts(contactsData);
    setDeals(dealsData);
    setLicensePurchases(licensesData);
  };

  const handleToggleCurrentClient = async (checked: boolean) => {
    if (!company) return;
    setIsCurrentClient(checked);
    await updateCompany(company.id, { is_current_client: checked });
    onUpdate?.();
  };

  const handleUpdateHqAddress = async () => {
    if (!company) return;
    setHqAddress(tempHqAddress);
    setEditingField(null);
    await updateCompany(company.id, { hq_address: tempHqAddress });
    onUpdate?.();
  };

  const handleUpdatePrimaryContact = async (contactId: string) => {
    if (!company) return;
    const newContactId = contactId === 'none' ? null : contactId;
    setPrimaryContactId(newContactId);
    await updateCompany(company.id, { primary_contact_id: newContactId });
    onUpdate?.();
  };

  const handleAddContact = async () => {
    if (!company || !newContact.name.trim()) return;

    await saveContact({
      company_id: company.id,
      name: newContact.name,
      email: newContact.email || undefined,
      phone: newContact.phone || undefined,
      role: newContact.role || undefined,
      notes: newContact.notes || undefined,
    });

    setNewContact({ name: '', email: '', phone: '', role: '', notes: '' });
    setShowAddContact(false);
    loadCompanyData();
    onUpdate?.();
  };

  const handleAddDeal = async () => {
    if (!company || !newDeal.name.trim()) return;

    await saveDeal({
      company_id: company.id,
      name: newDeal.name,
      stage: 'new_lead',
      value: parseFloat(newDeal.value) || 0,
      expected_close_date: newDeal.expectedCloseDate || undefined,
      status: 'open',
      linked_permit_ids: [],
      notes: newDeal.notes || undefined,
      selling_option_id: newDeal.sellingOptionId && newDeal.sellingOptionId !== 'none' ? newDeal.sellingOptionId : undefined,
      probability: 10,
    });

    setNewDeal({ name: '', value: '', expectedCloseDate: '', notes: '', sellingOptionId: '' });
    setShowAddDeal(false);
    loadCompanyData();
    onUpdate?.();
  };

  const handleAddLicense = async () => {
    if (!company || !newLicense.sellingOptionId) return;

    await saveLicensePurchase({
      company_id: company.id,
      selling_option_id: newLicense.sellingOptionId,
      purchase_date: format(newLicense.purchaseDate, 'yyyy-MM-dd'),
      notes: newLicense.notes || undefined,
    });

    setNewLicense({ sellingOptionId: '', purchaseDate: new Date(), notes: '' });
    setShowAddLicense(false);
    loadCompanyData();
    onUpdate?.();
  };

  const handleDeleteLicense = async (licenseId: string) => {
    await deleteLicensePurchase(licenseId);
    loadCompanyData();
    onUpdate?.();
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('en-US');
  };

  const getScoreIcon = (score: Company['score']) => {
    switch (score) {
      case 'hot': return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm': return <Thermometer className="h-4 w-4 text-amber-500" />;
      case 'cold': return <Snowflake className="h-4 w-4 text-blue-500" />;
    }
  };

  const getScoreBadge = (score: Company['score']) => {
    const variants: Record<Company['score'], string> = {
      hot: 'bg-red-500/20 text-red-400 border-red-500/30',
      warm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      cold: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return variants[score];
  };

  const getPrimaryContact = () => {
    return contacts.find(c => c.id === primaryContactId);
  };

  const getLicenseProduct = (sellingOptionId: string) => {
    return sellingOptions.find(o => o.id === sellingOptionId);
  };

  if (!company) return null;

  const primaryContact = getPrimaryContact();

  return (
    <Dialog open={!!company} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {company.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getScoreBadge(company.score)}>
                  {getScoreIcon(company.score)}
                  <span className="ml-1 capitalize">{company.score} Lead</span>
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {company.permitCount} permits • ${company.totalValue.toLocaleString()} estimated value
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
          </TabsList>

          {/* Info Tab - Client Summary */}
          <TabsContent value="info" className="space-y-4 mt-4">
            {/* Current Client Toggle */}
            <div className="flex items-center justify-between border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center",
                  isCurrentClient ? "bg-green-500/20" : "bg-muted"
                )}>
                  <Building2 className={cn(
                    "h-5 w-5",
                    isCurrentClient ? "text-green-500" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <div className="font-medium">Current Client</div>
                  <div className="text-sm text-muted-foreground">
                    {isCurrentClient ? "Active customer with licenses" : "Prospect or former client"}
                  </div>
                </div>
              </div>
              <Switch
                checked={isCurrentClient}
                onCheckedChange={handleToggleCurrentClient}
              />
            </div>

            {/* Two-column grid for stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Permits</div>
                <div className="text-2xl font-bold">{company.permitCount}</div>
              </div>
              <div className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Est. Value</div>
                <div className="text-2xl font-bold text-primary">${company.totalValue.toLocaleString()}</div>
              </div>
            </div>

            {/* Primary Contact Card */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground">Primary Contact</div>
                <Select 
                  value={primaryContactId || 'none'} 
                  onValueChange={handleUpdatePrimaryContact}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Select contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No primary contact</SelectItem>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {primaryContact ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{primaryContact.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {primaryContact.role || 'No role specified'}
                      {primaryContact.email && ` • ${primaryContact.email}`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  No primary contact selected
                </div>
              )}
            </div>

            {/* HQ Address Card */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  HQ Address
                </div>
                {editingField !== 'hqAddress' ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2"
                    onClick={() => {
                      setTempHqAddress(hqAddress);
                      setEditingField('hqAddress');
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2"
                    onClick={handleUpdateHqAddress}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {editingField === 'hqAddress' ? (
                <Textarea
                  value={tempHqAddress}
                  onChange={(e) => setTempHqAddress(e.target.value)}
                  placeholder="Enter headquarters address..."
                  rows={3}
                  className="text-sm"
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap">
                  {hqAddress || <span className="text-muted-foreground italic">No address on file</span>}
                </div>
              )}
            </div>

            {/* License Information Section */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  License Information
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7"
                  onClick={() => setShowAddLicense(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add License
                </Button>
              </div>

              {showAddLicense && (
                <div className="border border-border rounded-lg p-3 mb-3 bg-muted/30 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Product</Label>
                      <Select
                        value={newLicense.sellingOptionId || 'none'}
                        onValueChange={(v) => setNewLicense({ ...newLicense, sellingOptionId: v === 'none' ? '' : v })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select a product...</SelectItem>
                          {sellingOptions.map(opt => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.name} ({opt.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Purchase Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full h-8 justify-start text-left font-normal"
                          >
                            <Calendar className="mr-2 h-3 w-3" />
                            {format(newLicense.purchaseDate, 'MM/dd/yyyy')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={newLicense.purchaseDate}
                            onSelect={(date) => date && setNewLicense({ ...newLicense, purchaseDate: date })}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={newLicense.notes}
                      onChange={(e) => setNewLicense({ ...newLicense, notes: e.target.value })}
                      placeholder="License notes..."
                      className="h-8"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAddLicense(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleAddLicense} disabled={!newLicense.sellingOptionId}>
                      Add License
                    </Button>
                  </div>
                </div>
              )}

              {licensePurchases.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">
                  No licenses on file
                </div>
              ) : (
                <div className="space-y-2">
                  {licensePurchases.map(license => {
                    const product = getLicenseProduct(license.selling_option_id || '');
                    return (
                      <div key={license.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <div>
                            <div className="text-sm font-medium">
                              {product?.name || 'Unknown Product'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {product?.type} • Purchased {format(new Date(license.purchase_date), 'MM/dd/yyyy')}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteLicense(license.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Timeline Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Lead Score</div>
                <div className="flex items-center gap-2">
                  {getScoreIcon(company.score)}
                  <span className="font-medium capitalize">{company.score}</span>
                </div>
              </div>
              <div className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-1">Last Permit</div>
                <div className="font-medium">
                  {new Date(company.lastPermitDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {company.operatorNumber && (
              <div className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Operator Number</div>
                <div className="font-mono">{company.operatorNumber}</div>
              </div>
            )}
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Company Contacts</h4>
              <Button size="sm" onClick={() => setShowAddContact(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Contact
              </Button>
            </div>

            {showAddContact && (
              <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input 
                      value={newContact.name} 
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Input 
                      value={newContact.role} 
                      onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                      placeholder="Land Manager"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={newContact.email} 
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input 
                      value={newContact.phone} 
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      placeholder="(405) 555-1234"
                    />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea 
                    value={newContact.notes} 
                    onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                    placeholder="Additional notes about this contact..."
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddContact(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddContact}>
                    Save Contact
                  </Button>
                </div>
              </div>
            )}

            {contacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No contacts yet</p>
                <p className="text-sm">Add your first contact to start building relationships</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map(contact => (
                  <div key={contact.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          {contact.name}
                          {contact.id === primaryContactId && (
                            <Badge variant="outline" className="text-xs">Primary</Badge>
                          )}
                        </div>
                        {contact.role && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Briefcase className="h-3 w-3" />
                            {contact.role}
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        {contact.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    {contact.notes && (
                      <p className="text-sm text-muted-foreground mt-2 border-t border-border pt-2">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Associated Deals</h4>
              <Button size="sm" onClick={() => setShowAddDeal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Deal
              </Button>
            </div>

            {showAddDeal && (
              <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Deal Name *</Label>
                    <Input 
                      value={newDeal.name} 
                      onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                      placeholder="Q1 Drilling Services"
                    />
                  </div>
                  <div>
                    <Label>Value ($)</Label>
                    <Input 
                      type="number"
                      value={newDeal.value} 
                      onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <Label>Expected Close Date</Label>
                    <Input 
                      type="date"
                      value={newDeal.expectedCloseDate} 
                      onChange={(e) => setNewDeal({ ...newDeal, expectedCloseDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Product</Label>
                    <Select
                      value={newDeal.sellingOptionId || 'none'}
                      onValueChange={(v) => setNewDeal({ ...newDeal, sellingOptionId: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No product</SelectItem>
                        {sellingOptions.map(opt => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name} - ${formatCurrency(Number(opt.annual_rental) || Number(opt.default_price))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea 
                    value={newDeal.notes} 
                    onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                    placeholder="Deal details and context..."
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddDeal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddDeal}>
                    Create Deal
                  </Button>
                </div>
              </div>
            )}

            {deals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No deals yet</p>
                <p className="text-sm">Create a deal to track this opportunity</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deals.map(deal => (
                  <div key={deal.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{deal.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Stage: <span className="capitalize">{deal.stage?.replace('_', ' ') || 'New Lead'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">${Number(deal.value || 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          Close: {deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : 'TBD'}
                        </div>
                      </div>
                    </div>
                    {deal.notes && (
                      <p className="text-sm text-muted-foreground mt-2 border-t border-border pt-2">
                        {deal.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
