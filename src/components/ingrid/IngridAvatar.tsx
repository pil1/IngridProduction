/**
 * Ingrid Avatar Component
 *
 * Consistent AI personality avatar for the Ingrid assistant.
 * Provides visual identity and status indicators.
 */

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Brain, Zap } from 'lucide-react';

interface IngridAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  status?: 'online' | 'processing' | 'offline';
  className?: string;
}

export const IngridAvatar: React.FC<IngridAvatarProps> = ({
  size = 'md',
  showStatus = false,
  status = 'online',
  className
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-8 w-8';
      case 'lg':
        return 'h-16 w-16';
      default:
        return 'h-10 w-10';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Brain className="h-3 w-3 animate-pulse" />;
      case 'offline':
        return <Zap className="h-3 w-3 text-gray-400" />;
      default:
        return <Sparkles className="h-3 w-3" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-green-500';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Avatar className={getSizeClasses()}>
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
          <Sparkles className={size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'} />
        </AvatarFallback>
      </Avatar>

      {showStatus && (
        <div className="absolute -bottom-1 -right-1">
          <Badge
            variant="secondary"
            className={`h-6 w-6 rounded-full p-0 flex items-center justify-center ${getStatusColor()} text-white border-2 border-background`}
          >
            {getStatusIcon()}
          </Badge>
        </div>
      )}
    </div>
  );
};