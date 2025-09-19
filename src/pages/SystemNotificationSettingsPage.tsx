"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Corrected import statement
import { Loader2, Mail, Settings, LayoutTemplate, Send, Sparkles, Variable, PlusCircle, Edit, Trash2, FileText, Info, CheckCircle, XCircle, Save, RotateCcw } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
// Lazy load RichTextEditor to reduce bundle size
const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));
import mustache from "mustache";
import SystemTemplateSuggestionsDialog, { TemplateSuggestion } from "@/components/SystemTemplateSuggestionsDialog";
import AiRedesignTemplateDialog from "@/components/AiRedesignTemplateDialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


// --- Interfaces for Data Fetching ---
interface SmtpSettings {
  id: string;
  sender_email: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  email_api_key_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string | null;
  created_at: string;
  updated_at: string;
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

// --- Schemas for Forms ---

// Email Settings Tab Schema
const smtpSettingsSchema = z.object({
  sender_email: z.string().email("Invalid email address").min(1, "Sender email is required"),
  smtp_host: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().nullable().optional()
  ),
  smtp_port: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    },
    z.number().int().positive("Port must be a positive integer").nullable().optional()
  ),
  smtp_username: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().nullable().optional()
  ),
  smtp_password: z.string().optional().nullable(),
  email_api_key: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.email_api_key && data.email_api_key.trim() !== "") {
    return;
  }
  if (data.smtp_host && data.smtp_host.trim() !== "") {
    if (data.smtp_port === null || data.smtp_port === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP Port is required when SMTP Host is provided.",
        path: ["smtp_port"],
      });
    }
    if (data.smtp_username === null || data.smtp_username === undefined || data.smtp_username.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP Username is required when SMTP Host is provided.",
        path: ["smtp_username"],
      });
    }
  }
});
type SmtpSettingsFormValues = z.infer<typeof smtpSettingsSchema>;

// Email Templates Tab Schema
const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  description: z.string().optional().nullable(),
});
type EmailTemplateFormValues = z.infer<typeof emailTemplateSchema>;

// Email Layout Tab Schema
const systemEmailLayoutSchema = z.object({
  header_html: z.string().optional().nullable(),
  footer_html: z.string().optional().nullable(),
  default_logo_url: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    return z.string().url().safeParse(val).success || val.startsWith('/');
  }, {
    message: "Must be a valid absolute URL (http/https) or a root-relative path (starts with /)",
  }),
  default_company_name: z.string().optional().nullable(),
  default_logo_width: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().positive("Width must be a positive integer").nullable().optional()
  ),
  default_logo_height: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().positive("Height must be a positive integer").nullable().optional()
  ),
});
type SystemEmailLayoutFormValues = z.infer<typeof systemEmailLayoutSchema>;

// Test Email Tab Schema
const testEmailSchema = z.object({
  recipient_email: z.string().email("Invalid email address").min(1, "Recipient email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().optional(),
  use_template: z.boolean().default(false),
  template_name: z.string().optional(),
  template_variables: z.string().optional().nullable(),
});
type TestEmailFormValues = z.infer<typeof testEmailSchema>;

// Define available system variables with descriptions
const AVAILABLE_SYSTEM_VARIABLES = [
  { name: "Global: Current Year", variable: "<% year %>", description: "The current year (e.g., 2024)" },
  { name: "Global: Public Web URL", variable: "<% public_web_url %>", description: "The base URL of the application" },
  { name: "Global: Default Logo URL", variable: "<% logo_url %>", description: "The system's default logo image URL" },
  { name: "Global: Default Logo Width", variable: "<% logo_width %>", description: "The system's default logo width in pixels" },
  { name: "Global: Default Logo Height", variable: "<% logo_height %>", description: "The system's default logo height in pixels" },
  { name: "Global: Default Company Name", variable: "<% company_name %>", description: "The system's default company name" },
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

const SystemNotificationSettingsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const isSuperAdmin = profile?.role === 'super-admin';

  // --- State for Email Templates Tab ---
  const [isAddTemplateDialogOpen, setIsAddTemplateDialogOpen] = useState(false);
  const [isTemplateSuggestionsOpen, setIsTemplateSuggestionsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDeleteTemplateDialogOpen, setIsDeleteTemplateDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  const [templatePreviewError, setTemplatePreviewError] = useState<string | null>(null);
  const [isAiRedesignTemplateDialogOpen, setIsAiRedesignTemplateDialogOpen] = useState(false);

  // --- Data Queries ---

  // Query for SMTP Settings
  const { data: smtpSettings, isLoading: isLoadingSmtpSettings } = useQuery<SmtpSettings | null>({
    queryKey: ["smtpSettings"],
    queryFn: async () => {
      if (!isSuperAdmin) return null;
      const { data, error } = await supabase.from("smtp_settings").select("*").single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Query for Resend API Key Status
  const { data: resendApiKeyStatus, isLoading: isLoadingResendApiKeyStatus } = useQuery<{ isResendApiKeySet: boolean }>({
    queryKey: ["resendApiKeyStatus"],
    queryFn: async () => {
      if (!isSuperAdmin) return { isResendApiKeySet: false };
      const { data, error } = await supabase.functions.invoke('check-resend-api-key');
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Query for Email Templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      if (!isSuperAdmin) return [];
      const { data, error } = await supabase.from("email_templates").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Query for System Email Layout
  const { data: systemLayout, isLoading: isLoadingLayout } = useQuery<SystemEmailLayout | null>({
    queryKey: ["systemEmailLayout"],
    queryFn: async () => {
      if (!isSuperAdmin) return null;
      const { data, error } = await supabase.functions.invoke('upsert-system-email-layout', { method: 'GET' });
      if (error) throw error;
      return data.data;
    },
    enabled: isSuperAdmin,
  });

  // --- Forms ---

  // Email Settings Form
  const smtpForm = useForm<SmtpSettingsFormValues>({
    resolver: zodResolver(smtpSettingsSchema),
    defaultValues: {
      sender_email: "",
      smtp_host: "",
      smtp_port: undefined,
      smtp_username: "",
      smtp_password: "",
      email_api_key: "",
    },
  });

  useEffect(() => {
    if (smtpSettings) {
      smtpForm.reset({
        sender_email: smtpSettings.sender_email,
        smtp_host: smtpSettings.smtp_host ?? "",
        smtp_port: smtpSettings.smtp_port ?? undefined,
        smtp_username: smtpSettings.smtp_username ?? "",
        smtp_password: "",
        email_api_key: "",
      });
    }
  }, [smtpSettings, smtpForm]);

  const upsertSmtpSettingsMutation = useMutation({
    mutationFn: async (values: SmtpSettingsFormValues) => {
      if (!isSuperAdmin) throw new Error("Access Denied: Only Super Admins can configure SMTP settings.");
      const payload = {
        sender_email: values.sender_email,
        smtp_host: values.smtp_host ?? null,
        smtp_port: values.smtp_port ?? null,
        smtp_username: values.smtp_username ?? null,
        ...(values.smtp_password && { smtp_password: values.smtp_password }),
        ...(values.email_api_key && { email_api_key: values.email_api_key }),
      };
      const { data, error } = await supabase.functions.invoke('upsert-smtp-settings', { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smtpSettings"] });
      queryClient.invalidateQueries({ queryKey: ["resendApiKeyStatus"] });
      toast({ title: "Email Settings Saved", description: "System email sending settings have been updated." });
      smtpForm.setValue("smtp_password", "");
      smtpForm.setValue("email_api_key", "");
    },
    onError: (error: any) => {
      toast({ title: "Error Saving Settings", description: error.message, variant: "destructive" });
    },
  });

  const onSmtpSubmit = (values: SmtpSettingsFormValues) => {
    upsertSmtpSettingsMutation.mutate(values);
  };

  // Email Templates Form
  const templateForm = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: "",
      subject: "",
      body: `
        <p>Hello,</p>
        <p>This is a system notification from <% company_name %>.</p>
        <p>You can customize this template using the variables listed on the right.</p>
        <p>Best regards,<br><% company_name %></p>
      `,
      description: "",
    },
  });

  useEffect(() => {
    if (isAddTemplateDialogOpen && editingTemplate) {
      templateForm.reset({
        name: editingTemplate.name,
        subject: editingTemplate.subject,
        body: editingTemplate.body,
        description: editingTemplate.description ?? "",
      });
    } else if (!isAddTemplateDialogOpen) {
      templateForm.reset({
        name: "",
        subject: "",
        body: `
          <p>Hello,</p>
          <p>This is a system notification from <% company_name %>.</p>
          <p>You can customize this template using the variables listed on the right.</p>
          <p>Best regards,<br><% company_name %></p>
        `,
        description: "",
      });
    }
    setTemplatePreviewError(null);
  }, [isAddTemplateDialogOpen, editingTemplate, templateForm]);

  const upsertTemplateMutation = useMutation({
    mutationFn: async (templateData: EmailTemplateFormValues) => {
      if (!isSuperAdmin) throw new Error("Only Super Admins can manage email templates.");
      if (editingTemplate) {
        const { error } = await supabase.from("email_templates").update({ ...templateData, updated_at: new Date().toISOString() }).eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("email_templates").insert(templateData);
        if (error) throw error;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
      toast({ title: "Template Saved", description: "Email template has been successfully saved." });
      setIsAddTemplateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error Saving Template", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!isSuperAdmin) throw new Error("Only Super Admins can manage email templates.");
      const { error } = await supabase.from("email_templates").delete().eq("id", templateId);
      if (error) throw error;
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
      toast({ title: "Template Deleted", description: "Email template has been deleted." });
      setIsDeleteTemplateDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error Deleting Template", description: error.message, variant: "destructive" });
    },
  });

  const onTemplateSubmit = (values: EmailTemplateFormValues) => {
    upsertTemplateMutation.mutate(values);
  };

  const handleAddTemplateClick = () => {
    setEditingTemplate(null);
    templateForm.reset();
    setIsAddTemplateDialogOpen(true);
  };
  const handleEditTemplateClick = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsAddTemplateDialogOpen(true);
  };
  const handleDeleteTemplateClick = (template: EmailTemplate) => {
    setTemplateToDelete(template);
    setIsDeleteTemplateDialogOpen(true);
  };
  const confirmDeleteTemplate = () => {
    if (templateToDelete) deleteTemplateMutation.mutate(templateToDelete.id);
  };
  const handleCreateFromSuggestion = (suggestion: TemplateSuggestion) => {
    setEditingTemplate(null);
    templateForm.reset({
      name: suggestion.name,
      subject: suggestion.subject,
      body: suggestion.body,
      description: `AI-suggested template for: ${suggestion.name}`,
    });
    setIsTemplateSuggestionsOpen(false);
    setIsAddTemplateDialogOpen(true);
  };
  const handleRedesignComplete = (newSubject: string, newBody: string) => {
    templateForm.setValue("subject", newSubject, { shouldDirty: true });
    templateForm.setValue("body", newBody, { shouldDirty: true });
    toast({ title: "AI Redesign Applied", description: "The template has been updated with AI's suggestions. Review and save." });
  };

  // Email Layout Form
  const layoutForm = useForm<SystemEmailLayoutFormValues>({
    resolver: zodResolver(systemEmailLayoutSchema),
    defaultValues: {
      header_html: "",
      footer_html: "",
      default_logo_url: "",
      default_company_name: "",
      default_logo_width: undefined,
      default_logo_height: undefined,
    },
  });

  useEffect(() => {
    if (systemLayout) {
      layoutForm.reset({
        header_html: systemLayout.header_html ?? "",
        footer_html: systemLayout.footer_html ?? "",
        default_logo_url: systemLayout.default_logo_url ?? "",
        default_company_name: systemLayout.default_company_name ?? "",
        default_logo_width: systemLayout.default_logo_width ?? undefined,
        default_logo_height: systemLayout.default_logo_height ?? undefined,
      });
    }
  }, [systemLayout, layoutForm]);

  const upsertLayoutMutation = useMutation({
    mutationFn: async (values: SystemEmailLayoutFormValues) => {
      if (!isSuperAdmin) throw new Error("Access Denied: Only Super Admins can manage system email layout.");
      const payload = {
        header_html: values.header_html ?? null,
        footer_html: values.footer_html ?? null,
        default_logo_url: values.default_logo_url ?? null,
        default_company_name: values.default_company_name ?? null,
        default_logo_width: values.default_logo_width ?? null,
        default_logo_height: values.default_logo_height ?? null,
      };
      const { data, error } = await supabase.functions.invoke('upsert-system-email-layout', { method: 'POST', body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systemEmailLayout"] });
      toast({ title: "Layout Saved", description: "System email layout has been updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error Saving Layout", description: error.message, variant: "destructive" });
    },
  });

  const onLayoutSubmit = (values: SystemEmailLayoutFormValues) => {
    upsertLayoutMutation.mutate(values);
  };

  // Test Email Form
  const testEmailForm = useForm<TestEmailFormValues>({
    resolver: zodResolver(testEmailSchema),
    defaultValues: {
      recipient_email: "",
      subject: "",
      body: "",
      use_template: false,
      template_name: "",
      template_variables: "{\n  \"user_name\": \"John Doe\",\n  \"expense_title\": \"Client Lunch\",\n  \"expense_status\": \"Approved\",\n  \"expense_link\": \"https://example.com/expenses/123\",\n  \"admin_name\": \"Jane Smith\",\n  \"company_name\": \"Your Company\",\n  \"year\": 2024\n}",
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async (values: TestEmailFormValues) => {
      if (!isSuperAdmin) throw new Error("Access Denied: Only Super Admins can send system test emails.");
      let parsedVariables = {};
      if (values.use_template && values.template_variables) {
        try {
          parsedVariables = JSON.parse(values.template_variables);
        } catch (e) {
          throw new Error("Invalid JSON for template variables.");
        }
      }
      const payload = {
        recipient_email: values.recipient_email,
        subject: values.subject,
        body: values.body,
        ...(values.use_template && {
          template_name: values.template_name,
          template_variables: parsedVariables,
        }),
      };
      const { data, error } = await supabase.functions.invoke("send-email", { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Test Email Sent", description: data.message || "Test email simulated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error Sending Test Email", description: error.message, variant: "destructive" });
    },
  });

  const onTestEmailSubmit = (values: TestEmailFormValues) => {
    sendTestEmailMutation.mutate(values);
  };

  const useTemplateForTestEmail = testEmailForm.watch("use_template");
  const selectedTemplateNameForTestEmail = testEmailForm.watch("template_name");

  useEffect(() => {
    if (useTemplateForTestEmail && selectedTemplateNameForTestEmail && templates) {
      const selectedTemplate = templates.find(t => t.name === selectedTemplateNameForTestEmail);
      if (selectedTemplate) {
        testEmailForm.setValue("subject", selectedTemplate.subject);
        testEmailForm.setValue("body", selectedTemplate.body);
      }
    } else if (!useTemplateForTestEmail) {
      testEmailForm.setValue("subject", "");
      testEmailForm.setValue("body", "");
    }
  }, [useTemplateForTestEmail, selectedTemplateNameForTestEmail, templates, testEmailForm]);

  // --- Loading States ---
  const isLoadingPage = isLoadingSession || isLoadingSmtpSettings || isLoadingResendApiKeyStatus || isLoadingTemplates || isLoadingLayout;
  const isSmtpSaving = upsertSmtpSettingsMutation.isPending;
  const isTemplateSaving = upsertTemplateMutation.isPending || deleteTemplateMutation.isPending;
  const isLayoutSaving = upsertLayoutMutation.isPending;
  const isTestEmailSending = sendTestEmailMutation.isPending;

  // --- Derived States for UI ---
  let activeService = "Simulated (No API Key)";
  let serviceStatusIcon = <XCircle className="h-5 w-5 text-destructive" />;
  let serviceStatusColor = "text-destructive";
  const senderEmail = smtpSettings?.sender_email || "noreply@example.com";

  if (resendApiKeyStatus?.isResendApiKeySet) {
    activeService = "Resend API (System-wide)";
    serviceStatusIcon = <CheckCircle className="h-5 w-5 text-green-500" />;
    serviceStatusColor = "text-green-500";
  } else if (smtpSettings?.smtp_host && smtpSettings?.smtp_username && smtpSettings?.smtp_password_encrypted) {
    activeService = "Direct SMTP (System-wide)";
    serviceStatusIcon = <CheckCircle className="h-5 w-5 text-green-500" />;
    serviceStatusColor = "text-green-500";
  } else if (smtpSettings?.email_api_key_encrypted) {
    activeService = "Email API (System-wide, configured in DB)";
    serviceStatusIcon = <CheckCircle className="h-5 w-5 text-green-500" />;
    serviceStatusColor = "text-green-500";
  }

  // Comprehensive dummy variables for preview rendering (used in Templates and Test Email tabs)
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
      finalLogoUrl = '';
    }

    return {
      year: new Date().getFullYear(),
      public_web_url: window.location.origin,
      logo_url: finalLogoUrl,
      logo_width: systemLayout?.default_logo_width || 150,
      logo_height: systemLayout?.default_logo_height || 'auto',
      company_name: systemLayout?.default_company_name || "INFOtrac",
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
      new_status: "Active",
      users_link: `${window.location.origin}/users`,
      invitation_link: `${window.location.origin}/accept-invite?token=dummytoken123`,
      module_name: "Expense Management",
      access_status: "Enabled",
      modules_link: `${window.location.origin}/company-modules-overview`,
      expense_title: "Client Lunch",
      expense_amount: "$125.50",
      expense_status: "Approved",
      expense_link: `${window.location.origin}/expenses/123`,
      report_subject: "Monthly Sales Report",
      report_content: "<p>Here is your monthly sales summary...</p>",
    };
  }, [systemLayout]);

  // --- HTML Generation Functions for iframe content ---
  const generateFullEmailHTML = (bodyContent: string, subject: string) => {
    const previewBody = bodyContent ? mustache.render(bodyContent, dummyTemplateVariables, {}, ['<%', '%>']) : "";
    const headerHtmlContent = systemLayout?.header_html ? mustache.render(systemLayout.header_html, dummyTemplateVariables, {}, ['<%', '%>']) : mustache.render(`
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8f8f8; padding: 20px 0; border-bottom: 1px solid #eeeeee;">
        <tr>
          <td align="center" valign="top">
            <table border="0" cellspacing="0" cellpadding="0" width="600" style="max-width: 600px;">
              <tr>
                <td align="center" valign="top" style="padding: 0 20px;">
                  <a href="<% public_web_url %>" target="_blank" style="text-decoration: none;">
                    <img src="<% logo_url %>" alt="<% company_name %> Logo"
                         width="<% logo_width %>"
                         height="<% logo_height %>"
                         style="display: block; max-width: 100%; height: auto; border: 0; outline: none; text-decoration: none; margin: 0 auto; padding-bottom: 10px;"
                         onerror="this.onerror=null;this.src='<% public_web_url %>/infotrac-logo.png';"
                    >
                  </a>
                  <% #company_name %>
                  <p style="font-family: Arial, sans-serif; font-size: 18px; line-height: 24px; color: #2F424F; margin: 0; padding: 0;">
                    <strong><% company_name %></strong>
                  </p>
                  <% /company_name %>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `, dummyTemplateVariables, {}, ['<%', '%>']);

    const footerHtmlContent = systemLayout?.footer_html ? mustache.render(systemLayout.footer_html, dummyTemplateVariables, {}, ['<%', '%>']) : mustache.render(`
      <div style="text-align: center; padding: 20px; font-size: 0.8em; color: #777; border-top: 1px solid #eee; margin-top: 20px;">
        &copy; <% year %> <% company_name %>. All rights reserved. <br>
        <a href="<% public_web_url %>" style="color: #2F424F;">Visit our website</a>
      </div>
    `, dummyTemplateVariables, {}, ['<%', '%>']);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject || "Email Preview"}</title>
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
  };

  // Template Preview HTML generation
  const currentTemplateBody = templateForm.watch("body");
  const currentTemplateSubject = templateForm.watch("subject");
  const fullTemplatePreviewHtml = useMemo(() => {
    return generateFullEmailHTML(currentTemplateBody ?? "", currentTemplateSubject ?? "");
  }, [currentTemplateBody, currentTemplateSubject, dummyTemplateVariables, systemLayout]);


  // Email Layout Preview HTML generation
  const currentLayoutHeaderHtml = layoutForm.watch("header_html");
  const currentLayoutFooterHtml = layoutForm.watch("footer_html");
  const currentLayoutDefaultLogoUrl = layoutForm.watch("default_logo_url");
  const currentLayoutDefaultCompanyName = layoutForm.watch("default_company_name");
  const currentLayoutDefaultLogoWidth = layoutForm.watch("default_logo_width");
  const currentLayoutDefaultLogoHeight = layoutForm.watch("default_logo_height");
  const fullLayoutPreviewHtml = useMemo(() => {
    const layoutPreviewVariables = {
      ...dummyTemplateVariables,
      logo_url: currentLayoutDefaultLogoUrl || dummyTemplateVariables.logo_url,
      company_name: currentLayoutDefaultCompanyName || dummyTemplateVariables.company_name,
      logo_width: currentLayoutDefaultLogoWidth || dummyTemplateVariables.logo_width,
      logo_height: currentLayoutDefaultLogoHeight || dummyTemplateVariables.logo_height,
      // Use a generic body for layout preview
      body_content: "<p>This is a **dummy email body** to preview your header and footer layout. It will be replaced by actual template content when an email is sent.</p><p>Example variable: User Name: <% user_name %></p>",
    };

    const headerHtml = currentLayoutHeaderHtml ? mustache.render(currentLayoutHeaderHtml, layoutPreviewVariables, {}, ['<%', '%>']) : mustache.render(`
      <div style="text-align: center; padding: 20px; background-color: #f8f8f8; border-bottom: 1px solid #eee;">
        <img src="<% logo_url %>" alt="<% company_name %> Logo" style="max-width: <% logo_width %>px; height: <% logo_height %>; display: block; margin: 0 auto;">
      </div>
    `, layoutPreviewVariables, {}, ['<%', '%>']);

    const footerHtml = currentLayoutFooterHtml ? mustache.render(currentLayoutFooterHtml, layoutPreviewVariables, {}, ['<%', '%>']) : mustache.render(`
      <div style="text-align: center; padding: 20px; font-size: 0.8em; color: #777; border-top: 1px solid #eee; margin-top: 20px;">
        &copy; <% year %> <% company_name %>. All rights reserved. <br>
        <a href="<% public_web_url %>" style="color: #2F424F;">Visit our website</a>
      </div>
    `, layoutPreviewVariables, {}, ['<%', '%>']);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Layout Preview</title>
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
              ${headerHtml}
              <div class="email-body">
                  ${layoutPreviewVariables.body_content}
              </div>
              ${footerHtml}
          </div>
      </body>
      </html>
    `;
  }, [currentLayoutHeaderHtml, currentLayoutFooterHtml, currentLayoutDefaultLogoUrl, currentLayoutDefaultCompanyName, currentLayoutDefaultLogoWidth, currentLayoutDefaultLogoHeight, dummyTemplateVariables, systemLayout]);


  // Test Email Preview HTML generation
  const currentTestEmailBody = testEmailForm.watch("body");
  const currentTestEmailSubject = testEmailForm.watch("subject");
  const fullTestEmailPreviewHtml = useMemo(() => {
    return generateFullEmailHTML(currentTestEmailBody ?? "", currentTestEmailSubject ?? "");
  }, [currentTestEmailBody, currentTestEmailSubject, dummyTemplateVariables, systemLayout]);


  if (isLoadingPage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading system notification settings...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Super Admins can manage system notification settings.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> System Notification Settings
        </CardTitle>
        <CardDescription>
          Manage global email settings, templates, layout, and send test emails for the entire platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email-settings">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="email-settings">Email Settings</TabsTrigger>
            <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
            <TabsTrigger value="email-layout">Email Layout</TabsTrigger>
            <TabsTrigger value="test-email">Test Email</TabsTrigger>
          </TabsList>

          {/* --- Email Settings Tab --- */}
          <TabsContent value="email-settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" /> SMTP & Email API Settings
                </CardTitle>
                <CardDescription>
                  Configure the email server settings for sending automated notifications.
                  You can use either direct SMTP credentials or an API key from a transactional email service (e.g., Resend).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                    <Info className="h-5 w-5 text-blue-500" /> Email Service Status
                  </h3>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {serviceStatusIcon}
                      <p className={`font-medium ${serviceStatusColor}`}>Active Service: {activeService}</p>
                    </div>
                    <p>Sender Email: <span className="font-medium">{senderEmail}</span></p>
                  </div>
                </div>

                <Separator className="my-6" />

                <form onSubmit={smtpForm.handleSubmit(onSmtpSubmit)} className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="sender_email">Sender Email Address</Label>
                    <Input
                      id="sender_email"
                      type="email"
                      placeholder="noreply@yourdomain.com"
                      {...smtpForm.register("sender_email")}
                      disabled={isSmtpSaving}
                    />
                    {smtpForm.formState.errors.sender_email && (
                      <p className="text-sm text-destructive">{smtpForm.formState.errors.sender_email.message}</p>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold mt-4">SMTP Credentials (Optional)</h3>
                  <p className="text-sm text-muted-foreground -mt-2">
                    Fill these if you are using a direct SMTP server. Leave blank if using an Email API Key.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="smtp_host">SMTP Host</Label>
                    <Input
                      id="smtp_host"
                      placeholder="smtp.example.com"
                      {...smtpForm.register("smtp_host")}
                      disabled={isSmtpSaving}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smtp_port">SMTP Port</Label>
                    <Input
                      id="smtp_port"
                      type="number"
                      placeholder="587"
                      {...smtpForm.register("smtp_port", { valueAsNumber: true })}
                      disabled={isSmtpSaving}
                    />
                    {smtpForm.formState.errors.smtp_port && (
                      <p className="text-sm text-destructive">{smtpForm.formState.errors.smtp_port.message}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smtp_username">SMTP Username</Label>
                    <Input
                      id="smtp_username"
                      placeholder="your-username"
                      {...smtpForm.register("smtp_username")}
                      disabled={isSmtpSaving}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smtp_password">SMTP Password (will not be displayed after saving)</Label>
                    <Input
                      id="smtp_password"
                      type="password"
                      placeholder="Enter new password to update"
                      {...smtpForm.register("smtp_password")}
                      disabled={isSmtpSaving}
                    />
                  </div>

                  <h3 className="text-lg font-semibold mt-4">Email API Key (Optional)</h3>
                  <p className="text-sm text-muted-foreground -mt-2">
                    Fill this if you are using a transactional email service API (e.g., Resend). Leave blank if using SMTP.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="email_api_key">Email API Key (will not be displayed after saving)</Label>
                    <Input
                      id="email_api_key"
                      type="password"
                      placeholder="Enter new API key to update"
                      {...smtpForm.register("email_api_key")}
                      disabled={isSmtpSaving}
                    />
                  </div>

                  <Button type="submit" disabled={isSmtpSaving} className="mt-4">
                    {isSmtpSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Settings
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Email Templates Tab --- */}
          <TabsContent value="email-templates" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Email Templates
                  </CardTitle>
                  <CardDescription>
                    Manage the email templates used for automated notifications across the platform.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsTemplateSuggestionsOpen(true)}>
                    <Sparkles className="mr-2 h-4 w-4" /> Suggest Templates
                  </Button>
                  <Dialog open={isAddTemplateDialogOpen} onOpenChange={setIsAddTemplateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={handleAddTemplateClick}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Template
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingTemplate ? "Edit Email Template" : "Create New Email Template"}</DialogTitle>
                        <DialogDescription>
                          {editingTemplate ? "Update the content of this email template." : "Design a new email template for automated notifications."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="grid gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="template-name">Name</Label>
                            <Input
                              id="template-name"
                              {...templateForm.register("name")}
                              disabled={isTemplateSaving}
                            />
                            {templateForm.formState.errors.name && (
                              <p className="text-sm text-destructive">
                                {templateForm.formState.errors.name.message}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-subject">Subject</Label>
                            <Input
                              id="template-subject"
                              {...templateForm.register("subject")}
                              disabled={isTemplateSaving}
                            />
                            {templateForm.formState.errors.subject && (
                              <p className="text-sm text-destructive">
                                {templateForm.formState.errors.subject.message}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-description">Description</Label>
                            <Textarea
                              id="template-description"
                              {...templateForm.register("description")}
                              disabled={isTemplateSaving}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-body" className="flex items-center gap-1">
                              Body <span className="text-xs text-muted-foreground">(HTML)</span>
                            </Label>
                            <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded" />}>
                              <RichTextEditor
                                value={templateForm.watch("body")}
                                onChange={(value) => templateForm.setValue("body", value)}
                                placeholder="Enter email body HTML here. Use placeholders like <% user_name %>."
                                disabled={isTemplateSaving}
                              />
                            </Suspense>
                            <p className="text-xs text-muted-foreground mt-1">
                              Use placeholders like `&lt;% admin_name %&gt;`, `&lt;% company_name %&gt;` for dynamic content.
                            </p>
                            {templateForm.formState.errors.body && (
                              <p className="text-sm text-destructive">
                                {templateForm.formState.errors.body.message}
                              </p>
                            )}
                          </div>
                          <div className="flex justify-end gap-2 mt-4">
                            {editingTemplate && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAiRedesignTemplateDialogOpen(true)}
                                disabled={isTemplateSaving}
                              >
                                <Sparkles className="mr-2 h-4 w-4" /> AI Redesign
                              </Button>
                            )}
                            <Button type="submit" disabled={isTemplateSaving}>
                              {isTemplateSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              {editingTemplate ? "Update Template" : "Create Template"}
                            </Button>
                          </div>
                        </form>

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
                                  const currentHtml = templateForm.getValues("body");
                                  const newHtml = currentHtml + value;
                                  templateForm.setValue("body", newHtml);
                                }
                              }}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a variable to insert..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto">
                                  {AVAILABLE_SYSTEM_VARIABLES.map((v) => (
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

                          <Card className="bg-muted/50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-lg">Email Body Preview</CardTitle>
                              <CardDescription>How your email body will look with dummy data.</CardDescription>
                            </CardHeader>
                            <CardContent>
                              {templatePreviewError && (
                                <p className="text-sm text-destructive mb-2">{templatePreviewError}</p>
                              )}
                              <iframe
                                srcDoc={fullTemplatePreviewHtml}
                                className="w-full h-[300px] border rounded-md bg-background"
                                title="Email Template Preview"
                              />
                              {templateForm.watch("body") === "" && !templatePreviewError && (
                                <p className="text-muted-foreground text-sm text-center mt-4">No content to preview.</p>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div> {/* Closing div for grid */}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
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
                            <Button variant="outline" size="sm" onClick={() => handleEditTemplateClick(template)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplateClick(template)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <AlertDialog open={isDeleteTemplateDialogOpen} onOpenChange={setIsDeleteTemplateDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the template "{templateToDelete?.name}".</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteTemplate} disabled={deleteTemplateMutation.isPending}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <SystemTemplateSuggestionsDialog
              isOpen={isTemplateSuggestionsOpen}
              onOpenChange={setIsTemplateSuggestionsOpen}
              onSelectSuggestion={handleCreateFromSuggestion}
            />

            {editingTemplate && (
              <AiRedesignTemplateDialog
                isOpen={isAiRedesignTemplateDialogOpen}
                onOpenChange={setIsAiRedesignTemplateDialogOpen}
                currentTemplate={editingTemplate}
                onRedesignComplete={handleRedesignComplete}
                isSystemTemplate={true}
              />
            )}
          </TabsContent>

          {/* --- Email Layout Tab --- */}
          <TabsContent value="email-layout" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5" /> System Email Layout
                </CardTitle>
                <CardDescription>
                  Configure the global header, footer, and default branding for all system-generated emails.
                  The email body will be inserted between the header and footer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={layoutForm.handleSubmit(onLayoutSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Layout Settings */}
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="default_company_name">Default Company Name</Label>
                      <Input
                        id="default_company_name"
                        placeholder="Your Company Name"
                        {...layoutForm.register("default_company_name")}
                        disabled={isLayoutSaving}
                      />
                      {layoutForm.formState.errors.default_company_name && (
                        <p className="text-sm text-destructive">{layoutForm.formState.errors.default_company_name.message}</p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="default_logo_url">Default Logo URL</Label>
                      <Input
                        id="default_logo_url"
                        type="text"
                        placeholder="e.g., /infotrac-logo.png or https://example.com/logo.png"
                        {...layoutForm.register("default_logo_url")}
                        disabled={isLayoutSaving}
                      />
                      {layoutForm.formState.errors.default_logo_url && (
                        <p className="text-sm text-destructive">{layoutForm.formState.errors.default_logo_url.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="default_logo_width">Default Logo Width (px, Optional)</Label>
                        <Input
                          id="default_logo_width"
                          type="number"
                          placeholder="e.g., 150"
                          {...layoutForm.register("default_logo_width", { valueAsNumber: true })}
                          disabled={isLayoutSaving}
                        />
                        {layoutForm.formState.errors.default_logo_width && (
                          <p className="text-sm text-destructive">{layoutForm.formState.errors.default_logo_width.message}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="default_logo_height">Default Logo Height (px, Optional)</Label>
                        <Input
                          id="default_logo_height"
                          type="number"
                          placeholder="e.g., 40"
                          {...layoutForm.register("default_logo_height", { valueAsNumber: true })}
                          disabled={isLayoutSaving}
                        />
                        {layoutForm.formState.errors.default_logo_height && (
                          <p className="text-sm text-destructive">{layoutForm.formState.errors.default_logo_height.message}</p>
                        )}
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Header HTML Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="header_html">Email Header (HTML)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => layoutForm.setValue("header_html", "")}
                          disabled={isLayoutSaving}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
                        </Button>
                      </div>
                      <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded" />}>
                        <RichTextEditor
                          value={layoutForm.watch("header_html") ?? ""}
                          onChange={(value) => layoutForm.setValue("header_html", value)}
                          placeholder="Enter global email header HTML here. Leave blank to use system default."
                          disabled={isLayoutSaving}
                        />
                      </Suspense>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use placeholders like `&lt;% logo_url %&gt;`, `&lt;% company_name %&gt;`, `&lt;% logo_width %&gt;`, `&lt;% logo_height %&gt;` for dynamic content.
                      </p>
                      {layoutForm.formState.errors.header_html && (
                        <p className="text-sm text-destructive">{layoutForm.formState.errors.header_html.message}</p>
                      )}
                    </div>

                    <Separator className="my-4" />

                    {/* Footer HTML Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="footer_html">Email Footer (HTML)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => layoutForm.setValue("footer_html", "")}
                          disabled={isLayoutSaving}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
                        </Button>
                      </div>
                      <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded" />}>
                        <RichTextEditor
                          value={layoutForm.watch("footer_html") ?? ""}
                          onChange={(value) => layoutForm.setValue("footer_html", value)}
                          placeholder="Enter global email footer HTML here. Leave blank to use system default."
                          disabled={isLayoutSaving}
                        />
                      </Suspense>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use placeholders like `&lt;% year %&gt;`, `&lt;% company_name %&gt;`, `&lt;% public_web_url %&gt;` for dynamic content.
                      </p>
                      {layoutForm.formState.errors.footer_html && (
                        <p className="text-sm text-destructive">{layoutForm.formState.errors.footer_html.message}</p>
                      )}
                    </div>

                    <Button type="submit" disabled={isLayoutSaving} className="mt-4">
                      {isLayoutSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Layout
                    </Button>
                  </div>

                  {/* Right Column: Full Email Layout Preview */}
                  <div className="grid gap-4">
                    <Card className="bg-muted/50 h-full flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Full Email Layout Preview</CardTitle>
                        <CardDescription>How a complete email will look with your configured header, footer, and dummy content.</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col">
                        {templatePreviewError && (
                          <p className="text-sm text-destructive mb-2">{templatePreviewError}</p>
                        )}
                        <iframe
                          srcDoc={fullLayoutPreviewHtml}
                          className="w-full h-[500px] border rounded-md bg-background"
                          title="Email Layout Preview"
                        />
                        {(!currentLayoutHeaderHtml && !currentLayoutFooterHtml) && (
                          <p className="text-muted-foreground text-sm text-center mt-4">No custom layout HTML. Showing default structure.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* --- Test Email Tab --- */}
          <TabsContent value="test-email" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" /> Send System Test Email
                </CardTitle>
                <CardDescription>
                  Send a test email using the system-wide SMTP settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={testEmailForm.handleSubmit(onTestEmailSubmit)} className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="test-recipient_email">Recipient Email Address</Label>
                    <Input id="test-recipient_email" type="email" {...testEmailForm.register("recipient_email")} disabled={isTestEmailSending} />
                    {testEmailForm.formState.errors.recipient_email && (
                      <p className="text-sm text-destructive">{testEmailForm.formState.errors.recipient_email.message}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Controller
                      name="use_template"
                      control={testEmailForm.control}
                      render={({ field }) => (
                        <Checkbox
                          id="test-use_template"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isTestEmailSending}
                        />
                      )}
                    />
                    <Label htmlFor="test-use_template">Use an Email Template</Label>
                  </div>

                  {useTemplateForTestEmail && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="test-template_name">Select Template</Label>
                        <Select
                          onValueChange={(value) => testEmailForm.setValue("template_name", value)}
                          value={testEmailForm.watch("template_name") ?? ""}
                          disabled={isTestEmailSending || isLoadingTemplates}
                        >
                          <SelectTrigger id="test-template_name">
                            <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select a template"} />
                          </SelectTrigger>
                          <SelectContent>
                            {templates?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {testEmailForm.formState.errors.template_name && (
                          <p className="text-sm text-destructive">{testEmailForm.formState.errors.template_name.message}</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="test-template_variables">Template Variables (JSON)</Label>
                        <Textarea
                          id="test-template_variables"
                          {...testEmailForm.register("template_variables")}
                          rows={8}
                          className="font-mono text-sm"
                          placeholder='{"user_name": "John Doe", "expense_title": "Client Lunch"}'
                          disabled={isTestEmailSending}
                        />
                        {testEmailForm.formState.errors.template_variables && (
                          <p className="text-sm text-destructive">{testEmailForm.formState.errors.template_variables.message}</p>
                        )}
                      </div>
                    </>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="test-subject">Subject</Label>
                    <Input id="test-subject" {...testEmailForm.register("subject")} disabled={isTestEmailSending || useTemplateForTestEmail} />
                    {testEmailForm.formState.errors.subject && (
                      <p className="text-sm text-destructive">{testEmailForm.formState.errors.subject.message}</p>
                    )}
                  </div>

                  <div className="grid gap-2 mb-8">
                    <Label htmlFor="test-body">Body</Label>
                    <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded" />}>
                      <RichTextEditor
                        value={testEmailForm.watch("body") ?? ""}
                        onChange={(value) => testEmailForm.setValue("body", value)}
                        placeholder="Enter email body here..."
                        disabled={isTestEmailSending || useTemplateForTestEmail}
                      />
                    </Suspense>
                    {testEmailForm.formState.errors.body && (
                      <p className="text-sm text-destructive">{testEmailForm.formState.errors.body.message}</p>
                    )}
                  </div>

                  <Button type="submit" disabled={isTestEmailSending}>
                    {isTestEmailSending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send Test Email
                  </Button>
                </form>
                <Separator className="my-6" />
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Test Email Preview</CardTitle>
                    <CardDescription>How your test email will look.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {templatePreviewError && (
                      <p className="text-sm text-destructive mb-2">{templatePreviewError}</p>
                    )}
                    <iframe
                      srcDoc={fullTestEmailPreviewHtml}
                      className="w-full h-[500px] border rounded-md bg-background"
                      title="Test Email Preview"
                    />
                    {testEmailForm.watch("body") === "" && !templatePreviewError && (
                      <p className="text-muted-foreground text-sm text-center mt-4">No content to preview.</p>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SystemNotificationSettingsPage;