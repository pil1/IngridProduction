// Test data factories - separated to avoid react-refresh warnings

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