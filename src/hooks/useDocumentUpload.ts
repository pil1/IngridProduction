/**
 * Document Upload Hook
 *
 * React hook for uploading documents with smart naming, progress tracking,
 * and automatic association with entities (expenses, vendors, etc.).
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { DocumentAnalysisResult } from '@/components/SmartDocumentWarnings';

export interface DocumentUploadOptions {
  documentCategory?: 'expense' | 'invoice' | 'receipt' | 'contract' | 'report' |
                     'business_card' | 'email' | 'statement' | 'purchase_order' | 'quote' | 'other';
  associatedEntity?: {
    type: string;
    id: string;
    associationType?: string;
  };
  aiExtractedData?: Record<string, any>;
  storageType?: 'database' | 'filesystem' | 's3';
  onSuccess?: (document: UploadedDocument) => void;
  onError?: (error: Error) => void;
}

export interface UploadedDocument {
  id: string;
  companyId: string;
  uploadedBy: string;
  originalFileName: string;
  smartFileName: string;
  displayName: string;
  fileType: string;
  fileSize: number;
  fileExtension: string;
  storageType: string;
  documentCategory: string;
  namingConfidence: number;
  aiExtractedData: Record<string, any>;
  namingMetadata: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface DocumentUploadState {
  isUploading: boolean;
  uploadProgress: UploadProgress | null;
  uploadedDocument: UploadedDocument | null;
  error: string | null;
  // AI Analysis state
  isAnalyzing: boolean;
  analysisResult: DocumentAnalysisResult | null;
  analysisError: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function useDocumentUpload() {
  const [uploadState, setUploadState] = useState<DocumentUploadState>({
    isUploading: false,
    uploadProgress: null,
    uploadedDocument: null,
    error: null,
    isAnalyzing: false,
    analysisResult: null,
    analysisError: null
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Reset upload state
   */
  const resetUpload = useCallback(() => {
    setUploadState({
      isUploading: false,
      uploadProgress: null,
      uploadedDocument: null,
      error: null,
      isAnalyzing: false,
      analysisResult: null,
      analysisError: null
    });
  }, []);

  /**
   * Pre-upload analysis to detect duplicates and relevance issues
   */
  const analyzeDocument = useCallback(async (
    file: File,
    context: string = 'generic_business'
  ): Promise<DocumentAnalysisResult | null> => {
    try {
      setUploadState(prev => ({
        ...prev,
        isAnalyzing: true,
        analysisError: null,
        analysisResult: null
      }));

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const formData = new FormData();
      formData.append('document', file);
      formData.append('context', context);

      const response = await fetch(`${BACKEND_URL}/api/documents/analyze/pre-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Transform the response to match our DocumentAnalysisResult interface
      const analysisResult: DocumentAnalysisResult = {
        overallScore: data.data.analysis.canUpload ? 0.8 : 0.3,
        recommendedAction: data.data.analysis.canUpload ?
          (data.data.analysis.warnings.length > 0 ? 'warn' : 'accept') : 'reject',
        warnings: data.data.analysis.warnings.map((warning: string, index: number) => ({
          type: index === 0 ? 'duplicate' : 'relevance',
          severity: 'warning' as const,
          message: warning,
          actionable: true
        })),
        suggestions: data.data.analysis.suggestions || []
      };

      setUploadState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysisResult
      }));

      return analysisResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

      setUploadState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysisError: errorMessage
      }));

      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    }
  }, [toast]);

  /**
   * Comprehensive document analysis with full intelligence features
   */
  const analyzeDocumentFull = useCallback(async (
    file: File,
    context: string = 'generic_business',
    options: {
      enableDuplicateDetection?: boolean;
      enableRelevanceAnalysis?: boolean;
      enableContentAnalysis?: boolean;
      duplicateScope?: 'company' | 'user';
      temporalToleranceDays?: number;
      strictRelevance?: boolean;
    } = {}
  ): Promise<DocumentAnalysisResult | null> => {
    try {
      setUploadState(prev => ({
        ...prev,
        isAnalyzing: true,
        analysisError: null,
        analysisResult: null
      }));

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const formData = new FormData();
      formData.append('document', file);
      formData.append('context', context);

      // Add analysis options
      if (options.enableDuplicateDetection !== undefined) {
        formData.append('enableDuplicateDetection', String(options.enableDuplicateDetection));
      }
      if (options.enableRelevanceAnalysis !== undefined) {
        formData.append('enableRelevanceAnalysis', String(options.enableRelevanceAnalysis));
      }
      if (options.enableContentAnalysis !== undefined) {
        formData.append('enableContentAnalysis', String(options.enableContentAnalysis));
      }
      if (options.duplicateScope) {
        formData.append('duplicateScope', options.duplicateScope);
      }
      if (options.temporalToleranceDays) {
        formData.append('temporalToleranceDays', String(options.temporalToleranceDays));
      }
      if (options.strictRelevance !== undefined) {
        formData.append('strictRelevance', String(options.strictRelevance));
      }

      const response = await fetch(`${BACKEND_URL}/api/documents/analyze/full`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      const analysis = data.data.analysis;

      // Transform to our interface format
      const analysisResult: DocumentAnalysisResult = {
        overallScore: analysis.overallScore,
        recommendedAction: analysis.recommendedAction,
        warnings: analysis.warnings,
        suggestions: analysis.suggestions,
        contentAnalysis: analysis.contentAnalysis,
        duplicateAnalysis: analysis.duplicateAnalysis,
        relevanceAnalysis: analysis.relevanceAnalysis
      };

      setUploadState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysisResult
      }));

      return analysisResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Comprehensive analysis failed';

      setUploadState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysisError: errorMessage
      }));

      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    }
  }, [toast]);


  /**
   * Upload document with progress tracking
   */
  const uploadDocument = useMutation({
    mutationFn: async ({
      file,
      options
    }: {
      file: File;
      options?: DocumentUploadOptions;
    }) => {
      setUploadState(prev => ({
        ...prev,
        isUploading: true,
        uploadProgress: { loaded: 0, total: file.size, percentage: 0 },
        error: null
      }));

      const formData = new FormData();
      formData.append('document', file);

      if (options?.documentCategory) {
        formData.append('documentCategory', options.documentCategory);
      }

      if (options?.associatedEntity) {
        formData.append('associatedEntityType', options.associatedEntity.type);
        formData.append('associatedEntityId', options.associatedEntity.id);
        if (options.associatedEntity.associationType) {
          formData.append('associationType', options.associatedEntity.associationType);
        }
      }

      if (options?.aiExtractedData) {
        formData.append('aiExtractedData', JSON.stringify(options.aiExtractedData));
      }

      if (options?.storageType) {
        formData.append('storageType', options.storageType);
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Use XMLHttpRequest for progress tracking
      return new Promise<UploadedDocument>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setUploadState(prev => ({
              ...prev,
              uploadProgress: {
                loaded: event.loaded,
                total: event.total,
                percentage
              }
            }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.success) {
                const document = response.data.document;
                setUploadState(prev => ({
                  ...prev,
                  isUploading: false,
                  uploadedDocument: document,
                  uploadProgress: { loaded: file.size, total: file.size, percentage: 100 }
                }));

                // Call success callback
                if (options?.onSuccess) {
                  options.onSuccess(document);
                }

                // Show success toast
                toast({
                  title: "Document Uploaded",
                  description: `File uploaded as "${document.smartFileName}"`,
                  variant: "default"
                });

                resolve(document);
              } else {
                throw new Error(response.error || 'Upload failed');
              }
            } catch (error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.error || `HTTP ${xhr.status}`));
            } catch {
              reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred during upload'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload timeout'));
        });

        xhr.open('POST', `${BACKEND_URL}/api/documents/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 300000; // 5 minutes
        xhr.send(formData);
      });
    },
    onError: (error: Error, { options }) => {
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        error: error.message,
        uploadProgress: null
      }));

      // Call error callback
      if (options?.onError) {
        options.onError(error);
      }

      // Show error toast
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    },
    onSuccess: () => {
      // Invalidate documents query to refresh lists
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    }
  });

  /**
   * Smart upload with pre-upload analysis
   */
  const uploadWithAnalysis = useCallback(async (
    file: File,
    context: string = 'generic_business',
    options?: DocumentUploadOptions
  ): Promise<{
    document: UploadedDocument | null;
    analysis: DocumentAnalysisResult | null;
    userProceedOverride?: boolean;
  }> => {
    // First, analyze the document
    const analysis = await analyzeDocument(file, context);

    if (!analysis) {
      return { document: null, analysis: null };
    }

    // If analysis recommends rejection, don't upload automatically
    if (analysis.recommendedAction === 'reject') {
      return { document: null, analysis, userProceedOverride: false };
    }

    // If analysis has warnings, let the user decide
    if (analysis.recommendedAction === 'warn') {
      return { document: null, analysis, userProceedOverride: false };
    }

    // If analysis looks good, proceed with upload
    try {
      const document = await uploadDocument.mutateAsync({ file, options });
      return { document, analysis };
    } catch (error) {
      console.error('Upload after analysis failed:', error);
      return { document: null, analysis };
    }
  }, [analyzeDocument, uploadDocument]);

  /**
   * Force upload despite analysis warnings (user override)
   */
  const forceUpload = useCallback(async (
    file: File,
    options?: DocumentUploadOptions
  ): Promise<UploadedDocument | null> => {
    try {
      return await uploadDocument.mutateAsync({ file, options });
    } catch (error) {
      console.error('Force upload failed:', error);
      return null;
    }
  }, [uploadDocument]);

  /**
   * Quick upload with smart naming
   */
  const uploadWithSmartNaming = useCallback(async (
    file: File,
    aiData?: Record<string, any>,
    entityAssociation?: { type: string; id: string; associationType?: string }
  ): Promise<UploadedDocument | null> => {
    try {
      const result = await uploadDocument.mutateAsync({
        file,
        options: {
          aiExtractedData: aiData,
          associatedEntity: entityAssociation
        }
      });
      return result;
    } catch (error) {
      console.error('Smart naming upload failed:', error);
      return null;
    }
  }, [uploadDocument]);

  /**
   * Upload expense receipt with smart naming
   */
  const uploadExpenseReceipt = useCallback(async (
    file: File,
    expenseData?: Record<string, any>,
    expenseId?: string
  ): Promise<UploadedDocument | null> => {
    return uploadWithSmartNaming(
      file,
      expenseData,
      expenseId ? { type: 'expense', id: expenseId, associationType: 'receipt' } : undefined
    );
  }, [uploadWithSmartNaming]);

  /**
   * Upload vendor document (invoice, etc.)
   */
  const uploadVendorDocument = useCallback(async (
    file: File,
    vendorData?: Record<string, any>,
    vendorId?: string,
    documentType: 'invoice' | 'contract' | 'other' = 'other'
  ): Promise<UploadedDocument | null> => {
    return uploadWithSmartNaming(
      file,
      vendorData,
      vendorId ? { type: 'vendor', id: vendorId, associationType: documentType } : undefined
    );
  }, [uploadWithSmartNaming]);

  /**
   * Download document by ID
   */
  const downloadDocument = useCallback(async (documentId: string): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${BACKEND_URL}/api/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'document';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: `Downloaded ${filename}`,
        variant: "default"
      });

    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  }, [toast]);

  /**
   * Get document info by ID
   */
  const getDocument = useCallback(async (documentId: string): Promise<UploadedDocument | null> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${BACKEND_URL}/api/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get document: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success ? data.data.document : null;

    } catch (error) {
      console.error('Get document failed:', error);
      return null;
    }
  }, []);

  return {
    // State
    ...uploadState,

    // Actions
    uploadDocument: uploadDocument.mutate,
    uploadDocumentAsync: uploadDocument.mutateAsync,
    uploadWithSmartNaming,
    uploadExpenseReceipt,
    uploadVendorDocument,
    downloadDocument,
    getDocument,
    resetUpload,

    // New AI Analysis Actions
    analyzeDocument,
    analyzeDocumentFull,
    uploadWithAnalysis,
    forceUpload,

    // Status
    isUploading: uploadDocument.isPending || uploadState.isUploading,
    isSuccess: uploadDocument.isSuccess && uploadState.uploadedDocument !== null,
    isError: uploadDocument.isError || uploadState.error !== null,
  };
}

/**
 * Hook for listing documents with filtering and pagination
 */
export function useDocuments(options: {
  uploadedBy?: string;
  documentCategory?: string;
  associatedEntityType?: string;
  associatedEntityId?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const queryClient = useQueryClient();

  return {
    // Future: Add document listing functionality
    // For now, this is a placeholder for the document list feature
    documents: [],
    total: 0,
    isLoading: false,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['documents'] })
  };
}

export default useDocumentUpload;