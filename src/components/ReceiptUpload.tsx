"use client";

import React, { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useDocumentUpload } from "@/hooks/useDocumentUpload";
import SmartDocumentWarnings, { DocumentAnalysisResult } from "@/components/SmartDocumentWarnings";
import PdfViewer from "./PdfViewer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";

interface ReceiptUploadProps {
  onFileSelected: (result: any, file: File, previewUrl: string, documentId?: string) => void;
  onRemoveFile: () => void;
  isLoading: boolean;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  currentPreviewUrl: string | null;
  companyId: string;
  userId: string;
  expenseId?: string;
  documentCategory?: 'expense' | 'receipt' | 'invoice';
}

const ReceiptUpload = ({
  onFileSelected,
  onRemoveFile,
  isLoading,
  setIsAnalyzing,
  currentPreviewUrl,
  companyId,
  userId,
  expenseId,
  documentCategory = 'receipt',
}: ReceiptUploadProps) => {
  const { toast } = useToast();
  const {
    uploadExpenseReceipt,
    uploadWithAnalysis,
    forceUpload,
    analyzeDocumentFull,
    isUploading: isDocumentUploading,
    isAnalyzing: isDocumentAnalyzing,
    analysisResult,
    uploadProgress,
    uploadedDocument,
    resetUpload,
  } = useDocumentUpload();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(currentPreviewUrl);
  const [localMimeType, setLocalMimeType] = useState<string | null>(null);

  // State for document intelligence
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  // Legacy duplicate warning state for compatibility
  const [isDuplicateWarningOpen, setIsDuplicateWarningOpen] = useState(false);
  const [duplicateExpenseId, setDuplicateExpenseId] = useState<string | null>(null);

  // Update local preview when currentPreviewUrl prop changes
  React.useEffect(() => {
    setLocalPreviewUrl(currentPreviewUrl);
    if (currentPreviewUrl) {
      const extension = currentPreviewUrl.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') {
        setLocalMimeType('application/pdf');
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension ?? '')) {
        setLocalMimeType(`image/${extension === 'jpg' ? 'jpeg' : extension}`);
      } else {
        setLocalMimeType(null);
      }
    } else {
      setLocalMimeType(null);
    }
  }, [currentPreviewUrl]);

  // Update setIsAnalyzing when document analyzing state changes
  React.useEffect(() => {
    setIsAnalyzing(isDocumentAnalyzing);
  }, [isDocumentAnalyzing, setIsAnalyzing]);

  const resetState = () => {
    setCurrentFile(null);
    setCurrentAnalysis(null);
    setShowWarnings(false);
    setIsDuplicateWarningOpen(false);
    setDuplicateExpenseId(null);
    resetUpload();
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    resetState();
    setCurrentFile(file);

    // Create preview URL immediately
    const previewUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(previewUrl);
    setLocalMimeType(file.type);

    try {
      // Use our new document intelligence analysis
      const analysis = await analyzeDocumentFull(file, 'expense_receipt', {
        enableDuplicateDetection: true,
        enableRelevanceAnalysis: true,
        enableContentAnalysis: true,
        duplicateScope: 'company',
        temporalToleranceDays: 30,
        strictRelevance: false
      });

      if (analysis) {
        setCurrentAnalysis(analysis);

        // Check for legacy duplicate detection compatibility
        const duplicateWarning = analysis.warnings.find(w => w.type === 'duplicate');
        if (duplicateWarning && analysis.duplicateAnalysis?.matches && analysis.duplicateAnalysis.matches.length > 0) {
          // For compatibility, show legacy duplicate warning for first match
          const firstMatch = analysis.duplicateAnalysis.matches[0];
          setDuplicateExpenseId(firstMatch.id);
          setIsDuplicateWarningOpen(true);
        } else if (analysis.recommendedAction === 'warn' || analysis.recommendedAction === 'reject') {
          // Show smart warnings for other issues
          setShowWarnings(true);
        } else {
          // Analysis looks good, proceed with upload
          await handleSuccessfulUpload(file, analysis, previewUrl);
        }
      } else {
        // Analysis failed, proceed with basic upload
        await handleBasicUpload(file, previewUrl);
      }

    } catch (error) {
      console.error("Document analysis failed:", error);
      toast({
        title: "Analysis Failed",
        description: "Proceeding with basic upload. Some intelligence features may not be available.",
        variant: "destructive",
      });
      await handleBasicUpload(file, previewUrl);
    }
  };

  const handleSuccessfulUpload = async (file: File, analysis: DocumentAnalysisResult, previewUrl: string) => {
    try {
      // Extract relevant data from content analysis for expense processing
      let expenseData = {};
      if (analysis.contentAnalysis) {
        const { businessEntities } = analysis.contentAnalysis;
        expenseData = {
          amounts: businessEntities.amounts || [],
          dates: businessEntities.dates || [],
          vendors: businessEntities.vendors || [],
          addresses: businessEntities.addresses || [],
          extractedText: analysis.contentAnalysis.extractedText,
          confidence: analysis.contentAnalysis.confidence,
          document_type_classification: 'receipt', // Set based on context
          document_type_confidence: analysis.relevanceAnalysis?.businessRelevance || 0.5,
        };
      }

      // Upload the document with extracted data
      const uploadedDoc = await uploadExpenseReceipt(file, expenseData, expenseId);

      if (uploadedDoc) {
        console.log(`Document uploaded with smart name: ${uploadedDoc.smartFileName}`);

        // Call parent callback with extracted data and document ID
        onFileSelected(expenseData, file, previewUrl, uploadedDoc.id);

        toast({
          title: "Document Processed Successfully",
          description: `File analyzed and saved as "${uploadedDoc.smartFileName}"`,
          variant: "default",
        });
      } else {
        // If document upload fails, still proceed with analysis data
        onFileSelected(expenseData, file, previewUrl);
      }
    } catch (error) {
      console.error("Document upload failed:", error);
      // Continue with analysis data even if document upload fails
      const basicExpenseData = {
        document_type_classification: 'receipt',
        document_type_confidence: 0.5,
        extractedText: '',
        amounts: [],
        dates: [],
        vendors: []
      };
      onFileSelected(basicExpenseData, file, previewUrl);
    }
  };

  const handleBasicUpload = async (file: File, previewUrl: string) => {
    try {
      const uploadedDoc = await uploadExpenseReceipt(file, {}, expenseId);

      const basicExpenseData = {
        document_type_classification: 'receipt',
        document_type_confidence: 0.5,
        extractedText: '',
        amounts: [],
        dates: [],
        vendors: []
      };

      if (uploadedDoc) {
        onFileSelected(basicExpenseData, file, previewUrl, uploadedDoc.id);
      } else {
        onFileSelected(basicExpenseData, file, previewUrl);
      }
    } catch (error) {
      console.error("Basic upload failed:", error);
      const basicExpenseData = {
        document_type_classification: 'receipt',
        document_type_confidence: 0.5,
        extractedText: '',
        amounts: [],
        dates: [],
        vendors: []
      };
      onFileSelected(basicExpenseData, file, previewUrl);
    }
  };

  const handleProceedAnyway = async () => {
    if (!currentFile || !currentAnalysis) return;

    try {
      // Force upload despite warnings
      const previewUrl = URL.createObjectURL(currentFile);
      await handleSuccessfulUpload(currentFile, currentAnalysis, previewUrl);
    } catch (error) {
      console.error("Force upload failed:", error);
      const previewUrl = URL.createObjectURL(currentFile);
      await handleBasicUpload(currentFile, previewUrl);
    }

    setShowWarnings(false);
  };

  const handleCancelUpload = () => {
    onRemoveFile();
    setLocalPreviewUrl(null);
    setLocalMimeType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    resetState();
    toast({ title: "Upload Canceled", description: "The file upload was canceled." });
  };

  const handleRetryAnalysis = async () => {
    if (!currentFile) return;
    await handleFileChange(currentFile);
  };

  const handleViewDuplicate = (duplicateId: string) => {
    // Open duplicate expense in new tab
    window.open(`/expenses/${duplicateId}`, '_blank');
  };

  // Legacy duplicate dialog handlers for compatibility
  const handleContinueUpload = async () => {
    if (!currentFile) return;

    try {
      const previewUrl = URL.createObjectURL(currentFile);
      if (currentAnalysis) {
        await handleSuccessfulUpload(currentFile, currentAnalysis, previewUrl);
      } else {
        await handleBasicUpload(currentFile, previewUrl);
      }
    } catch (error) {
      console.error("Continue upload failed:", error);
    }

    setIsDuplicateWarningOpen(false);
    resetState();
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleFileChange(acceptedFiles[0]);
      }
    },
    [companyId, userId, onFileSelected, setIsAnalyzing, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.tiff', '.bmp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isLoading || isDocumentUploading || isDocumentAnalyzing,
  });

  const handleManualFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveFile();
    setLocalPreviewUrl(null);
    setLocalMimeType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    resetState();
  };

  const handleDropzoneClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (fileInputRef.current && !isLoading && !isDocumentUploading && !isDocumentAnalyzing) {
      fileInputRef.current.click();
    }
  };

  const isProcessing = isLoading || isDocumentUploading || isDocumentAnalyzing;

  return (
    <div className="grid gap-4">
      <div
        {...getRootProps({ onClick: handleDropzoneClick })}
        className={cn(
          "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors",
          "hover:border-primary hover:bg-muted/50",
          isDragActive && "border-primary bg-muted/50",
          isProcessing && "opacity-70 cursor-not-allowed",
          localPreviewUrl && "border-solid border-primary/50"
        )}
      >
        <input {...getInputProps()} ref={fileInputRef} onChange={handleManualFileSelect} />

        {isProcessing ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {uploadProgress && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {isDocumentAnalyzing ? "Analyzing document with AI..." :
               isDocumentUploading ? `Uploading document... ${uploadProgress?.percentage || 0}%` :
               "Processing receipt..."}
            </p>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Drag & drop a receipt image or PDF here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">(Max 50MB)</p>
          </>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isProcessing}
        className="flex items-center gap-2 w-full"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        Choose File
      </Button>

      {/* Smart Document Warnings */}
      {showWarnings && currentAnalysis && (
        <SmartDocumentWarnings
          analysis={currentAnalysis}
          isLoading={false}
          context="expense_receipt"
          fileName={currentFile?.name}
          onRetry={handleRetryAnalysis}
          onViewDuplicate={handleViewDuplicate}
          onProceedAnyway={handleProceedAnyway}
          onCancel={handleCancelUpload}
          showDetailedAnalysis={true}
        />
      )}

      {localPreviewUrl && (
        <div className="relative border rounded-lg p-4 bg-muted/50 h-96 flex items-center justify-center">
          {localMimeType === 'application/pdf' ? (
            <PdfViewer pdfUrl={localPreviewUrl} />
          ) : (
            <img
              src={localPreviewUrl}
              alt="Receipt preview"
              className="max-h-full max-w-full object-contain rounded"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemoveClick}
            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 hover:bg-background"
            disabled={isProcessing}
          >
            <X className="h-4 w-4 text-destructive" />
            <span className="sr-only">Remove receipt</span>
          </Button>
        </div>
      )}

      {/* Legacy Duplicate Warning Dialog for compatibility */}
      <AlertDialog open={isDuplicateWarningOpen} onOpenChange={setIsDuplicateWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" /> Potential Duplicate Detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              This document appears to be a duplicate of an existing expense.
              {duplicateExpenseId && (
                <>
                  {" "}You can view the existing expense <Link to={`/expenses/${duplicateExpenseId}`} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">here</Link>.
                </>
              )}
              <br /><br />
              Are you sure you want to continue uploading this file?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUpload}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleContinueUpload}>Continue Upload</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReceiptUpload;