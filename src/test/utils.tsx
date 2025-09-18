import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionContextProvider } from '@/components/SessionContextProvider';

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SessionContextProvider>
            {children}
          </SessionContextProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockProfile = (overrides = {}) => ({
  id: 'profile-1',
  user_id: 'user-1',
  company_id: 'company-1',
  email: 'test@example.com',
  full_name: 'Test User',
  first_name: 'Test',
  last_name: 'User',
  role: 'user',
  avatar_url: null,
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockExpense = (overrides = {}) => ({
  id: 'expense-1',
  amount: 100.00,
  currency: 'USD',
  description: 'Test expense',
  date: new Date().toISOString(),
  category_id: 'category-1',
  status: 'draft',
  user_id: 'user-1',
  company_id: 'company-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Mock session context value
export const createMockSession = (overrides = {}) => ({
  session: {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: createMockUser(),
  },
  user: createMockUser(),
  profile: createMockProfile(),
  impersonatedProfile: null,
  setImpersonatedProfile: () => {},
  isLoading: false,
  ...overrides,
});