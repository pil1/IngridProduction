import { z } from 'zod';

export const createExpenseSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  amount: z.number(),
  currency_code: z.string(),
  expense_date: z.string().datetime(),
  company_id: z.string().uuid(),
  submitted_by_id: z.string().uuid(),
});

export const updateExpenseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().optional(),
  currency_code: z.string().optional(),
  expense_date: z.string().datetime().optional(),
  company_id: z.string().uuid().optional(),
  submitted_by_id: z.string().uuid().optional(),
});
