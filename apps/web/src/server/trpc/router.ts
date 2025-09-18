import { router } from './trpc';
import { userRouter } from './user';
import { companyRouter } from './company';
import { expenseRouter } from './expense';
 
export const appRouter = router({
  user: userRouter,
  company: companyRouter,
  expenses: expenseRouter,
});
 
export type AppRouter = typeof appRouter;
