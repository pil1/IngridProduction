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
import { Vendor } from "@/pages/VendorsPage";

const vendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  contact_person: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z.string().optional().nullable(),
  address_line_1: z.string().optional().nullable(),
  address_line_2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state_province: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  spire_id: z.string().optional().nullable(), // Spire's vendorNo
  is_active: z.boolean().default(true),
  website: z.string().url("Invalid URL").or(z.literal('')).optional().nullable(), // FIX: Allow empty string
  tax_id: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  default_currency_code: z.string().min(1, "Default currency is required").default("USD"),
  notes: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  tax_exempt: z.boolean().default(false),
  credit_limit: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "Credit limit must be non-negative").default(0)
  ),
  payment_method: z.string().optional().nullable(),
  shipping_address_line_1: z.string().optional().nullable(),
  shipping_address_line_2: z.string().optional().nullable(),
  shipping_city: z.string().optional().nullable(),
  shipping_state_province: z.string().optional().nullable(),
  shipping_postal_code: z.string().optional().nullable(),
  shipping_country: z.string().optional().nullable(),
  shipping_addresses_data: z.any().optional().nullable(), // New field for Spire's array of shipping addresses
});

export type VendorFormValues = z.infer<typeof vendorSchema>; // Explicitly export this type

interface AddEditVendorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingVendor?: Vendor | null;
  companyId: string;
  initialMode: "add" | "view";
  prefillData?: Partial<VendorFormValues> | null; // New prop for AI pre-fill data
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

