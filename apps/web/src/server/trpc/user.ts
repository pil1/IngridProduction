import { router, publicProcedure } from './trpc';
import { createUserSchema, updateUserSchema } from 'shared/src/schema/user';
import { prisma } from 'database';
 
export const userRouter = router({
  list: publicProcedure.query(() => {
    return prisma.user.findMany();
  }),
  create: publicProcedure.input(createUserSchema).mutation(({ input }) => {
    return prisma.user.create({ data: input });
  }),
  update: publicProcedure.input(updateUserSchema).mutation(({ input }) => {
    const { id, ...data } = input;
    return prisma.user.update({ where: { id }, data });
  }),
});
