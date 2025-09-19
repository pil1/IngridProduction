"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Added CardDescription
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Sparkles, Variable } from "lucide-react"; // Added Variable icon
import { useSession } from "@/components/SessionContextProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Lazy load RichTextEditor to reduce bundle size
const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));
import mustache from "mustache";
import TemplateSuggestionsDialog, { TemplateSuggestion } from "./TemplateSuggestionsDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select
import AiRedesignTemplateDialog from "@/components/AiRedesignTemplateDialog"; // Import new AI Redesign dialog

const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  description: z.string().optional().nullable(),
});

type EmailTemplateFormValues = z.infer<typeof emailTemplateSchema>;

interface CompanyEmailTemplate {
  id: string;
  company_id: string;
  name: string;
  subject: string;
  body: string;
  description: string | null;
}

interface CompanyEmailTemplatesTabProps {
  companyId: string; // Add companyId prop
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

// Define available company variables with descriptions (subset of system variables)
const AVAILABLE_COMPANY_VARIABLES = [
  { name: "Global: Current Year", variable: "<% year %>", description: "The current year (e.g., 2024)" },
  { name: "Global: Public Web URL", variable: "<% public_web_url %>", description: "The base URL of the application" },
  { name: "Global: Default Logo URL", variable: "<% logo_url %>", description: "The system's default logo image URL" },
  { name: "Global: Default Logo Width", variable: "<% logo_width %>", description: "The system's default logo width in pixels" },
  { name: "Global: Default Logo Height", variable: "<% logo_height %>", description: "The system's default logo height in pixels" },
  { name: "Company: Name", variable: "<% company_name %>", description: "The name of the company" },
  { name: "User: Inviter Name", variable: "<% inviter_name %>", description: "Full name of the user who sent an invitation" },
  { name: "User: Invited Role", variable: "<% invited_role %>", description: "The role assigned to the invited user" },
  { name: "User: Invitation Link", variable: "<% invitation_link %>", description: "The unique link to accept an invitation" },
  { name: "User: New User Name", variable: "<% new_user_name %>", description: "Full name of the newly created user" },
  { name: "User: New User Email", variable: "<% new_user_email %>", description: "Email of the newly created user" },
  { name: "User: Admin Name", variable: "<% admin_name %>", description: "Full name of the administrator" },
  { name: "User: Admin Email", variable: "<% admin_email %>", description: "Email of the administrator" },
  { name: "User: Target User Name", variable: "<% target_user_name %>", description: "Full name of the user whose status/access was updated" },
  { name: "User: Target User Email", variable: "<% target_user_email %>", description: "Email of the user whose status/access was updated" },
  { name: "User: New Status", variable: "<% new_status %>", description: "The new status of a user account (e.g., Active, Inactive)" },
  { name: "User: Users Link", variable: "<% users_link %>", description: "Link to the user management page" },
  { name: "Module: Name", variable: "<% module_name %>", description: "Name of the module (e.g., Expense Management)" },
  { name: "Module: Access Status", variable: "<% access_status %>", description: "Access status of a module (e.g., Enabled, Disabled)" },
  { name: "Module: Modules Link", variable: "<% modules_link %>", description: "Link to the company modules overview page" },
  { name: "Expense: Title", variable: "<% expense_title %>", description: "Title of the expense" },
  { name: "Expense: Amount", variable: "<% expense_amount %>", description: "Formatted amount of the expense" },
  { name: "Expense: Status", variable: "<% expense_status %>", description: "Status of the expense (e.g., Submitted, Approved)" },
  { name: "Expense: Link", variable: "<% expense_link %>", description: "Link to the expense detail page" },
  { name: "Report: Subject", variable: "<% report_subject %>", description: "Subject of the generated report" },
  { name: "Report: Content", variable: "<% report_content %>", description: "Content of the generated report (HTML or plain text)" },
];

const CompanyEmailTemplatesTab = ({ companyId }: CompanyEmailTemplatesTabProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CompanyEmailTemplate | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<CompanyEmailTemplate | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null); // New state for preview errors
  const [isAiRedesignDialogOpen, setIsAiRedesignDialogOpen] = useState(false); // New state for AI redesign dialog

  const userRole = profile?.role;

