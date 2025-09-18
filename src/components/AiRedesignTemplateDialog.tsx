"use client";

import { useState } from "react"; // Removed unused useEffect
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Lightbulb } from "lucide-react";
import RichTextEditor from "./RichTextEditor"; // Import RichTextEditor
import { Input } from "@/components/ui/input"; // Added missing Input import

interface AiRedesignTemplateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentTemplate: {
    id: string;
    name: string;
    subject: string;
    body: string;
  };
  onRedesignComplete: (newSubject: string, newBody: string) => void;
  isSystemTemplate: boolean; // To differentiate between system and company templates
  companyId?: string; // Optional for company templates
}

const AiRedesignTemplateDialog = ({
  isOpen,
  onOpenChange,
  currentTemplate,
  onRedesignComplete,
  isSystemTemplate,
  companyId,
}: AiRedesignTemplateDialogProps) => {
  const [userInstructions, setUserInstructions] = useState("");
  const { toast } = useToast();

  const redesignMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("redesign-email-template", {
        body: {
          templateId: currentTemplate.id,
          currentSubject: currentTemplate.subject,
          currentBody: currentTemplate.body,
          userInstructions: userInstructions,
          isSystemTemplate: isSystemTemplate,
          companyId: companyId,
        },
      });

      if (error) throw error;
      return data.redesignedTemplate;
    },
    onSuccess: (data) => {
      onRedesignComplete(data.subject, data.body);
      toast({
        title: "Template Redesigned",
        description: "AI has generated a new design for your template. Please review.",
      });
      onOpenChange(false);
      setUserInstructions(""); // Clear instructions
    },
    onError: (error: any) => {
      toast({
        title: "Error Redesigning Template",
        description: error.message || "An unexpected error occurred during AI redesign.",
        variant: "destructive",
      });
    },
  });

  const handleRedesign = () => {
    redesignMutation.mutate();
  };

  const isLoading = redesignMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> AI Redesign: {currentTemplate.name}
          </DialogTitle>
          <DialogDescription>
            Let AI help you redesign this email template. Provide instructions below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="current-subject">Current Subject</Label>
            <Input id="current-subject" value={currentTemplate.subject} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-body">Current Body (Preview)</Label>
            <RichTextEditor
              value={currentTemplate.body}
              onChange={() => {}} // Read-only
              readOnly
              disabled
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="redesign-instructions" className="flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Redesign Instructions (Optional)
            </Label>
            <Textarea
              id="redesign-instructions"
              placeholder="e.g., 'Make it more concise and formal', 'Add a strong call to action for expense submission', 'Change the tone to be more friendly.'"
              value={userInstructions}
              onChange={(e) => setUserInstructions(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleRedesign} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Redesign Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AiRedesignTemplateDialog;