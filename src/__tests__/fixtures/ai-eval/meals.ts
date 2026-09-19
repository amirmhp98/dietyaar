/**
 * Evaluation meals (tech spec § 10.5, implementation plan O11, improvement
 * plan A2). Three sources:
 * - OFF_PLAN: 40 Persian descriptions written the way a user types them —
 *   paraphrases of the two reference plans' meals plus common off-plan dishes;
 * - MENU_PLAN: every option of every slot of the menu plan, copied verbatim
 *   from `plans.ts`;
 * - WEEKDAY_PLAN: every slot of every weekday of the weekday plan, verbatim.
 * `expectedItems` are lower-case English keywords, one per food named in the
 * text (`a|b` accepts either spelling); a food counts as recalled when its own
 * returned item's `englishLabel` contains the keyword — two foods folded into
 * one item recall one food (scripts/ai-eval.ts `mealRecall`).
 * `reviewed: false` until the owner has checked the expected items — the
 * release thresholds (tech spec § 19 item 4) are read only from reviewed rows.
 */
export type EvalMealSource = 'OFF_PLAN' | 'MENU_PLAN' | 'WEEKDAY_PLAN';

export interface EvalMeal {
  text: string;
  expectedItems: string[];
  reviewed: boolean;
  source: EvalMealSource;
  /** Where the text comes from in the plan, for the runbook's per-meal list. */
  label?: string;
}

const m = (text: string, expectedItems: string[]): EvalMeal => ({
  text,
  expectedItems,
  reviewed: false,
  source: 'OFF_PLAN',
});

const menu = (label: string, text: string, expectedItems: string[]): EvalMeal => ({
  text,
  expectedItems,
  reviewed: false,
  source: 'MENU_PLAN',
  label,
});

const weekday = (label: string, text: string, expectedItems: string[]): EvalMeal => ({
  text,
  expectedItems,
  reviewed: false,
  source: 'WEEKDAY_PLAN',
  label,
});

/** Keywords shared by the plan fixtures (the plans repeat the same foods). */
const EGG = 'egg';
/** One food, not two: the assumed-defaults table lists خیار و گوجه as `cucumber_tomato`. */
const CUCUMBER_TOMATO = 'cucumber';
const SANGAK = 'sangak|bread';
const HERBS = 'herb|sabzi|green';
const LENTIL = 'lentil|adasi';
const JOOJEH = 'chicken|joojeh|jujeh';
const OMELET = 'omelet|omelette|egg';
const KABAB_OR_BURGER = 'kabab|kebab|burger|patty';

/** Menu plan (plans.ts MENU_PLAN_TEXT): one fixture per option of every slot. */
const MENU_PLAN_MEALS: EvalMeal[] = [
  menu('صبحانه 1', '۲ عدد تخم‌مرغ آب‌پز + یک کف دست نان سنگک + خیار و گوجه', [
    EGG,
    SANGAK,
    CUCUMBER_TOMATO,
  ]),
  menu('صبحانه 2', 'یک لیوان شیر کم‌چرب + ۴۰ گرم جو دوسر + ۳ عدد گردو', ['milk', 'oat', 'walnut']),
  menu('صبحانه 3', '۳۰ گرم پنیر + یک کف دست نان سنگک + سبزی خوردن + چای', [
    'cheese',
    SANGAK,
    HERBS,
    'tea',
  ]),
  menu('میان‌وعده اول 1', 'یک عدد سیب متوسط', ['apple']),
  menu('میان‌وعده اول 2', '۳ عدد خرما + چای', ['date', 'tea']),
  menu('ناهار 1', '۱۵۰ گرم مرغ گریل + ۱۰۰ گرم برنج + سالاد بزرگ با یک قاشق چای‌خوری روغن زیتون', [
    'chicken',
    'rice',
    'salad',
    'olive oil',
  ]),
  menu('ناهار 2', 'یک سیخ جوجه کباب + یک کف دست نان سنگک + سبزی', [JOOJEH, SANGAK, HERBS]),
  menu('ناهار 3', 'یک کاسه عدسی + یک کف دست نان سنگک', [LENTIL, SANGAK]),
  menu('ناهار 4', '۱۵۰ گرم ماهی + سیب‌زمینی آب‌پز یا تنوری + سالاد', ['fish', 'potato', 'salad']),
  menu('میان‌وعده دوم 1', 'یک کاسه ماست کم‌چرب', ['yogurt']),
  menu('میان‌وعده دوم 2', 'یک عدد موز کوچک', ['banana']),
  menu('شام 1', 'املت ۲ تخم‌مرغ با یک کف دست نان سنگک', [OMELET, SANGAK]),
  menu('شام 2', 'کباب تابه‌ای یا همبرگر خانگی + سبزی خوردن', [KABAB_OR_BURGER, HERBS]),
];