  const { data: templates, isLoading: isLoadingTemplates } = useQuery<CompanyEmailTemplate[]>({
    queryKey: ["companyEmailTemplates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_email_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isLoadingSession,
  });

  // Fetch System Email Layout for preview (company templates also use global layout)
  const { data: systemLayout, isLoading: isLoadingLayout } = useQuery<SystemEmailLayout | null>({
    queryKey: ["systemEmailLayoutForCompanyTemplateManager"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('upsert-system-email-layout', { method: 'GET' });
      if (error) throw error;
      return data.data;
    },
    enabled: !isLoadingSession,
  });

  // Fetch the company's name for the preview
  const { data: companyNameData, isLoading: isLoadingCompanyName } = useQuery<{ name: string } | null>({
    queryKey: ["companyNameForTemplatePreview", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase.from("companies").select("name").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isLoadingSession,
  });

  const form = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: { name: "", subject: "", body: `
      <p>Hello,</p>
      <p>This is a notification from your company, <% company_name %>.</p>
      <p>You can customize this template using the variables listed on the right.</p>
      <p>Best regards,<br><% company_name %></p>
    `, description: "" },
  });

  useEffect(() => {
    if (isAddEditDialogOpen) {
      form.reset(editingTemplate ? {
        name: editingTemplate.name,
        subject: editingTemplate.subject,
        body: editingTemplate.body,
        description: editingTemplate.description ?? "",
      } : { name: "", subject: "", body: `
        <p>Hello,</p>
        <p>This is a notification from your company, <% company_name %>.</p>
        <p>You can customize this template using the variables listed on the right.</p>
        <p>Best regards,<br><% company_name %></p>
      `, description: "" });
    }
    setPreviewError(null); // Clear preview error when dialog state changes
  }, [isAddEditDialogOpen, editingTemplate, form]);

  const handleCreateFromSuggestion = (suggestion: TemplateSuggestion) => {
    setEditingTemplate(null);
    form.reset({
      name: suggestion.name,
      subject: suggestion.subject,
      body: suggestion.body,
      description: `AI-suggested template for: ${suggestion.name}`,
    });
    setIsSuggestionsOpen(false);
    setIsAddEditDialogOpen(true);
  };

  const handleRedesignComplete = (newSubject: string, newBody: string) => {
    form.setValue("subject", newSubject, { shouldDirty: true });
    form.setValue("body", newBody, { shouldDirty: true });
    toast({ title: "AI Redesign Applied", description: "The template has been updated with AI's suggestions. Review and save." });
  };

