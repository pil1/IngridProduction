import { router } from './trpc';
import { userRouter } from './user';
import { companyRouter } from './company';
 
export const appRouter = router({
  user: userRouter,
  company: companyRouter,
});
 
export type AppRouter = typeof appRouter;