/** Weekday plan (plans.ts WEEKDAY_PLAN_TEXT): one fixture per slot of every day. */
const WEEKDAY_PLAN_MEALS: EvalMeal[] = [
  // شنبه
  weekday('شنبه صبحانه', '۲ عدد تخم‌مرغ آب‌پز، یک کف دست نان سنگک، خیار و گوجه', [
    EGG,
    SANGAK,
    CUCUMBER_TOMATO,
  ]),
  weekday('شنبه میان‌وعده صبح', 'یک عدد سیب', ['apple']),
  weekday('شنبه ناهار', '۱۵۰ گرم مرغ گریل، ۱۰۰ گرم برنج، سالاد بزرگ', ['chicken', 'rice', 'salad']),
  weekday('شنبه قبل تمرین', 'یک عدد موز کوچک', ['banana']),
  weekday('شنبه شام', 'کباب تابه‌ای یا همبرگر خانگی، سبزی خوردن', [KABAB_OR_BURGER, HERBS]),
  // یکشنبه
  weekday('یکشنبه صبحانه', 'یک لیوان شیر کم‌چرب، ۴۰ گرم جو دوسر، ۳ عدد گردو', [
    'milk',
    'oat',
    'walnut',
  ]),
  weekday('یکشنبه میان‌وعده صبح', '۳ عدد خرما', ['date']),
  weekday('یکشنبه ناهار', 'یک کاسه عدسی، یک کف دست نان سنگک', [LENTIL, SANGAK]),
  weekday('یکشنبه میان‌وعده عصر', 'یک کاسه ماست', ['yogurt']),
  weekday('یکشنبه شام', '۱۵۰ گرم ماهی، سیب‌زمینی آب‌پز یا تنوری', ['fish', 'potato']),
  // دوشنبه
  weekday('دوشنبه صبحانه', '۳۰ گرم پنیر، یک کف دست نان سنگک، چای', ['cheese', SANGAK, 'tea']),
  weekday('دوشنبه میان‌وعده صبح', 'یک عدد پرتقال', ['orange']),
  weekday('دوشنبه ناهار', 'یک سیخ جوجه کباب، یک کف دست نان سنگک، سبزی', [JOOJEH, SANGAK, HERBS]),
  weekday('دوشنبه قبل تمرین', 'یک عدد موز کوچک', ['banana']),
  weekday('دوشنبه شام', 'املت ۲ تخم‌مرغ، سالاد', [OMELET, 'salad']),
  // سه‌شنبه
  weekday('سه‌شنبه صبحانه', '۲ عدد تخم‌مرغ آب‌پز، یک کف دست نان سنگک', [EGG, SANGAK]),
  weekday('سه‌شنبه میان‌وعده صبح', 'یک عدد سیب', ['apple']),
  weekday('سه‌شنبه ناهار', '۱۵۰ گرم مرغ گریل، ۱۰۰ گرم برنج، سالاد', ['chicken', 'rice', 'salad']),
  weekday('سه‌شنبه میان‌وعده عصر', 'یک کاسه ماست', ['yogurt']),
  weekday('سه‌شنبه شام', 'یک کاسه عدسی', [LENTIL]),
  // چهارشنبه
  weekday('چهارشنبه صبحانه', 'یک لیوان شیر کم‌چرب، ۴۰ گرم جو دوسر', ['milk', 'oat']),
  weekday('چهارشنبه میان‌وعده صبح', '۳ عدد خرما', ['date']),
  weekday('چهارشنبه ناهار', '۱۵۰ گرم ماهی، سیب‌زمینی آب‌پز یا تنوری، سالاد', [
    'fish',
    'potato',
    'salad',
  ]),
  weekday('چهارشنبه قبل تمرین', 'یک عدد موز کوچک', ['banana']),
  weekday('چهارشنبه شام', 'کباب تابه‌ای یا همبرگر خانگی، سبزی خوردن', [KABAB_OR_BURGER, HERBS]),
  // پنجشنبه
  weekday('پنجشنبه صبحانه', '۳۰ گرم پنیر، یک کف دست نان سنگک، چای', ['cheese', SANGAK, 'tea']),
  weekday('پنجشنبه میان‌وعده صبح', 'یک عدد پرتقال', ['orange']),
  weekday('پنجشنبه ناهار', 'یک سیخ جوجه کباب، سبزی', [JOOJEH, HERBS]),
  weekday('پنجشنبه میان‌وعده عصر', 'یک کاسه ماست', ['yogurt']),
  weekday('پنجشنبه شام', 'املت ۲ تخم‌مرغ، سالاد', [OMELET, 'salad']),
  // جمعه
  weekday('جمعه صبحانه', '۲ عدد تخم‌مرغ آب‌پز، یک کف دست نان سنگک، خیار و گوجه', [
    EGG,
    SANGAK,
    CUCUMBER_TOMATO,
  ]),
  weekday('جمعه میان‌وعده صبح', 'یک عدد سیب', ['apple']),
  weekday('جمعه ناهار', '۱۵۰ گرم مرغ گریل، ۱۰۰ گرم برنج، سالاد بزرگ', ['chicken', 'rice', 'salad']),
  weekday('جمعه میان‌وعده عصر', 'یک کاسه ماست', ['yogurt']),
  weekday('جمعه شام', 'یک کاسه عدسی، یک کف دست نان سنگک', [LENTIL, SANGAK]),
];

