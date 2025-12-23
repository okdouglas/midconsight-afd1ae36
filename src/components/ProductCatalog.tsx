/**
 * Product Catalog Component
 * Displays selling options with pricing tiers based on GVERSE GeoGraphix price sheet
 * Features: Nested product groups, feature badges, comparison mode, feature filtering
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, ChevronDown, ChevronUp, ChevronRight, Package, Tag, Upload, FileSpreadsheet, ArrowUpDown, Check, X, Filter, Grid3X3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import * as XLSX from 'xlsx';

// Static product data with features
const PRODUCT_DATA = [
  {
    category: "Standard Packages",
    product_group: "GVERSE Geology",
    description: "GVERSE Geology",
    type: "Network",
    pricing: { perpetual: 28000, annual_rental: 12500, annual_ms: 5040 },
    features: ["Data Manager", "GeoAtlas", "IsoMap", "SmartSection", "Petrophysics"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Geology",
    description: "GVERSE Geology",
    type: "Standalone",
    pricing: { perpetual: 17500, annual_rental: 8000, annual_ms: 3150 },
    features: ["Data Manager", "GeoAtlas", "IsoMap", "SmartSection", "Petrophysics"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE GeoInterp",
    description: "GVERSE GeoInterp",
    type: "Network",
    pricing: { perpetual: 22500, annual_rental: 10000, annual_ms: 4050 },
    features: ["Data Manager", "GeoAtlas", "IsoMap", "SmartSection", "Geophysics"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE GeoInterp",
    description: "GVERSE GeoInterp",
    type: "Standalone",
    pricing: { perpetual: 14000, annual_rental: 6250, annual_ms: 2520 },
    features: ["Data Manager", "GeoAtlas", "IsoMap", "SmartSection", "Geophysics"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Advanced Geology",
    description: "GVERSE Advanced Geology",
    type: "Network",
    pricing: { perpetual: 49000, annual_rental: 22000, annual_ms: 8820 },
    features: ["Data Manager", "GeoAtlas", "IsoMap", "SmartSection", "Petrophysics", "SmartStrat", "Field Planner", "Connect"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Advanced Geology",
    description: "GVERSE Advanced Geology",
    type: "Standalone",
    pricing: { perpetual: 30500, annual_rental: 13750, annual_ms: 5490 },
    features: ["Data Manager", "GeoAtlas", "IsoMap", "SmartSection", "Petrophysics", "SmartStrat", "Field Planner", "Connect"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Geophysics Package",
    description: "GVERSE Geophysics Package",
    type: "Network",
    pricing: { perpetual: 28000, annual_rental: 12500, annual_ms: 5040 },
    features: ["Data Manager", "Geophysics", "Geo+"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Geophysics Package",
    description: "GVERSE Geophysics Package",
    type: "Standalone",
    pricing: { perpetual: 25500, annual_rental: 11500, annual_ms: 4590 },
    features: ["Data Manager", "Geophysics", "Geo+"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Advanced Geophysics Package",
    description: "GVERSE Advanced Geophysics Package",
    type: "Network",
    pricing: { perpetual: 43000, annual_rental: 19500, annual_ms: 7740 },
    features: ["Data Manager", "Geophysics", "Geo+", "Attributes"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Advanced Geophysics Package",
    description: "GVERSE Advanced Geophysics Package",
    type: "Standalone",
    pricing: { perpetual: 27000, annual_rental: 12000, annual_ms: 4860 },
    features: ["Data Manager", "Geophysics", "Geo+", "Attributes"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Petrophysics Package",
    description: "GVERSE Petrophysics Package",
    type: "Network",
    pricing: { perpetual: 12750, annual_rental: 5750, annual_ms: 2295 },
    features: ["Data Manager", "Petrophysics"]
  },
  {
    category: "Standard Packages",
    product_group: "GVERSE Petrophysics Package",
    description: "GVERSE Petrophysics Package",
    type: "Standalone",
    pricing: { perpetual: 8000, annual_rental: 3600, annual_ms: 1440 },
    features: ["Data Manager", "Petrophysics"]
  }
];

// Ordered features list (GeoPhy renamed to Geo+)
const ORDERED_FEATURES = [
  "Data Manager",
  "GeoAtlas", 
  "IsoMap",
  "SmartSection",
  "SmartStrat",
  "Geo+",
  "Geophysics",
  "Petrophysics",
  "Field Planner",
  "Attributes",
  "Connect"
];

// Get all unique features from data, normalized
const ALL_FEATURES = ORDERED_FEATURES;

// Get all unique product groups
const PRODUCT_GROUPS = Array.from(
  new Set(PRODUCT_DATA.map(p => p.product_group))
);

export interface SellingOption {
  id: string;
  name: string;
  category: 'Standard Packages' | 'GGX Add-on';
  type: 'Network' | 'Standalone';
  description?: string;
  defaultPrice: number;
  annualRental?: number;
  annualMaintenance?: number;
  features?: string[];
}

const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString('en-US');
};


type SortField = 'name' | 'default_price' | 'annual_rental' | 'annual_maintenance';
type SortDirection = 'asc' | 'desc';

interface ProductGroup {
  name: string;
  category: string;
  products: typeof PRODUCT_DATA;
  features: string[];
}

export function ProductCatalog() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<DbSellingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [featureFilter, setFeatureFilter] = useState<string>('');
  const [compareMode, setCompareMode] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<Record<string, 'Network' | 'Standalone'>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Standard Packages': true,
    'GGX Add-on': true,
  });
  const [sortField, setSortField] = useState<SortField>('annual_rental');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOption, setEditingOption] = useState<Partial<DbSellingOption> | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = useState(false);

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

  // Initialize selectedType with Network as default for all groups
  useEffect(() => {
    const initial: Record<string, 'Network' | 'Standalone'> = {};
    PRODUCT_GROUPS.forEach(group => {
      initial[group] = 'Network';
    });
    setSelectedType(initial);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter products by feature search
  const filteredProductData = useMemo(() => {
    if (!featureFilter.trim()) return PRODUCT_DATA;
    const searchLower = featureFilter.toLowerCase();
    return PRODUCT_DATA.filter(p => 
      p.features.some(f => f.toLowerCase().includes(searchLower)) ||
      p.product_group.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower)
    );
  }, [featureFilter]);

  // Group products by product_group
  const groupedProducts = useMemo(() => {
    const groups: Record<string, ProductGroup> = {};
    
    filteredProductData.forEach(product => {
      if (!groups[product.product_group]) {
        groups[product.product_group] = {
          name: product.product_group,
          category: product.category,
          products: [],
          features: product.features,
        };
      }
      groups[product.product_group].products.push(product);
    });

    // Sort groups by the minimum annual_rental within each group
    const sortedGroups = Object.values(groups).sort((a, b) => {
      const aMin = Math.min(...a.products.map(p => p.pricing.annual_rental));
      const bMin = Math.min(...b.products.map(p => p.pricing.annual_rental));
      return sortDirection === 'asc' ? aMin - bMin : bMin - aMin;
    });

    return sortedGroups;
  }, [filteredProductData, sortDirection]);

  // Get unique features for comparison matrix in ordered form
  const uniqueFeatures = useMemo(() => {
    const usedFeatures = new Set<string>();
    filteredProductData.forEach(p => p.features.forEach(f => usedFeatures.add(f)));
    return ORDERED_FEATURES.filter(f => usedFeatures.has(f));
  }, [filteredProductData]);

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
      let currentCategory = 'Standard Packages';

      for (const row of jsonData) {
        const typeValue = String(row['Type'] || '').trim();
        
        if (typeValue === 'Standard Packages' || typeValue === 'GGX Add-on') {
          currentCategory = typeValue;
          continue;
        }

        const name = String(row['Product Description'] || row['Name'] || row['Product Name'] || row['Product'] || '').trim();
        if (!name) continue;

        const perpetual = row['Perpetual ($)'] || row['Perpetual'] || row['Price'] || row['Default Price'];
        const rental = row['Annual Rental ($)'] || row['Annual Rental'] || row['Rental'];
        const maintenance = row['Annual M&S ($)'] || row['Annual M&S'] || row['Maintenance'] || row['M&S'];

        const defaultPrice = parseFloat(String(perpetual || 0).replace(/[,$]/g, '')) || 0;
        const annualRental = parseFloat(String(rental || 0).replace(/[,$]/g, '')) || undefined;
        const annualMaintenance = parseFloat(String(maintenance || 0).replace(/[,$]/g, '')) || undefined;
        
        const type = typeValue.toLowerCase().includes('standalone') ? 'Standalone' : 'Network';
        
        const triggerType = String(row['Trigger Type'] || row['Trigger'] || '').trim() || undefined;
        const description = String(row['Description'] || row['Notes'] || '').trim() || undefined;

        await saveSellingOption({
          name,
          category: currentCategory,
          type,
          default_price: defaultPrice,
          annual_rental: annualRental,
          annual_maintenance: annualMaintenance,
          trigger_type: triggerType,
          description,
        });
        imported++;
      }

      toast({ 
        title: 'Import Complete', 
        description: `Imported ${imported} products from spreadsheet` 
      });
      loadOptions();
    } catch (error) {
      console.error('Import failed:', error);
      toast({ 
        title: 'Import Failed', 
        description: 'Could not parse the spreadsheet. Check format and try again.', 
        variant: 'destructive' 
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddNew = () => {
    setEditingOption({
      name: '',
      category: 'Standard Packages',
      type: 'Network',
      default_price: 0,
    });
    setSelectedFeatures([]);
    setFeaturesDropdownOpen(false);
    setShowEditModal(true);
  };

  const handleEdit = (option: DbSellingOption) => {
    setEditingOption(option);
    // Parse features from description or trigger_type field (stored as comma-separated)
    const storedFeatures = option.trigger_type ? option.trigger_type.split(',').map(f => f.trim()).filter(Boolean) : [];
    setSelectedFeatures(storedFeatures);
    setFeaturesDropdownOpen(false);
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

    // Store selected features as comma-separated string in trigger_type field
    const featuresString = selectedFeatures.length > 0 ? selectedFeatures.join(',') : undefined;

    try {
      if (editingOption.id) {
        await updateSellingOption(editingOption.id, {
          ...editingOption,
          trigger_type: featuresString,
        });
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
          trigger_type: featuresString,
        });
        toast({ title: 'Created', description: 'Product added to catalog' });
      }
      setShowEditModal(false);
      setEditingOption(null);
      setSelectedFeatures([]);
      loadOptions();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save product', variant: 'destructive' });
    }
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const toggleType = (groupName: string) => {
    setSelectedType(prev => ({
      ...prev,
      [groupName]: prev[groupName] === 'Network' ? 'Standalone' : 'Network'
    }));
  };

  const getProductForGroup = (group: ProductGroup, type: 'Network' | 'Standalone') => {
    return group.products.find(p => p.type === type);
  };

  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={`cursor-pointer hover:bg-muted/50 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  // Feature Comparison Matrix Component
  const FeatureComparisonMatrix = () => (
    <div className="border border-border rounded-lg overflow-auto max-h-[600px]">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow className="bg-muted/30">
            <TableHead className="font-semibold min-w-[200px] sticky left-0 bg-muted/30 z-20">Product</TableHead>
            <TableHead className="text-center min-w-[80px]">Type</TableHead>
            {uniqueFeatures.map(feature => (
              <TableHead key={feature} className="text-center min-w-[100px] text-xs">
                {feature}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedProducts.map((group, groupIdx) => {
            const currentType = selectedType[group.name] || 'Network';
            const product = getProductForGroup(group, currentType);
            if (!product) return null;
            
            return (
              <TableRow 
                key={`${group.name}-${currentType}`}
                className={groupIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
              >
                <TableCell className="font-medium sticky left-0 bg-inherit">
                  <div className="flex items-center gap-2">
                    <span>{group.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge
                    className={`cursor-pointer ${
                      currentType === 'Network'
                        ? 'bg-blue-500/20 text-blue-600 border-blue-500/30 hover:bg-blue-500/30'
                        : 'bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30'
                    }`}
                    onClick={() => toggleType(group.name)}
                  >
                    {currentType}
                  </Badge>
                </TableCell>
                {uniqueFeatures.map(feature => (
                  <TableCell key={feature} className="text-center">
                    {product.features.includes(feature) ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  // Standard Product List View
  const ProductListView = () => (
    <div className="space-y-3">
      {groupedProducts.map((group, groupIdx) => {
        const isExpanded = expandedGroups[group.name];
        const isSelected = selectedProduct === group.name;
        const currentType = selectedType[group.name] || 'Network';
        const currentProduct = getProductForGroup(group, currentType);
        const networkProduct = getProductForGroup(group, 'Network');
        const standaloneProduct = getProductForGroup(group, 'Standalone');
        
        if (!currentProduct) return null;

        return (
          <div 
            key={group.name}
            className={`border border-border rounded-lg overflow-hidden transition-all ${
              isSelected ? 'ring-2 ring-primary' : ''
            }`}
          >
            {/* Main Row - Collapsed View */}
            <div 
              className={`flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors ${
                groupIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
              }`}
              onClick={() => {
                toggleGroup(group.name);
                setSelectedProduct(isSelected ? null : group.name);
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="p-1">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{group.name}</span>
                    <Badge
                      variant="outline"
                      className={`cursor-pointer text-xs ${
                        currentType === 'Network'
                          ? 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                          : 'bg-green-500/20 text-green-600 border-green-500/30'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleType(group.name);
                      }}
                    >
                      {currentType}
                    </Badge>
                  </div>
                  {/* Feature Badges on Hover/Select */}
                  {(isSelected || isExpanded) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentProduct.features.map(feature => (
                        <Badge key={feature} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Pricing Summary */}
              <div className="flex items-center gap-6 text-right">
                <div>
                  <div className="text-xs text-muted-foreground">Perpetual</div>
                  <div className="font-mono font-medium">${formatCurrency(currentProduct.pricing.perpetual)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Annual Rental</div>
                  <div className="font-mono font-medium">${formatCurrency(currentProduct.pricing.annual_rental)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Annual M&S</div>
                  <div className="font-mono font-medium">${formatCurrency(currentProduct.pricing.annual_ms)}</div>
                </div>
              </div>
            </div>

            {/* Expanded View - Both Network and Standalone Options */}
            {isExpanded && (
              <div className="border-t border-border bg-muted/20 p-4">
                <div className="text-sm font-medium mb-3 text-muted-foreground">Pricing Options</div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Network Option */}
                  {networkProduct && (
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        currentType === 'Network' 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-border hover:border-blue-500/50'
                      }`}
                      onClick={() => setSelectedType(prev => ({ ...prev, [group.name]: 'Network' }))}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                          Network
                        </Badge>
                        {currentType === 'Network' && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Perpetual:</span>
                          <span className="font-mono">${formatCurrency(networkProduct.pricing.perpetual)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual Rental:</span>
                          <span className="font-mono">${formatCurrency(networkProduct.pricing.annual_rental)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual M&S:</span>
                          <span className="font-mono">${formatCurrency(networkProduct.pricing.annual_ms)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Standalone Option */}
                  {standaloneProduct && (
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        currentType === 'Standalone' 
                          ? 'border-green-500 bg-green-500/10' 
                          : 'border-border hover:border-green-500/50'
                      }`}
                      onClick={() => setSelectedType(prev => ({ ...prev, [group.name]: 'Standalone' }))}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                          Standalone
                        </Badge>
                        {currentType === 'Standalone' && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Perpetual:</span>
                          <span className="font-mono">${formatCurrency(standaloneProduct.pricing.perpetual)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual Rental:</span>
                          <span className="font-mono">${formatCurrency(standaloneProduct.pricing.annual_rental)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual M&S:</span>
                          <span className="font-mono">${formatCurrency(standaloneProduct.pricing.annual_ms)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Product Catalog</CardTitle>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportFile}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {importing ? 'Importing...' : 'Import'}
              </Button>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by feature (e.g., smartSTRAT, Petrophysics)..."
                value={featureFilter}
                onChange={(e) => setFeatureFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="compare-mode"
                checked={compareMode}
                onCheckedChange={(checked) => setCompareMode(checked === true)}
              />
              <Label htmlFor="compare-mode" className="flex items-center gap-2 cursor-pointer">
                <Grid3X3 className="h-4 w-4" />
                Compare Features
              </Label>
            </div>
          </div>

          {/* Feature filter suggestions */}
          {featureFilter && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Available features:</span>
              {ALL_FEATURES.filter(f => 
                f.toLowerCase().includes(featureFilter.toLowerCase())
              ).map(feature => (
                <Badge 
                  key={feature} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setFeatureFilter(feature)}
                >
                  {feature}
                </Badge>
              ))}
            </div>
          )}

          {/* Sort controls for list view */}
          {!compareMode && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sort by Annual Rental:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="h-8"
              >
                {sortDirection === 'asc' ? (
                  <>Lowest First <ChevronUp className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Highest First <ChevronDown className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}

          {/* Main Content */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading catalog...</div>
          ) : groupedProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">No products match your filter</p>
              <p className="text-sm">Try a different feature name</p>
            </div>
          ) : compareMode ? (
            <FeatureComparisonMatrix />
          ) : (
            <ProductListView />
          )}
        </CardContent>
      </Card>

      {/* Edit/Add Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) {
          setSelectedFeatures([]);
          setFeaturesDropdownOpen(false);
        }
      }}>
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

              <div className="col-span-2">
                <Label>Features</Label>
                <div className="relative">
                  <div
                    className="flex flex-wrap gap-1 min-h-[40px] p-2 border border-input rounded-md cursor-pointer bg-background hover:bg-accent/50"
                    onClick={() => setFeaturesDropdownOpen(!featuresDropdownOpen)}
                  >
                    {selectedFeatures.length === 0 ? (
                      <span className="text-muted-foreground text-sm">Select features...</span>
                    ) : (
                      selectedFeatures.map(feature => (
                        <Badge 
                          key={feature} 
                          variant="secondary"
                          className="text-xs flex items-center gap-1"
                        >
                          {feature}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFeatures(prev => prev.filter(f => f !== feature));
                            }}
                          />
                        </Badge>
                      ))
                    )}
                  </div>
                  {featuresDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                      {ORDERED_FEATURES.map(feature => (
                        <div
                          key={feature}
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent ${
                            selectedFeatures.includes(feature) ? 'bg-accent/50' : ''
                          }`}
                          onClick={() => {
                            setSelectedFeatures(prev => 
                              prev.includes(feature) 
                                ? prev.filter(f => f !== feature)
                                : [...prev, feature]
                            );
                          }}
                        >
                          <Checkbox 
                            checked={selectedFeatures.includes(feature)}
                            className="pointer-events-none"
                          />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
