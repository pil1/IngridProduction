"use client";

import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import AvatarCropDialog from "./AvatarCropDialog"; // Re-import AvatarCropDialog

interface CompanyLogoUploadProps {
  currentLogoUrl?: string | null;
  onFileSelected: (file: File | null) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

const CompanyLogoUpload = ({
  currentLogoUrl,
  onFileSelected,
  isLoading = false,
  disabled = false,
}: CompanyLogoUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null); // Re-added
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false); // Re-added

  useEffect(() => {
    setPreview(currentLogoUrl || null);
  }, [currentLogoUrl]);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      setError(null);
      if (fileRejections.length > 0) {
        setError("Invalid file type or size. Please upload an image (max 2MB).");
        return;
      }
      if (acceptedFiles.length > 0) {
        const selectedFile = acceptedFiles[0];
        if (selectedFile.size > 2 * 1024 * 1024) { // 2MB limit
          setError("File size exceeds 2MB limit.");
          return;
        }
        
        // Open the crop dialog instead of setting the file directly
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          setCropImageSrc(reader.result as string);
          setIsCropDialogOpen(true);
        });
        reader.readAsDataURL(selectedFile);
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.png', '.gif', '.webp'],
    },
    maxFiles: 1,
    disabled: isLoading || disabled,
  });

  const handleCroppedImageSave = (croppedFile: File) => {
    onFileSelected(croppedFile);
    setPreview(URL.createObjectURL(croppedFile));
    setCropImageSrc(null); // Clean up
  };

  const handleClearFile = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onFileSelected(null);
    setPreview(currentLogoUrl || null); // Revert to current URL or null
    setError(null);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <div
          {...getRootProps()}
          className={cn(
            "relative flex items-center justify-center h-24 w-24 rounded-full border-2 border-dashed transition-colors",
            "hover:border-primary hover:bg-muted/50",
            isDragActive && "border-primary bg-muted/50",
            (isLoading || disabled) && "opacity-70 cursor-not-allowed",
            error && "border-destructive",
            "cursor-pointer"
          )}
        >
          <input {...getInputProps()} />
          <Avatar className="h-20 w-20">
            <AvatarImage src={preview || undefined} alt="Company Logo Preview" className="object-contain" />
            <AvatarFallback className="bg-muted-foreground/20">
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <Building className="h-8 w-8 text-muted-foreground" />
              )}
            </AvatarFallback>
          </Avatar>
          {!isLoading && preview && preview !== currentLogoUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearFile}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background/80 hover:bg-background"
            >
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="sr-only">Clear image</span>
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <p className="text-xs text-muted-foreground text-center">
          Drag & drop or click to upload logo (max 2MB)
        </p>
      </div>
      <AvatarCropDialog
        isOpen={isCropDialogOpen}
        onOpenChange={setIsCropDialogOpen}
        imageSrc={cropImageSrc}
        onSave={handleCroppedImageSave}
      />
    </>
  );
};

export default CompanyLogoUpload;