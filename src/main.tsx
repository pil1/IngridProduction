import { createRoot } from "react-dom/client";
import { router, queryClient } from "./exports";
import { Toaster, Sonner, TooltipProvider } from "./App.tsx";
import "./globals.css";
import React from "react";
import { RouterProvider } from "react-router-dom";
import { SessionContextProvider } from "./components/SessionContextProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationProvider } from "./contexts/NotificationContext";
import { NotificationErrorBoundary } from "./components/NotificationErrorBoundary";
import { PermissionProvider } from "./contexts/PermissionProvider";
import { logger } from "./utils/errorLogger";
import { SimpleDebugPanel } from "./components/debug/SimpleDebugPanel";

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // In production, you would send this to an error reporting service
});

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  // In production, you would send this to an error reporting service
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary onError={(error, errorInfo) => {
      console.error('Root ErrorBoundary caught error:', error, errorInfo);
      // In production, send to error reporting service (e.g., Sentry)
    }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ErrorBoundary
            fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
                <p className="text-gray-600 mb-4">Please refresh the page to try again.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Refresh Page
                </button>
              </div>
            </div>}
            onError={(error, errorInfo) => {
              console.error('Session ErrorBoundary caught error:', error, errorInfo);
            }}
          >
            <SessionContextProvider>
              <ErrorBoundary
                fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Permission Error</h2>
                    <p className="text-gray-600 mb-4">There was an issue with permissions. Please try logging in again.</p>
                    <button
                      onClick={() => window.location.href = '/auth'}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Go to Login
                    </button>
                  </div>
                </div>}
                onError={(error, errorInfo) => {
                  console.error('Permission ErrorBoundary caught error:', error, errorInfo);
                }}
              >
                <PermissionProvider>
                  <ErrorBoundary
                    fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                      <div className="text-center">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Application Error</h2>
                        <p className="text-gray-600 mb-4">An unexpected error occurred.</p>
                        <button
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Refresh Page
                        </button>
                      </div>
                    </div>}
                    onError={(error, errorInfo) => {
                      console.error('App ErrorBoundary caught error:', error, errorInfo);
                    }}
                  >
                    <NotificationErrorBoundary>
                      <NotificationProvider>
                        <RouterProvider router={router} />
                        <SimpleDebugPanel />
                      </NotificationProvider>
                    </NotificationErrorBoundary>
                  </ErrorBoundary>
                </PermissionProvider>
              </ErrorBoundary>
            </SessionContextProvider>
          </ErrorBoundary>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);