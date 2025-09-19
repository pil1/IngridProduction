"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import FormattedCurrencyDisplay from "@/components/FormattedCurrencyDisplay";
import { Expense, ExpenseLineItem } from "@/types/expenses"; // Import Expense and ExpenseLineItem
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

// Define the structure for field settings (must match types/expenses.ts)
interface FieldSetting {
  visible: boolean;
  required: boolean;
}

interface ExpenseSummaryCardProps {
  expense: Expense; // Now Expense type includes all necessary details
  fieldConfig: Record<string, FieldSetting>; // New prop for dynamic field visibility
}

const ExpenseSummaryCard: React.FC<ExpenseSummaryCardProps> = ({ expense, fieldConfig }) => {
  // Helper to check if a field should be visible
  const isFieldVisible = (key: string) => fieldConfig[key]?.visible ?? true; // Default to visible if not configured

  return (
    <Card className="w-full shadow-none border-0 bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          {isFieldVisible("title") && expense.title}
          <Badge className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
            expense.status === 'draft' ? 'bg-gray-100 text-gray-800' :
            expense.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
            expense.status === 'approved' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
          </Badge>
        </CardTitle>
        <CardDescription>
          Submitted by {expense.submitter_full_name ?? expense.submitter_email ?? "N/A"} on {format(new Date(expense.created_at), "PPP")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {(isFieldVisible("amount") || isFieldVisible("expense_date")) && (
          <div className="grid grid-cols-2 gap-4">
            {isFieldVisible("amount") && (
              <div>
                <p className="font-medium text-muted-foreground">Original Amount</p>
                <p className="text-base font-bold">
                  <FormattedCurrencyDisplay amount={expense.amount} currencyCode={expense.currency_code} />
                </p>
              </div>
            )}
            {isFieldVisible("expense_date") && (
              <div>
                <p className="font-medium text-muted-foreground">Expense Date</p>
                <p className="text-base">{format(new Date(expense.expense_date), "PPP")}</p>
              </div>
            )}
          </div>
        )}
        {(isFieldVisible("amount") || isFieldVisible("expense_date")) && (isFieldVisible("vendor_name") || isFieldVisible("category_id")) && <Separator />}
        
        {(isFieldVisible("vendor_name") || isFieldVisible("category_id")) && (
          <div className="grid grid-cols-2 gap-4">
            {isFieldVisible("vendor_name") && (
              <div>
                <p className="font-medium text-muted-foreground">Vendor Name</p>
                <p>{expense.vendor_name ?? "N/A"}</p>
              </div>
            )}
            {isFieldVisible("category_id") && (
              <div>
                <p className="font-medium text-muted-foreground">Category</p>
                <p>{expense.category_name ?? "N/A"}</p> {/* Now directly on expense */}
              </div>
            )}
          </div>
        )}
        {(isFieldVisible("vendor_name") || isFieldVisible("category_id")) && (isFieldVisible("project_code") || isFieldVisible("cost_center")) && <Separator />}

        {(isFieldVisible("project_code") || isFieldVisible("cost_center")) && (
          <div className="grid grid-cols-2 gap-4">
            {isFieldVisible("project_code") && (
              <div>
                <p className="font-medium text-muted-foreground">Project Code</p>
                <p>{expense.project_code ?? "N/A"}</p>
              </div>
            )}
            {isFieldVisible("cost_center") && (
              <div>
                <p className="font-medium text-muted-foreground">Cost Center</p>
                <p>{expense.cost_center ?? "N/A"}</p>
              </div>
            )}
          </div>
        )}
        {(isFieldVisible("project_code") || isFieldVisible("cost_center")) && (expense.description || expense.receipt_summary) && <Separator />}

        {isFieldVisible("description") && expense.description && (
          <>
            <div>
              <p className="font-medium text-muted-foreground">Description</p>
              <p>{expense.description}</p>
            </div>
          </>
        )}
        {isFieldVisible("receipt_summary") && expense.receipt_summary && (
          <>
            <div>
              <p className="font-medium text-muted-foreground">Receipt Summary</p>
              <p>{expense.receipt_summary}</p>
            </div>
          </>
        )}

        {isFieldVisible("line_items") && expense.expense_line_items && expense.expense_line_items.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="font-medium text-muted-foreground mb-2">Line Items</p>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 font-semibold">Description</th>
                      <th className="text-right p-2 font-semibold">Qty</th>
                      <th className="text-right p-2 font-semibold">Unit Price</th>
                      <th className="text-right p-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expense.expense_line_items.map((item: ExpenseLineItem) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.description}</td>
                        <td className="text-right p-2">{item.quantity ?? "N/A"}</td>
                        <td className="text-right p-2">
                          <FormattedCurrencyDisplay amount={item.unit_price} currencyCode={item.currency_code} />
                        </td>
                        <td className="text-right p-2">
                          <FormattedCurrencyDisplay amount={item.line_amount} currencyCode={item.currency_code} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ExpenseSummaryCard;