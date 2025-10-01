"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/integrations/api/client";
import {
  EyeIcon,
  EyeOffIcon,
  Lock,
  SecurityIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  Key
} from "@/lib/icons";
import { cn } from "@/lib/utils";

// Password validation schema
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[@$!%*?&]/, "Password must contain at least one special character"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;

interface PasswordChangeDialogProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Password strength calculator
const calculatePasswordStrength = (password: string): {
  score: number;
  label: string;
  color: string;
  requirements: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
  };
} => {
  const requirements = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };

  const score = Object.values(requirements).filter(Boolean).length;

  let label: string;
  let color: string;

  if (score <= 2) {
    label = "Weak";
    color = "bg-red-500";
  } else if (score <= 3) {
    label = "Fair";
    color = "bg-yellow-500";
  } else if (score <= 4) {
    label = "Good";
    color = "bg-blue-500";
  } else {
    label = "Strong";
    color = "bg-green-500";
  }

  return { score: (score / 5) * 100, label, color, requirements };
};

export const PasswordChangeDialog: React.FC<PasswordChangeDialogProps> = ({
  userId,
  isOpen,
  onOpenChange,
  onSuccess
}) => {
  const { toast } = useToast();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<PasswordChangeFormValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const { watch } = form;
  const newPassword = watch("newPassword");
  const passwordStrength = calculatePasswordStrength(newPassword || "");

  const changePasswordMutation = useMutation({
    mutationFn: async (values: PasswordChangeFormValues) => {
      const response = await apiClient.put(`/users/${userId}/password`, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });

      if (response.success !== true) {
        throw new Error(response.data?.error?.message || 'Password change failed');
      }

      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Password changed successfully",
        description: "Your password has been updated. Please keep it secure.",
        duration: 5000,
      });

      // Reset form
      form.reset();

      // Close dialog
      onOpenChange(false);

      // Call success callback
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Password change error:", error);
      toast({
        title: "Password change failed",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
        duration: 7000,
      });
    },
  });

  const onSubmit = (values: PasswordChangeFormValues) => {
    changePasswordMutation.mutate(values);
  };

  const handleClose = () => {
    if (!changePasswordMutation.isPending) {
      form.reset();
      onOpenChange(false);
    }
  };

  // Password requirement component
  const PasswordRequirement: React.FC<{ met: boolean; text: string }> = ({ met, text }) => (
    <div className={cn("flex items-center gap-2 text-sm", met ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
      {met ? (
        <CheckCircle2Icon className="h-3 w-3" />
      ) : (
        <XCircleIcon className="h-3 w-3" />
      )}
      {text}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Update your password to keep your account secure
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Current Password */}
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Current Password
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        {...field}
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter your current password"
                        disabled={changePasswordMutation.isPending}
                        className="pr-10"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      disabled={changePasswordMutation.isPending}
                    >
                      {showCurrentPassword ? (
                        <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New Password */}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <SecurityIcon className="h-4 w-4" />
                    New Password
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        {...field}
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter your new password"
                        disabled={changePasswordMutation.isPending}
                        className="pr-10"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={changePasswordMutation.isPending}
                    >
                      {showNewPassword ? (
                        <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Password strength:</span>
                        <span className={cn("font-medium", {
                          "text-red-600": passwordStrength.label === "Weak",
                          "text-yellow-600": passwordStrength.label === "Fair",
                          "text-blue-600": passwordStrength.label === "Good",
                          "text-green-600": passwordStrength.label === "Strong",
                        })}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <Progress
                        value={passwordStrength.score}
                        className="h-2"
                      />
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Confirm Password */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <SecurityIcon className="h-4 w-4" />
                    Confirm New Password
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        {...field}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your new password"
                        disabled={changePasswordMutation.isPending}
                        className="pr-10"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={changePasswordMutation.isPending}
                    >
                      {showConfirmPassword ? (
                        <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password Requirements */}
            {newPassword && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <AlertCircleIcon className="h-4 w-4" />
                  Password Requirements
                </h4>
                <div className="space-y-1">
                  <PasswordRequirement
                    met={passwordStrength.requirements.length}
                    text="At least 8 characters"
                  />
                  <PasswordRequirement
                    met={passwordStrength.requirements.lowercase}
                    text="One lowercase letter"
                  />
                  <PasswordRequirement
                    met={passwordStrength.requirements.uppercase}
                    text="One uppercase letter"
                  />
                  <PasswordRequirement
                    met={passwordStrength.requirements.number}
                    text="One number"
                  />
                  <PasswordRequirement
                    met={passwordStrength.requirements.special}
                    text="One special character (@$!%*?&)"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={changePasswordMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={changePasswordMutation.isPending || !form.formState.isValid}
                className="min-w-[120px]"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Change Password
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordChangeDialog;