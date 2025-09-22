/**
 * Field Source Icon Component
 *
 * Small icon indicator showing the source of a field value
 * (AI, Manual, Mixed, or Override) with appropriate colors and tooltips.
 */

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, User, GitBranch, Edit, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldSource } from '@/types/expenses';

export interface FieldSourceIconProps {
  source: FieldSource;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

// Get field source styling
const getSourceStyle = (source: FieldSource) => {
  switch (source) {
    case 'ai':
      return 'text-blue-500 hover:text-blue-600';
    case 'manual':
      return 'text-gray-500 hover:text-gray-600';
    case 'mixed':
      return 'text-purple-500 hover:text-purple-600';
    case 'override':
      return 'text-amber-500 hover:text-amber-600';
  }
};

// Get field source icon
const getSourceIcon = (source: FieldSource, size: string) => {
  const iconSize = {
    xs: 'h-2.5 w-2.5',
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const iconClass = iconSize[size as keyof typeof iconSize];

  switch (source) {
    case 'ai':
      return <Brain className={iconClass} />;
    case 'manual':
      return <User className={iconClass} />;
    case 'mixed':
      return <GitBranch className={iconClass} />;
    case 'override':
      return <Edit className={iconClass} />;
  }
};

// Get field source label
const getSourceLabel = (source: FieldSource) => {
  switch (source) {
    case 'ai':
      return 'AI Generated';
    case 'manual':
      return 'Manually Entered';
    case 'mixed':
      return 'AI + Manual';
    case 'override':
      return 'Manual Override';
  }
};

// Get field source description
const getSourceDescription = (source: FieldSource) => {
  switch (source) {
    case 'ai':
      return 'This field was automatically filled by Ingrid AI based on document analysis';
    case 'manual':
      return 'This field was manually entered by the user without AI assistance';
    case 'mixed':
      return 'This field was suggested by AI and then verified or adjusted by the user';
    case 'override':
      return 'This field was originally processed by AI but completely overridden by the user';
  }
};

export const FieldSourceIcon: React.FC<FieldSourceIconProps> = ({
  source,
  size = 'sm',
  showTooltip = true,
  className
}) => {
  const icon = (
    <div
      className={cn(
        'inline-flex items-center justify-center transition-colors cursor-default',
        getSourceStyle(source),
        className
      )}
    >
      {getSourceIcon(source, size)}
    </div>
  );

  if (!showTooltip) {
    return icon;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {icon}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Field Source</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {getSourceIcon(source, 'sm')}
                <span className="font-medium">{getSourceLabel(source)}</span>
              </div>

              <p className="text-xs text-muted-foreground">
                {getSourceDescription(source)}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};