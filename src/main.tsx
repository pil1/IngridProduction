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
          <SessionContextProvider>
            <ErrorBoundary onError={(error, errorInfo) => {
              console.error('App ErrorBoundary caught error:', error, errorInfo);
            }}>
              <NotificationErrorBoundary>
                <NotificationProvider>
                  <RouterProvider router={router} />
                </NotificationProvider>
              </NotificationErrorBoundary>
            </ErrorBoundary>
          </SessionContextProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);