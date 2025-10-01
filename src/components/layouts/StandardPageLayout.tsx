/**
 * StandardPageLayout - Universal page layout component with MynaUI styling
 *
 * Features:
 * - Automatic page header integration via usePageTitle
 * - Responsive grid/flex layouts
 * - Optional sidebar for filters/actions
 * - Empty state handling
 * - Loading state with MynaUI skeleton
 * - Error boundary support
 *
 * @example Basic usage:
 * <StandardPageLayout>
 *   <YourContent />
 * </StandardPageLayout>
 *
 * @example With sidebar:
 * <StandardPageLayout
 *   sidebar={<FilterPanel />}
 *   sidebarPosition="right"
 * >
 *   <YourContent />
 * </StandardPageLayout>
 */

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LoaderIcon, AlertCircleIcon } from "@/lib/icons";
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle, EnhancedCardDescription } from '@/components/myna/elements/enhanced-card';
import { EnhancedButton } from '@/components/myna/elements/enhanced-button';

interface StandardPageLayoutProps {
  children: ReactNode;

  // Loading and error states
  loading?: boolean;
  error?: Error | string | null;
  onRetry?: () => void;

  // Empty state
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  // Layout options
  sidebar?: ReactNode;
  sidebarPosition?: 'left' | 'right';
  sidebarWidth?: 'sm' | 'md' | 'lg';

  // Spacing
  spacing?: 'compact' | 'normal' | 'relaxed';

  // Container options
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl' | '4xl';
  centered?: boolean;

  // Additional classes
  className?: string;
  contentClassName?: string;
}

export const StandardPageLayout: React.FC<StandardPageLayoutProps> = ({
  children,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyTitle = 'No data available',
  emptyDescription = 'There is nothing to display at the moment.',
  emptyAction,
  sidebar,
  sidebarPosition = 'right',
  sidebarWidth = 'md',
  spacing = 'normal',
  maxWidth = 'full',
  centered = false,
  className,
  contentClassName,
}) => {
  // Spacing classes
  const spacingClasses = {
    compact: 'space-y-4',
    normal: 'space-y-6',
    relaxed: 'space-y-8',
  };

  // Sidebar width classes
  const sidebarWidthClasses = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
  };

  // Max width classes
  const maxWidthClasses = {
    full: 'max-w-full',
    '7xl': 'max-w-7xl',
    '6xl': 'max-w-6xl',
    '5xl': 'max-w-5xl',
    '4xl': 'max-w-4xl',
  };

  // Loading State
  if (loading) {
    return (
      <div className={cn('flex-1', spacingClasses[spacing], className)}>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <LoaderIcon className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    return (
      <div className={cn('flex-1', spacingClasses[spacing], className)}>
        <EnhancedCard variant="elevated" className="max-w-2xl mx-auto">
          <EnhancedCardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <EnhancedCardTitle>Something went wrong</EnhancedCardTitle>
                <EnhancedCardDescription>{errorMessage}</EnhancedCardDescription>
              </div>
            </div>
          </EnhancedCardHeader>
          {onRetry && (
            <EnhancedCardContent>
              <EnhancedButton variant="outline" onClick={onRetry} className="w-full">
                Try Again
              </EnhancedButton>
            </EnhancedCardContent>
          )}
        </EnhancedCard>
      </div>
    );
  }

  // Empty State
  if (empty) {
    return (
      <div className={cn('flex-1', spacingClasses[spacing], className)}>
        <EnhancedCard variant="elevated" className="max-w-2xl mx-auto">
          <EnhancedCardContent className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
            <div className="p-4 bg-gradient-to-br from-slate-100 to-blue-100 dark:from-slate-800 dark:to-blue-900 rounded-2xl">
              <AlertCircleIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-slate-700 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent">
                {emptyTitle}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {emptyDescription}
              </p>
            </div>
            {emptyAction && <div className="pt-2">{emptyAction}</div>}
          </EnhancedCardContent>
        </EnhancedCard>
      </div>
    );
  }

  // Main Layout with optional sidebar
  if (sidebar) {
    return (
      <div className={cn('flex-1', spacingClasses[spacing], className)}>
        <div className={cn(
          'flex gap-6',
          sidebarPosition === 'left' ? 'flex-row-reverse' : 'flex-row'
        )}>
          {/* Sidebar */}
          <aside className={cn(
            'shrink-0',
            sidebarWidthClasses[sidebarWidth],
            'hidden lg:block'
          )}>
            <div className="sticky top-20 space-y-4">
              {sidebar}
            </div>
          </aside>

          {/* Main Content */}
          <main className={cn(
            'flex-1 min-w-0',
            centered && maxWidthClasses[maxWidth],
            centered && 'mx-auto',
            contentClassName
          )}>
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Simple Layout (no sidebar)
  return (
    <div className={cn(
      'flex-1',
      spacingClasses[spacing],
      centered && maxWidthClasses[maxWidth],
      centered && 'mx-auto',
      className
    )}>
      <main className={contentClassName}>
        {children}
      </main>
    </div>
  );
};

/**
 * Grid Container for card-based layouts
 */
interface GridContainerProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GridContainer: React.FC<GridContainerProps> = ({
  children,
  columns = 3,
  gap = 'md',
  className,
}) => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  return (
    <div className={cn(
      'grid',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
};

/**
 * Section Container with optional header
 */
interface SectionContainerProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const SectionContainer: React.FC<SectionContainerProps> = ({
  title,
  description,
  action,
  children,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {title && (
              <h2 className="text-xl font-semibold bg-gradient-to-r from-slate-700 to-blue-600 dark:from-slate-200 dark:to-blue-400 bg-clip-text text-transparent">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};