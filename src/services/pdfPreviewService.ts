/**
 * PDF Preview Service
 *
 * Handles PDF to JPG conversion for preview purposes while maintaining
 * the original PDF for processing and downloads.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker - use a more compatible approach
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

export interface PreviewResult {
  originalFile: File;
  previewUrl: string;
  previewBlob: Blob;
  pageCount: number;
}

export class PDFPreviewService {
  /**
   * Convert PDF first page to JPG for preview
   */
  static async generatePreview(file: File): Promise<PreviewResult> {
    try {
      console.log('📄 Starting PDF preview generation for:', file.name);

      // Read the PDF file
      const arrayBuffer = await file.arrayBuffer();
      console.log('📄 PDF file read, size:', arrayBuffer.byteLength, 'bytes');

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log('📄 PDF loaded, pages:', pdf.numPages);

      // Get the first page
      const page = await pdf.getPage(1);
      console.log('📄 First page loaded');

      // Set up canvas for rendering
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      console.log('📄 Viewport created, dimensions:', viewport.width, 'x', viewport.height);

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      console.log('📄 Canvas created');

      // Render the page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      console.log('📄 Starting page render...');
      await page.render(renderContext).promise;
      console.log('📄 Page rendered successfully');

      // Convert canvas to blob
      console.log('📄 Converting canvas to blob...');
      const previewBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('📄 Blob created successfully, size:', blob.size, 'bytes');
            resolve(blob);
          } else {
            console.error('📄 Failed to create blob from canvas');
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 0.85);
      });

      // Create preview URL
      const previewUrl = URL.createObjectURL(previewBlob);
      console.log('📄 Preview URL created:', previewUrl);

      const result = {
        originalFile: file,
        previewUrl,
        previewBlob,
        pageCount: pdf.numPages
      };

      console.log('📄 PDF preview generation completed successfully');
      return result;

    } catch (error) {
      console.error('PDF preview generation failed:', error);
      throw new Error('Failed to generate PDF preview');
    }
  }

  /**
   * Check if file is a PDF
   */
  static isPDF(file: File): boolean {
    return file.type === 'application/pdf';
  }

  /**
   * Check if file is an image
   */
  static isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * Clean up preview URL to prevent memory leaks
   */
  static cleanupPreview(previewUrl: string): void {
    URL.revokeObjectURL(previewUrl);
  }
}