"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Save, XCircle } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { Customer } from "@/pages/CustomersPage";

const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  contact_person: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z.string().optional().nullable(),
  address_line_1: z.string().optional().nullable(),
  address_line_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state_province: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  spire_customer_id: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  website: z.string().url("Invalid URL").or(z.literal('')).optional().nullable(), // FIX: Allow empty string
  tax_id: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  default_currency_code: z.string().min(1, "Default currency is required").default("USD"),
  notes: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(), // Spire's 'code'
  tax_exempt: z.boolean().default(false),
  credit_limit: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().positive("Credit limit must be positive").nullable().optional()
  ),
  payment_method: z.string().optional().nullable(),
  code: z.string().optional().nullable(), // Spire's 'code'
  receivable_account: z.string().optional().nullable(),
  upload_flag: z.boolean().default(true),
  discount_code: z.string().optional().nullable(),
  credit_type: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().nullable().optional()
  ),
  on_hold: z.boolean().default(false),
  reference_code: z.string().optional().nullable(),
  apply_finance_charges: z.boolean().default(false),
  user_def_1: z.string().optional().nullable(),
  background_color_int: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().nullable().optional()
  ),
  default_ship_to_code: z.string().optional().nullable(),
  foreground_color_int: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().nullable().optional()
  ),
  user_def_2: z.string().optional().nullable(),
  udf_data: z.record(z.unknown()).optional().nullable(), // JSONB record type
  statement_type: z.string().optional().nullable(),
  payment_provider_id_int: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().nullable().optional()
  ),
  special_code: z.string().optional().nullable(),
  spire_status: z.string().optional().nullable(),
  shipping_address_line_1: z.string().optional().nullable(),
  shipping_address_line_2: z.string().optional().nullable(),
  shipping_city: z.string().optional().nullable(),
  shipping_state_province: z.string().optional().nullable(),
  shipping_postal_code: z.string().optional().nullable(),
  shipping_country: z.string().optional().nullable(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>; // Explicitly export this type

interface AddEditCustomerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingCustomer?: Customer | null;
  companyId: string;
  initialMode: "add" | "view";
  prefillData?: Partial<CustomerFormValues> | null; // New prop for AI pre-fill data
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

const AddEditCustomerDialog = ({ isOpen, onOpenChange, editingCustomer, companyId, initialMode, prefillData }: AddEditCustomerDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;
  const [currentMode, setCurrentMode] = useState<"add" | "view" | "edit">(initialMode);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state_province: "",
      postal_code: "",
      country: "",
      spire_customer_id: "",
      is_active: true,
      website: "",
      tax_id: "",
      payment_terms: "",
      default_currency_code: "USD",
      notes: "",
      account_number: "",
      tax_exempt: false,
      credit_limit: undefined,
      payment_method: "",
      code: "",
      receivable_account: "",
      upload_flag: true,
      discount_code: "",
      credit_type: undefined,
      on_hold: false,
      reference_code: "",
      apply_finance_charges: false,
      user_def_1: "",
      background_color_int: undefined,
      default_ship_to_code: "",
      foreground_color_int: undefined,
      user_def_2: "",
      udf_data: {},
      statement_type: "",
      payment_provider_id_int: undefined,
      special_code: "",
      spire_status: "",
      shipping_address_line_1: "",
      shipping_address_line_2: "",
      shipping_city: "",
      shipping_state_province: "",
      shipping_postal_code: "",
      shipping_country: "",
    },
  });

  // Fetch available currencies
  const { data: currencies, isLoading: isLoadingCurrencies } = useQuery<Currency[]>({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("currencies").select("id, code, name, symbol").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isOpen) {
      setCurrentMode(initialMode); // Reset mode when dialog opens
      if (editingCustomer) {
        form.reset({
          name: editingCustomer.name,
          contact_person: editingCustomer.contact_person ?? "",
          email: editingCustomer.email ?? "",
          phone: editingCustomer.phone ?? "",
          address_line_1: editingCustomer.address_line_1 ?? "",
          address_line_2: editingCustomer.address_line_2 ?? "",
          city: editingCustomer.city ?? "",
          state_province: editingCustomer.state_province ?? "",
          postal_code: editingCustomer.postal_code ?? "",
          country: editingCustomer.country ?? "",
          spire_customer_id: editingCustomer.spire_customer_id ?? "",
          is_active: editingCustomer.is_active ?? true,
          website: editingCustomer.website ?? "",
          tax_id: editingCustomer.tax_id ?? "",
          payment_terms: editingCustomer.payment_terms ?? "",
          default_currency_code: editingCustomer.default_currency_code ?? "USD",
          notes: editingCustomer.notes ?? "",
          account_number: editingCustomer.account_number ?? "",
          tax_exempt: editingCustomer.tax_exempt ?? false,
          credit_limit: editingCustomer.credit_limit ?? undefined,
          payment_method: editingCustomer.payment_method ?? "",
          code: editingCustomer.code ?? "",
          receivable_account: editingCustomer.receivable_account ?? "",
          upload_flag: editingCustomer.upload_flag ?? true,
          discount_code: editingCustomer.discount_code ?? "",
          credit_type: editingCustomer.credit_type ?? undefined,
          on_hold: editingCustomer.on_hold ?? false,
          reference_code: editingCustomer.reference_code ?? "",
          apply_finance_charges: editingCustomer.apply_finance_charges ?? false,
          user_def_1: editingCustomer.user_def_1 ?? "",
          background_color_int: editingCustomer.background_color_int ?? undefined,
          default_ship_to_code: editingCustomer.default_ship_to_code ?? "",
          foreground_color_int: editingCustomer.foreground_color_int ?? undefined,
          user_def_2: editingCustomer.user_def_2 ?? "",
          udf_data: editingCustomer.udf_data ?? {} as Record<string, unknown>,
          statement_type: editingCustomer.statement_type ?? "",
          payment_provider_id_int: editingCustomer.payment_provider_id_int ?? undefined,
          special_code: editingCustomer.special_code ?? "",
          spire_status: editingCustomer.spire_status ?? "",
          shipping_address_line_1: editingCustomer.shipping_address_line_1 ?? "",
          shipping_address_line_2: editingCustomer.shipping_address_line_2 ?? "",
          shipping_city: editingCustomer.shipping_city ?? "",
          shipping_state_province: editingCustomer.state_province ?? "",
          shipping_postal_code: editingCustomer.postal_code ?? "",
          shipping_country: editingCustomer.country ?? "",
        });
      } else if (prefillData) { // Apply pre-fill data if available
        form.reset({
          name: prefillData.name ?? "",
          contact_person: prefillData.contact_person ?? "",
          email: prefillData.email ?? "",
          phone: prefillData.phone ?? "",
          address_line_1: prefillData.address_line_1 ?? "",
          address_line_2: prefillData.address_line_2 ?? "",
          city: prefillData.city ?? "",
          state_province: prefillData.state_province ?? "",
          postal_code: prefillData.postal_code ?? "",
          country: prefillData.country ?? "",
          spire_customer_id: prefillData.spire_customer_id ?? "",
          is_active: prefillData.is_active ?? true,
          website: prefillData.website ?? "",
          tax_id: prefillData.tax_id ?? "",
          payment_terms: prefillData.payment_terms ?? "",
          default_currency_code: prefillData.default_currency_code ?? "USD",
          notes: prefillData.notes ?? "",
          account_number: prefillData.account_number ?? "",
          tax_exempt: prefillData.tax_exempt ?? false,
          credit_limit: prefillData.credit_limit ?? undefined,
          payment_method: prefillData.payment_method ?? "",
          code: prefillData.code ?? "",
          receivable_account: prefillData.receivable_account ?? "",
          upload_flag: prefillData.upload_flag ?? true,
          discount_code: prefillData.discount_code ?? "",
          credit_type: prefillData.credit_type ?? undefined,
          on_hold: prefillData.on_hold ?? false,
          reference_code: prefillData.reference_code ?? "",
          apply_finance_charges: prefillData.apply_finance_charges ?? false,
          user_def_1: prefillData.user_def_1 ?? "",
          background_color_int: prefillData.background_color_int ?? undefined,
          default_ship_to_code: prefillData.default_ship_to_code ?? "",
          foreground_color_int: prefillData.foreground_color_int ?? undefined,
          user_def_2: prefillData.user_def_2 ?? "",
          udf_data: prefillData.udf_data ?? {} as Record<string, unknown>,
          statement_type: prefillData.statement_type ?? "",
          payment_provider_id_int: prefillData.payment_provider_id_int ?? undefined,
          special_code: prefillData.special_code ?? "",
          spire_status: prefillData.spire_status ?? "",
          shipping_address_line_1: prefillData.shipping_address_line_1 ?? "",
          shipping_address_line_2: prefillData.shipping_address_line_2 ?? "",
          shipping_city: prefillData.shipping_city ?? "",
          shipping_state_province: prefillData.state_province ?? "",
          shipping_postal_code: prefillData.postal_code ?? "",
          shipping_country: prefillData.country ?? "",
        });
        setCurrentMode("add"); // Always start in add mode when pre-filling
      } else {
        form.reset({
          name: "",
          contact_person: "",
          email: "",
          phone: "",
          address_line_1: "",
          address_line_2: "",
          city: "",
          state_province: "",
          postal_code: "",
          country: "",
          spire_customer_id: "",
          is_active: true,
          website: "",
          tax_id: "",
          payment_terms: "",
          default_currency_code: "USD",
          notes: "",
          account_number: "",
          tax_exempt: false,
          credit_limit: undefined,
          payment_method: "",
          code: "",
          receivable_account: "",
          upload_flag: true,
          discount_code: "",
          credit_type: undefined,
          on_hold: false,
          reference_code: "",
          apply_finance_charges: false,
          user_def_1: "",
          background_color_int: undefined,
          default_ship_to_code: "",
          foreground_color_int: undefined,
          user_def_2: "",
          udf_data: {},
          statement_type: "",
          payment_provider_id_int: undefined,
          special_code: "",
          spire_status: "",
          shipping_address_line_1: "",
          shipping_address_line_2: "",
          shipping_city: "",
          shipping_state_province: "",
          shipping_postal_code: "",
          shipping_country: "",
        });
      }
    }
  }, [isOpen, editingCustomer, form, initialMode, prefillData]);

  const upsertCustomerMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (!userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
        throw new Error("Access Denied: You do not have permission to manage customers.");
      }
      if (userRole !== 'super-admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage customers for your own company.");
      }

      const payload = {
        ...values,
        company_id: companyId,
        udf_data: values.udf_data ?? {} as Record<string, unknown>, // Ensure JSONB is an object
      };

      if (editingCustomer) {
        const { error } = await supabase.from("customers").update({
          ...payload,
          updated_at: new Date().toISOString(),
        }).eq("id", editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Customer Saved",
        description: "Customer details have been successfully saved.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error Saving Customer",
        description: error.message ?? "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CustomerFormValues) => {
    upsertCustomerMutation.mutate(values);
  };

  const isLoading = isLoadingSession || upsertCustomerMutation.isPending || isLoadingCurrencies;
  const isReadOnly = currentMode === "view";

  return (
    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editingCustomer ? (isReadOnly ? "View Customer" : "Edit Customer") : "Add New Customer"}</DialogTitle>
        <DialogDescription>
          {editingCustomer ? (isReadOnly ? "Details of this customer." : "Update the details of this customer.") : "Add a new customer to your company's records."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        {/* General Information */}
        <h3 className="text-lg font-semibold">General Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name</Label>
            <Input id="name" {...form.register("name")} disabled={isLoading || isReadOnly} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact Person (Optional)</Label>
            <Input id="contact_person" {...form.register("contact_person")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input id="email" type="email" {...form.register("email")} disabled={isLoading || isReadOnly} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input id="phone" {...form.register("phone")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website (Optional)</Label>
            <Input id="website" type="url" {...form.register("website")} disabled={isLoading || isReadOnly} />
            {form.formState.errors.website && (
              <p className="text-sm text-destructive">{form.formState.errors.website.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID (Optional)</Label>
            <Input id="tax_id" {...form.register("tax_id")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_number">Account Number (Optional)</Label>
            <Input id="account_number" {...form.register("account_number")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spire_customer_id">Spire Customer ID (Optional)</Label>
            <Input id="spire_customer_id" {...form.register("spire_customer_id")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Spire Code (Optional)</Label>
            <Input id="code" {...form.register("code")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="special_code">Special Code (Optional)</Label>
            <Input id="special_code" {...form.register("special_code")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="spire_status">Spire Status (Optional)</Label>
            <Input id="spire_status" {...form.register("spire_status")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        {/* Billing Address */}
        <h3 className="text-lg font-semibold mt-6">Billing Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address_line_1">Address Line 1 (Optional)</Label>
            <Input id="address_line_1" {...form.register("address_line_1")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line_2">Address Line 2 (Optional)</Label>
            <Input id="address_line_2" {...form.register("address_line_2")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City (Optional)</Label>
            <Input id="city" {...form.register("city")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state_province">State/Province (Optional)</Label>
            <Input id="state_province" {...form.register("state_province")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal_code">Zip/Postal Code (Optional)</Label>
            <Input id="postal_code" {...form.register("postal_code")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country (Optional)</Label>
            <Input id="country" {...form.register("country")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        {/* Shipping Address */}
        <h3 className="text-lg font-semibold mt-6">Default Shipping Address</h3>
        <p className="text-sm text-muted-foreground">For a single default shipping address. Multiple shipping addresses would require a separate table.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shipping_address_line_1">Address Line 1 (Optional)</Label>
            <Input id="shipping_address_line_1" {...form.register("shipping_address_line_1")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_address_line_2">Address Line 2 (Optional)</Label>
            <Input id="shipping_address_line_2" {...form.register("shipping_address_line_2")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_city">City (Optional)</Label>
            <Input id="shipping_city" {...form.register("shipping_city")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_state_province">State/Province (Optional)</Label>
            <Input id="shipping_state_province" {...form.register("shipping_state_province")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_postal_code">Zip/Postal Code (Optional)</Label>
            <Input id="shipping_postal_code" {...form.register("shipping_postal_code")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_country">Country (Optional)</Label>
            <Input id="shipping_country" {...form.register("shipping_country")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        {/* Financial & Other Details */}
        <h3 className="text-lg font-semibold mt-6">Financial & Other Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="default_currency_code">Default Currency</Label>
            <Select
              onValueChange={(value) => form.setValue("default_currency_code", value)}
              value={form.watch("default_currency_code") ?? ""}
              disabled={isLoading || isReadOnly}
            >
              <SelectTrigger id="default_currency_code">
                <SelectValue placeholder="Select default currency" />
              </SelectTrigger>
            <SelectContent>
              {currencies?.map((currency: Currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name} ({currency.symbol})
                </SelectItem>
              ))}
            </SelectContent>
            </Select>
            {form.formState.errors.default_currency_code && (
              <p className="text-sm text-destructive">{form.formState.errors.default_currency_code.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_terms">Payment Terms (Optional)</Label>
            <Input id="payment_terms" {...form.register("payment_terms")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit_limit">Credit Limit (Optional)</Label>
            <Input id="credit_limit" type="number" step="0.01" {...form.register("credit_limit", { valueAsNumber: true })} disabled={isLoading || isReadOnly} />
            {form.formState.errors.credit_limit && (
              <p className="text-sm text-destructive">{form.formState.errors.credit_limit.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method (Optional)</Label>
            <Input id="payment_method" {...form.register("payment_method")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receivable_account">Receivable Account (Optional)</Label>
            <Input id="receivable_account" {...form.register("receivable_account")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit_type">Credit Type (Optional)</Label>
            <Input id="credit_type" type="number" step="1" {...form.register("credit_type", { valueAsNumber: true })} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statement_type">Statement Type (Optional)</Label>
            <Input id="statement_type" {...form.register("statement_type")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_provider_id_int">Payment Provider ID (Optional)</Label>
            <Input id="payment_provider_id_int" type="number" step="1" {...form.register("payment_provider_id_int", { valueAsNumber: true })} disabled={isLoading || isReadOnly} />
          </div>
          <div className="flex items-center space-x-2 col-span-1">
            <Checkbox
              id="tax_exempt"
              checked={form.watch("tax_exempt")}
              onCheckedChange={(checked) => form.setValue("tax_exempt", checked as boolean)}
              disabled={isLoading || isReadOnly}
            />
            <Label htmlFor="tax_exempt">Tax Exempt</Label>
          </div>
          <div className="flex items-center space-x-2 col-span-1">
            <Checkbox
              id="on_hold"
              checked={form.watch("on_hold")}
              onCheckedChange={(checked) => form.setValue("on_hold", checked as boolean)}
              disabled={isLoading || isReadOnly}
            />
            <Label htmlFor="on_hold">On Hold</Label>
          </div>
          <div className="flex items-center space-x-2 col-span-1">
            <Checkbox
              id="apply_finance_charges"
              checked={form.watch("apply_finance_charges")}
              onCheckedChange={(checked) => form.setValue("apply_finance_charges", checked as boolean)}
              disabled={isLoading || isReadOnly}
            />
            <Label htmlFor="apply_finance_charges">Apply Finance Charges</Label>
          </div>
          <div className="flex items-center space-x-2 col-span-1">
            <Checkbox
              id="upload_flag"
              checked={form.watch("upload_flag")}
              onCheckedChange={(checked) => form.setValue("upload_flag", checked as boolean)}
              disabled={isLoading || isReadOnly}
            />
            <Label htmlFor="upload_flag">Upload Flag</Label>
          </div>
        </div>

        {/* User Defined Fields */}
        <h3 className="text-lg font-semibold mt-6">User Defined Fields</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user_def_1">User Defined 1 (Optional)</Label>
            <Input id="user_def_1" {...form.register("user_def_1")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user_def_2">User Defined 2 (Optional)</Label>
            <Input id="user_def_2" {...form.register("user_def_2")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="background_color_int">Background Color (Integer) (Optional)</Label>
            <Input id="background_color_int" type="number" step="1" {...form.register("background_color_int", { valueAsNumber: true })} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="foreground_color_int">Foreground Color (Integer) (Optional)</Label>
            <Input id="foreground_color_int" type="number" step="1" {...form.register("foreground_color_int", { valueAsNumber: true })} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2 col-span-full">
            <Label htmlFor="udf_data">UDF Data (JSON) (Optional)</Label>
            <Textarea
              id="udf_data"
              value={form.watch("udf_data") ? JSON.stringify(form.watch("udf_data"), null, 2) : ""}
              onChange={(e) => {
                try {
                  form.setValue("udf_data", JSON.parse(e.target.value));
                } catch {
                  // Invalid JSON, do nothing or show error
                }
              }}
              disabled={isLoading || isReadOnly}
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Enter valid JSON for User Defined Fields.</p>
          </div>
        </div>

        {/* Notes and Active Status */}
        <h3 className="text-lg font-semibold mt-6">Notes & Status</h3>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea id="notes" {...form.register("notes")} disabled={isLoading || isReadOnly} rows={3} />
        </div>
        <div className="flex items-center space-x-2 mt-2">
          <Checkbox
            id="is_active"
            checked={form.watch("is_active")}
            onCheckedChange={(checked) => form.setValue("is_active", checked as boolean)}
            disabled={isLoading || isReadOnly}
          />
          <Label htmlFor="is_active">Active Customer</Label>
        </div>

        {currentMode !== "view" && (
          <Button type="submit" disabled={isLoading || !form.formState.isDirty} className="mt-6">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Customer
          </Button>
        )}
      </form>
      <DialogFooter>
        {isReadOnly && (
          <Button onClick={() => setCurrentMode("edit")} disabled={isLoading} variant="secondary">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Button>
        )}
        {!isReadOnly && (
          <Button
            variant="outline"
            onClick={() => {
              if (editingCustomer) {
                setCurrentMode("view"); // Go back to view mode if editing an existing customer
                // Manually reset form fields to original editingCustomer values, handling nulls
                form.reset({
                  name: editingCustomer.name,
                  contact_person: editingCustomer.contact_person ?? "",
                  email: editingCustomer.email ?? "",
                  phone: editingCustomer.phone ?? "",
                  address_line_1: editingCustomer.address_line_1 ?? "",
                  address_line_2: editingCustomer.address_line_2 ?? "",
                  city: editingCustomer.city ?? "",
                  state_province: editingCustomer.state_province ?? "",
                  postal_code: editingCustomer.postal_code ?? "",
                  country: editingCustomer.country ?? "",
                  spire_customer_id: editingCustomer.spire_customer_id ?? "",
                  is_active: editingCustomer.is_active ?? true,
                  website: editingCustomer.website ?? "",
                  tax_id: editingCustomer.tax_id ?? "",
                  payment_terms: editingCustomer.payment_terms ?? "",
                  default_currency_code: editingCustomer.default_currency_code ?? "USD",
                  notes: editingCustomer.notes ?? "",
                  account_number: editingCustomer.account_number ?? "",
                  tax_exempt: editingCustomer.tax_exempt ?? false,
                  credit_limit: editingCustomer.credit_limit ?? undefined,
                  payment_method: editingCustomer.payment_method ?? "",
                  code: editingCustomer.code ?? "",
                  receivable_account: editingCustomer.receivable_account ?? "",
                  upload_flag: editingCustomer.upload_flag ?? true,
                  discount_code: editingCustomer.discount_code ?? "",
                  credit_type: editingCustomer.credit_type ?? undefined,
                  on_hold: editingCustomer.on_hold ?? false,
                  reference_code: editingCustomer.reference_code ?? "",
                  apply_finance_charges: editingCustomer.apply_finance_charges ?? false,
                  user_def_1: editingCustomer.user_def_1 ?? "",
                  background_color_int: editingCustomer.background_color_int ?? undefined,
                  default_ship_to_code: editingCustomer.default_ship_to_code ?? "",
                  foreground_color_int: editingCustomer.foreground_color_int ?? undefined,
                  user_def_2: editingCustomer.user_def_2 ?? "",
                  udf_data: editingCustomer.udf_data ?? {} as Record<string, unknown>,
                  statement_type: editingCustomer.statement_type ?? "",
                  payment_provider_id_int: editingCustomer.payment_provider_id_int ?? undefined,
                  special_code: editingCustomer.special_code ?? "",
                  spire_status: editingCustomer.spire_status ?? "",
                  shipping_address_line_1: editingCustomer.shipping_address_line_1 ?? "",
                  shipping_address_line_2: editingCustomer.shipping_address_line_2 ?? "",
                  shipping_city: editingCustomer.shipping_city ?? "",
                  shipping_state_province: editingCustomer.state_province ?? "",
                  shipping_postal_code: editingCustomer.postal_code ?? "",
                  shipping_country: editingCustomer.country ?? "",
                });
              } else {
                onOpenChange(false); // Close dialog if adding a new customer
              }
            }}
            disabled={isLoading}
          >
            <XCircle className="mr-2 h-4 w-4" /> Cancel
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default AddEditCustomerDialog;