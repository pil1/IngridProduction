import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SessionContextProvider, useSession } from '../SessionContextProvider';
import Login from '../../pages/Login';

// Mock Supabase auth
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      getUser: mockGetUser,
      getSession: mockGetSession,
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: {
              id: 'profile-id',
              email: 'test@example.com',
              full_name: 'Test User',
              role: 'admin',
              company_id: 'company-id',
              is_active: true
            },
            error: null
          }))
        }))
      }))
    }))
  }
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock router navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/login', search: '', state: null })
  };
});

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
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Test component to verify session state
const SessionTester = () => {
  const { profile, isLoading } = useSession();

  if (isLoading) return <div>Loading session...</div>;
  if (!profile) return <div>No authenticated user</div>;

  return (
    <div>
      <div data-testid="user-email">{profile.email}</div>
      <div data-testid="user-role">{profile.role}</div>
      <div data-testid="user-name">{profile.full_name}</div>
    </div>
  );
};

describe('Authentication Flow - Critical User Journey', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it('should handle successful login flow', async () => {
    // Mock successful authentication
    mockSignIn.mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-id',
          email: 'test@example.com'
        },
        session: {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh'
        }
      },
      error: null
    });

    render(
      <TestProviders>
        <Login />
      </TestProviders>
    );

    // Fill in login form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(loginButton);

    // Verify sign in was called with correct credentials
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });

  it('should handle login validation errors', async () => {
    render(
      <TestProviders>
        <Login />
      </TestProviders>
    );

    const loginButton = screen.getByRole('button', { name: /sign in/i });

    // Try to submit without credentials
    await user.click(loginButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('should handle authentication errors', async () => {
    // Mock authentication failure
    mockSignIn.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        message: 'Invalid login credentials',
        status: 400
      }
    });

    render(
      <TestProviders>
        <Login />
      </TestProviders>
    );

    // Fill in incorrect credentials
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'wrong@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(loginButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument();
    });
  });

  it('should handle session context properly', async () => {
    const mockProfile = {
      id: 'profile-id',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'admin' as const,
      company_id: 'company-id',
      is_active: true
    };

    render(
      <TestProviders>
        <SessionContextProvider
          value={{
            profile: mockProfile,
            isLoading: false,
            session: { user: { id: 'user-id', email: 'test@example.com' } } as any
          }}
        >
          <SessionTester />
        </SessionContextProvider>
      </TestProviders>
    );

    // Verify session data is available
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
  });

  it('should handle loading states during authentication', async () => {
    render(
      <TestProviders>
        <SessionContextProvider
          value={{
            profile: null,
            isLoading: true,
            session: null
          }}
        >
          <SessionTester />
        </SessionContextProvider>
      </TestProviders>
    );

    // Should show loading state
    expect(screen.getByText('Loading session...')).toBeInTheDocument();
  });

  it('should handle unauthenticated state', async () => {
    render(
      <TestProviders>
        <SessionContextProvider
          value={{
            profile: null,
            isLoading: false,
            session: null
          }}
        >
          <SessionTester />
        </SessionContextProvider>
      </TestProviders>
    );

    // Should show unauthenticated message
    expect(screen.getByText('No authenticated user')).toBeInTheDocument();
  });

  it('should validate email format', async () => {
    render(
      <TestProviders>
        <Login />
      </TestProviders>
    );

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const loginButton = screen.getByRole('button', { name: /sign in/i });

    // Enter invalid email format
    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'password123');
    await user.click(loginButton);

    // Should show email format validation error
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });
});