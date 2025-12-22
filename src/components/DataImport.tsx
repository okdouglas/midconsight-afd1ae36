import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Info, ExternalLink, BookOpen, HelpCircle, Calendar, FileArchive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { importFile, importTexasPermitsFromZip } from '@/lib/supabase-data';
import { toast } from 'sonner';
import type { ValidationError } from '@/lib/schema-mapping';

interface DataImportProps {
  onImportComplete: () => void;
}

export function DataImport({ onImportComplete }: DataImportProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    validRows: number;
    skippedRows: number;
    errors: ValidationError[];
  } | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [datasetName, setDatasetName] = useState('');
  const [selectedState, setSelectedState] = useState('OK');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Calculate suggested date range for Texas RRC (last 7 days)
  const getTexasDateRange = () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const formatDate = (d: Date) => {
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    };
    
    return {
      from: formatDate(sevenDaysAgo),
      to: formatDate(today)
    };
  };

  const dateRange = getTexasDateRange();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const name = datasetName || `Week of ${new Date().toLocaleDateString()}`;
      const result = await importFile(file, name);
      
      setImportResult({
        success: true,
        validRows: result.importResult.validRows,
        skippedRows: result.importResult.skippedRows,
        errors: result.importResult.errors
      });
      
      onImportComplete();
      setDatasetName('');
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        validRows: 0,
        skippedRows: 0,
        errors: [{ row: 0, field: 'file', value: '', reason: String(error) }]
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTexasZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Please upload a ZIP file from the Texas RRC');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const name = datasetName || `Texas Permits - ${new Date().toLocaleDateString()}`;
      
      const result = await importTexasPermitsFromZip(file, name);
      
      setImportResult({
        success: true,
        validRows: result.validRows,
        skippedRows: result.skippedRows,
        errors: []
      });

      toast.success(`Texas Import Complete: ${result.validRows} Permits with GPS Added`);
      onImportComplete();
      setDatasetName('');
    } catch (error) {
      console.error('Texas ZIP import failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      toast.error('Texas ZIP Import Failed', {
        description: errorMessage
      });
      
      setImportResult({
        success: false,
        validRows: 0,
        skippedRows: 0,
        errors: [{ row: 0, field: 'zip', value: '', reason: errorMessage }]
      });
    } finally {
      setIsImporting(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Import Area */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Import Weekly Permit Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="datasetName">Dataset Name (optional)</Label>
                <Input
                  id="datasetName"
                  placeholder="e.g., Week of Dec 16, 2025"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                />
              </div>

              {/* Oklahoma Upload */}
              {selectedState === 'OK' && (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isImporting ? 'Processing...' : 'Upload Excel/CSV File'}
                  </Button>
                </div>
              )}

              {/* Texas ZIP Upload */}
              {selectedState === 'TX' && (
                <div className="space-y-3">
                  <div className="p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 hover:border-primary/50 transition-colors">
                    <input
                      ref={zipInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleTexasZipUpload}
                      className="hidden"
                      id="zip-upload"
                    />
                    <div className="text-center">
                      <FileArchive className="h-10 w-10 mx-auto text-primary/60 mb-2" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        Upload Texas RRC ZIP File
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Download the "Drilling Permits Pending" ZIP from RRC and drop it here
                      </p>
                      <Button
                        onClick={() => zipInputRef.current?.click()}
                        disabled={isImporting}
                        variant="secondary"
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        {isImporting ? 'Processing ZIP...' : 'Select ZIP File'}
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Supports: Drilling Permits with Lat/Long data (ASCII format)
                  </p>
                </div>
              )}

              {importResult && (
                <div className={`p-4 rounded-lg ${importResult.success ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  <div className="flex items-start gap-3">
                    {importResult.success ? (
                      <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {importResult.success ? 'Import Complete!' : 'Import Failed'}
                      </p>
                      {importResult.success && (
                        <p className="text-sm text-muted-foreground">
                          {importResult.validRows} new permits imported • {importResult.skippedRows} rows skipped/duplicates
                        </p>
                      )}
                      {importResult.errors.length > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-sm"
                          onClick={() => setShowErrorDialog(true)}
                        >
                          View {importResult.errors.length} validation issues
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructional Sidebar */}
        <aside className="w-full lg:w-[350px] lg:sticky lg:top-4 lg:self-start">
          <div className="bg-muted/30 border-l-0 lg:border-l border-border rounded-lg p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Import Guide & Support</h3>
            </div>

            {/* State Selection */}
            <div className="space-y-2">
              <Label htmlFor="state-select" className="flex items-center gap-1.5 text-sm">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                Select State
              </Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger id="state-select" className="bg-background">
                  <SelectValue placeholder="Select a state..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OK">Oklahoma (OK)</SelectItem>
                  <SelectItem value="TX">Texas (TX)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Oklahoma Instructions */}
            {selectedState === 'OK' && (
              <Accordion type="single" collapsible defaultValue="instructions">
                <AccordionItem value="instructions" className="border-border/50">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-primary" />
                      How to pull Intent to Drill data
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <ol className="space-y-4 text-sm text-muted-foreground">
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          1
                        </span>
                        <div>
                          <p>Click this link to access the data portal:</p>
                          <a
                            href="https://oklahoma.gov/occ/divisions/oil-gas/oil-gas-data.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline mt-1 font-medium"
                          >
                            Oklahoma Oil & Gas Data
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          2
                        </span>
                        <p>Locate the <strong>"Oil and Gas Data Files"</strong> section on the page.</p>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          3
                        </span>
                        <p>Click and select the option <strong>"Intent to Drill - Last 7 Days"</strong> to download the CSV/Excel file.</p>
                      </li>
                      <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          4
                        </span>
                        <p>Once downloaded, drag and drop that file into the upload area on this page.</p>
                      </li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Texas Instructions */}
            {selectedState === 'TX' && (
              <>
                {/* Quick Action Button */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    asChild
                  >
                    <a
                      href="https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/#drilling-permit-data-table"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open RRC Data Portal
                    </a>
                  </Button>
                </div>

                {/* Date Range Helper */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Reference Date Range (Last 7 Days)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">From:</span>
                      <code className="ml-2 px-2 py-1 bg-background rounded border text-foreground">{dateRange.from}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">To:</span>
                      <code className="ml-2 px-2 py-1 bg-background rounded border text-foreground">{dateRange.to}</code>
                    </div>
                  </div>
                </div>

                <Accordion type="single" collapsible defaultValue="instructions">
                  <AccordionItem value="instructions" className="border-border/50">
                    <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
                      <span className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-primary" />
                        How to download Texas Permits (W-1)
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <ol className="space-y-4 text-sm text-muted-foreground">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                            1
                          </span>
                          <div>
                            <p>Click the <strong>"Open RRC Data Portal"</strong> button above.</p>
                          </div>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                            2
                          </span>
                          <p>Scroll to find the <strong>"Drilling Permit Data"</strong> table section.</p>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                            3
                          </span>
                          <p>Locate the row: <strong>"Drilling Permits Pending Approval (Includes Latitudes and Longitudes)"</strong></p>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                            4
                          </span>
                          <p>Click the <strong>"ASCII Format"</strong> link in that row to download the ZIP file.</p>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                            5
                          </span>
                          <p>Drop the downloaded ZIP file into the upload area above.</p>
                        </li>
                      </ol>
                      
                      <div className="mt-4 p-3 bg-success/10 rounded-lg">
                        <p className="text-xs text-success font-medium">
                          ✓ GPS coordinates are included automatically
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The ASCII format contains lat/long data for accurate map placement.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </>
            )}

            {/* Help Footer */}
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                {selectedState === 'TX' 
                  ? 'Download the ZIP with lat/long data for best results on the map.'
                  : 'Need help with other states? More data sources coming soon.'
                }
              </p>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Validation Issues ({importResult?.errors.length || 0})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {importResult?.errors.map((error, i) => (
                <div key={i} className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">Row {error.row}: {error.field}</p>
                  <p className="text-muted-foreground">{error.reason}</p>
                  {error.value && (
                    <p className="text-xs text-muted-foreground mt-1">Value: {error.value}</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
