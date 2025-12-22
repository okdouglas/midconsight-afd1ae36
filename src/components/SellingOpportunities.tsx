/**
 * Selling Opportunities Component
 * Scans permits and suggests deals based on trigger types
 */

import { useState, useEffect, useMemo } from 'react';
import { Lightbulb, ArrowRight, MapPin, Calendar, DollarSign, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  getSellingOptions, 
  saveDeal, 
  type DbSellingOption 
} from '@/lib/supabase-data';
import type { Permit } from '@/lib/schema-mapping';

interface SellingOpportunitiesProps {
  companyId: string;
  companyName: string;
  permits: Permit[];
  onDealCreated?: () => void;
}

interface SuggestedDeal {
  sellingOption: DbSellingOption;
  matchingPermits: Permit[];
  reason: string;
}

export function SellingOpportunities({ 
  companyId, 
  companyName, 
  permits, 
  onDealCreated 
}: SellingOpportunitiesProps) {
  const { toast } = useToast();
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedDeal | null>(null);
  const [dealForm, setDealForm] = useState({
    name: '',
    value: '',
    expectedCloseDate: '',
    notes: '',
    selectedPermitId: '',
  });

  useEffect(() => {
    loadSellingOptions();
  }, []);

  const loadSellingOptions = async () => {
    try {
      const options = await getSellingOptions();
      setSellingOptions(options);
    } catch (error) {
      console.error('Failed to load selling options:', error);
    }
  };

  // Match permits to selling options based on trigger types
  const suggestedDeals = useMemo<SuggestedDeal[]>(() => {
    if (!permits.length || !sellingOptions.length) return [];

    const suggestions: SuggestedDeal[] = [];
    const recentPermits = permits.filter(p => {
      const daysSinceImport = Math.floor(
        (Date.now() - new Date(p.dateImported).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceImport <= 30; // Consider permits from last 30 days
    });

    for (const option of sellingOptions) {
      if (!option.trigger_type) continue;

      let matchingPermits: Permit[] = [];
      let reason = '';

      switch (option.trigger_type) {
        case 'new_permit':
          matchingPermits = recentPermits;
          if (matchingPermits.length > 0) {
            reason = `${matchingPermits.length} new permits in the last 30 days`;
          }
          break;

        case 'horizontal_drill':
          matchingPermits = permits.filter(
            p => p.drillType?.toLowerCase().includes('horizontal') ||
                 p.wellType?.toLowerCase().includes('horizontal')
          );
          if (matchingPermits.length > 0) {
            reason = `${matchingPermits.length} horizontal drilling permits detected`;
          }
          break;

        case 'vertical_drill':
          matchingPermits = permits.filter(
            p => p.drillType?.toLowerCase().includes('vertical') ||
                 p.wellType?.toLowerCase().includes('vertical')
          );
          if (matchingPermits.length > 0) {
            reason = `${matchingPermits.length} vertical drilling permits detected`;
          }
          break;

        case 'deep_well':
          matchingPermits = permits.filter(p => (p.totalDepth || 0) >= 10000);
          if (matchingPermits.length > 0) {
            reason = `${matchingPermits.length} deep well permits (>10,000 ft)`;
          }
          break;

        case 'shallow_well':
          matchingPermits = permits.filter(p => 
            (p.totalDepth || 0) > 0 && (p.totalDepth || 0) < 5000
          );
          if (matchingPermits.length > 0) {
            reason = `${matchingPermits.length} shallow well permits (<5,000 ft)`;
          }
          break;

        case 'high_value':
          matchingPermits = permits.filter(p => (p.estimatedValue || 0) >= 10000);
          if (matchingPermits.length > 0) {
            reason = `${matchingPermits.length} high-value permits detected`;
          }
          break;

        case 'formation_specific':
          matchingPermits = permits.filter(p => p.formationName);
          if (matchingPermits.length > 0) {
            reason = `${matchingPermits.length} permits with formation data`;
          }
          break;
      }

      if (matchingPermits.length > 0) {
        suggestions.push({
          sellingOption: option,
          matchingPermits,
          reason,
        });
      }
    }

    return suggestions;
  }, [permits, sellingOptions]);

  const handleConvertClick = (suggestion: SuggestedDeal) => {
    setSelectedSuggestion(suggestion);
    setDealForm({
      name: `${companyName} - ${suggestion.sellingOption.name}`,
      value: String(suggestion.sellingOption.default_price || ''),
      expectedCloseDate: '',
      notes: `Suggested based on: ${suggestion.reason}`,
      selectedPermitId: suggestion.matchingPermits[0]?.id || '',
    });
    setShowConvertModal(true);
  };

  const handleCreateDeal = async () => {
    if (!selectedSuggestion || !dealForm.name) {
      toast({ title: 'Error', description: 'Deal name is required', variant: 'destructive' });
      return;
    }

    try {
      await saveDeal({
        company_id: companyId,
        name: dealForm.name,
        stage: 'new_lead',
        value: parseFloat(dealForm.value) || 0,
        expected_close_date: dealForm.expectedCloseDate || undefined,
        status: 'open',
        linked_permit_ids: dealForm.selectedPermitId ? [dealForm.selectedPermitId] : [],
        notes: dealForm.notes || undefined,
        selling_option_id: selectedSuggestion.sellingOption.id,
      });

      toast({ title: 'Deal Created', description: 'Deal has been added to your pipeline' });
      setShowConvertModal(false);
      setSelectedSuggestion(null);
      onDealCreated?.();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create deal', variant: 'destructive' });
    }
  };

  if (suggestedDeals.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No selling opportunities detected</p>
        <p className="text-xs">Add products with trigger types in the Product Catalog</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span>{suggestedDeals.length} suggested opportunities based on permit activity</span>
      </div>

      <div className="grid gap-3">
        {suggestedDeals.map((suggestion, idx) => (
          <Card key={idx} className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="font-medium">{suggestion.sellingOption.name}</span>
                    <Badge
                      className={
                        suggestion.sellingOption.type === 'Network'
                          ? 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                          : 'bg-green-500/20 text-green-600 border-green-500/30'
                      }
                    >
                      {suggestion.sellingOption.type}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    {suggestion.reason}
                  </p>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <DollarSign className="h-3 w-3" />
                      ${Number(suggestion.sellingOption.default_price).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {suggestion.matchingPermits.length} permits
                    </span>
                  </div>
                </div>

                <Button size="sm" onClick={() => handleConvertClick(suggestion)}>
                  Create Deal
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Convert to Deal Modal */}
      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Create Deal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Deal Name *</Label>
              <Input
                value={dealForm.name}
                onChange={(e) => setDealForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Deal name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Value ($)</Label>
                <Input
                  type="number"
                  value={dealForm.value}
                  onChange={(e) => setDealForm(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Expected Close</Label>
                <Input
                  type="date"
                  value={dealForm.expectedCloseDate}
                  onChange={(e) => setDealForm(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                />
              </div>
            </div>

            {selectedSuggestion && selectedSuggestion.matchingPermits.length > 0 && (
              <div>
                <Label>Link to Permit</Label>
                <Select
                  value={dealForm.selectedPermitId}
                  onValueChange={(v) => setDealForm(prev => ({ ...prev, selectedPermitId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a permit to link..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSuggestion.matchingPermits.slice(0, 10).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.api} - {p.wellName || p.operator}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={dealForm.notes}
                onChange={(e) => setDealForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {selectedSuggestion && (
              <div className="bg-muted/30 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedSuggestion.sellingOption.name}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  This deal will be tagged with this product on the pipeline
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDeal}>
              Create Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
