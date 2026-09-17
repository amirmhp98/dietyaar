import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const u = await prisma.user.findUniqueOrThrow({ where: { usernameLower: 'mealui_a1' } });
const p = await prisma.plan.findUnique({ where: { userId: u.id }, include: { slots: { select: { id: true, weekday: true } } } });
console.log(u.id, JSON.stringify({ status: p?.status, structure: p?.structure, confirmedAt: p?.confirmedAt, slots: p?.slots.length }));
await prisma.$disconnect();
