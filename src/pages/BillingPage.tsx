"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign } from "lucide-react"; // Import DollarSign icon
import { useSession } from "@/components/SessionContextProvider";
import { format } from "date-fns";
import FormattedCurrencyDisplay from "@/components/FormattedCurrencyDisplay";

interface BillingRecord {
  id: string;
  company_id: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  status: string;
  details: any; // JSONB field
  created_at: string;
  updated_at: string;
  companies: { name: string; default_currency: string } | null; // Added default_currency
}

const BillingPage = () => {
  const { profile, isLoading: isLoadingSession } = useSession();

  const isSuperAdmin = profile?.role === 'super-admin';

  const { data: billingRecords, isLoading, isError } = useQuery<BillingRecord[]>({
    queryKey: ["billingRecords"],
    queryFn: async () => {
      if (!isSuperAdmin) return []; // Only super-admins can view this page
      const { data, error } = await supabase
        .from("billing_records")
        .select(`
          *,
          companies (name, default_currency)
        `)
        .order("billing_period_end", { ascending: false });
      if (error) throw error;

      // Map the raw data from Supabase to the desired BillingRecord interface
      const typedData: BillingRecord[] = (data as any[]).map(item => ({
        ...item,
        companies: item.companies && item.companies.length > 0 ? item.companies[0] : null,
      }));
      return typedData;
    },
    enabled: isSuperAdmin,
  });

  if (isLoadingSession || isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading billing records...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Access Denied: Only Super Admins can access this page.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>Error loading billing records. Please try again.</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Billing Records
          </CardTitle>
          <CardDescription>
            Overview of all company billing records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Period Start</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billingRecords?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No billing records found.
                  </TableCell>
                </TableRow>
              ) : (
                billingRecords?.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.companies?.name || "N/A"}</TableCell>
                    <TableCell>{format(new Date(record.billing_period_start), "PPP")}</TableCell>
                    <TableCell>{format(new Date(record.billing_period_end), "PPP")}</TableCell>
                    <TableCell>
                      <FormattedCurrencyDisplay amount={record.total_amount} currencyCode={record.companies?.default_currency || "USD"} />
                    </TableCell>
                    <TableCell><Badge variant="secondary">{record.status}</Badge></TableCell>
                    <TableCell>{format(new Date(record.created_at), "PPP")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
};

export default BillingPage;