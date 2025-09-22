/**
 * Step 1: Document Upload Component
 *
 * Handles file upload and initial Ingrid processing with drag-and-drop interface,
 * real-time AI analysis, and permission-aware document processing.
 */

import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  Image,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ingridCore } from '@/services/ingrid/IngridCore';
import { IngridAvatar } from './IngridAvatar';
import type { IngridResponse, SecurityContext } from '@/types/ingrid';

interface Step1DocumentUploadProps {
  onDocumentProcessed: (file: File, response: IngridResponse) => void;
  onSkipToManual?: () => void;
  isProcessing: boolean;
  securityContext: SecurityContext | null;
  onProcessingStart?: () => void;
  companyId?: string; // Optional company ID for enhanced categorization
}

interface UploadProgress {
  phase: 'uploading' | 'analyzing' | 'processing' | 'complete';
  percentage: number;
  message: string;
}

export const Step1DocumentUpload: React.FC<Step1DocumentUploadProps> = ({
  onDocumentProcessed,
  onSkipToManual,
  isProcessing,
  securityContext,
  onProcessingStart,
  companyId
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File type validation
  const acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
  };

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  // Process file with Ingrid
  const processWithIngrid = useCallback(async (file: File) => {
    try {
      setError(null);

      // Start timing
      onProcessingStart?.();

      setUploadProgress({
        phase: 'uploading',
        percentage: 20,
        message: 'Uploading document...'
      });

      // Simulate upload progress
      await new Promise(resolve => setTimeout(resolve, 500));

      setUploadProgress({
        phase: 'analyzing',
        percentage: 40,
        message: 'Ingrid is analyzing your document...'
      });

      // Process document with Ingrid
      const response = await ingridCore.processDocument({
        document: file,
        context: 'expense_creation',
        userMessage: `Process this ${file.name} for expense creation`,
        securityContext: securityContext || undefined,
        companyId: companyId || undefined
      });

      setUploadProgress({
        phase: 'processing',
        percentage: 80,
        message: 'Extracting expense data...'
      });

      // Simulate final processing
      await new Promise(resolve => setTimeout(resolve, 300));

      setUploadProgress({
        phase: 'complete',
        percentage: 100,
        message: 'Analysis complete!'
      });

      // Wait a moment to show completion, then proceed
      setTimeout(() => {
        onDocumentProcessed(file, response);
        setUploadProgress(null);
      }, 800);

    } catch (error) {
      console.error('Ingrid processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process document');
      setUploadProgress(null);

      toast({
        title: "Processing Failed",
        description: "Ingrid couldn't analyze your document. Please try again.",
        variant: "destructive"
      });
    }
  }, [securityContext, onDocumentProcessed, toast, onProcessingStart]);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    // Validate file type
    const isValidType = Object.keys(acceptedFileTypes).includes(file.type);
    if (!isValidType) {
      setError('Unsupported file type. Please upload a PDF, image, or document.');
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      setError('File too large. Please upload files smaller than 10MB.');
      return;
    }

    setUploadedFile(file);
    setError(null);

    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    // Process with Ingrid
    await processWithIngrid(file);
  }, [processWithIngrid]);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleFileSelect,
    accept: acceptedFileTypes,
    maxSize: maxFileSize,
    multiple: false,
    disabled: isProcessing || !!uploadProgress
  });

  // Clear uploaded file
  const handleClearFile = useCallback(() => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setError(null);
    setUploadProgress(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  // File icon based on type
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    return <FileText className="h-8 w-8 text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className="border-2 border-dashed transition-colors">
        <CardContent className="p-8">
          {!uploadedFile ? (
            <div
              {...getRootProps()}
              className={cn(
                "cursor-pointer transition-colors rounded-lg p-8 text-center",
                isDragActive && !isDragReject && "bg-blue-50 border-blue-300",
                isDragReject && "bg-red-50 border-red-300",
                (isProcessing || uploadProgress) && "cursor-not-allowed opacity-50"
              )}
            >
              <input {...getInputProps()} ref={fileInputRef} />

              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-blue-100 rounded-full">
                  <Upload className="h-8 w-8 text-blue-600" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Upload your receipt or invoice
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Drag and drop a file here, or click to browse
                  </p>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>Supported formats: PDF, JPG, PNG, GIF, DOC, DOCX</p>
                  <p>Maximum file size: 10MB</p>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isProcessing || !!uploadProgress}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>

                  {onSkipToManual && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isProcessing || !!uploadProgress}
                      onClick={onSkipToManual}
                    >
                      Skip to Manual Entry
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // File uploaded view
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getFileIcon(uploadedFile)}
                  <div>
                    <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-600">
                      {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                </div>

                {!uploadProgress && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFile}
                    disabled={isProcessing}
                  >
                    Remove
                  </Button>
                )}
              </div>

              {/* Image preview */}
              {previewUrl && (
                <div className="mt-4">
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="max-w-full max-h-48 object-contain rounded-lg border"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Progress */}
      {uploadProgress && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <IngridAvatar size="sm" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    {uploadProgress.message}
                  </h4>
                  <span className="text-sm text-gray-600">
                    {uploadProgress.percentage}%
                  </span>
                </div>

                <Progress
                  value={uploadProgress.percentage}
                  className="h-2"
                />

                <div className="text-sm text-gray-600">
                  {uploadProgress.phase === 'uploading' && "Uploading your document..."}
                  {uploadProgress.phase === 'analyzing' && "Ingrid is reading and understanding your document..."}
                  {uploadProgress.phase === 'processing' && "Extracting expense details and categorizing..."}
                  {uploadProgress.phase === 'complete' && "Analysis complete! Ready to review extracted data."}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      {!uploadedFile && !uploadProgress && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900 mb-2">
                  How Ingrid helps with expense creation
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Automatically extracts amounts, dates, and vendor information</li>
                  <li>• Suggests appropriate expense categories and GL accounts</li>
                  <li>• Identifies tax amounts and currency details</li>
                  <li>• Provides confidence scores for all extracted data</li>
                  {securityContext && (
                    <li>• Respects your access permissions for sensitive data</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};