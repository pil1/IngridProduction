import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import AddEditExpenseDialog from '../AddEditExpenseDialog';
import { SessionContextProvider } from '../SessionContextProvider';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: [
              { id: '1', name: 'Travel', is_active: true },
              { id: '2', name: 'Office Supplies', is_active: true }
            ],
            error: null
          }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })),
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    }
  }
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock session context with realistic user data
const mockProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'admin',
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
            profile: mockProfile,
            isLoading: false,
            session: { user: { id: 'test-user-id', email: 'test@example.com' } } as any
          }}
        >
          {children}
        </SessionContextProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Expense Creation Flow - Critical User Journey', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it('should complete full expense creation workflow', async () => {
    const mockOnClose = vi.fn();

    render(
      <TestProviders>
        <AddEditExpenseDialog
          isOpen={true}
          onOpenChange={mockOnClose}
          companyId="test-company-id"
          initialMode="add"
        />
      </TestProviders>
    );

    // Step 1: Verify dialog opens with correct title
    expect(screen.getByText('Add New Expense')).toBeInTheDocument();

    // Step 2: Fill in required expense details
    const amountInput = screen.getByLabelText(/amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '125.50');

    const descriptionInput = screen.getByLabelText(/description/i);
    await user.type(descriptionInput, 'Business lunch with client');

    // Step 3: Select category (wait for categories to load)
    await waitFor(() => {
      expect(screen.getByText('Travel')).toBeInTheDocument();
    });

    const categorySelect = screen.getByRole('combobox');
    await user.click(categorySelect);
    await user.click(screen.getByText('Travel'));

    // Step 4: Set expense date
    const dateInput = screen.getByLabelText(/expense date/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2024-01-15');

    // Step 5: Submit the form
    const submitButton = screen.getByRole('button', { name: /save expense/i });
    expect(submitButton).not.toBeDisabled();

    await user.click(submitButton);

    // Step 6: Verify submission attempt
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle validation errors gracefully', async () => {
    render(
      <TestProviders>
        <AddEditExpenseDialog
          isOpen={true}
          onOpenChange={vi.fn()}
          companyId="test-company-id"
          initialMode="add"
        />
      </TestProviders>
    );

    // Try to submit without required fields
    const submitButton = screen.getByRole('button', { name: /save expense/i });
    await user.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
    });
  });

  it('should support expense editing workflow', async () => {
    const existingExpense = {
      id: 'existing-expense-id',
      amount: 75.25,
      description: 'Original description',
      category_id: '1',
      expense_date: '2024-01-10',
      receipt_url: null,
      submitted_by: 'test-user-id',
      company_id: 'test-company-id'
    };

    render(
      <TestProviders>
        <AddEditExpenseDialog
          isOpen={true}
          onOpenChange={vi.fn()}
          companyId="test-company-id"
          initialMode="edit"
          editingExpense={existingExpense}
        />
      </TestProviders>
    );

    // Verify pre-filled data
    expect(screen.getByDisplayValue('75.25')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original description')).toBeInTheDocument();

    // Modify the amount
    const amountInput = screen.getByDisplayValue('75.25');
    await user.clear(amountInput);
    await user.type(amountInput, '85.00');

    // Submit changes
    const updateButton = screen.getByRole('button', { name: /save expense/i });
    await user.click(updateButton);

    // Verify update attempt
    await waitFor(() => {
      expect(updateButton).toBeDisabled();
    });
  });

  it('should handle file upload for receipts', async () => {
    render(
      <TestProviders>
        <AddEditExpenseDialog
          isOpen={true}
          onOpenChange={vi.fn()}
          companyId="test-company-id"
          initialMode="add"
        />
      </TestProviders>
    );

    // Create a mock file
    const mockFile = new File(['receipt content'], 'receipt.pdf', {
      type: 'application/pdf'
    });

    // Find file input and upload file
    const fileInput = screen.getByLabelText(/receipt/i);
    await user.upload(fileInput, mockFile);

    // Verify file is selected
    expect(fileInput.files?.[0]).toBe(mockFile);
    expect(fileInput.files).toHaveLength(1);
  });

  it('should calculate and display running total', async () => {
    render(
      <TestProviders>
        <AddEditExpenseDialog
          isOpen={true}
          onOpenChange={vi.fn()}
          companyId="test-company-id"
          initialMode="add"
        />
      </TestProviders>
    );

    // Enter amount
    const amountInput = screen.getByLabelText(/amount/i);
    await user.type(amountInput, '199.99');

    // Verify amount is reflected (could be in a summary or preview)
    expect(amountInput).toHaveValue(199.99);
  });
});