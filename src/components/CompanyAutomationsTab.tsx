"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Sparkles, Loader2, Edit, Trash2, Mail, Bell, Lightbulb } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useToast } from "@/hooks/use-toast";
import AddEditAutomationDialog, { AutomationFormValues } from "./AddEditAutomationDialog";
import AutomationSuggestionsDialog from "./AutomationSuggestionsDialog";
import AutomationDescriptionDialog from "./AutomationDescriptionDialog"; // Import new dialog
import { Suggestion } from "@/lib/automations";

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  is_active: boolean;
  action_config: {
    channels?: string[];
  };
}

interface CompanyAutomationsTabProps {
  companyId: string; // Add companyId prop
}

const CompanyAutomationsTab = ({ companyId }: CompanyAutomationsTabProps) => {
  const { profile, isLoading: isLoadingSession } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isDescriptionDialogOpen, setIsDescriptionDialogOpen] = useState(false); // New state for description dialog
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [suggestionToCreate, setSuggestionToCreate] = useState<Suggestion | null>(null);
  const [aiGeneratedAutomation, setAiGeneratedAutomation] = useState<Partial<AutomationFormValues> | null>(null); // New state for AI-generated automation

  const userRole = profile?.role;

  const { data: automations, isLoading } = useQuery<Automation[]>({
    queryKey: ["automations", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("automations")
        .select("*, action_config")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isLoadingSession,
  });

  const { data: availableTriggers } = useQuery({
    queryKey: ['availableTriggers', companyId],
    queryFn: async () => {
        if (!companyId) return [];
        const { data: enabledModules, error: modulesError } = await supabase
            .from('company_modules')
            .select('module_id')
            .eq('company_id', companyId)
            .eq('is_enabled', true);
        if (modulesError) throw modulesError;
        if (!enabledModules || enabledModules.length === 0) return [];
        const moduleIds = enabledModules.map(m => m.module_id);
        const { data: triggers, error: triggersError } = await supabase
            .from('module_triggers')
            .select('trigger_name, label')
            .in('module_id', moduleIds);
        if (triggersError) throw triggersError;
        return triggers.map(t => ({ value: t.trigger_name, label: t.label }));
    },
    enabled: !!companyId && !isLoadingSession,
  });

  const updateAutomationStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!companyId) throw new Error("Company not identified.");

      // Authorization check: Admins can only update automations for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only update automations for your own company.");
      }

      const { error } = await supabase.from("automations").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", companyId] });
      toast({ title: "Automation status updated." });
    },
    onError: (error: unknown) => {
      toast({ title: "Error updating status", description: error instanceof Error ? error.message : "An unexpected error occurred.", variant: "destructive" });
    },
  });

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setSuggestionToCreate(null);
    setAiGeneratedAutomation(null);
    setIsAddEditDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setSuggestionToCreate(null);
    setAiGeneratedAutomation(null);
    setIsAddEditDialogOpen(true);
  };

  const handleCreateFromSuggestion = (suggestion: Suggestion) => {
    setSuggestionToCreate(suggestion);
    setEditingAutomation(null);
    setAiGeneratedAutomation(null);
    setIsAddEditDialogOpen(true);
    setIsSuggestionsOpen(false);
  };

  const handleAiGeneratedAutomation = (automation: Partial<AutomationFormValues> & { warning?: string }) => {
    setAiGeneratedAutomation(automation);
    setEditingAutomation(null);
    setSuggestionToCreate(null);
    setIsAddEditDialogOpen(true);
    setIsDescriptionDialogOpen(false);
  };

  const getTriggerLabel = (value: string) => {
    return availableTriggers?.find(t => t.value === value)?.label ?? value;
  };

  const canManageAutomations = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  if (isLoadingSession || isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!canManageAutomations) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage these automations.</p>
      </div>
    );
  }

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle>Automated Notifications</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsDescriptionDialogOpen(true)}> {/* New button */}
              <Lightbulb className="mr-2 h-4 w-4" /> Describe Automation
            </Button>
            <Button variant="outline" onClick={() => setIsSuggestionsOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" /> Suggest Automations
            </Button>
            <Button onClick={handleCreate}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Automation
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {automations?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center">No automations created yet.</TableCell></TableRow>
                ) : (
                  automations?.map((automation) => (
                    <TableRow key={automation.id}>
                      <TableCell className="font-medium">{automation.name}</TableCell>
                      <TableCell><Badge variant="secondary">{getTriggerLabel(automation.trigger_type)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {automation.action_config?.channels?.includes('in_app') && <Badge variant="outline" className="flex items-center gap-1"><Bell className="h-3 w-3" /> In-App</Badge>}
                          {automation.action_config?.channels?.includes('email') && <Badge variant="outline" className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={automation.is_active}
                          onCheckedChange={(checked) => updateAutomationStatus.mutate({ id: automation.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(automation)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" disabled><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddEditAutomationDialog
        isOpen={isAddEditDialogOpen}
        onOpenChange={setIsAddEditDialogOpen}
        editingAutomation={editingAutomation}
        suggestion={suggestionToCreate}
        aiGeneratedAutomation={aiGeneratedAutomation} // Pass AI-generated automation
        companyId={companyId} // Pass companyId to dialog
      />
      
      <AutomationSuggestionsDialog
        isOpen={isSuggestionsOpen}
        onOpenChange={setIsSuggestionsOpen}
        onSelectSuggestion={handleCreateFromSuggestion}
        companyId={companyId} // Pass companyId to dialog
      />

      <AutomationDescriptionDialog
        isOpen={isDescriptionDialogOpen}
        onOpenChange={setIsDescriptionDialogOpen}
        onAutomationGenerated={handleAiGeneratedAutomation}
        companyId={companyId}
      />
    </>
  );
};

export default CompanyAutomationsTab;