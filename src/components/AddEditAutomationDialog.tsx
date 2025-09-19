"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { ACTION_TYPES, RECIPIENT_TYPES, TRIGGER_TYPES, Suggestion } from "@/lib/automations"; // Import TRIGGER_TYPES
import { showWarning } from "@/utils/toast"; // Import showWarning

const automationSchema = z.object({
  name: z.string().min(1, "Automation name is required"),
  description: z.string().optional(),
  trigger_type: z.string().min(1, "Trigger is required"),
  action_type: z.string().min(1, "Action is required"),
  // Conditional fields based on action_type
  action_template_id: z.string().optional(), // Optional for generate_report
  action_recipient: z.string().optional(), // Optional for generate_report
  specific_email_recipient: z.string().email("Invalid email address").optional().nullable(), // For specific email recipient
  report_type: z.string().optional(), // For generate_report
  report_format: z.string().optional(), // For generate_report
  channels: z.array(z.string()).nonempty({ message: "Please select at least one notification channel." }),
  is_active: z.boolean().default(true),
  // New fields for scheduled triggers
  schedule_time: z.string().optional().nullable(), // e.g., "07:00"
  schedule_day_of_week: z.string().optional().nullable(), // e.g., "Monday" for weekly
  schedule_day_of_month: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(1).max(31).optional().nullable() // e.g., 15 for monthly
  ),
});

export type AutomationFormValues = z.infer<typeof automationSchema>; // Export for use in AutomationDescriptionDialog

interface AddEditAutomationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingAutomation?: { id: string, action_config?: { channels?: string[], template_id?: string, recipient?: string, report_type?: string, report_format?: string, specific_email_recipient?: string }, trigger_type?: string, name?: string, description?: string, is_active?: boolean, schedule_config?: { time?: string, day_of_week?: string, day_of_month?: number } } | null;
  suggestion?: Suggestion | null;
  aiGeneratedAutomation?: (Partial<AutomationFormValues> & { warning?: string }) | null; // Updated type
  companyId: string; // Add companyId prop
}

