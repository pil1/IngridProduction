import { PrismaClient, User, Company } from './generated/prisma';

export const prisma = new PrismaClient();

export type { User, Company };
