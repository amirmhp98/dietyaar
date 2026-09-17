import { Factory } from 'fishery';
import {
  Prisma,
  type Plan,
  type PlanImportJob,
  type PlanItem,
  type PlanNote,
  type PlanOption,
  type PlanRule,
  type PlanSlot,
  type PlanTarget,
} from '@prisma/client';

const at = new Date('2026-09-10T00:00:00Z');

/** Full Prisma `Plan` rows: confirmed, same every day, no draft. */
export const planFactory = Factory.define<Plan>(({ sequence }) => ({
  id: `plan-${sequence}`,
  userId: `user-${sequence}`,
  status: 'ACTIVE',
  structure: 'SAME_EVERY_DAY',
  name: 'برنامه دکتر احمدی',
  sourceNote: 'nutrition specialist',
  sourceLanguage: 'fa',
  sourceText: 'صبحانه: ۲ عدد تخم‌مرغ، ۸۰ گرم نان سنگک',
  draftSourceText: null,
  draftId: null,
  draftKind: null,
  draftJson: null,
  confirmedAt: at,
  createdAt: at,
  updatedAt: at,
}));

export const planSlotFactory = Factory.define<PlanSlot>(({ sequence }) => ({
  id: `slot-${sequence}`,
  planId: 'plan-1',
  weekday: 7,
  position: sequence - 1,
  originalName: 'ناهار',
  englishLabel: 'Lunch',
  timeStart: null,
  timeEnd: null,
  sourceExcerpt: '',
  createdAt: at,
  updatedAt: at,
}));

export const planOptionFactory = Factory.define<PlanOption>(({ sequence }) => ({
  id: `opt-${sequence}`,
  planSlotId: 'slot-1',
  position: 0,
  label: null,
  createdAt: at,
  updatedAt: at,
}));

export const planItemFactory = Factory.define<PlanItem>(({ sequence }) => ({
  id: `item-${sequence}`,
  planOptionId: 'opt-1',
  position: 0,
  originalName: 'برنج',
  englishLabel: 'rice',
  quantity: new Prisma.Decimal(150),
  unit: 'g',
  quantityAssumed: false,
  assumedDefaultKey: null,
  preparationNote: null,
  alternatives: [],
  category: 'RICE',
  nutrition: {
    basis: 'PER_RECORDED_PORTION',
    basisQuantity: null,
    basisUnit: null,
    values: {
      ENERGY_KCAL: 195,
      PROTEIN_G: 4,
      CARB_G: 43,
      FAT_G: 0.4,
      FIBER_G: null,
      SODIUM_MG: null,
    },
    source: 'AI_ESTIMATE',
    sourceRef: null,
    isEstimate: true,
    userOverride: false,
  },
  sourceExcerpt: '',
  createdAt: at,
  updatedAt: at,
}));

export const planTargetFactory = Factory.define<PlanTarget>(({ sequence }) => ({
  id: `target-${sequence}`,
  planId: 'plan-1',
  planSlotId: null,
  weekday: null,
  nutrient: 'ENERGY_KCAL',
  type: 'APPROXIMATE',
  low: new Prisma.Decimal(2200),
  high: null,
  source: 'EXPLICIT',
  sourceExcerpt: 'حدود ۲۲۰۰ کالری',
  scopeKey: 'all:day:ENERGY_KCAL',
  createdAt: at,
  updatedAt: at,
}));

export const planRuleFactory = Factory.define<PlanRule>(({ sequence }) => ({
  id: `rule-${sequence}`,
  planId: 'plan-1',
  kind: 'INSTRUCTION',
  tracking: 'NOTE',
  period: null,
  definition: {},
  originalText: 'روزهای تمرین یک وعده اضافه',
  sourceExcerpt: '',
  isConflicting: false,
  unsupportedReason: null,
  createdAt: at,
  updatedAt: at,
}));

export const planNoteFactory = Factory.define<PlanNote>(({ sequence }) => ({
  id: `note-${sequence}`,
  planId: 'plan-1',
  originalText: 'روز تمرین: کربوهیدرات بیشتر',
  reason: 'TRAINING_CONDITIONAL',
  createdAt: at,
  updatedAt: at,
}));

export const planImportJobFactory = Factory.define<PlanImportJob>(({ sequence }) => ({
  id: `job-${sequence}`,
  userId: 'user-1',
  status: 'QUEUED',
  attempt: 0,
  draftId: 'draft-1',
  heartbeatAt: null,
  startedAt: null,
  finishedAt: null,
  errorCategory: null,
  createdAt: at,
  updatedAt: at,
}));

/**
 * A confirmed plan with rows nested the way `prisma.plan.findUnique({ include })`
 * returns them: two slots (breakfast with two options, lunch with one), a daily
 * energy target, one note. Ids are stable (`slot-b`, `opt-b1`, `item-b1a`…).
 */
export function buildPlanWithRows(overrides: Partial<Plan> = {}) {
  const plan = planFactory.build({ id: 'plan-1', userId: 'user-1', ...overrides });
  const item = (
    id: string,
    optionId: string,
    position: number,
    name: [string, string],
    kcal: number,
  ) =>
    planItemFactory.build({
      id,
      planOptionId: optionId,
      position,
      originalName: name[0],
      englishLabel: name[1],
      nutrition: {
        ...(planItemFactory.build().nutrition as object),
        values: { ENERGY_KCAL: kcal },
      },
    });
  const breakfast = {
    ...planSlotFactory.build({
      id: 'slot-b',
      planId: plan.id,
      position: 0,
      originalName: 'صبحانه',
      englishLabel: 'Breakfast',
    }),
    options: [
      {
        ...planOptionFactory.build({ id: 'opt-b1', planSlotId: 'slot-b', position: 0 }),
        items: [
          item('item-b1a', 'opt-b1', 0, ['تخم‌مرغ', 'egg'], 150),
          item('item-b1b', 'opt-b1', 1, ['نان سنگک', 'sangak bread'], 210),
        ],
      },
      {
        ...planOptionFactory.build({ id: 'opt-b2', planSlotId: 'slot-b', position: 1 }),
        items: [item('item-b2a', 'opt-b2', 0, ['جو دوسر', 'oats'], 150)],
      },
    ],
  };
  const lunch = {
    ...planSlotFactory.build({
      id: 'slot-l',
      planId: plan.id,
      position: 1,
      originalName: 'ناهار',
      englishLabel: 'Lunch',
    }),
    options: [
      {
        ...planOptionFactory.build({ id: 'opt-l1', planSlotId: 'slot-l', position: 0 }),
        items: [
          item('item-l1a', 'opt-l1', 0, ['برنج', 'rice'], 195),
          item('item-l1b', 'opt-l1', 1, ['مرغ', 'chicken'], 200),
        ],
      },
    ],
  };
  return {
    ...plan,
    slots: [breakfast, lunch],
    targets: [planTargetFactory.build({ id: 'target-1', planId: plan.id })],
    rules: [planRuleFactory.build({ id: 'rule-1', planId: plan.id })],
    notes: [planNoteFactory.build({ id: 'note-1', planId: plan.id })],
  };
}
