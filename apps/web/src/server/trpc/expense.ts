import { router, publicProcedure } from './trpc';
import { createExpenseSchema, updateExpenseSchema } from 'shared/src/schema/expense';
import { prisma } from 'database';
import { Decimal } from '@prisma/client/runtime/library';
 
export const expenseRouter = router({
  list: publicProcedure.query(() => {
    return prisma.expense.findMany();
  }),
  create: publicProcedure.input(createExpenseSchema).mutation(({ input }) => {
    const { amount, expense_date, ...rest } = input;
    return prisma.expense.create({
      data: {
        amount: new Decimal(amount),
        expense_date: new Date(expense_date),
        ...rest,
      },
    });
  }),
  update: publicProcedure.input(updateExpenseSchema).mutation(({ input }) => {
    const { id, amount, expense_date, ...data } = input;
    return prisma.expense.update({
      where: { id },
      data: {
        ...(amount && { amount: new Decimal(amount) }),
        ...(expense_date && { expense_date: new Date(expense_date) }),
        ...data,
      },
    });
  }),
});