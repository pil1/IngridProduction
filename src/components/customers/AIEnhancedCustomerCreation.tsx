/**
 * AI-Enhanced Customer Creation Component
 *
 * Provides document upload and AI extraction capabilities for customer creation.
 * Integrates with Google Document AI to extract customer details from business cards,
 * brochures, email signatures, and other customer documents.
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
  Users,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  AlertCircle,
  RefreshCw,
  Building2
} from 'lucide-react';

// Import our services
import { CustomerDocumentProcessor, CustomerProcessingResult } from '@/services/ingrid/CustomerDocumentProcessor';
import AddEditCustomerDialog, { CustomerFormValues } from '@/components/AddEditCustomerDialog';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import SmartDocumentWarnings, { DocumentAnalysisResult } from '@/components/SmartDocumentWarnings';

interface AIEnhancedCustomerCreationProps {
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
  result?: CustomerProcessingResult;
}

const AIEnhancedCustomerCreation: React.FC<AIEnhancedCustomerCreationProps> = ({
  isOpen,
  onOpenChange,
  onSuccess,
  companyId
}) => {
  const { toast } = useToast();
  const { profile } = useSession();

  const [processingState, setProcessingState] = useState<ProcessingProgress>({
    stage: 'upload',
    progress: 0,
    message: 'Ready to process customer documents'
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [extractedData, setExtractedData] = useState<Partial<CustomerFormValues> | null>(null);
  const [bypassAI, setBypassAI] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Document intelligence state
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  // Initialize the document processor
  const documentProcessor = new CustomerDocumentProcessor();

  // Initialize document upload hook with intelligence
  const {
    uploadDocument,
    analyzeDocumentFull,
    uploadCustomerDocument,
    isUploading: isDocumentUploading,
    isAnalyzing: isDocumentAnalyzing
  } = useDocumentUpload();

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

    // Start processing with intelligence
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
    disabled: processingState.stage === 'processing' || isDocumentUploading || isDocumentAnalyzing
  });

  /**
   * Process document with intelligence analysis first
   */
  const processDocumentWithIntelligence = async (file: File) => {
    try {
      setProcessingState({
        stage: 'processing',
        progress: 5,
        message: 'Starting document intelligence analysis...'
      });

      // First run our document intelligence analysis
      const analysis = await analyzeDocumentFull(file, 'customer_document', {
        enableDuplicateDetection: true,
        enableRelevanceAnalysis: true,
        enableContentAnalysis: true,
        duplicateScope: 'company',
        temporalToleranceDays: 30,
        strictRelevance: false
      });

      if (analysis) {
        setCurrentAnalysis(analysis);
        setCurrentFile(file);

        // Check if we should show warnings
        if (analysis.recommendedAction === 'warn' || analysis.recommendedAction === 'reject') {
          setProcessingState({
            stage: 'upload',
            progress: 0,
            message: 'Document analysis complete - review required'
          });
          setShowWarnings(true);
          return;
        }
      }

      // Analysis passed or no analysis available, proceed with processing
      await processDocument(file, analysis);
    } catch (error) {
      console.error('Document intelligence analysis failed:', error);
      toast({
        title: 'Analysis Warning',
        description: 'Document intelligence unavailable, proceeding with standard processing',
        variant: 'default'
      });
      // Fallback to regular processing
      await processDocument(file, null);
    }
  };

  /**
   * Process the uploaded document with AI (enhanced with intelligence data)
   */
  const processDocument = async (file: File, intelligenceAnalysis?: DocumentAnalysisResult | null) => {
    try {
      setProcessingState({
        stage: 'processing',
        progress: 10,
        message: 'Starting document analysis...'
      });

      // Step 1: Upload and OCR
      setProcessingState({
        stage: 'processing',
        progress: 25,
        message: 'Extracting text with AI...'
      });

      // Step 2: Process with our customer document processor
      const userContext = {
        userId: profile!.user_id,
        companyId: profile!.company_id,
        role: profile!.role
      };

      setProcessingState({
        stage: 'processing',
        progress: 50,
        message: 'Analyzing customer information...'
      });

      const result = await documentProcessor.processCustomerDocument(file, userContext);

      // Step 3: Web enrichment
      setProcessingState({
        stage: 'processing',
        progress: 75,
        message: 'Enriching customer data from web sources...'
      });

      // Step 4: Upload to document management system with intelligence data
      setProcessingState({
        stage: 'processing',
        progress: 90,
        message: 'Saving document with smart naming...'
      });

      // Prepare upload data combining AI extraction and intelligence analysis
      const uploadData = {
        ...(result.aiData || {}),
        ...(intelligenceAnalysis?.contentAnalysis ? {
          extractedText: intelligenceAnalysis.contentAnalysis.extractedText,
          businessEntities: intelligenceAnalysis.contentAnalysis.businessEntities,
          confidence: intelligenceAnalysis.contentAnalysis.confidence
        } : {})
      };

      // Upload document with combined AI data for smart naming
      const uploadedDoc = await uploadCustomerDocument(file, uploadData, undefined);

      if (uploadedDoc) {
        setDocumentId(uploadedDoc.id);
        console.log(`Customer document uploaded with smart name: ${uploadedDoc.smartFileName}`);
      }

      // Step 5: Complete
      setProcessingState({
        stage: 'review',
        progress: 100,
        message: 'Analysis complete! Review the extracted information.',
        result
      });

      setExtractedData(result.prefillData);

      toast({
        title: 'Document Processed Successfully',
        description: `Extracted customer information with ${result.confidence}% confidence`,
      });

    } catch (error) {
      console.error('Document processing error:', error);

      // If we have intelligence data, try to fallback to it
      if (intelligenceAnalysis?.contentAnalysis) {
        setProcessingState({
          stage: 'review',
          progress: 100,
          message: 'Legacy processor failed, using intelligence data',
          result: {
            success: true,
            confidence: intelligenceAnalysis.contentAnalysis.confidence || 50,
            message: 'Extracted data using document intelligence',
            prefillData: extractCustomerDataFromIntelligence(intelligenceAnalysis),
            aiData: intelligenceAnalysis.contentAnalysis.businessEntities,
            analysis: {
              extractedFields: Object.keys(intelligenceAnalysis.contentAnalysis.businessEntities || {}),
              suggestions: intelligenceAnalysis.warnings.map(w => w.message)
            }
          } as CustomerProcessingResult
        });

        setExtractedData(extractCustomerDataFromIntelligence(intelligenceAnalysis));

        toast({
          title: 'Processing Complete',
          description: 'Document processed using intelligent analysis',
        });
        return;
      }

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
   * Extract customer data from intelligence analysis
   */
  const extractCustomerDataFromIntelligence = (analysis: DocumentAnalysisResult): Partial<CustomerFormValues> => {
    const entities = analysis.contentAnalysis?.businessEntities;
    if (!entities) return {};

    const extractedData: Partial<CustomerFormValues> = {};

    // Extract company names from vendors array (customer documents may have company info)
    if (entities.vendors && entities.vendors.length > 0) {
      extractedData.name = entities.vendors[0].name;
    }

    // Extract contact information
    if (entities.emails && entities.emails.length > 0) {
      extractedData.email = entities.emails[0].value;
    }

    if (entities.phones && entities.phones.length > 0) {
      extractedData.phone = entities.phones[0].value;
    }

    // Extract address information
    if (entities.addresses && entities.addresses.length > 0) {
      const address = entities.addresses[0];
      extractedData.address_line_1 = address.streetAddress;
      extractedData.city = address.city;
      extractedData.state = address.state;
      extractedData.postal_code = address.postalCode;
      extractedData.country = address.country;
    }

    return extractedData;
  };

  /**
   * Reset the component to initial state
   */
  const resetState = () => {
    setProcessingState({
      stage: 'upload',
      progress: 0,
      message: 'Ready to process customer documents'
    });
    setUploadedFile(null);
    setExtractedData(null);
    setDocumentId(null);
    setShowCustomerForm(false);
    setBypassAI(false);
    setCurrentFile(null);
    setCurrentAnalysis(null);
    setShowWarnings(false);
  };

  /**
   * Handle proceeding despite warnings
   */
  const handleProceedAnyway = async () => {
    if (!currentFile) return;

    setShowWarnings(false);
    await processDocument(currentFile, currentAnalysis);
  };

  /**
   * Handle canceling upload due to warnings
   */
  const handleCancelUpload = () => {
    resetState();
    toast({ title: "Upload Canceled", description: "The document upload was canceled." });
  };

  /**
   * Handle retrying analysis
   */
  const handleRetryAnalysis = async () => {
    if (!currentFile) return;
    setShowWarnings(false);
    await processDocumentWithIntelligence(currentFile);
  };

  /**
   * Handle viewing duplicate documents
   */
  const handleViewDuplicate = (duplicateId: string) => {
    window.open(`/customers/${duplicateId}`, '_blank');
  };

  /**
   * Handle manual customer creation (bypassing AI)
   */
  const handleManualCreation = () => {
    setBypassAI(true);
    setExtractedData(null);
    setShowCustomerForm(true);
  };

  /**
   * Handle successful customer creation
   */
  const handleCustomerCreated = () => {
    setShowCustomerForm(false);
    resetState();
    onSuccess();
    onOpenChange(false);

    toast({
      title: 'Customer Created Successfully',
      description: 'The customer has been added to your database',
    });
  };

  /**
   * Get appropriate icon for document type
   */
  const getDocumentIcon = (file: File) => {
    const type = file.type.toLowerCase();
    if (type.includes('image')) return <Image className="h-8 w-8" />;
    if (type.includes('pdf')) return <FileText className="h-8 w-8" />;
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
          {isDragActive ? 'Drop your document here' : 'Upload Customer Document'}
        </h3>
        <p className="text-gray-500 mb-4">
          Drag & drop or click to upload business cards, brochures, or contact forms
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
            <Building2 className="h-3 w-3 mr-1" />
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
          Prefer to enter customer details manually?
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
              Automatically extract company name, contact info, and address details
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
            <CardTitle className="text-sm">Extracted Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extractedData?.name && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Company Name:</span>
                <span className="text-sm">{extractedData.name}</span>
              </div>
            )}
            {extractedData?.contact_person && (
              <div className="flex justify-between">
                <span className="text-sm font-medium">Contact Person:</span>
                <span className="text-sm">{extractedData.contact_person}</span>
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
            onClick={() => setShowCustomerForm(true)}
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Create Customer
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
      <Dialog open={isOpen && !showCustomerForm} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              AI-Enhanced Customer Creation
            </DialogTitle>
            <DialogDescription>
              Upload a customer document and let AI extract the details automatically
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {processingState.stage === 'upload' && renderUploadStage()}
            {processingState.stage === 'processing' && renderProcessingStage()}
            {processingState.stage === 'review' && renderReviewStage()}

            {/* Smart Document Warnings */}
            {showWarnings && currentAnalysis && (
              <SmartDocumentWarnings
                analysis={currentAnalysis}
                isLoading={false}
                context="customer_document"
                fileName={currentFile?.name}
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

      {/* Customer Creation Form */}
      {showCustomerForm && (
        <AddEditCustomerDialog
          isOpen={showCustomerForm}
          onOpenChange={(open) => {
            setShowCustomerForm(open);
            if (!open) {
              // If form is closed without saving, go back to review
              setShowCustomerForm(false);
            }
          }}
          companyId={companyId}
          initialMode="add"
          prefillData={extractedData}
          editingCustomer={null}
          onSuccess={handleCustomerCreated}
        />
      )}
    </>
  );
};

export default AIEnhancedCustomerCreation;