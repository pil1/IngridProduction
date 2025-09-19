"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/components/SessionContextProvider";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useQueryClient } from "@tanstack/react-query";

const AcceptInvitationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, isLoading: isLoadingSession } = useSession();
  const queryClient = useQueryClient();

  const [invitationStatus, setInvitationStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const invitationToken = searchParams.get("token");

  useEffect(() => {
    const handleAcceptInvitation = async () => {
      if (!invitationToken) {
        setInvitationStatus("error");
        setErrorMessage("No invitation token found in the URL.");
        toast({
          title: "Error",
          description: "No invitation token found.",
          variant: "destructive",
        });
        return;
      }

      if (session) {
        setInvitationStatus("processing");
        // The RPC function now returns a JSON object { success: boolean, error_message?: string }
        const { data, error } = await supabase.rpc("accept_invitation", { invitation_token: invitationToken });

        if (error) {
          // Supabase RPC error (e.g., network, RLS, function execution error)
          setInvitationStatus("error");
          setErrorMessage(error.message ?? "Failed to accept invitation due to a server error.");
          toast({
            title: "Error accepting invitation",
            description: error.message ?? "An unexpected server error occurred.",
            variant: "destructive",
          });
        } else if (data && typeof data === 'object' && 'success' in data) {
          // Custom error/success from the RPC function's JSON response
          if (data.success) {
            setInvitationStatus("success");
            toast({
              title: "Invitation Accepted!",
              description: "You have successfully joined the company.",
            });
            // Invalidate the profiles query for the current user to force a refetch
            if (session.user?.id) {
              queryClient.invalidateQueries({ queryKey: ["profiles", session.user.id] });
            }
            // IMPORTANT: Refresh the session to get an updated JWT with the new company_id and role
            const { data: _refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error("Error refreshing session after invitation acceptance:", refreshError);
              toast({
                title: "Session Refresh Error",
                description: "Please log out and log back in to ensure full access.",
                variant: "destructive",
              });
            } else {
              console.log("Session refreshed successfully after invitation acceptance.");
            }
            // Redirect to dashboard after successful acceptance
            navigate("/", { replace: true });
          } else {
            // RPC returned success: false with a custom error message
            setInvitationStatus("error");
            setErrorMessage(data.error_message || "Failed to accept invitation.");
            toast({
              title: "Error accepting invitation",
              description: data.error_message || "An unexpected error occurred.",
              variant: "destructive",
            });
          }
        } else {
          // Unexpected response format from RPC
          setInvitationStatus("error");
          setErrorMessage("Received an unexpected response from the invitation service.");
          toast({
            title: "Error accepting invitation",
            description: "Received an unexpected response from the invitation service.",
            variant: "destructive",
          });
        }
      } else if (invitationStatus === "idle") {
        // If no session, and not already processing, wait for user to sign in/up
        setInvitationStatus("idle");
      }
    };

    if (!isLoadingSession) {
      handleAcceptInvitation();
    }
  }, [invitationToken, session, isLoadingSession, navigate, toast, invitationStatus, queryClient]);

  const renderContent = () => {
    if (isLoadingSession || invitationStatus === "processing") {
      return (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-brand-accent" />
          <p className="text-lg text-muted-foreground">Processing your invitation...</p>
        </div>
      );
    }

    if (invitationStatus === "success") {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <CardTitle className="text-2xl">Invitation Accepted!</CardTitle>
          <CardDescription>You've successfully joined the company. Redirecting to your dashboard...</CardDescription>
        </div>
      );
    }

    if (invitationStatus === "error") {
      return (
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <CardTitle className="text-2xl">Invitation Error</CardTitle>
          <CardDescription>{errorMessage || "There was an issue accepting your invitation."}</CardDescription>
          <Button onClick={() => navigate("/login")} className="mt-4">Go to Login</Button>
        </div>
      );
    }

    // If idle and no session, show auth UI
    if (!session && invitationToken) {
      return (
        <>
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            Accept Invitation
          </h2>
          <CardDescription className="text-center mb-4">
            Please sign up or log in to accept your invitation.
          </CardDescription>
          <Auth
            supabaseClient={supabase}
            providers={[]}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--brand-accent))',
                    brandAccent: 'hsl(var(--brand-accent-foreground))',
                  },
                },
              },
            }}
            theme="light"
            redirectTo={window.location.origin + `/accept-invite?token=${invitationToken}`} // Redirect back to this page with token
            view="sign_up" // Default to sign_up view
          />
        </>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CardTitle className="text-2xl">Invalid Access</CardTitle>
        <CardDescription>Please use a valid invitation link.</CardDescription>
        <Button onClick={() => navigate("/login")} className="mt-4">Go to Login</Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        {renderContent()}
      </div>
    </div>
  );
};

export default AcceptInvitationPage;