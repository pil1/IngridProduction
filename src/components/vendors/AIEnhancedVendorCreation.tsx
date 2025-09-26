/**
 * AI-Enhanced Vendor Creation Component
 *
 * Provides document upload and AI extraction capabilities for vendor creation.
 * Integrates with Google Document AI to extract vendor details from invoices,
 * receipts, business cards, and other documents.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import {
  Upload,
  FileText,
  Image,
  Mail,
  CreditCard,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  AlertCircle,
  RefreshCw,
  Eye,
  Download
} from 'lucide-react';

// Import our services
import { VendorDocumentProcessor, VendorProcessingResult } from '@/services/ingrid/VendorDocumentProcessor';
import AddEditVendorDialog, { VendorFormValues } from '@/components/AddEditVendorDialog';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import SmartDocumentWarnings, { DocumentAnalysisResult } from '@/components/SmartDocumentWarnings';

interface AIEnhancedVendorCreationProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  companyId: string;
}

type ProcessingStage = 'upload' | 'processing' | 'review' | 'create';

interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number;
  message: string;
  result?: VendorProcessingResult;
}

const AIEnhancedVendorCreation: React.FC<AIEnhancedVendorCreationProps> = ({
  isOpen,
  onOpenChange,
  onSuccess,
  companyId
}) => {
  const { toast } = useToast();
  const { profile } = useSession();

  // Document intelligence hooks
  const {
    analyzeDocumentFull,
    uploadVendorDocument,
    isAnalyzing,
    isUploading,
    uploadProgress,
    resetUpload,
  } = useDocumentUpload();

  const [processingState, setProcessingState] = useState<ProcessingProgress>({
    stage: 'upload',
    progress: 0,
    message: 'Ready to process vendor documents'
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [extractedData, setExtractedData] = useState<Partial<VendorFormValues> | null>(null);
  const [bypassAI, setBypassAI] = useState(false);

  // Document intelligence state
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  // Initialize the document processor
  const documentProcessor = new VendorDocumentProcessor();

  // File upload configuration
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);

    if (!profile?.user_id || !profile?.company_id) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to process documents',
        variant: 'destructive'
      });
      return;
    }

    // Start processing with new document intelligence
    await processDocumentWithIntelligence(file);
  }, [profile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    maxFiles: 1,
    disabled: processingState.stage === 'processing' || isAnalyzing || isUploading
  });

  /**
   * Process the uploaded document with enhanced document intelligence
   */
  const processDocumentWithIntelligence = async (file: File) => {
    try {
      setProcessingState({
        stage: 'processing',
        progress: 10,
        message: 'Starting intelligent document analysis...'
      });

      // Step 1: Comprehensive document analysis with intelligence
      setProcessingState({
        stage: 'processing',
        progress: 30,
        message: 'Analyzing document with AI intelligence...'
      });

      const analysis = await analyzeDocumentFull(file, 'vendor_document', {
        enableDuplicateDetection: true,
        enableRelevanceAnalysis: true,
        enableContentAnalysis: true,
        duplicateScope: 'company',
        temporalToleranceDays: 30,
        strictRelevance: false
      });

      if (!analysis) {
        throw new Error('Document intelligence analysis failed');
      }

      setAnalysisResult(analysis);

      // Step 2: Check for warnings that need user attention
      if (analysis.recommendedAction === 'reject' || analysis.recommendedAction === 'warn') {
        setProcessingState({
          stage: 'review',
          progress: 50,
          message: 'Document analysis complete - review required.'
        });
        setShowWarnings(true);
        return;
      }

      // Step 3: Process with legacy vendor document processor for data extraction
      setProcessingState({
        stage: 'processing',
        progress: 60,
        message: 'Extracting vendor information...'
      });

      const userContext = {
        userId: profile!.user_id,
        companyId: profile!.company_id,
        role: profile!.role
      };

      let vendorData: Partial<VendorFormValues> = {};

      try {
        // Use legacy processor for now, but enhance with intelligence data
        const result = await documentProcessor.processVendorDocument(file, userContext);
        vendorData = result.prefillData;
      } catch (legacyError) {
        console.warn('Legacy processor failed, using intelligence data:', legacyError);

        // Fallback to intelligence analysis data
        if (analysis.contentAnalysis) {
          const { businessEntities } = analysis.contentAnalysis;
          vendorData = {
            name: businessEntities.vendors?.[0]?.name || '',
            email: businessEntities.emails?.[0]?.value || '',
            phone: businessEntities.phoneNumbers?.[0]?.value || '',
            address_line_1: businessEntities.addresses?.[0]?.street || '',
            city: businessEntities.addresses?.[0]?.city || '',
            state: businessEntities.addresses?.[0]?.state || '',
            postal_code: businessEntities.addresses?.[0]?.postalCode || '',
            country: businessEntities.addresses?.[0]?.country || '',
          };
        }
      }

      // Step 4: Upload document to our system
      setProcessingState({
        stage: 'processing',
        progress: 80,
        message: 'Uploading document...'
      });

      const uploadedDoc = await uploadVendorDocument(file, vendorData, undefined, 'other');

      // Step 5: Complete
      setProcessingState({
        stage: 'review',
        progress: 100,
        message: 'Analysis complete! Review the extracted information.',
        result: {
          prefillData: vendorData,
          confidence: Math.round(analysis.overallScore * 100),
          message: 'Document processed successfully with intelligence',
          analysis: analysis
        } as VendorProcessingResult
      });

      setExtractedData(vendorData);

      toast({
        title: 'Document Processed Successfully',
        description: `Vendor information extracted with ${Math.round(analysis.overallScore * 100)}% confidence${uploadedDoc ? ` and saved as "${uploadedDoc.smartFileName}"` : ''}`,
      });

    } catch (error) {
      console.error('Document processing error:', error);

      setProcessingState({
        stage: 'upload',
        progress: 0,
        message: 'Processing failed. Please try again.'
      });

      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Failed to process document',
        variant: 'destructive'
      });
    }
  };

  /**
   * Reset the component to initial state
   */
  const resetState = () => {
    setProcessingState({
      stage: 'upload',
      progress: 0,
      message: 'Ready to process vendor documents'
    });
    setUploadedFile(null);
    setExtractedData(null);
    setShowVendorForm(false);
    setBypassAI(false);
    setAnalysisResult(null);
    setShowWarnings(false);
    resetUpload();
  };

  /**
   * Handle proceeding despite analysis warnings
   */
  const handleProceedAnyway = async () => {
    if (!uploadedFile || !analysisResult) return;

    setShowWarnings(false);

    try {
      // Continue with processing despite warnings
      setProcessingState({
        stage: 'processing',
        progress: 60,
        message: 'Extracting vendor information...'
      });

      const userContext = {
        userId: profile!.user_id,
        companyId: profile!.company_id,
        role: profile!.role
      };

      let vendorData: Partial<VendorFormValues> = {};

      // Use intelligence data for vendor extraction
      if (analysisResult.contentAnalysis) {
        const { businessEntities } = analysisResult.contentAnalysis;
        vendorData = {
          name: businessEntities.vendors?.[0]?.name || '',
          email: businessEntities.emails?.[0]?.value || '',
          phone: businessEntities.phoneNumbers?.[0]?.value || '',
          address_line_1: businessEntities.addresses?.[0]?.street || '',
          city: businessEntities.addresses?.[0]?.city || '',
          state: businessEntities.addresses?.[0]?.state || '',
          postal_code: businessEntities.addresses?.[0]?.postalCode || '',
          country: businessEntities.addresses?.[0]?.country || '',
        };
      }

      // Upload document
      setProcessingState({
        stage: 'processing',
        progress: 80,
        message: 'Uploading document...'
      });

      const uploadedDoc = await uploadVendorDocument(uploadedFile, vendorData, undefined, 'other');

      // Complete
      setProcessingState({
        stage: 'review',
        progress: 100,
        message: 'Analysis complete! Review the extracted information.',
        result: {
          prefillData: vendorData,
          confidence: Math.round(analysisResult.overallScore * 100),
          message: 'Document processed successfully with intelligence',
          analysis: analysisResult
        } as VendorProcessingResult
      });

      setExtractedData(vendorData);

      toast({
        title: 'Document Processed Successfully',
        description: `Vendor information extracted${uploadedDoc ? ` and saved as "${uploadedDoc.smartFileName}"` : ''}`,
      });

    } catch (error) {
      console.error('Force processing error:', error);
      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Failed to process document',
        variant: 'destructive'
      });
    }
  };

  /**
   * Handle canceling upload due to warnings
   */
  const handleCancelUpload = () => {
    resetState();
    toast({
      title: 'Upload Canceled',
      description: 'Document upload was canceled due to analysis warnings.',
    });
  };

  /**
   * Handle retrying analysis
   */
  const handleRetryAnalysis = async () => {
    if (!uploadedFile) return;
    await processDocumentWithIntelligence(uploadedFile);
  };

  /**
   * Handle viewing duplicate document
   */
  const handleViewDuplicate = (duplicateId: string) => {
    // Open duplicate document in new tab
    window.open(`/documents/${duplicateId}`, '_blank');
  };

  /**
   * Handle manual vendor creation (bypassing AI)
   */
  const handleManualCreation = () => {
    setBypassAI(true);
    setExtractedData(null);
    setShowVendorForm(true);
  };

  /**
   * Handle successful vendor creation
   */
  const handleVendorCreated = () => {
    setShowVendorForm(false);
    resetState();
    onSuccess();
    onOpenChange(false);

    toast({
      title: 'Vendor Created Successfully',
      description: 'The vendor has been added to your database',
    });
  };

  /**
   * Get appropriate icon for document type
   */
  const getDocumentIcon = (file: File) => {
    const type = file.type.toLowerCase();
    if (type.includes('image')) return <Image className="h-8 w-8" />;
    if (type.includes('pdf')) return <FileText className="h-8 w-8" />;
    if (type.includes('message')) return <Mail className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  /**
   * Get confidence color and description
   */
  const getConfidenceDisplay = (confidence: number) => {
    if (confidence >= 80) {
      return { color: 'text-green-600', bg: 'bg-green-100', label: 'High Confidence' };
    } else if (confidence >= 60) {
      return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Medium Confidence' };
    } else {
      return { color: 'text-red-600', bg: 'bg-red-100', label: 'Low Confidence' };
    }
  };

  const renderUploadStage = () => (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2">
          {isDragActive ? 'Drop your document here' : 'Upload Vendor Document'}
        </h3>
        <p className="text-gray-500 mb-4">
          Drag & drop or click to upload invoices, receipts, or business cards
        </p>
        <div className="flex justify-center space-x-2 mb-4">
          <Badge variant="outline">
            <FileText className="h-3 w-3 mr-1" />
            PDF
          </Badge>
          <Badge variant="outline">
            <Image className="h-3 w-3 mr-1" />
            Images
          </Badge>
          <Badge variant="outline">
            <CreditCard className="h-3 w-3 mr-1" />
            Business Cards
          </Badge>
        </div>
        <Button variant="outline" className="mt-2">
          Choose File
        </Button>
      </div>

      {/* Manual Entry Option */}
      <div className="text-center">
        <Separator className="my-6" />
        <p className="text-sm text-gray-500 mb-4">
          Prefer to enter vendor details manually?
        </p>
        <Button
          onClick={handleManualCreation}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <FileText className="h-4 w-4 mr-2" />
          Add Manually
        </Button>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm">
              <Bot className="h-4 w-4 mr-2 text-blue-500" />
              AI Extraction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Automatically extract vendor name, contact info, and address details
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm">
              <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
              Web Enrichment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Enhance data with additional company information from the web
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm">
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Smart Validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Check for duplicates and validate extracted information
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderProcessingStage = () => (
    <div className="space-y-6">
      {/* Processing Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Bot className="h-16 w-16 text-blue-500" />
            <Loader2 className="absolute -top-1 -right-1 h-6 w-6 animate-spin text-blue-600" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">AI Processing Document</h3>
        <p className="text-gray-600">{processingState.message}</p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={processingState.progress} className="w-full" />
        <div className="flex justify-between text-sm text-gray-500">
          <span>{processingState.progress}% Complete</span>
          <span>Processing...</span>
        </div>
      </div>

      {/* File Info */}
      {uploadedFile && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              {getDocumentIcon(uploadedFile)}
              <div className="flex-1">
                <p className="font-medium">{uploadedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderReviewStage = () => {
    const result = processingState.result!;
    const confidence = getConfidenceDisplay(result.confidence);

    return (
      <div className="space-y-6">
        {/* Results Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold">Document Analysis Complete</h3>
          <p className="text-gray-600">{result.message}</p>
        </div>

        {/* Confidence Score */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${confidence.bg}`} />
                <span className="font-medium">Extraction Confidence</span>
              </div>
              <Badge variant="outline" className={confidence.color}>
                {result.confidence}% {confidence.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Extracted Information Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Extracted Vendor Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extractedData?.name && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Vendor Name:</span>
                <span className="text-sm">{extractedData.name}</span>
              </div>
            )}
            {extractedData?.email && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm">{extractedData.email}</span>
              </div>
            )}
            {extractedData?.phone && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Phone:</span>
                <span className="text-sm">{extractedData.phone}</span>
              </div>
            )}
            {extractedData?.address_line_1 && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Address:</span>
                <span className="text-sm">{extractedData.address_line_1}</span>
              </div>
            )}
            {(!extractedData?.name && !extractedData?.email && !extractedData?.phone) && (
              <p className="text-sm text-gray-500 italic">
                Limited information extracted. Manual entry may be required.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Suggestions */}
        {result.analysis.suggestions.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Suggestions:</strong>
              <ul className="mt-2 ml-4 list-disc text-sm">
                {result.analysis.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={() => setShowVendorForm(true)}
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Create Vendor
          </Button>
          <Button
            onClick={resetState}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Another
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen && !showVendorForm} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              AI-Enhanced Vendor Creation
            </DialogTitle>
            <DialogDescription>
              Upload a vendor document and let AI extract the details automatically
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {processingState.stage === 'upload' && renderUploadStage()}
            {processingState.stage === 'processing' && renderProcessingStage()}
            {processingState.stage === 'review' && !showWarnings && renderReviewStage()}

            {/* Smart Document Warnings */}
            {showWarnings && analysisResult && (
              <SmartDocumentWarnings
                analysis={analysisResult}
                isLoading={isAnalyzing || isUploading}
                context="vendor_document"
                fileName={uploadedFile?.name}
                onRetry={handleRetryAnalysis}
                onViewDuplicate={handleViewDuplicate}
                onProceedAnyway={handleProceedAnyway}
                onCancel={handleCancelUpload}
                showDetailedAnalysis={true}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendor Creation Form */}
      {showVendorForm && (
        <AddEditVendorDialog
          isOpen={showVendorForm}
          onOpenChange={(open) => {
            setShowVendorForm(open);
            if (!open) {
              // If form is closed without saving, go back to review
              setShowVendorForm(false);
            }
          }}
          companyId={companyId}
          initialMode="add"
          prefillData={extractedData}
          editingVendor={null}
          onSuccess={handleVendorCreated}
        />
      )}
    </>
  );
};

export default AIEnhancedVendorCreation;