  const upsertTemplateMutation = useMutation({
    mutationFn: async (templateData: EmailTemplateFormValues) => {
      if (!companyId) throw new Error("Company not identified.");

      // Authorization check: Admins can only manage templates for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage email templates for your own company.");
      }

      const payload = { ...templateData, company_id: companyId };
      
      if (editingTemplate) {
        const { error } = await supabase.from("company_email_templates").update(payload).eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_email_templates").insert(payload);
        if (error) throw error;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyEmailTemplates", companyId] });
      toast({ title: "Template Saved", description: "Your email template has been saved." });
      setIsAddEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error Saving Template", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!companyId) throw new Error("Company not identified.");

      // Authorization check: Admins can only delete templates from their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only delete email templates from your own company.");
      }

      const { error } = await supabase.from("company_email_templates").delete().eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyEmailTemplates", companyId] });
      toast({ title: "Template Deleted" });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error Deleting Template", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: EmailTemplateFormValues) => upsertTemplateMutation.mutate(values);
  const handleAddClick = () => { setEditingTemplate(null); form.reset(); setIsAddEditDialogOpen(true); };
  const handleEditClick = (template: CompanyEmailTemplate) => { setEditingTemplate(template); setIsAddEditDialogOpen(true); };
  const handleDeleteClick = (template: CompanyEmailTemplate) => { setTemplateToDelete(template); setIsDeleteDialogOpen(true); };
  const confirmDelete = () => { if (templateToDelete) deleteTemplateMutation.mutate(templateToDelete.id); };

  const isActionPending = upsertTemplateMutation.isPending || deleteTemplateMutation.isPending;

  // Comprehensive dummy variables for preview rendering
  const dummyTemplateVariables = useMemo(() => {
    const base = new URL(window.location.origin);
    const storedLogoUrl = systemLayout?.default_logo_url;
    let finalLogoUrl: string;

    try {
      if (storedLogoUrl) {
        finalLogoUrl = new URL(storedLogoUrl, base).href;
      } else {
        finalLogoUrl = new URL('/infotrac-logo.png', base).href;
      }
    } catch (e: any) {
      console.error("Error constructing logo_url for preview:", e);
      finalLogoUrl = ''; // Fallback to empty string on error
    }

    return {
      year: new Date().getFullYear(),
      public_web_url: window.location.origin, // Use window.location.origin for local development
      logo_url: finalLogoUrl,
      logo_width: systemLayout?.default_logo_width || 150,
      logo_height: systemLayout?.default_logo_height || 'auto',
      company_name: companyNameData?.name || "Your Company", // Use fetched company name
      
      // User-related
      user_name: "John Doe",
      user_email: "john.doe@example.com",
      new_user_name: "Alice Smith",
      new_user_email: "alice.smith@example.com",
      target_user_name: "Bob Johnson",
      target_user_email: "bob.johnson@example.com",
      admin_name: "Jane Admin",
      admin_email: "jane.admin@example.com",
      inviter_name: "Charlie Brown",
      invited_role: "User",
      new_status: "Active", // For user status updates
      users_link: `${window.location.origin}/users`,
      invitation_link: `${window.location.origin}/accept-invite?token=dummytoken123`,

      // Module-related
      module_name: "Expense Management",
      access_status: "Enabled", // For user module access updates
      modules_link: `${window.location.origin}/company-modules-overview`,

      // Expense-related (if applicable for system templates)
      expense_title: "Client Lunch",
      expense_amount: "$125.50",
      expense_status: "Approved",
      expense_link: `${window.location.origin}/expenses/123`,

      // Report-related
      report_subject: "Monthly Sales Report",
      report_content: "<p>Here is your monthly sales summary...</p>",
    };
  }, [systemLayout, companyNameData?.name]); // Recalculate if systemLayout or fetched company name changes

  const currentBody = form.watch("body");
  const currentSubject = form.watch("subject"); // Explicitly watch subject
  const [fullPreviewHtml, setFullPreviewHtml] = useState("");

  useEffect(() => {
    try {
      const previewBody = currentBody ? mustache.render(currentBody, dummyTemplateVariables, {}, ['<%', '%>']) : "";
      let headerHtmlContent = systemLayout?.header_html ? mustache.render(systemLayout.header_html, dummyTemplateVariables, {}, ['<%', '%>']) : "";
      let footerHtmlContent = systemLayout?.footer_html ? mustache.render(systemLayout.footer_html, dummyTemplateVariables, {}, ['<%', '%>']) : "";
      
      // Apply default header if no custom header HTML is provided
      if (!systemLayout?.header_html) {
        headerHtmlContent = `
          <div style="text-align: center; padding: 20px; background-color: #f8f8f8; border-bottom: 1px solid #eee;">
            <img src="${dummyTemplateVariables.logo_url}" alt="${dummyTemplateVariables.company_name} Logo" style="max-width: ${dummyTemplateVariables.logo_width || 150}px; height: ${dummyTemplateVariables.logo_height || 'auto'}; display: block; margin: 0 auto;">
          </div>
        `;
      }

      // Apply default footer if no custom footer HTML is provided
      if (!systemLayout?.footer_html) {
        footerHtmlContent = `
          <div style="text-align: center; padding: 20px; font-size: 0.8em; color: #777; border-top: 1px solid #eee; margin-top: 20px;">
            &copy; <% year %> ${dummyTemplateVariables.company_name}. All rights reserved. <br>
            <a href="<% public_web_url %>" style="color: #2F424F;">Visit our website</a>
          </div>
        `;
      }

      const generatedHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${currentSubject || "Email Preview"}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                .email-wrapper { max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
                .email-header { padding: 20px; text-align: center; }
                .email-body { padding: 20px; }
                .email-footer { padding: 20px; text-align: center; font-size: 0.8em; color: #777; border-top: 1px solid #eee; margin-top: 20px; }
                img { max-width: 100%; height: auto; }
                a { color: #2F424F; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="email-wrapper">
                ${headerHtmlContent}
                <div class="email-body">
                    ${previewBody}
                </div>
                ${footerHtmlContent}
            </div>
        </body>
        </html>
      `;
      setFullPreviewHtml(generatedHtml);
      if (previewError) setPreviewError(null); // Clear error if rendering succeeds
    } catch (e: any) {
      console.error("Error rendering template preview:", e);
      setPreviewError(`Error rendering preview: ${e.message || "Unknown error"}. Please check template syntax.`);
      setFullPreviewHtml(`<p style="color: red;">Error: Could not render preview. Please check template syntax.</p>`);
    }
  }, [currentBody, currentSubject, dummyTemplateVariables, previewError, systemLayout]);

  const canManageTemplates = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  if (isLoadingSession || isLoadingTemplates || isLoadingLayout || isLoadingCompanyName) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!canManageTemplates) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to manage these email templates.</p>
      </div>
    );
  }

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardTitle>Email Templates</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsSuggestionsOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" /> Suggest Templates
            </Button>
            <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Create Template</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto"> {/* Increased width */}
                <DialogHeader>
                  <DialogTitle>{editingTemplate ? "Edit Email Template" : "Create New Email Template"}</DialogTitle>
                  <DialogDescription>
                    {editingTemplate ? "Update the content of this email template." : "Design a new email template for automated notifications."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4"> {/* Two-column layout */}
                  <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        disabled={isActionPending}
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        {...form.register("subject")}
                        disabled={isActionPending}
                      />
                      {form.formState.errors.subject && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.subject.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...form.register("description")}
                        disabled={isActionPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="body" className="flex items-center gap-1">
                        Body <span className="text-xs text-muted-foreground">(HTML)</span>
                      </Label>
                      <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded" />}>
                        <RichTextEditor
                          value={form.watch("body")}
                          onChange={(value) => form.setValue("body", value)}
                          placeholder="Enter email body HTML here. Use placeholders like <% user_name %>."
                          disabled={isActionPending}
                        />
                      </Suspense>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use placeholders like `&lt;% admin_name %&gt;`, `&lt;% company_name %&gt;` for dynamic content.
                      </p>
                      {form.formState.errors.body && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.body.message}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      {editingTemplate && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAiRedesignDialogOpen(true)}
                          disabled={isActionPending}
                        >
                          <Sparkles className="mr-2 h-4 w-4" /> AI Redesign
                        </Button>
                      )}
                      <Button type="submit" disabled={isActionPending}>
                        {isActionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingTemplate ? "Update Template" : "Create Template"}
                      </Button>
                    </div>
                  </form>

                  {/* Right Column: Variables and Preview */}
                  <div className="grid gap-4">
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Variable className="h-5 w-5" /> Available Variables
                        </CardTitle>
                        <CardDescription>Click to insert a variable into the email body.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-2">
                        <Select onValueChange={(value) => {
                          const editor = document.querySelector('.ql-editor');
                          if (editor) {
                            const currentHtml = form.getValues("body");
                            const newHtml = currentHtml + value; // Simple append for now
                            form.setValue("body", newHtml);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a variable to insert..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {AVAILABLE_COMPANY_VARIABLES.map((v) => (
                              <SelectItem key={v.variable} value={v.variable}>
                                {v.name} <span className="text-muted-foreground text-xs ml-2">({v.variable})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">
                          Variables will be replaced with actual data when the email is sent.
                        </p>
                      </CardContent>
                    </Card>

                    {/* Preview Section */}
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Email Body Preview</CardTitle>
                        <CardDescription>How your email body will look with dummy data.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {previewError && (
                          <p className="text-sm text-destructive mb-2">{previewError}</p>
                        )}
                        <div
                          className="prose dark:prose-invert max-w-none border rounded-md p-4 bg-background min-h-[200px]"
                          dangerouslySetInnerHTML={{ __html: fullPreviewHtml }}
                        />
                        {form.watch("body") === "" && !previewError && (
                          <p className="text-muted-foreground text-sm text-center mt-4">No content to preview.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center">No templates created yet.</TableCell></TableRow>
              ) : (
                templates?.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell>{template.description ?? "N/A"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(template)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(template)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the template "{templateToDelete?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteTemplateMutation.isPending}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TemplateSuggestionsDialog
        isOpen={isSuggestionsOpen}
        onOpenChange={setIsSuggestionsOpen}
        onSelectSuggestion={handleCreateFromSuggestion}
        companyId={companyId} // Pass companyId to dialog
      />

      {editingTemplate && (
        <AiRedesignTemplateDialog
          isOpen={isAiRedesignDialogOpen}
          onOpenChange={setIsAiRedesignDialogOpen}
          currentTemplate={editingTemplate}
          onRedesignComplete={handleRedesignComplete}
          isSystemTemplate={false} // This is a company template
          companyId={companyId} // Pass companyId for context
        />
      )}
    </>
  );
};

export default CompanyEmailTemplatesTab;