"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Label } from "ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "ui";
import { createExpenseSchema, updateExpenseSchema } from "shared/src/schema/expense";
import { Expense } from "database";

export function ExpenseForm({ expense, onSubmit }: { expense?: Expense, onSubmit: (values: any) => void }) {
  const formSchema = expense ? updateExpenseSchema : createExpenseSchema;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: expense ? { id: expense.id, title: expense.title, description: expense.description || "", amount: expense.amount.toNumber(), currency_code: expense.currency_code, expense_date: expense.expense_date.toISOString() } : { amount: 0, currency_code: "USD", expense_date: new Date().toISOString() },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{expense ? "Edit Expense" : "Add Expense"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div>
            <Label>Title</Label>
            <Input {...form.register("title")} />
            {form.formState.errors.title && <p>{form.formState.errors.title.message}</p>}
          </div>
          <div>
            <Label>Description</Label>
            <Input {...form.register("description")} />
            {form.formState.errors.description && <p>{form.formState.errors.description.message}</p>}
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
            {form.formState.errors.amount && <p>{form.formState.errors.amount.message}</p>}
          </div>
          <div>
            <Label>Currency Code</Label>
            <Input {...form.register("currency_code")} />
            {form.formState.errors.currency_code && <p>{form.formState.errors.currency_code.message}</p>}
          </div>
          <div>
            <Label>Expense Date</Label>
            <Input type="datetime-local" {...form.register("expense_date")} />
            {form.formState.errors.expense_date && <p>{form.formState.errors.expense_date.message}</p>}
          </div>
          <Button type="submit">Submit</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
