"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";

const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  is_main_location: z.boolean().default(false),
});

type LocationFormValues = z.infer<typeof locationSchema>;

export interface CompanyLocation {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  is_main_location: boolean;
  created_at: string;
  updated_at: string;
}

interface AddEditLocationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingLocation?: CompanyLocation | null;
  companyId: string | null; // Add companyId prop
}

const AddEditLocationDialog = ({ isOpen, onOpenChange, editingLocation, companyId }: AddEditLocationDialogProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile, isLoading: isLoadingSession } = useSession();

  const userRole = profile?.role;

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      country: "",
      is_main_location: false,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (editingLocation) {
        form.reset({
          name: editingLocation.name,
          address: editingLocation.address,
          city: editingLocation.city,
          state: editingLocation.state,
          zip_code: editingLocation.zip_code,
          country: editingLocation.country,
          is_main_location: editingLocation.is_main_location,
        });
      } else {
        form.reset({
          name: "",
          address: "",
          city: "",
          state: "",
          zip_code: "",
          country: "",
          is_main_location: false,
        });
      }
    }
  }, [isOpen, editingLocation, form]);

  const upsertLocationMutation = useMutation({
    mutationFn: async (values: LocationFormValues) => {
      if (!companyId) throw new Error("Company ID not found.");

      // Authorization check: Admins can only manage locations for their own company
      if (userRole === 'admin' && companyId !== profile?.company_id) {
        throw new Error("Access Denied: You can only manage locations for your own company.");
      }

      const payload = {
        ...values,
        company_id: companyId,
      };

      if (editingLocation) {
        const { error } = await supabase.from("company_locations").update({
          ...payload,
          updated_at: new Date().toISOString(),
        }).eq("id", editingLocation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_locations").insert(payload);
        if (error) throw error;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyLocations", companyId] });
      toast({
        title: "Location Saved",
        description: "Company location has been successfully saved.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error Saving Location",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: LocationFormValues) => {
    upsertLocationMutation.mutate(values);
  };

  const isLoading = isLoadingSession || upsertLocationMutation.isPending;

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{editingLocation ? "Edit Location" : "Add New Location"}</DialogTitle>
        <DialogDescription>
          {editingLocation ? "Update the details of this company location." : "Add a new physical location for your company."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Location Name</Label>
          <Input id="name" {...form.register("name")} disabled={isLoading} />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" {...form.register("address")} disabled={isLoading} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...form.register("city")} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State/Province</Label>
            <Input id="state" {...form.register("state")} disabled={isLoading} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="zip_code">Zip/Postal Code</Label>
            <Input id="zip_code" {...form.register("zip_code")} disabled={isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...form.register("country")} disabled={isLoading} />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_main_location"
            checked={form.watch("is_main_location")}
            onCheckedChange={(checked) => form.setValue("is_main_location", checked as boolean)}
            disabled={isLoading}
          />
          <Label htmlFor="is_main_location">Set as Main Location</Label>
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Location
        </Button>
      </form>
    </DialogContent>
  );
};

export default AddEditLocationDialog;