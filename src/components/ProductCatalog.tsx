/**
 * Product Catalog Component
 * Displays selling options with pricing tiers based on GVERSE GeoGraphix price sheet
 */

import { useState, useEffect } from 'react';
import { Search, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Package, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  getSellingOptions,
  saveSellingOption,
  updateSellingOption,
  deleteSellingOption,
  type DbSellingOption,
} from '@/lib/supabase-data';

export interface SellingOption {
  id: string;
  name: string;
  category: 'Standard Packages' | 'GGX Add-on';
  type: 'Network' | 'Standalone';
  description?: string;
  defaultPrice: number;
  annualRental?: number;
  annualMaintenance?: number;
  triggerType?: string;
}

const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('en-US');
};

const TRIGGER_TYPES = [
  'new_permit',
  'horizontal_drill',
  'vertical_drill',
  'deep_well',
  'shallow_well',
  'formation_specific',
  'high_value',
];

export function ProductCatalog() {
  const { toast } = useToast();
  const [options, setOptions] = useState<DbSellingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Network' | 'Standalone'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Standard Packages': true,
    'GGX Add-on': true,
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOption, setEditingOption] = useState<Partial<DbSellingOption> | null>(null);

  const loadOptions = async () => {
    setLoading(true);
    try {
      const data = await getSellingOptions();
      setOptions(data);
    } catch (error) {
      console.error('Failed to load selling options:', error);
      toast({
        title: 'Error',
        description: 'Failed to load product catalog',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const handleAddNew = () => {
    setEditingOption({
      name: '',
      category: 'Standard Packages',
      type: 'Network',
      default_price: 0,
    });
    setShowEditModal(true);
  };

  const handleEdit = (option: DbSellingOption) => {
    setEditingOption(option);
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSellingOption(id);
      toast({ title: 'Deleted', description: 'Product removed from catalog' });
      loadOptions();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete product', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!editingOption?.name) {
      toast({ title: 'Error', description: 'Product name is required', variant: 'destructive' });
      return;
    }

    try {
      if (editingOption.id) {
        await updateSellingOption(editingOption.id, editingOption);
        toast({ title: 'Updated', description: 'Product updated successfully' });
      } else {
        await saveSellingOption({
          name: editingOption.name,
          category: editingOption.category || 'Standard Packages',
          type: editingOption.type || 'Network',
          description: editingOption.description,
          default_price: editingOption.default_price || 0,
          annual_rental: editingOption.annual_rental,
          annual_maintenance: editingOption.annual_maintenance,
          trigger_type: editingOption.trigger_type,
        });
        toast({ title: 'Created', description: 'Product added to catalog' });
      }
      setShowEditModal(false);
      setEditingOption(null);
      loadOptions();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save product', variant: 'destructive' });
    }
  };

  // Filter and group options
  const filteredOptions = options.filter((opt) => {
    const matchesSearch = opt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || opt.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    const category = opt.category || 'Standard Packages';
    if (!acc[category]) acc[category] = [];
    acc[category].push(opt);
    return acc;
  }, {} as Record<string, DbSellingOption[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Product Catalog</CardTitle>
            </div>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Network">Network Only</SelectItem>
                <SelectItem value="Standalone">Standalone Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Categories */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading catalog...</div>
          ) : Object.keys(groupedOptions).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No products in catalog</p>
              <p className="text-sm">Add your first product to start building deals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedOptions).map(([category, categoryOptions]) => (
                <Collapsible
                  key={category}
                  open={expandedCategories[category]}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="font-medium">{category}</span>
                        <Badge variant="secondary">{categoryOptions.length}</Badge>
                      </div>
                      {expandedCategories[category] ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border border-border rounded-lg mt-2 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-24">Type</TableHead>
                            <TableHead>Product Description</TableHead>
                            <TableHead className="text-right">Perpetual ($)</TableHead>
                            <TableHead className="text-right">Annual Rental ($)</TableHead>
                            <TableHead className="text-right">Annual M&S ($)</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryOptions.map((opt, idx) => (
                            <TableRow 
                              key={opt.id}
                              className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                            >
                              <TableCell>
                                <Badge
                                  className={
                                    opt.type === 'Network'
                                      ? 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                                      : 'bg-green-500/20 text-green-600 border-green-500/30'
                                  }
                                >
                                  {opt.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <span className="font-medium">{opt.name}</span>
                                  {opt.trigger_type && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      Trigger: {opt.trigger_type}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(Number(opt.default_price))}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(opt.annual_rental ? Number(opt.annual_rental) : undefined)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(opt.annual_maintenance ? Number(opt.annual_maintenance) : undefined)}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(opt)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(opt.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Add Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingOption?.id ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Product Name *</Label>
                <Input
                  value={editingOption?.name || ''}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="GVERSE Geology Network"
                />
              </div>
              
              <div>
                <Label>Category</Label>
                <Select
                  value={editingOption?.category || 'Standard Packages'}
                  onValueChange={(v) => setEditingOption(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard Packages">Standard Packages</SelectItem>
                    <SelectItem value="GGX Add-on">GGX Add-on</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type</Label>
                <Select
                  value={editingOption?.type || 'Network'}
                  onValueChange={(v) => setEditingOption(prev => ({ ...prev, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Standalone">Standalone</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Perpetual Price ($)</Label>
                <Input
                  type="number"
                  value={editingOption?.default_price || ''}
                  onChange={(e) => setEditingOption(prev => ({ 
                    ...prev, 
                    default_price: parseFloat(e.target.value) || 0 
                  }))}
                  placeholder="28000"
                />
              </div>

              <div>
                <Label>Annual Rental ($)</Label>
                <Input
                  type="number"
                  value={editingOption?.annual_rental || ''}
                  onChange={(e) => setEditingOption(prev => ({ 
                    ...prev, 
                    annual_rental: parseFloat(e.target.value) || undefined 
                  }))}
                  placeholder="12500"
                />
              </div>

              <div>
                <Label>Annual M&S ($)</Label>
                <Input
                  type="number"
                  value={editingOption?.annual_maintenance || ''}
                  onChange={(e) => setEditingOption(prev => ({ 
                    ...prev, 
                    annual_maintenance: parseFloat(e.target.value) || undefined 
                  }))}
                  placeholder="5040"
                />
              </div>

              <div>
                <Label>Trigger Type</Label>
                <Select
                  value={editingOption?.trigger_type || ''}
                  onValueChange={(v) => setEditingOption(prev => ({ ...prev, trigger_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {TRIGGER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Description</Label>
                <Input
                  value={editingOption?.description || ''}
                  onChange={(e) => setEditingOption(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingOption?.id ? 'Update' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
