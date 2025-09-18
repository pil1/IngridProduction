"use client";

import React, { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Link } from "react-router-dom"; // For linking to duplicate expense

interface ReceiptUploadProps {
  onFileSelected: (result: any, file: File, previewUrl: string) => void;
  onRemoveFile: () => void;
  isLoading: boolean;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  currentPreviewUrl: string | null;
  companyId: string;
  userId: string;
}

const DOCUMENT_TYPE_CONFIDENCE_THRESHOLD = 0.7; // 70% confidence needed for 'receipt' or 'invoice'

const ReceiptUpload = ({
  onFileSelected,
  onRemoveFile,
  isLoading,
  setIsAnalyzing,
  currentPreviewUrl,
  companyId,
  userId,
}: ReceiptUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(currentPreviewUrl);
  const [localMimeType, setLocalMimeType] = useState<string | null>(null);

  // State for AI warnings
  const [isDuplicateWarningOpen, setIsDuplicateWarningOpen] = useState(false);
  const [duplicateExpenseId, setDuplicateExpenseId] = useState<string | null>(null);
  const [isDocumentTypeWarningOpen, setIsDocumentTypeWarningOpen] = useState(false);
  const [documentTypeWarningMessage, setDocumentTypeWarningMessage] = useState<string | null>(null);

  // State to hold data while warnings are being addressed
  const [pendingAiResult, setPendingAiResult] = useState<any>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  // Update local preview when currentPreviewUrl prop changes (e.g., when editing an existing expense)
  React.useEffect(() => {
    setLocalPreviewUrl(currentPreviewUrl);
    if (currentPreviewUrl) {
      const extension = currentPreviewUrl.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') {
        setLocalMimeType('application/pdf');
      } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
        setLocalMimeType(`image/${extension === 'jpg' ? 'jpeg' : extension}`);
      } else {
        setLocalMimeType(null); // Unknown type
      }
    } else {
      setLocalMimeType(null);
    }
  }, [currentPreviewUrl]);

  const resetWarnings = () => {
    setIsDuplicateWarningOpen(false);
    setDuplicateExpenseId(null);
    setIsDocumentTypeWarningOpen(false);
    setDocumentTypeWarningMessage(null);
    setPendingAiResult(null);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit for files
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    resetWarnings(); // Clear any previous warnings
    
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (!base64) {
        toast({ title: "Error", description: "Failed to read file.", variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('analyze-expense', {
          body: { fileBase64: base64, mimeType: file.type, companyId: companyId },
        });

        if (error) throw error;

        const aiResult = data.data;
        const previewUrl = URL.createObjectURL(file);

        setPendingAiResult(aiResult);
        setPendingFile(file);
        setPendingPreviewUrl(previewUrl);

        // --- AI Warning Logic ---
        const docType = aiResult.document_type_classification;
        const docConfidence = aiResult.document_type_confidence ?? 0;

        const isNotReceiptOrInvoice = docType === 'other' || (
          (docType === 'receipt' || docType === 'invoice') && docConfidence < DOCUMENT_TYPE_CONFIDENCE_THRESHOLD
        );

        if (aiResult.is_duplicate) {
          setDuplicateExpenseId(aiResult.duplicate_expense_id);
          setIsDuplicateWarningOpen(true);
        } else if (isNotReceiptOrInvoice) {
          setDocumentTypeWarningMessage(
            `This document appears to be something other than an expense receipt or invoice.`
          );
          setIsDocumentTypeWarningOpen(true);
        } else {
          // No warnings, proceed directly
          setLocalPreviewUrl(previewUrl);
          setLocalMimeType(file.type);
          onFileSelected(aiResult, file, previewUrl);
          setIsAnalyzing(false);
        }

      } catch (aiError: any) {
        console.error("AI analysis failed:", aiError);
        toast({
          title: "AI Analysis Failed",
          description: aiError.message || "Could not extract details from the receipt. Please enter manually.",
          variant: "destructive",
        });
        // Fallback: still provide the file and preview, but with empty analysis result
        const previewUrl = URL.createObjectURL(file);
        setLocalPreviewUrl(previewUrl);
        setLocalMimeType(file.type);
        onFileSelected({}, file, previewUrl);
        setIsAnalyzing(false);
      }
    };
    reader.onerror = (error) => {
      console.error("File reader error:", error);
      toast({ title: "Error", description: "Failed to read file.", variant: "destructive" });
      setIsAnalyzing(false);
    };
  };

  const handleContinueUpload = () => {
    if (pendingAiResult && pendingFile && pendingPreviewUrl) {
      setLocalPreviewUrl(pendingPreviewUrl);
      setLocalMimeType(pendingFile.type);
      onFileSelected(pendingAiResult, pendingFile, pendingPreviewUrl);
    }
    setIsAnalyzing(false);
    resetWarnings();
  };

  const handleCancelUpload = () => {
    onRemoveFile(); // Clear the file from the parent component
    setLocalPreviewUrl(null); // Clear local preview
    setLocalMimeType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input
    }
    setIsAnalyzing(false);
    resetWarnings();
    toast({ title: "Upload Canceled", description: "The file upload was canceled." });
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
      'image/*': ['.jpeg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isLoading,
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
    setLocalPreviewUrl(null); // Clear local preview
    setLocalMimeType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input
    }
    resetWarnings(); // Also reset warnings if user manually removes file
  };

  const handleDropzoneClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (fileInputRef.current && !isLoading) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="grid gap-4">
      <div
        {...getRootProps({ onClick: handleDropzoneClick })}
        className={cn(
          "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors",
          "hover:border-primary hover:bg-muted/50",
          isDragActive && "border-primary bg-muted/50",
          isLoading && "opacity-70 cursor-not-allowed",
          localPreviewUrl && "border-solid border-primary/50"
        )}
      >
        <input {...getInputProps()} ref={fileInputRef} onChange={handleManualFileSelect} />
        
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {isLoading ? "Analyzing receipt..." : "Drag & drop a receipt image or PDF here, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground">(Max 5MB)</p>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isLoading}
        className="flex items-center gap-2 w-full"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        Choose File
      </Button>

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
            disabled={isLoading}
          >
            <X className="h-4 w-4 text-destructive" />
            <span className="sr-only">Remove receipt</span>
          </Button>
        </div>
      )}

      {/* Duplicate Warning Dialog */}
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

      {/* Document Type Warning Dialog */}
      <AlertDialog open={isDocumentTypeWarningOpen} onOpenChange={setIsDocumentTypeWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" /> Are you sure this is an expense?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {documentTypeWarningMessage}
              <br /><br />
              Are you sure you want to continue?
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