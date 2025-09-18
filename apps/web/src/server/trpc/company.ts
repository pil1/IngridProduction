import { router, publicProcedure } from './trpc';
import { createCompanySchema, updateCompanySchema } from 'shared/src/schema/company';
import { prisma } from 'database';
 
export const companyRouter = router({
  list: publicProcedure.query(() => {
    return prisma.company.findMany();
  }),
  create: publicProcedure.input(createCompanySchema).mutation(({ input }) => {
    return prisma.company.create({ data: input });
  }),
  update: publicProcedure.input(updateCompanySchema).mutation(({ input }) => {
    const { id, ...data } = input;
    return prisma.company.update({ where: { id }, data });
  }),
});
