# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server on port 8080
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run lint` - Run ESLint for code linting
- `npm run preview` - Preview production build

### Testing
No automated test framework is configured. Only Android unit tests exist in the `android/` directory.

## Architecture Overview

This is a React + TypeScript application for **INFOtrac**, an expense management and business automation platform built with Vite, Supabase, and shadcn/ui.

### Key Technologies
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui components with Radix UI and Tailwind CSS
- **Backend**: Supabase (authentication, database, functions)
- **Routing**: React Router v6 with protected routes
- **State Management**: TanStack Query for server state
- **Mobile**: Capacitor for iOS/Android apps

### Architecture Patterns

#### Authentication & Authorization
- Role-based access control: `super-admin`, `admin`, `user`
- Protected routes with `ProtectedRoute` component in `src/App.tsx`
- Multi-tenant architecture with company-based data isolation
- User impersonation support for admins
- Complex onboarding flow for different user types

#### File Structure
- `src/pages/` - Main application pages
- `src/components/` - Reusable UI components
- `src/components/ui/` - shadcn/ui components (do not edit directly)
- `src/layouts/` - Layout components (RootLayout with sidebar)
- `src/integrations/supabase/` - Supabase client configuration
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and business logic

#### Key Components
- **RootLayout**: Main layout with sidebar navigation
- **SessionContextProvider**: Manages user session and profile state
- **ProtectedRoute**: Handles authentication and role-based redirects
- Complex dialogs for automation, company setup, and user management

#### Business Domains
- **Expense Management**: Upload, categorize, and process expense receipts
- **Process Automation**: Email-based document processing with AI
- **Company Management**: Multi-tenant company settings and module access
- **User Management**: Role-based user administration
- **Document Processing**: PDF viewing and AI-powered data extraction

### Important Development Notes

#### Tech Stack Constraints
- All shadcn/ui components are pre-installed - do not install additional ones
- Use Tailwind CSS extensively for styling
- Routes are centrally managed in `src/App.tsx`
- Main page is `src/pages/Index.tsx`
- Always update the main page when adding new components for visibility

#### Supabase Integration
- Client configured in `src/integrations/supabase/client.ts`
- Uses Row Level Security (RLS) for data access control
- Supabase functions handle backend business logic

#### Mobile Support
- Capacitor configured for iOS/Android deployment
- Responsive design with mobile-first approach

### Current Features
- Dashboard with analytics and charts
- Expense tracking and receipt processing
- Vendor and customer management
- GL account and expense category management
- Process automation with email integration
- Company and user administration
- Billing and module management
- Notification system

### Development Workflow
1. Routes are defined in `src/App.tsx` - keep them there
2. Put new pages in `src/pages/`
3. Put new components in `src/components/`
4. Update `src/pages/Index.tsx` to include new components for user visibility
5. Use existing shadcn/ui components instead of creating new ones
6. Follow the established authentication and authorization patterns