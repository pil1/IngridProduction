/**
 * Enhanced Ingrid Animated Avatar Component
 *
 * CSS-based animations with plans for Lottie integration.
 * Provides smooth transitions between idle, hover, processing, success, and error states.
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SparklesIcon, NeuralIcon, AutomationIcon, CheckCircle2Icon, AlertCircleIcon } from "@/lib/icons";

export interface IngridAnimationStates {
  idle: 'breathing' | 'subtle-glow' | 'eye-blink';
  hover: 'excited-bounce' | 'sparkle-effect' | 'color-shift';
  processing: 'thinking-gears' | 'data-flow' | 'neural-pulse';
  success: 'celebration' | 'checkmark-appear' | 'happy-bounce';
  error: 'gentle-shake' | 'concern-expression' | 'recovery-flow';
}

interface IngridAnimatedAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'idle' | 'hover' | 'processing' | 'success' | 'error' | 'online' | 'offline';
  showStatus?: boolean;
  showMessage?: boolean;
  message?: string;
  className?: string;
  onClick?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
}

export const IngridAnimatedAvatar: React.FC<IngridAnimatedAvatarProps> = ({
  size = 'md',
  status = 'idle',
  showStatus = false,
  showMessage = false,
  message,
  className,
  onClick,
  autoPlay = true,
  loop = true,
  speed = 1,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Size configuration
  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'h-6 w-6';
      case 'sm':
        return 'h-8 w-8';
      case 'lg':
        return 'h-16 w-16';
      case 'xl':
        return 'h-24 w-24';
      default:
        return 'h-12 w-12';
    }
  };

  // Status icon and color configuration
  const getStatusConfig = () => {
    switch (status) {
      case 'processing':
        return {
          icon: <NeuralIcon className="h-3 w-3 animate-pulse" />,
          color: 'bg-blue-500',
          glow: 'shadow-blue-500/50'
        };
      case 'success':
        return {
          icon: <CheckCircle2Icon className="h-3 w-3" />,
          color: 'bg-green-500',
          glow: 'shadow-green-500/50'
        };
      case 'error':
        return {
          icon: <AlertCircleIcon className="h-3 w-3" />,
          color: 'bg-red-500',
          glow: 'shadow-red-500/50'
        };
      case 'offline':
        return {
          icon: <AutomationIcon className="h-3 w-3 text-gray-400" />,
          color: 'bg-gray-400',
          glow: 'shadow-gray-400/50'
        };
      default:
        return {
          icon: <SparklesIcon className="h-3 w-3" />,
          color: 'bg-gradient-to-br from-blue-500 to-purple-600',
          glow: 'shadow-blue-500/50'
        };
    }
  };

  // Get animation classes based on status
  const getAnimationClasses = () => {
    switch (status) {
      case 'processing':
        return 'animate-pulse duration-1000';
      case 'success':
        return 'animate-bounce duration-500';
      case 'error':
        return 'animate-pulse duration-300';
      case 'hover':
        return 'animate-pulse duration-700';
      default:
        return isHovered ? 'animate-pulse duration-1000' : '';
    }
  };

  // Handle hover effects
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Handle click interactions
  const handleClick = () => {
    onClick?.();
  };

  const statusConfig = getStatusConfig();

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-all duration-300",
        getSizeClasses(),
        isHovered && "scale-110",
        onClick && "cursor-pointer",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Main Avatar Container */}
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center",
          getSizeClasses(),
          "transition-all duration-300",
          getAnimationClasses(),
          isHovered && statusConfig.glow && `shadow-lg ${statusConfig.glow}`,
          status === 'processing' && "bg-gradient-to-br from-blue-400 to-cyan-500",
          status === 'success' && "bg-gradient-to-br from-green-400 to-emerald-500",
          status === 'error' && "bg-gradient-to-br from-red-400 to-rose-500",
          status === 'offline' && "bg-gradient-to-br from-gray-400 to-gray-500 opacity-60"
        )}
      >
        {/* Turing Test Inspired Icon */}
        <div className="relative">
          {/* Monitor/Screen representation */}
          <svg
            className={cn(
              "text-white transition-all duration-300",
              size === 'xs' ? 'h-3 w-3' :
              size === 'sm' ? 'h-4 w-4' :
              size === 'lg' ? 'h-8 w-8' :
              size === 'xl' ? 'h-12 w-12' : 'h-6 w-6'
            )}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            {/* Computer monitor with AI brain inside */}
            <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v1h12v-1l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM4 14V6h16v8H4z"/>
            {/* AI brain pattern inside monitor */}
            <circle cx="9" cy="9" r="1" className={cn(
              status === 'processing' && 'animate-ping',
              status === 'success' && 'animate-bounce'
            )}/>
            <circle cx="15" cy="9" r="1" className={cn(
              status === 'processing' && 'animate-ping',
              status === 'success' && 'animate-bounce'
            )} style={{ animationDelay: '0.1s' }}/>
            <path d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" className={cn(
              status === 'processing' && 'animate-pulse',
              status === 'success' && 'animate-pulse'
            )}/>
          </svg>

          {/* Processing indicator dots */}
          {status === 'processing' && (
            <div className="absolute -top-1 -right-1 flex space-x-1">
              <div className="w-1 h-1 bg-cyan-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-1 h-1 bg-cyan-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-1 h-1 bg-cyan-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          )}
        </div>

        {/* Overlay effects */}
        {isHovered && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full animate-pulse" />
        )}

        {status === 'processing' && (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full animate-pulse" />
        )}
      </div>

      {/* Status Indicator Badge */}
      {showStatus && (
        <div className="absolute -bottom-1 -right-1">
          <Badge
            variant="secondary"
            className={cn(
              "h-6 w-6 rounded-full p-0 flex items-center justify-center text-white border-2 border-background",
              statusConfig.color,
              status === 'processing' && "animate-pulse"
            )}
          >
            {statusConfig.icon}
          </Badge>
        </div>
      )}

      {/* Floating Message */}
      {showMessage && message && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-lg border">
            <p className="text-xs font-medium text-gray-700 whitespace-nowrap">
              {message}
            </p>
            {/* Speech bubble tail */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/90" />
          </div>
        </div>
      )}

      {/* Pulse effect for active states */}
      {(status === 'processing' || isHovered) && (
        <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/20" />
      )}
    </div>
  );
};

export default IngridAnimatedAvatar;