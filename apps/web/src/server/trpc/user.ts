import { router, publicProcedure } from './trpc';
import { createUserSchema, updateUserSchema } from 'shared/src/schema/user';
import { prisma } from 'database';
import { sendEmail } from 'email';
 
export const userRouter = router({
  list: publicProcedure.query(() => {
    return prisma.user.findMany();
  }),
  create: publicProcedure.input(createUserSchema).mutation(async ({ input }) => {
    const user = await prisma.user.create({ data: input });
    await sendEmail(user.email, "Welcome to INFOtrac", "<h1>Welcome!</h1><p>Thank you for signing up.</p>");
    return user;
  }),
  update: publicProcedure.input(updateUserSchema).mutation(({ input }) => {
    const { id, ...data } = input;
    return prisma.user.update({ where: { id }, data });
  }),
});
