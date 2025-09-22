import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Database, Sheet, FileImage } from "lucide-react";
import { ExportFormat, ExportOptions } from "@/services/exportService";

interface ExportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => Promise<void>;
  dataType: 'expenses' | 'vendors' | 'users' | 'categories';
  itemCount: number;
  isLoading?: boolean;
}

const FORMAT_OPTIONS = [
  {
    value: 'csv' as ExportFormat,
    label: 'CSV',
    description: 'Comma-separated values',
    icon: FileText,
    recommended: true,
  },
  {
    value: 'json' as ExportFormat,
    label: 'JSON',
    description: 'JavaScript Object Notation',
    icon: Database,
  },
  {
    value: 'xlsx' as ExportFormat,
    label: 'Excel',
    description: 'Microsoft Excel format',
    icon: Sheet,
    comingSoon: true,
  },
  {
    value: 'pdf' as ExportFormat,
    label: 'PDF',
    description: 'Portable Document Format',
    icon: FileImage,
    comingSoon: true,
  },
];

export const ExportDialog = ({
  isOpen,
  onOpenChange,
  onExport,
  dataType,
  itemCount,
  isLoading = false,
}: ExportDialogProps) => {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filename, setFilename] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);

  const handleExport = async () => {
    const options: ExportOptions = {
      format,
      filename: filename.trim() ?? undefined,
      includeHeaders,
    };

    try {
      await onExport(options);
      onOpenChange(false);
      // Reset form
      setFilename('');
      setFormat('csv');
      setIncludeHeaders(true);
    } catch (error) {
      // Error handling is done in the export service
      console.error('Export failed:', error);
    }
  };

  const selectedFormat = FORMAT_OPTIONS.find(opt => opt.value === format);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export {dataType}
          </DialogTitle>
          <DialogDescription>
            Export {itemCount} {dataType} to your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format Selection */}
          <div className="space-y-3">
            <Label htmlFor="format">Export Format</Label>
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = format === option.value;
                const isDisabled = option.comingSoon;

                return (
                  <Card
                    key={option.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'ring-2 ring-primary border-primary'
                        : 'hover:border-primary/50'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => !isDisabled && setFormat(option.value)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{option.label}</span>
                        </div>
                        {option.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                        {option.comingSoon && (
                          <Badge variant="outline" className="text-xs">
                            Soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Export Options */}
          <div className="space-y-4">
            <Label>Export Options</Label>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeHeaders"
                  checked={includeHeaders}
                  onCheckedChange={(checked) => setIncludeHeaders(checked as boolean)}
                />
                <Label htmlFor="includeHeaders" className="text-sm">
                  Include column headers
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filename" className="text-sm">
                  Custom filename (optional)
                </Label>
                <Input
                  id="filename"
                  placeholder={`${dataType}-export`}
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to auto-generate with timestamp
                </p>
              </div>
            </div>
          </div>

          {/* Export Preview */}
          {selectedFormat && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Export Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items:</span>
                  <span>{itemCount} {dataType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Format:</span>
                  <span>{selectedFormat.label} (.{format})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Headers:</span>
                  <span>{includeHeaders ? 'Included' : 'Excluded'}</span>
                </div>
                {filename && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Filename:</span>
                    <span className="truncate max-w-[200px]">
                      {filename}.{format}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isLoading || !selectedFormat || selectedFormat.comingSoon}
          >
            {isLoading ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;