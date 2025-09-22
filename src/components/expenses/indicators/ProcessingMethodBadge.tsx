/**
 * Processing Method Badge Component
 *
 * Visual indicator for how an expense was processed (AI, Manual, or Hybrid)
 * with appropriate colors and icons.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, User, Zap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProcessingMethod } from '@/types/expenses';

export interface ProcessingMethodBadgeProps {
  method: ProcessingMethod;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
}

// Get processing method styling
const getMethodStyle = (method: ProcessingMethod, size: string) => {
  const baseStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 h-4',
    sm: 'text-xs px-2 py-0.5 h-5',
    md: 'text-sm px-2.5 py-1 h-6',
    lg: 'text-base px-3 py-1.5 h-8'
  };

  const methodStyles = {
    ai: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
    manual: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
    hybrid: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
  };

  return `${baseStyles[size as keyof typeof baseStyles]} ${methodStyles[method]} border transition-colors`;
};

// Get processing method icon
const getMethodIcon = (method: ProcessingMethod, size: string) => {
  const iconSize = {
    xs: 'h-2 w-2',
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const iconClass = iconSize[size as keyof typeof iconSize];

  switch (method) {
    case 'ai':
      return <Brain className={cn(iconClass, 'text-blue-600')} />;
    case 'manual':
      return <User className={cn(iconClass, 'text-gray-600')} />;
    case 'hybrid':
      return <Zap className={cn(iconClass, 'text-purple-600')} />;
  }
};

// Get processing method label
const getMethodLabel = (method: ProcessingMethod) => {
  switch (method) {
    case 'ai':
      return 'AI';
    case 'manual':
      return 'Manual';
    case 'hybrid':
      return 'Hybrid';
  }
};

// Get processing method description
const getMethodDescription = (method: ProcessingMethod) => {
  switch (method) {
    case 'ai':
      return 'This expense was automatically processed by Ingrid AI with high confidence';
    case 'manual':
      return 'This expense was manually entered by the user without AI assistance';
    case 'hybrid':
      return 'This expense was processed by AI but manually reviewed and modified by the user';
  }
};

export const ProcessingMethodBadge: React.FC<ProcessingMethodBadgeProps> = ({
  method,
  size = 'sm',
  showIcon = true,
  showTooltip = true,
  className
}) => {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        getMethodStyle(method, size),
        'font-medium flex items-center gap-1 cursor-default',
        className
      )}
    >
      {showIcon && getMethodIcon(method, size)}
      <span>{getMethodLabel(method)}</span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Processing Method</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {getMethodIcon(method, 'sm')}
                <span className="font-medium">{getMethodLabel(method)} Processing</span>
              </div>

              <p className="text-xs text-muted-foreground">
                {getMethodDescription(method)}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};