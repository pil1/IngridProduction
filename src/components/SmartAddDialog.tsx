"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Lightbulb, Upload, FileText, X } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { Separator } from "@/components/ui/separator";

interface SmartAddDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalyzeSuccess: (data: any) => void; // Callback with extracted data
  entityType: 'customer' | 'vendor'; // To specify the type of entity being added
}

const SmartAddDialog = ({ isOpen, onOpenChange, onAnalyzeSuccess, entityType }: SmartAddDialogProps) => {
  const [inputText, setInputText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;

  const analyzeTextMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
        throw new Error("Access Denied: You do not have permission to use Smart Add.");
      }

      const { data, error } = await supabase.functions.invoke("smart-add-analysis", {
        body: { user_input: text, entity_type: entityType },
      });

      if (error) throw error;
      return data.data;
    },
    onSuccess: (data) => {
      if (typeof data === 'object' && data !== null && Object.keys(data).length > 0) {
        onAnalyzeSuccess(data);
        toast({
          title: "Analysis Complete",
          description: "AI has extracted details. Please review and save.",
        });
        onOpenChange(false); // Close this dialog
        setInputText(""); // Clear input
        setUploadedFile(null); // Clear file
      } else {
        toast({
          title: "No Data Extracted",
          description: "AI could not find relevant information. Please try a different input or add manually.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Error",
        description: error.message || "An unexpected error occurred during AI analysis.",
        variant: "destructive",
      });
    },
  });

  const analyzeFileMutation = useMutation({
    mutationFn: async ({ file, text }: { file: File, text: string }) => {
      if (!userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
        throw new Error("Access Denied: You do not have permission to use Smart Add.");
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);

      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          const base64 = reader.result?.toString().split(',')[1];
          if (!base64) {
            return reject(new Error("Failed to read file as Base64."));
          }

          try {
            let edgeFunctionToCall = "";
            if (entityType === 'vendor') {
              edgeFunctionToCall = "analyze-vendor-invoice";
            } else if (entityType === 'customer') {
              edgeFunctionToCall = "analyze-customer-contact";
            } else {
              return reject(new Error("Invalid entity type for file analysis."));
            }

            const { data, error } = await supabase.functions.invoke(edgeFunctionToCall, {
              body: { fileBase64: base64, mimeType: file.type, user_text_input: text },
            });

            if (error) return reject(error);
            resolve(data.data);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = (error) => reject(error);
      });
    },
    onSuccess: (data) => {
      if (typeof data === 'object' && data !== null && Object.keys(data).length > 0) {
        onAnalyzeSuccess(data);
        toast({
          title: "File Analysis Complete",
          description: "AI has extracted details from the file. Please review and save.",
        });
        onOpenChange(false); // Close this dialog
        setInputText(""); // Clear input
        setUploadedFile(null); // Clear file
      } else {
        toast({
          title: "No Data Extracted from File",
          description: "AI could not find relevant information in the file. Please try a different file or add manually.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "File Analysis Error",
        description: error.message || "An unexpected error occurred during file analysis.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit for files
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    setInputText(""); // Clear text input if file is selected
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = () => {
    if (uploadedFile && inputText.trim()) {
      analyzeFileMutation.mutate({ file: uploadedFile, text: inputText });
    } else if (uploadedFile) {
      analyzeFileMutation.mutate({ file: uploadedFile, text: "" }); // Pass empty text if only file
    } else if (inputText.trim()) {
      analyzeTextMutation.mutate(inputText);
    } else {
      toast({
        title: "Input Required",
        description: "Please provide some text or upload a file to analyze.",
        variant: "destructive",
      });
    }
  };

  const isLoading = isLoadingSession || analyzeTextMutation.isPending || analyzeFileMutation.isPending;

  const customerPlaceholderText = "Tip: try copy/pasting the email signature from the customer! Or upload a vCard or business card image. Paste details like 'Acme Corp, John Doe, info@acmecorp.com, 123 Main St, Anytown, USA, Phone: +1-555-123-4567'";
  const vendorPlaceholderText = "e.g., 'Global Supplies Ltd., Jane Doe (Contact), jane@globalsupplies.com, 456 Industrial Ave, City, State, 12345, Phone: 555-987-6543, Website: https://globalsupplies.com, Payment Terms: Net 30'";

  const fileInputAccept = entityType === 'customer'
    ? "image/*,application/vcard,.vcf"
    : "image/*,application/pdf";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Smart Add {entityType === 'customer' ? 'Customer' : 'Vendor'}
          </DialogTitle>
          <DialogDescription>
            Paste text details or upload a file. AI will analyze and pre-fill the form.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Text Input Section */}
          <div className="space-y-2">
            <Label htmlFor="smart-add-input" className="flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              {entityType === 'customer' ? 'Customer Details (Text)' : 'Vendor Details (Text)'}
            </Label>
            <Textarea
              id="smart-add-input"
              placeholder={entityType === 'customer' ? customerPlaceholderText : vendorPlaceholderText}
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); }}
              rows={7}
              disabled={isLoading}
            />
          </div>

          <Separator orientation="horizontal" className="my-4" />

          {/* File Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="file-upload" className="flex items-center gap-1">
              <Upload className="h-4 w-4 text-blue-500" />
              {entityType === 'customer' ? 'Upload vCard or Business Card Image' : 'Upload Invoice (Image or PDF)'}
            </Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={fileInputAccept}
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading}
              />
              {uploadedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {uploadedFile.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAnalyze} disabled={isLoading || (!inputText.trim() && !uploadedFile)}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Analyze & Pre-fill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SmartAddDialog;