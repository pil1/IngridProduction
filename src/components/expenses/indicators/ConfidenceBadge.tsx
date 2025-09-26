/**
 * Confidence Badge Component
 *
 * Visual indicator for AI confidence scores with color-coded levels
 * and interactive hover states showing detailed information.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Brain, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceLevel } from '@/types/expenses';

export interface ConfidenceBadgeProps {
  confidence: number; // 0-1 scale
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTooltip?: boolean;
  className?: string;
  isManual?: boolean; // Indicates this is a manual entry, not AI
}

// Calculate confidence level from score
const getConfidenceLevel = (confidence: number): ConfidenceLevel => {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
};

// Get confidence styling
const getConfidenceStyle = (level: ConfidenceLevel, size: string) => {
  const baseStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 h-4',
    sm: 'text-xs px-2 py-0.5 h-5',
    md: 'text-sm px-2.5 py-1 h-6',
    lg: 'text-base px-3 py-1.5 h-8'
  };

  const levelStyles = {
    high: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200',
    low: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
  };

  return `${baseStyles[size as keyof typeof baseStyles]} ${levelStyles[level]} border transition-colors`;
};

// Get confidence icon
const getConfidenceIcon = (level: ConfidenceLevel, size: string) => {
  const iconSize = {
    xs: 'h-2 w-2',
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const iconClass = iconSize[size as keyof typeof iconSize];

  switch (level) {
    case 'high':
      return <CheckCircle className={cn(iconClass, 'text-emerald-600')} />;
    case 'medium':
      return <TrendingUp className={cn(iconClass, 'text-amber-600')} />;
    case 'low':
      return <AlertTriangle className={cn(iconClass, 'text-red-600')} />;
  }
};

// Get confidence description
const getConfidenceDescription = (confidence: number, level: ConfidenceLevel) => {
  const percentage = Math.round(confidence * 100);

  switch (level) {
    case 'high':
      return `High confidence (${percentage}%) - AI is very certain about this data`;
    case 'medium':
      return `Medium confidence (${percentage}%) - AI has reasonable certainty, recommend verification`;
    case 'low':
      return `Low confidence (${percentage}%) - AI is uncertain, manual verification required`;
  }
};

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  size = 'sm',
  showIcon = true,
  showTooltip = true,
  className,
  isManual = false
}) => {
  // For manual entries, show a different badge style
  if (isManual) {
    const baseStyles = {
      xs: 'text-[10px] px-1.5 py-0.5 h-4',
      sm: 'text-xs px-2 py-0.5 h-5',
      md: 'text-sm px-2.5 py-1 h-6',
      lg: 'text-base px-3 py-1.5 h-8'
    };

    const manualBadge = (
      <Badge
        variant="outline"
        className={cn(
          baseStyles[size],
          'bg-gray-100 text-gray-700 border-gray-300 font-medium flex items-center gap-1 cursor-default',
          className
        )}
      >
        {showIcon && <CheckCircle className={cn(
          size === 'xs' ? 'h-2 w-2' :
          size === 'sm' ? 'h-2.5 w-2.5' :
          size === 'md' ? 'h-3 w-3' : 'h-4 w-4',
          'text-gray-600'
        )} />}
        <span>Manual</span>
      </Badge>
    );

    if (!showTooltip) {
      return manualBadge;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {manualBadge}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-gray-600" />
                <span className="font-medium">Manual Entry</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This expense was entered manually without AI processing
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Original AI confidence badge logic
  const level = getConfidenceLevel(confidence);
  const percentage = Math.round(confidence * 100);

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        getConfidenceStyle(level, size),
        'font-medium flex items-center gap-1 cursor-default',
        className
      )}
    >
      {showIcon && getConfidenceIcon(level, size)}
      <span>{percentage}%</span>
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
              <Brain className="h-4 w-4 text-blue-500" />
              <span className="font-medium">AI Confidence Score</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Confidence Level:</span>
                <span className="font-medium capitalize">{level}</span>
              </div>

              <Progress value={confidence * 100} className="h-2" />

              <p className="text-xs text-muted-foreground">
                {getConfidenceDescription(confidence, level)}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};