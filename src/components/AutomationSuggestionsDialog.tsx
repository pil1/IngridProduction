"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2, Sparkles, PlusCircle } from "lucide-react";
import { Suggestion } from "@/lib/automations";

interface AutomationSuggestionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  companyId: string; // Add companyId prop
}

const AutomationSuggestionsDialog = ({ isOpen, onOpenChange, onSelectSuggestion, companyId }: AutomationSuggestionsDialogProps) => {
  const { profile, isLoading: isLoadingSession } = useSession();

  const { mutate: getSuggestions, data: suggestions, isPending, error } = useMutation<Suggestion[]>({
    mutationFn: async () => {
      if (!companyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only get suggestions for their own company
      if (profile?.role === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only get automation suggestions for your own company.");
      }

      const { data, error } = await supabase.functions.invoke("suggest-automations", {
        body: { companyId: companyId }, // Use the passed companyId
      });
      if (error) throw error;
      return data.suggestions ?? [];
    },
  });

  useEffect(() => {
    if (isOpen && companyId && !isLoadingSession) { // Only fetch if dialog is open and companyId is available
      getSuggestions();
    }
  }, [isOpen, companyId, getSuggestions, isLoadingSession]);

  if (isLoadingSession) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex justify-center items-center gap-2 py-8">
            <Loader2 className="h-6 w-6 animate-spin" /> <p>Loading suggestions...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles /> AI-Powered Automation Suggestions
          </DialogTitle>
          <DialogDescription>
            Here are a few ideas for automations based on your company's data. Click "Create" to get started with one.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isPending && <div className="flex justify-center items-center gap-2"><Loader2 className="h-6 w-6 animate-spin" /> <p>Generating ideas...</p></div>}
          {error && <p className="text-destructive">Error: {error.message}</p>}
          {suggestions && (
            <div className="grid gap-4 md:grid-cols-2">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => onSelectSuggestion(suggestion)} className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Create
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AutomationSuggestionsDialog;