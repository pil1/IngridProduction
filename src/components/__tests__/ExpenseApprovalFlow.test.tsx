import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SessionContextProvider } from '../SessionContextProvider';
import ExpenseReviewPage from '../../pages/ExpenseReviewPage';

// Mock Supabase operations for expense approval
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  eq: vi.fn(() => ({
    update: mockUpdate,
    select: mockSelect
  }))
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'admin-user-id' } },
        error: null
      }))
    }
  }
}));

// Mock toast notifications
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast
  })
}));

// Mock admin user session
const mockAdminProfile = {
  id: 'admin-user-id',
  email: 'admin@example.com',
  full_name: 'Admin User',
  role: 'admin' as const,
  company_id: 'test-company-id',
  is_active: true
};

const TestProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionContextProvider
          value={{
            profile: mockAdminProfile,
            isLoading: false,
            session: { user: { id: 'admin-user-id', email: 'admin@example.com' } } as any
          }}
        >
          {children}
        </SessionContextProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock expense data for testing
const mockPendingExpenses = [
  {
    id: 'expense-1',
    amount: 125.50,
    description: 'Business lunch with client',
    status: 'pending',
    expense_date: '2024-01-15',
    submitted_by: 'employee-user-id',
    submitter_full_name: 'John Employee',
    submitter_email: 'john@example.com',
    category_name: 'Meals & Entertainment',
    receipt_url: 'https://example.com/receipt1.pdf',
    company_id: 'test-company-id'
  },
  {
    id: 'expense-2',
    amount: 75.00,
    description: 'Office supplies',
    status: 'pending',
    expense_date: '2024-01-14',
    submitted_by: 'employee-user-id-2',
    submitter_full_name: 'Jane Employee',
    submitter_email: 'jane@example.com',
    category_name: 'Office Supplies',
    receipt_url: null,
    company_id: 'test-company-id'
  }
];

describe('Expense Approval Flow - Critical Business Logic', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Setup default mock responses
    mockSelect.mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: mockPendingExpenses,
            error: null
          }))
        }))
      }))
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn(() => Promise.resolve({
        data: null,
        error: null
      }))
    });
  });

  it('should display pending expenses for admin review', async () => {
    render(
      <TestProviders>
        <ExpenseReviewPage />
      </TestProviders>
    );

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Business lunch with client')).toBeInTheDocument();
      expect(screen.getByText('Office supplies')).toBeInTheDocument();
    });

    // Verify expense details are displayed
    expect(screen.getByText('$125.50')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    expect(screen.getByText('John Employee')).toBeInTheDocument();
    expect(screen.getByText('Jane Employee')).toBeInTheDocument();
  });

  it('should handle expense approval workflow', async () => {
    render(
      <TestProviders>
        <ExpenseReviewPage />
      </TestProviders>
    );

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Business lunch with client')).toBeInTheDocument();
    });

    // Find and click approve button for first expense
    const approveButtons = screen.getAllByText('Approve');
    await user.click(approveButtons[0]);

    // Should update expense status to approved
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'approved',
        approved_by: 'admin-user-id',
        approved_at: expect.any(String)
      });
    });

    // Should show success toast
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Expense Approved',
      description: 'The expense has been successfully approved.',
    });
  });

  it('should handle expense rejection workflow', async () => {
    render(
      <TestProviders>
        <ExpenseReviewPage />
      </TestProviders>
    );

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Office supplies')).toBeInTheDocument();
    });

    // Find and click reject button for second expense
    const rejectButtons = screen.getAllByText('Reject');
    await user.click(rejectButtons[0]);

    // Should open rejection reason dialog
    await waitFor(() => {
      expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
    });

    // Enter rejection reason
    const reasonInput = screen.getByLabelText(/reason for rejection/i);
    await user.type(reasonInput, 'Missing receipt required for office supplies');

    // Confirm rejection
    const confirmButton = screen.getByRole('button', { name: /confirm rejection/i });
    await user.click(confirmButton);

    // Should update expense status to rejected
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'rejected',
        approved_by: 'admin-user-id',
        approved_at: expect.any(String),
        rejection_reason: 'Missing receipt required for office supplies'
      });
    });

    // Should show rejection toast
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Expense Rejected',
      description: 'The expense has been rejected.',
      variant: 'destructive'
    });
  });

  it('should handle bulk expense approval', async () => {
    render(
      <TestProviders>
        <ExpenseReviewPage />
      </TestProviders>
    );

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Business lunch with client')).toBeInTheDocument();
    });

    // Select multiple expenses using checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // Select first expense
    await user.click(checkboxes[1]); // Select second expense

    // Click bulk approve button
    const bulkApproveButton = screen.getByRole('button', { name: /approve selected/i });
    await user.click(bulkApproveButton);

    // Should update both expenses
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    // Should show bulk success toast
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Expenses Approved',
      description: '2 expenses have been successfully approved.',
    });
  });

  it('should filter expenses by status', async () => {
    render(
      <TestProviders>
        <ExpenseReviewPage />
      </TestProviders>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Business lunch with client')).toBeInTheDocument();
    });

    // Click status filter
    const statusFilter = screen.getByRole('combobox', { name: /filter by status/i });
    await user.click(statusFilter);

    // Select "pending" status
    await user.click(screen.getByText('Pending'));

    // Should filter API call with status
    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('*'),
      );
    });
  });

  it('should handle expense detail view', async () => {
    render(
      <TestProviders>
        <ExpenseReviewPage />
      </TestProviders>
    );

    // Wait for expenses to load
    await waitFor(() => {
      expect(screen.getByText('Business lunch with client')).toBeInTheDocument();
    });

    // Click on expense to view details
    const expenseRow = screen.getByText('Business lunch with client');
    await user.click(expenseRow);

    // Should show expense detail dialog/modal
    await waitFor(() => {
      expect(screen.getByText('Expense Details')).toBeInTheDocument();
      expect(screen.getByText('$125.50')).toBeInTheDocument();
      expect(screen.getByText('Meals & Entertainment')).toBeInTheDocument();
    });
  });

  it('should validate admin permissions', async () => {
    // Test with non-admin user
    const nonAdminProfile = {
      ...mockAdminProfile,
      role: 'user' as const
    };

    render(
      <QueryClientProvider client={new QueryClient()}>
        <BrowserRouter>
          <SessionContextProvider
            value={{
              profile: nonAdminProfile,
              isLoading: false,
              session: { user: { id: 'user-id' } } as any
            }}
          >
            <ExpenseReviewPage />
          </SessionContextProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Should show access denied or redirect
    await waitFor(() => {
      expect(screen.getByText(/access denied|unauthorized/i)).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    mockSelect.mockReturnValue({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Database connection failed' }
          }))
        }))
      }))
    });

    render(
      <TestProviders>
        <ExpenseReviewPage />
      </TestProviders>
    );

    // Should show error message
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error Loading Expenses',
        description: expect.stringContaining('Database connection failed'),
        variant: 'destructive'
      });
    });
  });
});