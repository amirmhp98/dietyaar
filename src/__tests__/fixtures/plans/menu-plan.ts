import { option, pi, range, resetIds, slot } from './builders';
import type { RubricSlot, RubricTarget } from '@/lib/rubric/types';

/**
 * Reference plan 1 (product spec § 6): five slots, an approximate energy range
 * per slot, two to five options each; choose one option per slot. Original
 * names in Persian with English labels. One training-day instruction is a note.
 */
export function buildMenuPlan() {
  resetIds();
  const breakfast = slot(
    'صبحانه',
    'Breakfast',
    [
      option([
        pi('تخم‌مرغ', 'egg', 2, 'piece', 'MEAT', 150, { unitGrams: 50 }),
        pi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210),
        pi('خیار و گوجه', 'cucumber and tomato', null, null, 'VEGETABLE'),
      ]),
      option([
        pi('جو دوسر', 'oats', 40, 'g', 'OTHER', 150),
        pi('ماست یونانی', 'Greek yogurt', 150, 'g', 'DAIRY', 130),
        pi('موز کوچک', 'small banana', 1, 'piece', 'FRUIT', 90, { unitGrams: 100 }),
        pi('گردو', 'walnuts', 15, 'g', 'NUTS', 100),
      ]),
      option([
        pi('پنیر', 'cheese', 30, 'g', 'DAIRY', 90),
        pi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210),
        pi('گردو', 'walnuts', 10, 'g', 'NUTS', 65),
        pi('سبزی خوردن', 'fresh herbs', null, null, 'HERB'),
      ]),
    ],
    0,
  );
  const snack1 = slot(
    'میان‌وعده اول',
    'First snack',
    [
      option([pi('سیب متوسط', 'medium apple', 1, 'piece', 'FRUIT', 95, { unitGrams: 180 })]),
      option([
        pi('خرما', 'dates', 3, 'date', 'FRUIT', 70),
        pi('بادام', 'almonds', 10, 'almond', 'NUTS', 70),
      ]),
    ],
    1,
  );
  const lunch = slot(
    'ناهار',
    'Lunch',
    [
      option([
        pi('برنج', 'rice', 150, 'g', 'RICE', 195),
        pi('مرغ', 'chicken', 120, 'g', 'MEAT', 200),
        pi('سالاد بزرگ', 'large salad', null, null, 'VEGETABLE'),
        pi('روغن زیتون', 'olive oil', 1, 'tsp', 'OIL', 40),
      ]),
      option([
        pi('عدسی', 'adasi (lentil stew)', 300, 'g', 'OTHER', 330),
        pi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210),
        pi('سبزی خوردن', 'fresh herbs', null, null, 'HERB'),
      ]),
      option([
        pi('ماهی', 'grilled fish', 150, 'g', 'MEAT', 250),
        pi('سیب‌زمینی', 'potato', 150, 'g', 'POTATO', 130),
        pi('سالاد', 'salad', null, null, 'VEGETABLE'),
      ]),
      option([
        pi('جوجه کباب', 'joojeh kabab', 150, 'g', 'MEAT', 260),
        pi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210),
        pi('گوجه کبابی', 'grilled tomato', null, null, 'VEGETABLE'),
        pi('ماست', 'yogurt', 100, 'g', 'DAIRY', 60),
      ]),
    ],
    2,
  );
  const snack2 = slot(
    'میان‌وعده دوم',
    'Second snack',
    [
      option([pi('پرتقال', 'orange', 1, 'piece', 'FRUIT', 70, { unitGrams: 150 })]),
      option([pi('شیر کم‌چرب', 'low-fat milk', 1, 'glass', 'DAIRY', 100)]),
    ],
    3,
  );
  const dinner = slot(
    'شام',
    'Dinner',
    [
      option([
        pi('برنج', 'rice', 100, 'g', 'RICE', 130),
        pi('مرغ', 'chicken', 120, 'g', 'MEAT', 200),
        pi('سالاد', 'salad', null, null, 'VEGETABLE'),
      ]),
      option([
        pi('املت', 'omelette', 2, 'egg', 'MEAT', 200),
        pi('نان سنگک', 'sangak bread', 60, 'g', 'BREAD', 160),
      ]),
      option([
        pi('سوپ', 'soup', 1, 'bowl', 'OTHER', 220),
        pi('نان سنگک', 'sangak bread', 40, 'g', 'BREAD', 105),
      ]),
    ],
    4,
  );
  const slots: RubricSlot[] = [breakfast, snack1, lunch, snack2, dinner];
  const targets: RubricTarget[] = [
    range(350, 420, breakfast.id),
    range(120, 160, snack1.id),
    range(650, 720, lunch.id),
    range(80, 120, snack2.id),
    range(400, 480, dinner.id),
    range(1600, 1900, null, 'SUM_OF_MEALS'),
  ];
  const notes = ['روزهای تمرین: یک موز یا سه خرما نزدیک تمرین اضافه شود'];
  return { slots, targets, notes, breakfast, snack1, lunch, snack2, dinner };
}
