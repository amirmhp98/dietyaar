import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Direct database helpers for specs that need a confirmed plan without going
 * through the import UI (meal and Today journeys). Uses DATABASE_URL from .env
 * — the same database the dev server uses.
 */
const prisma = new PrismaClient();

export interface SeededPlan {
  planId: string;
  slots: Array<{
    id: string;
    englishLabel: string;
    options: Array<{ id: string; label: string | null }>;
  }>;
}

const N = (kcal: number, protein = 5, carb = 20, fat = 5) => ({
  basis: 'PER_RECORDED_PORTION',
  basisQuantity: null,
  basisUnit: null,
  values: {
    ENERGY_KCAL: kcal,
    PROTEIN_G: protein,
    CARB_G: carb,
    FAT_G: fat,
    FIBER_G: null,
    SODIUM_MG: null,
  },
  source: 'AI_ESTIMATE',
  sourceRef: null,
  isEstimate: true,
  userOverride: false,
});

/** A same-every-day menu plan with 5 slots; breakfast 3 options, lunch 4, others 1–2. */
export async function seedMenuPlan(username: string): Promise<SeededPlan> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { usernameLower: username.toLowerCase() },
  });
  await prisma.plan.deleteMany({ where: { userId: user.id } });
  const item = (
    originalName: string,
    englishLabel: string,
    quantity: number | null,
    unit: string | null,
    category: string,
    kcal: number,
    position: number,
    unitGrams: number | null = null,
  ) => ({
    originalName,
    englishLabel,
    quantity,
    unit,
    unitGrams,
    category: category as never,
    nutrition: N(kcal),
    position,
  });
  const plan = await prisma.plan.create({
    data: {
      userId: user.id,
      status: 'ACTIVE',
      structure: 'SAME_EVERY_DAY',
      name: 'برنامه غذایی',
      sourceNote: 'nutrition specialist',
      confirmedAt: new Date(),
      slots: {
        create: [
          {
            weekday: 7,
            position: 0,
            originalName: 'صبحانه',
            englishLabel: 'Breakfast',
            options: {
              create: [
                {
                  position: 0,
                  label: 'گزینه ۱',
                  items: {
                    create: [
                      item('تخم‌مرغ', 'egg', 2, 'piece', 'MEAT', 150, 0, 50),
                      item('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210, 1),
                      item('خیار و گوجه', 'cucumber and tomato', null, null, 'VEGETABLE', 20, 2),
                    ],
                  },
                },
                {
                  position: 1,
                  label: 'گزینه ۲',
                  items: {
                    create: [
                      item('جو دوسر', 'oats', 40, 'g', 'OTHER', 150, 0),
                      item('ماست یونانی', 'Greek yogurt', 150, 'g', 'DAIRY', 130, 1),
                      item('موز کوچک', 'small banana', 1, 'piece', 'FRUIT', 90, 2, 100),
                      item('گردو', 'walnuts', 15, 'g', 'NUTS', 100, 3),
                    ],
                  },
                },
                {
                  position: 2,
                  label: 'گزینه ۳',
                  items: {
                    create: [
                      item('پنیر', 'cheese', 30, 'g', 'DAIRY', 90, 0),
                      item('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210, 1),
                    ],
                  },
                },
              ],
            },
          },
          {
            weekday: 7,
            position: 1,
            originalName: 'میان‌وعده اول',
            englishLabel: 'First snack',
            options: {
              create: [
                {
                  position: 0,
                  label: null,
                  items: {
                    create: [item('سیب متوسط', 'medium apple', 1, 'piece', 'FRUIT', 95, 0, 180)],
                  },
                },
              ],
            },
          },
          {
            weekday: 7,
            position: 2,
            originalName: 'ناهار',
            englishLabel: 'Lunch',
            options: {
              create: [
                {
                  position: 0,
                  label: 'گزینه ۱',
                  items: {
                    create: [
                      item('برنج', 'rice', 150, 'g', 'RICE', 195, 0),
                      item('مرغ', 'chicken', 120, 'g', 'MEAT', 200, 1),
                      item('سالاد', 'salad', null, null, 'VEGETABLE', 30, 2),
                    ],
                  },
                },
                {
                  position: 1,
                  label: 'گزینه ۲',
                  items: {
                    create: [
                      item('عدسی', 'adasi (lentil stew)', 300, 'g', 'OTHER', 330, 0),
                      item('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210, 1),
                    ],
                  },
                },
                {
                  position: 2,
                  label: 'گزینه ۳',
                  items: {
                    create: [
                      item('ماهی', 'grilled fish', 150, 'g', 'MEAT', 250, 0),
                      item('سیب‌زمینی', 'potato', 150, 'g', 'POTATO', 130, 1),
                    ],
                  },
                },
                {
                  position: 3,
                  label: 'گزینه ۴',
                  items: {
                    create: [
                      item('جوجه کباب', 'joojeh kabab', 150, 'g', 'MEAT', 260, 0),
                      item('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210, 1),
                      item('ماست', 'yogurt', 100, 'g', 'DAIRY', 60, 2),
                    ],
                  },
                },
              ],
            },
          },
          {
            weekday: 7,
            position: 3,
            originalName: 'میان‌وعده دوم',
            englishLabel: 'Second snack',
            options: {
              create: [
                {
                  position: 0,
                  label: 'گزینه ۱',
                  items: { create: [item('پرتقال', 'orange', 1, 'piece', 'FRUIT', 70, 0, 150)] },
                },
                {
                  position: 1,
                  label: 'گزینه ۲',
                  items: {
                    create: [item('شیر کم‌چرب', 'low-fat milk', 1, 'glass', 'DAIRY', 100, 0)],
                  },
                },
              ],
            },
          },
          {
            weekday: 7,
            position: 4,
            originalName: 'شام',
            englishLabel: 'Dinner',
            options: {
              create: [
                {
                  position: 0,
                  label: null,
                  items: {
                    create: [
                      item('برنج', 'rice', 100, 'g', 'RICE', 130, 0),
                      item('مرغ', 'chicken', 120, 'g', 'MEAT', 200, 1),
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      slots: {
        orderBy: { position: 'asc' },
        include: { options: { orderBy: { position: 'asc' } } },
      },
    },
  });
  const lunch = plan.slots[2];
  await prisma.planTarget.createMany({
    data: [
      {
        planId: plan.id,
        planSlotId: lunch.id,
        nutrient: 'ENERGY_KCAL',
        type: 'RANGE',
        low: 650,
        high: 720,
        source: 'EXPLICIT',
        scopeKey: `all:${lunch.id}:ENERGY_KCAL`,
      },
      {
        planId: plan.id,
        planSlotId: null,
        nutrient: 'ENERGY_KCAL',
        type: 'RANGE',
        low: 1600,
        high: 1900,
        source: 'EXPLICIT',
        scopeKey: 'all:day:ENERGY_KCAL',
      },
    ],
  });
  await prisma.planNote.create({
    data: {
      planId: plan.id,
      originalText: 'روزهای تمرین: یک موز یا سه خرما نزدیک تمرین',
      reason: 'TRAINING_CONDITIONAL',
    },
  });
  return {
    planId: plan.id,
    slots: plan.slots.map((s) => ({
      id: s.id,
      englishLabel: s.englishLabel,
      options: s.options.map((o) => ({ id: o.id, label: o.label })),
    })),
  };
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
