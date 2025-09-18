"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Edit, Send, Trash2, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Expense } from "@/types/expenses"; // Import shared Expense interface

interface ExpenseActionsProps {
  expense: Expense;
  isSubmitPending: boolean;
  isDeletePending: boolean;
  expenseToDeleteId: string | null;
  onEditClick: (expense: Expense) => void;
  onSubmitClick: (id: string) => void;
  onDeleteClick: (expense: Expense) => void;
}

const ExpenseActions: React.FC<ExpenseActionsProps> = ({
  expense,
  isSubmitPending,
  isDeletePending,
  expenseToDeleteId,
  onEditClick,
  onSubmitClick,
  onDeleteClick,
}) => {
  const isCurrentExpenseSubmitting = isSubmitPending && expense.id === expenseToDeleteId;
  const isCurrentExpenseDeleting = isDeletePending && expense.id === expenseToDeleteId;

  return (
    <div className="flex space-x-2 justify-end">
      {expense.status === 'draft' && (
        <>
          <Button variant="outline" size="sm" onClick={() => onEditClick(expense)} disabled={isSubmitPending || isDeletePending}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="default" size="sm" onClick={() => onSubmitClick(expense.id)} disabled={isSubmitPending || isDeletePending}>
            {isCurrentExpenseSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDeleteClick(expense)} disabled={isSubmitPending || isDeletePending}>
            {isCurrentExpenseDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </>
      )}
      {(expense.status === 'submitted' || expense.status === 'approved' || expense.status === 'rejected') && (
        <Link to={`/expenses/${expense.id}`}>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      )}
    </div>
  );
};

export default ExpenseActions;