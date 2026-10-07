/**
 * Product Catalog Component
 *
 * Each account's own catalog of what they sell — starts empty for every
 * new customer. Products carry optional matching criteria (target
 * formations, applicable well types, depth range) that connect this
 * catalog to real permit/well data elsewhere in the app (see
 * matchProductsToPermit / suggestBestProduct in lib/supabase-data.ts) —
 * that connection is the actual point of the feature, not just a price list.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, FileSpreadsheet, ArrowUpDown, ChevronUp, ChevronDown, Package, Upload, Download, Info, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import * as XLSX from 'xlsx';

const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '—';
  return `$${value.toLocaleString('en-US')}`;
};

/** Parses a comma-separated input into a clean string array. */
const parseList = (value: string): string[] =>
  value.split(',').map((v) => v.trim()).filter(Boolean);

type SortField = 'name' | 'default_price' | 'annual_rental';
type SortDirection = 'asc' | 'desc';

export function ProductCatalog() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<DbSellingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOption, setEditingOption] = useState<Partial<DbSellingOption> | null>(null);
  // Comma-separated text working copies for the array fields, so the
  // person can type freely without the input fighting them mid-edit.
  const [formationsText, setFormationsText] = useState('');
  const [wellTypesText, setWellTypesText] = useState('');

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

  const filteredOptions = useMemo(() => {
    let result = options;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.category || '').toLowerCase().includes(q) ||
          (o.description || '').toLowerCase().includes(q) ||
          (o.target_formations || []).some((f) => f.toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => {
      const aVal = sortField === 'name' ? a.name : (a[sortField] ?? 0);
      const bVal = sortField === 'name' ? b.name : (b[sortField] ?? 0);
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [options, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      let imported = 0;
      for (const row of jsonData) {
        const name = String(row['Product Name'] || row['Name'] || row['Product'] || '').trim();
        if (!name) continue;

        const price = row['Price ($)'] || row['Price'] || row['Default Price'];
        const rental = row['Annual Rental ($)'] || row['Annual Rental'];
        const maintenance = row['Annual Maintenance ($)'] || row['Annual Maintenance'] || row['M&S'];

        const defaultPrice = parseFloat(String(price || 0).replace(/[,$]/g, '')) || 0;
        const annualRental = parseFloat(String(rental || 0).replace(/[,$]/g, '')) || undefined;
        const annualMaintenance = parseFloat(String(maintenance || 0).replace(/[,$]/g, '')) || undefined;

        const category = String(row['Category'] || '').trim() || undefined;
        const description = String(row['Description'] || '').trim() || undefined;
        const formations = parseList(String(row['Target Formations'] || ''));
        const wellTypes = parseList(String(row['Applicable Well Types'] || ''));
        const minDepth = row['Min Depth (ft)'] ? parseFloat(String(row['Min Depth (ft)'])) : undefined;
        const maxDepth = row['Max Depth (ft)'] ? parseFloat(String(row['Max Depth (ft)'])) : undefined;

        await saveSellingOption({
          name,
          category: category || 'General',
          type: String(row['Type'] || '').trim() || 'Standard',
          default_price: defaultPrice,
          annual_rental: annualRental,
          annual_maintenance: annualMaintenance,
          description,
          target_formations: formations,
          applicable_well_types: wellTypes,
          min_depth: minDepth,
          max_depth: maxDepth,
        });
        imported++;
      }

      toast({ title: 'Import complete', description: `Imported ${imported} products from spreadsheet` });
      loadOptions();
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: 'Import failed',
        description: 'Could not parse the spreadsheet. Check the format and try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddNew = () => {
    setEditingOption({ name: '', category: '', type: '', default_price: 0 });
    setFormationsText('');
    setWellTypesText('');
    setShowEditModal(true);
  };

  const handleEdit = (option: DbSellingOption) => {
    setEditingOption(option);
    setFormationsText((option.target_formations || []).join(', '));
    setWellTypesText((option.applicable_well_types || []).join(', '));
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSellingOption(id);
      toast({ title: 'Deleted', description: 'Product removed from catalog' });
      loadOptions();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete product', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!editingOption?.name?.trim()) {
      toast({ title: 'Error', description: 'Product name is required', variant: 'destructive' });
      return;
    }

    const payload = {
      name: editingOption.name.trim(),
      category: editingOption.category?.trim() || 'General',
      type: editingOption.type?.trim() || 'Standard',
      description: editingOption.description,
      default_price: editingOption.default_price || 0,
      annual_rental: editingOption.annual_rental,
      annual_maintenance: editingOption.annual_maintenance,
      target_formations: parseList(formationsText),
      applicable_well_types: parseList(wellTypesText),
      min_depth: editingOption.min_depth,
      max_depth: editingOption.max_depth,
    };

    try {
      if (editingOption.id) {
        await updateSellingOption(editingOption.id, payload);
        toast({ title: 'Updated', description: 'Product updated' });
      } else {
        await saveSellingOption(payload);
        toast({ title: 'Added', description: 'Product added to your catalog' });
      }
      setShowEditModal(false);
      setEditingOption(null);
      loadOptions();
    } catch {
      toast({ title: 'Error', description: 'Failed to save product', variant: 'destructive' });
    }
  };

  const generateTemplateDownload = () => {
    const templateData = [
      {
        'Product Name': 'Premium cementing package',
        Category: 'Cementing',
        Type: 'Service',
        'Price ($)': 18500,
        'Annual Rental ($)': '',
        'Annual Maintenance ($)': '',
        'Target Formations': 'Woodford, Meramec',
        'Applicable Well Types': 'Horizontal, Directional',
        'Min Depth (ft)': 8000,
        'Max Depth (ft)': 15000,
        Description: 'Example product — edit or delete this row',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'product_catalog_template.xlsx');
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle>Product catalog</CardTitle>
                </div>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {importing ? 'Importing…' : 'Import'}
                  </Button>
                  <Button onClick={handleAddNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add product
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products, categories, formations…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading catalog…</div>
              ) : options.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-semibold mb-1">Start your catalog</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    Add what you sell, and MidconSight matches it against active drilling
                    to surface the leads worth calling.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button onClick={handleAddNew}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add your first product
                    </Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import a spreadsheet
                    </Button>
                  </div>
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No products match your search.</div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <SortableHeader field="name">Product</SortableHeader>
                        <TableHead>Category</TableHead>
                        <TableHead>Matches</TableHead>
                        <SortableHeader field="default_price">Price</SortableHeader>
                        <SortableHeader field="annual_rental">Annual rental</SortableHeader>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOptions.map((option) => {
                        const hasCriteria =
                          (option.target_formations?.length || 0) > 0 ||
                          (option.applicable_well_types?.length || 0) > 0 ||
                          option.min_depth != null ||
                          option.max_depth != null;
                        return (
                          <TableRow key={option.id}>
                            <TableCell>
                              <div className="font-medium">{option.name}</div>
                              {option.description && (
                                <div className="text-xs text-muted-foreground line-clamp-1">{option.description}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{option.category}</TableCell>
                            <TableCell>
                              {hasCriteria ? (
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {(option.target_formations || []).slice(0, 2).map((f) => (
                                    <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                                  ))}
                                  {(option.applicable_well_types || []).slice(0, 2).map((t) => (
                                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">General — no criteria set</span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">{formatCurrency(option.default_price)}</TableCell>
                            <TableCell className="tabular-nums text-sm">{formatCurrency(option.annual_rental)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(option)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(option.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Import guide</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-3">
                <p>Import products from a spreadsheet. Columns recognized:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Product Name</li>
                  <li>Category, Type</li>
                  <li>Price ($), Annual Rental ($), Annual Maintenance ($)</li>
                  <li>Target Formations (comma-separated)</li>
                  <li>Applicable Well Types (comma-separated)</li>
                  <li>Min Depth (ft), Max Depth (ft)</li>
                  <li>Description (optional)</li>
                </ul>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={generateTemplateDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download template
              </Button>
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Target Formations and Applicable Well Types are what let MidconSight match your
                catalog against active permits — leave them blank for a general-purpose product.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) setEditingOption(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOption?.id ? 'Edit product' : 'Add product'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Product name *</Label>
                <Input
                  value={editingOption?.name || ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Premium cementing package"
                />
              </div>

              <div>
                <Label>Category</Label>
                <Input
                  value={editingOption?.category || ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Cementing"
                />
              </div>

              <div>
                <Label>Type</Label>
                <Input
                  value={editingOption?.type || ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, type: e.target.value }))}
                  placeholder="Service, Equipment, ..."
                />
              </div>

              <div>
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  value={editingOption?.default_price || ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, default_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="18500"
                />
              </div>

              <div>
                <Label>Annual rental ($)</Label>
                <Input
                  type="number"
                  value={editingOption?.annual_rental || ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, annual_rental: parseFloat(e.target.value) || undefined }))}
                  placeholder="Optional"
                />
              </div>

              <div className="col-span-2">
                <Label>Description</Label>
                <Input
                  value={editingOption?.description || ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description…"
                />
              </div>

              <div className="col-span-2 border-t border-border pt-3 mt-1">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Matching criteria — connects this product to real permit activity. Leave blank for a general-purpose product.
                </p>
              </div>

              <div className="col-span-2">
                <Label>Target formations</Label>
                <Input
                  value={formationsText}
                  onChange={(e) => setFormationsText(e.target.value)}
                  placeholder="Woodford, Meramec, SCOOP"
                />
              </div>

              <div className="col-span-2">
                <Label>Applicable well types</Label>
                <Input
                  value={wellTypesText}
                  onChange={(e) => setWellTypesText(e.target.value)}
                  placeholder="Horizontal, Directional, Oil, Gas"
                />
              </div>

              <div>
                <Label>Min depth (ft)</Label>
                <Input
                  type="number"
                  value={editingOption?.min_depth ?? ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, min_depth: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  placeholder="8000"
                />
              </div>

              <div>
                <Label>Max depth (ft)</Label>
                <Input
                  type="number"
                  value={editingOption?.max_depth ?? ''}
                  onChange={(e) => setEditingOption((prev) => ({ ...prev, max_depth: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  placeholder="15000"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingOption?.id ? 'Update' : 'Add product'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
