"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Lightbulb } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { AutomationFormValues } from "./AddEditAutomationDialog"; // Import the form values type

interface AutomationDescriptionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAutomationGenerated: (automation: Partial<AutomationFormValues> & { warning?: string }) => void;
  companyId: string;
}

const AutomationDescriptionDialog = ({ isOpen, onOpenChange, onAutomationGenerated, companyId }: AutomationDescriptionDialogProps) => {
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;

  const generateAutomationMutation = useMutation({
    mutationFn: async (userDescription: string) => {
      if (!companyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only generate automations for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only generate automations for your own company.");
      }

      const { data, error } = await supabase.functions.invoke("describe-automation", {
        body: {
          companyId: companyId,
          userDescription: userDescription,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.automation) {
        onAutomationGenerated(data.automation);
        toast({
          title: "Automation Drafted",
          description: data.message || "AI has drafted an automation based on your description. Please review.",
        });
        onOpenChange(false);
        setDescription("");
      } else {
        toast({
          title: "Could Not Draft Automation",
          description: data.message || "AI could not generate a suitable automation. Please try a different description.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error generating automation",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!description.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe the automation you want to create.",
        variant: "destructive",
      });
      return;
    }
    generateAutomationMutation.mutate(description);
  };

  const isLoading = isLoadingSession || generateAutomationMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Describe Automation with AI
          </DialogTitle>
          <DialogDescription>
            Tell AI what kind of automation you want to create in plain language.
            For example: "Email an order summary to management every day at 7am" or "Notify me when an expense is rejected."
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="automation-description" className="flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Your Automation Idea
            </Label>
            <Textarea
              id="automation-description"
              placeholder="e.g., 'Generate a monthly AR aging report and send it to finance@example.com on the 5th of each month at 9 AM.'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isLoading || !description.trim()}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Automation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutomationDescriptionDialog;