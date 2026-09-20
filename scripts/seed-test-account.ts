import 'dotenv/config';
import { PrismaClient, Prisma, type FoodCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * One-off script (not the app's `prisma/seed.ts`): creates a fully onboarded
 * test account with an active BY_WEEKDAY plan and five days of meal logs
 * covering distinct adherence scenarios, for manually exercising Today /
 * day-view scoring. Run with `npx tsx scripts/seed-test-account.ts`.
 */
const prisma = new PrismaClient();

const USERNAME = 'testrich';
const PASSWORD = 'Test1234!';
const TZ = 'Asia/Tehran';

const nutrition = (
  values: Partial<
    Record<'ENERGY_KCAL' | 'PROTEIN_G' | 'CARB_G' | 'FAT_G' | 'FIBER_G' | 'SODIUM_MG', number>
  >,
) => ({
  basis: 'PER_RECORDED_PORTION' as const,
  basisQuantity: null,
  basisUnit: null,
  values: {
    ENERGY_KCAL: values.ENERGY_KCAL ?? null,
    PROTEIN_G: values.PROTEIN_G ?? null,
    CARB_G: values.CARB_G ?? null,
    FAT_G: values.FAT_G ?? null,
    FIBER_G: values.FIBER_G ?? null,
    SODIUM_MG: values.SODIUM_MG ?? null,
  },
  source: 'AI_ESTIMATE' as const,
  sourceRef: null,
  isEstimate: true,
  userOverride: false,
});

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const usernameLower = USERNAME.toLowerCase();
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.user.deleteMany({ where: { usernameLower } });

  const user = await prisma.user.create({
    data: {
      username: USERNAME,
      usernameLower,
      passwordHash,
      fullName: 'Reza Karimi',
      role: 'USER',
      isActive: true,
      onboardingStep: 'DONE',
      profile: {
        create: {
          ageYears: 29,
          sex: 'MALE',
          heightCm: 178,
          weightKg: new Prisma.Decimal(82.4),
          weightMeasuredAt: isoDaysAgo(1),
          timeZone: TZ,
          unitSystem: 'METRIC',
          weekStart: 6,
          appearance: 'SYSTEM',
          displayName: 'Reza',
          goal: 'کاهش وزن تدریجی و حفظ عضله',
          restrictions: ['peanuts'],
          restrictionsOriginal: ['بادام‌زمینی'],
          completedAt: new Date(),
        },
      },
    },
  });

  console.log(`User: ${user.username} / ${PASSWORD} (${user.id})`);

  // ─── Plan (BY_WEEKDAY, active) ───────────────────────────────────────
  const plan = await prisma.plan.create({
    data: {
      userId: user.id,
      status: 'ACTIVE',
      structure: 'BY_WEEKDAY',
      name: 'برنامه دکتر رضایی — کاهش وزن',
      sourceNote: 'nutritionist, in-person',
      sourceLanguage: 'fa',
      sourceText:
        'شنبه تا چهارشنبه: صبحانه تخم‌مرغ و نان سنگک یا جو دوسر، ناهار مرغ یا ماهی با برنج و سالاد، ' +
        'میان‌وعده میوه یا ماست، شام سبک. پنجشنبه و جمعه: انعطاف بیشتر، اما بدون نوشابه.',
      confirmedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    },
  });

  // Two option sets reused across weekdays for realism without duplicating everything.
  type ItemDef = {
    originalName: string;
    englishLabel: string;
    quantity: number;
    unit: string;
    /** Grams of one unit for a count unit (decision 024). */
    unitGrams?: number;
    category: FoodCategory;
    kcal: number;
    protein: number;
    carb: number;
    fat: number;
  };

  const weekdaySlots: Array<{
    weekday: number;
    label: string;
    breakfast: ItemDef[];
    lunch: ItemDef[];
    snack: ItemDef[];
    dinner: ItemDef[];
  }> = [
    {
      weekday: 6, // Saturday
      label: 'شنبه',
      breakfast: [
        {
          originalName: 'تخم‌مرغ',
          englishLabel: 'egg',
          quantity: 2,
          unit: 'piece',
          unitGrams: 50,
          category: 'OTHER',
          kcal: 140,
          protein: 12,
          carb: 1,
          fat: 10,
        },
        {
          originalName: 'نان سنگک',
          englishLabel: 'sangak bread',
          quantity: 1,
          unit: 'slice',
          unitGrams: 80,
          category: 'BREAD',
          kcal: 210,
          protein: 7,
          carb: 42,
          fat: 1.5,
        },
      ],
      lunch: [
        {
          originalName: 'سینه مرغ گریل',
          englishLabel: 'grilled chicken breast',
          quantity: 150,
          unit: 'g',
          category: 'MEAT',
          kcal: 250,
          protein: 47,
          carb: 0,
          fat: 6,
        },
        {
          originalName: 'برنج',
          englishLabel: 'rice',
          quantity: 150,
          unit: 'g',
          category: 'RICE',
          kcal: 195,
          protein: 4,
          carb: 43,
          fat: 0.4,
        },
        {
          originalName: 'سالاد فصل',
          englishLabel: 'mixed salad',
          quantity: 150,
          unit: 'g',
          category: 'VEGETABLE',
          kcal: 40,
          protein: 1.5,
          carb: 7,
          fat: 0.5,
        },
      ],
      snack: [
        {
          originalName: 'ماست',
          englishLabel: 'yogurt',
          quantity: 150,
          unit: 'g',
          category: 'DAIRY',
          kcal: 90,
          protein: 6,
          carb: 8,
          fat: 3,
        },
      ],
      dinner: [
        {
          originalName: 'ماهی سالمون',
          englishLabel: 'salmon',
          quantity: 120,
          unit: 'g',
          category: 'MEAT',
          kcal: 250,
          protein: 25,
          carb: 0,
          fat: 16,
        },
        {
          originalName: 'سبزیجات بخارپز',
          englishLabel: 'steamed vegetables',
          quantity: 150,
          unit: 'g',
          category: 'VEGETABLE',
          kcal: 60,
          protein: 3,
          carb: 10,
          fat: 0.5,
        },
      ],
    },
    {
      weekday: 0, // Sunday
      label: 'یکشنبه',
      breakfast: [
        {
          originalName: 'جو دوسر',
          englishLabel: 'oats',
          quantity: 60,
          unit: 'g',
          category: 'OTHER',
          kcal: 230,
          protein: 8,
          carb: 40,
          fat: 4,
        },
        {
          originalName: 'موز',
          englishLabel: 'banana',
          quantity: 1,
          unit: 'piece',
          unitGrams: 120,
          category: 'FRUIT',
          kcal: 105,
          protein: 1.3,
          carb: 27,
          fat: 0.4,
        },
      ],
      lunch: [
        {
          originalName: 'خورش قیمه با گوشت کم‌چرب',
          englishLabel: 'gheimeh stew, lean beef',
          quantity: 200,
          unit: 'g',
          category: 'MEAT',
          kcal: 320,
          protein: 28,
          carb: 18,
          fat: 14,
        },
        {
          originalName: 'برنج',
          englishLabel: 'rice',
          quantity: 120,
          unit: 'g',
          category: 'RICE',
          kcal: 156,
          protein: 3.2,
          carb: 34,
          fat: 0.3,
        },
      ],
      snack: [
        {
          originalName: 'سیب',
          englishLabel: 'apple',
          quantity: 1,
          unit: 'piece',
          unitGrams: 180,
          category: 'FRUIT',
          kcal: 95,
          protein: 0.5,
          carb: 25,
          fat: 0.3,
        },
        {
          originalName: 'گردو',
          englishLabel: 'walnuts',
          quantity: 5,
          unit: 'piece',
          unitGrams: 4,
          category: 'NUTS',
          kcal: 130,
          protein: 3,
          carb: 3,
          fat: 13,
        },
      ],
      dinner: [
        {
          originalName: 'سوپ جو و سبزیجات',
          englishLabel: 'barley vegetable soup',
          quantity: 300,
          unit: 'g',
          category: 'VEGETABLE',
          kcal: 180,
          protein: 7,
          carb: 28,
          fat: 4,
        },
      ],
    },
  ];

  // Remaining weekdays (Mon–Fri = 1..5) reuse Saturday's structure with small variation.
  const remaining = [1, 2, 3, 4, 5].map((weekday, i) => ({
    weekday,
    label: ['دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'][i],
    breakfast: weekdaySlots[0].breakfast,
    lunch: weekdaySlots[1].lunch,
    snack: weekdaySlots[0].snack,
    dinner: weekdaySlots[0].dinner,
  }));

  const allWeekdays = [...weekdaySlots, ...remaining];

  const slotIds: Record<
    string,
    { slotId: string; optionId: string; items: (ItemDef & { itemId: string })[] }
  > = {};

  let slotPosition = 0;
  for (const day of allWeekdays) {
    const groups: Array<[string, ItemDef[]]> = [
      ['Breakfast', day.breakfast],
      ['Lunch', day.lunch],
      ['Snack', day.snack],
      ['Dinner', day.dinner],
    ];
    const originalLabelFor: Record<string, string> = {
      Breakfast: 'صبحانه',
      Lunch: 'ناهار',
      Snack: 'میان‌وعده',
      Dinner: 'شام',
    };
    for (const [label, items] of groups) {
      const slot = await prisma.planSlot.create({
        data: {
          planId: plan.id,
          weekday: day.weekday,
          position: slotPosition++,
          originalName: originalLabelFor[label],
          englishLabel: label,
          timeStart:
            label === 'Breakfast'
              ? '08:00'
              : label === 'Lunch'
                ? '13:30'
                : label === 'Snack'
                  ? '17:00'
                  : '20:30',
          timeEnd: null,
          sourceExcerpt: '',
        },
      });
      const option = await prisma.planOption.create({
        data: { planSlotId: slot.id, position: 0, label: null },
      });
      const createdItems: (ItemDef & { itemId: string })[] = [];
      let pos = 0;
      for (const item of items) {
        const row = await prisma.planItem.create({
          data: {
            planOptionId: option.id,
            position: pos++,
            originalName: item.originalName,
            englishLabel: item.englishLabel,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit,
            unitGrams: item.unitGrams === undefined ? null : new Prisma.Decimal(item.unitGrams),
            quantityAssumed: false,
            category: item.category,
            nutrition: nutrition({
              ENERGY_KCAL: item.kcal,
              PROTEIN_G: item.protein,
              CARB_G: item.carb,
              FAT_G: item.fat,
            }),
            sourceExcerpt: '',
          },
        });
        createdItems.push({ ...item, itemId: row.id });
      }
      slotIds[`${day.weekday}:${label}`] = {
        slotId: slot.id,
        optionId: option.id,
        items: createdItems,
      };
    }
  }

  // ─── Targets ──────────────────────────────────────────────────────────
  await prisma.planTarget.createMany({
    data: [
      {
        planId: plan.id,
        nutrient: 'ENERGY_KCAL',
        type: 'RANGE',
        low: new Prisma.Decimal(1900),
        high: new Prisma.Decimal(2200),
        source: 'EXPLICIT',
        sourceExcerpt: 'حدود ۱۹۰۰ تا ۲۲۰۰ کالری در روز',
        scopeKey: 'all:day:ENERGY_KCAL',
      },
      {
        planId: plan.id,
        nutrient: 'PROTEIN_G',
        type: 'MINIMUM',
        low: new Prisma.Decimal(120),
        high: null,
        source: 'EXPLICIT',
        sourceExcerpt: 'حداقل ۱۲۰ گرم پروتئین',
        scopeKey: 'all:day:PROTEIN_G',
      },
    ],
  });

  // ─── Rules ────────────────────────────────────────────────────────────
  const sodaRule = await prisma.planRule.create({
    data: {
      planId: plan.id,
      kind: 'EXCLUSION',
      tracking: 'TRACK',
      period: 'DAY',
      definition: { excludedGroups: ['soda', 'fast_food'] },
      originalText: 'بدون نوشابه و فست‌فود',
      sourceExcerpt: 'بدون نوشابه',
      isConflicting: false,
    },
  });
  await prisma.planNote.create({
    data: {
      planId: plan.id,
      originalText: 'پنجشنبه و جمعه انعطاف بیشتر، اما بدون نوشابه',
      reason: 'DAY_TYPE',
    },
  });

  console.log(`Plan: ${plan.id} (BY_WEEKDAY, ${allWeekdays.length} weekdays, rule ${sodaRule.id})`);

  // ─── Day records + meals ────────────────────────────────────────────
  // Helper to create a day, its meals and food items.
  let clientReqSeq = 0;
  const clientReqId = () => {
    clientReqSeq += 1;
    return `seed-${user.id.slice(-6)}-${String(clientReqSeq).padStart(4, '0')}`;
  };

  async function makeMeal(opts: {
    dayRecordId: string;
    time: string | null;
    inputKind: 'TEXT' | 'PLANNED' | 'MANUAL';
    originalText: string | null;
    notes?: string | null;
    planSlotId: string | null;
    planOptionId: string | null;
    items: Array<{
      item: ItemDef;
      matchedPlanItemId: string | null;
      isAddedItem: boolean;
      restrictionHit?: string | null;
      ruleGroups?: string[];
    }>;
  }) {
    const meal = await prisma.meal.create({
      data: {
        userId: user.id,
        dayRecordId: opts.dayRecordId,
        consumedLocalTime: opts.time,
        inputKind: opts.inputKind,
        originalText: opts.originalText,
        notes: opts.notes ?? null,
        clientRequestId: clientReqId(),
        planSlotId: opts.planSlotId,
        planOptionId: opts.planOptionId,
        linkConfirmedByUser: opts.planSlotId !== null,
      },
    });
    let pos = 0;
    for (const it of opts.items) {
      await prisma.foodItem.create({
        data: {
          mealId: meal.id,
          position: pos++,
          originalName: it.item.originalName,
          englishLabel: it.item.englishLabel,
          quantity: new Prisma.Decimal(it.item.quantity),
          unit: it.item.unit,
          unitGrams: it.item.unitGrams === undefined ? null : new Prisma.Decimal(it.item.unitGrams),
          quantityUnknown: false,
          quantityAssumed: false,
          category: it.item.category,
          matchedPlanItemId: it.matchedPlanItemId,
          isAddedItem: it.isAddedItem,
          restrictionHit: it.restrictionHit ?? null,
          ruleGroups: it.ruleGroups ?? [],
          nutrition: nutrition({
            ENERGY_KCAL: it.item.kcal,
            PROTEIN_G: it.item.protein,
            CARB_G: it.item.carb,
            FAT_G: it.item.fat,
          }),
        },
      });
    }
    return meal;
  }

  function weekdayOfIso(iso: string): number {
    // JS getUTCDay(): 0=Sunday..6=Saturday — matches the schema's convention.
    return new Date(`${iso}T12:00:00Z`).getUTCDay();
  }

  function slotsFor(iso: string) {
    const wd = weekdayOfIso(iso);
    return {
      breakfast: slotIds[`${wd}:Breakfast`],
      lunch: slotIds[`${wd}:Lunch`],
      snack: slotIds[`${wd}:Snack`],
      dinner: slotIds[`${wd}:Dinner`],
    };
  }

  // Day −4: perfectly followed — every plan item logged as planned, matched.
  {
    const iso = isoDaysAgo(4);
    const day = await prisma.dayRecord.create({
      data: { userId: user.id, localDate: iso, timeZone: TZ, logComplete: true },
    });
    const s = slotsFor(iso);
    for (const [time, part] of [
      ['08:15', s.breakfast],
      ['13:30', s.lunch],
      ['17:15', s.snack],
      ['20:45', s.dinner],
    ] as const) {
      await makeMeal({
        dayRecordId: day.id,
        time,
        inputKind: 'PLANNED',
        originalText: null,
        planSlotId: part.slotId,
        planOptionId: part.optionId,
        items: part.items.map((it) => ({
          item: it,
          matchedPlanItemId: it.itemId,
          isAddedItem: false,
        })),
      });
    }
    console.log(`Day ${iso}: perfectly followed`);
  }

  // Day −3: well-filled, mostly on-plan with a small added snack.
  {
    const iso = isoDaysAgo(3);
    const day = await prisma.dayRecord.create({
      data: { userId: user.id, localDate: iso, timeZone: TZ, logComplete: true },
    });
    const s = slotsFor(iso);
    await makeMeal({
      dayRecordId: day.id,
      time: '08:20',
      inputKind: 'TEXT',
      originalText: 'دو تا تخم مرغ و یه تیکه نون سنگک',
      planSlotId: s.breakfast.slotId,
      planOptionId: s.breakfast.optionId,
      items: s.breakfast.items.map((it) => ({
        item: it,
        matchedPlanItemId: it.itemId,
        isAddedItem: false,
      })),
    });
    await makeMeal({
      dayRecordId: day.id,
      time: '13:45',
      inputKind: 'TEXT',
      originalText: 'مرغ گریل با برنج و کمی سالاد، پرس کمی بزرگتر بود',
      planSlotId: s.lunch.slotId,
      planOptionId: s.lunch.optionId,
      items: s.lunch.items.map((it, idx) => ({
        item: idx === 0 ? { ...it, quantity: it.quantity * 1.2 } : it,
        matchedPlanItemId: it.itemId,
        isAddedItem: false,
      })),
    });
    await makeMeal({
      dayRecordId: day.id,
      time: '16:30',
      inputKind: 'TEXT',
      originalText: 'یک لیوان چایی و چند تا خرما (اضافه بر برنامه)',
      notes: 'هوس شیرینی داشتم',
      planSlotId: null,
      planOptionId: null,
      items: [
        {
          item: {
            originalName: 'خرما',
            englishLabel: 'dates',
            quantity: 4,
            unit: 'piece',
            unitGrams: 8,
            category: 'FRUIT',
            kcal: 32,
            protein: 0.2,
            carb: 8,
            fat: 0,
          },
          matchedPlanItemId: null,
          isAddedItem: true,
        },
      ],
    });
    await makeMeal({
      dayRecordId: day.id,
      time: '20:30',
      inputKind: 'TEXT',
      originalText: 'ماهی سالمون با سبزیجات بخارپز',
      planSlotId: s.dinner.slotId,
      planOptionId: s.dinner.optionId,
      items: s.dinner.items.map((it) => ({
        item: it,
        matchedPlanItemId: it.itemId,
        isAddedItem: false,
      })),
    });
    console.log(`Day ${iso}: well-filled, close to plan`);
  }

  // Day −2: not followed — breakfast skipped, junk food, over target, rule violation.
  {
    const iso = isoDaysAgo(2);
    const day = await prisma.dayRecord.create({
      data: { userId: user.id, localDate: iso, timeZone: TZ, logComplete: true },
    });
    const s = slotsFor(iso);
    await prisma.daySkippedSlot.create({
      data: { dayRecordId: day.id, planSlotId: s.breakfast.slotId },
    });

    await makeMeal({
      dayRecordId: day.id,
      time: '14:10',
      inputKind: 'TEXT',
      originalText: 'پیتزا پپرونی دو تکه بزرگ و نوشابه',
      notes: 'روز شلوغی بود، وقت نشد چیز دیگه‌ای بخورم',
      planSlotId: s.lunch.slotId,
      planOptionId: null,
      items: [
        {
          item: {
            originalName: 'پیتزا پپرونی',
            englishLabel: 'pepperoni pizza (2 large slices)',
            quantity: 300,
            unit: 'g',
            category: 'OTHER',
            kcal: 780,
            protein: 32,
            carb: 78,
            fat: 36,
          },
          matchedPlanItemId: null,
          isAddedItem: true,
          ruleGroups: ['fast_food'],
        },
        {
          item: {
            originalName: 'نوشابه',
            englishLabel: 'cola',
            quantity: 330,
            unit: 'ml',
            category: 'OTHER',
            kcal: 140,
            protein: 0,
            carb: 35,
            fat: 0,
          },
          matchedPlanItemId: null,
          isAddedItem: true,
          ruleGroups: ['soda'],
        },
      ],
    });
    await makeMeal({
      dayRecordId: day.id,
      time: '22:40',
      inputKind: 'TEXT',
      originalText: 'برگر و سیب‌زمینی سرخ‌کرده، اواخر شب گرسنه شدم',
      planSlotId: null,
      planOptionId: null,
      items: [
        {
          item: {
            originalName: 'همبرگر',
            englishLabel: 'cheeseburger',
            quantity: 220,
            unit: 'g',
            category: 'OTHER',
            kcal: 590,
            protein: 28,
            carb: 42,
            fat: 34,
          },
          matchedPlanItemId: null,
          isAddedItem: true,
          ruleGroups: ['fast_food'],
        },
        {
          item: {
            originalName: 'سیب‌زمینی سرخ‌کرده',
            englishLabel: 'french fries',
            quantity: 150,
            unit: 'g',
            category: 'POTATO',
            kcal: 470,
            protein: 5,
            carb: 57,
            fat: 24,
          },
          matchedPlanItemId: null,
          isAddedItem: true,
        },
      ],
    });
    console.log(`Day ${iso}: not followed, junk food, breakfast skipped`);
  }

  // Day −1: partial / incomplete — only breakfast logged, day left incomplete.
  {
    const iso = isoDaysAgo(1);
    const day = await prisma.dayRecord.create({
      data: { userId: user.id, localDate: iso, timeZone: TZ, logComplete: false },
    });
    const s = slotsFor(iso);
    await makeMeal({
      dayRecordId: day.id,
      time: '09:05',
      inputKind: 'TEXT',
      originalText: 'جو دوسر با موز',
      planSlotId: s.breakfast.slotId,
      planOptionId: s.breakfast.optionId,
      items: s.breakfast.items.map((it) => ({
        item: it,
        matchedPlanItemId: it.itemId,
        isAddedItem: false,
      })),
    });
    console.log(`Day ${iso}: partial, only breakfast logged, marked incomplete`);
  }

  // Today: in progress — breakfast logged, rest of the day still open.
  {
    const iso = isoDaysAgo(0);
    const day = await prisma.dayRecord.create({
      data: { userId: user.id, localDate: iso, timeZone: TZ, logComplete: false },
    });
    const s = slotsFor(iso);
    await makeMeal({
      dayRecordId: day.id,
      time: '08:30',
      inputKind: 'TEXT',
      originalText: 'دو تخم مرغ و نان',
      planSlotId: s.breakfast.slotId,
      planOptionId: s.breakfast.optionId,
      items: s.breakfast.items.map((it) => ({
        item: it,
        matchedPlanItemId: it.itemId,
        isAddedItem: false,
      })),
    });
    console.log(`Day ${iso} (today): in progress, breakfast only`);
  }

  console.log('\nDone. Sign in with:');
  console.log(`  username: ${USERNAME}`);
  console.log(`  password: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