const OFF_PLAN_MEALS: EvalMeal[] = [
  // Breakfasts from the plans
  m('۲ عدد تخم‌مرغ آب‌پز با یک کف دست نان سنگک و خیار و گوجه', ['egg', 'sangak', 'cucumber']),
  m('یک لیوان شیر کم‌چرب، ۴۰ گرم جو دوسر و ۳ عدد گردو', ['milk', 'oat', 'walnut']),
  m('۳۰ گرم پنیر با نان سنگک، سبزی خوردن و یک استکان چای', ['cheese', 'sangak', 'herb', 'tea']),
  m('املت ۲ تخم‌مرغ با یک کف دست نان سنگک', ['egg|omelet', 'sangak']),
  m('صبحانه: نان و پنیر و گردو', ['bread', 'cheese', 'walnut']),
  m('یک کاسه جو دوسر با شیر و یک موز کوچک', ['oat', 'milk', 'banana']),
  m('دو تا تخم مرغ نیمرو با نون بربری', ['egg', 'barbari']),
  m('چای شیرین و دو تا خرما', ['tea', 'date']),

  // Snacks
  m('یک عدد سیب متوسط', ['apple']),
  m('۳ عدد خرما با چای', ['date', 'tea']),
  m('یک کاسه ماست کم‌چرب', ['yogurt']),
  m('یک عدد موز کوچک', ['banana']),
  m('یک عدد پرتقال', ['orange']),
  m('یک مشت گردو و ۳ عدد خرما', ['walnut', 'date']),
  m('یه مشت بادام خام', ['almond']),
  m('یک لیوان دوغ', ['doogh']),

  // Lunches from the plans
  m('۱۵۰ گرم مرغ گریل با ۱۰۰ گرم برنج و سالاد بزرگ با یک قاشق چای‌خوری روغن زیتون', [
    'chicken',
    'rice',
    'salad',
    'olive oil',
  ]),
  m('یک سیخ جوجه کباب با یک کف دست نان سنگک و سبزی', ['chicken', 'sangak', 'herb']),
  m('یک کاسه عدسی با یک کف دست نان سنگک', ['lentil', 'sangak']),
  m('۱۵۰ گرم ماهی با سیب‌زمینی آب‌پز و سالاد', ['fish', 'potato', 'salad']),
  m('ماهی تنوری با سیب زمینی', ['fish', 'potato']),
  m('جوجه کباب بدون نون با سبزی خوردن', ['chicken', 'herb']),
  m('مرغ گریل ۱۵۰ گرم و برنج ۱۰۰ گرم', ['chicken', 'rice']),
  m('عدسی و نان', ['lentil', 'bread']),

  // Dinners from the plans
  m('کباب تابه‌ای با سبزی خوردن', ['kebab|kabab|patty', 'herb']),
  m('همبرگر خانگی با سبزی خوردن', ['burger', 'herb']),
  m('املت دو تخم‌مرغ با سالاد', ['egg|omelet', 'salad']),
  m('یک کاسه عدسی', ['lentil']),

  // Common off-plan meals
  m('یک بشقاب چلو خورشت قیمه با سالاد شیرازی', ['rice', 'gheymeh', 'salad']),
  m('چلوکباب کوبیده با گوجه کبابی و دوغ', ['rice', 'kebab|kabab|koobideh', 'tomato', 'doogh']),
  m('ساندویچ همبرگر با سیب‌زمینی سرخ‌کرده و نوشابه', ['burger', 'fries', 'soda|soft drink|cola']),
  m('دو تکه پیتزا پپرونی', ['pizza']),
  m('یک بشقاب قورمه سبزی با برنج', ['ghormeh', 'rice']),
  m('زرشک پلو با مرغ', ['barberry|zereshk', 'chicken']),
  m('یک کاسه آش رشته', ['ash reshteh']),
  m('کتلت با نان لواش و گوجه', ['cutlet|kotlet', 'lavash', 'tomato']),
  m('یک تکه کیک شکلاتی و یک فنجان قهوه', ['cake', 'coffee']),
  m('نصف طالبی', ['cantaloupe']),
  m('سالاد سزار با مرغ گریل', ['salad', 'chicken']),
  m('یک لیوان آب پرتقال طبیعی', ['orange juice']),
];

export const EVAL_MEALS: EvalMeal[] = [
  ...OFF_PLAN_MEALS,
  ...MENU_PLAN_MEALS,
  ...WEEKDAY_PLAN_MEALS,
];
