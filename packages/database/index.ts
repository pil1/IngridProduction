import { PrismaClient, User } from './generated/prisma';

export const prisma = new PrismaClient();

export type { User };
