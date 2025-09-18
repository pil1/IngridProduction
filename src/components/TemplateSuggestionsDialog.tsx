"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2, Sparkles, PlusCircle } from "lucide-react";

export interface TemplateSuggestion {
  name: string;
  subject: string;
  body: string;
}

interface TemplateSuggestionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSuggestion: (suggestion: TemplateSuggestion) => void;
  companyId: string; // Add companyId prop
}

const TemplateSuggestionsDialog = ({ isOpen, onOpenChange, onSelectSuggestion, companyId }: TemplateSuggestionsDialogProps) => {
  const { profile, isLoading: isLoadingSession } = useSession();

  // Updated the generic type of useMutation to match the Edge Function's response
  const { mutate: getSuggestions, data, isPending, error } = useMutation<{ suggestions: TemplateSuggestion[] }>({
    mutationFn: async () => {
      if (!companyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only get suggestions for their own company
      if (profile?.role === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only get template suggestions for your own company.");
      }

      const { data, error } = await supabase.functions.invoke("suggest-email-templates", {
        body: { companyId: companyId }, // Use the passed companyId
      });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isOpen && companyId && !isLoadingSession) { // Only fetch if dialog is open and companyId is available
      getSuggestions();
    }
  }, [isOpen, companyId, getSuggestions, isLoadingSession]);

  // Access the suggestions array from the data object
  const suggestions = data?.suggestions;

  if (isLoadingSession) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <div className="flex justify-center items-center gap-2 py-8">
            <Loader2 className="h-6 w-6 animate-spin" /> <p>Loading suggestions...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles /> AI-Powered Template Suggestions
          </DialogTitle>
          <DialogDescription>
            Here are a few email templates drafted by AI based on your company's needs. Click "Create" to use one as a starting point.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isPending && <div className="flex justify-center items-center gap-2"><Loader2 className="h-6 w-6 animate-spin" /> <p>Drafting templates...</p></div>}
          {error && <p className="text-destructive">Error: {error.message}</p>}
          {/* Check if suggestions is an array before mapping */}
          {suggestions && Array.isArray(suggestions) && (
            <div className="grid gap-4 md:grid-cols-2">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                    <p className="text-sm text-muted-foreground pt-1">Subject: {suggestion.subject}</p>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="text-sm border p-2 rounded-md h-32 overflow-y-auto bg-background" dangerouslySetInnerHTML={{ __html: suggestion.body }} />
                  </CardContent>
                  <CardFooter>
                    <Button onClick={() => onSelectSuggestion(suggestion)} className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Create from this suggestion
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
          {suggestions && !Array.isArray(suggestions) && (
            <p className="text-destructive">Error: Invalid suggestions format received from AI.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateSuggestionsDialog;