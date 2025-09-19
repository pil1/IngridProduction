// Separate file for non-component exports to fix react-refresh warnings
import { createBrowserRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { routes } from './App';

// Query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error: Error) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

// Router configuration
export const router = createBrowserRouter(routes, {
  future: undefined, // Explicitly set to undefined to silence warnings
});