import { router, publicProcedure } from './trpc';
import { createExpenseSchema, updateExpenseSchema } from 'shared/src/schema/expense';
import { prisma } from 'database';
import { Decimal } from '@prisma/client/runtime/library';
import { processDocument, analyzeText } from 'ai';
 
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
  processReceipt: publicProcedure.input(z.object({ filePath: z.string() })).mutation(async ({ input }) => {
    const { filePath } = input;
    // For now, use dummy values for projectId, location, processorId
    const projectId = "your-gcp-project-id";
    const location = "us"; // e.g., "us" or "eu"
    const processorId = "your-processor-id"; // Create a processor in Cloud Console

    const extractedText = await processDocument(projectId, location, processorId, filePath);

    if (!extractedText) {
      return { success: false, message: "Could not extract text from document." };
    }

    const analysisResult = await analyzeText(extractedText);

    return { success: true, extractedText, analysisResult };
  }),
});
