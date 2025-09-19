import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
import { SessionContextProvider, useSession } from '../SessionContextProvider';
import { userService } from '@/services/api';

// Mock the user service
vi.mock('@/services/api', () => ({
  userService: {
    getCurrentProfile: vi.fn(),
    getSession: vi.fn(),
  }
}));

// Test component that uses the session
const TestComponent = () => {
  const { profile, isLoading, session } = useSession();

  if (isLoading) return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;
  if (!profile) return <div>No profile</div>;

  return (
    <div>
      <div data-testid="user-name">{profile.first_name} {profile.last_name}</div>
      <div data-testid="user-email">{profile.email}</div>
      <div data-testid="user-role">{profile.role}</div>
      <div data-testid="company-id">{profile.company_id}</div>
    </div>
  );
};

describe('SessionContextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', async () => {
    vi.mocked(userService.getSession).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        data: { session: null },
        error: null,
        success: true
      }), 100))
    );

    render(
      <SessionContextProvider>
        <TestComponent />
      </SessionContextProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle user with complete profile', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'john@example.com' },
      access_token: 'token-123'
    };

    const mockProfile = {
      id: 'user-123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      role: 'user' as const,
      company_id: 'company-456',
      is_active: true,
      created_at: '2025-01-01',
      updated_at: '2025-01-01'
    };

    vi.mocked(userService.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
      success: true
    });

    vi.mocked(userService.getCurrentProfile).mockResolvedValue({
      data: mockProfile,
      error: null,
      success: true
    });

    render(
      <SessionContextProvider>
        <TestComponent />
      </SessionContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
    });

    expect(screen.getByTestId('user-email')).toHaveTextContent('john@example.com');
    expect(screen.getByTestId('user-role')).toHaveTextContent('user');
    expect(screen.getByTestId('company-id')).toHaveTextContent('company-456');
  });

  it('should handle user without session', async () => {
    vi.mocked(userService.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
      success: true
    });

    render(
      <SessionContextProvider>
        <TestComponent />
      </SessionContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });

    expect(userService.getCurrentProfile).not.toHaveBeenCalled();
  });

  it('should handle user with session but no profile', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'john@example.com' },
      access_token: 'token-123'
    };

    vi.mocked(userService.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
      success: true
    });

    vi.mocked(userService.getCurrentProfile).mockResolvedValue({
      data: null,
      error: null,
      success: true
    });

    render(
      <SessionContextProvider>
        <TestComponent />
      </SessionContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No profile')).toBeInTheDocument();
    });
  });

  it('should handle session fetch error', async () => {
    vi.mocked(userService.getSession).mockResolvedValue({
      data: null,
      error: new Error('Session fetch failed'),
      success: false
    });

    render(
      <SessionContextProvider>
        <TestComponent />
      </SessionContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });

  it.skip('should handle profile fetch error', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'john@example.com' },
      access_token: 'token-123'
    };

    vi.mocked(userService.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
      success: true
    });

    vi.mocked(userService.getCurrentProfile).mockResolvedValue({
      data: null,
      error: new Error('Profile fetch failed'),
      success: false
    });

    render(
      <SessionContextProvider>
        <TestComponent />
      </SessionContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No profile')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle admin user with impersonation capability', async () => {
    const mockSession = {
      user: { id: 'admin-123', email: 'admin@example.com' },
      access_token: 'token-456'
    };

    const mockProfile = {
      id: 'admin-123',
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      role: 'admin' as const,
      company_id: 'company-456',
      is_active: true,
      created_at: '2025-01-01',
      updated_at: '2025-01-01'
    };

    vi.mocked(userService.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
      success: true
    });

    vi.mocked(userService.getCurrentProfile).mockResolvedValue({
      data: mockProfile,
      error: null,
      success: true
    });

    render(
      <SessionContextProvider>
        <TestComponent />
      </SessionContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
    });

    expect(screen.getByTestId('user-name')).toHaveTextContent('Admin User');
  });
});