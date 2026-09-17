import { option, pi, resetIds, slot } from './builders';
import type { RubricSlot } from '@/lib/rubric/types';

/**
 * Reference plan 2 (product spec § 6): Saturday to Friday, each day labelled
 * with a day type (kept as a note) and an approximate daily energy figure;
 * five named slots per day, names vary by day; no clock times; some items
 * carry in-item alternatives ("boiled or oven potato").
 */
export function buildWeekdayPlan() {
  resetIds();
  // Saturday = 6 (JavaScript weekday)
  const saturday: RubricSlot[] = [
    slot(
      'صبحانه',
      'Breakfast',
      [
        option([
          pi('تخم‌مرغ', 'egg', 2, 'egg', 'MEAT', 150),
          pi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210),
        ]),
      ],
      0,
      { weekday: 6 },
    ),
    slot(
      'میان‌وعده قبل تمرین',
      'Pre-workout snack',
      [option([pi('موز', 'banana', 1, 'small_banana', 'FRUIT', 90)])],
      1,
      { weekday: 6 },
    ),
    slot(
      'ناهار',
      'Lunch',
      [
        option([
          pi('کباب تابه‌ای', 'kabab tabei', 150, 'g', 'MEAT', 300, {
            alternatives: [{ originalName: 'همبرگر خانگی', englishLabel: 'homemade burger' }],
          }),
          pi('سیب‌زمینی آب‌پز', 'boiled potato', 150, 'g', 'POTATO', 130, {
            alternatives: [{ originalName: 'سیب‌زمینی تنوری', englishLabel: 'oven potato' }],
          }),
          pi('سالاد', 'salad', null, null, 'VEGETABLE'),
        ]),
      ],
      2,
      { weekday: 6 },
    ),
    slot(
      'میان‌وعده عصر',
      'Afternoon snack',
      [option([pi('سیب', 'apple', 1, 'medium_apple', 'FRUIT', 95)])],
      3,
      { weekday: 6 },
    ),
    slot(
      'شام',
      'Dinner',
      [
        option([
          pi('ماهی', 'fish', 150, 'g', 'MEAT', 250),
          pi('سبزیجات بخارپز', 'steamed vegetables', 200, 'g', 'VEGETABLE', 70),
        ]),
      ],
      4,
      { weekday: 6 },
    ),
  ];
  const sunday: RubricSlot[] = [
    slot(
      'صبحانه',
      'Breakfast',
      [
        option([
          pi('پنیر', 'cheese', 30, 'g', 'DAIRY', 90),
          pi('نان سنگک', 'sangak bread', 80, 'g', 'BREAD', 210),
        ]),
      ],
      0,
      { weekday: 0 },
    ),
    slot(
      'میان‌وعده صبح',
      'Morning snack',
      [option([pi('خرما', 'dates', 3, 'date', 'FRUIT', 70)])],
      1,
      { weekday: 0 },
    ),
    slot(
      'ناهار',
      'Lunch',
      [
        option([
          pi('مرغ', 'chicken', 120, 'g', 'MEAT', 200),
          pi('برنج', 'rice', 150, 'g', 'RICE', 195),
        ]),
      ],
      2,
      { weekday: 0 },
    ),
    slot(
      'میان‌وعده عصر',
      'Afternoon snack',
      [option([pi('ماست', 'yogurt', 150, 'g', 'DAIRY', 90)])],
      3,
      { weekday: 0 },
    ),
    slot(
      'شام',
      'Dinner',
      [
        option([
          pi('مرغ', 'chicken', 120, 'g', 'MEAT', 200),
          pi('سالاد', 'salad', null, null, 'VEGETABLE'),
        ]),
      ],
      4,
      { weekday: 0 },
    ),
  ];
  const tuesday: RubricSlot[] = [
    slot('صبحانه', 'Breakfast', [option([pi('جو دوسر', 'oats', 40, 'g', 'OTHER', 150)])], 0, {
      weekday: 2,
    }),
    slot('ناهار', 'Lunch', [option([pi('ماهی', 'fish', 150, 'g', 'MEAT', 250)])], 1, {
      weekday: 2,
    }),
    slot('شام', 'Dinner', [option([pi('سوپ', 'soup', 1, 'bowl', 'OTHER', 220)])], 2, {
      weekday: 2,
    }),
  ];
  const wednesday: RubricSlot[] = [
    slot('صبحانه', 'Breakfast', [option([pi('جو دوسر', 'oats', 40, 'g', 'OTHER', 150)])], 0, {
      weekday: 3,
    }),
    slot('ناهار', 'Lunch', [option([pi('مرغ', 'chicken', 150, 'g', 'MEAT', 250)])], 1, {
      weekday: 3,
    }),
    slot('شام', 'Dinner', [option([pi('سوپ', 'soup', 1, 'bowl', 'OTHER', 220)])], 2, {
      weekday: 3,
    }),
  ];
  const allSlots = [...saturday, ...sunday, ...tuesday, ...wednesday];
  const dayTypeNotes = [
    'شنبه: روز تمرین — حدود ۲۲۰۰ کیلوکالری',
    'یکشنبه: روز استراحت — حدود ۱۹۰۰ کیلوکالری',
  ];
  return { saturday, sunday, tuesday, wednesday, allSlots, dayTypeNotes };
}
