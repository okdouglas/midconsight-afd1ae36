/**
 * Company Detail Modal with Contacts Management
 * Enterprise CRM functionality for managing company contacts
 */

import { useState, useEffect } from 'react';
import { X, Plus, User, Phone, Mail, Briefcase, Building2, FileText, Flame, Thermometer, Snowflake, Trash2, Lightbulb } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Company, type Deal } from '@/hooks/useSupabaseData';
import { SellingOpportunities } from '@/components/SellingOpportunities';
import type { Permit } from '@/lib/schema-mapping';
import { 
  saveContact, 
  saveDeal, 
  getContactsByCompany, 
  getDealsByCompany,
  type DbContact,
  type DbDeal
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
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', role: '', notes: '' });
  const [newDeal, setNewDeal] = useState({ 
    name: '', 
    value: '', 
    expectedCloseDate: '',
    notes: '' 
  });

  useEffect(() => {
    if (company) {
      loadCompanyData();
    }
  }, [company]);

  const loadCompanyData = async () => {
    if (!company) return;
    const [contactsData, dealsData] = await Promise.all([
      getContactsByCompany(company.id),
      getDealsByCompany(company.id),
    ]);
    setContacts(contactsData);
    setDeals(dealsData);
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
    });

    setNewDeal({ name: '', value: '', expectedCloseDate: '', notes: '' });
    setShowAddDeal(false);
    loadCompanyData();
    onUpdate?.();
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

  if (!company) return null;

  return (
    <Dialog open={!!company} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

        <Tabs defaultValue="opportunities" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          {/* Selling Opportunities Tab */}
          <TabsContent value="opportunities" className="mt-4">
            <SellingOpportunities
              companyId={company.id}
              companyName={company.name}
              permits={companyPermits}
              onDealCreated={() => {
                loadCompanyData();
                onUpdate?.();
              }}
            />
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
                  <div className="col-span-2">
                    <Label>Expected Close Date</Label>
                    <Input 
                      type="date"
                      value={newDeal.expectedCloseDate} 
                      onChange={(e) => setNewDeal({ ...newDeal, expectedCloseDate: e.target.value })}
                    />
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

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid gap-4">
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
              
              <div className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-2">Lead Score</div>
                <div className="flex items-center gap-2">
                  {getScoreIcon(company.score)}
                  <span className="font-medium capitalize">{company.score}</span>
                  <span className="text-sm text-muted-foreground">
                    — Based on permit activity and volume
                  </span>
                </div>
              </div>

              <div className="border border-border rounded-lg p-4">
                <div className="text-sm text-muted-foreground mb-2">Timeline</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Last Permit:</span>
                    <span className="font-medium">{new Date(company.lastPermitDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>First Tracked:</span>
                    <span className="font-medium">{new Date(company.createdDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {company.operatorNumber && (
                <div className="border border-border rounded-lg p-4">
                  <div className="text-sm text-muted-foreground">Operator Number</div>
                  <div className="font-mono">{company.operatorNumber}</div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
