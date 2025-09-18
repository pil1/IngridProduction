"use client";

import { trpc } from "@/trpc/client";
import { ExpenseForm } from "./ExpenseForm";
import { z } from "zod";
import { createExpenseSchema, updateExpenseSchema } from "shared/src/schema/expense";
import { FileUpload } from "@/components/FileUpload";

export default function ExpensesPage() {
  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery();

  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateExpense = trpc.expenses.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleCreateExpense = (values: z.infer<typeof createExpenseSchema>) => {
    createExpense.mutate(values);
  };

  const handleUpdateExpense = (values: z.infer<typeof updateExpenseSchema>) => {
    updateExpense.mutate(values);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Expenses</h1>
      <div className="mt-4">
        <ExpenseForm onSubmit={handleCreateExpense} />
      </div>
      <div className="mt-4">
        <FileUpload />
      </div>
      <div className="mt-4">
        {expenses?.map((expense) => (
          <div key={expense.id} className="border p-4 my-2 flex justify-between items-center">
            <p>{expense.title} - {expense.amount.toString()} {expense.currency_code}</p>
            <ExpenseForm expense={expense} onSubmit={handleUpdateExpense} />
          </div>
        ))}
      </div>
    </div>
  );
}
