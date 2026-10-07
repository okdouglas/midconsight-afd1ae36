import { useState } from 'react';
import { Info, AlertTriangle, Trash2, Download, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface ImportMetadata {
  searchCriteria?: string;
  dateRange?: string;
  totalRecords?: number;
  rawHeaderRows?: string[];
}

export interface SkippedRow {
  rowNumber: number;
  reason: 'Header/Metadata' | 'Mapping Failed' | 'Missing Coordinates' | 'Invalid Data' | 'Duplicate';
  rawContent: string;
}

interface ImportAddendumProps {
  metadata: ImportMetadata | null;
  skippedRows: SkippedRow[];
  onClearLogs: () => void;
}

export function ImportAddendum({ metadata, skippedRows, onClearLogs }: ImportAddendumProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Don't render if no data
  if (!metadata && skippedRows.length === 0) {
    return null;
  }

  const handleExportSkipped = () => {
    if (skippedRows.length === 0) return;
    
    setIsExporting(true);
    try {
      const csvContent = [
        ['Row Number', 'Reason', 'Raw Content'].join(','),
        ...skippedRows.map(row => [
          row.rowNumber,
          `"${row.reason}"`,
          `"${row.rawContent.replace(/"/g, '""')}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `skipped_rows_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Import Summary & Metadata
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column: Search Context / Metadata */}
          {metadata && (metadata.searchCriteria || metadata.dateRange || (metadata.rawHeaderRows && metadata.rawHeaderRows.length > 0)) && (
            <div className="bg-muted/30 border border-muted rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium flex items-center gap-2 text-muted-foreground mb-2">
                <Info className="h-4 w-4" />
                Search Context
              </div>
              {metadata.searchCriteria && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Criteria:</span>{' '}
                  <span className="tabular-nums text-xs bg-background/50 px-2 py-0.5 rounded">
                    {metadata.searchCriteria}
                  </span>
                </div>
              )}
              {metadata.dateRange && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Date Range:</span>{' '}
                  <span className="tabular-nums text-xs bg-background/50 px-2 py-0.5 rounded">
                    {metadata.dateRange}
                  </span>
                </div>
              )}
              {metadata.totalRecords !== undefined && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Total Records in File:</span>{' '}
                  <span className="font-semibold">{metadata.totalRecords}</span>
                </div>
              )}
              {metadata.rawHeaderRows && metadata.rawHeaderRows.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground block mb-1">File Header:</span>
                  <div className="tabular-nums text-xs bg-background/50 p-2 rounded max-h-20 overflow-y-auto">
                    {metadata.rawHeaderRows.map((row, idx) => (
                      <div key={idx} className="text-muted-foreground/70 truncate">
                        {row || '(empty row)'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Column: Skipped Rows Grid */}
          {skippedRows.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg">
              <div className="flex items-center justify-between py-3 px-4 border-b border-destructive/10">
                <div className="text-sm font-medium flex items-center gap-2 text-destructive/80">
                  <AlertTriangle className="h-4 w-4" />
                  Skipped Rows ({skippedRows.length})
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleExportSkipped}
                    disabled={isExporting}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={onClearLogs}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <div className="py-2 px-4">
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-destructive/10">
                        <TableHead className="w-16 text-xs py-1 text-destructive/60">Row</TableHead>
                        <TableHead className="w-32 text-xs py-1 text-destructive/60">Reason</TableHead>
                        <TableHead className="text-xs py-1 text-destructive/60">Raw Content</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skippedRows.map((row, idx) => (
                        <TableRow 
                          key={idx} 
                          className="hover:bg-destructive/5 border-destructive/10"
                        >
                          <TableCell className="tabular-nums text-xs py-1.5 text-muted-foreground">
                            {row.rowNumber}
                          </TableCell>
                          <TableCell className="text-xs py-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              row.reason === 'Header/Metadata' 
                                ? 'bg-muted text-muted-foreground' 
                                : row.reason === 'Duplicate'
                                ? 'bg-score-warm/40 text-score-warm-foreground'
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                              {row.reason}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums text-xs py-1.5 text-muted-foreground truncate max-w-[300px]">
                            {row.rawContent}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
