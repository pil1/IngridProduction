"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

// Set the worker source for pdfjs-dist
// This path should point to the pdf.worker.min.js file in your public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PdfViewerProps {
  pdfUrl: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ pdfUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const renderPdf = async () => {
      if (!pdfUrl || !canvasRef.current) {
        console.log("PdfViewer: Missing pdfUrl or canvasRef.current. Skipping render.");
        setError("No PDF URL provided or canvas not ready.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      console.log(`PdfViewer: Attempting to render PDF from URL: ${pdfUrl} (Page: ${currentPage})`);

      try {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);

        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 }); // Adjust scale as needed

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error("Could not get 2D context for canvas.");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        await page.render(renderContext).promise;
        setLoading(false);
        console.log(`PdfViewer: Successfully rendered page ${currentPage} of ${numPages}.`);
      } catch (err: unknown) {
        console.error("PdfViewer: Error rendering PDF:", err);
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}. Check console for details.`);
        setLoading(false);
      }
    };

    renderPdf();
  }, [pdfUrl, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-full">
      {loading && (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="mt-2">Loading PDF...</p>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center h-full text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p className="mt-2">{error}</p>
        </div>
      )}
      {!loading && !error && (
        <>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Button onClick={handlePrevPage} disabled={currentPage <= 1} variant="outline" size="sm">
              Prev
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {numPages}
            </span>
            <Button onClick={handleNextPage} disabled={currentPage >= numPages} variant="outline" size="sm">
              Next
            </Button>
          </div>
          <div className="overflow-auto flex-1 flex items-center justify-center w-full">
            <canvas ref={canvasRef} className="max-w-full h-auto border rounded-md shadow-sm" />
          </div>
        </>
      )}
    </div>
  );
};

export default PdfViewer;