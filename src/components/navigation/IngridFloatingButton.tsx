import React, { useState } from "react";
import { BotIcon, CloseIcon, SparklesIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { IngridAnimatedAvatar } from "@/components/ingrid/IngridAnimatedAvatar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface IngridFloatingButtonProps {
  className?: string;
}

export const IngridFloatingButton: React.FC<IngridFloatingButtonProps> = ({
  className
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    try {
      navigate("/ingrid-ai");
    } catch (error) {
      toast({
        title: "Navigation Error",
        description: "Unable to open Ingrid AI. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              // Base styles
              "fixed bottom-6 right-6 z-50",
              "flex items-center justify-center",
              "rounded-full shadow-2xl",
              "transition-all duration-300 ease-in-out",
              // Gradient background using theme colors
              "bg-gradient-to-r from-primary via-accent to-primary",
              "bg-size-200 bg-pos-0 hover:bg-pos-100",
              // Size and interaction
              "w-16 h-16",
              "hover:scale-110 hover:shadow-accent/50",
              "active:scale-95",
              // Focus states
              "focus:outline-none focus:ring-4 focus:ring-accent/50",
              // Animations
              "animate-pulse hover:animate-none",
              // Custom class
              className
            )}
            style={{
              backgroundSize: "200% 100%",
              backgroundPosition: isHovered ? "100% 0" : "0 0",
            }}
            aria-label="Open Ingrid AI Assistant"
          >
            {/* Avatar Container */}
            <div className="relative">
              <IngridAnimatedAvatar
                size="md"
                status="online"
                className="w-12 h-12"
              />

              {/* Sparkle effect on hover */}
              {isHovered && (
                <div className="absolute -top-1 -right-1">
                  <SparklesIcon className="w-4 h-4 text-yellow-300 animate-spin" />
                </div>
              )}
            </div>

            {/* Pulse ring effect */}
            <span className="absolute inset-0 rounded-full bg-accent opacity-0 animate-ping" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-none">
          <p className="font-semibold">Ask Ingrid AI</p>
          <p className="text-xs opacity-90">Your AI business assistant</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
