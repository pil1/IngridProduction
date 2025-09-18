"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query"; // Import useQuery
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2, Sparkles, PlusCircle } from "lucide-react";

export interface TemplateSuggestion {
  name: string;
  subject: string;
  body: string;
}

interface SystemEmailLayout {
  id: string;
  header_html: string | null;
  footer_html: string | null;
  default_logo_url: string | null;
  default_company_name: string | null;
  default_logo_width: number | null;
  default_logo_height: number | null;
  updated_at: string;
}

interface SystemTemplateSuggestionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSuggestion: (suggestion: TemplateSuggestion) => void;
}

const SystemTemplateSuggestionsDialog = ({ isOpen, onOpenChange, onSelectSuggestion }: SystemTemplateSuggestionsDialogProps) => {
  const { profile, isLoading: isLoadingSession } = useSession();

  const isSuperAdmin = profile?.role === 'super-admin';

  // Fetch System Email Layout for AI context
  const { data: systemLayout, isLoading: isLoadingLayout } = useQuery<SystemEmailLayout | null>({
    queryKey: ["systemEmailLayoutForSuggestions"],
    queryFn: async () => {
      if (!isSuperAdmin) return null;
      const { data, error } = await supabase.functions.invoke('upsert-system-email-layout', { method: 'GET' });
      if (error) throw error;
      return data.data;
    },
    enabled: isSuperAdmin,
  });

  const { mutate: getSuggestions, data, isPending, error } = useMutation<{ suggestions: TemplateSuggestion[] }>({
    mutationFn: async () => {
      if (!isSuperAdmin) {
        throw new Error("Access Denied: Only Super Admins can get system template suggestions.");
      }

      const { data, error } = await supabase.functions.invoke("suggest-system-email-templates", {
        body: {
          systemLayout: systemLayout, // Pass the fetched system layout
        },
      });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isOpen && !isLoadingSession && isSuperAdmin && !isLoadingLayout) { // Ensure layout is loaded
      getSuggestions();
    }
  }, [isOpen, getSuggestions, isLoadingSession, isSuperAdmin, isLoadingLayout, systemLayout]);

  const suggestions = data?.suggestions;

  if (isLoadingSession || isLoadingLayout) { // Include isLoadingLayout here
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
            <Sparkles /> AI-Powered System Template Suggestions
          </DialogTitle>
          <DialogDescription>
            Here are a few system email templates drafted by AI. Click "Create" to use one as a starting point.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isPending && <div className="flex justify-center items-center gap-2"><Loader2 className="h-6 w-6 animate-spin" /> <p>Drafting templates...</p></div>}
          {error && <p className="text-destructive">Error: {error.message}</p>}
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

export default SystemTemplateSuggestionsDialog;