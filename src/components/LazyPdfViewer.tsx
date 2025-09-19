import React, { lazy, Suspense } from 'react';
import PageLoader from './PageLoader';

// Lazy load the heavy PDF viewer component
const PdfViewer = lazy(() => import('./PdfViewer'));

interface LazyPdfViewerProps {
  pdfUrl: string;
}

export const LazyPdfViewer: React.FC<LazyPdfViewerProps> = ({ pdfUrl }) => {
  return (
    <Suspense fallback={<PageLoader text="Loading PDF viewer..." />}>
      <PdfViewer pdfUrl={pdfUrl} />
    </Suspense>
  );
};

export default LazyPdfViewer;