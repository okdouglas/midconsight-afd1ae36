import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Info, ExternalLink, BookOpen, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { importFile } from '@/lib/supabase-data';
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

              <div className="flex items-center gap-4">
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
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Instructions */}
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

            {/* Help Footer */}
            <div className="pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Need help with other states? More data sources coming soon.
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