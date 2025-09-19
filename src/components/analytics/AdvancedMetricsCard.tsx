import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import FormattedCurrencyDisplay from '@/components/FormattedCurrencyDisplay';

export interface MetricData {
  value: number;
  previousValue?: number;
  target?: number;
  unit?: string;
  format?: 'currency' | 'percentage' | 'number';
  currencyCode?: string;
  label: string;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'danger';
  threshold?: {
    warning: number;
    danger: number;
  };
}

interface AdvancedMetricsCardProps {
  metric: MetricData;
  className?: string;
}

export const AdvancedMetricsCard = ({ metric, className }: AdvancedMetricsCardProps) => {
  const {
    value,
    previousValue,
    target,
    unit = '',
    format = 'number',
    currencyCode = 'USD',
    label,
    description,
    trend,
    status,
    threshold
  } = metric;

  // Calculate percentage change
  const changePercentage = previousValue
    ? ((value - previousValue) / previousValue * 100)
    : null;

  // Calculate target progress
  const targetProgress = target ? (value / target * 100) : null;

  // Determine status based on threshold if not provided
  const getStatus = () => {
    if (status) return status;
    if (!threshold) return 'good';

    if (value <= threshold.danger) return 'danger';
    if (value <= threshold.warning) return 'warning';
    return 'good';
  };

  const currentStatus = getStatus();

  // Format value display
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return <FormattedCurrencyDisplay amount={val} currencyCode={currencyCode} />;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return `${val.toLocaleString()}${unit}`;
    }
  };

  // Get trend icon and color
  const getTrendInfo = () => {
    if (trend === 'up' || (changePercentage && changePercentage > 0)) {
      return {
        icon: TrendingUp,
        color: 'text-green-500',
        direction: 'up'
      };
    } else if (trend === 'down' || (changePercentage && changePercentage < 0)) {
      return {
        icon: TrendingDown,
        color: 'text-red-500',
        direction: 'down'
      };
    } else {
      return {
        icon: Minus,
        color: 'text-muted-foreground',
        direction: 'stable'
      };
    }
  };

  const trendInfo = getTrendInfo();
  const TrendIcon = trendInfo.icon;

  // Get status color
  const getStatusColor = () => {
    switch (currentStatus) {
      case 'good':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'danger':
        return 'border-red-200 bg-red-50';
      default:
        return '';
    }
  };

  return (
    <Card className={cn('relative', getStatusColor(), className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          {currentStatus !== 'good' && (
            <Badge
              variant={currentStatus === 'warning' ? 'secondary' : 'destructive'}
              className="h-5"
            >
              {currentStatus === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {currentStatus.toUpperCase()}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Main value */}
          <div className="text-2xl font-bold">
            {formatValue(value)}
          </div>

          {/* Trend and change */}
          {changePercentage !== null && (
            <div className="flex items-center space-x-2">
              <div className={cn('flex items-center space-x-1', trendInfo.color)}>
                <TrendIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {Math.abs(changePercentage).toFixed(1)}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                vs previous period
              </span>
            </div>
          )}

          {/* Target progress */}
          {target && targetProgress !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress to target</span>
                <div className="flex items-center space-x-1">
                  <Target className="h-3 w-3" />
                  <span>{formatValue(target)}</span>
                </div>
              </div>
              <Progress
                value={Math.min(targetProgress, 100)}
                className="h-2"
              />
              <div className="text-right text-xs text-muted-foreground">
                {targetProgress.toFixed(1)}% of target
              </div>
            </div>
          )}

          {/* Previous value comparison */}
          {previousValue !== undefined && (
            <div className="text-xs text-muted-foreground">
              Previous: {formatValue(previousValue)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvancedMetricsCard;