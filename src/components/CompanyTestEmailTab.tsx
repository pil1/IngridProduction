"use client";

import { useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
// Lazy load RichTextEditor to reduce bundle size
const RichTextEditor = lazy(() => import("@/components/RichTextEditor"));
import { Checkbox } from "@/components/ui/checkbox";

const testEmailSchema = z.object({
  recipient_email: z.string().email("Invalid email address").min(1, "Recipient email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().optional(), // Optional if template is used
  use_template: z.boolean().default(false),
  template_name: z.string().optional(),
  template_variables: z.string().optional().nullable(), // JSON string
});

type TestEmailFormValues = z.infer<typeof testEmailSchema>;

interface CompanyEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface CompanyTestEmailTabProps {
  companyId: string;
}

const CompanyTestEmailTab = ({ companyId }: CompanyTestEmailTabProps) => {
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;

  const form = useForm<TestEmailFormValues>({
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

  const { data: templates, isLoading: isLoadingTemplates } = useQuery<CompanyEmailTemplate[]>({
    queryKey: ["companyEmailTemplates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.from("company_email_templates").select("id, name, subject, body").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !isLoadingSession,
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async (values: TestEmailFormValues) => {
      if (!companyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only send emails for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only send test emails for your own company.");
      }

      let parsedVariables = {};
      if (values.use_template && values.template_variables) {
        try {
          parsedVariables = JSON.parse(values.template_variables);
        } catch (e) {
          throw new Error("Invalid JSON for template variables.");
        }
      }

      const payload = {
        company_id: companyId,
        recipient_email: values.recipient_email,
        subject: values.subject,
        body: values.body,
        ...(values.use_template && {
          template_name: values.template_name,
          template_variables: parsedVariables,
        }),
      };

      const { data, error } = await supabase.functions.invoke("send-company-email", {
        body: payload,
      });
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

  const onSubmit = (values: TestEmailFormValues) => {
    sendTestEmailMutation.mutate(values);
  };

  const isLoadingPage = isLoadingSession || isLoadingTemplates;
  const isSending = sendTestEmailMutation.isPending;
  const useTemplate = form.watch("use_template");
  const selectedTemplateName = form.watch("template_name");

  useEffect(() => {
    if (useTemplate && selectedTemplateName && templates) {
      const selectedTemplate = templates.find(t => t.name === selectedTemplateName);
      if (selectedTemplate) {
        form.setValue("subject", selectedTemplate.subject);
        form.setValue("body", selectedTemplate.body);
      }
    } else if (!useTemplate) {
      form.setValue("subject", "");
      form.setValue("body", "");
    }
  }, [useTemplate, selectedTemplateName, templates, form]);

  const canSendTestEmail = userRole && (
    userRole === 'super-admin' ||
    (userRole === 'admin' && companyId === profile?.company_id)
  );

  if (isLoadingPage) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!canSendTestEmail) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: You do not have permission to send test emails for this company.</p>
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Send Test Email</CardTitle>
        <CardDescription>
          Send a test email using your company's configured SMTP settings or an email template.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="recipient_email">Recipient Email Address</Label>
            <Input id="recipient_email" type="email" {...form.register("recipient_email")} disabled={isSending} />
            {form.formState.errors.recipient_email && <p className="text-sm text-destructive">{form.formState.errors.recipient_email.message}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <Controller
              name="use_template"
              control={form.control}
              render={({ field }) => (
                <Checkbox
                  id="use_template"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSending}
                />
              )}
            />
            <Label htmlFor="use_template">Use an Email Template</Label>
          </div>

          {useTemplate && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="template_name">Select Template</Label>
                <Select
                  onValueChange={(value) => form.setValue("template_name", value)}
                  value={form.watch("template_name") ?? ""}
                  disabled={isSending || isLoadingTemplates}
                >
                  <SelectTrigger id="template_name">
                    <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select a template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.template_name && <p className="text-sm text-destructive">{form.formState.errors.template_name.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template_variables">Template Variables (JSON)</Label>
                <Textarea
                  id="template_variables"
                  {...form.register("template_variables")}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder='{"user_name": "John Doe", "expense_title": "Client Lunch"}'
                  disabled={isSending}
                />
                {form.formState.errors.template_variables && <p className="text-sm text-destructive">{form.formState.errors.template_variables.message}</p>}
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" {...form.register("subject")} disabled={isSending || useTemplate} />
            {form.formState.errors.subject && <p className="text-sm text-destructive">{form.formState.errors.subject.message}</p>}
          </div>

          <div className="grid gap-2 mb-6"> {/* Added mb-6 here */}
            <Label htmlFor="body">Body</Label>
            <Suspense fallback={<div className="h-32 bg-muted animate-pulse rounded" />}>
              <RichTextEditor
                value={form.watch("body") ?? ""}
                onChange={(value) => form.setValue("body", value)}
                placeholder="Enter email body here..."
                disabled={isSending || useTemplate}
              />
            </Suspense>
            {form.formState.errors.body && <p className="text-sm text-destructive">{form.formState.errors.body.message}</p>}
          </div>

          <Button type="submit" disabled={isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Test Email
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CompanyTestEmailTab;