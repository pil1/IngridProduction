import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string(),
});

export const updateCompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
});
