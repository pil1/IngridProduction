"use client";

import { useState, useEffect, useCallback } from "react"; // Removed useRef
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import Cropper from "react-easy-crop"; // Import Cropper from react-easy-crop

interface AvatarCropDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  onSave: (croppedImageFile: File) => void;
}

// Helper function to create a cropped image file from the canvas
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // Needed for cross-origin images
    image.src = url;
  });

async function getCroppedImgFile(imageSrc: string, pixelCrop: Record<string, unknown>, fileName: string): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2D context available for canvas.");
  }

  const outputSize = 256; // Fixed size for the avatar output

  // Set canvas size to the desired output size
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Calculate scale factor to fit the cropped area into the output canvas
  const scaleX = outputSize / pixelCrop.width;
  const scaleY = outputSize / pixelCrop.height;
  const scaleFactor = Math.min(scaleX, scaleY); // Use min to ensure the entire crop fits

  // Calculate new dimensions for drawing the cropped image onto the output canvas
  const drawWidth = pixelCrop.width * scaleFactor;
  const drawHeight = pixelCrop.height * scaleFactor;

  // Calculate position to center the drawn image on the output canvas
  const dx = (outputSize - drawWidth) / 2;
  const dy = (outputSize - drawHeight) / 2;

  // Draw the cropped portion of the image onto the canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    dx,
    dy,
    drawWidth,
    drawHeight
  );

  // Apply a circular mask
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas is empty"));
        return;
      }
      const file = new File([blob], fileName, { type: "image/png" });
      resolve(file);
    }, "image/png");
  });
}

const AvatarCropDialog = ({ isOpen, onOpenChange, imageSrc, onSave }: AvatarCropDialogProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Reset state when dialog opens with a new image
  useEffect(() => {
    if (isOpen && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [isOpen, imageSrc]);

  const onCropComplete = useCallback((_croppedArea: Record<string, unknown>, croppedAreaPixels: Record<string, unknown>) => { // Renamed to _croppedArea
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (imageSrc && croppedAreaPixels) {
      try {
        const croppedImageFile = await getCroppedImgFile(
          imageSrc,
          croppedAreaPixels,
          "avatar.png"
        );
        onSave(croppedImageFile);
        onOpenChange(false);
      } catch (e) {
        console.error("Error creating cropped image file:", e);
      }
    }
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crop your new avatar</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border border-gray-300 dark:border-gray-700">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1} // Square aspect ratio for avatar
              cropShape="round" // Circular crop shape
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
              restrictPosition={true}
              minZoom={1} // Ensure the image always covers the crop area
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="zoom">Zoom</label>
            <Slider
              id="zoom"
              min={1} // Minimum zoom is 1 to ensure it always covers the circle
              max={3}
              step={0.05}
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;