const AddEditVendorDialog = ({ isOpen, onOpenChange, editingVendor, companyId, initialMode, prefillData }: AddEditVendorDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;
  const [currentMode, setCurrentMode] = useState<"add" | "view" | "edit">(initialMode);

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
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
      spire_id: "",
      is_active: true,
      website: "",
      tax_id: "",
      payment_terms: "",
      default_currency_code: "USD",
      notes: "",
      account_number: "",
      tax_exempt: false,
      credit_limit: 0,
      payment_method: "",
      shipping_address_line_1: "",
      shipping_address_line_2: "",
      shipping_city: "",
      shipping_state_province: "",
      shipping_postal_code: "",
      shipping_country: "",
      shipping_addresses_data: null,
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
      if (editingVendor) {
        form.reset({
          name: editingVendor.name,
          contact_person: editingVendor.contact_person || "",
          email: editingVendor.email || "",
          phone: editingVendor.phone || "",
          address_line_1: editingVendor.address_line_1 || "",
          address_line_2: editingVendor.address_line_2 || "",
          city: editingVendor.city || "",
          state_province: editingVendor.state_province || "",
          postal_code: editingVendor.postal_code || "",
          country: editingVendor.country || "",
          spire_id: editingVendor.spire_id || "",
          is_active: editingVendor.is_active ?? true,
          website: editingVendor.website || "",
          tax_id: editingVendor.tax_id || "",
          payment_terms: editingVendor.payment_terms || "",
          default_currency_code: editingVendor.default_currency_code || "USD",
          notes: editingVendor.notes || "",
          account_number: editingVendor.account_number || "",
          tax_exempt: editingVendor.tax_exempt ?? false,
          credit_limit: editingVendor.credit_limit ?? 0,
          payment_method: editingVendor.payment_method || "",
          shipping_address_line_1: editingVendor.shipping_address_line_1 || "",
          shipping_address_line_2: editingVendor.shipping_address_line_2 || "",
          shipping_city: editingVendor.shipping_city || "",
          shipping_state_province: editingVendor.state_province || "",
          shipping_postal_code: editingVendor.postal_code || "",
          shipping_country: editingVendor.country || "",
          shipping_addresses_data: editingVendor.shipping_addresses_data || null,
        });
      } else if (prefillData) { // Apply pre-fill data if available
        form.reset({
          name: prefillData.name || "",
          contact_person: prefillData.contact_person || "",
          email: prefillData.email || "",
          phone: prefillData.phone || "",
          address_line_1: prefillData.address_line_1 || "",
          address_line_2: prefillData.address_line_2 || "",
          city: prefillData.city || "",
          state_province: prefillData.state_province || "",
          postal_code: prefillData.postal_code || "",
          country: prefillData.country || "",
          spire_id: prefillData.spire_id || "",
          is_active: prefillData.is_active ?? true,
          website: prefillData.website || "",
          tax_id: prefillData.tax_id || "",
          payment_terms: prefillData.payment_terms || "",
          default_currency_code: prefillData.default_currency_code || "USD",
          notes: prefillData.notes || "",
          account_number: prefillData.account_number || "",
          tax_exempt: prefillData.tax_exempt ?? false,
          credit_limit: prefillData.credit_limit ?? 0,
          payment_method: prefillData.payment_method || "",
          shipping_address_line_1: prefillData.shipping_address_line_1 || "",
          shipping_address_line_2: prefillData.shipping_address_line_2 || "",
          shipping_city: prefillData.shipping_city || "",
          shipping_state_province: prefillData.state_province || "",
          shipping_postal_code: prefillData.postal_code || "",
          shipping_country: prefillData.country || "",
          shipping_addresses_data: prefillData.shipping_addresses_data || null,
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
          spire_id: "",
          is_active: true,
          website: "",
          tax_id: "",
          payment_terms: "",
          default_currency_code: "USD",
          notes: "",
          account_number: "",
          tax_exempt: false,
          credit_limit: 0,
          payment_method: "",
          shipping_address_line_1: "",
          shipping_address_line_2: "",
          shipping_city: "",
          shipping_state_province: "",
          shipping_postal_code: "",
          shipping_country: "",
          shipping_addresses_data: null,
        });
      }
    }
  }, [isOpen, editingVendor, form, initialMode, prefillData]);

  const upsertVendorMutation = useMutation({
    mutationFn: async (values: VendorFormValues) => {
      if (!userRole || !['admin', 'controller', 'super-admin'].includes(userRole)) {
        throw new Error("Access Denied: You do not have permission to manage vendors.");
      }
      if (userRole !== 'super-admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage vendors for your own company.");
      }

      const payload = {
        ...values,
        company_id: companyId,
        shipping_addresses_data: values.shipping_addresses_data || null,
      };

      if (editingVendor) {
        const { error } = await supabase.from("vendors").update({
          ...payload,
          updated_at: new Date().toISOString(),
        }).eq("id", editingVendor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vendors").insert(payload);
        if (error) throw error;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast({
        title: "Vendor Saved",
        description: "Vendor details have been successfully saved.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error Saving Vendor",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: VendorFormValues) => {
    upsertVendorMutation.mutate(values);
  };

  const isLoading = isLoadingSession || upsertVendorMutation.isPending || isLoadingCurrencies;
  const isReadOnly = currentMode === "view";

  return (
    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editingVendor ? (isReadOnly ? "View Vendor" : "Edit Vendor") : "Add New Vendor"}</DialogTitle>
        <DialogDescription>
          {editingVendor ? (isReadOnly ? "Details of this vendor." : "Update the details of this vendor.") : "Add a new vendor to your company's records."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Vendor Name</Label>
            <Input id="name" {...form.register("name")} disabled={isLoading || isReadOnly} />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account_number">Account Number (Optional)</Label>
            <Input id="account_number" {...form.register("account_number")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID (Optional)</Label>
            <Input id="tax_id" {...form.register("tax_id")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="flex items-center space-x-2 mt-6">
            <Checkbox
              id="tax_exempt"
              checked={form.watch("tax_exempt")}
              onCheckedChange={(checked) => form.setValue("tax_exempt", checked as boolean)}
              disabled={isLoading || isReadOnly}
            />
            <Label htmlFor="tax_exempt">Tax Exempt</Label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="credit_limit">Credit Limit</Label>
            <Input id="credit_limit" type="number" step="0.01" {...form.register("credit_limit", { valueAsNumber: true })} disabled={isLoading || isReadOnly} />
            {form.formState.errors.credit_limit && (
              <p className="text-sm text-destructive">{form.formState.errors.credit_limit.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_terms">Payment Terms (Optional)</Label>
            <Input id="payment_terms" {...form.register("payment_terms")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_method">Payment Method (Optional)</Label>
          <Input id="payment_method" {...form.register("payment_method")} disabled={isLoading || isReadOnly} />
        </div>

        <h4 className="text-md font-semibold mt-4">Billing Address</h4>
        <div className="space-y-2">
          <Label htmlFor="address_line_1">Address Line 1 (Optional)</Label>
          <Input id="address_line_1" {...form.register("address_line_1")} disabled={isLoading || isReadOnly} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_line_2">Address Line 2 (Optional)</Label>
          <Input id="address_line_2" {...form.register("address_line_2")} disabled={isLoading || isReadOnly} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City (Optional)</Label>
            <Input id="city" {...form.register("city")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state_province">State/Province (Optional)</Label>
            <Input id="state_province" {...form.register("state_province")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="postal_code">Zip/Postal Code (Optional)</Label>
            <Input id="postal_code" {...form.register("postal_code")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country (Optional)</Label>
            <Input id="country" {...form.register("country")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        <h4 className="text-md font-semibold mt-4">Shipping Address (Optional)</h4>
        <div className="space-y-2">
          <Label htmlFor="shipping_address_line_1">Shipping Address Line 1</Label>
          <Input id="shipping_address_line_1" {...form.register("shipping_address_line_1")} disabled={isLoading || isReadOnly} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipping_address_line_2">Shipping Address Line 2</Label>
          <Input id="shipping_address_line_2" {...form.register("shipping_address_line_2")} disabled={isLoading || isReadOnly} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shipping_city">Shipping City</Label>
            <Input id="shipping_city" {...form.register("shipping_city")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_state_province">Shipping State/Province</Label>
            <Input id="shipping_state_province" {...form.register("shipping_state_province")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shipping_postal_code">Shipping Zip/Postal Code</Label>
            <Input id="shipping_postal_code" {...form.register("shipping_postal_code")} disabled={isLoading || isReadOnly} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipping_country">Shipping Country</Label>
            <Input id="shipping_country" {...form.register("shipping_country")} disabled={isLoading || isReadOnly} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_currency_code">Default Currency</Label>
          <Select
            onValueChange={(value) => form.setValue("default_currency_code", value)}
            value={form.watch("default_currency_code")}
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
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea id="notes" {...form.register("notes")} disabled={isLoading || isReadOnly} rows={3} />
        </div>

        <h4 className="text-md font-semibold mt-4">Spire Integration Details</h4>
        <div className="space-y-2">
          <Label htmlFor="spire_id">Spire ID (vendorNo)</Label>
          <Input id="spire_id" {...form.register("spire_id")} disabled={isLoading || isReadOnly} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipping_addresses_data">Spire Shipping Addresses (JSON Array - Advanced)</Label>
          <Textarea
            id="shipping_addresses_data"
            value={form.watch("shipping_addresses_data") ? JSON.stringify(form.watch("shipping_addresses_data"), null, 2) : ""}
            onChange={(e) => {
              try {
                form.setValue("shipping_addresses_data", JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, do nothing or show error
              }
            }}
            disabled={isLoading || isReadOnly}
            rows={5}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">Enter valid JSON array for Spire's `shippingAddresses`.</p>
        </div>

        <div className="flex items-center space-x-2 mt-2">
          <Checkbox
            id="is_active"
            checked={form.watch("is_active")}
            onCheckedChange={(checked) => form.setValue("is_active", checked as boolean)}
            disabled={isLoading || isReadOnly}
          />
          <Label htmlFor="is_active">Active Vendor</Label>
        </div>

        {currentMode !== "view" && (
          <Button type="submit" disabled={isLoading || !form.formState.isDirty} className="mt-6">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Vendor
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
              if (editingVendor) {
                setCurrentMode("view"); // Go back to view mode if editing an existing vendor
                // Manually reset form fields to original editingVendor values, handling nulls
                form.reset({
                  name: editingVendor.name,
                  contact_person: editingVendor.contact_person || "",
                  email: editingVendor.email || "",
                  phone: editingVendor.phone || "",
                  address_line_1: editingVendor.address_line_1 || "",
                  address_line_2: editingVendor.address_line_2 || "",
                  city: editingVendor.city || "",
                  state_province: editingVendor.state_province || "",
                  postal_code: editingVendor.postal_code || "",
                  country: editingVendor.country || "",
                  spire_id: editingVendor.spire_id || "",
                  is_active: editingVendor.is_active ?? true,
                  website: editingVendor.website || "",
                  tax_id: editingVendor.tax_id || "",
                  payment_terms: editingVendor.payment_terms || "",
                  default_currency_code: editingVendor.default_currency_code || "USD",
                  notes: editingVendor.notes || "",
                  account_number: editingVendor.account_number || "",
                  tax_exempt: editingVendor.tax_exempt ?? false,
                  credit_limit: editingVendor.credit_limit ?? 0,
                  payment_method: editingVendor.payment_method || "",
                  shipping_address_line_1: editingVendor.shipping_address_line_1 || "",
                  shipping_address_line_2: editingVendor.shipping_address_line_2 || "",
                  shipping_city: editingVendor.shipping_city || "",
                  shipping_state_province: editingVendor.state_province || "",
                  shipping_postal_code: editingVendor.postal_code || "",
                  shipping_country: editingVendor.country || "",
                  shipping_addresses_data: editingVendor.shipping_addresses_data || null,
                });
              } else {
                onOpenChange(false); // Close dialog if adding a new vendor
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

export default AddEditVendorDialog;