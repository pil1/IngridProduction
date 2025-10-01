import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/integrations/api/client';
import {
  SaveIcon,
  RotateCcwIcon,
  ZoomInIcon,
  ZoomOutIcon,
  LoaderIcon,
  MoveIcon,
  CheckCircleIcon
} from "@/lib/icons";

interface AvatarPositioning {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  zoom: number; // 0.1 to 3.0
}

interface InteractiveAvatarEditorProps {
  userId: string;
  imageUrl: string;
  currentAvatarUrl?: string | null;
  onPositionSaved?: () => void;
  disabled?: boolean;
}

export const InteractiveAvatarEditor: React.FC<InteractiveAvatarEditorProps> = ({
  userId,
  imageUrl,
  currentAvatarUrl,
  onPositionSaved,
  disabled = false
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [positioning, setPositioning] = useState<AvatarPositioning>({
    x: 0.5,
    y: 0.5,
    zoom: 1.0
  });

  const [originalPositioning, setOriginalPositioning] = useState<AvatarPositioning>({
    x: 0.5,
    y: 0.5,
    zoom: 1.0
  });

  // Load current positioning from server
  useEffect(() => {
    const loadCurrentPositioning = async () => {
      try {
        const response = await apiClient.get(`/users/${userId}/avatar/position`);
        if (response.success) {
          const pos = response.data.positioning;
          setPositioning(pos);
          setOriginalPositioning(pos);
        }
      } catch (error) {
        // If no positioning data exists, use defaults
        console.log('No existing positioning data, using defaults');
      }
    };

    loadCurrentPositioning();
  }, [userId]);

  // Track changes
  useEffect(() => {
    const hasChanges =
      positioning.x !== originalPositioning.x ||
      positioning.y !== originalPositioning.y ||
      positioning.zoom !== originalPositioning.zoom;

    setHasUnsavedChanges(hasChanges);
  }, [positioning, originalPositioning]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
  }, [disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current || disabled) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerSize = Math.min(rect.width, rect.height);

    // Calculate relative position within the circular container
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const relativeX = (e.clientX - centerX) / (containerSize / 2);
    const relativeY = (e.clientY - centerY) / (containerSize / 2);

    // Convert to 0-1 positioning coordinates
    const newX = Math.max(0, Math.min(1, (relativeX + 1) / 2));
    const newY = Math.max(0, Math.min(1, (relativeY + 1) / 2));

    setPositioning(prev => ({
      ...prev,
      x: newX,
      y: newY
    }));
  }, [isDragging, disabled]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleZoomChange = (value: number[]) => {
    if (disabled) return;
    setPositioning(prev => ({ ...prev, zoom: value[0] }));
  };

  const handleReset = () => {
    if (disabled) return;
    setPositioning({ x: 0.5, y: 0.5, zoom: 1.0 });
  };

  const handleSavePosition = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      const response = await apiClient.put(`/users/${userId}/avatar/position`, {
        x: positioning.x,
        y: positioning.y,
        zoom: positioning.zoom
      });

      if (response.success) {
        setOriginalPositioning(positioning);
        setHasUnsavedChanges(false);

        toast({
          title: "Avatar positioning saved",
          description: "Your avatar position has been updated successfully.",
          duration: 3000,
        });

        onPositionSaved?.();
      } else {
        throw new Error(response.data?.error?.message || 'Failed to save positioning');
      }
    } catch (error: any) {
      console.error('SaveIcon positioning error:', error);
      toast({
        title: "SaveIcon failed",
        description: error.message || "Failed to save avatar positioning. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const imageStyle = {
    transform: `scale(${positioning.zoom}) translate(${(positioning.x - 0.5) * 100}%, ${(positioning.y - 0.5) * 100}%)`,
    transformOrigin: 'center center',
  };

  return (
    <div className="space-y-6">
      {/* Interactive Avatar Preview */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MoveIcon className="h-4 w-4" />
              <span>Click and drag to position your avatar in the circle</span>
            </div>

            {/* Circular Avatar Container */}
            <div className="flex justify-center">
              <div
                ref={containerRef}
                className={`relative w-48 h-48 rounded-full overflow-hidden border-4 border-primary/20 bg-muted/30 cursor-${isDragging ? 'grabbing' : 'grab'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                onMouseDown={handleMouseDown}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Avatar preview"
                  className="w-full h-full object-cover transition-transform duration-75"
                  style={imageStyle}
                  draggable={false}
                />

                {/* Overlay when dragging */}
                {isDragging && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <MoveIcon className="h-8 w-8 text-primary/60" />
                  </div>
                )}
              </div>
            </div>

            {/* Zoom Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Zoom Level</label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ZoomOutIcon className="h-4 w-4" />
                  <span>{positioning.zoom.toFixed(1)}x</span>
                  <ZoomInIcon className="h-4 w-4" />
                </div>
              </div>
              <Slider
                value={[positioning.zoom]}
                onValueChange={handleZoomChange}
                min={0.1}
                max={3.0}
                step={0.1}
                disabled={disabled}
                className="w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-4 pt-4 border-t">
              {/* Status Messages */}
              <div className="flex justify-center">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <div className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                    <span className="text-sm font-medium">Unsaved changes</span>
                  </div>
                )}
                {!hasUnsavedChanges && originalPositioning.x !== 0.5 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircleIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Position saved</span>
                  </div>
                )}
              </div>

              {/* Buttons - Responsive Layout */}
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={disabled || isLoading}
                  className="flex-1 sm:flex-none sm:min-w-24"
                >
                  <RotateCcwIcon className="mr-2 h-4 w-4" />
                  Reset
                </Button>

                <Button
                  type="button"
                  onClick={handleSavePosition}
                  disabled={disabled || isLoading}
                  className="flex-1 sm:flex-none sm:min-w-32"
                >
                  {isLoading ? (
                    <>
                      <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <SaveIcon className="mr-2 h-4 w-4" />
                      Save Position
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InteractiveAvatarEditor;