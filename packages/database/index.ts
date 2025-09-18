import { PrismaClient, User, Company, Expense } from './generated/prisma';

export const prisma = new PrismaClient();

export type { User, Company, Expense };
