# User Creation & Setup Workflow Design

## Overview
User creation, authentication, and onboarding system with proper RLS enforcement and enhanced invitation workflows.

**✅ Status: Implemented with recent fixes (September 2025)**
- Super-admin profile completion loop resolved
- Enhanced invited user experience with company summary
- Navigation restructure with User Management in main menu
- Module activation system documented and working

## Database Schema Analysis

### Core Tables
- **auth.users**: Supabase auth users (managed by Supabase)
- **profiles**: User profile data linked to auth.users via user_id
- **companies**: Company information
- **modules**: Available system modules
- **company_modules**: Modules enabled for each company
- **role_permissions**: Default permissions by role

### User Roles
- `super-admin`: Global system administrator
- `admin`: Company administrator
- `user`: Regular company user

## New User Creation Workflow

### Phase 1: Initial Registration
1. **Email/Password Registration**: User provides email and password
2. **Auth User Creation**: Supabase creates auth.users record
3. **Profile Creation**: System creates corresponding profiles record
4. **Company Assignment**: User is assigned to a company (existing or new)

### Phase 2: Profile Completion
1. **Basic Info**: Full name, phone, avatar
2. **Role Assignment**: Assigned by admin or predetermined
3. **Company Context**: Company details and modules

### Phase 3: Permission Setup
1. **Role-Based Permissions**: Applied based on user role
2. **Module Access**: Based on company's enabled modules
3. **Company-Specific Settings**: Preferences and configurations

## RLS Security Model

### Profiles Table Policies
- Users can view/edit their own profile
- Super-admins can view/edit all profiles
- Company admins can view profiles in their company
- Uses auth.uid() to avoid recursion

### Company Data Policies
- Users can only access data from their company
- Company isolation enforced at database level
- Module access controlled by company_modules

## Component Architecture

### 1. AuthenticationProvider
- Manages Supabase auth state
- Handles login/logout
- Provides user context

### 2. RegistrationFlow
- Multi-step registration process
- Email verification
- Profile creation

### 3. OnboardingFlow
- Profile completion
- Company context setup
- Permission verification

### 4. PermissionProvider
- Loads user permissions
- Enforces module access
- Provides permission context

## Implementation Strategy

### New Components to Create
1. `UserRegistrationFlow.tsx` - Complete registration process
2. `ProfileSetupDialog.tsx` - Profile completion
3. `CompanyOnboardingFlow.tsx` - Company setup for new users
4. `PermissionProvider.tsx` - Permission management context
5. `AuthGuard.tsx` - Route protection with permissions

### Updated Components
1. `SessionContextProvider.tsx` - Enhanced with permissions
2. `ProtectedRoute.tsx` - Permission-based routing
3. `FirstLoginOnboardingDialog.tsx` - Simplified to focus on profile only

### Security Enhancements
1. All API calls use proper RLS policies
2. JWT metadata stores user role for quick access
3. Company isolation enforced at every level
4. Module access verified before component render

## User Experience Flow

### New User Registration
1. **Landing Page**: Registration form with email/password
2. **Email Verification**: Supabase sends verification email
3. **Profile Setup**: Name, phone, avatar upload
4. **Company Assignment**: Join existing or create new company
5. **Module Access**: Based on company subscription
6. **Dashboard Access**: Full application access

### Existing User Login
1. **Login Form**: Email/password authentication
2. **Profile Validation**: Ensure profile is complete
3. **Permission Loading**: Load user permissions and modules
4. **Dashboard Redirect**: Direct access to application

### Admin User Creation (Enhanced ✅)
1. **Admin Panel**: Admin creates user account via User Management page
2. **Invitation Email**: User receives setup invitation
3. **Password Setup**: User sets their own password
4. **Profile Completion**: **ENHANCED** - Shows company summary for invited users
   - Pre-assigned company and role displayed
   - No confusing "Join Existing Company" selection
   - Clear summary of company assignment
5. **Role Assignment**: Based on admin selection and module permissions

## Recent Fixes & Enhancements (September 2025)

### Super-Admin Workflow Fixes ✅
- **Issue**: Super-admins were getting stuck in profile completion loops
- **Root Cause**: Priority ordering in authentication flow checks
- **Solution**: Reordered conditional logic in `src/App.tsx` to check super-admin role before profile completion requirements
- **File**: `src/App.tsx:line ~200` - Priority A logic for super-admin handling

### Enhanced Invited User Experience ✅
- **Issue**: Invited users saw confusing company selection when they already had pre-assigned companies
- **Enhancement**: Modified `src/pages/NewCompleteProfilePage.tsx` to detect invited users
- **Detection Logic**: `isInvitedUser = profile?.company_id && profile?.role`
- **UI Changes**: Shows company summary card instead of selection interfaces

### Navigation Restructure ✅
- **Legacy Removal**: Deleted deprecated `/companies` page entirely
- **Menu Update**: Moved User Management from Settings submenu to main navigation
- **File Changes**:
  - `src/hooks/use-user-menu-preferences.tsx` - Updated menu structure
  - `src/App.tsx` - Removed Companies route and import

### Database Account Fixes ✅
- **Issue**: Super-admin account incorrectly assigned to a company
- **Solution**: Fixed seeding script to ensure super-admin has `company_id = null`
- **File**: `scripts/seed-database.js` - Updated role-based company assignment
- **Verification**: `fix_superadmin_account.sql` for account cleanup

## Technical Implementation Details

### Database Triggers
- Auto-create profile when auth user is created
- Update last_sign_in timestamp
- Sync user metadata with profile data

### Permission System
- Role-based permissions loaded from role_permissions table
- Module access from company_modules table
- Real-time permission updates via Supabase subscriptions

### Error Handling
- Comprehensive error boundaries
- User-friendly error messages
- Automatic retry for transient failures
- Graceful degradation for missing permissions

## Security Considerations

### RLS Policies
- Every table has appropriate RLS policies
- No service role access from client-side
- Company data isolation guaranteed
- User can only access their permitted data

### Authentication Flow
- JWT tokens contain minimal metadata
- Role verification through database queries
- Session management with automatic refresh
- Secure logout with token invalidation

### Data Validation
- Client-side validation for UX
- Server-side validation for security
- Type safety with TypeScript
- Schema validation with Zod