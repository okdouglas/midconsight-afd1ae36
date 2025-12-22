/**
 * Deal Detail Modal
 * Shows deal info, linked products, and notes for reporting
 */

import { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  DollarSign, 
  Package, 
  FileText, 
  Calendar,
  Percent,
  Save,
  Plus,
  Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { type Deal, type Company } from '@/hooks/useSupabaseData';
import { 
  updateDeal, 
  getSellingOptions, 
  getSellingOptionById,
  type DbSellingOption 
} from '@/lib/supabase-data';

interface DealDetailModalProps {
  deal: Deal | null;
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const PROBABILITY_OPTIONS = [
  { value: 10, label: '10%', description: 'Early stage' },
  { value: 30, label: '30%', description: 'Qualified' },
  { value: 60, label: '60%', description: 'Proposal sent' },
  { value: 90, label: '90%', description: 'Verbal commit' },
  { value: 100, label: '100%', description: 'Won/Lost' },
];

const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US');
};

export function DealDetailModal({ 
  deal, 
  company, 
  isOpen, 
  onClose, 
  onRefresh 
}: DealDetailModalProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(deal?.notes || '');
  const [probability, setProbability] = useState<number>(deal?.probability || 10);
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<DbSellingOption | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (deal) {
      setNotes(deal.notes || '');
      setProbability(deal.probability || 10);
    }
  }, [deal]);

  useEffect(() => {
    const loadOptions = async () => {
      const options = await getSellingOptions();
      setSellingOptions(options);
      
      if (deal?.sellingOptionId) {
        const linked = options.find(o => o.id === deal.sellingOptionId);
        setSelectedProduct(linked || null);
      }
    };
    loadOptions();
  }, [deal?.sellingOptionId]);

  const handleSave = async () => {
    if (!deal) return;
    
    setSaving(true);
    try {
      await updateDeal(deal.id, { 
        notes,
        probability,
        selling_option_id: selectedProduct?.id || null
      });
      toast({ title: 'Saved', description: 'Deal updated successfully' });
      onRefresh();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save deal', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const weightedValue = deal ? Math.round(deal.value * (probability / 100)) : 0;

  if (!deal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            {deal.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company info */}
          {company && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{company.name}</span>
            </div>
          )}

          {/* Value & Probability Row */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Deal Value</div>
                <div className="text-2xl font-bold text-primary">
                  ${formatCurrency(deal.value)}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Probability</div>
                <Select 
                  value={probability.toString()} 
                  onValueChange={(v) => setProbability(parseInt(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROBABILITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label} - {opt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Weighted Value</div>
                <div className="text-2xl font-bold text-green-500">
                  ${formatCurrency(weightedValue)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products">
                <Package className="h-4 w-4 mr-2" />
                Products
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="h-4 w-4 mr-2" />
                Notes & Reporting
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4 mt-4">
              <div>
                <Label>Linked Product</Label>
                <Select 
                  value={selectedProduct?.id || 'none'} 
                  onValueChange={(v) => {
                    const opt = v === 'none' ? null : sellingOptions.find(o => o.id === v);
                    setSelectedProduct(opt || null);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No product linked</SelectItem>
                    {sellingOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name} - ${formatCurrency(Number(opt.default_price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProduct && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{selectedProduct.name}</span>
                          <Badge 
                            className={
                              selectedProduct.type === 'Network'
                                ? 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                                : 'bg-green-500/20 text-green-600 border-green-500/30'
                            }
                          >
                            {selectedProduct.type}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {selectedProduct.category}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setSelectedProduct(null)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Perpetual</div>
                        <div className="font-semibold">${formatCurrency(Number(selectedProduct.default_price))}</div>
                      </div>
                      {selectedProduct.annual_rental && (
                        <div>
                          <div className="text-muted-foreground">Annual Rental</div>
                          <div className="font-semibold">${formatCurrency(Number(selectedProduct.annual_rental))}</div>
                        </div>
                      )}
                      {selectedProduct.annual_maintenance && (
                        <div>
                          <div className="text-muted-foreground">Annual M&S</div>
                          <div className="font-semibold">${formatCurrency(Number(selectedProduct.annual_maintenance))}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!selectedProduct && (
                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No product linked to this deal yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a product above to track what's being discussed
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div>
                <Label>Deal Notes & Activity Log</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about meetings, calls, decisions, next steps..."
                  className="mt-1 min-h-[200px]"
                />
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Expected close: {new Date(deal.expectedCloseDate).toLocaleDateString()}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