const AddEditAutomationDialog = ({ isOpen, onOpenChange, editingAutomation, suggestion, aiGeneratedAutomation, companyId }: AddEditAutomationDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, user, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;

  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger_type: "",
      action_type: "send_email",
      action_template_id: "",
      action_recipient: "user",
      specific_email_recipient: "",
      report_type: "",
      report_format: "PDF",
      channels: ["in_app", "email"],
      is_active: true,
      schedule_time: "09:00", // Default time
      schedule_day_of_week: "Monday", // Default day for weekly
      schedule_day_of_month: 1, // Default day for monthly
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["companyEmailTemplates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("company_email_templates").select("id, name").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isLoadingSession,
  });

  const { data: availableTriggers, isLoading: isLoadingTriggers } = useQuery({
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

        // Combine static triggers with dynamic module triggers
        const staticTriggers = TRIGGER_TYPES.filter(t => t.value.startsWith('schedule.')); // Filter for scheduled triggers
        return [...staticTriggers, ...triggers.map(t => ({ value: t.trigger_name, label: t.label }))];
    },
    enabled: !!companyId && !isLoadingSession,
  });

  const upsertAutomation = useMutation({
    mutationFn: async (values: AutomationFormValues) => {
      if (!companyId || !user?.id) throw new Error("User or company not found.");

      // Authorization check: Admins can only manage automations for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage automations for your own company.");
      }
      
      const payload = {
        company_id: companyId,
        created_by: user.id,
        name: values.name,
        description: values.description,
        trigger_type: values.trigger_type,
        trigger_config: {}, // For future use (e.g., schedule details)
        action_type: values.action_type,
        action_config: {
          channels: values.channels,
          ...(values.action_type === 'send_email' && {
            template_id: values.action_template_id,
            recipient: values.action_recipient,
            specific_email_recipient: values.action_recipient === 'specific_email' ? values.specific_email_recipient : null,
          }),
          ...(values.action_type === 'generate_report' && {
            report_type: values.report_type,
            report_format: values.report_format,
            recipient: values.action_recipient, // Report recipient
            specific_email_recipient: values.action_recipient === 'specific_email' ? values.specific_email_recipient : null,
          }),
        },
        is_active: values.is_active,
        // Add schedule_config based on trigger type
        schedule_config: values.trigger_type.startsWith('schedule.') ? {
          time: values.schedule_time,
          day_of_week: values.trigger_type === 'schedule.weekly' ? values.schedule_day_of_week : null,
          day_of_month: values.trigger_type === 'schedule.monthly' ? values.schedule_day_of_month : null,
        } : null,
      };

      const { error } = await supabase.from("automations").upsert(editingAutomation ? { ...payload, id: editingAutomation.id } : payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", companyId] });
      toast({ title: "Automation Saved", description: "Your automation has been successfully saved." });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error Saving Automation", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (editingAutomation) {
        form.reset({
          name: editingAutomation.name,
          description: editingAutomation.description ?? "",
          trigger_type: editingAutomation.trigger_type ?? "",
          action_type: "send_email", // Default for now, will need to be dynamic
          action_template_id: editingAutomation.action_config?.template_id ?? "",
          action_recipient: editingAutomation.action_config?.recipient ?? "user",
          specific_email_recipient: editingAutomation.action_config?.specific_email_recipient ?? "",
          report_type: editingAutomation.action_config?.report_type ?? "",
          report_format: editingAutomation.action_config?.report_format ?? "PDF",
          channels: editingAutomation.action_config?.channels ?? ["in_app", "email"],
          is_active: editingAutomation.is_active ?? true,
          schedule_time: editingAutomation.schedule_config?.time ?? "09:00",
          schedule_day_of_week: editingAutomation.schedule_config?.day_of_week ?? "Monday",
          schedule_day_of_month: editingAutomation.schedule_config?.day_of_month ?? 1,
        });
      } else if (suggestion) {
        form.reset({
          name: suggestion.name,
          description: suggestion.description,
          trigger_type: suggestion.trigger_type,
          action_type: "send_email",
          action_template_id: "",
          action_recipient: "user",
          specific_email_recipient: "",
          report_type: "",
          report_format: "PDF",
          channels: ["in_app", "email"],
          is_active: true,
          schedule_time: "09:00",
          schedule_day_of_week: "Monday",
          schedule_day_of_month: 1,
        });
      } else if (aiGeneratedAutomation) { // Handle AI-generated automation
        form.reset({
          name: aiGeneratedAutomation.name ?? "",
          description: aiGeneratedAutomation.description ?? "",
          trigger_type: aiGeneratedAutomation.trigger_type ?? "",
          action_type: aiGeneratedAutomation.action_type ?? "send_email",
          action_template_id: aiGeneratedAutomation.action_template_id ?? "",
          action_recipient: aiGeneratedAutomation.action_recipient ?? "user",
          specific_email_recipient: aiGeneratedAutomation.specific_email_recipient ?? "",
          report_type: aiGeneratedAutomation.report_type ?? "",
          report_format: aiGeneratedAutomation.report_format ?? "PDF",
          channels: aiGeneratedAutomation.channels ?? ["in_app", "email"],
          is_active: aiGeneratedAutomation.is_active ?? true,
          schedule_time: aiGeneratedAutomation.schedule_time ?? "09:00",
          schedule_day_of_week: aiGeneratedAutomation.schedule_day_of_week ?? "Monday",
          schedule_day_of_month: aiGeneratedAutomation.schedule_day_of_month ?? 1,
        });
        if (aiGeneratedAutomation.warning) {
          showWarning("AI Warning", aiGeneratedAutomation.warning); // Using new showWarning
        }
      } else {
        form.reset({
          name: "",
          description: "",
          trigger_type: "",
          action_type: "send_email",
          action_template_id: "",
          action_recipient: "user",
          specific_email_recipient: "",
          report_type: "",
          report_format: "PDF",
          channels: ["in_app", "email"],
          is_active: true,
          schedule_time: "09:00",
          schedule_day_of_week: "Monday",
          schedule_day_of_month: 1,
        });
      }
    }
  }, [isOpen, editingAutomation, suggestion, aiGeneratedAutomation, form]);

  const onSubmit = (values: AutomationFormValues) => {
    upsertAutomation.mutate(values);
  };

  const canManageAutomations = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  const selectedActionType = form.watch("action_type");
  const selectedRecipientType = form.watch("action_recipient");
  const selectedTriggerType = form.watch("trigger_type");
  const isScheduledTrigger = selectedTriggerType.startsWith('schedule.');

  if (isLoadingSession) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!canManageAutomations) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access Denied</DialogTitle>
          <DialogDescription>You do not have permission to manage automations for this company.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingAutomation ? "Edit" : "Create"} Automation</DialogTitle>
          <DialogDescription>Set up a trigger and a corresponding action to automate tasks.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Automation Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" {...form.register("description")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trigger_type">When this happens... (Trigger)</Label>
            <Controller
              name="trigger_type"
              control={form.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingTriggers}>
                  <SelectTrigger><SelectValue placeholder={isLoadingTriggers ? "Loading triggers..." : "Select a trigger..."} /></SelectTrigger>
                  <SelectContent>
                    {availableTriggers?.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.trigger_type && <p className="text-sm text-destructive">{form.formState.errors.trigger_type.message}</p>}
          </div>

          {isScheduledTrigger && (
            <div className="space-y-2 border p-4 rounded-md bg-muted/50">
              <h4 className="font-semibold">Schedule Configuration</h4>
              <div className="space-y-2">
                <Label htmlFor="schedule_time">Time of Day</Label>
                <Input id="schedule_time" type="time" {...form.register("schedule_time")} />
                {form.formState.errors.schedule_time && <p className="text-sm text-destructive">{form.formState.errors.schedule_time.message}</p>}
              </div>
              {selectedTriggerType === 'schedule.weekly' && (
                <div className="space-y-2">
                  <Label htmlFor="schedule_day_of_week">Day of Week</Label>
                  <Select onValueChange={(value) => form.setValue("schedule_day_of_week", value)} value={form.watch("schedule_day_of_week") ?? ""}>
                    <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                    <SelectContent>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.schedule_day_of_week && <p className="text-sm text-destructive">{form.formState.errors.schedule_day_of_week.message}</p>}
                </div>
              )}
              {selectedTriggerType === 'schedule.monthly' && (
                <div className="space-y-2">
                  <Label htmlFor="schedule_day_of_month">Day of Month</Label>
                  <Input id="schedule_day_of_month" type="number" min="1" max="31" {...form.register("schedule_day_of_month", { valueAsNumber: true })} />
                  {form.formState.errors.schedule_day_of_month && <p className="text-sm text-destructive">{form.formState.errors.schedule_day_of_month.message}</p>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Do this... (Action)</Label>
            <Controller
              name="action_type"
              control={form.control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select an action..." /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.action_type && <p className="text-sm text-destructive">{form.formState.errors.action_type.message}</p>}
          </div>

          {selectedActionType === 'send_email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="action_template_id">Using this template...</Label>
                <Controller
                  name="action_template_id"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select an email template..." /></SelectTrigger>
                      <SelectContent>
                        {templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.action_template_id && <p className="text-sm text-destructive">{form.formState.errors.action_template_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="action_recipient">Send to...</Label>
                <Controller
                  name="action_recipient"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select a recipient..." /></SelectTrigger>
                      <SelectContent>
                        {RECIPIENT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.action_recipient && <p className="text-sm text-destructive">{form.formState.errors.action_recipient.message}</p>}
              </div>
              {selectedRecipientType === 'specific_email' && (
                <div className="space-y-2">
                  <Label htmlFor="specific_email_recipient">Specific Email Address</Label>
                  <Input id="specific_email_recipient" type="email" {...form.register("specific_email_recipient")} />
                  {form.formState.errors.specific_email_recipient && <p className="text-sm text-destructive">{form.formState.errors.specific_email_recipient.message}</p>}
                </div>
              )}
            </>
          )}

          {selectedActionType === 'generate_report' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="report_type">Report Type</Label>
                <Controller
                  name="report_type"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select report type..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order_summary">Order Summary (Placeholder)</SelectItem>
                        <SelectItem value="ar_aging">AR Aging (Placeholder)</SelectItem>
                        <SelectItem value="ap_aging">AP Aging (Placeholder)</SelectItem>
                        {/* Add more report types as they are built */}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.report_type && <p className="text-sm text-destructive">{form.formState.errors.report_type.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="report_format">Report Format</Label>
                <Controller
                  name="report_format"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select report format..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="CSV">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.report_format && <p className="text-sm text-destructive">{form.formState.errors.report_format.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="action_recipient">Send Report to...</Label>
                <Controller
                  name="action_recipient"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select a recipient..." /></SelectTrigger>
                      <SelectContent>
                        {RECIPIENT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.action_recipient && <p className="text-sm text-destructive">{form.formState.errors.action_recipient.message}</p>}
              </div>
              {selectedRecipientType === 'specific_email' && (
                <div className="space-y-2">
                  <Label htmlFor="specific_email_recipient">Specific Email Address</Label>
                  <Input id="specific_email_recipient" type="email" {...form.register("specific_email_recipient")} />
                  {form.formState.errors.specific_email_recipient && <p className="text-sm text-destructive">{form.formState.errors.specific_email_recipient.message}</p>}
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Deliver Via</Label>
            <Controller
              name="channels"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="channel-in-app"
                      checked={field.value.includes("in_app")}
                      onCheckedChange={(checked) => {
                        const newValue = checked
                          ? [...field.value, "in_app"]
                          : field.value.filter((v) => v !== "in_app");
                        field.onChange(newValue);
                      }}
                    />
                    <Label htmlFor="channel-in-app">In-App Alert</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="channel-email"
                      checked={field.value.includes("email")}
                      onCheckedChange={(checked) => {
                        const newValue = checked
                          ? [...field.value, "email"]
                          : field.value.filter((v) => v !== "email");
                        field.onChange(newValue);
                      }}
                    />
                    <Label htmlFor="channel-email">Email</Label>
                  </div>
                </div>
              )}
            />
            {form.formState.errors.channels && <p className="text-sm text-destructive">{form.formState.errors.channels.message}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <Controller name="is_active" control={form.control} render={({ field }) => <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />} />
            <Label htmlFor="is_active">Enable this automation</Label>
          </div>
          <Button type="submit" disabled={upsertAutomation.isPending}>
            {upsertAutomation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Automation
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditAutomationDialog;