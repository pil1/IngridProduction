/**
 * Receipt Thumbnail Component
 *
 * Displays receipt preview with thumbnail, file information,
 * and quick actions for viewing and downloading.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Receipt,
  FileText,
  Image,
  Download,
  Eye,
  ExternalLink,
  File,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Expense } from '@/types/expenses';

export interface ReceiptThumbnailProps {
  expense: Expense;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onViewClick?: () => void;
  onDownloadClick?: () => void;
}

// Get file type icon based on MIME type
const getFileIcon = (mimeType: string | null) => {
  if (!mimeType) return File;

  if (mimeType.startsWith('image/')) return Image;
  if (mimeType === 'application/pdf') return FileText;
  return File;
};

// Get file type color
const getFileTypeColor = (mimeType: string | null) => {
  if (!mimeType) return 'text-gray-500';

  if (mimeType.startsWith('image/')) return 'text-green-500';
  if (mimeType === 'application/pdf') return 'text-red-500';
  return 'text-gray-500';
};

// Format file size
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return 'Unknown size';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const ReceiptThumbnail: React.FC<ReceiptThumbnailProps> = ({
  expense,
  showCount = false,
  size = 'md',
  onViewClick,
  onDownloadClick
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const FileIcon = getFileIcon(expense.document_mime_type);
  const fileTypeColor = getFileTypeColor(expense.document_mime_type);

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-20 w-20',
    lg: 'h-24 w-24'
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  const handleViewClick = () => {
    onViewClick?.();
  };

  const handleDownloadClick = () => {
    onDownloadClick?.();
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gray-500" />
          Receipt
          {showCount && expense.receipt_count > 1 && (
            <Badge variant="secondary" className="text-xs">
              {expense.receipt_count} files
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Thumbnail Preview */}
        <div className="flex justify-center">
          <div className={cn(
            "relative overflow-hidden rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center",
            sizeClasses[size]
          )}>
            {expense.receipt_preview_url &&
             expense.document_mime_type?.startsWith('image/') &&
             !imageError ? (
              <>
                {imageLoading && (
                  <Skeleton className={cn("absolute inset-0", sizeClasses[size])} />
                )}
                <img
                  src={expense.receipt_preview_url}
                  alt="Receipt preview"
                  className={cn(
                    "object-cover w-full h-full transition-opacity",
                    imageLoading ? "opacity-0" : "opacity-100"
                  )}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-2">
                <FileIcon className={cn("h-6 w-6 mb-1", fileTypeColor)} />
                <span className="text-xs text-gray-500 text-center leading-tight">
                  {expense.document_mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* File Information */}
        <div className="space-y-2 text-sm">
          {expense.document_name && (
            <div>
              <p className="font-medium text-gray-900 truncate" title={expense.document_name}>
                {expense.document_name}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            {expense.document_size && (
              <div>
                <span className="font-medium">Size:</span>
                <br />
                {formatFileSize(expense.document_size)}
              </div>
            )}

            {expense.document_mime_type && (
              <div>
                <span className="font-medium">Type:</span>
                <br />
                {expense.document_mime_type.split('/')[1]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleViewClick}
            disabled={!expense.receipt_url}
          >
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={handleDownloadClick}
            disabled={!expense.receipt_url}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="space-y-1">
          {!expense.receipt_url && (
            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <AlertCircle className="h-3 w-3" />
              <span>Receipt not accessible</span>
            </div>
          )}

          {expense.receipt_url && (
            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 p-2 rounded">
              <ExternalLink className="h-3 w-3" />
              <span>Receipt available</span>
            </div>
          )}
        </div>

        {/* Multiple Files Indicator */}
        {showCount && expense.receipt_count > 1 && (
          <div className="text-xs text-center text-gray-500 pt-1 border-t border-gray-100">
            +{expense.receipt_count - 1} additional file{expense.receipt_count > 2 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
};