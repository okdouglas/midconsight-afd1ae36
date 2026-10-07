/**
 * Deal Detail Modal
 * Shows deal info, linked product, dated notes and next step
 */

import { useState, useEffect } from 'react';
import {
  Building2,
  DollarSign,
  Package,
  FileText,
  Calendar,
  Save,
  Trash2,
  Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  deleteDeal,
  getSellingOptions,
  type DbSellingOption
} from '@/lib/supabase-data';
import {
  STAGES,
  STAGE_ORDER,
  stageUpdate,
  isClosedStage,
  prependNote,
  formatLocalDate,
  isBeforeToday,
  type DealStage,
} from '@/lib/deal-stages';
import { ConfirmAction } from './ConfirmAction';

interface DealDetailModalProps {
  deal: Deal | null;
  company: Company | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

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
  const [newNote, setNewNote] = useState('');
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? 'new_lead');
  const [dealValue, setDealValue] = useState<number>(deal?.value ?? 0);
  const [nextStep, setNextStep] = useState(deal?.nextStep || '');
  const [nextStepDate, setNextStepDate] = useState(deal?.nextStepDate || '');
  const [sellingOptions, setSellingOptions] = useState<DbSellingOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<DbSellingOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (deal) {
      setNotes(deal.notes || '');
      setNewNote('');
      setStage(deal.stage);
      setDealValue(deal.value ?? 0);
      setNextStep(deal.nextStep || '');
      setNextStepDate(deal.nextStepDate || '');
    }
  }, [deal]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const options = await getSellingOptions();
        const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name));
        setSellingOptions(sorted);
        if (deal?.sellingOptionId) {
          setSelectedProduct(sorted.find(o => o.id === deal.sellingOptionId) || null);
        } else {
          setSelectedProduct(null);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };
    loadOptions();
  }, [deal?.sellingOptionId]);

  const probability = STAGES[stage].probability;
  const weightedValue = Math.round(dealValue * (probability / 100));

  const dirty = !!deal && (
    notes !== (deal.notes || '') ||
    newNote.trim() !== '' ||
    stage !== deal.stage ||
    dealValue !== (deal.value ?? 0) ||
    nextStep !== (deal.nextStep || '') ||
    nextStepDate !== (deal.nextStepDate || '') ||
    (selectedProduct?.id || null) !== (deal.sellingOptionId || null)
  );

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const handleLogNote = () => {
    if (!newNote.trim()) return;
    setNotes(prependNote(notes, newNote));
    setNewNote('');
  };

  const handleSave = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      // A note typed but not yet logged is logged on save, so it is never lost.
      const finalNotes = newNote.trim() ? prependNote(notes, newNote) : notes;
      const updates: Record<string, unknown> = {
        ...(stage !== deal.stage ? stageUpdate(stage) : {}),
        notes: finalNotes,
        value: dealValue,
        selling_option_id: selectedProduct?.id || null,
      };
      // Only send next step fields when they changed, so saves keep working
      // before the next_step migration is applied.
      if (nextStep !== (deal.nextStep || '')) updates.next_step = nextStep.trim() || null;
      if (nextStepDate !== (deal.nextStepDate || '')) updates.next_step_date = nextStepDate || null;

      await updateDeal(deal.id, updates);
      toast({ title: 'Saved', description: 'Deal updated successfully' });
      onRefresh();
    } catch (error) {
      console.error('Failed to save deal:', error);
      toast({ title: 'Error', description: 'Failed to save deal', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deal) return;
    setConfirmDelete(false);
    try {
      await deleteDeal(deal.id);
      toast({ title: 'Deal deleted', description: deal.name });
      onRefresh();
    } catch (error) {
      console.error('Failed to delete deal:', error);
      toast({ title: 'Error', description: 'Failed to delete deal', variant: 'destructive' });
    }
  };

  if (!deal) return null;

  const overdue = !isClosedStage(stage) && isBeforeToday(nextStepDate);
  const matchFormations = selectedProduct?.target_formations || [];
  const matchWellTypes = selectedProduct?.applicable_well_types || [];
  const hasDepth = selectedProduct?.min_depth != null || selectedProduct?.max_depth != null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && requestClose()}>
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

          {/* Stage, Value & Weighted Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Stage</div>
                <Select
                  value={stage}
                  onValueChange={(v) => setStage(v as DealStage)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGE_ORDER.map(s => (
                      <SelectItem key={s} value={s}>
                        {STAGES[s].label} ({STAGES[s].probability}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  Probability follows the stage: {probability}%
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setIsEditingValue(true)}
            >
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Deal Value</div>
                {isEditingValue ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xl font-semibold text-primary">$</span>
                    <Input
                      type="number"
                      value={dealValue}
                      onChange={(e) => setDealValue(Number(e.target.value) || 0)}
                      onBlur={() => setIsEditingValue(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingValue(false)}
                      className="text-xl font-semibold h-8 w-28"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="text-2xl font-semibold text-primary">
                    ${formatCurrency(dealValue)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Weighted Value</div>
                <div className="text-2xl font-semibold text-success">
                  ${formatCurrency(weightedValue)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next step */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="deal-next-step">Next step</Label>
              <Input
                id="deal-next-step"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="Call the drilling manager about the Q1 rig schedule"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="deal-next-step-date" className="flex items-center gap-2">
                Next step date
                {overdue && <span className="text-xs font-semibold text-destructive">Overdue</span>}
              </Label>
              <Input
                id="deal-next-step-date"
                type="date"
                value={nextStepDate}
                onChange={(e) => setNextStepDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products">
                <Package className="h-4 w-4 mr-2" />
                Product
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="h-4 w-4 mr-2" />
                Notes
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
                        {opt.name} - ${formatCurrency(Number(opt.default_price) || 0)}
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
                        <div className="font-semibold">{selectedProduct.name}</div>
                        <div className="text-sm font-semibold text-primary mt-1">
                          ${formatCurrency(Number(selectedProduct.default_price) || 0)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Unlink product"
                        onClick={() => setSelectedProduct(null)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="mt-3 text-sm">
                      <div className="text-muted-foreground mb-1">Matches</div>
                      {matchFormations.length > 0 || matchWellTypes.length > 0 || hasDepth ? (
                        <div className="flex flex-wrap gap-1">
                          {matchFormations.map(f => (
                            <Badge key={`f-${f}`} variant="secondary" className="text-xs">{f}</Badge>
                          ))}
                          {matchWellTypes.map(t => (
                            <Badge key={`t-${t}`} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                          {hasDepth && (
                            <Badge variant="outline" className="text-xs">
                              {selectedProduct.min_depth ?? 0} to {selectedProduct.max_depth ?? 'any'} ft
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">General product. No match criteria set.</span>
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
                    Select a product above to track what you are pitching
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="deal-new-note">Log a note</Label>
                <Textarea
                  id="deal-new-note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="What happened? Calls, meetings, decisions..."
                  className="mt-1 min-h-[80px]"
                />
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="secondary" onClick={handleLogNote} disabled={!newNote.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Log note
                  </Button>
                </div>
              </div>

              <div>
                <Label>History (newest first)</Label>
                {notes.trim() ? (
                  <div className="mt-1 max-h-[220px] overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {notes}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No notes yet.</p>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Expected close: {formatLocalDate(deal.expectedCloseDate)}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between gap-2 pt-4 border-t border-border">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete deal
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={requestClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <ConfirmAction
      open={confirmDiscard}
      title="Discard your changes?"
      description="You have unsaved edits on this deal. If you close now, they are lost."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      destructive
      onConfirm={() => { setConfirmDiscard(false); onClose(); }}
      onCancel={() => setConfirmDiscard(false)}
    />
    <ConfirmAction
      open={confirmDelete}
      title="Delete this deal?"
      description={`"${deal.name}" will be removed. This cannot be undone.`}
      confirmLabel="Delete deal"
      destructive
      onConfirm={handleDelete}
      onCancel={() => setConfirmDelete(false)}
    />
    </>
  );
}
